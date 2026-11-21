import {
  analyzeTransactions,
  calculateBudget,
  calculatePortfolio,
  forecastCashFlow,
  generateSavingsOpportunities,
  getCategoryTotals,
  getLatestMonth,
  suggestBudgetLimits,
  summarizeMonth
} from "@/lib/intelligence";
import type { Budget, Investment, Transaction, UpcomingBill } from "@/lib/models";

export function get_financial_summary(transactions: Transaction[], currency: string) {
  const analysis = analyzeTransactions(transactions, currency);
  return {
    currency,
    periodStart: analysis.periodStart,
    periodEnd: analysis.periodEnd,
    monthsAnalyzed: analysis.monthCount,
    income: analysis.totalIncome,
    expenses: analysis.totalExpenses,
    refunds: analysis.totalRefunds,
    investmentPurchases: analysis.totalInvestments,
    monthlySavings: analysis.monthlySavings,
    savingsRate: analysis.savingsRate,
    netCashFlow: analysis.netCashFlow,
    averageMonthlySpending: analysis.averageMonthlySpending,
    confirmedBalance: null as number | null
  };
}

export function get_monthly_spending(transactions: Transaction[], currency: string, month = getLatestMonth(transactions.filter((item) => item.currency === currency))) {
  const summary = summarizeMonth(transactions.filter((item) => item.currency === currency), month);
  return {
    month,
    currency,
    income: summary.income,
    grossExpenses: summary.grossExpenses,
    refunds: summary.refunds,
    netExpenses: summary.expenses,
    savings: summary.savings,
    investmentPurchases: summary.investmentPurchases,
    netCashFlow: summary.cashFlow
  };
}

export function get_spending_by_category(transactions: Transaction[], currency: string, month = getLatestMonth(transactions.filter((item) => item.currency === currency))) {
  const monthTransactions = transactions.filter((item) => item.currency === currency && item.date.startsWith(month));
  return {
    month,
    currency,
    categories: getCategoryTotals(monthTransactions)
  };
}

export function get_recurring_payments(transactions: Transaction[], currency: string) {
  return analyzeTransactions(transactions, currency).recurringPayments;
}

export function get_savings_opportunities(transactions: Transaction[], currency: string) {
  return generateSavingsOpportunities(transactions, currency);
}

export function create_budget(transactions: Transaction[], currency: string, existing: Budget[] = [], asOf = new Date()) {
  const targetMonth = nextMonth(asOf.toISOString().slice(0, 7));
  const suggestions = suggestBudgetLimits(transactions, currency);
  const budgets = suggestions.map((suggestion) => ({
    id: `${currency}:${suggestion.category}`,
    category: suggestion.category,
    monthlyLimit: suggestion.monthlyLimit,
    actualSpending: 0
  }));
  const existingCategories = new Set(existing.filter((item) => item.id.startsWith(`${currency}:`)).map((item) => item.category));
  return {
    currency,
    targetMonth,
    budgets: budgets.filter((budget) => !existingCategories.has(budget.category)),
    updatedBudgets: budgets.filter((budget) => existingCategories.has(budget.category)),
    assumptions: "Suggested limits are 110% of average observed category spending across up to the latest three available months. Existing budgets are returned separately for review."
  };
}

export function get_budget_status(transactions: Transaction[], currency: string, budgets: Budget[]) {
  const month = getLatestMonth(transactions.filter((item) => item.currency === currency));
  return {
    month,
    currency,
    budgets: budgets
      .filter((budget) => budget.id.startsWith(`${currency}:`))
      .map((budget) => {
        const actualSpending = transactions
          .filter((item) => item.currency === currency && item.type === "expense" && item.category === budget.category && item.date.startsWith(month))
          .reduce((sum, item) => sum + Math.abs(item.amount), 0);
        return { category: budget.category, ...calculateBudget(budget.monthlyLimit, actualSpending) };
      })
  };
}

export function get_cashflow_forecast(transactions: Transaction[], bills: UpcomingBill[], currency: string, asOf = new Date()) {
  return forecastCashFlow(transactions, bills, currency, asOf);
}

export function get_investment_portfolio(investments: Investment[], currency: string) {
  return calculatePortfolio(investments, currency);
}

export function calculate_investment_performance(investments: Investment[], currency: string) {
  const portfolio = calculatePortfolio(investments, currency);
  return {
    ...portfolio,
    pricesAreManual: true,
    note: "Performance uses manually entered purchase and current prices; it is not live market data."
  };
}

function nextMonth(month: string) {
  if (!month) return "";
  const [year, value] = month.split("-").map(Number);
  const next = new Date(year, value, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}
