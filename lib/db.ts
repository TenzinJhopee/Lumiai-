import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";
import type { Budget, CategoryRule, Investment, SavingsTarget, Transaction, UpcomingBill } from "@/lib/models";

interface FinanceDatabase extends DBSchema {
  transactions: {
    key: string;
    value: Transaction;
    indexes: { "by-date": string; "by-currency": string };
  };
  budgets: {
    key: string;
    value: Budget;
  };
  investments: {
    key: string;
    value: Investment;
    indexes: { "by-currency": string };
  };
  bills: {
    key: string;
    value: UpcomingBill;
    indexes: { "by-currency": string; "by-due-date": string };
  };
  categoryRules: {
    key: string;
    value: CategoryRule;
  };
  savingsTargets: {
    key: string;
    value: SavingsTarget;
  };
}

let databasePromise: Promise<IDBPDatabase<FinanceDatabase>> | undefined;

function getDatabase() {
  if (!databasePromise) {
    databasePromise = openDB<FinanceDatabase>("luma-finance", 2, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const transactions = database.createObjectStore("transactions", { keyPath: "id" });
          transactions.createIndex("by-date", "date");
          transactions.createIndex("by-currency", "currency");
        }
        if (oldVersion < 2) {
          database.createObjectStore("budgets", { keyPath: "id" });
          const investments = database.createObjectStore("investments", { keyPath: "id" });
          investments.createIndex("by-currency", "currency");
          const bills = database.createObjectStore("bills", { keyPath: "id" });
          bills.createIndex("by-currency", "currency");
          bills.createIndex("by-due-date", "dueDate");
          database.createObjectStore("categoryRules", { keyPath: "id" });
          database.createObjectStore("savingsTargets", { keyPath: "currency" });
        }
      }
    });
  }
  return databasePromise;
}

export async function readTransactions(): Promise<Transaction[]> {
  const db = await getDatabase();
  return db.getAll("transactions");
}

export async function addTransactions(transactions: Transaction[]): Promise<number> {
  const db = await getDatabase();
  const tx = db.transaction("transactions", "readwrite");
  let added = 0;
  for (const transaction of transactions) {
    if (!(await tx.store.get(transaction.id))) {
      await tx.store.add(transaction);
      added += 1;
    }
  }
  await tx.done;
  return added;
}

export async function updateTransaction(transaction: Transaction): Promise<void> {
  const db = await getDatabase();
  await db.put("transactions", transaction);
}

export async function updateTransactions(transactions: Transaction[]): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction("transactions", "readwrite");
  for (const transaction of transactions) await tx.store.put(transaction);
  await tx.done;
}

export async function replaceTransactions(transactions: Transaction[]): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction("transactions", "readwrite");
  await tx.store.clear();
  for (const transaction of transactions) await tx.store.put(transaction);
  await tx.done;
}

export async function readBudgets(): Promise<Budget[]> {
  const db = await getDatabase();
  return db.getAll("budgets");
}

export async function writeBudget(budget: Budget): Promise<void> {
  const db = await getDatabase();
  await db.put("budgets", budget);
}

export async function removeBudget(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("budgets", id);
}

export async function readInvestments(): Promise<Investment[]> {
  const db = await getDatabase();
  return db.getAll("investments");
}

export async function writeInvestment(investment: Investment): Promise<void> {
  const db = await getDatabase();
  await db.put("investments", investment);
}

export async function removeInvestment(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("investments", id);
}

export async function readBills(): Promise<UpcomingBill[]> {
  const db = await getDatabase();
  return db.getAll("bills");
}

export async function writeBill(bill: UpcomingBill): Promise<void> {
  const db = await getDatabase();
  await db.put("bills", bill);
}

export async function removeBill(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("bills", id);
}

export async function readCategoryRules(): Promise<CategoryRule[]> {
  const db = await getDatabase();
  return db.getAll("categoryRules");
}

export async function writeCategoryRule(rule: CategoryRule): Promise<void> {
  const db = await getDatabase();
  await db.put("categoryRules", rule);
}

export async function removeCategoryRule(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete("categoryRules", id);
}

export async function readSavingsTargets(): Promise<SavingsTarget[]> {
  const db = await getDatabase();
  return db.getAll("savingsTargets");
}

export async function writeSavingsTarget(target: SavingsTarget): Promise<void> {
  const db = await getDatabase();
  await db.put("savingsTargets", target);
}

export async function clearTransactions(): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction(["transactions", "budgets", "investments", "bills", "categoryRules", "savingsTargets"], "readwrite");
  await Promise.all([
    tx.objectStore("transactions").clear(),
    tx.objectStore("budgets").clear(),
    tx.objectStore("investments").clear(),
    tx.objectStore("bills").clear(),
    tx.objectStore("categoryRules").clear(),
    tx.objectStore("savingsTargets").clear()
  ]);
  await tx.done;
}
