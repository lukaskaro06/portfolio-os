import { useState } from "react";
import { STOCK_UNIVERSE } from "../data/stocks";
import { getValuationScore, getValuationLabel } from "../utils/finance";
import { SectionLabel, MetricRow, ValuationBadge } from "./UI";

// ── PortfolioBuilder ───────────────────────────────────────
// Left panel: holdings table + weight editor
// Right panel: stock search + selected-stock detail card
export default function PortfolioBuilder({
  holdings, totalWeight, metrics,
  addStock, removeStock, updateWeight, equalWeight,
  onOptimize,
}) {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [search, setSearch]                 = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);

  const selected = holdings.find(h => h.ticker === selectedTicker) ||
                   STOCK_UNIVERSE.find(s => s.ticker === selectedTicker);

  const available = STOCK_UNIVERSE.filter(s =>
    !holdings.find(h => h.ticker === s.ticker) &&
    (s.ticker.toLowerCase().includes(search.toLowerCase()) ||
     s.name.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20 }}>

      {/* ── Left: holdings ──────────────────────────────── */}
      <div>
        <SectionLabel action={
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={equalWeight}>EQUAL WEIGHT</button>
            <button className="btn btn-primary" onClick={onOptimize}>AUTO-OPTIMIZE →</button>
          </div>
        }>
          Holdings ({holdings.length})
        </SectionLabel>

        <HoldingsTable
          holdings={holdings}
          selectedTicker={selectedTicker}
          onSelect={setSelectedTicker}
          onRemove={removeStock}
          onWeightChange={updateWeight}
          totalWeight={totalWeight}
        />

        {/* Selected-stock detail */}
        {selected && (
          <div className="fade-in stat-card" style={{ marginTop: 20, borderColor: "#00ff9d22" }}>
            <StockDetail stock={selected} />
          </div>
        )}
      </div>

      {/* ── Right: search + summary ──────────────────────── */}
      <div>
        <SectionLabel>Add Securities</SectionLabel>

        <input
          className="input-dark"
          style={{ width: "100%", marginBottom: 12 }}
          placeholder="Search ticker or company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div style={{
          background: "#0d1117",
          border: "1px solid #1c2333",
          borderRadius: 6,
          overflow: "hidden",
          maxHeight: 360,
          overflowY: "auto",
        }}>
          {available.length === 0 && (
            <p style={{ padding: 24, textAlign: "center", color: "#8b949e" }}>
              All matching stocks already in portfolio
            </p>
          )}
          {available.map(s => {
            const score = getValuationScore(s);
            const vl    = getValuationLabel(score);
            return (
              <div
                key={s.ticker}
                onClick={() => { addStock(s); setSelectedTicker(s.ticker); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px",
                  borderBottom: "1px solid #0d1117",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#0d111799"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span className="ticker-tag" style={{ minWidth: 46, textAlign: "center" }}>
                  {s.ticker}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#c9d1d9", fontSize: 12 }}>{s.name}</div>
                  <div style={{ color: "#8b949e", fontSize: 11 }}>{s.sector} · P/E {s.pe}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <ValuationBadge label={vl.label} color={vl.color} />
                  <div style={{ color: "#8b949e", fontSize: 11, marginTop: 3 }}>{score}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Custom stock entry toggle */}
        <button
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => setShowCustomForm(v => !v)}
        >
          {showCustomForm ? "▲ HIDE CUSTOM ENTRY" : "+ ADD CUSTOM STOCK"}
        </button>
        {showCustomForm && <CustomStockForm onAdd={s => { addStock(s); setShowCustomForm(false); }} />}

        {/* Portfolio summary */}
        {metrics && (
          <div className="stat-card" style={{ marginTop: 16 }}>
            <SectionLabel>Portfolio Summary</SectionLabel>
            <MetricRow label="Weighted Avg P/E"    value={metrics.avgPE} />
            <MetricRow label="Weighted Avg P/B"    value={metrics.avgPB} />
            <MetricRow label="Weighted EV/EBITDA"  value={metrics.avgEV} />
            <MetricRow label="Expected Return"     value={`${metrics.ret}%`}    valueColor="#00ff9d" />
            <MetricRow label="Portfolio Volatility" value={`${metrics.vol}%`}   valueColor="#ffd700" />
            <MetricRow label="Sharpe Ratio"        value={metrics.sharpe}        valueColor={parseFloat(metrics.sharpe) >= 1 ? "#00ff9d" : "#ff6b35"} />
            <MetricRow label="Portfolio Beta"      value={metrics.beta} />
            <MetricRow label="Avg Dividend Yield"  value={`${metrics.divYield}%`} valueColor="#c084fc" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Holdings Table ─────────────────────────────────────────
function HoldingsTable({ holdings, selectedTicker, onSelect, onRemove, onWeightChange, totalWeight }) {
  const cols = "80px 1fr 90px 60px 60px 72px 80px 70px";

  return (
    <div style={{ background: "#0d1117", border: "1px solid #1c2333", borderRadius: 6, overflow: "hidden" }}>
      {/* Column headers */}
      <div style={{
        display: "grid", gridTemplateColumns: cols,
        padding: "8px 14px",
        borderBottom: "1px solid #1c2333",
        color: "#8b949e", fontSize: 11, letterSpacing: "0.05em",
      }}>
        <span>TICKER</span><span>NAME</span><span>SECTOR</span>
        <span style={{ textAlign: "right" }}>P/E</span>
        <span style={{ textAlign: "right" }}>P/B</span>
        <span style={{ textAlign: "right" }}>EV/EBIT</span>
        <span style={{ textAlign: "right" }}>WEIGHT</span>
        <span />
      </div>

      {holdings.length === 0 && (
        <p style={{ padding: 40, textAlign: "center", color: "#8b949e" }}>
          No holdings — add stocks from the panel →
        </p>
      )}

      {holdings.map((h, i) => {
        const score = getValuationScore(h);
        const vl    = getValuationLabel(score);
        return (
          <div
            key={h.ticker}
            onClick={() => onSelect(h.ticker)}
            style={{
              display: "grid", gridTemplateColumns: cols,
              padding: "10px 14px",
              borderBottom: i < holdings.length - 1 ? "1px solid #0d1117" : "none",
              alignItems: "center",
              cursor: "pointer",
              background: selectedTicker === h.ticker ? "#00ff9d08" : "transparent",
              transition: "background 0.1s",
            }}
          >
            <span className="ticker-tag">{h.ticker}</span>
            <span style={{ color: "#c9d1d9", fontSize: 12, paddingRight: 8 }}>{h.name}</span>
            <span style={{ color: "#8b949e", fontSize: 11 }}>{h.sector}</span>
            <span style={{ textAlign: "right", color: h.pe   > 30 ? "#ff6b35" : "#00ff9d" }}>{h.pe}</span>
            <span style={{ textAlign: "right", color: h.pb   > 10 ? "#ff6b35" : "#00ff9d" }}>{h.pb}</span>
            <span style={{ textAlign: "right", color: h.evEbitda > 20 ? "#ffd700" : "#00ff9d" }}>{h.evEbitda}</span>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <input
                className="weight-input"
                type="number"
                value={h.weight}
                onChange={e => onWeightChange(h.ticker, e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-danger"
                style={{ padding: "3px 10px", fontSize: 11 }}
                onClick={e => { e.stopPropagation(); onRemove(h.ticker); }}
              >✕</button>
            </div>
          </div>
        );
      })}

      {/* Footer total */}
      <div style={{
        padding: "7px 14px",
        borderTop: "1px solid #1c2333",
        display: "flex", justifyContent: "flex-end",
        color: "#8b949e", fontSize: 11,
      }}>
        TOTAL WEIGHT:{" "}
        <span style={{
          color: Math.abs(totalWeight - 100) < 0.1 ? "#00ff9d" : "#ff6b35",
          fontWeight: 600, marginLeft: 6,
        }}>
          {totalWeight.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

// ── Stock Detail Card ──────────────────────────────────────
function StockDetail({ stock }) {
  const score = getValuationScore(stock);
  const vl    = getValuationLabel(score);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 15, color: "#00ff9d", fontWeight: 600 }}>{stock.ticker}</span>
        <span style={{ color: "#c9d1d9" }}>{stock.name}</span>
        <span style={{ color: "#8b949e", fontSize: 11 }}>· {stock.sector}</span>
        <div style={{ marginLeft: "auto" }}>
          <ValuationBadge label={vl.label} color={vl.color} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
        {[
          { label: "P/E",        val: stock.pe,              good: v => v < 20 },
          { label: "P/B",        val: stock.pb,              good: v => v < 5  },
          { label: "EV/EBITDA",  val: stock.evEbitda,        good: v => v < 15 },
          { label: "BETA",       val: stock.beta,            good: v => v < 1  },
          { label: "EXP. RET",   val: `${stock.expectedReturn}%`, good: () => true },
          { label: "DIV. YIELD", val: `${stock.dividend}%`,  good: v => parseFloat(v) > 0.5 },
        ].map(({ label, val, good }) => (
          <div key={label} style={{
            background: "#161b22", borderRadius: 4,
            padding: "10px", textAlign: "center",
          }}>
            <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 5 }}>{label}</div>
            <div style={{
              fontSize: 16, fontWeight: 600,
              color: good(typeof val === "string" ? parseFloat(val) : val) ? "#00ff9d" : "#ff6b35",
            }}>{val}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Custom Stock Form ──────────────────────────────────────
function CustomStockForm({ onAdd }) {
  const empty = {
    ticker: "", name: "", sector: "Technology",
    pe: "", pb: "", evEbitda: "",
    beta: "", expectedReturn: "", volatility: "", dividend: "",
  };
  const [form, setForm] = useState(empty);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = () => {
    if (!form.ticker || !form.name) return;
    onAdd({
      ...form,
      ticker:         form.ticker.toUpperCase(),
      pe:             parseFloat(form.pe)             || 20,
      pb:             parseFloat(form.pb)             || 3,
      evEbitda:       parseFloat(form.evEbitda)       || 12,
      beta:           parseFloat(form.beta)           || 1,
      expectedReturn: parseFloat(form.expectedReturn) || 10,
      volatility:     parseFloat(form.volatility)     || 20,
      dividend:       parseFloat(form.dividend)       || 0,
    });
    setForm(empty);
  };

  const SECTORS = ["Technology","Financials","Healthcare","Energy","Consumer Disc.","Staples","Utilities","Industrials","Materials","Real Estate","Communication"];
  const field = (label, key, placeholder, type = "text") => (
    <div>
      <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 4 }}>{label}</div>
      <input
        className="input-dark"
        style={{ width: "100%" }}
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
      />
    </div>
  );

  return (
    <div className="fade-in stat-card" style={{ marginTop: 10 }}>
      <div style={{ color: "#8b949e", fontSize: 11, marginBottom: 12, letterSpacing: "0.08em" }}>CUSTOM STOCK ENTRY</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {field("TICKER",     "ticker",         "AAPL")}
        {field("COMPANY",    "name",           "Apple Inc.")}
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 4 }}>SECTOR</div>
        <select className="input-dark" style={{ width: "100%" }} value={form.sector} onChange={e => set("sector", e.target.value)}>
          {SECTORS.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
        {field("P/E",            "pe",             "28.4", "number")}
        {field("P/B",            "pb",             "5.2",  "number")}
        {field("EV/EBITDA",      "evEbitda",       "16.0", "number")}
        {field("BETA",           "beta",           "1.0",  "number")}
        {field("EXP. RETURN %",  "expectedReturn", "11.0", "number")}
        {field("VOLATILITY %",   "volatility",     "22.0", "number")}
        {field("DIVIDEND %",     "dividend",       "1.5",  "number")}
      </div>
      <button
        className="btn btn-primary"
        style={{ width: "100%", marginTop: 14 }}
        onClick={handleSubmit}
      >
        + ADD TO PORTFOLIO
      </button>
    </div>
  );
}
