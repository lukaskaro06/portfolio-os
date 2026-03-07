// src/components/CompanyDeepDive.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full company intelligence panel — drops into StockDetail in MarketWatch.jsx
// Replace the existing StockDetail body with <CompanyDeepDive ticker={...} quote={...} />
//
// Tabs:
//   OVERVIEW    — quote hero, key stats, business description, peers
//   FINANCIALS  — income stmt, balance sheet, cash flow (5 yrs), 30+ ratios
//   EARNINGS    — EPS actual vs estimate, surprise %, next date countdown
//   ANALYSTS    — consensus rating, price targets, upgrade/downgrade history
//   OPTIONS     — full chain (calls+puts), IV, OI, Greeks, max pain, P/C ratio
//   INSIDER     — SEC Form 4 buys/sells, 13F institutional ownership
//   FILINGS     — 10-K, 10-Q, 8-K, DEF14A, S-1 direct from SEC EDGAR
//   AI DEEP DIVE— bull/bear/moat/risks/verdict via Groq LLaMA 3.3 70B
//
// Data sources (all free):
//   Yahoo Finance v10/quoteSummary — fundamentals, earnings, analysts
//   Yahoo Finance v7/options       — options chains
//   SEC EDGAR full-text search     — filings, Form 4 insider trades
//   Groq API                       — AI analysis
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from "react";
import { Spinner } from "./UI";
import CandleChart from "./CandleChart";
import { proxyUrl, fetchStockNews } from "../hooks/useStockData";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ReferenceLine, Cell,
} from "recharts";

// ── Groq key ──────────────────────────────────────────────────────────────────
function getGroqKey() {
  if (typeof process !== "undefined" && process.env?.REACT_APP_GROQ_API_KEY)
    return process.env.REACT_APP_GROQ_API_KEY;
  if (typeof window !== "undefined" && window.__GROQ_API_KEY)
    return window.__GROQ_API_KEY;
  return "";
}

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt$ = n => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3)  return `$${(n/1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtN  = (n, d=2) => (n == null || isNaN(n)) ? "—" : (+n).toFixed(d);
const fmtP  = (n, d=1) => (n == null || isNaN(n)) ? "—" : `${(+n*100).toFixed(d)}%`;
const fmtPc = (n, d=1) => (n == null || isNaN(n)) ? "—" : `${(+n).toFixed(d)}%`;
const fmtV  = n => {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return String(n);
};

// ── Theme constants (matches existing app) ────────────────────────────────────
const C = {
  bg:     "#0d1117",
  bg2:    "#080c12",
  bg3:    "#060a0f",
  border: "#1c2333",
  green:  "#00ff9d",
  red:    "#ff6b35",
  yellow: "#ffd700",
  blue:   "#00c8ff",
  purple: "#c084fc",
  dim:    "#8b949e",
  text:   "#c9d1d9",
  white:  "#ffffff",
};

// ── Data fetcher — Yahoo quoteSummary ─────────────────────────────────────────
async function fetchSummary(ticker, modules) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules.join(",")}`;
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json?.quoteSummary?.error) throw new Error(json.quoteSummary.error.description);
  return json?.quoteSummary?.result?.[0] ?? {};
}

// ── SEC EDGAR search ──────────────────────────────────────────────────────────
async function fetchFilings(ticker, forms = "10-K,10-Q,8-K", limit = 20) {
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${ticker}%22&forms=${forms}&dateRange=custom&startdt=2020-01-01`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return (json?.hits?.hits ?? []).slice(0, limit);
  } catch { return []; }
}

// ── Options fetch ─────────────────────────────────────────────────────────────
async function fetchOptions(ticker, expiry = "") {
  const url = `https://query1.finance.yahoo.com/v7/finance/options/${ticker}${expiry ? `?date=${expiry}` : ""}`;
  const res = await fetch(proxyUrl(url));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json?.optionChain?.result?.[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, marginBottom: 18, overflowX: "auto", flexShrink: 0 }}>
      {tabs.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          background: "transparent", border: "none",
          borderBottom: `2px solid ${active === t ? C.green : "transparent"}`,
          color: active === t ? C.green : C.dim,
          padding: "8px 14px", fontSize: 10, letterSpacing: "0.1em",
          fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap",
          transition: "all 0.15s",
        }}>{t}</button>
      ))}
    </div>
  );
}

function Row({ label, value, valueColor, mono = true }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${C.border}44` }}>
      <span style={{ color: C.dim, fontSize: 11 }}>{label}</span>
      <span style={{ color: valueColor || C.text, fontSize: 11, fontFamily: mono ? "monospace" : "inherit", fontWeight: 500 }}>{value ?? "—"}</span>
    </div>
  );
}

function SectionHead({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 20 }}>
      <div style={{ width: 3, height: 14, background: C.green, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "14px 16px", ...style }}>
      {children}
    </div>
  );
}

function Tip({ positive }) {
  const c = positive ? C.green : C.red;
  return <span style={{ color: c, fontSize: 11, fontWeight: 600 }}>{positive ? "▲" : "▼"}</span>;
}

const DT = ({ contentStyle, ...rest }) => (
  <Tooltip
    contentStyle={{ background: C.bg3, border: `1px solid ${C.border}`, fontSize: 10, fontFamily: "monospace", borderRadius: 4 }}
    {...rest}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function TabOverview({ ticker, quote, summary }) {
  const p  = summary?.price             ?? {};
  const s  = summary?.summaryDetail     ?? {};
  const ks = summary?.defaultKeyStatistics ?? {};
  const fi = summary?.financialData     ?? {};
  const ap = summary?.assetProfile      ?? {};

  const stats = [
    ["Market Cap",      fmt$(p.marketCap?.raw)],
    ["Enterprise Value",fmt$(ks.enterpriseValue?.raw)],
    ["P/E (TTM)",       fmtN(s.trailingPE?.raw)],
    ["Fwd P/E",         fmtN(s.forwardPE?.raw)],
    ["P/B",             fmtN(ks.priceToBook?.raw)],
    ["P/S (TTM)",       fmtN(ks.priceToSalesTrailing12Months?.raw)],
    ["EV/EBITDA",       fmtN(ks.enterpriseToEbitda?.raw)],
    ["EV/Revenue",      fmtN(ks.enterpriseToRevenue?.raw)],
    ["PEG Ratio",       fmtN(ks.pegRatio?.raw)],
    ["Beta",            fmtN(s.beta?.raw)],
    ["52W High",        `$${fmtN(s.fiftyTwoWeekHigh?.raw)}`],
    ["52W Low",         `$${fmtN(s.fiftyTwoWeekLow?.raw)}`],
    ["Avg Volume",      fmtV(s.averageVolume?.raw)],
    ["Float",           fmtV(ks.floatShares?.raw)],
    ["Shares Out",      fmtV(ks.sharesOutstanding?.raw)],
    ["Short % Float",   fmtPc(ks.shortPercentOfFloat?.raw * 100)],
    ["Div Yield",       fmtPc(s.dividendYield?.raw * 100)],
    ["Payout Ratio",    fmtPc(s.payoutRatio?.raw * 100)],
    ["Revenue (TTM)",   fmt$(fi.totalRevenue?.raw)],
    ["Gross Margin",    fmtP(fi.grossMargins?.raw)],
    ["Op Margin",       fmtP(fi.operatingMargins?.raw)],
    ["Net Margin",      fmtP(fi.profitMargins?.raw)],
    ["ROE",             fmtP(fi.returnOnEquity?.raw)],
    ["ROA",             fmtP(fi.returnOnAssets?.raw)],
    ["Debt/Equity",     fmtN(fi.debtToEquity?.raw)],
    ["Current Ratio",   fmtN(fi.currentRatio?.raw)],
    ["Quick Ratio",     fmtN(fi.quickRatio?.raw)],
    ["Free Cash Flow",  fmt$(fi.freeCashflow?.raw)],
    ["Op Cash Flow",    fmt$(fi.operatingCashflow?.raw)],
    ["Total Cash",      fmt$(fi.totalCash?.raw)],
    ["Total Debt",      fmt$(fi.totalDebt?.raw)],
    ["Revenue/Share",   `$${fmtN(fi.revenuePerShare?.raw)}`],
    ["Book Value/Share",`$${fmtN(ks.bookValue?.raw)}`],
    ["EPS (TTM)",       `$${fmtN(ks.trailingEps?.raw)}`],
    ["EPS (Fwd)",       `$${fmtN(ks.forwardEps?.raw)}`],
    ["Earnings Growth", fmtPc((fi.earningsGrowth?.raw ?? 0)*100)],
    ["Revenue Growth",  fmtPc((fi.revenueGrowth?.raw ?? 0)*100)],
  ];

  const officers = ap.companyOfficers?.slice(0, 6) ?? [];

  return (
    <div>
      {/* Description */}
      {ap.longBusinessSummary && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHead>Business Description</SectionHead>
          <p style={{ color: C.text, fontSize: 12, lineHeight: 1.8, margin: 0 }}>{ap.longBusinessSummary}</p>
          <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
            {[
              ["Sector",      ap.sector],
              ["Industry",    ap.industry],
              ["Employees",   ap.fullTimeEmployees?.toLocaleString()],
              ["HQ",          ap.city && ap.country ? `${ap.city}, ${ap.country}` : ap.country],
              ["Website",     ap.website ? <a href={ap.website} target="_blank" rel="noreferrer" style={{ color: C.blue }}>{ap.website.replace("https://","").replace("www.","")}</a> : null],
            ].map(([l, v]) => v ? (
              <div key={l}>
                <div style={{ color: C.dim, fontSize: 9, letterSpacing: "0.08em" }}>{l.toUpperCase()}</div>
                <div style={{ color: C.text, fontSize: 12, marginTop: 2 }}>{v}</div>
              </div>
            ) : null)}
          </div>
        </Card>
      )}

      {/* Key stats grid */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHead>Key Statistics — {stats.length} metrics</SectionHead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0 24px" }}>
          {stats.map(([l, v]) => <Row key={l} label={l} value={v} />)}
        </div>
      </Card>

      {/* Management team */}
      {officers.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHead>Management Team</SectionHead>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {officers.map((o, i) => (
              <div key={i} style={{ padding: "10px 12px", background: C.bg2, borderRadius: 5, border: `1px solid ${C.border}` }}>
                <div style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>{o.name}</div>
                <div style={{ color: C.dim, fontSize: 10, marginTop: 2 }}>{o.title}</div>
                {o.totalPay?.raw && (
                  <div style={{ color: C.yellow, fontSize: 10, marginTop: 4, fontFamily: "monospace" }}>
                    Pay: {fmt$(o.totalPay.raw)}
                  </div>
                )}
                {o.yearBorn && (
                  <div style={{ color: C.dim, fontSize: 10 }}>Age: {new Date().getFullYear() - o.yearBorn}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: FINANCIALS
// ─────────────────────────────────────────────────────────────────────────────
function TabFinancials({ summary }) {
  const [view, setView] = useState("income");

  const is = summary?.incomeStatementHistoryQuarterly?.incomeStatementHistory ?? [];
  const bs = summary?.balanceSheetHistoryQuarterly?.balanceSheetStatements     ?? [];
  const cf = summary?.cashflowStatementHistoryQuarterly?.cashflowStatements    ?? [];

  const isA = summary?.incomeStatementHistory?.incomeStatementHistory ?? [];
  const bsA = summary?.balanceSheetHistory?.balanceSheetStatements    ?? [];
  const cfA = summary?.cashflowStatementHistory?.cashflowStatements   ?? [];

  const [freq, setFreq] = useState("annual");
  const incomeData = freq === "annual" ? isA : is;
  const bsData     = freq === "annual" ? bsA : bs;
  const cfData     = freq === "annual" ? cfA : cf;

  // Build chart-ready data
  const incomeChart = incomeData.map(s => ({
    date:    s.endDate?.fmt ?? "",
    revenue: s.totalRevenue?.raw,
    ebitda:  (s.ebit?.raw ?? 0) + (s.depreciationAndAmortization?.raw ?? 0),
    netIncome: s.netIncome?.raw,
    eps:     s.basicEPS?.raw,
  })).reverse();

  const cfChart = cfData.map(s => ({
    date:    s.endDate?.fmt ?? "",
    operatingCF: s.totalCashFromOperatingActivities?.raw,
    capex:       s.capitalExpenditures?.raw,
    freeCF:      (s.totalCashFromOperatingActivities?.raw ?? 0) + (s.capitalExpenditures?.raw ?? 0),
  })).reverse();

  const bsChart = bsData.map(s => ({
    date:        s.endDate?.fmt ?? "",
    totalAssets: s.totalAssets?.raw,
    totalDebt:   s.totalDebt?.raw,
    equity:      s.totalStockholderEquity?.raw,
    cash:        s.cash?.raw,
  })).reverse();

  const barColor = (v) => v >= 0 ? C.green : C.red;

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["income","balance","cashflow"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? `${C.green}15` : C.bg, border: `1px solid ${view === v ? C.green+"44" : C.border}`,
            color: view === v ? C.green : C.dim, padding: "5px 14px", borderRadius: 4,
            fontSize: 10, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.07em",
          }}>{v.toUpperCase()}</button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {["annual","quarterly"].map(f => (
            <button key={f} onClick={() => setFreq(f)} style={{
              background: freq === f ? `${C.blue}15` : C.bg, border: `1px solid ${freq === f ? C.blue+"44" : C.border}`,
              color: freq === f ? C.blue : C.dim, padding: "5px 12px", borderRadius: 4,
              fontSize: 10, cursor: "pointer", fontFamily: "inherit",
            }}>{f === "annual" ? "ANNUAL" : "QUARTERLY"}</button>
          ))}
        </div>
      </div>

      {view === "income" && (
        <>
          {/* Revenue + Net Income chart */}
          <Card style={{ marginBottom: 16 }}>
            <SectionHead>Revenue & Net Income ({freq})</SectionHead>
            {incomeChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={incomeChart} barGap={4}>
                  <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmt$(v)} tick={{ fill: C.dim, fontSize: 9 }} axisLine={false} tickLine={false} width={60} />
                  <DT formatter={(v, n) => [fmt$(v), n === "revenue" ? "Revenue" : "Net Income"]} />
                  <Bar dataKey="revenue" fill={`${C.blue}55`} radius={[2,2,0,0]} name="revenue" />
                  <Bar dataKey="netIncome" radius={[2,2,0,0]} name="netIncome">
                    {incomeChart.map((d, i) => <Cell key={i} fill={d.netIncome >= 0 ? `${C.green}99` : `${C.red}99`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ color: C.dim, fontSize: 12, padding: 20, textAlign: "center" }}>No income data</div>}
          </Card>

          {/* Income statement table */}
          <Card>
            <SectionHead>Income Statement</SectionHead>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ color: C.dim, textAlign: "left", padding: "5px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, letterSpacing: "0.06em" }}>METRIC</th>
                    {incomeData.slice(0,5).map(s => (
                      <th key={s.endDate?.fmt} style={{ color: C.dim, textAlign: "right", padding: "5px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{s.endDate?.fmt}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Revenue",        s => s.totalRevenue?.raw],
                    ["Gross Profit",   s => s.grossProfit?.raw],
                    ["EBIT",           s => s.ebit?.raw],
                    ["EBITDA",         s => (s.ebit?.raw ?? 0) + (s.depreciationAndAmortization?.raw ?? 0)],
                    ["Net Income",     s => s.netIncome?.raw],
                    ["EPS (Basic)",    s => s.basicEPS?.raw],
                    ["EPS (Diluted)",  s => s.dilutedEPS?.raw],
                    ["R&D Expense",    s => s.researchDevelopment?.raw],
                    ["SG&A",           s => s.sellingGeneralAdministrative?.raw],
                    ["Interest Exp",   s => s.interestExpense?.raw],
                    ["Income Tax",     s => s.incomeTaxExpense?.raw],
                  ].map(([label, fn]) => (
                    <tr key={label} style={{ transition: "background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ color: C.dim, padding: "7px 8px", borderBottom: `1px solid ${C.border}22` }}>{label}</td>
                      {incomeData.slice(0,5).map((s, i) => {
                        const v = fn(s);
                        return (
                          <td key={i} style={{ color: v == null ? C.dim : v >= 0 ? C.text : C.red, textAlign: "right", padding: "7px 8px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace" }}>
                            {v == null ? "—" : label.includes("EPS") ? `$${fmtN(v)}` : fmt$(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {view === "balance" && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <SectionHead>Assets vs Debt vs Equity</SectionHead>
            {bsChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={bsChart}>
                  <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmt$(v)} tick={{ fill: C.dim, fontSize: 9 }} axisLine={false} tickLine={false} width={60} />
                  <DT formatter={v => [fmt$(v)]} />
                  <Line type="monotone" dataKey="totalAssets" stroke={C.blue}   strokeWidth={2} dot={false} name="Total Assets" />
                  <Line type="monotone" dataKey="totalDebt"   stroke={C.red}    strokeWidth={2} dot={false} name="Total Debt" />
                  <Line type="monotone" dataKey="equity"      stroke={C.green}  strokeWidth={2} dot={false} name="Equity" />
                  <Line type="monotone" dataKey="cash"        stroke={C.yellow} strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Cash" />
                </LineChart>
              </ResponsiveContainer>
            ) : <div style={{ color: C.dim, fontSize: 12, padding: 20, textAlign: "center" }}>No balance sheet data</div>}
          </Card>
          <Card>
            <SectionHead>Balance Sheet</SectionHead>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ color: C.dim, textAlign: "left", padding: "5px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>METRIC</th>
                    {bsData.slice(0,5).map(s => (
                      <th key={s.endDate?.fmt} style={{ color: C.dim, textAlign: "right", padding: "5px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{s.endDate?.fmt}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Total Assets",        s => s.totalAssets?.raw],
                    ["Cash & Equiv.",       s => s.cash?.raw],
                    ["Short-term Invest.",  s => s.shortTermInvestments?.raw],
                    ["Net Receivables",     s => s.netReceivables?.raw],
                    ["Inventory",           s => s.inventory?.raw],
                    ["Total Liabilities",   s => s.totalLiab?.raw],
                    ["Short-term Debt",     s => s.shortLongTermDebt?.raw],
                    ["Long-term Debt",      s => s.longTermDebt?.raw],
                    ["Total Debt",          s => s.totalDebt?.raw],
                    ["Stockholder Equity",  s => s.totalStockholderEquity?.raw],
                    ["Retained Earnings",   s => s.retainedEarnings?.raw],
                  ].map(([label, fn]) => (
                    <tr key={label}
                      onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ color: C.dim, padding: "7px 8px", borderBottom: `1px solid ${C.border}22` }}>{label}</td>
                      {bsData.slice(0,5).map((s, i) => {
                        const v = fn(s);
                        return (
                          <td key={i} style={{ color: C.text, textAlign: "right", padding: "7px 8px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace" }}>
                            {v == null ? "—" : fmt$(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {view === "cashflow" && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <SectionHead>Cash Flow</SectionHead>
            {cfChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={cfChart} barGap={4}>
                  <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmt$(v)} tick={{ fill: C.dim, fontSize: 9 }} axisLine={false} tickLine={false} width={60} />
                  <ReferenceLine y={0} stroke={C.border} />
                  <DT formatter={v => [fmt$(v)]} />
                  <Bar dataKey="operatingCF" name="Operating CF" radius={[2,2,0,0]}>
                    {cfChart.map((d, i) => <Cell key={i} fill={d.operatingCF >= 0 ? `${C.green}99` : `${C.red}99`} />)}
                  </Bar>
                  <Bar dataKey="freeCF" name="Free CF" radius={[2,2,0,0]}>
                    {cfChart.map((d, i) => <Cell key={i} fill={d.freeCF >= 0 ? `${C.blue}99` : `${C.red}66`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div style={{ color: C.dim, fontSize: 12, padding: 20, textAlign: "center" }}>No cash flow data</div>}
          </Card>
          <Card>
            <SectionHead>Cash Flow Statement</SectionHead>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ color: C.dim, textAlign: "left", padding: "5px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>METRIC</th>
                    {cfData.slice(0,5).map(s => (
                      <th key={s.endDate?.fmt} style={{ color: C.dim, textAlign: "right", padding: "5px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{s.endDate?.fmt}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Operating Cash Flow", s => s.totalCashFromOperatingActivities?.raw],
                    ["Capital Expenditures",s => s.capitalExpenditures?.raw],
                    ["Free Cash Flow",      s => (s.totalCashFromOperatingActivities?.raw ?? 0) + (s.capitalExpenditures?.raw ?? 0)],
                    ["Investing Activities",s => s.totalCashflowsFromInvestingActivities?.raw],
                    ["Financing Activities",s => s.totalCashFromFinancingActivities?.raw],
                    ["Net Change in Cash",  s => s.changeInCash?.raw],
                    ["D&A",                 s => s.depreciationAndAmortization?.raw],
                    ["Stock Comp",          s => s.stockBasedCompensation?.raw],
                    ["Dividends Paid",      s => s.dividendsPaid?.raw],
                    ["Share Repurchases",   s => s.repurchaseOfStock?.raw],
                  ].map(([label, fn]) => (
                    <tr key={label}
                      onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <td style={{ color: C.dim, padding: "7px 8px", borderBottom: `1px solid ${C.border}22` }}>{label}</td>
                      {cfData.slice(0,5).map((s, i) => {
                        const v = fn(s);
                        return (
                          <td key={i} style={{ color: v == null ? C.dim : v >= 0 ? C.text : C.red, textAlign: "right", padding: "7px 8px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace" }}>
                            {v == null ? "—" : fmt$(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: EARNINGS
// ─────────────────────────────────────────────────────────────────────────────
function TabEarnings({ summary }) {
  const eq = summary?.earnings?.earningsChart ?? {};
  const quarterly = eq.quarterly ?? [];
  const trend = summary?.earningsTrend?.trend ?? [];

  // Countdown to next earnings
  const nextDate = eq.earningsDate?.[0]?.raw;
  const daysTo   = nextDate ? Math.ceil((nextDate * 1000 - Date.now()) / 86400000) : null;

  const epsChart = [...quarterly].reverse().map(q => ({
    date:     q.date,
    estimate: q.estimate?.raw,
    actual:   q.actual?.raw,
    surprise: q.actual?.raw != null && q.estimate?.raw != null
      ? ((q.actual.raw - q.estimate.raw) / Math.abs(q.estimate.raw)) * 100 : null,
  }));

  return (
    <div>
      {/* Next earnings banner */}
      {daysTo != null && (
        <Card style={{ marginBottom: 16, borderColor: daysTo < 14 ? `${C.yellow}66` : C.border }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ color: C.dim, fontSize: 10, letterSpacing: "0.08em" }}>NEXT EARNINGS</div>
              <div style={{ color: daysTo < 14 ? C.yellow : C.text, fontSize: 18, fontWeight: 700, fontFamily: "monospace" }}>
                {new Date(nextDate * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
            <div style={{ padding: "8px 20px", background: daysTo < 14 ? `${C.yellow}15` : `${C.green}10`, border: `1px solid ${daysTo < 14 ? C.yellow+"44" : C.green+"33"}`, borderRadius: 6 }}>
              <div style={{ color: C.dim, fontSize: 10 }}>DAYS AWAY</div>
              <div style={{ color: daysTo < 14 ? C.yellow : C.green, fontSize: 22, fontWeight: 800, fontFamily: "monospace", textAlign: "center" }}>{daysTo}</div>
            </div>
            {eq.currentQuarterEstimate && (
              <div>
                <div style={{ color: C.dim, fontSize: 10, letterSpacing: "0.08em" }}>EST EPS THIS QTR</div>
                <div style={{ color: C.blue, fontSize: 18, fontWeight: 700, fontFamily: "monospace" }}>
                  ${eq.currentQuarterEstimate.fmt}
                </div>
                <div style={{ color: C.dim, fontSize: 10 }}>{eq.currentQuarterEstimateDate} {eq.currentQuarterEstimateYear}</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* EPS chart */}
      {epsChart.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHead>EPS: Estimate vs Actual</SectionHead>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={epsChart} barGap={4}>
              <XAxis dataKey="date" tick={{ fill: C.dim, fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.dim, fontSize: 9 }} axisLine={false} tickLine={false} />
              <ReferenceLine y={0} stroke={C.border} />
              <DT formatter={(v, n) => [`$${fmtN(v)}`, n]} />
              <Bar dataKey="estimate" name="Estimate" fill={`${C.dim}55`} radius={[2,2,0,0]} />
              <Bar dataKey="actual"   name="Actual"   radius={[2,2,0,0]}>
                {epsChart.map((d, i) => <Cell key={i} fill={d.actual >= d.estimate ? `${C.green}cc` : `${C.red}cc`} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Earnings history table */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHead>Earnings History</SectionHead>
        {quarterly.length === 0
          ? <div style={{ color: C.dim, fontSize: 12, padding: 12 }}>No earnings history available</div>
          : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["QUARTER","EPS ESTIMATE","EPS ACTUAL","SURPRISE","SURPRISE %"].map(h => (
                  <th key={h} style={{ color: C.dim, textAlign: h === "QUARTER" ? "left" : "right", padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, letterSpacing: "0.06em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...quarterly].reverse().map((q, i) => {
                const surp   = q.actual?.raw != null && q.estimate?.raw != null ? q.actual.raw - q.estimate.raw : null;
                const surpPct = surp != null && q.estimate?.raw ? (surp / Math.abs(q.estimate.raw)) * 100 : null;
                const beat   = surp != null && surp >= 0;
                return (
                  <tr key={i} onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ color: C.text, padding: "8px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace", fontWeight: 600 }}>{q.date}</td>
                    <td style={{ color: C.dim,  padding: "8px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right", fontFamily: "monospace" }}>${fmtN(q.estimate?.raw)}</td>
                    <td style={{ color: C.text, padding: "8px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>${fmtN(q.actual?.raw)}</td>
                    <td style={{ color: surp == null ? C.dim : beat ? C.green : C.red, padding: "8px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right", fontFamily: "monospace" }}>
                      {surp == null ? "—" : `${beat ? "+" : ""}$${fmtN(surp)}`}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right" }}>
                      {surpPct == null ? "—" : (
                        <span style={{ color: beat ? C.green : C.red, fontFamily: "monospace", fontWeight: 700 }}>
                          {beat ? "▲" : "▼"} {Math.abs(surpPct).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Forward estimates */}
      {trend.length > 0 && (
        <Card>
          <SectionHead>Analyst Forward Estimates</SectionHead>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["PERIOD","EPS LOW","EPS AVG","EPS HIGH","REV LOW","REV AVG","REV HIGH","GROWTH"].map(h => (
                  <th key={h} style={{ color: C.dim, textAlign: h === "PERIOD" ? "left" : "right", padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trend.map((t, i) => (
                <tr key={i} onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ color: C.yellow, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontWeight: 600 }}>{t.period}</td>
                  <td style={{ color: C.dim,  padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right", fontFamily: "monospace" }}>${fmtN(t.epsLow?.raw)}</td>
                  <td style={{ color: C.text, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>${fmtN(t.epsAverage?.raw)}</td>
                  <td style={{ color: C.green,padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right", fontFamily: "monospace" }}>${fmtN(t.epsHigh?.raw)}</td>
                  <td style={{ color: C.dim,  padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right", fontFamily: "monospace" }}>{fmt$(t.revenueEstimate?.low?.raw)}</td>
                  <td style={{ color: C.text, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right", fontFamily: "monospace", fontWeight: 600 }}>{fmt$(t.revenueEstimate?.avg?.raw)}</td>
                  <td style={{ color: C.green,padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right", fontFamily: "monospace" }}>{fmt$(t.revenueEstimate?.high?.raw)}</td>
                  <td style={{ color: (t.earningsEstimateGrowth?.raw ?? 0) >= 0 ? C.green : C.red, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>
                    {fmtPc((t.earningsEstimateGrowth?.raw ?? 0) * 100)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: ANALYSTS
// ─────────────────────────────────────────────────────────────────────────────
function TabAnalysts({ summary, quote }) {
  const fd  = summary?.financialData      ?? {};
  const rt  = summary?.recommendationTrend?.trend ?? [];
  const upgrades = summary?.upgradeDowngradeHistory?.history ?? [];

  const ratingMap = { strongBuy: C.green, buy: "#4ade80", hold: C.yellow, sell: "#f97316", strongSell: C.red };
  const ratingKey = fd.recommendationKey?.toLowerCase() ?? "";
  const ratingColor = ratingMap[ratingKey.replace(" ","").replace("_","")] ?? C.dim;

  const upside = fd.targetMeanPrice?.raw && quote?.price
    ? ((fd.targetMeanPrice.raw - quote.price) / quote.price) * 100 : null;

  const latestTrend = rt[0] ?? {};

  return (
    <div>
      {/* Consensus card */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Consensus", value: (fd.recommendationKey ?? "—").toUpperCase().replace("_"," "), color: ratingColor },
          { label: "Price Target (Mean)", value: fd.targetMeanPrice?.raw ? `$${fmtN(fd.targetMeanPrice.raw)}` : "—", color: C.text },
          { label: "Price Target (High)", value: fd.targetHighPrice?.raw ? `$${fmtN(fd.targetHighPrice.raw)}` : "—", color: C.green },
          { label: "Price Target (Low)",  value: fd.targetLowPrice?.raw  ? `$${fmtN(fd.targetLowPrice.raw)}`  : "—", color: C.red },
          { label: "# Analysts",          value: fd.numberOfAnalystOpinions?.raw ?? "—", color: C.text },
          { label: "Upside to Target",    value: upside != null ? `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%` : "—", color: upside == null ? C.dim : upside >= 0 ? C.green : C.red },
        ].map(({ label, value, color }) => (
          <Card key={label} style={{ textAlign: "center" }}>
            <div style={{ color: C.dim, fontSize: 9, letterSpacing: "0.08em", marginBottom: 6 }}>{label}</div>
            <div style={{ color, fontSize: 16, fontWeight: 700, fontFamily: "monospace" }}>{value}</div>
          </Card>
        ))}
      </div>

      {/* Rating distribution */}
      {latestTrend.strongBuy != null && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHead>Rating Distribution (last period)</SectionHead>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", height: 80 }}>
            {[
              ["Strong Buy", latestTrend.strongBuy,  C.green],
              ["Buy",        latestTrend.buy,         "#4ade80"],
              ["Hold",       latestTrend.hold,        C.yellow],
              ["Sell",       latestTrend.sell,        "#f97316"],
              ["Strong Sell",latestTrend.strongSell,  C.red],
            ].map(([label, count, color]) => {
              const max = Math.max(latestTrend.strongBuy, latestTrend.buy, latestTrend.hold, latestTrend.sell, latestTrend.strongSell, 1);
              const h   = ((count ?? 0) / max) * 60;
              return (
                <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ color, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>{count ?? 0}</div>
                  <div style={{ width: "100%", height: h, background: color + "99", borderRadius: "3px 3px 0 0", minHeight: 4 }} />
                  <div style={{ color: C.dim, fontSize: 9, textAlign: "center" }}>{label}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Upgrades/Downgrades */}
      {upgrades.length > 0 && (
        <Card>
          <SectionHead>Recent Upgrades & Downgrades</SectionHead>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["DATE","FIRM","ACTION","FROM","TO"].map(h => (
                  <th key={h} style={{ color: C.dim, textAlign: "left", padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {upgrades.slice(0, 30).map((u, i) => {
                const isUp = ["upgraded","initiated","reiterated","raised"].some(w => u.action?.toLowerCase().includes(w));
                return (
                  <tr key={i} onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ color: C.dim, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace" }}>
                      {u.epochGradeDate ? new Date(u.epochGradeDate * 1000).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ color: C.text,   padding: "7px 10px", borderBottom: `1px solid ${C.border}22` }}>{u.firm ?? "—"}</td>
                    <td style={{ color: isUp ? C.green : C.red, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontWeight: 700 }}>{u.action ?? "—"}</td>
                    <td style={{ color: C.dim,   padding: "7px 10px", borderBottom: `1px solid ${C.border}22` }}>{u.fromGrade || "—"}</td>
                    <td style={{ color: C.text,  padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontWeight: 600 }}>{u.toGrade || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: OPTIONS
// ─────────────────────────────────────────────────────────────────────────────
function TabOptions({ ticker, quote }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [expiry,  setExpiry]  = useState(null);
  const [side,    setSide]    = useState("calls");
  const [error,   setError]   = useState(null);

  const load = useCallback(async (exp) => {
    setLoading(true); setError(null);
    try {
      const d = await fetchOptions(ticker, exp);
      setData(d);
      if (!exp && d?.expirationDates?.[0]) setExpiry(d.expirationDates[0]);
    } catch(e) { setError(e.message); }
    setLoading(false);
  }, [ticker]);

  useEffect(() => { load(); }, [load]);

  const chain    = data?.options?.[0] ?? {};
  const calls    = chain.calls ?? [];
  const puts     = chain.puts  ?? [];
  const current  = side === "calls" ? calls : puts;
  const price    = quote?.price ?? 0;

  // Max pain: strike where total options value is minimized
  const maxPain = useMemo(() => {
    if (!calls.length && !puts.length) return null;
    const strikes = [...new Set([...calls, ...puts].map(o => o.strike))];
    let minLoss = Infinity, maxPainStrike = 0;
    for (const s of strikes) {
      const callLoss = calls.reduce((acc, c) => acc + Math.max(0, s - c.strike) * (c.openInterest ?? 0), 0);
      const putLoss  = puts.reduce((acc, p)  => acc + Math.max(0, p.strike - s) * (p.openInterest ?? 0), 0);
      const total = callLoss + putLoss;
      if (total < minLoss) { minLoss = total; maxPainStrike = s; }
    }
    return maxPainStrike;
  }, [calls, puts]);

  const totalCallOI = calls.reduce((s, c) => s + (c.openInterest ?? 0), 0);
  const totalPutOI  = puts.reduce((s, p)  => s + (p.openInterest ?? 0), 0);
  const pcRatio     = totalCallOI ? (totalPutOI / totalCallOI).toFixed(2) : "—";

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["calls","puts"].map(s => (
            <button key={s} onClick={() => setSide(s)} style={{
              background: side === s ? `${s === "calls" ? C.green : C.red}15` : C.bg,
              border: `1px solid ${side === s ? (s === "calls" ? C.green : C.red)+"44" : C.border}`,
              color: side === s ? (s === "calls" ? C.green : C.red) : C.dim,
              padding: "5px 16px", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }}>{s.toUpperCase()}</button>
          ))}
        </div>
        {data?.expirationDates?.length > 0 && (
          <select value={expiry ?? ""} onChange={e => { setExpiry(+e.target.value); load(+e.target.value); }}
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, padding: "5px 10px", borderRadius: 4, fontSize: 11, fontFamily: "inherit", cursor: "pointer" }}>
            {data.expirationDates.map(d => (
              <option key={d} value={d}>{new Date(d * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</option>
            ))}
          </select>
        )}
        {loading && <Spinner />}
        {/* Stats */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 20 }}>
          {[
            ["P/C Ratio", pcRatio, pcRatio > 1 ? C.red : C.green],
            ["Max Pain",  maxPain ? `$${maxPain}` : "—", C.yellow],
            ["Call OI",   fmtV(totalCallOI), C.green],
            ["Put OI",    fmtV(totalPutOI),  C.red],
          ].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ color: C.dim, fontSize: 9 }}>{l}</div>
              <div style={{ color: c, fontSize: 13, fontFamily: "monospace", fontWeight: 700 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {error && <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>⚠ {error} — options data requires Yahoo Finance proxy</div>}

      {/* Options chain table */}
      <Card style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead>
            <tr style={{ background: C.bg2 }}>
              {["ITM","STRIKE","LAST","BID","ASK","VOLUME","OI","IV","DELTA","CHANGE"].map(h => (
                <th key={h} style={{ color: C.dim, textAlign: h === "STRIKE" ? "center" : "right", padding: "6px 8px", borderBottom: `1px solid ${C.border}`, fontWeight: 700, letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {current.length === 0 && !loading ? (
              <tr><td colSpan={10} style={{ color: C.dim, padding: "24px 10px", textAlign: "center" }}>No options data — options chain requires a proxy server with Yahoo Finance access</td></tr>
            ) : current.map((o, i) => {
              const itm = side === "calls" ? o.strike <= price : o.strike >= price;
              return (
                <tr key={i} style={{ background: itm ? `${side === "calls" ? C.green : C.red}08` : "transparent" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#ffffff08"}
                  onMouseLeave={e => e.currentTarget.style.background = itm ? `${side === "calls" ? C.green : C.red}08` : "transparent"}>
                  <td style={{ color: itm ? (side === "calls" ? C.green : C.red) : C.dim, padding: "6px 8px", borderBottom: `1px solid ${C.border}11`, fontWeight: 700, textAlign: "right" }}>{itm ? "ITM" : ""}</td>
                  <td style={{ color: itm ? C.white : C.text, padding: "6px 8px", borderBottom: `1px solid ${C.border}11`, fontFamily: "monospace", fontWeight: 700, textAlign: "center" }}>${o.strike}</td>
                  <td style={{ color: C.text, padding: "6px 8px", borderBottom: `1px solid ${C.border}11`, fontFamily: "monospace", textAlign: "right" }}>${fmtN(o.lastPrice)}</td>
                  <td style={{ color: C.dim,  padding: "6px 8px", borderBottom: `1px solid ${C.border}11`, fontFamily: "monospace", textAlign: "right" }}>${fmtN(o.bid)}</td>
                  <td style={{ color: C.dim,  padding: "6px 8px", borderBottom: `1px solid ${C.border}11`, fontFamily: "monospace", textAlign: "right" }}>${fmtN(o.ask)}</td>
                  <td style={{ color: C.blue, padding: "6px 8px", borderBottom: `1px solid ${C.border}11`, fontFamily: "monospace", textAlign: "right" }}>{fmtV(o.volume)}</td>
                  <td style={{ color: C.text, padding: "6px 8px", borderBottom: `1px solid ${C.border}11`, fontFamily: "monospace", textAlign: "right" }}>{fmtV(o.openInterest)}</td>
                  <td style={{ color: C.yellow, padding: "6px 8px", borderBottom: `1px solid ${C.border}11`, fontFamily: "monospace", textAlign: "right" }}>{o.impliedVolatility ? fmtPc((o.impliedVolatility * 100)) : "—"}</td>
                  <td style={{ color: C.purple, padding: "6px 8px", borderBottom: `1px solid ${C.border}11`, fontFamily: "monospace", textAlign: "right" }}>—</td>
                  <td style={{ color: (o.change ?? 0) >= 0 ? C.green : C.red, padding: "6px 8px", borderBottom: `1px solid ${C.border}11`, fontFamily: "monospace", textAlign: "right", fontWeight: 600 }}>
                    {o.change != null ? `${o.change >= 0 ? "+" : ""}${fmtN(o.change)}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: INSIDER & INSTITUTIONAL
// ─────────────────────────────────────────────────────────────────────────────
function TabInsider({ ticker, summary }) {
  const [form4,    setForm4]    = useState([]);
  const [inst,     setInst]     = useState([]);
  const [loading,  setLoading]  = useState(false);

  // Yahoo institutional holders
  const institutionalHolders = summary?.institutionOwnership?.ownershipList ?? [];
  const majorHolders         = summary?.majorHoldersBreakdown ?? {};
  const insiderHolders       = summary?.insiderHolders?.holders ?? [];
  const insiderTx            = summary?.insiderTransactions?.transactions ?? [];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const filings = await fetchFilings(ticker, "4", 20);
      setForm4(filings);
      setLoading(false);
    };
    load();
  }, [ticker]);

  return (
    <div>
      {/* Major holders summary */}
      {majorHolders.insidersPercentHeld && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            ["Insiders Hold",       fmtPc((majorHolders.insidersPercentHeld?.raw ?? 0) * 100), C.yellow],
            ["Institutions Hold",   fmtPc((majorHolders.institutionsPercentHeld?.raw ?? 0) * 100), C.blue],
            ["Float Inst. Hold",    fmtPc((majorHolders.institutionsFloatPercentHeld?.raw ?? 0) * 100), C.purple],
            ["# Institutions",      majorHolders.institutionsCount?.raw?.toLocaleString() ?? "—", C.text],
          ].map(([l, v, c]) => (
            <Card key={l} style={{ textAlign: "center" }}>
              <div style={{ color: C.dim, fontSize: 9, letterSpacing: "0.08em", marginBottom: 6 }}>{l}</div>
              <div style={{ color: c, fontSize: 16, fontWeight: 700, fontFamily: "monospace" }}>{v}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Insider transactions (Yahoo) */}
      {insiderTx.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHead>Insider Transactions (Yahoo Finance)</SectionHead>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["DATE","INSIDER","TITLE","TRANSACTION","SHARES","VALUE"].map(h => (
                  <th key={h} style={{ color: C.dim, textAlign: "left", padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {insiderTx.slice(0, 20).map((tx, i) => {
                const isBuy = tx.transactionDescription?.toLowerCase().includes("purchase") ||
                              tx.transactionDescription?.toLowerCase().includes("buy");
                return (
                  <tr key={i} onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ color: C.dim,  padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace" }}>
                      {tx.startDate?.fmt ?? "—"}
                    </td>
                    <td style={{ color: C.text, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontWeight: 600 }}>{tx.filerName ?? "—"}</td>
                    <td style={{ color: C.dim,  padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontSize: 10 }}>{tx.filerRelation ?? "—"}</td>
                    <td style={{ color: isBuy ? C.green : C.red, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontWeight: 700 }}>
                      {isBuy ? "▲ BUY" : "▼ SELL"} {tx.transactionDescription ?? ""}
                    </td>
                    <td style={{ color: C.text, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace", textAlign: "right" }}>
                      {tx.shares?.raw?.toLocaleString() ?? "—"}
                    </td>
                    <td style={{ color: isBuy ? C.green : C.yellow, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace", textAlign: "right" }}>
                      {fmt$(tx.value?.raw)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Insider holders */}
      {insiderHolders.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHead>Insider Holdings</SectionHead>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["INSIDER","RELATION","DATE","SHARES","LATEST ACTIVITY"].map(h => (
                  <th key={h} style={{ color: C.dim, textAlign: "left", padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {insiderHolders.slice(0, 15).map((h, i) => (
                <tr key={i} onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ color: C.text, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontWeight: 600 }}>{h.name ?? "—"}</td>
                  <td style={{ color: C.dim,  padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontSize: 10 }}>{h.relation ?? "—"}</td>
                  <td style={{ color: C.dim,  padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace" }}>{h.positionDirectDate?.fmt ?? "—"}</td>
                  <td style={{ color: C.blue, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace", textAlign: "right" }}>{h.position?.raw?.toLocaleString() ?? "—"}</td>
                  <td style={{ color: C.dim,  padding: "7px 10px", borderBottom: `1px solid ${C.border}22` }}>{h.latestTransType ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Top institutional holders */}
      {institutionalHolders.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionHead>Top Institutional Holders (13F)</SectionHead>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["INSTITUTION","DATE","SHARES","VALUE","%"].map(h => (
                  <th key={h} style={{ color: C.dim, textAlign: h === "INSTITUTION" ? "left" : "right", padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {institutionalHolders.slice(0, 20).map((h, i) => (
                <tr key={i} onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ color: C.text, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontWeight: 500 }}>{h.organization ?? "—"}</td>
                  <td style={{ color: C.dim,  padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace", textAlign: "right" }}>{h.reportDate?.fmt ?? "—"}</td>
                  <td style={{ color: C.blue, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace", textAlign: "right" }}>{h.position?.raw?.toLocaleString() ?? "—"}</td>
                  <td style={{ color: C.text, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace", textAlign: "right" }}>{fmt$(h.value?.raw)}</td>
                  <td style={{ color: C.yellow, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace", textAlign: "right" }}>{fmtPc((h.pctHeld?.raw ?? 0) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* SEC Form 4 direct link */}
      <Card>
        <SectionHead>SEC Form 4 — Direct from EDGAR</SectionHead>
        <div style={{ marginBottom: 10 }}>
          <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=4&dateb=&owner=include&count=40&search_text=`}
            target="_blank" rel="noreferrer"
            style={{ color: C.blue, fontSize: 12, textDecoration: "none" }}>
            View all Form 4 insider transactions for {ticker} on SEC EDGAR →
          </a>
        </div>
        {loading ? <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Spinner /><span style={{ color: C.dim, fontSize: 12 }}>Loading EDGAR filings…</span></div>
        : form4.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                {["FILED","COMPANY","FORM","LINK"].map(h => (
                  <th key={h} style={{ color: C.dim, textAlign: "left", padding: "5px 10px", borderBottom: `1px solid ${C.border}`, fontWeight: 600, fontSize: 10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form4.slice(0, 15).map((f, i) => (
                <tr key={i} onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ color: C.dim,  padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace" }}>{f._source?.file_date ?? "—"}</td>
                  <td style={{ color: C.text, padding: "7px 10px", borderBottom: `1px solid ${C.border}22` }}>{f._source?.entity_name ?? "—"}</td>
                  <td style={{ color: C.yellow, padding: "7px 10px", borderBottom: `1px solid ${C.border}22`, fontFamily: "monospace" }}>Form 4</td>
                  <td style={{ padding: "7px 10px", borderBottom: `1px solid ${C.border}22` }}>
                    <a href={`https://www.sec.gov/Archives/edgar/data/${f._source?.entity_id ?? ""}/${f._source?.file_date?.replace(/-/g,"")}/${f._id}`}
                      target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 11 }}>View →</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: C.dim, fontSize: 12 }}>No Form 4 results from EDGAR search. Use the link above to browse directly.</div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: FILINGS
// ─────────────────────────────────────────────────────────────────────────────
function TabFilings({ ticker }) {
  const [filings,  setFilings]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [filter,   setFilter]   = useState("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await fetchFilings(ticker, "10-K,10-Q,8-K,DEF%2014A,S-1,SC%2013G,SC%2013D", 50);
      setFilings(data);
      setLoading(false);
    };
    load();
  }, [ticker]);

  const types     = ["all", "10-K", "10-Q", "8-K", "DEF 14A", "SC 13G"];
  const displayed = filter === "all" ? filings : filings.filter(f => f._source?.file_type?.includes(filter));
  const formColor = { "10-K": C.green, "10-Q": C.blue, "8-K": C.yellow, "DEF 14A": C.purple, "SC 13G": C.dim, "SC 13D": C.red };

  return (
    <div>
      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            background: filter === t ? `${C.green}15` : C.bg,
            border: `1px solid ${filter === t ? C.green+"44" : C.border}`,
            color: filter === t ? C.green : C.dim,
            padding: "4px 12px", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
          }}>{t}</button>
        ))}
        <span style={{ color: C.dim, fontSize: 10, marginLeft: "auto" }}>
          {loading ? <Spinner /> : `${displayed.length} filings`}
        </span>
      </div>

      {/* Filing guide */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHead>What Each Filing Means</SectionHead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "4px 20px" }}>
          {[
            ["10-K",    "Annual report. Full financials, risk factors, MD&A, auditor sign-off."],
            ["10-Q",    "Quarterly report. Unaudited financials, material changes."],
            ["8-K",     "Material event. Earnings, M&A, leadership change, legal issues."],
            ["DEF 14A", "Proxy statement. Exec pay, board composition, shareholder votes."],
            ["SC 13G",  "Passive stake >5% disclosed by institutions (Vanguard, BlackRock)."],
            ["SC 13D",  "Active stake >5% — investor may seek board influence."],
            ["Form 4",  "Insider buy/sell within 2 days. CEO buys are bullish signal."],
            ["S-1",     "IPO registration statement. Full company history + financials."],
          ].map(([form, desc]) => (
            <div key={form} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}22` }}>
              <span style={{ color: formColor[form] ?? C.yellow, fontFamily: "monospace", fontWeight: 700, fontSize: 11 }}>{form}</span>
              <span style={{ color: C.dim, fontSize: 10, marginLeft: 8 }}>{desc}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Filings table */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "90px 120px 1fr 80px", padding: "6px 10px", background: C.bg2, borderRadius: "4px 4px 0 0", borderBottom: `1px solid ${C.border}` }}>
          {["FORM","DATE","DESCRIPTION","LINK"].map(h => (
            <span key={h} style={{ color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em" }}>{h}</span>
          ))}
        </div>
        {displayed.length === 0 && !loading ? (
          <div style={{ padding: "24px 10px", textAlign: "center", color: C.dim }}>
            <p style={{ marginBottom: 8 }}>No EDGAR results found for ticker "{ticker}"</p>
            <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=&dateb=&owner=include&count=40`}
              target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 12 }}>
              Search SEC EDGAR directly for {ticker} →
            </a>
          </div>
        ) : displayed.map((f, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "90px 120px 1fr 80px", padding: "9px 10px", borderBottom: `1px solid ${C.border}22`, transition: "background 0.1s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#ffffff05"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ color: formColor[f._source?.file_type] ?? C.yellow, fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>
              {f._source?.file_type ?? "—"}
            </span>
            <span style={{ color: C.dim, fontFamily: "monospace", fontSize: 11 }}>{f._source?.file_date ?? "—"}</span>
            <span style={{ color: C.text, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f._source?.display_names?.join(", ") ?? f._source?.entity_name ?? "—"}
            </span>
            <a href={`https://efts.sec.gov/LATEST/search-index?q=%22${f._id ?? ""}%22`}
              target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 11, textDecoration: "none" }}>View →</a>
          </div>
        ))}
        <div style={{ padding: "10px", borderTop: `1px solid ${C.border}` }}>
          <a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=&dateb=&owner=include&count=40`}
            target="_blank" rel="noreferrer" style={{ color: C.blue, fontSize: 11 }}>
            View all {ticker} filings on SEC EDGAR →
          </a>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TAB: AI DEEP DIVE
// ─────────────────────────────────────────────────────────────────────────────
function TabAI({ ticker, quote, summary }) {
  const [output,  setOutput]  = useState("");
  const [loading, setLoading] = useState(false);
  const [mode,    setMode]    = useState("full");

  const fd = summary?.financialData ?? {};
  const ks = summary?.defaultKeyStatistics ?? {};
  const ap = summary?.assetProfile ?? {};

  const PROMPTS = {
    full: `You are a senior Bloomberg analyst. Give a dense, no-fluff investment analysis of ${ticker} (${quote?.name ?? ticker}).

LIVE DATA:
Price: $${quote?.price} (${quote?.changePct >= 0 ? "+" : ""}${quote?.changePct}% today)
52W Range: $${quote?.low52}–$${quote?.high52}
Market Cap: ${fmt$(quote?.marketCap)} | EV: ${fmt$(ks.enterpriseValue?.raw)}
P/E: ${fmtN(ks.trailingEps?.raw ? quote?.price / ks.trailingEps.raw : null)} | P/B: ${fmtN(ks.priceToBook?.raw)} | P/S: ${fmtN(ks.priceToSalesTrailing12Months?.raw)}
Revenue: ${fmt$(fd.totalRevenue?.raw)} | Gross Margin: ${fmtP(fd.grossMargins?.raw)} | Net Margin: ${fmtP(fd.profitMargins?.raw)}
FCF: ${fmt$(fd.freeCashflow?.raw)} | ROE: ${fmtP(fd.returnOnEquity?.raw)} | Debt/Equity: ${fmtN(fd.debtToEquity?.raw)}
Revenue Growth: ${fmtPc((fd.revenueGrowth?.raw ?? 0)*100)} | Earnings Growth: ${fmtPc((fd.earningsGrowth?.raw ?? 0)*100)}
Sector: ${ap.sector} | Industry: ${ap.industry} | Employees: ${ap.fullTimeEmployees?.toLocaleString()}

Write EXACTLY in this format:
## BUSINESS MODEL
[2-3 sentences on how the company makes money, key segments, moat]

## BULL CASE
▸ [catalyst 1]
▸ [catalyst 2]
▸ [catalyst 3]

## BEAR CASE
▸ [risk 1]
▸ [risk 2]
▸ [risk 3]

## VALUATION
[Is it cheap or expensive vs peers and history? What is a fair value range?]

## KEY METRICS TO WATCH
[3 specific things to track quarterly]

## VERDICT
[One direct sentence: Buy / Hold / Avoid and why]`,

    moat: `Analyse the competitive moat of ${ticker} (${ap.industry}).
Cover: pricing power, switching costs, network effects, cost advantages, intangibles (brands, patents, licences).
Use specific examples. Be direct and honest if the moat is narrow or under threat.`,

    risks: `List the top 10 risks for investing in ${ticker} right now.
For each: rate severity (HIGH/MEDIUM/LOW), explain the mechanism, and what would signal the risk is materialising.
Include: macro risks, competitive threats, regulatory, balance sheet, management, geopolitical.`,

    compare: `Compare ${ticker} to its top 3 publicly traded competitors.
For each competitor: mention ticker, key similarity, key difference, relative valuation.
Who has the best risk/reward right now and why?`,
  };

  const run = async () => {
    const key = getGroqKey();
    if (!key) { setOutput("⚠ Set window.__GROQ_API_KEY = 'your-key' to enable AI analysis.\n\nGet a free key at console.groq.com — the free tier gives 14,400 requests/day."); return; }
    setLoading(true); setOutput("");
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: PROMPTS[mode] }],
          max_tokens: 1200,
          temperature: 0.35,
          stream: false,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message ?? `HTTP ${res.status}`); }
      const data = await res.json();
      setOutput(data.choices?.[0]?.message?.content ?? "No response.");
    } catch(e) { setOutput(`⚠ ${e.message}`); }
    setLoading(false);
  };

  const renderOutput = text => text.split("\n").map((line, i) => {
    const t = line.trim();
    if (!t) return <div key={i} style={{ height: 8 }} />;
    if (t.startsWith("## ")) return <div key={i} style={{ color: C.green, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", marginTop: 16, marginBottom: 6, borderBottom: `1px solid ${C.green}33`, paddingBottom: 4 }}>{t.replace("## ","")}</div>;
    if (t.startsWith("▸ ") || t.startsWith("• ")) return <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}><span style={{ color: C.green, flexShrink: 0 }}>▸</span><span style={{ color: C.text, fontSize: 12, lineHeight: 1.7 }}>{t.replace(/^[▸•]\s*/,"")}</span></div>;
    if (t.startsWith("⚠")) return <div key={i} style={{ color: C.red, fontSize: 12, padding: "10px 14px", background: `${C.red}10`, border: `1px solid ${C.red}33`, borderRadius: 4, marginTop: 8 }}>{t}</div>;
    return <p key={i} style={{ color: C.text, fontSize: 12, lineHeight: 1.8, margin: "0 0 2px" }}>{t}</p>;
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {[["full","Full Analysis"],["moat","Competitive Moat"],["risks","Top 10 Risks"],["compare","Peer Comparison"]].map(([k, label]) => (
          <button key={k} onClick={() => setMode(k)} style={{
            background: mode === k ? `${C.green}15` : C.bg,
            border: `1px solid ${mode === k ? C.green+"44" : C.border}`,
            color: mode === k ? C.green : C.dim,
            padding: "5px 14px", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
          }}>{label}</button>
        ))}
        <button onClick={run} disabled={loading}
          style={{ marginLeft: "auto", background: `${C.green}22`, border: `1px solid ${C.green}55`, color: C.green, padding: "6px 20px", borderRadius: 4, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          {loading ? <><Spinner /> Analysing…</> : `▶ ${output ? "Re-run" : "Run"} AI Analysis`}
        </button>
      </div>

      {output ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block" }} />
            <span style={{ color: C.green, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em" }}>GROQ AI — LLAMA 3.3 70B — {mode.toUpperCase()}</span>
          </div>
          <div>{renderOutput(output)}</div>
        </Card>
      ) : (
        <Card style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧠</div>
          <div style={{ color: C.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>AI Deep Dive — {ticker}</div>
          <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.8, maxWidth: 420, margin: "0 auto 20px" }}>
            Choose an analysis type above, then click Run.<br />
            Powered by Groq LLaMA 3.3 70B — fastest inference available, free tier.
          </div>
          <button onClick={run} style={{ background: `${C.green}22`, border: `1px solid ${C.green}55`, color: C.green, padding: "8px 28px", borderRadius: 4, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
            ▶ Run AI Analysis
          </button>
          <div style={{ color: C.dim, fontSize: 10, marginTop: 12 }}>
            window.__GROQ_API_KEY = "gsk_..." · Free at console.groq.com
          </div>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN EXPORT — CompanyDeepDive
// ─────────────────────────────────────────────────────────────────────────────
export default function CompanyDeepDive({ ticker, quote, onClose }) {
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [summary,   setSummary]   = useState({});
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);

  const TABS = ["OVERVIEW","CHART","FINANCIALS","EARNINGS","ANALYSTS","OPTIONS","INSIDER","FILINGS","AI DEEP DIVE"];

  useEffect(() => {
    if (!ticker) return;
    setSummary({});
    setError(null);

    const load = async () => {
      setLoading(true);
      try {
        // Fetch all modules in parallel batches (Yahoo limits module count)
        const [batch1, batch2, batch3] = await Promise.all([
          fetchSummary(ticker, ["price","summaryDetail","defaultKeyStatistics","financialData","assetProfile"]).catch(() => ({})),
          fetchSummary(ticker, ["earnings","earningsTrend","recommendationTrend","upgradeDowngradeHistory"]).catch(() => ({})),
          fetchSummary(ticker, [
            "incomeStatementHistory","incomeStatementHistoryQuarterly",
            "balanceSheetHistory","balanceSheetHistoryQuarterly",
            "cashflowStatementHistory","cashflowStatementHistoryQuarterly",
            "institutionOwnership","majorHoldersBreakdown",
            "insiderHolders","insiderTransactions",
          ]).catch(() => ({})),
        ]);
        setSummary({ ...batch1, ...batch2, ...batch3 });
      } catch(e) { setError(e.message); }
      setLoading(false);
    };

    load();
  }, [ticker]);

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, marginTop: 4, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 16, background: C.bg3, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: C.green, fontWeight: 800, fontSize: 18, fontFamily: "monospace", letterSpacing: "0.05em" }}>{ticker}</span>
            {quote && (
              <>
                <span style={{ color: C.white, fontWeight: 700, fontSize: 20, fontFamily: "monospace" }}>${quote.price}</span>
                <span style={{ color: quote.positive ? C.green : C.red, fontSize: 13, fontWeight: 600, background: quote.positive ? `${C.green}15` : `${C.red}15`, padding: "2px 8px", borderRadius: 3 }}>
                  {quote.positive ? "+" : ""}{quote.change} ({quote.positive ? "+" : ""}{quote.changePct?.toFixed(2)}%)
                </span>
              </>
            )}
            {loading && <Spinner />}
          </div>
          {summary?.assetProfile?.longName && (
            <div style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{summary.assetProfile.longName} · {summary.assetProfile.sector} · {summary.assetProfile.industry}</div>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: `1px solid ${C.border}`, color: C.dim, cursor: "pointer", borderRadius: 4, width: 28, height: 28, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        )}
        {error && <div style={{ width: "100%", color: C.red, fontSize: 11 }}>⚠ {error}</div>}
      </div>

      {/* Tab bar */}
      <div style={{ padding: "0 18px", background: C.bg3, borderBottom: `1px solid ${C.border}` }}>
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab content */}
      <div style={{ padding: "18px 18px", maxHeight: "70vh", overflowY: "auto" }}>
        {activeTab === "OVERVIEW"    && <TabOverview   ticker={ticker} quote={quote} summary={summary} />}
        {activeTab === "CHART"       && <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}><CandleChart ticker={ticker} height={300} volumeHeight={50} /></div>}
        {activeTab === "FINANCIALS"  && <TabFinancials summary={summary} />}
        {activeTab === "EARNINGS"    && <TabEarnings   summary={summary} />}
        {activeTab === "ANALYSTS"    && <TabAnalysts   summary={summary} quote={quote} />}
        {activeTab === "OPTIONS"     && <TabOptions    ticker={ticker}   quote={quote} />}
        {activeTab === "INSIDER"     && <TabInsider    ticker={ticker}   summary={summary} />}
        {activeTab === "FILINGS"     && <TabFilings    ticker={ticker} />}
        {activeTab === "AI DEEP DIVE"&& <TabAI         ticker={ticker}   quote={quote} summary={summary} />}
      </div>
    </div>
  );
}
