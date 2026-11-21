import type { Budget, Investment, Transaction, UpcomingBill } from "@/lib/models";
import {
  calculate_investment_performance,
  create_budget,
  get_budget_status,
  get_cashflow_forecast,
  get_financial_summary,
  get_investment_portfolio,
  get_monthly_spending,
  get_recurring_payments,
  get_savings_opportunities,
  get_spending_by_category
} from "@/lib/financial-tools";

export const financialToolNames = [
  "get_financial_summary",
  "get_monthly_spending",
  "get_spending_by_category",
  "get_recurring_payments",
  "get_savings_opportunities",
  "create_budget",
  "get_budget_status",
  "get_cashflow_forecast",
  "get_investment_portfolio",
  "calculate_investment_performance"
] as const;

export type FinancialToolName = (typeof financialToolNames)[number];

export interface FinancialAgentContext {
  transactions: Transaction[];
  currency: string;
  budgets: Budget[];
  investments: Investment[];
  bills: UpcomingBill[];
}

export function selectFinancialTool(question: string): FinancialToolName {
  const text = question.toLowerCase();
  if (/investment|portfolio|holding|stock|etf|share/.test(text)) {
    if (/return|performance|profit|loss|gain|how (?:did|has)/.test(text)) return "calculate_investment_performance";
    return "get_investment_portfolio";
  }
  if (/\bcreate\b|\bset up\b|\bmake\b/.test(text) && /budget/.test(text)) return "create_budget";
  if (/budget/.test(text) && /status|over|remaining|left|limit|spent/.test(text)) return "get_budget_status";
  if (/forecast|predict|projection|in \d+ days|next month|enough money|cash ?flow/.test(text)) return "get_cashflow_forecast";
  if (/recurring|subscription|repeat payment|regular payment/.test(text)) return "get_recurring_payments";
  if (/cheap|affordable|low[- ]cost|grocer|food|meal|recipe|brainstorm/.test(text)) return "get_savings_opportunities";
  if (/save|saving|reduce|cut back|optimis|optimize/.test(text)) return "get_savings_opportunities";
  if (/category|categories|where does|where is|most of my|breakdown/.test(text)) return "get_spending_by_category";
  if (/this month|monthly spending|how much (?:did|do) i spend|expenses this month|spent/.test(text)) return "get_monthly_spending";
  return "get_financial_summary";
}

export function executeFinancialTool(name: FinancialToolName, context: FinancialAgentContext) {
  switch (name) {
    case "get_financial_summary":
      return get_financial_summary(context.transactions, context.currency);
    case "get_monthly_spending":
      return get_monthly_spending(context.transactions, context.currency);
    case "get_spending_by_category":
      return get_spending_by_category(context.transactions, context.currency);
    case "get_recurring_payments":
      return get_recurring_payments(context.transactions, context.currency);
    case "get_savings_opportunities":
      return get_savings_opportunities(context.transactions, context.currency);
    case "create_budget":
      return create_budget(context.transactions, context.currency, context.budgets);
    case "get_budget_status":
      return get_budget_status(context.transactions, context.currency, context.budgets);
    case "get_cashflow_forecast":
      return get_cashflow_forecast(context.transactions, context.bills, context.currency);
    case "get_investment_portfolio":
      return get_investment_portfolio(context.investments, context.currency);
    case "calculate_investment_performance":
      return calculate_investment_performance(context.investments, context.currency);
  }
}
