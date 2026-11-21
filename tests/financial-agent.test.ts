import assert from "node:assert/strict";
import test from "node:test";
import { executeFinancialTool, selectFinancialTool } from "../lib/financial-agent";
import { buildAssistantAnalysisContext } from "../lib/assistant-analysis-context";
import { create_budget, get_monthly_spending, get_spending_by_category } from "../lib/financial-tools";
import { formatMoney } from "../lib/finance";
import { createFinancialVisualization } from "../lib/financial-visualization";
import { microphoneErrorMessage } from "../lib/voice-errors";
import type { Budget, Transaction } from "../lib/models";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "agent-tx",
    date: "2026-10-12",
    description: "Market purchase",
    amount: -80,
    originalAmount: 80,
    currency: "CHF",
    category: "Food",
    type: "expense",
    account: "Main",
    merchant: "Market",
    isRecurring: false,
    confidence: 1,
    ...overrides
  };
}

test("selects a deterministic financial tool for each supported intent", () => {
  assert.equal(selectFinancialTool("How much did I spend this month?"), "get_monthly_spending");
  assert.equal(selectFinancialTool("What are my three biggest spending categories?"), "get_spending_by_category");
  assert.equal(selectFinancialTool("Where does most of my money go?"), "get_spending_by_category");
  assert.equal(selectFinancialTool("How can I save CHF 500 monthly?"), "get_savings_opportunities");
  assert.equal(selectFinancialTool("How much could I save each month?"), "get_savings_opportunities");
  assert.equal(selectFinancialTool("Brainstorm cheap food and budget ideas"), "get_savings_opportunities");
  assert.equal(selectFinancialTool("Can you create a monthly budget based on my actual transactions?"), "create_budget");
  assert.equal(selectFinancialTool("What is my budget status?"), "get_budget_status");
  assert.equal(selectFinancialTool("Forecast my cash flow for the next three months"), "get_cashflow_forecast");
  assert.equal(selectFinancialTool("Will I have enough money in 30 days?"), "get_cashflow_forecast");
  assert.equal(selectFinancialTool("Which recurring payments should I review?"), "get_recurring_payments");
  assert.equal(selectFinancialTool("Explain my investment portfolio"), "get_investment_portfolio");
  assert.equal(selectFinancialTool("What is my investment return?"), "calculate_investment_performance");
  assert.equal(selectFinancialTool("Give me an account summary"), "get_financial_summary");
});

test("financial tools calculate selected-currency spending without mixing currencies", () => {
  const rows = [
    transaction(),
    transaction({ id: "eur", currency: "EUR", amount: -900, originalAmount: 900 }),
    transaction({ id: "refund", type: "refund", category: "Income", amount: 10, originalAmount: 10 })
  ];
  assert.deepEqual(get_monthly_spending(rows, "CHF"), {
    month: "2026-10",
    currency: "CHF",
    income: 0,
    grossExpenses: 80,
    refunds: 10,
    netExpenses: 70,
    savings: -70,
    investmentPurchases: 0,
    netCashFlow: -70
  });
  assert.equal(get_spending_by_category(rows, "CHF").categories[0].value, 80);
});

test("assistant analysis context summarizes saved data and the savings target without raw transaction details", () => {
  const rows = [
    transaction({ id: "private-expense", date: "2026-10-12", merchant: "Private merchant", account: "Private account", amount: -80 }),
    transaction({ id: "private-income", date: "2026-09-01", type: "income", category: "Income", amount: 3000, originalAmount: 3000 }),
    transaction({ id: "other-currency", currency: "EUR", amount: -900, originalAmount: 900 })
  ];
  const context = buildAssistantAnalysisContext({
    transactions: rows,
    currency: "CHF",
    budgets: [{ id: "CHF:Food", category: "Food", monthlyLimit: 200, actualSpending: 0 }],
    investments: [],
    bills: [],
    savingsTarget: { currency: "CHF", monthlyAmount: 500 },
    asOf: new Date("2026-10-31T12:00:00.000Z")
  });
  const serialized = JSON.stringify(context);
  assert.equal(context.importedTransactionCount, 2);
  assert.equal(context.period.monthsAnalyzed, 2);
  assert.equal(context.savingsPlan.targetMonthlySavings, 500);
  assert.deepEqual(context.budgetLimits, [{ category: "Food", monthlyLimit: 200 }]);
  assert.equal(serialized.includes("private-expense"), false);
  assert.equal(serialized.includes("Private merchant"), false);
  assert.equal(serialized.includes("Private account"), false);
  assert.equal(serialized.includes("other-currency"), false);
});

test("category answer visuals use verified totals and group smaller categories", () => {
  const visualization = createFinancialVisualization("get_spending_by_category", {
    month: "2026-10",
    categories: [
      { name: "Housing", value: 1200 },
      { name: "Food", value: 500 },
      { name: "Transport", value: 300 },
      { name: "Shopping", value: 250 },
      { name: "Health", value: 100 },
      { name: "Subscriptions", value: 50 }
    ]
  }, "CHF");
  assert.equal(visualization?.stats[0].value, formatMoney(2400, "CHF"));
  assert.deepEqual(visualization?.chart?.points, [
    { label: "Housing", value: 1200 },
    { label: "Food", value: 500 },
    { label: "Transport", value: 300 },
    { label: "Shopping", value: 250 },
    { label: "Health", value: 100 },
    { label: "Other categories", value: 50 }
  ]);
});

test("forecast answer visuals preserve negative net flow and show forecast periods", () => {
  const visualization = createFinancialVisualization("get_cashflow_forecast", {
    horizons: [
      { days: 30, projectedIncome: 2500, projectedExpenses: 2800, projectedNetFlow: -300, knownBills: 100 },
      { days: 90, projectedIncome: 7500, projectedExpenses: 8200, projectedNetFlow: -700, knownBills: 250 }
    ]
  }, "CHF");
  assert.deepEqual(visualization?.stats.slice(0, 2).map((stat) => stat.label), ["30-day net flow", "90-day net flow"]);
  assert.deepEqual(visualization?.chart?.points, [
    { label: "30 days", income: 2500, expenses: 2800, netFlow: -300 },
    { label: "90 days", income: 7500, expenses: 8200, netFlow: -700 }
  ]);
});

test("create-budget requests return historical suggestions and preserve existing limits", () => {
  const rows = [
    transaction({ id: "one", date: "2026-08-12", amount: -100, originalAmount: 100 }),
    transaction({ id: "two", date: "2026-09-12", amount: -200, originalAmount: 200 }),
    transaction({ id: "three", date: "2026-10-12", amount: -300, originalAmount: 300 })
  ];
  const existing: Budget[] = [{ id: "CHF:Food", category: "Food", monthlyLimit: 250, actualSpending: 0 }];
  const result = create_budget(rows, "CHF", existing, new Date("2026-10-20T00:00:00.000Z"));
  assert.equal(result.targetMonth, "2026-11");
  assert.equal(result.budgets.length, 0);
  assert.equal(result.updatedBudgets[0].monthlyLimit, 220);
});

test("microphone permission denial has a text-only recovery message", () => {
  assert.match(microphoneErrorMessage({ name: "NotAllowedError" }), /permission was denied/i);
  assert.match(microphoneErrorMessage(new Error("unsupported")), /type your question/i);
});
