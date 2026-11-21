import { z } from "zod";

export const transactionTypeSchema = z.enum(["income", "expense", "transfer", "refund", "investment"]);
export const transactionCategorySchema = z.enum([
  "Income",
  "Housing",
  "Food",
  "Restaurants",
  "Transport",
  "Healthcare",
  "Insurance",
  "Shopping",
  "Entertainment",
  "Utilities",
  "Subscriptions",
  "Investments",
  "Transfers",
  "Other"
]);
export const transactionCategories = transactionCategorySchema.options;

export const transactionSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string(),
  amount: z.number().finite(),
  originalAmount: z.number().finite(),
  currency: z.string().min(1),
  category: transactionCategorySchema,
  categorySource: z.enum(["rule", "manual"]).optional(),
  type: transactionTypeSchema,
  account: z.string().min(1),
  merchant: z.string(),
  isRecurring: z.boolean(),
  confidence: z.number().min(0).max(1),
  sourceFile: z.string().optional()
});

export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionCategory = z.infer<typeof transactionCategorySchema>;

export interface Investment {
  id: string;
  ticker: string;
  name: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  currency: string;
  purchaseDate: string;
  priceSource?: "manual" | "live";
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimit: number;
  actualSpending: number;
}

export interface CategoryRule {
  id: string;
  keyword: string;
  category: TransactionCategory;
  matchOn: "merchant" | "description" | "both";
  enabled: boolean;
}

export interface UpcomingBill {
  id: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: string;
}

export interface SavingsTarget {
  currency: string;
  monthlyAmount: number;
}

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  debit: string;
  credit: string;
  type: string;
  currency: string;
  account: string;
  merchant: string;
  source: string;
  target: string;
}

export interface ParsedCsvFile {
  id: string;
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  mapping: ColumnMapping;
  parseWarnings: string[];
}
