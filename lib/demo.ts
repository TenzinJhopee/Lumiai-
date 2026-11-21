import type { Transaction } from "@/lib/models";

const merchants = [
  ["Rent", "Housing", 1850],
  ["Coop City", "Food", 86],
  ["SBB Mobile", "Transport", 42],
  ["Netflix", "Subscriptions", 19.9],
  ["Café Miro", "Restaurants", 24],
  ["Health insurance", "Insurance", 328],
  ["Digitec Galaxus", "Shopping", 129]
] as const;

export function createDemoTransactions(): Transaction[] {
  const transactions: Transaction[] = [];
  const now = new Date();
  for (let month = 0; month < 12; month += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - 12 + month, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthTransactions: Transaction[] = [{
      id: `demo-salary-${monthKey}`,
      date: `${monthKey}-25`,
      description: "Monthly salary · DEMO DATA",
      amount: 7450 + (month % 3) * 80,
      originalAmount: 7450 + (month % 3) * 80,
      currency: "CHF",
      category: "Income",
      type: "income",
      account: "Demo account",
      merchant: "Demo employer",
      isRecurring: true,
      confidence: 1
    }];
    merchants.forEach(([merchant, category, baseline], index) => {
      const amount = baseline * (0.82 + ((month + index) % 5) * 0.08);
      monthTransactions.push({
        id: `demo-${month}-${index}`,
        date: `${monthKey}-${String(3 + index * 3).padStart(2, "0")}`,
        description: `${merchant} · DEMO DATA`,
        amount: -amount,
        originalAmount: amount,
        currency: "CHF",
        category,
        type: "expense",
        account: "Demo account",
        merchant,
        isRecurring: index === 0 || index === 3 || index === 5,
        confidence: 1
      });
    });
    transactions.push(...monthTransactions);
  }
  return transactions;
}
