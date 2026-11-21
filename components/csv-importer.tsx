"use client";

import { useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, FileSpreadsheet, LoaderCircle, Plus, Upload, X } from "lucide-react";
import { hasAmbiguousDirection, normalizeRows, parseCsvFile } from "@/lib/csv";
import type { ColumnMapping, ParsedCsvFile, Transaction } from "@/lib/models";

const maxCsvFileBytes = 25 * 1024 * 1024;

const fieldLabels: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: "date", label: "Transaction date", required: true },
  { key: "description", label: "Description" },
  { key: "amount", label: "Amount" },
  { key: "debit", label: "Debit / outflow" },
  { key: "credit", label: "Credit / inflow" },
  { key: "type", label: "Transaction type" },
  { key: "currency", label: "Currency" },
  { key: "account", label: "Account" },
  { key: "merchant", label: "Merchant / counterparty" },
  { key: "source", label: "Source account" },
  { key: "target", label: "Destination account" }
];

interface CsvImporterProps {
  onClose?: () => void;
  onImport: (transactions: Transaction[]) => Promise<{ added: number; duplicates: number }>;
}

export function CsvImporter({ onClose, onImport }: CsvImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ParsedCsvFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError("");
    setNotice("");
    setLoadingFiles(true);
    const results = await Promise.all(Array.from(fileList).map(async (file) => {
      if (file.size > maxCsvFileBytes) {
        return { error: `${file.name}: files must be 25 MB or smaller.` };
      }
      try {
        return { parsed: await parseCsvFile(file) };
      } catch (reason) {
        return { error: reason instanceof Error ? reason.message : `${file.name}: the file could not be read.` };
      }
    }));
    const parsed: ParsedCsvFile[] = results.flatMap((result) => "parsed" in result && result.parsed ? [result.parsed] : []);
    setFiles((current) => {
      const knownIds = new Set(current.map((file) => file.id));
      const additions: ParsedCsvFile[] = [];
      parsed.forEach((file) => {
        if (knownIds.has(file.id)) return;
        knownIds.add(file.id);
        additions.push(file);
      });
      return [...current, ...additions];
    });
    const errors = results.flatMap((result) => "error" in result ? [result.error] : []);
    if (errors.length) setError(errors.join(" "));
    setLoadingFiles(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function updateMapping(fileId: string, key: keyof ColumnMapping, value: string) {
    setFiles((current) => current.map((file) => file.id === fileId
      ? { ...file, mapping: { ...file.mapping, [key]: value } }
      : file));
    setError("");
    setNotice("");
  }

  async function importFiles() {
    setError("");
    setNotice("");
    setImporting(true);
    try {
      const normalized = files.map((file) => normalizeRows(file));
      const parsedTransactions = normalized.flatMap((result) => result.transactions);
      const deduplicated = new Map<string, Transaction>();
      parsedTransactions.forEach((item) => deduplicated.set(item.id, item));
      const all = [...deduplicated.values()];
      if (all.length === 0) throw new Error("No usable transactions were found. Check the column mapping and file contents.");
      const result = await onImport(all);
      const invalid = normalized.reduce((count, result) => count + result.errors.length, 0);
      const duplicates = parsedTransactions.length - all.length + result.duplicates;
      setNotice(`${result.added} transactions added${duplicates ? `, ${duplicates} duplicates skipped` : ""}${invalid ? `, ${invalid} invalid rows skipped` : ""}. Your saved data now powers your analysis, savings plan, and local AI assistant.`);
      setFiles([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The CSV files could not be imported.");
    } finally {
      setImporting(false);
    }
  }

  const directionIsAmbiguous = files.some(hasAmbiguousDirection);

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-8 text-center transition hover:border-brand/50 hover:bg-rose-50/30"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void handleFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand shadow-sm">
          {loadingFiles ? <LoaderCircle className="animate-spin" size={22} /> : <Upload size={21} />}
        </div>
        <p className="font-semibold text-ink">Drop your CSV files here</p>
        <p className="mt-1 text-sm text-muted">Files stay in this browser and are never uploaded to a server.</p>
        <button
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-slate-300 hover:bg-slate-50"
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          <Plus size={16} /> Choose CSV files
        </button>
      </div>

      {files.map((file) => {
        const mappedAmount = Boolean(file.mapping.amount || file.mapping.debit || file.mapping.credit);
        const directionIsUnclear = hasAmbiguousDirection(file);
        return (
          <div className="rounded-2xl border border-line bg-white p-5" key={file.id}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-brand"><FileSpreadsheet size={19} /></span>
                <div>
                  <p className="max-w-[230px] truncate text-sm font-semibold text-ink">{file.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{file.rows.length} rows · {file.headers.length} columns</p>
                </div>
              </div>
              <button aria-label={`Remove ${file.name}`} className="rounded-lg p-2 text-muted hover:bg-slate-100 hover:text-ink" onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))} type="button"><X size={16} /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fieldLabels.map(({ key, label, required }) => (
                <label className="block" key={key}>
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}{required ? " *" : ""}</span>
                  <span className="relative block">
                    <select
                      className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
                      value={file.mapping[key]}
                      onChange={(event) => updateMapping(file.id, key, event.target.value)}
                    >
                      <option value="">Not mapped</option>
                      {file.headers.map((header) => <option key={header} value={header}>{header}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-2.5 text-slate-400" size={15} />
                  </span>
                </label>
              ))}
            </div>
            {(!file.mapping.date || !mappedAmount) && <p className="mt-3 flex items-center gap-2 text-xs text-amber-700"><AlertCircle size={14} /> Map a transaction date and at least one amount column to continue.</p>}
            {directionIsUnclear && <p className="mt-3 flex items-center gap-2 text-xs text-amber-700"><AlertCircle size={14} /> Positive amounts need a recognizable income/expense type or debit/credit columns so direction is not guessed.</p>}
            {file.parseWarnings.length > 0 && <p className="mt-2 text-xs text-amber-700">{file.parseWarnings.length} CSV parsing warning(s); review your file before importing.</p>}
          </div>
        );
      })}

      {error && <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={16} />{error}</p>}
      {notice && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><Check size={16} />{notice}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs leading-5 text-muted">Transactions are validated and saved locally in IndexedDB.</p>
        <div className="flex gap-2">
          {onClose && <button className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={onClose} type="button">Cancel</button>}
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!files.length || importing || loadingFiles || files.some((file) => !file.mapping.date || !(file.mapping.amount || file.mapping.debit || file.mapping.credit)) || directionIsAmbiguous}
            onClick={() => void importFiles()}
            type="button"
          >
            {importing ? <LoaderCircle className="animate-spin" size={16} /> : <Upload size={16} />}
            {importing ? "Importing…" : "Import transactions"}
          </button>
        </div>
      </div>
    </div>
  );
}
