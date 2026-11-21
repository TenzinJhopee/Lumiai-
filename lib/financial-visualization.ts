import { formatMoney } from "@/lib/finance";
import type { FinancialToolName } from "@/lib/financial-agent";

export interface FinancialStat {
  label: string;
  value: string;
}

export interface FinancialChartPoint {
  label: string;
  [key: string]: number | string;
}

export interface FinancialChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface FinancialChart {
  type: "bar" | "pie";
  title: string;
  points: FinancialChartPoint[];
  series: FinancialChartSeries[];
  note?: string;
}

export interface FinancialVisualization {
  title: string;
  stats: FinancialStat[];
  chart?: FinancialChart;
  note?: string;
}

export const financialChartColors = ["#a78bfa", "#34d399", "#60a5fa", "#fbbf24", "#fb7185", "#22d3ee"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function moneyStat(label: string, value: unknown, currency: string): FinancialStat | undefined {
  const amount = finiteNumber(value);
  return amount === undefined ? undefined : { label, value: formatMoney(amount, currency) };
}

function percentageStat(label: string, value: unknown): FinancialStat | undefined {
  const rate = finiteNumber(value);
  return rate === undefined ? undefined : { label, value: `${rate.toFixed(1)}%` };
}

function barChart(title: string, points: FinancialChartPoint[], series: FinancialChartSeries[], note?: string): FinancialChart | undefined {
  return points.length && series.length ? { type: "bar", title, points, series, note } : undefined;
}

function pieChart(title: string, points: FinancialChartPoint[], note?: string): FinancialChart | undefined {
  return points.length ? {
    type: "pie",
    title,
    points,
    series: [{ key: "value", label: "Value", color: financialChartColors[0] }],
    note
  } : undefined;
}

function withStats(title: string, stats: (FinancialStat | undefined)[], chart?: FinancialChart, note?: string): FinancialVisualization | undefined {
  const validStats = stats.filter((stat): stat is FinancialStat => stat !== undefined);
  return validStats.length || chart ? { title, stats: validStats, chart, note } : undefined;
}

export function createFinancialVisualization(
  tool: FinancialToolName,
  value: unknown,
  currency: string
): FinancialVisualization | undefined {
  if (tool === "get_recurring_payments" || tool === "get_savings_opportunities") {
    const items = records(value).flatMap((item) => {
      const amount = finiteNumber(tool === "get_recurring_payments" ? item.monthlyAmount : item.monthlySavings);
      const label = typeof (tool === "get_recurring_payments" ? item.name : item.title) === "string"
        ? String(tool === "get_recurring_payments" ? item.name : item.title)
        : "";
      return amount !== undefined && label ? [{ label, value: amount }] : [];
    }).sort((a, b) => b.value - a.value);
    if (!items.length) return undefined;
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const isSavings = tool === "get_savings_opportunities";
    const points = items.slice(0, 5).map((item) => ({ label: item.label, value: item.value }));
    return withStats(
      isSavings ? "Potential savings" : "Recurring payments",
      [
        { label: isSavings ? "Estimated monthly savings" : "Monthly recurring total", value: formatMoney(total, currency) },
        { label: isSavings ? "Ideas" : "Payments", value: String(items.length) }
      ],
      barChart(
        isSavings ? "Estimated monthly savings by idea" : "Estimated monthly amount by payment",
        points,
        [{ key: "value", label: isSavings ? "Estimated savings" : "Monthly amount", color: financialChartColors[0] }],
        items.length > 5 ? "Showing the five largest items." : undefined
      ),
      isSavings ? "Illustrative estimates, not guaranteed savings." : "Based on recurring patterns in imported transactions."
    );
  }

  if (!isRecord(value)) return undefined;

  switch (tool) {
    case "get_financial_summary": {
      const income = finiteNumber(value.income);
      const expenses = finiteNumber(value.expenses);
      const netCashFlow = finiteNumber(value.netCashFlow);
      const points: FinancialChartPoint[] = [{
        label: "Imported period",
        ...(income === undefined ? {} : { income }),
        ...(expenses === undefined ? {} : { expenses }),
        ...(netCashFlow === undefined ? {} : { netCashFlow })
      }];
      return withStats(
        "Financial snapshot",
        [
          moneyStat("Recorded income", income, currency),
          moneyStat("Consumer expenses", expenses, currency),
          moneyStat("Net cash flow", netCashFlow, currency),
          percentageStat("Savings rate", value.savingsRate)
        ],
        barChart("Income, expenses and net cash flow", points, [
          { key: "income", label: "Income", color: financialChartColors[1] },
          { key: "expenses", label: "Expenses", color: "#fb7185" },
          { key: "netCashFlow", label: "Net cash flow", color: financialChartColors[2] }
        ]),
        "Net cash flow is not a confirmed account balance."
      );
    }
    case "get_monthly_spending": {
      const measures = [
        { label: "Income", key: "income", color: financialChartColors[1] },
        { label: "Net expenses", key: "netExpenses", color: "#fb7185" },
        { label: "Net cash flow", key: "netCashFlow", color: financialChartColors[2] }
      ];
      const points = measures.flatMap((measure) => {
        const amount = finiteNumber(value[measure.key]);
        return amount === undefined ? [] : [{ label: measure.label, value: amount }];
      });
      return withStats(
        "Monthly snapshot",
        [
          moneyStat("Income", value.income, currency),
          moneyStat("Net expenses", value.netExpenses, currency),
          moneyStat("Net cash flow", value.netCashFlow, currency)
        ],
        barChart("Income, expenses and net cash flow", points, [{ key: "value", label: "Amount", color: financialChartColors[0] }]),
        typeof value.month === "string" ? `For ${value.month}; transfers are excluded.` : undefined
      );
    }
    case "get_spending_by_category": {
      const categories = records(value.categories).flatMap((item) => {
        const amount = finiteNumber(item.value);
        return amount !== undefined && typeof item.name === "string" ? [{ label: item.name, value: amount }] : [];
      }).sort((a, b) => b.value - a.value);
      if (!categories.length) return undefined;
      const visible = categories.slice(0, 5).map((item) => ({ label: item.label, value: item.value }));
      if (categories.length > 5) {
        visible.push({ label: "Other categories", value: categories.slice(5).reduce((sum, item) => sum + item.value, 0) });
      }
      const total = categories.reduce((sum, item) => sum + item.value, 0);
      return withStats(
        "Spending by category",
        [
          { label: "Total expenses", value: formatMoney(total, currency) },
          { label: "Categories", value: String(categories.length) }
        ],
        pieChart("Expense breakdown", visible),
        typeof value.month === "string" ? `For ${value.month}.` : undefined
      );
    }
    case "create_budget": {
      const budgets = records(value.budgets).flatMap((item) => {
        const limit = finiteNumber(item.monthlyLimit);
        return limit !== undefined && typeof item.category === "string" ? [{ label: item.category, value: limit }] : [];
      }).sort((a, b) => b.value - a.value);
      if (!budgets.length) return undefined;
      const total = budgets.reduce((sum, item) => sum + item.value, 0);
      return withStats(
        "Suggested budgets",
        [
          { label: "Categories", value: String(budgets.length) },
          { label: "Combined monthly limits", value: formatMoney(total, currency) }
        ],
        barChart("Suggested monthly limit by category", budgets.slice(0, 6), [
          { key: "value", label: "Monthly limit", color: financialChartColors[0] }
        ], budgets.length > 6 ? "Showing the six largest suggested limits." : undefined),
        typeof value.targetMonth === "string" ? `Suggested for ${value.targetMonth}.` : undefined
      );
    }
    case "get_budget_status": {
      const budgets = records(value.budgets).flatMap((item) => {
        const actualSpending = finiteNumber(item.actualSpending);
        const monthlyLimit = finiteNumber(item.monthlyLimit);
        return actualSpending !== undefined && monthlyLimit !== undefined && typeof item.category === "string"
          ? [{ label: item.category, actualSpending, monthlyLimit, over: item.isOverBudget === true || actualSpending > monthlyLimit }]
          : [];
      });
      if (!budgets.length) return undefined;
      const overCount = budgets.filter((item) => item.over).length;
      return withStats(
        "Budget status",
        [
          { label: "Categories", value: String(budgets.length) },
          { label: "Over limit", value: String(overCount) }
        ],
        barChart("Actual spending vs. monthly limit", budgets.slice(0, 6).map(({ label, actualSpending, monthlyLimit }) => ({
          label,
          actual: actualSpending,
          limit: monthlyLimit
        })), [
          { key: "actual", label: "Actual", color: financialChartColors[0] },
          { key: "limit", label: "Limit", color: financialChartColors[2] }
        ], budgets.length > 6 ? "Showing the first six categories." : undefined),
        typeof value.month === "string" ? `For ${value.month}.` : undefined
      );
    }
    case "get_cashflow_forecast": {
      const horizons = records(value.horizons).flatMap((item) => {
        const days = finiteNumber(item.days);
        const income = finiteNumber(item.projectedIncome);
        const expenses = finiteNumber(item.projectedExpenses);
        const netFlow = finiteNumber(item.projectedNetFlow);
        return days !== undefined && income !== undefined && expenses !== undefined && netFlow !== undefined
          ? [{ days, income, expenses, netFlow, knownBills: finiteNumber(item.knownBills) }]
          : [];
      });
      if (!horizons.length) return undefined;
      const stats = horizons.flatMap((item) => moneyStat(`${item.days}-day net flow`, item.netFlow, currency) ?? []);
      return withStats(
        "Cash flow forecast",
        [...stats, moneyStat("Known bills · 90 days", horizons.find((item) => item.days === 90)?.knownBills, currency)],
        barChart("Projected cash flow", horizons.map((item) => ({
          label: `${item.days} days`,
          income: item.income,
          expenses: item.expenses,
          netFlow: item.netFlow
        })), [
          { key: "income", label: "Income", color: financialChartColors[1] },
          { key: "expenses", label: "Expenses", color: "#fb7185" },
          { key: "netFlow", label: "Net flow", color: financialChartColors[2] }
        ]),
        "An estimate of net transaction flow, not an account balance or guarantee."
      );
    }
    case "get_investment_portfolio":
    case "calculate_investment_performance": {
      const allocations = records(value.allocation).flatMap((item) => {
        const amount = finiteNumber(item.value);
        return amount !== undefined && amount > 0 && typeof item.name === "string" ? [{ label: item.name, value: amount }] : [];
      }).sort((a, b) => b.value - a.value);
      const visible = allocations.slice(0, 5).map((item) => ({ label: item.label, value: item.value }));
      if (allocations.length > 5) {
        visible.push({ label: "Other holdings", value: allocations.slice(5).reduce((sum, item) => sum + item.value, 0) });
      }
      const returnPercent = finiteNumber(value.returnPercent);
      return withStats(
        "Portfolio snapshot",
        [
          moneyStat("Invested", value.totalInvested, currency),
          moneyStat("Current entered value", value.currentValue, currency),
          moneyStat("Unrealized change", value.unrealizedProfitLoss, currency),
          returnPercent === undefined ? undefined : { label: "Return", value: `${returnPercent.toFixed(2)}%` }
        ],
        pieChart("Current allocation", visible, allocations.length > 5 ? "The five largest holdings are shown; the rest are grouped." : undefined),
        "Uses manually entered prices, not live market data."
      );
    }
  }
}
