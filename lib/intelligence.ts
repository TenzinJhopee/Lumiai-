import type {
  Budget,
  CategoryRule,
  Investment,
  SavingsTarget,
  Transaction,
  TransactionCategory,
  TransactionType,
  UpcomingBill
} from "@/lib/models";

export interface MonthlySummary {
  key: string;
  month: string;
  income: number;
  expenses: number;
  refunds: number;
  investmentPurchases: number;
  savings: number;
  cashFlow: number;
}

export interface RecurringFlow {
  key: string;
  name: string;
  category: TransactionCategory;
  type: "income" | "expense";
  currency: string;
  occurrenceCount: number;
  averageAmount: number;
  monthlyAmount: number;
  cadence: "weekly" | "monthly" | "quarterly";
  confidence: number;
  transactionIds: string[];
}

export interface AccountAnalysis {
  currency: string;
  periodStart: string;
  periodEnd: string;
  monthCount: number;
  totalIncome: number;
  totalExpenses: number;
  totalRefunds: number;
  totalInvestments: number;
  netCashFlow: number;
  monthlySavings: number;
  savingsRate: number;
  averageMonthlySpending: number;
  largestExpenses: Transaction[];
  recurringPayments: RecurringFlow[];
  monthlySummaries: MonthlySummary[];
  expenditureChanges: { month: string; previous: number; current: number; change: number; changeRate: number | null }[];
}

export interface BudgetSuggestion {
  category: TransactionCategory;
  monthlyLimit: number;
  historicalAverage: number;
  monthsUsed: number;
  actualSpending: number;
}

export interface BudgetCalculation {
  monthlyLimit: number;
  actualSpending: number;
  remaining: number;
  overspent: number;
  progressPercent: number | null;
  isOverBudget: boolean;
}

export interface SavingsOpportunity {
  id: string;
  title: string;
  explanation: string;
  category: TransactionCategory;
  monthlySavings: number;
  assumption: string;
  confidence: number;
  transactionIds: string[];
}

export interface SavingsPlan {
  monthlyIncome: number;
  currentMonthlySavings: number;
  targetMonthlySavings: number;
  targetGap: number;
  estimatedOpportunity: number;
  actions: SavingsOpportunity[];
}

export interface FinancialInsight {
  id: string;
  title: string;
  explanation: string;
  evidence: string;
  financialImpact: number;
  impactLabel: string;
  suggestedAction: string;
  confidence: number;
  confidenceLabel: "High" | "Medium" | "Low";
  transactionIds: string[];
}

export interface ForecastHorizon {
  days: 30 | 90;
  projectedIncome: number;
  projectedExpenses: number;
  projectedNetFlow: number;
  knownBills: number;
}

export interface CashFlowForecast {
  currency: string;
  asOfDate: string;
  recurringIncomeMonthly: number;
  recurringExpensesMonthly: number;
  averageVariableExpensesMonthly: number;
  recurringIncomeFlows: RecurringFlow[];
  recurringExpenseFlows: RecurringFlow[];
  horizons: [ForecastHorizon, ForecastHorizon];
  assumptions: string[];
  confidence: number;
}

export interface PortfolioAnalysis {
  currency: string;
  totalInvested: number;
  currentValue: number;
  unrealizedProfitLoss: number;
  returnPercent: number;
  allocation: { id: string; name: string; ticker: string; value: number; sharePercent: number }[];
}

const categoryKeywords: Record<Exclude<TransactionCategory, "Income" | "Transfers" | "Investments" | "Other">, string[]> = {
  Housing: ["rent", "mortgage", "landlord", "miete", "mietzins", "housing", "wohnung", "home loan"],
  Insurance: ["insurance", "versicherung", "krankenkasse", "health plan", "premium", "assurance"],
  Healthcare: ["doctor", "medical", "healthcare", "pharmacy", "apotheke", "dentist", "hospital", "clinic", "optik"],
  Transport: ["sbb", "train", "rail", "bus", "tram", "transport", "fuel", "benz", "tankstelle", "parking", "taxi", "uber", "ö v abo", "öV abo"],
  Restaurants: ["restaurant", "ristorante", "cafe", "café", "coffee shop", "takeaway", "take away", "deliveroo", "ubereats", "eat.ch", "kantine", "lunch", "mittagessen", "dining"],
  Food: ["grocery", "groceries", "supermarket", "coop", "migros", "denner", "aldi", "lidl", "food", "bakery", "bäckerei"],
  Shopping: ["shopping", "amazon", "digitec", "galaxus", "zalando", "h&m", "manor", "orell", "veloshop", "fashion", "store", "nike", "apple online", "bestellung"],
  Entertainment: ["cinema", "movie", "theatre", "theater", "concert", "ticketcorner", "netflix", "spotify", "steam", "game", "museum", "event"],
  Utilities: ["utility", "utilities", "electric", "electricity", "ewz", "water bill", "heating", "internet", "swisscom", "salt", "sunrise", "phone bill"],
  Subscriptions: ["subscription", "monthly plan", "membership", "icloud", "microsoft 365", "adobe", "youtube premium", "recurring"]
};

function normalizedText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function ruleMatches(rule: CategoryRule, merchant: string, description: string) {
  if (!rule.enabled || !rule.keyword.trim()) return false;
  const keyword = normalizedText(rule.keyword);
  const source = rule.matchOn === "merchant" ? merchant : rule.matchOn === "description" ? description : `${merchant} ${description}`;
  return normalizedText(source).includes(keyword);
}

export function classifyTransaction(
  transaction: Pick<Transaction, "type" | "description" | "merchant">,
  rules: CategoryRule[] = []
): TransactionCategory {
  if (transaction.type === "income" || transaction.type === "refund") return "Income";
  if (transaction.type === "transfer") return "Transfers";
  if (transaction.type === "investment") return "Investments";

  const merchant = transaction.merchant ?? "";
  const description = transaction.description ?? "";
  const customRule = rules.find((rule) => ruleMatches(rule, merchant, description));
  if (customRule) return customRule.category;

  const text = normalizedText(`${merchant} ${description}`);
  const order: Exclude<TransactionCategory, "Income" | "Transfers" | "Investments" | "Other">[] = [
    "Housing",
    "Insurance",
    "Healthcare",
    "Transport",
    "Restaurants",
    "Food",
    "Shopping",
    "Entertainment",
    "Utilities",
    "Subscriptions"
  ];
  return order.find((category) => categoryKeywords[category].some((keyword) => text.includes(normalizedText(keyword)))) ?? "Other";
}

function legacyCategory(category: string): TransactionCategory | undefined {
  const aliases: Record<string, TransactionCategory> = {
    salary: "Income",
    "other income": "Income",
    refunds: "Income",
    transfers: "Transfers",
    investments: "Investments",
    "food & dining": "Food",
    restaurants: "Restaurants",
    "health & insurance": "Healthcare",
    "online payments": "Other",
    bills: "Utilities"
  };
  if (category in aliases) return aliases[category];
  return isTransactionCategory(category) ? category : undefined;
}

function isTransactionCategory(value: string): value is TransactionCategory {
  return [
    "Income", "Housing", "Food", "Restaurants", "Transport", "Healthcare", "Insurance",
    "Shopping", "Entertainment", "Utilities", "Subscriptions", "Investments", "Transfers", "Other"
  ].includes(value);
}

export function applyClassificationRules(transactions: Transaction[], rules: CategoryRule[] = []): Transaction[] {
  return transactions.map((transaction) => {
    if (transaction.categorySource === "manual") {
      return {
        ...transaction,
        category: legacyCategory(transaction.category) ?? classifyTransaction(transaction, rules),
        categorySource: "manual"
      };
    }
    return { ...transaction, category: classifyTransaction(transaction, rules), categorySource: "rule" };
  });
}

export function deduplicateTransactions(transactions: Transaction[]) {
  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const unique: Transaction[] = [];
  let duplicates = 0;
  for (const transaction of transactions) {
    const signature = [
      transaction.date,
      transaction.type,
      Math.round(Math.abs(transaction.originalAmount ?? transaction.amount) * 100),
      transaction.currency.toUpperCase(),
      normalizedText(transaction.description),
      normalizedText(transaction.merchant),
      normalizedText(transaction.account)
    ].join("|");
    if (seenIds.has(transaction.id) || seenSignatures.has(signature)) {
      duplicates += 1;
      continue;
    }
    seenIds.add(transaction.id);
    seenSignatures.add(signature);
    unique.push(transaction);
  }
  return { transactions: unique, duplicates };
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthName(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "short" });
}

function addMonths(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sumAbsolute(transactions: Transaction[]) {
  return transactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
}

export function getCurrencies(transactions: Transaction[]) {
  return [...new Set(transactions.map((transaction) => transaction.currency))].sort();
}

export function getLatestMonth(transactions: Transaction[]) {
  return transactions.reduce((latest, item) => monthKey(item.date) > latest ? monthKey(item.date) : latest, "");
}

export function summarizeMonth(transactions: Transaction[], month: string) {
  const monthTransactions = transactions.filter((item) => monthKey(item.date) === month);
  const income = sumAbsolute(monthTransactions.filter((item) => item.type === "income"));
  const refunds = sumAbsolute(monthTransactions.filter((item) => item.type === "refund"));
  const grossExpenses = sumAbsolute(monthTransactions.filter((item) => item.type === "expense"));
  const investmentPurchases = sumAbsolute(monthTransactions.filter((item) => item.type === "investment"));
  const expenses = Math.max(0, grossExpenses - refunds);
  const savings = income + refunds - grossExpenses;
  return {
    income,
    expenses,
    refunds,
    grossExpenses,
    savings,
    cashFlow: savings - investmentPurchases,
    investmentPurchases,
    transactions: monthTransactions
  };
}

function createMonthlySummary(transactions: Transaction[], currency: string, key: string): MonthlySummary {
  const summary = summarizeMonth(transactions.filter((item) => item.currency === currency), key);
  return {
    key,
    month: monthName(key),
    income: summary.income,
    expenses: summary.expenses,
    refunds: summary.refunds,
    investmentPurchases: summary.investmentPurchases,
    savings: summary.savings,
    cashFlow: summary.cashFlow
  };
}

export function getMonthlySummaries(transactions: Transaction[], currency: string, endMonth: string): MonthlySummary[] {
  if (!endMonth) return [];
  return Array.from({ length: 12 }, (_, index) => createMonthlySummary(transactions, currency, addMonths(endMonth, index - 11)));
}

function getFullMonthlySummaries(transactions: Transaction[], currency: string) {
  const dates = transactions.filter((item) => item.currency === currency && item.type !== "transfer").map((item) => monthKey(item.date)).sort();
  if (!dates.length) return [];
  const first = dates[0];
  const last = dates[dates.length - 1];
  const monthCount = (Number(last.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(last.slice(5, 7)) - Number(first.slice(5, 7));
  return Array.from({ length: monthCount + 1 }, (_, index) => createMonthlySummary(transactions, currency, addMonths(first, index)));
}

export function getCategoryTotals(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  for (const item of transactions) {
    if (item.type !== "expense") continue;
    totals.set(item.category, (totals.get(item.category) ?? 0) + Math.abs(item.amount));
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name: name as TransactionCategory, value }))
    .sort((a, b) => b.value - a.value);
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function dayDifference(first: string, second: string) {
  const firstDate = new Date(`${first}T00:00:00Z`).getTime();
  const secondDate = new Date(`${second}T00:00:00Z`).getTime();
  return Math.round((secondDate - firstDate) / 86_400_000);
}

function recurringName(transaction: Transaction) {
  return normalizedText(transaction.merchant || transaction.description);
}

function flowGroups(transactions: Transaction[], type: "income" | "expense", currency: string): RecurringFlow[] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (transaction.type !== type || transaction.currency !== currency) continue;
    const key = `${recurringName(transaction)}|${transaction.category}|${currency}`;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }

  return [...groups.entries()].flatMap(([key, entries]) => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length < 3) return [];
    const gaps = sorted.slice(1).map((item, index) => dayDifference(sorted[index].date, item.date));
    const typicalGap = median(gaps);
    const cadence: RecurringFlow["cadence"] | undefined =
      typicalGap >= 6 && typicalGap <= 10 ? "weekly"
        : typicalGap >= 20 && typicalGap <= 40 ? "monthly"
          : typicalGap >= 75 && typicalGap <= 105 ? "quarterly"
            : undefined;
    if (!cadence) return [];
    const averageAmount = average(sorted.map((item) => Math.abs(item.amount)));
    const monthlyFactor = cadence === "weekly" ? 4.345 : cadence === "quarterly" ? 1 / 3 : 1;
    const consistentGapCount = gaps.filter((gap) => Math.abs(gap - typicalGap) <= typicalGap * 0.35).length;
    const confidence = Math.min(0.98, 0.55 + sorted.length * 0.06 + consistentGapCount / gaps.length * 0.15);
    return [{
      key,
      name: sorted[0].merchant || sorted[0].description,
      category: sorted[0].category,
      type,
      currency,
      occurrenceCount: sorted.length,
      averageAmount,
      monthlyAmount: averageAmount * monthlyFactor,
      cadence,
      confidence,
      transactionIds: sorted.map((item) => item.id)
    }];
  }).sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

export function detectRecurringPayments(transactions: Transaction[], currency: string) {
  return flowGroups(transactions, "expense", currency);
}

export function analyzeTransactions(transactions: Transaction[], currency: string): AccountAnalysis {
  const selected = transactions.filter((item) => item.currency === currency && item.type !== "transfer");
  const monthlySummaries = getFullMonthlySummaries(transactions, currency);
  const totalIncome = monthlySummaries.reduce((sum, item) => sum + item.income, 0);
  const totalExpenses = monthlySummaries.reduce((sum, item) => sum + item.expenses, 0);
  const totalRefunds = monthlySummaries.reduce((sum, item) => sum + item.refunds, 0);
  const totalInvestments = monthlySummaries.reduce((sum, item) => sum + item.investmentPurchases, 0);
  const totalSavings = monthlySummaries.reduce((sum, item) => sum + item.savings, 0);
  const netCashFlow = monthlySummaries.reduce((sum, item) => sum + item.cashFlow, 0);
  const monthCount = monthlySummaries.length;
  const expenditureChanges = monthlySummaries.slice(1).map((item, index) => {
    const previous = monthlySummaries[index].expenses;
    const change = item.expenses - previous;
    return {
      month: item.key,
      previous,
      current: item.expenses,
      change,
      changeRate: previous ? change / previous : null
    };
  });
  const expenses = selected.filter((item) => item.type === "expense").sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return {
    currency,
    periodStart: monthlySummaries[0]?.key ?? "",
    periodEnd: monthlySummaries.at(-1)?.key ?? "",
    monthCount,
    totalIncome,
    totalExpenses,
    totalRefunds,
    totalInvestments,
    netCashFlow,
    monthlySavings: monthCount ? totalSavings / monthCount : 0,
    savingsRate: totalIncome ? totalSavings / totalIncome : 0,
    averageMonthlySpending: monthCount ? totalExpenses / monthCount : 0,
    largestExpenses: expenses.slice(0, 5),
    recurringPayments: detectRecurringPayments(transactions, currency),
    monthlySummaries,
    expenditureChanges
  };
}

export function calculateBudget(monthlyLimit: number, actualSpending: number): BudgetCalculation {
  const limit = Math.max(0, Number.isFinite(monthlyLimit) ? monthlyLimit : 0);
  const actual = Math.max(0, Number.isFinite(actualSpending) ? actualSpending : 0);
  return {
    monthlyLimit: limit,
    actualSpending: actual,
    remaining: limit - actual,
    overspent: Math.max(0, actual - limit),
    progressPercent: limit > 0 ? actual / limit * 100 : null,
    isOverBudget: limit > 0 && actual > limit
  };
}

export function suggestBudgetLimits(transactions: Transaction[], currency: string, lookbackMonths = 3): BudgetSuggestion[] {
  const latest = getLatestMonth(transactions.filter((item) => item.currency === currency && item.type !== "transfer"));
  if (!latest) return [];
  const keys = Array.from({ length: Math.max(1, lookbackMonths) }, (_, index) => addMonths(latest, index - Math.max(1, lookbackMonths) + 1));
  const selected = transactions.filter((item) => item.currency === currency && item.type !== "transfer");
  const availableKeys = keys.filter((key) => selected.some((item) => monthKey(item.date) === key));
  const categories = [...new Set(transactions.filter((item) => item.currency === currency && item.type === "expense").map((item) => item.category))];
  return categories.map((category) => {
    const monthTotals = availableKeys.map((key) => sumAbsolute(transactions.filter((item) => item.currency === currency && item.type === "expense" && item.category === category && monthKey(item.date) === key)));
    const historicalAverage = average(monthTotals);
    const suggestedLimit = Math.ceil(Math.round(historicalAverage * 1.1 * 100) / 1000) * 10;
    const actualSpending = sumAbsolute(transactions.filter((item) => item.currency === currency && item.type === "expense" && item.category === category && monthKey(item.date) === latest));
    return { category, monthlyLimit: suggestedLimit, historicalAverage, monthsUsed: monthTotals.filter((value) => value > 0).length, actualSpending };
  }).sort((a, b) => b.historicalAverage - a.historicalAverage);
}

function countCalendarMonths(keys: string[]) {
  if (!keys.length) return 1;
  const unique = [...new Set(keys)].sort();
  const first = unique[0];
  const last = unique.at(-1) ?? first;
  return Math.max(1, (Number(last.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(last.slice(5, 7)) - Number(first.slice(5, 7)) + 1);
}

function recurringDuplicateOpportunities(transactions: Transaction[], currency: string): SavingsOpportunity[] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    if (transaction.currency !== currency || transaction.type !== "expense") continue;
    const key = recurringName(transaction);
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }
  return [...groups.entries()].flatMap(([key, entries]) => {
    const perMonth = new Map<string, Transaction[]>();
    entries.forEach((entry) => perMonth.set(monthKey(entry.date), [...(perMonth.get(monthKey(entry.date)) ?? []), entry]));
    const duplicateMonths = [...perMonth.entries()].filter(([, monthEntries]) => {
      if (monthEntries.length < 2) return false;
      const amounts = monthEntries.map((item) => Math.abs(item.amount));
      return amounts.some((amount, index) => amounts.slice(index + 1).some((other) => Math.abs(amount - other) / Math.max(amount, other, 1) <= 0.05));
    });
    if (duplicateMonths.length < 2) return [];
    const monthlyAmounts = duplicateMonths.map(([, items]) => {
      const amounts = items.map((item) => Math.abs(item.amount)).sort((a, b) => b - a);
      return amounts.slice(1).reduce((sum, amount) => sum + amount, 0);
    });
    const transactionIds = duplicateMonths.flatMap(([, items]) => items.map((item) => item.id));
    return [{
      id: `duplicate-${key}`,
      title: `Review possible duplicate ${entries[0].merchant || "merchant"} charges`,
      explanation: `Similar charges from ${entries[0].merchant || "the same merchant"} appear more than once in ${duplicateMonths.length} separate months.`,
      category: entries[0].category,
      monthlySavings: average(monthlyAmounts),
      assumption: "Potential savings assume one of the repeated monthly charges is unintended and can be refunded or cancelled.",
      confidence: 0.55,
      transactionIds
    }];
  });
}

export function generateSavingsOpportunities(transactions: Transaction[], currency: string): SavingsOpportunity[] {
  const selected = transactions.filter((item) => item.currency === currency);
  const recurring = detectRecurringPayments(selected, currency);
  const opportunities: SavingsOpportunity[] = recurring
    .filter((flow) => flow.type === "expense" && (flow.category === "Subscriptions" || flow.category === "Insurance" || flow.category === "Utilities"))
    .map((flow) => ({
      id: `review-${flow.key}`,
      title: `Review ${flow.name}`,
      explanation: `${flow.name} appears ${flow.occurrenceCount} times with a typical ${flow.cadence} pattern.`,
      category: flow.category,
      monthlySavings: flow.monthlyAmount * 0.2,
      assumption: "Potential savings assume a 20% lower price after cancelling, downgrading, or renegotiating; action is optional.",
      confidence: flow.confidence,
      transactionIds: flow.transactionIds
    }));

  opportunities.push(...recurringDuplicateOpportunities(selected, currency));

  const latest = getLatestMonth(selected);
  if (latest) {
    const keys = Array.from({ length: 4 }, (_, index) => addMonths(latest, index - 3));
    const restaurantSpend = keys.map((key) => sumAbsolute(selected.filter((item) => item.type === "expense" && item.category === "Restaurants" && monthKey(item.date) === key)));
    const previousAverage = average(restaurantSpend.slice(0, 2));
    const recentAverage = average(restaurantSpend.slice(2));
    const increase = recentAverage - previousAverage;
    if (previousAverage > 0 && increase > Math.max(10, previousAverage * 0.15)) {
      const ids = selected.filter((item) => item.type === "expense" && item.category === "Restaurants" && keys.slice(2).includes(monthKey(item.date))).map((item) => item.id);
      opportunities.push({
        id: "restaurant-spend-increase",
        title: "Restaurant spending has increased",
        explanation: `Average restaurant spending rose from ${previousAverage.toFixed(0)} to ${recentAverage.toFixed(0)} ${currency} per month in the last two observed months.`,
        category: "Restaurants",
        monthlySavings: increase * 0.2,
        assumption: "Potential savings assume reducing the recent increase by 20%; it is not a spending recommendation.",
        confidence: 0.76,
        transactionIds: ids
      });
    }
  }

  const analysis = analyzeTransactions(selected, currency);
  const discretionaryCategories: TransactionCategory[] = ["Restaurants", "Shopping", "Entertainment"];
  const discretionarySpending = sumAbsolute(selected.filter((item) => item.type === "expense" && discretionaryCategories.includes(item.category))) / Math.max(1, analysis.monthCount);
  const averageIncome = analysis.totalIncome / Math.max(1, analysis.monthCount);
  if (averageIncome > 0 && discretionarySpending / averageIncome >= 0.35) {
    opportunities.push({
      id: "discretionary-spending",
      title: "Set a flexible discretionary spending guardrail",
      explanation: `Restaurants, shopping, and entertainment average ${Math.round(discretionarySpending / averageIncome * 100)}% of recorded monthly income.`,
      category: "Shopping",
      monthlySavings: discretionarySpending * 0.1,
      assumption: "Potential savings assume a 10% reduction in discretionary spending while keeping the categories in your budget.",
      confidence: 0.72,
      transactionIds: selected.filter((item) => item.type === "expense" && discretionaryCategories.includes(item.category)).map((item) => item.id)
    });
  }

  if (opportunities.length < 3 && analysis.monthCount >= 2) {
    const category = getCategoryTotals(selected.filter((item) =>
      item.type === "expense" && ["Food", "Restaurants", "Shopping", "Entertainment"].includes(item.category)
    )).find((item) => !opportunities.some((opportunity) => opportunity.category === item.name));
    if (category) {
      const monthlyAverage = category.value / analysis.monthCount;
      opportunities.push({
        id: `optional-review-${category.name.toLowerCase()}`,
        title: `Optional 5% review: ${category.name}`,
        explanation: `${category.name} spending averaged ${monthlyAverage.toFixed(2)} ${currency} per month in the imported period; this is a possible review, not evidence that spending is excessive.`,
        category: category.name,
        monthlySavings: monthlyAverage * 0.05,
        assumption: "Illustrative savings assume 5% of this category's average spending is avoidable and you choose to reduce it.",
        confidence: 0.45,
        transactionIds: selected.filter((item) => item.type === "expense" && item.category === category.name).map((item) => item.id)
      });
    }
  }
  return opportunities.sort((a, b) => b.monthlySavings - a.monthlySavings);
}

export function createSavingsPlan(transactions: Transaction[], currency: string, target?: SavingsTarget): SavingsPlan {
  const analysis = analyzeTransactions(transactions, currency);
  const months = Math.max(1, analysis.monthCount);
  const monthlyIncome = analysis.totalIncome / months;
  const currentMonthlySavings = analysis.monthlySavings;
  const targetMonthlySavings = target?.currency === currency ? target.monthlyAmount : monthlyIncome * 0.2;
  const opportunities = generateSavingsOpportunities(transactions, currency);
  const actions = opportunities.slice(0, 3);
  const uniqueCategoryPotential = new Map<TransactionCategory, number>();
  actions.forEach((item) => uniqueCategoryPotential.set(item.category, Math.max(uniqueCategoryPotential.get(item.category) ?? 0, item.monthlySavings)));
  const estimatedOpportunity = [...uniqueCategoryPotential.values()].reduce((sum, amount) => sum + amount, 0);
  return {
    monthlyIncome,
    currentMonthlySavings,
    targetMonthlySavings,
    targetGap: Math.max(0, targetMonthlySavings - currentMonthlySavings),
    estimatedOpportunity,
    actions
  };
}

function confidenceLabel(confidence: number): FinancialInsight["confidenceLabel"] {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.6) return "Medium";
  return "Low";
}

export function generateFinancialInsights(transactions: Transaction[], currency: string): FinancialInsight[] {
  const selected = transactions.filter((item) => item.currency === currency && item.type !== "transfer");
  if (!selected.length) return [];
  const analysis = analyzeTransactions(selected, currency);
  const insights: FinancialInsight[] = [];
  const savingsRate = analysis.savingsRate;
  insights.push({
    id: "cash-flow",
    title: analysis.netCashFlow >= 0 ? "Recorded cash flow is positive" : "Recorded cash flow is negative",
    explanation: `Across ${analysis.monthCount} calendar month${analysis.monthCount === 1 ? "" : "s"}, eligible inflows and outflows produced ${analysis.netCashFlow.toFixed(2)} ${currency} net cash flow.`,
    evidence: `${analysis.totalIncome.toFixed(2)} income + ${analysis.totalRefunds.toFixed(2)} refunds − ${analysis.totalExpenses.toFixed(2)} expenses − ${analysis.totalInvestments.toFixed(2)} investment purchases.`,
    financialImpact: analysis.netCashFlow,
    impactLabel: "Recorded net cash flow",
    suggestedAction: "Use this as transaction activity only; reconcile it against a confirmed account balance.",
    confidence: 0.94,
    confidenceLabel: "High",
    transactionIds: selected.map((item) => item.id)
  });
  insights.push({
    id: "savings-rate",
    title: savingsRate >= 0.2 ? "Savings are at or above a 20% benchmark" : "There may be room to grow savings",
    explanation: `Recorded savings are ${Math.round(savingsRate * 100)}% of recorded income for the imported period.`,
    evidence: `${analysis.monthlySavings.toFixed(2)} ${currency} average monthly savings / ${((analysis.totalIncome / Math.max(1, analysis.monthCount))).toFixed(2)} ${currency} average monthly income.`,
    financialImpact: analysis.monthlySavings,
    impactLabel: "Average monthly savings",
    suggestedAction: savingsRate >= 0.2 ? "Keep reviewing the plan as new months are imported." : "Choose a monthly target that fits your priorities and available cash.",
    confidence: analysis.monthCount >= 3 ? 0.86 : 0.58,
    confidenceLabel: confidenceLabel(analysis.monthCount >= 3 ? 0.86 : 0.58),
    transactionIds: selected.filter((item) => item.type === "income" || item.type === "expense" || item.type === "refund").map((item) => item.id)
  });
  const categoryTotals = getCategoryTotals(selected);
  const topCategory = categoryTotals[0];
  if (topCategory) {
    insights.push({
      id: "largest-category",
      title: `${topCategory.name} is the largest recorded spending category`,
      explanation: `${topCategory.name} accounts for ${Math.round(topCategory.value / Math.max(analysis.totalExpenses, 1) * 100)}% of classified expense transactions.`,
      evidence: `${topCategory.value.toFixed(2)} ${currency} from ${selected.filter((item) => item.type === "expense" && item.category === topCategory.name).length} transactions.`,
      financialImpact: topCategory.value,
      impactLabel: "Recorded category spend",
      suggestedAction: "Review the transactions in this category and set a limit only if it supports your goals.",
      confidence: 0.82,
      confidenceLabel: "High",
      transactionIds: selected.filter((item) => item.type === "expense" && item.category === topCategory.name).map((item) => item.id)
    });
  }
  const largest = analysis.largestExpenses[0];
  if (largest) {
    insights.push({
      id: "largest-expense",
      title: "Largest individual purchase in the imported history",
      explanation: `${largest.merchant || largest.description} was the largest single consumer outflow found.`,
      evidence: `${largest.date} · ${Math.abs(largest.amount).toFixed(2)} ${currency} · ${largest.category}.`,
      financialImpact: Math.abs(largest.amount),
      impactLabel: "Single expense",
      suggestedAction: "Check that the merchant and category are correct; manually recategorize if needed.",
      confidence: 0.96,
      confidenceLabel: "High",
      transactionIds: [largest.id]
    });
  }
  const latestChange = analysis.expenditureChanges.at(-1);
  if (latestChange) {
    insights.push({
      id: "monthly-change",
      title: latestChange.change > 0 ? "Monthly spending increased" : "Monthly spending decreased",
      explanation: `Recorded expenditure changed ${latestChange.change >= 0 ? "by" : "by"} ${latestChange.change.toFixed(2)} ${currency} in ${monthName(latestChange.month)} compared with the prior month.`,
      evidence: `${latestChange.previous.toFixed(2)} → ${latestChange.current.toFixed(2)} ${currency}${latestChange.changeRate === null ? "" : ` (${Math.round(latestChange.changeRate * 100)}%)`}.`,
      financialImpact: Math.abs(latestChange.change),
      impactLabel: "Month-over-month change",
      suggestedAction: latestChange.change > 0 ? "Review the category breakdown to see whether this is a one-off or a continuing change." : "Confirm that the reduction reflects your intended plan.",
      confidence: analysis.monthCount >= 3 ? 0.79 : 0.55,
      confidenceLabel: confidenceLabel(analysis.monthCount >= 3 ? 0.79 : 0.55),
      transactionIds: selected.filter((item) => monthKey(item.date) === latestChange.month).map((item) => item.id)
    });
  }
  const recurring = analysis.recurringPayments[0];
  if (recurring) {
    insights.push({
      id: "recurring-payment",
      title: `${recurring.name} appears to be a recurring payment`,
      explanation: `There are ${recurring.occurrenceCount} matching payments with an estimated ${recurring.cadence} cadence.`,
      evidence: `Average payment ${recurring.averageAmount.toFixed(2)} ${currency}; estimated monthly amount ${recurring.monthlyAmount.toFixed(2)} ${currency}.`,
      financialImpact: recurring.monthlyAmount,
      impactLabel: "Estimated monthly commitment",
      suggestedAction: "Confirm the schedule and amount with the biller before changing or cancelling it.",
      confidence: recurring.confidence,
      confidenceLabel: confidenceLabel(recurring.confidence),
      transactionIds: recurring.transactionIds
    });
  }
  const templates: Omit<FinancialInsight, "confidenceLabel">[] = [
    {
      id: "history-coverage",
      title: "Imported history spans multiple months",
      explanation: `The analysis covers ${analysis.monthCount} calendar month${analysis.monthCount === 1 ? "" : "s"} and ${selected.length} non-transfer transactions.`,
      evidence: `Coverage: ${analysis.periodStart} through ${analysis.periodEnd}.`,
      financialImpact: 0,
      impactLabel: "No cash impact calculated",
      suggestedAction: analysis.monthCount < 3 ? "Import more history to make trend and recurring-payment findings stronger." : "Keep importing monthly to maintain a current view.",
      confidence: 0.88,
      transactionIds: selected.map((item) => item.id)
    },
    {
      id: "refunds",
      title: "Refunds are kept distinct from earned income",
      explanation: `${analysis.totalRefunds.toFixed(2)} ${currency} in refund or reversal transactions were identified and not counted as salary or ordinary income.`,
      evidence: `${selected.filter((item) => item.type === "refund").length} refund/reversal transaction(s).`,
      financialImpact: analysis.totalRefunds,
      impactLabel: "Refunds recorded",
      suggestedAction: "Check that refunds have matched the intended purchases; review unmatched credits separately.",
      confidence: 0.8,
      transactionIds: selected.filter((item) => item.type === "refund").map((item) => item.id)
    },
    {
      id: "transaction-coverage",
      title: "Analysis is based on imported transactions",
      explanation: `${selected.length} non-transfer records in ${currency} were included; records outside the imported files are not visible.`,
      evidence: `${selected.filter((item) => item.type === "expense").length} expenses, ${selected.filter((item) => item.type === "income").length} incomes, ${selected.filter((item) => item.type === "refund").length} refunds, and ${selected.filter((item) => item.type === "investment").length} investments.`,
      financialImpact: 0,
      impactLabel: "No cash impact calculated",
      suggestedAction: "Import all relevant accounts and date ranges before using the results to make decisions.",
      confidence: 0.99,
      transactionIds: selected.map((item) => item.id)
    }
  ];
  templates.forEach((insight) => insights.push({ ...insight, confidenceLabel: confidenceLabel(insight.confidence) }));
  return insights.slice(0, 8);
}

function recurringFlowIncludesBill(flow: RecurringFlow, billName: string) {
  const bill = normalizedText(billName);
  const name = normalizedText(flow.name);
  return bill.length > 2 && (name.includes(bill) || bill.includes(name));
}

function billsForHorizon(bills: UpcomingBill[], currency: string, startDate: string, endDate: string, recurring: RecurringFlow[]) {
  return bills.filter((bill) =>
    bill.currency === currency &&
    bill.dueDate >= startDate &&
    bill.dueDate <= endDate &&
    !recurring.some((flow) => recurringFlowIncludesBill(flow, bill.name))
  );
}

export function forecastCashFlow(
  transactions: Transaction[],
  bills: UpcomingBill[],
  currency: string,
  asOf = new Date()
): CashFlowForecast {
  const asOfDate = asOf.toISOString().slice(0, 10);
  const selected = transactions.filter((item) => item.currency === currency && item.date <= asOfDate);
  const recurringIncomeFlows = flowGroups(selected, "income", currency);
  const recurringExpenseFlows = flowGroups(selected, "expense", currency);
  const recurringExpenseIds = new Set(recurringExpenseFlows.flatMap((flow) => flow.transactionIds));
  const recentMonths = [...new Set(selected.filter((item) => item.type === "expense").map((item) => monthKey(item.date)))].sort().slice(-3);
  const variableTransactions = selected.filter((item) => item.type === "expense" && !recurringExpenseIds.has(item.id));
  const variableTotals = recentMonths.map((key) =>
    sumAbsolute(variableTransactions.filter((item) => monthKey(item.date) === key))
  );
  const averageVariableExpensesMonthly = average(variableTotals);
  const recurringIncomeMonthly = recurringIncomeFlows.reduce((sum, flow) => sum + flow.monthlyAmount, 0);
  const recurringExpensesMonthly = recurringExpenseFlows.reduce((sum, flow) => sum + flow.monthlyAmount, 0);
  const dateForDays = (days: number) => {
    const date = new Date(asOf);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };
  const makeHorizon = (days: 30 | 90): ForecastHorizon => {
    const factor = days / 30.4375;
    const horizonBills = billsForHorizon(bills, currency, asOfDate, dateForDays(days), recurringExpenseFlows);
    const knownBillTotal = horizonBills.reduce((sum, bill) => sum + bill.amount, 0);
    const projectedIncome = recurringIncomeMonthly * factor;
    const projectedExpenses = (recurringExpensesMonthly + averageVariableExpensesMonthly) * factor + knownBillTotal;
    return {
      days,
      projectedIncome,
      projectedExpenses,
      projectedNetFlow: projectedIncome - projectedExpenses,
      knownBills: knownBillTotal
    };
  };
  const horizons: [ForecastHorizon, ForecastHorizon] = [makeHorizon(30), makeHorizon(90)];
  const assumptions = [
    `Recurring inflows/outflows use the average amount of at least three observed transactions at a weekly, monthly, or quarterly cadence.`,
    `Variable spending uses the average of ${recentMonths.length} latest calendar month(s) with expense history, excluding identified recurring transactions.`,
    `Known bills are added only when their due dates fall inside the projection window and their names do not match an identified recurring payment.`,
    `Projection is net transaction flow in ${currency}; no starting balance, currency conversion, market prices, or future guarantees are assumed.`
  ];
  return {
    currency,
    asOfDate,
    recurringIncomeMonthly,
    recurringExpensesMonthly,
    averageVariableExpensesMonthly,
    recurringIncomeFlows,
    recurringExpenseFlows,
    horizons,
    assumptions,
    confidence: Math.min(0.9, 0.35 + recentMonths.length * 0.08 + Math.min(recurringIncomeFlows.length + recurringExpenseFlows.length, 3) * 0.08)
  };
}

export function calculatePortfolio(investments: Investment[], currency: string): PortfolioAnalysis {
  const selected = investments.filter((investment) => investment.currency === currency);
  const totalInvested = selected.reduce((sum, investment) => sum + investment.quantity * investment.purchasePrice, 0);
  const currentValue = selected.reduce((sum, investment) => sum + investment.quantity * investment.currentPrice, 0);
  const positions = selected.map((investment) => ({
    id: investment.id,
    name: investment.name,
    ticker: investment.ticker,
    value: investment.quantity * investment.currentPrice,
    sharePercent: currentValue ? investment.quantity * investment.currentPrice / currentValue * 100 : 0
  })).sort((a, b) => b.value - a.value);
  return {
    currency,
    totalInvested,
    currentValue,
    unrealizedProfitLoss: currentValue - totalInvested,
    returnPercent: totalInvested ? (currentValue - totalInvested) / totalInvested * 100 : 0,
    allocation: positions
  };
}

export function buildBudgetRecord(category: TransactionCategory, monthlyLimit: number, actualSpending: number, id = category): Budget {
  return { id, category, monthlyLimit: Math.max(0, monthlyLimit), actualSpending: Math.max(0, actualSpending) };
}
