import { calculatePortfolio, createSavingsPlan, analyzeTransactions, forecastCashFlow, getCategoryTotals } from "@/lib/intelligence";
import type { Budget, Investment, SavingsTarget, Transaction, UpcomingBill } from "@/lib/models";

interface AssistantAnalysisContextInput {
  transactions: Transaction[];
  currency: string;
  budgets: Budget[];
  investments: Investment[];
  bills: UpcomingBill[];
  savingsTarget?: SavingsTarget;
  asOf?: Date;
}

export function buildAssistantAnalysisContext({
  transactions,
  currency,
  budgets,
  investments,
  bills,
  savingsTarget,
  asOf = new Date()
}: AssistantAnalysisContextInput) {
  const selectedTransactions = transactions.filter((item) => item.currency === currency);
  const analysis = analyzeTransactions(selectedTransactions, currency);
  const plan = createSavingsPlan(selectedTransactions, currency, savingsTarget);
  const month = analysis.periodEnd;
  const latestCategories = getCategoryTotals(selectedTransactions.filter((item) =>
    item.date.startsWith(month) && item.type === "expense"
  )).slice(0, 6);
  const forecast = forecastCashFlow(selectedTransactions, bills, currency, asOf);
  const portfolio = calculatePortfolio(investments, currency);

  return {
    currency,
    importedTransactionCount: selectedTransactions.length,
    period: {
      start: analysis.periodStart,
      end: analysis.periodEnd,
      monthsAnalyzed: analysis.monthCount
    },
    averages: {
      monthlyIncome: analysis.totalIncome / Math.max(analysis.monthCount, 1),
      monthlyExpenses: analysis.averageMonthlySpending,
      monthlySavings: analysis.monthlySavings,
      savingsRate: analysis.savingsRate
    },
    recentMonthlyTrend: analysis.monthlySummaries.slice(-6).map((item) => ({
      month: item.key,
      income: item.income,
      expenses: item.expenses,
      netCashFlow: item.cashFlow
    })),
    latestMonthCategories: latestCategories.map(({ name, value }) => ({ category: name, spending: value })),
    recurringPaymentPatterns: analysis.recurringPayments.slice(0, 5).map((item) => ({
      category: item.category,
      monthlyAmount: item.monthlyAmount,
      cadence: item.cadence,
      observations: item.occurrenceCount
    })),
    savingsPlan: {
      monthlyIncome: plan.monthlyIncome,
      currentMonthlySavings: plan.currentMonthlySavings,
      targetMonthlySavings: plan.targetMonthlySavings,
      targetGap: plan.targetGap,
      estimatedOpportunity: plan.estimatedOpportunity,
      actions: plan.actions.map(({ category, monthlySavings, assumption, confidence }) => ({
        category,
        estimatedMonthlySavings: monthlySavings,
        assumption,
        confidence
      }))
    },
    budgetLimits: budgets
      .filter((item) => item.id.startsWith(`${currency}:`))
      .map(({ category, monthlyLimit }) => ({ category, monthlyLimit })),
    cashFlowForecast: {
      recurringIncomeMonthly: forecast.recurringIncomeMonthly,
      recurringExpensesMonthly: forecast.recurringExpensesMonthly,
      averageVariableExpensesMonthly: forecast.averageVariableExpensesMonthly,
      horizons: forecast.horizons
    },
    portfolio: {
      totalInvested: portfolio.totalInvested,
      currentValue: portfolio.currentValue,
      unrealizedProfitLoss: portfolio.unrealizedProfitLoss,
      returnPercent: portfolio.returnPercent
    }
  };
}
