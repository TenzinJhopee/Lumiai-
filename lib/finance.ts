export {
  analyzeTransactions,
  calculateBudget,
  calculatePortfolio,
  classifyTransaction,
  createSavingsPlan,
  deduplicateTransactions,
  detectRecurringPayments,
  forecastCashFlow,
  generateFinancialInsights,
  generateSavingsOpportunities,
  getCategoryTotals,
  getCurrencies,
  getLatestMonth,
  getMonthlySummaries,
  suggestBudgetLimits,
  summarizeMonth
} from "@/lib/intelligence";
export type {
  AccountAnalysis,
  BudgetCalculation,
  BudgetSuggestion,
  CashFlowForecast,
  FinancialInsight,
  ForecastHorizon,
  MonthlySummary,
  PortfolioAnalysis,
  RecurringFlow,
  SavingsOpportunity,
  SavingsPlan
} from "@/lib/intelligence";
import { detectRecurringPayments } from "@/lib/intelligence";
import type { Transaction } from "@/lib/models";

export function detectRecurring(transactions: Transaction[]) {
  const currencies = [...new Set(transactions.map((item) => item.currency))];
  return currencies.flatMap((currency) => detectRecurringPayments(transactions, currency).map((flow) => ({
    ...flow,
    id: flow.key,
    merchant: flow.name,
    description: flow.name,
    isRecurring: true,
    averageAmount: flow.averageAmount
  }))).slice(0, 4);
}

export function formatMoney(value: number, currency: string, compact = false) {
  return new Intl.NumberFormat("en-CH", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0
  }).format(value);
}

export function monthLabel(key: string) {
  if (!key) return "your latest month";
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
