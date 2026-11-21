# Luma — Your money, in focus

Luma is an independent financial dashboard prototype. It is not affiliated with or endorsed by PostFinance.

## Run locally

```bash
npm install
npm run dev
```

The production build is `npm run build`, followed by `npm start`. Run the deterministic unit and API tests with `npm test`.

## Importing transaction CSVs

Choose one or more CSV files from the onboarding screen or **Import CSV**. Each file has its own column mapping so exports with different headers can be handled independently. Map a date and an amount (or debit/credit) at minimum. If an amount column contains only positive values, map transaction types that explicitly identify direction or use debit/credit columns; unclear direction is not guessed. Each file is limited to 25 MB. If one file cannot be read, successfully parsed files remain available for import and the error is shown.

The importer supports common ISO and day-first dates, decimal commas, signed amounts, debit/credit columns, optional currency and transaction-type columns, duplicate suppression, refund/reversal classification, and internal transfer exclusion. A row with non-zero values in both debit and credit columns is skipped rather than netted. Unrecognized or invalid records are skipped with a row-level count. Currency totals are kept separate; choose a currency to view it.

CSV files are parsed in the browser and persisted in IndexedDB. No bank connection is used. **Available cash balance is intentionally not estimated**: transaction exports without a confirmed balance cannot establish one. Net cash flow is labeled as a calculation, not a balance.

## Financial intelligence

The local analytics engine classifies transactions using merchant/description keywords and optional user rules. Categories can be corrected manually; manual corrections take precedence over automatic rules. Transfers are excluded from income and expenses, refunds stay distinct from earned income, and investment purchases are kept out of consumer spending. Duplicate detection uses the date, direction, amount, currency, description, merchant, and account.

The dashboard and planning sections use imported records to calculate a trailing 12-calendar-month summary, savings rate, category spending, recurring-payment patterns, evidence-backed insights, savings opportunities, suggested budgets, and 30/90-day net-flow projections. Savings suggestions show their assumptions and forecasts show the inputs used; an optional 5% category review is explicitly labeled as hypothetical, not evidence of overspending. Neither recommendations nor forecasts are guarantees or confirmed balances. Currency totals are never converted.

Budgets, savings targets, custom classification rules, known upcoming bills, and manually entered stock/ETF holdings are saved in IndexedDB on this device. The Investments page includes Yahoo Finance search for matching equities, ETFs, and cryptocurrencies, live quotes for selected symbols, and one-year historical rolling-return ranges. Yahoo search returns matches rather than a complete list of every security at once; search by company or ticker to add assets to the watchlist. Yahoo's quote endpoint is unofficial and may be delayed or change. Scenario ranges describe historical observations; they are not predictions or a promise of profit. The tested Swissquote public feed returned FX quotes but not the equity or crypto symbols in this watchlist; a separate licensed Swissquote market-data API requires its public documentation before it can be integrated.

## Conversational agent and voice

The PostFinance Financial Intelligence Agent selects deterministic tools over the transactions, budgets, bills, and holdings loaded from this browser. It calculates account summaries, monthly and category spending, recurring payments, savings opportunities, budgets, forecasts, and investment calculations locally; exact figures are displayed separately from the local model's explanation. A confirmed account balance is not present in transaction exports and is reported as unavailable, not inferred.

The assistant uses only local Ollama via its native `/api/chat` endpoint. Set `OLLAMA_BASE_URL=http://localhost:11434` and `OLLAMA_MODEL=qwen2.5:3b` in `.env.local`; the matching values are provided in [.env.example](./.env.example). The assistant shows whether Ollama is reachable and whether the model is installed. There is no OpenAI-compatible or cloud LLM fallback. With local Ollama enabled, the question, selected calculation, and a compact summary of saved financial analysis are sent to the on-device model; raw transaction rows, CSV contents, account IDs, and chat history are not included. You can turn off Ollama in the assistant settings and use the exact local calculation alone.

Voice is turn-based, not full-duplex. Enable **AI voice** to speak assistant responses automatically, or use **Play response** for individual replies. Set `ELEVENLABS_API_KEY` server-side for ElevenLabs speech generation and Scribe v3 transcription; `ELEVENLABS_VOICE_ID` optionally selects the speech voice. Keep the credential out of client code and source control. Microphone permission and voice services are optional; text chat remains available if voice setup or a request fails. When ElevenLabs TTS is unavailable, supported browsers use their built-in speech engine.

## Demo

The onboarding screen offers an optional **Explore demo data** path. Every synthetic transaction and the dashboard state are marked **DEMO DATA**. Demo transactions are generated locally and are not saved to IndexedDB.

## Prototype boundaries

- Financial calculations and tool selection are deterministic; only the local Ollama model explains those results.
- Voice transcription and speech generation require ElevenLabs credentials. Voice is not real-time or full-duplex.
- Portfolio holdings must be entered manually; valuations use manually supplied prices and are not live market data.
- Forecasts are net cash-flow estimates and do not include a starting balance or guarantee future outcomes.
- The assistant is informational and is not a licensed financial adviser.
