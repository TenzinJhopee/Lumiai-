import assert from "node:assert/strict";
import test from "node:test";
import { hasAmbiguousDirection, normalizeRows, parseCsvFile } from "../lib/csv";
import { deduplicateTransactions } from "../lib/intelligence";
import type { ParsedCsvFile } from "../lib/models";

test("parses and merges files with different mappings without guessing amount direction", async () => {
  const firstFile = new File([
    "Date,Description,Amount,Type,Currency,Account\n" +
    "2026-03-01,Employer salary,5000,Income,CHF,Main\n" +
    "2026-03-02,Migros,-65.20,Debit,CHF,Main\n" +
    "2026-03-03,Transfer to savings,2500,Transfer,CHF,Main"
  ], "first.csv", { type: "text/csv" });
  const secondFile = new File([
    "Booking Date,Details,Debit,Credit,Transaction Type,Currency,Account Name\n" +
    "02.03.2026,Migros,65.20,,Debit,CHF,Main\n" +
    "04.03.2026,Refund,,100,Refund,CHF,Main\n" +
    "05.03.2026,Unclear row,50,25,Debit,CHF,Main"
  ], "second.csv", { type: "text/csv" });

  const [first, second] = await Promise.all([parseCsvFile(firstFile), parseCsvFile(secondFile)]);
  assert.equal(first.mapping.date, "Date");
  assert.equal(second.mapping.date, "Booking Date");
  assert.equal(second.mapping.debit, "Debit");
  assert.equal(second.mapping.credit, "Credit");

  const firstRows = normalizeRows(first);
  const secondRows = normalizeRows(second);
  assert.equal(firstRows.errors.length, 0);
  assert.equal(secondRows.errors.length, 1);
  assert.equal(secondRows.transactions.length, 2);
  assert.equal(secondRows.transactions[1].type, "refund");
  assert.equal(secondRows.transactions[1].amount, 100);

  const merged = deduplicateTransactions([...firstRows.transactions, ...secondRows.transactions]);
  assert.equal(merged.duplicates, 1);
  assert.deepEqual(merged.transactions.map((item) => item.type), ["income", "expense", "transfer", "refund"]);
  assert.equal(merged.transactions[1].category, "Food");
});

test("flags positive amount columns when mapped transaction types do not define direction", () => {
  const file: ParsedCsvFile = {
    id: "unclear",
    name: "unclear.csv",
    headers: ["Date", "Amount", "Type"],
    rows: [{ Date: "2026-03-01", Amount: "20", Type: "posted" }],
    mapping: {
      date: "Date",
      description: "",
      amount: "Amount",
      debit: "",
      credit: "",
      type: "Type",
      currency: "",
      account: "",
      merchant: "",
      source: "",
      target: ""
    },
    parseWarnings: []
  };
  assert.equal(hasAmbiguousDirection(file), true);
  assert.equal(hasAmbiguousDirection({
    ...file,
    rows: [{ Date: "2026-03-01", Amount: "20", Type: "Debit" }]
  }), false);
});
