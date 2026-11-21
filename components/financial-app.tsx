"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, AudioLines, Bell, Bot, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, CircleHelp, Clock3, CreditCard, FileUp, HeartPulse, Home,
  Lightbulb, LoaderCircle, LogOut, Menu, MessageCircle, Mic, MoreHorizontal, PieChart, Plus,
  Search, Send, Settings2, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Wallet, X
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, ComposedChart, Legend, Pie, PieChart as RechartsPieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { CsvImporter } from "@/components/csv-importer";
import { FinancialAgent } from "@/components/financial-agent";
import { MarketWatchlist } from "@/components/market-watchlist";
import {
  addTransactions, clearTransactions, readBills, readBudgets, readCategoryRules, readInvestments,
  readSavingsTargets, readTransactions, removeBill, removeBudget, removeCategoryRule,
  removeInvestment, updateTransaction, writeBill, writeBudget, writeCategoryRule, writeInvestment,
  writeSavingsTarget
} from "@/lib/db";
import { createDemoTransactions } from "@/lib/demo";
import { detectRecurring, formatMoney, getCategoryTotals, getCurrencies, getLatestMonth, getMonthlySummaries, monthLabel, summarizeMonth } from "@/lib/finance";
import {
  analyzeTransactions, applyClassificationRules, calculateBudget, calculatePortfolio,
  createSavingsPlan, deduplicateTransactions, forecastCashFlow, generateFinancialInsights, generateSavingsOpportunities,
  suggestBudgetLimits
} from "@/lib/intelligence";
import { transactionCategories } from "@/lib/models";
import type { Budget, CategoryRule, Investment, SavingsTarget, Transaction, TransactionCategory, UpcomingBill } from "@/lib/models";

type Section = "Overview" | "My Accounts" | "Smart Savings" | "Budget Planner" | "Investments" | "Financial Forecast" | "AI Assistant";

const navigation: { name: Section; icon: typeof Home }[] = [
  { name: "Overview", icon: Home },
  { name: "My Accounts", icon: Wallet },
  { name: "Smart Savings", icon: Sparkles },
  { name: "Budget Planner", icon: PieChart },
  { name: "Investments", icon: TrendingUp },
  { name: "Financial Forecast", icon: CalendarDays },
  { name: "AI Assistant", icon: Bot }
];
const chartColors = ["#d92e3a", "#5475ba", "#50a88a", "#e7a544", "#9276c6", "#78a6af", "#ef8190"];

function Logo() {
  return <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-sm shadow-brand/20"><AudioLines size={20} strokeWidth={2.2} /></span><div><p className="text-[17px] font-bold tracking-tight text-ink">luma<span className="text-brand">.</span></p><p className="-mt-0.5 text-[10px] font-medium tracking-wide text-slate-400">MONEY, IN FOCUS</p></div></div>;
}

function CurrencySelect({ currencies, value, onChange }: { currencies: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <span className="relative">
      <select aria-label="Select currency" className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-semibold text-ink outline-none focus:border-brand" onChange={(event) => onChange(event.target.value)} value={value}>
        {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" size={14} />
    </span>
  );
}

function SummaryCard({ title, value, detail, icon: Icon, tone = "slate", badge }: { title: string; value: string; detail: string; icon: typeof Wallet; tone?: "slate" | "red" | "green"; badge?: string }) {
  const tones = { slate: "bg-slate-100 text-slate-600", red: "bg-rose-50 text-brand", green: "bg-emerald-50 text-emerald-700" };
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={17} /></span>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="text-[26px] font-semibold tracking-tight text-ink">{value}</p>
        {badge && <span className="mb-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{badge}</span>}
      </div>
      <p className="mt-1.5 text-xs leading-5 text-slate-400">{detail}</p>
    </div>
  );
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div>{eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-brand">{eyebrow}</p>}<h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>{description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}</div>{action}</div>;
}

function Onboarding({ error, onImported, onDemo }: { error: string; onImported: (items: Transaction[]) => Promise<{ added: number; duplicates: number }>; onDemo: () => void }) {
  return (
    <main className="min-h-screen bg-[#f7f8fa] px-5 py-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between"><Logo /><span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500"><ShieldCheck size={13} className="text-emerald-600" /> Private by design</span></header>
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <section className="mx-auto max-w-2xl pb-12 pt-12 text-center sm:pt-16">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-brand"><Sparkles size={25} /></span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-brand">A clearer view of your finances</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-[42px]">Your money has a story.<br className="hidden sm:block" /> Let&apos;s make it make sense.</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">Bring your transactions together to discover spending patterns, plan with confidence, and find room to save. Your data stays on this device.</p>
        </section>
        <section className="mx-auto max-w-3xl rounded-3xl border border-line bg-white p-5 shadow-[0_18px_70px_rgba(20,34,56,0.07)] sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold text-ink">Start with your transaction history</h2><p className="mt-1 text-sm text-slate-500">Upload one or more account exports in CSV format.</p></div><span className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500 sm:flex"><FileUp size={19} /></span></div>
          <CsvImporter onImport={onImported} />
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-slate-100 pt-5 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1"><ShieldCheck size={13} /> Stored locally in your browser</span><span className="hidden sm:block">·</span><span>Nothing is sent to a bank or server</span><span className="hidden sm:block">·</span><span>CSV files only</span>
          </div>
        </section>
        <div className="mx-auto mt-5 flex max-w-3xl items-center justify-between gap-3 px-1">
          <p className="text-[11px] leading-5 text-slate-400">Independent hackathon prototype. Not affiliated with or endorsed by PostFinance.</p>
          <button className="shrink-0 text-xs font-semibold text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-ink" onClick={onDemo} type="button">Explore demo data</button>
        </div>
        <div className="mx-auto mt-12 grid max-w-3xl gap-3 sm:grid-cols-3">
          {[["Understand", "See where your money goes."], ["Plan", "Build budgets that feel realistic."], ["Look ahead", "Spot patterns before they surprise you."]].map(([title, copy], index) => <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-4" key={title}><span className="text-xs font-bold text-brand">0{index + 1}</span><p className="mt-2 text-sm font-semibold text-ink">{title}</p><p className="mt-1 text-xs text-slate-500">{copy}</p></div>)}
        </div>
      </div>
    </main>
  );
}

function ChartTooltip({ active, payload, label, currency }: { active?: boolean; payload?: { color?: string; name?: string; value?: number }[]; label?: string; currency: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-lg"><p className="mb-2 text-xs font-semibold text-slate-500">{label}</p>{payload.map((item) => <p className="flex items-center gap-2 text-xs leading-5 text-ink" key={item.name}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}: <strong>{formatMoney(item.value ?? 0, currency)}</strong></p>)}</div>;
}

function Insights({ transactions, currency }: { transactions: Transaction[]; currency: string }) {
  return generateFinancialInsights(transactions.filter((item) => item.currency === currency), currency).slice(0, 5);
}

function Dashboard({ transactions, currency, onCurrency, onNavigate, onImport }: { transactions: Transaction[]; currency: string; onCurrency: (value: string) => void; onNavigate: (section: Section) => void; onImport: () => void }) {
  const latestMonth = getLatestMonth(transactions.filter((item) => item.currency === currency));
  const latest = summarizeMonth(transactions.filter((item) => item.currency === currency), latestMonth);
  const summaries = getMonthlySummaries(transactions.filter((item) => item.currency === currency), currency, latestMonth);
  const periodMonths = new Set(summaries.map((item) => item.key));
  const periodCategories = getCategoryTotals(transactions.filter((item) => item.currency === currency && periodMonths.has(item.date.slice(0, 7))));
  const categoryChart: { name: string; value: number }[] = periodCategories.length > 7
    ? [
      ...periodCategories.slice(0, 6),
      { name: "Other categories", value: periodCategories.slice(6).reduce((sum, item) => sum + item.value, 0) }
    ]
    : periodCategories;
  const recent = [...transactions].filter((item) => item.currency === currency && item.type !== "transfer").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const insights = Insights({ transactions, currency });
  const recurring = detectRecurring(transactions.filter((item) => item.currency === currency));
  const savingsRate = latest.income ? latest.savings / latest.income : 0;
  const totalOutflow = summaries.reduce((sum, item) => sum + item.expenses, 0);
  const periodIncome = summaries.reduce((sum, item) => sum + item.income, 0);
  const periodSavings = summaries.reduce((sum, item) => sum + item.savings, 0);
  const periodStart = summaries[0]?.key ?? latestMonth;
  const periodEnd = summaries.at(-1)?.key ?? latestMonth;
  return (
    <>
      <SectionTitle eyebrow="Your financial snapshot" title={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}.`} description={`Here’s your money at a glance for ${monthLabel(latestMonth)}.`} action={<div className="flex items-center gap-2"><CurrencySelect currencies={getCurrencies(transactions)} value={currency} onChange={onCurrency} /><button className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700" onClick={onImport} type="button"><Plus size={16} /> Import CSV</button></div>} />
      {transactions.some((item) => item.description.includes("DEMO DATA")) && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">DEMO DATA · Synthetic transactions are shown for preview only.</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Income" value={formatMoney(latest.income, currency)} detail={monthLabel(latestMonth)} icon={ArrowDownLeft} tone="green" />
        <SummaryCard title="Expenses" value={formatMoney(latest.expenses, currency)} detail="Consumer spending, net of refunds" icon={ArrowUpRight} tone="red" />
        <SummaryCard title="Available cash balance" value="Not available" detail="No confirmed balance in uploaded files" icon={Wallet} />
        <SummaryCard title="Monthly savings" value={formatMoney(latest.savings, currency)} detail="Income less consumer spending · calculated" icon={TrendingUp} tone="green" />
        <SummaryCard title="Savings rate" value={`${Math.round(savingsRate * 100)}%`} detail="Of latest month’s recorded income" icon={HeartPulse} tone="red" badge={savingsRate >= 0.2 ? "On track" : undefined} />
      </div>

      <section aria-label="12-month financial summary" className="mt-4 grid gap-3 rounded-2xl border border-line bg-white p-4 shadow-card sm:grid-cols-3 sm:p-5">
        <div><p className="text-[11px] font-medium text-slate-500">Income · last 12 calendar months</p><p className="mt-1 text-lg font-semibold text-ink">{formatMoney(periodIncome, currency)}</p></div>
        <div><p className="text-[11px] font-medium text-slate-500">Consumer expenses · net of refunds</p><p className="mt-1 text-lg font-semibold text-ink">{formatMoney(totalOutflow, currency)}</p></div>
        <div><p className="text-[11px] font-medium text-slate-500">Calculated savings · {monthLabel(periodStart)}–{monthLabel(periodEnd)}</p><p className="mt-1 text-lg font-semibold text-ink">{formatMoney(periodSavings, currency)}</p></div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-ink">Income vs. expenses</h2><p className="mt-1 text-xs text-slate-500">Monthly activity · {monthLabel(periodStart)}–{monthLabel(periodEnd)}</p></div><span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-500">Last 12 months</span></div>
          <div className="h-[265px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={summaries} margin={{ top: 8, right: 2, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#eef1f4" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#91a0b2", fontSize: 11 }} dy={9} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#91a0b2", fontSize: 10 }} tickFormatter={(value: number) => value === 0 ? "0" : `${Math.round(value / 1000)}k`} />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Legend verticalAlign="top" align="right" iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingBottom: 15 }} />
                <Area type="monotone" dataKey="income" name="Income" stroke="#52a88c" fill="#e2f4ed" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#d92e3a" fill="#fbe8e9" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="mb-3"><h2 className="font-semibold text-ink">Spending by category</h2><p className="mt-1 text-xs text-slate-500">Gross consumer expenses · last 12 months</p></div>
          {periodCategories.length ? <div className="flex h-[262px] items-center gap-0">
            <div className="h-[210px] w-[54%]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart><Pie data={categoryChart} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">{categoryChart.map((entry, index) => <Cell fill={chartColors[index % chartColors.length]} key={entry.name} />)}</Pie><Tooltip formatter={(value) => formatMoney(Number(value), currency)} /></RechartsPieChart>
              </ResponsiveContainer>
            </div>
            <div className="min-w-0 flex-1 space-y-3">{periodCategories.slice(0, 5).map((item, index) => <div className="flex items-center gap-2" key={item.name}><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">{item.name}</span><span className="text-[11px] font-semibold text-ink">{formatMoney(item.value, currency, true)}</span></div>)}</div>
          </div> : <EmptyState text="Category insights appear as transactions are categorized." />}
          <div className="border-t border-slate-100 pt-3 text-xs text-slate-500"><span className="font-semibold text-ink">{formatMoney(totalOutflow, currency)}</span> total recorded outflow in the chart period</div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold text-ink">Cash flow over 12 months</h2><p className="mt-1 text-xs text-slate-500">Monthly net flow; transfers between accounts excluded</p></div><span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"><span className="h-2 w-2 rounded-full bg-brand" /> Net flow</span></div>
        <div className="h-[195px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={summaries} margin={{ top: 12, right: 3, left: -18, bottom: 0 }}><defs><linearGradient id="cashFlowFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#d92e3a" stopOpacity={0.18} /><stop offset="100%" stopColor="#d92e3a" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid stroke="#eef1f4" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#91a0b2", fontSize: 11 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#91a0b2", fontSize: 10 }} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`} /><Tooltip content={<ChartTooltip currency={currency} />} /><Area type="monotone" dataKey="cashFlow" name="Net flow" stroke="#d92e3a" strokeWidth={2.5} fill="url(#cashFlowFill)" /></AreaChart></ResponsiveContainer></div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-ink">Recent transactions</h2><p className="mt-1 text-xs text-slate-500">Latest activity across selected currency</p></div><button className="text-xs font-semibold text-brand hover:text-rose-700" onClick={() => onNavigate("My Accounts")} type="button">View all</button></div>
          {recent.length ? <div className="divide-y divide-slate-100">{recent.map((item) => <TransactionRow currency={currency} item={item} key={item.id} />)}</div> : <EmptyState text="No transactions are available in this currency." />}
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="mb-4 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Sparkles size={16} /></span><div><h2 className="font-semibold text-ink">A few things we noticed</h2><p className="text-[11px] text-slate-400">Based on your uploaded history</p></div></div>
          <div className="space-y-3">{insights.map((item) => <article className="rounded-xl border border-slate-100 p-3" key={item.id}><div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold text-ink">{item.title}</p><span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-slate-500">{item.confidenceLabel} · {Math.round(item.confidence * 100)}%</span></div><p className="mt-1 text-[11px] leading-[1.55] text-slate-500">{item.explanation}</p><p className="mt-1 text-[10px] leading-[1.5] text-slate-400">{item.evidence}</p><p className="mt-1 text-[10px] font-medium text-ink">{item.impactLabel}: {item.impactLabel === "No cash impact calculated" ? "—" : formatMoney(item.financialImpact, currency)}</p><p className="mt-2 text-[10px] font-medium text-ink">{item.suggestedAction}</p></article>)}</div>
          <button className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-rose-700" onClick={() => onNavigate("AI Assistant")} type="button">Ask your money assistant <ArrowRight size={14} /></button>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-ink">Financial health</h2><p className="mt-1 text-xs text-slate-500">A simple read on your latest month</p></div><HeartPulse className="text-brand" size={19} /></div>
          <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4"><div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-[5px] border-slate-200"><span className="text-sm font-bold text-ink">{Math.round(savingsRate * 100)}%</span></div><div><p className="text-sm font-semibold text-ink">{savingsRate >= 0.2 ? "Good savings momentum" : savingsRate > 0 ? "Room to grow your buffer" : "Keep an eye on cash flow"}</p><p className="mt-1 text-xs leading-5 text-slate-500">Savings rate is based on recorded income and eligible spending. It is not a credit or solvency score.</p></div></div>
          <div className="mt-4 flex items-center justify-between text-xs"><span className="text-slate-500">Confirmed account balance</span><span className="font-semibold text-slate-500">Not included in CSV</span></div>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-ink">Upcoming recurring payments</h2><p className="mt-1 text-xs text-slate-500">Possible patterns from repeat transactions</p></div><Clock3 className="text-slate-400" size={18} /></div>
          {recurring.length ? <div className="space-y-1">{recurring.slice(0, 3).map((item) => <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-slate-50" key={item.id}><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><CreditCard size={16} /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{item.merchant || item.description}</p><p className="mt-0.5 text-xs text-slate-400">Observed {item.occurrenceCount} times · estimate</p></div></div><span className="shrink-0 text-sm font-semibold text-ink">{formatMoney(item.averageAmount, currency)}<span className="text-[10px] font-normal text-slate-400"> / avg</span></span></div>)}</div> : <EmptyState text="Repeat payments will appear after at least three matching transactions." />}
        </section>
      </div>
    </>
  );
}

function TransactionRow({ item, currency }: { item: Transaction; currency: string }) {
  const positive = item.type === "income" || item.type === "refund";
  const initials = (item.merchant || item.description).trim().slice(0, 1).toUpperCase();
  return <div className="flex items-center gap-3 py-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${positive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{initials}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{item.merchant || item.description}</p><p className="mt-0.5 text-xs text-slate-400">{new Date(`${item.date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {item.category}</p></div><span className={`text-sm font-semibold ${positive ? "text-emerald-700" : "text-ink"}`}>{positive ? "+" : "−"}{formatMoney(Math.abs(item.amount), currency)}</span></div>;
}

function InsightCard({ icon: Icon, title, copy, tone }: { icon: typeof Lightbulb; title: string; copy: string; tone: string }) {
  const tones: Record<string, string> = { green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700", blue: "bg-blue-50 text-blue-700", violet: "bg-violet-50 text-violet-700" };
  return <div className="flex gap-3 rounded-xl border border-slate-100 p-3"><span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tones[tone] ?? tones.blue}`}><Icon size={14} /></span><div><p className="text-xs font-semibold text-ink">{title}</p><p className="mt-1 text-[11px] leading-[1.55] text-slate-500">{copy}</p></div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="flex min-h-[130px] items-center justify-center rounded-xl bg-slate-50 px-5 text-center text-xs leading-5 text-slate-400">{text}</div>;
}

interface SpeechResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognizer {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type SpeechRecognizerConstructor = new () => SpeechRecognizer;

function LegacyAccountsPage({ transactions, currency, onCurrency, onImport }: { transactions: Transaction[]; currency: string; onCurrency: (value: string) => void; onImport: () => void }) {
  const accounts = useMemo(() => [...new Set(transactions.filter((item) => item.currency === currency).map((item) => item.account))], [transactions, currency]);
  return <><SectionTitle eyebrow="Connected activity" title="My accounts" description="A unified view of the transactions you have imported." action={<div className="flex gap-2"><CurrencySelect currencies={getCurrencies(transactions)} value={currency} onChange={onCurrency} /><button className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2.5 text-sm font-semibold text-white" onClick={onImport} type="button"><Plus size={16} /> Import CSV</button></div>} /><div className="grid gap-4 md:grid-cols-2">{accounts.map((account) => {const rows = transactions.filter((item) => item.account === account && item.currency === currency); const count = rows.length;   const netFlow = rows.filter((item) => item.type === "income" || item.type === "expense" || item.type === "refund" || item.type === "investment").reduce((sum, item) => sum + (item.type === "expense" || item.type === "investment" ? -Math.abs(item.amount) : Math.abs(item.amount)), 0); return <div className="rounded-2xl border border-line bg-white p-6 shadow-card" key={account}><div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-brand"><Wallet size={19} /></span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Activity imported</span></div><h2 className="mt-5 text-lg font-semibold text-ink">{account}</h2><p className="mt-1 text-sm text-slate-500">{count} transactions · {currency}</p><div className="mt-5 flex justify-between border-t border-slate-100 pt-4 text-xs"><span className="text-slate-500">Recorded net flow</span><span className="font-semibold text-ink">{formatMoney(netFlow, currency)}</span></div><p className="mt-3 text-[11px] leading-5 text-slate-400">Calculated from imported activity only; not a current or confirmed account balance.</p></div>;})}</div><div className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="mb-3 font-semibold text-ink">Latest account activity</h2>{transactions.filter((item) => item.currency === currency).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map((item) => <TransactionRow currency={currency} item={item} key={item.id} />)}</div></>;
}

function LegacySavingsPage({ transactions, currency }: { transactions: Transaction[]; currency: string }) {
  const latestMonth = getLatestMonth(transactions.filter((item) => item.currency === currency));
  const categories = getCategoryTotals(transactions.filter((item) => item.currency === currency && item.date.slice(0, 4) === latestMonth.slice(0, 4)));
  const recurring = detectRecurring(transactions.filter((item) => item.currency === currency));
  const top = categories[0];
  const monthlyAverage = top ? top.value / Math.max(1, new Set(transactions.filter((item) => item.currency === currency).map((item) => item.date.slice(0, 7))).size) : 0;
  return <><SectionTitle eyebrow="Small changes, real momentum" title="Smart savings" description="Practical ideas from your actual transaction history. No promises, just patterns." /><div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-brand/10 bg-gradient-to-br from-rose-50 to-white p-6 md:col-span-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand shadow-sm"><Sparkles size={18} /></span><p className="mt-5 text-xs font-bold uppercase tracking-widest text-brand">A place to start</p><h2 className="mt-2 max-w-lg text-xl font-semibold text-ink">{top ? `Review your ${top.name.toLowerCase()} spending` : "Import more transactions to find your savings opportunities"}</h2><p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{top ? `${top.name} is your largest spending category at ${formatMoney(top.value, currency)} in ${latestMonth.slice(0, 4)}. Even a modest 5% reduction would free up about ${formatMoney(top.value * 0.05, currency)} over that period, if it fits your needs.` : "Your finances stay private on this device. Once activity is imported, we will highlight spending patterns and possible recurring costs."}</p></div><div className="rounded-2xl border border-line bg-white p-6 shadow-card"><p className="text-xs font-medium text-slate-500">Possible recurring payments</p><p className="mt-3 text-3xl font-semibold text-ink">{recurring.length}</p><p className="mt-1 text-xs leading-5 text-slate-400">Patterns from repeated transactions; confirm these yourself before acting.</p></div></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="rounded-2xl border border-line bg-white p-6 shadow-card"><h2 className="font-semibold text-ink">Spending opportunities</h2><p className="mt-1 text-xs text-slate-500">Illustrative savings only; based on recorded spending</p>{categories.slice(0, 5).map((item, index) => <div className="mt-5" key={item.name}><div className="mb-2 flex justify-between text-xs"><span className="font-medium text-ink">{item.name}</span><span className="text-slate-500">{formatMoney(item.value, currency)} · 5% = {formatMoney(item.value * 0.05, currency)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${Math.max(4, 100 - index * 16)}%`, backgroundColor: chartColors[index] }} /></div></div>)}</section><section className="rounded-2xl border border-line bg-white p-6 shadow-card"><h2 className="font-semibold text-ink">Repeat payments to review</h2><p className="mt-1 text-xs text-slate-500">Automatically spotted after three similar expenses</p>{recurring.length ? recurring.map((item) => <div className="mt-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4 last:border-0" key={item.id}><div><p className="text-sm font-medium text-ink">{item.merchant || item.description}</p><p className="mt-1 text-xs text-slate-400">{item.occurrenceCount} times in imported history</p></div><p className="text-sm font-semibold text-ink">{formatMoney(item.averageAmount, currency)}</p></div>) : <div className="mt-4"><EmptyState text="No repeat-payment patterns yet. These are suggestions, not payment predictions." /></div>}</section></div></>;
}

function LegacyBudgetPage({ transactions, currency, budgets, onSaveBudget }: { transactions: Transaction[]; currency: string; budgets: Budget[]; onSaveBudget: (budget: Budget) => void }) {
  const latestMonth = getLatestMonth(transactions.filter((item) => item.currency === currency));
  const categories = getCategoryTotals(transactions.filter((item) => item.currency === currency && item.date.startsWith(latestMonth)));
  return <><SectionTitle eyebrow="Plan with intention" title="Budget planner" description={`Set your own monthly limits. Actuals reflect ${monthLabel(latestMonth)}.`} /><div className="mb-5 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-blue-800"><Settings2 className="mt-0.5 shrink-0" size={16} /><p>Budget limits are your own planning targets. No limits are assumed; add the amounts that make sense for you.</p></div><section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6"><div className="grid grid-cols-[1fr_110px_100px] gap-3 border-b border-slate-100 pb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:grid-cols-[1fr_150px_150px]"><span>Category</span><span>Actual</span><span>Monthly limit</span></div>{categories.length ? categories.map((item) => {const budget = budgets.find((entry) => entry.category === item.name); const limit = budget?.monthlyLimit ?? 0; const progress = limit ? Math.min(100, item.value / limit * 100) : 0; return <div className="border-b border-slate-100 py-4 last:border-0" key={item.name}><div className="grid grid-cols-[1fr_110px_100px] items-center gap-3 sm:grid-cols-[1fr_150px_150px]"><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{item.name}</p><div className="mt-2 h-1.5 max-w-[240px] overflow-hidden rounded-full bg-slate-100">{limit > 0 && <div className={`h-full rounded-full ${progress >= 100 ? "bg-brand" : "bg-emerald-500"}`} style={{ width: `${progress}%` }} />}</div></div><span className="text-sm text-slate-600">{formatMoney(item.value, currency)}</span><input aria-label={`${item.name} monthly budget`} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-ink outline-none focus:border-brand" min="0" onChange={(event) => onSaveBudget({ id: item.name, category: item.name, monthlyLimit: Number(event.target.value), actualSpending: item.value })} placeholder="Set limit" type="number" value={budget?.monthlyLimit || ""} /></div>{limit > 0 && <p className={`mt-2 pl-1 text-[11px] ${item.value > limit ? "text-brand" : "text-emerald-700"}`}>{item.value > limit ? `${formatMoney(item.value - limit, currency)} over limit` : `${formatMoney(limit - item.value, currency)} remaining`}</p>}</div>;}) : <div className="py-8"><EmptyState text="There is no spending in this month to plan against." /></div>}</section></>;
}

function LegacyInvestmentsPage({ transactions, currency }: { transactions: Transaction[]; currency: string }) {
  const investmentRows = transactions.filter((item) => item.currency === currency && item.type === "investment");
  const holdings: Investment[] = [];
  return <><SectionTitle eyebrow="Long-term picture" title="Investments" description="A thoughtful overview of what has been imported, without guessing at market values." /><div className="grid gap-4 md:grid-cols-3"><SummaryCard title="Imported investment activity" value={String(investmentRows.length)} detail="Transactions explicitly identified as investments" icon={TrendingUp} /><SummaryCard title="Portfolio value" value="Not available" detail="No holdings or live market prices imported" icon={BriefcaseBusiness} /><SummaryCard title="Investment return" value="Not calculated" detail="Purchase lots and current valuations are needed" icon={ArrowUpRight} /></div><div className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-card"><h2 className="font-semibold text-ink">Your holdings</h2><p className="mt-1 text-xs text-slate-500">Holdings model is ready; there is no holdings CSV importer yet.</p>{holdings.length ? null : <div className="mt-5"><EmptyState text="Investment holdings need a dedicated CSV with ticker, quantity, purchase price, and purchase date. We won’t infer a portfolio value from transaction history." /></div>}{investmentRows.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4"><p className="mb-2 text-sm font-medium text-ink">Identified investment activity</p>{investmentRows.slice(0, 8).map((item) => <TransactionRow currency={currency} item={item} key={item.id} />)}</div>}</div></>;
}

function LegacyForecastPage({ transactions, currency }: { transactions: Transaction[]; currency: string }) {
  const latestMonth = getLatestMonth(transactions.filter((item) => item.currency === currency));
  const months = getMonthlySummaries(transactions.filter((item) => item.currency === currency), currency, latestMonth).filter((item) => item.income || item.expenses);
  const lastThree = months.slice(-3);
  const average = lastThree.length ? lastThree.reduce((sum, item) => sum + item.cashFlow, 0) / lastThree.length : 0;
  const consistency = lastThree.length >= 3 && lastThree.every((item) => item.cashFlow >= 0);
  return <><SectionTitle eyebrow="A simple look ahead" title="Financial forecast" description="A transparent estimate from your latest activity, not a promise or a bank forecast." /><div className="grid gap-4 md:grid-cols-3"><SummaryCard title="Average monthly net flow" value={formatMoney(average, currency)} detail={`Based on ${lastThree.length} latest month${lastThree.length === 1 ? "" : "s"}`} icon={TrendingUp} tone={average >= 0 ? "green" : "red"} /><SummaryCard title="Next 3 months · estimate" value={formatMoney(average * 3, currency)} detail="Assumes recent monthly net flow continues" icon={CalendarDays} /><SummaryCard title="Recorded balance" value="Not available" detail="A forecast cannot establish available cash" icon={Wallet} /></div><section className="mt-5 rounded-2xl border border-line bg-white p-6 shadow-card"><h2 className="font-semibold text-ink">Recent net flow and simple estimate</h2><p className="mt-1 text-xs text-slate-500">Recorded values are historical; dotted values are a straight-line estimate.</p><div className="mt-5 h-[290px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={[...lastThree.map((item) => ({ month: item.month, net: item.cashFlow })), ...Array.from({ length: 3 }, (_, index) => ({ month: `+${index + 1} mo`, estimate: average }))]} margin={{ top: 12, right: 8, left: -15, bottom: 0 }}><CartesianGrid stroke="#eef1f4" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#91a0b2", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#91a0b2", fontSize: 10 }} /><Tooltip content={<ChartTooltip currency={currency} />} /><Area type="monotone" dataKey="net" name="Recorded net flow" stroke="#5475ba" fill="#e9effb" strokeWidth={2} connectNulls /><Area type="monotone" dataKey="estimate" name="Simple estimate" stroke="#d92e3a" strokeDasharray="5 5" fill="#fbe8e9" strokeWidth={2} connectNulls /></ComposedChart></ResponsiveContainer></div><div className={`mt-4 rounded-xl p-4 text-xs leading-5 ${consistency ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{consistency ? "All three latest months show positive net flow. Future results may differ; unexpected expenses and missing records are not included." : "This estimate has limited history or inconsistent monthly results. Treat it as a rough illustration, not a prediction."}</div></section></>;
}

function AccountsPage({ transactions, currency, onCurrency, onImport, onCategoryChange, rules, onSaveRule, onDeleteRule }: {
  transactions: Transaction[];
  currency: string;
  onCurrency: (value: string) => void;
  onImport: () => void;
  onCategoryChange: (transaction: Transaction, category: TransactionCategory) => void;
  rules: CategoryRule[];
  onSaveRule: (rule: CategoryRule) => void;
  onDeleteRule: (id: string) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<TransactionCategory>("Other");
  const [matchOn, setMatchOn] = useState<CategoryRule["matchOn"]>("both");
  const accountAnalysis = analyzeTransactions(transactions, currency);
  const accounts = [...new Set(transactions.filter((item) => item.currency === currency).map((item) => item.account))];
  const recent = transactions.filter((item) => item.currency === currency).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  function addRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = keyword.trim();
    if (!value) return;
    onSaveRule({ id: crypto.randomUUID(), keyword: value, category, matchOn, enabled: true });
    setKeyword("");
  }
  return <>
    <SectionTitle eyebrow="Connected activity" title="My accounts" description="A unified view of imported transactions. Category corrections are saved locally." action={<div className="flex gap-2"><CurrencySelect currencies={getCurrencies(transactions)} value={currency} onChange={onCurrency} /><button className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2.5 text-sm font-semibold text-white" onClick={onImport} type="button"><Plus size={16} /> Import CSV</button></div>} />
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard title="Total income" value={formatMoney(accountAnalysis.totalIncome, currency)} detail={`${accountAnalysis.monthCount} observed months`} icon={ArrowDownLeft} tone="green" />
      <SummaryCard title="Net expenses" value={formatMoney(accountAnalysis.totalExpenses, currency)} detail="After recorded refunds; transfers excluded" icon={ArrowUpRight} tone="red" />
      <SummaryCard title="Net cash flow" value={formatMoney(accountAnalysis.netCashFlow, currency)} detail="Calculated from imported transaction activity" icon={ArrowLeftRight} />
      <SummaryCard title="Average monthly spending" value={formatMoney(accountAnalysis.averageMonthlySpending, currency)} detail="Observed calendar months" icon={TrendingDown} />
    </div>
    <div className="mb-5 grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="font-semibold text-ink">Largest recorded expenses</h2>{accountAnalysis.largestExpenses.length ? accountAnalysis.largestExpenses.map((item) => <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0" key={item.id}><div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{item.merchant || item.description}</p><p className="mt-1 text-[11px] text-slate-400">{item.date} · {item.category}</p></div><span className="text-sm font-semibold text-ink">{formatMoney(Math.abs(item.amount), currency)}</span></div>) : <div className="mt-3"><EmptyState text="No eligible expenses recorded." /></div>}</section>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="font-semibold text-ink">Monthly expenditure changes</h2>{accountAnalysis.expenditureChanges.slice(-6).map((item) => <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0" key={item.month}><span className="text-sm text-slate-600">{monthLabel(item.month)}</span><span className={`text-sm font-semibold ${item.change > 0 ? "text-brand" : "text-emerald-700"}`}>{item.change > 0 ? "+" : ""}{formatMoney(item.change, currency)}{item.changeRate === null ? "" : ` (${Math.round(item.changeRate * 100)}%)`}</span></div>)}{accountAnalysis.expenditureChanges.length === 0 && <div className="mt-3"><EmptyState text="Import more than one month to compare expenditure." /></div>}</section>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <div className="mb-3"><h2 className="font-semibold text-ink">Recent transactions</h2><p className="mt-1 text-xs text-slate-500">Choose a category to correct it; manual categories are protected from automatic rules.</p></div>
        <div className="divide-y divide-slate-100">{recent.map((item) => <div className="grid grid-cols-[1fr_125px] items-center gap-3 py-3 sm:grid-cols-[1fr_150px_110px]" key={item.id}>
          <div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{item.merchant || item.description}</p><p className="mt-1 truncate text-[11px] text-slate-400">{item.date} · {item.account}</p></div>
          <select aria-label={`Category for ${item.merchant || item.description}`} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-ink" onChange={(event) => onCategoryChange(item, event.target.value as TransactionCategory)} value={item.category}>{transactionCategories.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          <span className={`hidden text-right text-xs font-semibold sm:block ${item.type === "income" || item.type === "refund" ? "text-emerald-700" : "text-ink"}`}>{formatMoney(item.amount, currency)}</span>
        </div>)}</div>
        {recent.length === 0 && <EmptyState text="No transactions in this currency." />}
      </section>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
        <h2 className="font-semibold text-ink">Custom classification rules</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Enabled rules categorize matching merchants or descriptions. Manual corrections always take precedence.</p>
        <form className="mt-4 space-y-3" onSubmit={addRule}>
          <input aria-label="Rule keyword" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand" onChange={(event) => setKeyword(event.target.value)} placeholder="Keyword, e.g. local café" value={keyword} />
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Rule category" className="min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-xs" onChange={(event) => setCategory(event.target.value as TransactionCategory)} value={category}>{transactionCategories.map((item) => <option key={item}>{item}</option>)}</select>
            <select aria-label="Rule match field" className="min-w-0 rounded-lg border border-slate-200 px-2 py-2 text-xs" onChange={(event) => setMatchOn(event.target.value as CategoryRule["matchOn"])} value={matchOn}><option value="both">Merchant + description</option><option value="merchant">Merchant</option><option value="description">Description</option></select>
          </div>
          <button className="w-full rounded-lg bg-ink px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-700" type="submit">Add classification rule</button>
        </form>
        <div className="mt-4 divide-y divide-slate-100">{rules.map((rule) => <div className="flex items-center gap-2 py-3" key={rule.id}><label className="flex min-w-0 flex-1 items-center gap-2 text-xs"><input checked={rule.enabled} onChange={() => onSaveRule({ ...rule, enabled: !rule.enabled })} type="checkbox" /><span className="truncate"><strong>{rule.keyword}</strong> → {rule.category}</span></label><button aria-label={`Delete ${rule.keyword} rule`} className="text-xs text-slate-400 hover:text-brand" onClick={() => onDeleteRule(rule.id)} type="button"><X size={15} /></button></div>)}</div>
        {rules.length === 0 && <p className="mt-3 text-xs text-slate-400">No custom rules yet.</p>}
      </section>
    </div>
    <div className="mt-5 grid gap-5 md:grid-cols-2">
      {accounts.map((account) => <div className="rounded-2xl border border-line bg-white p-5 shadow-card" key={account}><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-brand"><Wallet size={18} /></span><div><h2 className="font-semibold text-ink">{account}</h2><p className="text-xs text-slate-500">{transactions.filter((item) => item.account === account && item.currency === currency).length} transactions · {currency}</p></div></div><p className="mt-4 text-[11px] leading-5 text-slate-400">Activity only; not a current or confirmed account balance.</p></div>)}
    </div>
  </>;
}

function SavingsPage({ transactions, currency, target, onSaveTarget }: { transactions: Transaction[]; currency: string; target?: SavingsTarget; onSaveTarget: (target: SavingsTarget) => void }) {
  const plan = createSavingsPlan(transactions, currency, target);
  const opportunities = generateSavingsOpportunities(transactions, currency);
  const recurring = analyzeTransactions(transactions, currency).recurringPayments;
  const [targetValue, setTargetValue] = useState(String(target?.currency === currency ? target.monthlyAmount : plan.targetMonthlySavings || ""));
  return <>
    <SectionTitle eyebrow="Small changes, real momentum" title="Smart savings" description="Evidence-based opportunities from your history. Estimates use explicit assumptions and are not guarantees." />
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-brand/10 bg-gradient-to-br from-rose-50 to-white p-6 md:col-span-2"><p className="text-xs font-bold uppercase tracking-widest text-brand">Personal savings plan</p><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Monthly income</p><p className="mt-1 text-lg font-semibold text-ink">{formatMoney(plan.monthlyIncome, currency)}</p></div><div><p className="text-xs text-slate-500">Current monthly savings</p><p className="mt-1 text-lg font-semibold text-ink">{formatMoney(plan.currentMonthlySavings, currency)}</p></div><div><p className="text-xs text-slate-500">Potential from listed actions</p><p className="mt-1 text-lg font-semibold text-emerald-700">{formatMoney(plan.estimatedOpportunity, currency)} / mo</p></div></div><form className="mt-5 flex flex-wrap items-end gap-2" onSubmit={(event) => {event.preventDefault();onSaveTarget({ currency, monthlyAmount: Math.max(0, Number(targetValue) || 0) });}}><label className="text-xs font-medium text-slate-600">Monthly savings target<input aria-label="Monthly savings target" className="mt-1 block w-44 rounded-lg border border-slate-200 px-3 py-2 text-sm" min="0" onChange={(event) => setTargetValue(event.target.value)} type="number" value={targetValue} /></label><button className="rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white" type="submit">Save target</button><span className="text-xs text-slate-500">{formatMoney(plan.targetGap, currency)} gap to target</span></form></div>
      <div className="rounded-2xl border border-line bg-white p-6 shadow-card"><p className="text-xs font-medium text-slate-500">Recurring patterns detected</p><p className="mt-3 text-3xl font-semibold text-ink">{recurring.length}</p><p className="mt-1 text-xs leading-5 text-slate-400">At least three similar dated transactions; confirm before acting.</p></div>
    </div>
    <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6"><h2 className="font-semibold text-ink">Savings opportunities</h2><p className="mt-1 text-xs text-slate-500">Estimated monthly amounts are illustrative, not promised savings.</p>
      {opportunities.length ? <div className="mt-3 divide-y divide-slate-100">{opportunities.slice(0, 3).map((item) => <article className="py-4" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div className="max-w-3xl"><h3 className="text-sm font-semibold text-ink">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{item.explanation}</p><p className="mt-2 text-[11px] leading-5 text-slate-400">Assumption: {item.assumption}</p><p className="mt-1 text-[10px] text-slate-400">Confidence: {Math.round(item.confidence * 100)}% · {item.transactionIds.length} supporting transaction(s)</p></div><span className="whitespace-nowrap rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">~{formatMoney(item.monthlySavings, currency)} / mo</span></div></article>)}</div> : <div className="mt-4"><EmptyState text="No specific savings opportunities meet the current evidence thresholds. Import more history or review your budget." /></div>}
    </section>
    <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="font-semibold text-ink">Recurring payments</h2>{recurring.length ? recurring.map((item) => <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0" key={item.key}><div><p className="text-sm font-medium text-ink">{item.name}</p><p className="mt-1 text-xs text-slate-400">{item.occurrenceCount} matches · {item.cadence} pattern · {Math.round(item.confidence * 100)}% confidence</p></div><p className="text-sm font-semibold text-ink">{formatMoney(item.monthlyAmount, currency)} / mo</p></div>) : <div className="mt-3"><EmptyState text="No recurring payment pattern is supported by at least three transactions." /></div>}</section>
  </>;
}

function BudgetPage({ transactions, currency, budgets, onSaveBudget, target, onSaveTarget }: { transactions: Transaction[]; currency: string; budgets: Budget[]; onSaveBudget: (budget: Budget) => void; target?: SavingsTarget; onSaveTarget: (target: SavingsTarget) => void }) {
  const latestMonth = getLatestMonth(transactions.filter((item) => item.currency === currency));
  const suggestions = suggestBudgetLimits(transactions, currency);
  const suggestedTotal = suggestions.reduce((sum, item) => sum + item.monthlyLimit, 0);
  const categories = [...new Set([...suggestions.map((item) => item.category), ...budgets.filter((item) => item.id.startsWith(`${currency}:`)).map((item) => item.category as TransactionCategory)])];
  const [targetValue, setTargetValue] = useState(String(target?.currency === currency ? target.monthlyAmount : ""));
  return <>
    <SectionTitle eyebrow="Plan with intention" title="Budget planner" description={`Suggested limits use recent history. Actual spending reflects ${monthLabel(latestMonth)}.`} />
    <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs leading-5 text-blue-800">Suggested limits are 110% of average observed spending over the latest three available months. Edit any limit; budgets are personal targets, not financial advice.</p><div className="flex items-center gap-3"><div><p className="text-[10px] font-medium text-blue-700">Suggested monthly total</p><p className="text-sm font-semibold text-blue-950">{formatMoney(suggestedTotal, currency)}</p></div><button className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={!suggestions.length} onClick={() => suggestions.forEach((item) => onSaveBudget({ id: `${currency}:${item.category}`, category: item.category, monthlyLimit: item.monthlyLimit, actualSpending: item.actualSpending }))} type="button">Apply suggested limits</button></div></div>
      <form className="flex items-end gap-2" onSubmit={(event) => {event.preventDefault();onSaveTarget({ currency, monthlyAmount: Math.max(0, Number(targetValue) || 0) });}}><label className="text-[11px] font-medium text-blue-900">Monthly savings goal<input aria-label="Monthly savings goal" className="mt-1 block w-36 rounded-lg border border-blue-200 bg-white px-2.5 py-2 text-sm" min="0" onChange={(event) => setTargetValue(event.target.value)} placeholder="Optional" type="number" value={targetValue} /></label><button className="rounded-lg bg-ink px-3 py-2.5 text-xs font-semibold text-white" type="submit">Save goal</button></form>
    </div>
    <section className="rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6"><div className="grid grid-cols-[1fr_90px_110px] gap-2 border-b border-slate-100 pb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:grid-cols-[1fr_130px_150px_150px]"><span>Category</span><span className="text-right">Actual</span><span className="text-right">Limit</span><span className="hidden sm:block">Budget status</span></div>
      {categories.length ? categories.map((name) => {
        const suggestion = suggestions.find((item) => item.category === name);
        const id = `${currency}:${name}`;
        const budget = budgets.find((item) => item.id === id);
        const actual = transactions.filter((item) => item.currency === currency && item.type === "expense" && item.category === name && item.date.startsWith(latestMonth)).reduce((sum, item) => sum + Math.abs(item.amount), 0);
        const limit = budget?.monthlyLimit ?? 0;
        const result = calculateBudget(limit, actual);
        return <div className="border-b border-slate-100 py-4 last:border-0" key={name}><div className="grid grid-cols-[1fr_90px_110px] items-center gap-2 sm:grid-cols-[1fr_130px_150px_150px]"><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{name}</p><p className="mt-1 text-[10px] text-slate-400">{suggestion ? `Suggested ${formatMoney(suggestion.monthlyLimit, currency)} · ${suggestion.monthsUsed} month(s)` : "No history-based suggestion"}</p></div><span className="text-right text-xs text-slate-600">{formatMoney(actual, currency)}</span><input aria-label={`${name} monthly budget`} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs text-ink outline-none focus:border-brand" min="0" onChange={(event) => onSaveBudget({ id, category: name, monthlyLimit: Math.max(0, Number(event.target.value) || 0), actualSpending: actual })} placeholder={suggestion?.monthlyLimit ? String(suggestion.monthlyLimit) : "Set limit"} type="number" value={budget?.monthlyLimit || ""} /><div className="hidden sm:block">{limit > 0 && <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${result.isOverBudget ? "bg-brand" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, result.progressPercent ?? 0)}%` }} /></div>}</div></div>
          {limit > 0 && <p className={`mt-2 text-[11px] ${result.isOverBudget ? "text-brand" : "text-emerald-700"}`}>{result.isOverBudget ? `${formatMoney(result.overspent, currency)} over budget` : `${formatMoney(result.remaining, currency)} remaining`}</p>}
        </div>;
      }) : <div className="py-8"><EmptyState text="Import more expenses to receive historical budget suggestions." /></div>}
    </section>
  </>;
}

function InvestmentsPage({ transactions, currency, investments, onSaveInvestment, onRemoveInvestment }: { transactions: Transaction[]; currency: string; investments: Investment[]; onSaveInvestment: (investment: Investment) => void; onRemoveInvestment: (id: string) => void }) {
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const portfolio = calculatePortfolio(investments, currency);
  const investmentRows = transactions.filter((item) => item.currency === currency && item.type === "investment");
  function addHolding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticker.trim() || !name.trim() || !purchaseDate) return;
    onSaveInvestment({ id: crypto.randomUUID(), ticker: ticker.trim().toUpperCase(), name: name.trim(), quantity: Number(quantity), purchasePrice: Number(purchasePrice), currentPrice: Number(currentPrice), currency, purchaseDate, priceSource: "manual" });
    setTicker(""); setName(""); setQuantity(""); setPurchasePrice(""); setCurrentPrice(""); setPurchaseDate("");
  }
  return <>
    <SectionTitle eyebrow="Long-term picture" title="Investments" description="Track holdings, browse market quotes, and compare historical risk scenarios. No return is guaranteed." />
    <div className="grid gap-4 md:grid-cols-3"><SummaryCard title="Total invested" value={formatMoney(portfolio.totalInvested, currency)} detail="Quantity × entered purchase price" icon={BriefcaseBusiness} /><SummaryCard title="Current portfolio value" value={formatMoney(portfolio.currentValue, currency)} detail="Quantity × manually entered current price" icon={Wallet} /><SummaryCard title="Unrealised profit / loss" value={formatMoney(portfolio.unrealizedProfitLoss, currency)} detail={`${portfolio.returnPercent.toFixed(2)}% return on entered cost`} icon={portfolio.unrealizedProfitLoss >= 0 ? TrendingUp : TrendingDown} tone={portfolio.unrealizedProfitLoss >= 0 ? "green" : "red"} /></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="font-semibold text-ink">Holdings and allocation</h2><p className="mt-1 text-xs text-slate-500">Allocation is calculated only within {currency}; different currencies are never converted.</p>
        {portfolio.allocation.map((holding) => {const source = investments.find((item) => item.id === holding.id)!; return <div className="grid grid-cols-[1fr_90px_90px_28px] items-center gap-2 border-b border-slate-100 py-4" key={holding.id}><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{holding.name} <span className="text-xs text-slate-400">{holding.ticker}</span></p><p className="mt-1 text-[10px] text-slate-400">{source.quantity} units · {holding.sharePercent.toFixed(1)}% allocation · MANUAL PRICE</p></div><span className="text-right text-xs text-slate-600">{formatMoney(holding.value, currency)}</span><input aria-label={`Update current price for ${holding.ticker}`} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-xs" min="0" onBlur={(event) => {const value = Number(event.target.value);if (Number.isFinite(value) && value >= 0 && value !== source.currentPrice) onSaveInvestment({ ...source, currentPrice: value, priceSource: "manual" });}} type="number" defaultValue={source.currentPrice} /><button aria-label={`Remove ${holding.ticker}`} className="text-slate-400 hover:text-brand" onClick={() => onRemoveInvestment(holding.id)} type="button"><X size={15} /></button></div>;})}
        {!portfolio.allocation.length && <div className="mt-4"><EmptyState text="Add a stock or ETF holding to calculate manually priced portfolio value and asset allocation." /></div>}
        <p className="mt-3 text-[10px] text-slate-400">Current prices are user-entered estimates, not live data or investment advice.</p>
      </section>
      <section className="rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="font-semibold text-ink">Add a holding</h2><form className="mt-4 grid grid-cols-2 gap-3" onSubmit={addHolding}>
        <label className="text-[11px] text-slate-500">Ticker<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink" onChange={(event) => setTicker(event.target.value)} required value={ticker} /></label>
        <label className="text-[11px] text-slate-500">Name<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink" onChange={(event) => setName(event.target.value)} required value={name} /></label>
        <label className="text-[11px] text-slate-500">Quantity<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink" min="0.000001" onChange={(event) => setQuantity(event.target.value)} required step="any" type="number" value={quantity} /></label>
        <label className="text-[11px] text-slate-500">Purchase price ({currency})<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink" min="0" onChange={(event) => setPurchasePrice(event.target.value)} required step="any" type="number" value={purchasePrice} /></label>
        <label className="text-[11px] text-slate-500">Current price ({currency})<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink" min="0" onChange={(event) => setCurrentPrice(event.target.value)} required step="any" type="number" value={currentPrice} /></label>
        <label className="text-[11px] text-slate-500">Purchase date<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-ink" onChange={(event) => setPurchaseDate(event.target.value)} required type="date" value={purchaseDate} /></label>
        <button className="col-span-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white" type="submit">Add manually priced holding</button>
      </form></section>
    </div>
    <MarketWatchlist holdings={investments} />
    {investmentRows.length > 0 && <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="mb-2 font-semibold text-ink">Imported investment activity</h2>{investmentRows.slice(0, 8).map((item) => <TransactionRow currency={currency} item={item} key={item.id} />)}</section>}
  </>;
}

function ForecastPage({ transactions, currency, bills, onSaveBill, onRemoveBill }: { transactions: Transaction[]; currency: string; bills: UpcomingBill[]; onSaveBill: (bill: UpcomingBill) => void; onRemoveBill: (id: string) => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const forecast = forecastCashFlow(transactions, bills, currency);
  function addBill(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !dueDate || Number(amount) <= 0) return;
    onSaveBill({ id: crypto.randomUUID(), name: name.trim(), amount: Number(amount), currency, dueDate });
    setName(""); setAmount(""); setDueDate("");
  }
  return <>
    <SectionTitle eyebrow="A simple look ahead" title="Financial forecast" description="Transparent estimated net flow. These are projections, not balances or guaranteed future outcomes." />
    <div className="grid gap-4 md:grid-cols-2">{forecast.horizons.map((horizon) => <div className="rounded-2xl border border-line bg-white p-5 shadow-card" key={horizon.days}><div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink">Next {horizon.days} days · estimate</p><CalendarDays className="text-brand" size={18} /></div><div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-[11px] text-slate-500">Recurring income</p><p className="mt-1 text-sm font-semibold text-emerald-700">{formatMoney(horizon.projectedIncome, currency)}</p></div><div><p className="text-[11px] text-slate-500">Projected expenses incl. bills</p><p className="mt-1 text-sm font-semibold text-ink">{formatMoney(horizon.projectedExpenses, currency)}</p></div><div><p className="text-[11px] text-slate-500">Known upcoming bills</p><p className="mt-1 text-sm font-semibold text-ink">{formatMoney(horizon.knownBills, currency)}</p></div><div><p className="text-[11px] text-slate-500">Projected net flow</p><p className={`mt-1 text-sm font-semibold ${horizon.projectedNetFlow >= 0 ? "text-emerald-700" : "text-brand"}`}>{formatMoney(horizon.projectedNetFlow, currency)}</p></div></div></div>)}</div>
    <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="font-semibold text-ink">Forecast assumptions</h2><p className="mt-1 text-xs text-slate-500">As of {forecast.asOfDate} · confidence indicator {Math.round(forecast.confidence * 100)}%</p><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-slate-600">{forecast.assumptions.map((item) => <li key={item}>{item}</li>)}</ul><div className="mt-4 grid gap-4 md:grid-cols-2"><div><h3 className="text-xs font-semibold text-ink">Recurring income included</h3>{forecast.recurringIncomeFlows.map((flow) => <p className="mt-2 text-xs text-slate-500" key={flow.key}>{flow.name}: {formatMoney(flow.monthlyAmount, currency)} / month</p>)}{!forecast.recurringIncomeFlows.length && <p className="mt-2 text-xs text-slate-400">No recurring income pattern detected.</p>}</div><div><h3 className="text-xs font-semibold text-ink">Recurring expenses included</h3>{forecast.recurringExpenseFlows.map((flow) => <p className="mt-2 text-xs text-slate-500" key={flow.key}>{flow.name}: {formatMoney(flow.monthlyAmount, currency)} / month</p>)}{!forecast.recurringExpenseFlows.length && <p className="mt-2 text-xs text-slate-400">No recurring expense pattern detected.</p>}</div></div></section>
    <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><section className="rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="font-semibold text-ink">Add a known bill</h2><p className="mt-1 text-xs text-slate-500">Bills inside a horizon are added unless they match an identified recurring expense.</p><form className="mt-4 space-y-3" onSubmit={addBill}><input aria-label="Bill name" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" onChange={(event) => setName(event.target.value)} placeholder="Bill name" required value={name} /><div className="grid grid-cols-2 gap-2"><input aria-label="Bill amount" className="min-w-0 rounded-lg border border-slate-200 px-3 py-2.5 text-sm" min="0.01" onChange={(event) => setAmount(event.target.value)} placeholder={`Amount (${currency})`} required step="any" type="number" value={amount} /><input aria-label="Bill due date" className="min-w-0 rounded-lg border border-slate-200 px-2 py-2.5 text-sm" min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDueDate(event.target.value)} required type="date" value={dueDate} /></div><button className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white" type="submit">Add bill</button></form></section><section className="rounded-2xl border border-line bg-white p-5 shadow-card"><h2 className="font-semibold text-ink">Upcoming bills · {currency}</h2>{bills.filter((bill) => bill.currency === currency).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((bill) => <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0" key={bill.id}><div><p className="text-sm font-medium text-ink">{bill.name}</p><p className="mt-1 text-xs text-slate-400">Due {bill.dueDate}</p></div><div className="flex items-center gap-3"><span className="text-sm font-semibold text-ink">{formatMoney(bill.amount, currency)}</span><button aria-label={`Remove ${bill.name}`} className="text-slate-400 hover:text-brand" onClick={() => onRemoveBill(bill.id)} type="button"><X size={15} /></button></div></div>)}{!bills.some((bill) => bill.currency === currency) && <div className="mt-3"><EmptyState text="No bills entered yet." /></div>}</section></div>
  </>;
}

function AssistantPage({ transactions, currency }: { transactions: Transaction[]; currency: string }) {
  const month = getLatestMonth(transactions.filter((item) => item.currency === currency));
  const latest = summarizeMonth(transactions.filter((item) => item.currency === currency), month);
  const category = getCategoryTotals(transactions.filter((item) => item.currency === currency && item.date.slice(0, 4) === month.slice(0, 4)))[0];
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "assistant" | "user"; text: string }[]>([
    { role: "assistant", text: "Hi, I’m your private money assistant. Ask about your spending, savings, or recurring transactions. I only use the data you imported into this browser." }
  ]);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const speechRef = useRef<SpeechRecognizer | null>(null);

  function ask(value: string) {
    const prompt = value.trim();
    if (!prompt) return;
    const lower = prompt.toLowerCase();
    let response: string;
    if (/save|saving|spend less|reduce/.test(lower)) {
      response = category
        ? `${category.name} is your largest spending category in ${month.slice(0, 4)} at ${formatMoney(category.value, currency)}. A 5% reduction would be approximately ${formatMoney(category.value * 0.05, currency)} over the recorded year; that is an illustration, not a guaranteed saving.`
        : "Import more transaction history and I can surface a category-level savings opportunity.";
    } else if (/income|earn|salary/.test(lower)) {
      response = `Your recorded income in ${monthLabel(month)} is ${formatMoney(latest.income, currency)}. This includes only transactions classified as income; refunds and internal transfers are kept separate.`;
    } else if (/balance|cash/.test(lower)) {
      response = "I can’t confirm your available cash balance from these CSVs. They contain transactions but no verified opening or current balance. Your net cash flow is not the same as a bank balance.";
    } else if (/budget|category|spend/.test(lower) && category) {
      response = `Your largest recorded spending category in ${month.slice(0, 4)} is ${category.name} at ${formatMoney(category.value, currency)}. You can set a personal monthly limit in Budget Planner.`;
    } else {
      response = `For ${monthLabel(month)}, recorded income was ${formatMoney(latest.income, currency)} and eligible spending was ${formatMoney(latest.expenses, currency)}. Transfers are excluded. Ask me about a category, saving, or your balance.`;
    }
    setMessages((current) => [...current, { role: "user", text: prompt }, { role: "assistant", text: response }]);
    setQuestion("");
  }

  function startVoice() {
    const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognizerConstructor; webkitSpeechRecognition?: SpeechRecognizerConstructor };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError("Voice input is not supported in this browser. You can type your question instead.");
      return;
    }
    setSpeechError("");
    const recognizer = new Recognition();
    recognizer.lang = "en-CH";
    recognizer.interimResults = false;
    recognizer.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setQuestion(transcript);
        setListening(false);
      }
    };
    recognizer.onerror = () => {
      setListening(false);
      setSpeechError("We couldn’t hear that clearly. Try again or type your question.");
    };
    speechRef.current = recognizer;
    setListening(true);
    recognizer.start();
  }

  return <><SectionTitle eyebrow="A little help, whenever you need it" title="AI assistant" description="Private, local financial answers from your uploaded transaction data." /><div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-line bg-white shadow-card"><div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white"><Bot size={19} /></span><div><p className="text-sm font-semibold text-ink">Luma assistant</p><p className="text-[11px] text-slate-400">Your data stays on this device · Not financial advice</p></div><span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Private session</span></div><div className="max-h-[440px] min-h-[280px] space-y-4 overflow-y-auto p-5 sm:p-6">{messages.map((message, index) => <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={index}><div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-ink text-white" : "rounded-bl-md bg-slate-100 text-ink"}`}>{message.text}</div></div>)}</div><div className="border-t border-slate-100 p-4"><div className="flex gap-2"><button aria-label={listening ? "Stop voice input" : "Start voice input"} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${listening ? "border-brand bg-rose-50 text-brand" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`} onClick={() => {if (listening) speechRef.current?.stop(); else startVoice(); setListening(false);}} type="button"><Mic size={17} /></button><input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-brand" onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => {if (event.key === "Enter") ask(question);}} placeholder={listening ? "Listening…" : "Ask about your spending, saving, or budget"} value={question} /><button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white hover:bg-rose-700" onClick={() => ask(question)} type="button"><Send size={16} /></button></div>{speechError && <p className="mt-2 text-xs text-amber-700">{speechError}</p>}<div className="mt-3 flex flex-wrap gap-2">{["Where could I save?", "How much did I earn?", "Can you confirm my balance?"].map((item) => <button className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] text-slate-500 hover:border-slate-300 hover:text-ink" key={item} onClick={() => ask(item)} type="button">{item}</button>)}</div></div></div></>;
}

function SettingsModal({ transactions, onClose, onClear, onImport }: { transactions: Transaction[]; onClose: () => void; onClear: () => Promise<void>; onImport: () => void }) {
  const [clearing, setClearing] = useState(false);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-sm" onClick={onClose}><section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold text-ink">Privacy & data</h2><p className="mt-1 text-sm text-slate-500">Your transaction data lives in this browser.</p></div><button aria-label="Close settings" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X size={17} /></button></div><div className="mt-5 space-y-3"><div className="flex items-center justify-between rounded-xl bg-slate-50 p-4"><span className="text-sm text-slate-600">Stored transactions</span><span className="text-sm font-semibold text-ink">{transactions.length}</span></div><div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-5 text-emerald-800"><ShieldCheck className="mt-0.5 shrink-0" size={15} /><p>CSV files are processed in your browser and stored in IndexedDB. This prototype does not connect to a bank or send transaction data to a server.</p></div><button className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-ink hover:bg-slate-50" onClick={onImport} type="button">Import more CSV files</button><button className="w-full rounded-xl border border-red-100 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50" disabled={!transactions.length || clearing} onClick={async () => {if (window.confirm("Remove all imported transactions from this browser? This cannot be undone.")){setClearing(true);await onClear();setClearing(false);}}} type="button">{clearing ? "Removing…" : "Delete all local data"}</button></div></section></div>;
}

function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (items: Transaction[]) => Promise<{ added: number; duplicates: number }> }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-ink/35 p-3 backdrop-blur-sm sm:p-5" onClick={onClose}>
      <section aria-labelledby="import-dialog-title" aria-modal="true" className="my-auto w-full max-w-4xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7" onClick={(event) => event.stopPropagation()} role="dialog">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand">Private import</p>
            <h2 className="mt-1 text-xl font-semibold text-ink" id="import-dialog-title">Add transactions</h2>
            <p className="mt-1 text-sm text-slate-500">Select the matching columns for each file before import.</p>
          </div>
          <button aria-label="Close import dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose} type="button"><X size={18} /></button>
        </div>
        <CsvImporter onClose={onClose} onImport={onImport} />
      </section>
    </div>
  );
}

export function FinancialApp() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [section, setSection] = useState<Section>("AI Assistant");
  const [currency, setCurrency] = useState("CHF");
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [bills, setBills] = useState<UpcomingBill[]>([]);
  const [categoryRules, setCategoryRules] = useState<CategoryRule[]>([]);
  const [savingsTargets, setSavingsTargets] = useState<SavingsTarget[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([readTransactions(), readBudgets(), readInvestments(), readBills(), readCategoryRules(), readSavingsTargets()])
      .then(([items, savedBudgets, savedInvestments, savedBills, savedRules, savedTargets]) => {
        if (mounted) {
          setTransactions(applyClassificationRules(items, savedRules));
          setBudgets(savedBudgets);
          setInvestments(savedInvestments);
          setBills(savedBills);
          setCategoryRules(savedRules);
          setSavingsTargets(savedTargets);
          if (items.length) setCurrency(items.some((item) => item.currency === "CHF") ? "CHF" : items[0].currency);
        }
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Your local data could not be loaded."))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function handleImport(items: Transaction[]) {
    const classified = applyClassificationRules(items, categoryRules);
    const existing = await readTransactions();
    const existingIds = new Set(existing.map((item) => item.id));
    const unique = deduplicateTransactions([...existing, ...classified]).transactions.filter((item) => !existingIds.has(item.id));
    const added = await addTransactions(unique);
    const saved = await readTransactions();
    setTransactions(saved);
    const currencies = getCurrencies(saved);
    if (!currencies.includes(currency) && currencies.length) setCurrency(currencies.includes("CHF") ? "CHF" : currencies[0]);
    setError("");
    return { added, duplicates: items.length - added };
  }

  function showDemo() {
    setTransactions(createDemoTransactions());
    setCurrency("CHF");
    setSection("AI Assistant");
    setError("");
  }

  async function handleClear() {
    await clearTransactions();
    setTransactions([]);
    setInvestments([]);
    setBills([]);
    setCategoryRules([]);
    setSavingsTargets([]);
    setSettingsOpen(false);
    setSection("AI Assistant");
    setBudgets([]);
  }

  function importFromSettings() {
    setSettingsOpen(false);
    setImportOpen(true);
  }

  async function saveBudget(budget: Budget) {
    try {
      if (budget.monthlyLimit > 0) await writeBudget(budget);
      else await removeBudget(budget.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The budget could not be saved.");
      return;
    }
    setBudgets((current) => {
      const next = current.filter((item) => item.id !== budget.id);
      return budget.monthlyLimit > 0 ? [...next, budget] : next;
    });
  }

  async function createBudgets(values: Budget[]) {
    try {
      await Promise.all(values.map((budget) => writeBudget(budget)));
      setBudgets((current) => [...current.filter((item) => !values.some((value) => value.id === item.id)), ...values]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The suggested budgets could not be saved.");
      throw reason;
    }
  }

  async function saveInvestment(investment: Investment) {
    try {
      await writeInvestment(investment);
      setInvestments((current) => [...current.filter((item) => item.id !== investment.id), investment]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The holding could not be saved.");
    }
  }

  async function deleteInvestment(id: string) {
    try {
      await removeInvestment(id);
      setInvestments((current) => current.filter((item) => item.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The holding could not be removed.");
    }
  }

  async function saveBill(bill: UpcomingBill) {
    try {
      await writeBill(bill);
      setBills((current) => [...current.filter((item) => item.id !== bill.id), bill]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The bill could not be saved.");
    }
  }

  async function deleteBill(id: string) {
    try {
      await removeBill(id);
      setBills((current) => current.filter((item) => item.id !== id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The bill could not be removed.");
    }
  }

  async function saveTarget(target: SavingsTarget) {
    try {
      await writeSavingsTarget(target);
      setSavingsTargets((current) => [...current.filter((item) => item.currency !== target.currency), target]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The savings target could not be saved.");
    }
  }

  async function saveCategoryRule(rule: CategoryRule) {
    try {
      await writeCategoryRule(rule);
      const nextRules = [...categoryRules.filter((item) => item.id !== rule.id), rule];
      setCategoryRules(nextRules);
      const updated = applyClassificationRules(transactions, nextRules);
      await Promise.all(updated.map((item) => updateTransaction(item)));
      setTransactions(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The classification rule could not be saved.");
    }
  }

  async function deleteCategoryRule(id: string) {
    try {
      await removeCategoryRule(id);
      const nextRules = categoryRules.filter((item) => item.id !== id);
      setCategoryRules(nextRules);
      const updated = applyClassificationRules(transactions, nextRules);
      await Promise.all(updated.map((item) => updateTransaction(item)));
      setTransactions(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The classification rule could not be removed.");
    }
  }

  async function changeTransactionCategory(transaction: Transaction, category: TransactionCategory) {
    const updated = { ...transaction, category, categorySource: "manual" as const };
    try {
      await updateTransaction(updated);
      setTransactions((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The transaction category could not be saved.");
    }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-canvas"><div className="flex items-center gap-3 text-sm text-slate-500"><LoaderCircle className="animate-spin text-brand" size={18} />Opening your AI assistant…</div></div>;
  if (!transactions.length) return <Onboarding error={error} onDemo={showDemo} onImported={handleImport} />;

  const currencies = getCurrencies(transactions);
  const selectedCurrency = currencies.includes(currency) ? currency : currencies[0] ?? "CHF";
  const MainIcon = navigation.find((item) => item.name === section)?.icon ?? Home;

  if (section === "AI Assistant") {
    return (
      <>
        <FinancialAgent bills={bills} budgets={budgets} currency={selectedCurrency} investments={investments} onCreateBudgets={createBudgets} onOpenImport={() => setImportOpen(true)} savingsTarget={savingsTargets.find((item) => item.currency === selectedCurrency)} transactions={transactions} />
        {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImport={handleImport} />}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-line bg-white px-4 py-6 transition-transform duration-200 lg:translate-x-0 ${mobileMenu ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-2"><Logo /><button aria-label="Close navigation" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden" onClick={() => setMobileMenu(false)} type="button"><X size={18} /></button></div>
        <div className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Your workspace</div>
        <nav className="mt-3 space-y-1">{navigation.map(({ name, icon: Icon }) => <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition ${section === name ? "bg-rose-50 text-brand" : "text-slate-500 hover:bg-slate-50 hover:text-ink"}`} key={name} onClick={() => {setSection(name);setMobileMenu(false);}} type="button"><Icon size={17} strokeWidth={section === name ? 2.2 : 1.8} /><span>{name}</span>{name === "AI Assistant" && <span className="ml-auto rounded-md bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-600">NEW</span>}</button>)}</nav>
        <div className="mt-auto">
          <div className="mb-4 rounded-2xl bg-[#f7f8fa] p-4"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-brand shadow-sm"><ShieldCheck size={16} /></div><p className="mt-3 text-xs font-semibold text-ink">Private by design</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Your financial data stays on this device.</p></div>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-ink" onClick={() => setSettingsOpen(true)} type="button"><Settings2 size={17} /> Privacy & settings</button>
          <p className="mt-4 px-3 text-[9px] leading-4 text-slate-400">Independent prototype · Not affiliated with PostFinance</p>
        </div>
      </aside>
      {mobileMenu && <button aria-label="Close menu overlay" className="fixed inset-0 z-30 bg-ink/30 lg:hidden" onClick={() => setMobileMenu(false)} type="button" />}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur-md sm:px-7 lg:px-9">
          <div className="flex items-center gap-3"><button aria-label="Open navigation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setMobileMenu(true)} type="button"><Menu size={19} /></button><div className="hidden items-center gap-2 text-xs text-slate-400 sm:flex"><span>Workspace</span><span>/</span><span className="font-semibold text-ink">{section}</span></div><div className="sm:hidden"><Logo /></div></div>
          <div className="flex items-center gap-2 sm:gap-3"><span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Local & secure</span><button aria-label="Privacy and settings" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" onClick={() => setSettingsOpen(true)} type="button"><Settings2 size={17} /></button><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#edf0f5] text-xs font-semibold text-slate-600">JD</span></div>
        </header>
        <main className="mx-auto max-w-[1450px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">
          {error && <div className="mb-5 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError("")} type="button"><X size={16} /></button></div>}
          <div className="fade-up" key={section}>
            {section === "Overview" && <Dashboard currency={selectedCurrency} onCurrency={setCurrency} onImport={() => setImportOpen(true)} onNavigate={setSection} transactions={transactions} />}
            {section === "My Accounts" && <AccountsPage currency={selectedCurrency} onCategoryChange={changeTransactionCategory} onCurrency={setCurrency} onDeleteRule={deleteCategoryRule} onImport={() => setImportOpen(true)} onSaveRule={saveCategoryRule} rules={categoryRules} transactions={transactions} />}
            {section === "Smart Savings" && <SavingsPage currency={selectedCurrency} onSaveTarget={saveTarget} target={savingsTargets.find((item) => item.currency === selectedCurrency)} transactions={transactions} />}
            {section === "Budget Planner" && <BudgetPage budgets={budgets} currency={selectedCurrency} onSaveBudget={saveBudget} onSaveTarget={saveTarget} target={savingsTargets.find((item) => item.currency === selectedCurrency)} transactions={transactions} />}
            {section === "Investments" && <InvestmentsPage currency={selectedCurrency} investments={investments} onRemoveInvestment={deleteInvestment} onSaveInvestment={saveInvestment} transactions={transactions} />}
            {section === "Financial Forecast" && <ForecastPage bills={bills} currency={selectedCurrency} onRemoveBill={deleteBill} onSaveBill={saveBill} transactions={transactions} />}
          </div>
          <footer className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-4 text-[10px] leading-4 text-slate-400"><span>Informational tool only · Not financial advice</span><span>Prototype independent from PostFinance · Calculations use imported records only</span></footer>
        </main>
      </div>

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImport={handleImport} />}
      {settingsOpen && <SettingsModal onClear={handleClear} onClose={() => setSettingsOpen(false)} onImport={importFromSettings} transactions={transactions} />}
    </div>
  );
}
