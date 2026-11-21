import Papa from "papaparse";
import { classifyTransaction } from "@/lib/intelligence";
import { transactionSchema, type CategoryRule, type ColumnMapping, type ParsedCsvFile, type Transaction, type TransactionType } from "@/lib/models";

const emptyMapping: ColumnMapping = {
  date: "",
  description: "",
  amount: "",
  debit: "",
  credit: "",
  type: "",
  currency: "",
  account: "",
  merchant: "",
  source: "",
  target: ""
};

const aliases: Record<keyof ColumnMapping, string[]> = {
  date: ["date", "transaction_date", "booking_date", "bookingdate", "value_date", "valuedate", "trans_date", "datum"],
  description: ["description", "name", "details", "memo", "purpose", "text", "verwendungszweck", "buchungstext"],
  amount: ["amount", "value", "sum", "betrag", "transaction_amount"],
  debit: ["debit", "withdrawal", "outflow", "belastung", "soll"],
  credit: ["credit", "deposit", "inflow", "gutschrift", "haben"],
  type: ["type", "transaction_type", "booking_type", "direction", "art"],
  currency: ["currency", "ccy", "währung", "waehrung"],
  account: ["account", "account_name", "account_label", "konto"],
  merchant: ["merchant", "counterparty", "payee", "recipient"],
  source: ["source", "source_id", "source_label", "from"],
  target: ["target", "target_id", "target_label", "to"]
};

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping = { ...emptyMapping };
  for (const field of Object.keys(aliases) as (keyof ColumnMapping)[]) {
    const found = headers.find((header) => aliases[field].includes(normalizedHeader(header)));
    if (found) mapping[field] = found;
  }
  return mapping;
}

export async function parseCsvFile(file: File): Promise<ParsedCsvFile> {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete(result) {
        const headers = result.meta.fields ?? [];
        if (headers.length === 0) {
          reject(new Error(`${file.name}: no column headers were found.`));
          return;
        }
        resolve({
          id: `${file.name}-${file.size}-${file.lastModified}`,
          name: file.name,
          headers,
          rows: result.data,
          mapping: detectColumnMapping(headers),
          parseWarnings: result.errors.map((error: { row?: number; message: string }) => `Row ${error.row ?? "?"}: ${error.message}`)
        });
      },
      error(error: Error) {
        reject(new Error(`${file.name}: ${error.message}`));
      }
    });
  });
}

function cell(row: Record<string, unknown>, key: string): string {
  if (!key) return "";
  const value = row[key];
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseAmount(value: string): number | undefined {
  if (!value) return undefined;
  let normalized = value.replace(/[’']/g, "").replace(/\s/g, "");
  const parenthesesNegative = /^\(.*\)$/.test(normalized);
  normalized = normalized.replace(/[()]/g, "").replace(/[^\d,.-]/g, "");
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.lastIndexOf(",") > normalized.lastIndexOf(".")
      ? normalized.replace(/\./g, "").replace(",", ".")
      : normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    const decimals = normalized.split(",").at(-1)?.length ?? 0;
    normalized = decimals > 0 && decimals <= 2 ? normalized.replace(",", ".") : normalized.replace(/,/g, "");
  }
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return undefined;
  return parenthesesNegative ? -Math.abs(amount) : amount;
}

export function hasAmbiguousDirection(file: ParsedCsvFile): boolean {
  const { mapping } = file;
  if (mapping.debit || mapping.credit || !mapping.amount) return false;
  const positiveRows = file.rows.filter((row) => (parseAmount(cell(row, mapping.amount)) ?? 0) > 0);
  if (!positiveRows.length || file.rows.some((row) => (parseAmount(cell(row, mapping.amount)) ?? 0) < 0)) return false;
  const directionPattern = /income|credit|deposit|salary|payroll|gutschrift|haben|expense|debit|payment|purchase|belastung|soll|transfer|übertrag|uebertrag|investment|security|refund|reversal|chargeback/i;
  return positiveRows.some((row) => !mapping.type || !directionPattern.test(cell(row, mapping.type)));
}

function normalizeDate(value: string): string | undefined {
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  let normalized: string;
  if (iso) {
    normalized = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  } else {
    const european = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (european) {
      normalized = `${european[3]}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
    } else {
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return undefined;
      normalized = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
  }
  const [year, month, day] = normalized.split("-").map(Number);
  const validated = new Date(Date.UTC(year, month - 1, day));
  if (validated.getUTCFullYear() !== year || validated.getUTCMonth() !== month - 1 || validated.getUTCDate() !== day) return undefined;
  return normalized;
}

function transactionKind(rawType: string, amount: number, description: string, source: string, target: string): TransactionType {
  const type = rawType.toLowerCase();
  const detail = description.toLowerCase();
  const ownAccounts = /^account\d+$/i.test(source) && /^account\d+$/i.test(target);
  if (/transfer|own account|internal|übertrag|uebertrag|kreditkarten-zahlung/.test(type) || ownAccounts || /own account|internal transfer|transfer between accounts|account-to-account|kreditkarten-zahlung/.test(detail)) return "transfer";
  if (/investment|security|securities|etf|share purchase|stock/.test(`${type} ${detail}`)) return "investment";
  if (/refund|reversal|chargeback|erstattung|rückerstattung/.test(`${type} ${description.toLowerCase()}`)) return "refund";
  if (/credit.?card.?payment|debit.?card.?payment/.test(type)) return "expense";
  if (/income|credit|deposit|salary|payroll|gutschrift|haben/.test(type)) return "income";
  if (/expense|debit|payment|purchase|belastung|soll/.test(type)) return "expense";
  return amount < 0 ? "expense" : "income";
}

function stableId(values: string[]) {
  const text = values.map((value) => value.trim().toLowerCase()).join("|");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function pairedLabel(row: Record<string, unknown>, key: string): string {
  if (!key) return "";
  const base = key.replace(/_(id|code)$/i, "");
  return cell(row, `${base}_label`) || cell(row, `${base}_name`) || cell(row, key);
}

export function normalizeRows(file: ParsedCsvFile, rules: CategoryRule[] = []): { transactions: Transaction[]; errors: string[] } {
  const { mapping } = file;
  const hasAmount = Boolean(mapping.amount || mapping.debit || mapping.credit);
  if (!mapping.date || !hasAmount) {
    throw new Error(`${file.name}: map at least a date column and an amount, debit, or credit column.`);
  }

  const transactions: Transaction[] = [];
  const errors: string[] = [];
  file.rows.forEach((row, index) => {
    const date = normalizeDate(cell(row, mapping.date));
    const description = cell(row, mapping.description) || "Unlabelled transaction";
    const amountRaw = parseAmount(cell(row, mapping.amount));
    const debitRaw = parseAmount(cell(row, mapping.debit));
    const creditRaw = parseAmount(cell(row, mapping.credit));
    let originalAmount: number | undefined;
    if (debitRaw !== undefined || creditRaw !== undefined) {
      if (debitRaw && creditRaw) {
        errors.push(`${file.name}, row ${index + 2}: skipped because both debit and credit amounts are present.`);
        return;
      }
      originalAmount = Math.abs(creditRaw ?? 0) - Math.abs(debitRaw ?? 0);
    } else {
      originalAmount = amountRaw;
    }
    if (!date || originalAmount === undefined || originalAmount === 0) {
      errors.push(`${file.name}, row ${index + 2}: skipped because its date or non-zero amount could not be read.`);
      return;
    }

    const rawType = cell(row, mapping.type);
    const source = cell(row, mapping.source);
    const target = cell(row, mapping.target);
    const kind = transactionKind(rawType, originalAmount, description, source, target);
    const amount = kind === "expense" ? -Math.abs(originalAmount) : Math.abs(originalAmount);
    const sourceLabel = pairedLabel(row, mapping.source);
    const targetLabel = pairedLabel(row, mapping.target);
    const merchant = cell(row, mapping.merchant) || (kind === "expense" ? targetLabel : kind === "income" || kind === "refund" ? sourceLabel : sourceLabel || targetLabel);
    const sourceAccount = /^account\d+$/i.test(source) ? sourceLabel : "";
    const targetAccount = /^account\d+$/i.test(target) ? targetLabel : "";
    const account = cell(row, mapping.account) || sourceAccount || targetAccount || "Unspecified account";
    const rawCurrency = cell(row, mapping.currency).toUpperCase();
    const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : "XXX";
    const id = stableId([
      date,
      description,
      String(originalAmount),
      currency,
      rawType || kind,
      source,
      target,
      account
    ]);
    const candidate = {
      id,
      date,
      description,
      amount,
      originalAmount,
      currency,
      category: classifyTransaction({ type: kind, description, merchant }, rules),
      categorySource: "rule",
      type: kind,
      account,
      merchant,
      isRecurring: false,
      confidence: rawType ? 0.96 : mapping.amount ? 0.82 : 0.75,
      sourceFile: file.name
    };
    const validated = transactionSchema.safeParse(candidate);
    if (!validated.success) {
      errors.push(`${file.name}, row ${index + 2}: ${validated.error.issues[0]?.message ?? "invalid transaction"}.`);
      return;
    }
    transactions.push(validated.data);
  });
  return { transactions, errors };
}
