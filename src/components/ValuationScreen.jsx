import { useState } from "react";
import { STOCK_UNIVERSE } from "../data/stocks";
import { getValuationScore, getValuationLabel } from "../utils/finance";
import { SectionLabel, ValuationBadge, WeightBar, Spinner } from "./UI";

function fmt(n) {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export default function ValuationScreen({ holdings, stockData }) {
  const [view, setView] = useState("all"); // "all" | "portfolio"
  const inPortfolioTickers = new Set(holdings.map(h => h.ticker));

  const universe = view === "portfolio"
    ? STOCK_UNIVERSE.filter(s => inPortfolioTickers.has(s.ticker))
    : STOCK_UNIVERSE;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <SectionLabel>Valuation Screen</SectionLabel>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className={`btn ${view === "all" ? "btn-primary" : "btn-ghost"}`} style={{ fontSize: 11 }} onClick={() => setView("all")}>ALL SECURITIES</button>
          <button className={`btn ${view === "portfolio" ? "btn-primary" : "btn-ghost"}`} style={{ fontSize: 11 }} onClick={() => setView("portfolio")}>MY PORTFOLIO</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, fontSize: 11, flexWrap: "wrap" }}>
        {[{ label: "UNDERVALUED", color: "#00ff9d" }, { label: "FAIR VALUE", color: "#ffd700" }, { label: "OVERVALUED", color: "#ff6b35" }].map(({ label, color }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b949e" }}>
            <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: "inline-block" }} />
            {label}
          </span>
        ))}
        <span style={{ color: "#8b949e", marginLeft: "auto" }}>Score = composite of P/E · P/B · EV/EBITDA</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {universe.map(stock => (
          <StockCard
            key={stock.ticker}
            stock={stock}
            inPortfolio={inPortfolioTickers.has(stock.ticker)}
            quote={stockData?.getQuote(stock.ticker)}
            detail={stockData?.getDetail(stock.ticker)}
            onLoadDetail={() => stockData?.loadDetail(stock.ticker)}
          />
        ))}
      </div>
    </div>
  );
}

function StockCard({ stock, inPortfolio, quote, detail, onLoadDetail }) {
  const score = getValuationScore(stock);
  const vl    = getValuationLabel(score);
  const [expanded, setExpanded] = useState(false);

  const handleExpand = () => {
    if (!expanded && !detail) onLoadDetail();
    setExpanded(v => !v);
  };

  // Use live pe/pb if available from detail, else static
  const pe      = detail?.pe        ?? stock.pe;
  const pb      = detail?.pb        ?? stock.pb;
  const evEbitda = detail?.evEbitda ?? stock.evEbitda;

  return (
    <div className="stat-card" style={{ borderColor: inPortfolio ? "#00ff9d33" : "#1c2333", position: "relative", cursor: "pointer" }} onClick={handleExpand}>
      {inPortfolio && (
        <span style={{ position: "absolute", top: 10, right: 10, fontSize: 9, color: "#00ff9d", letterSpacing: "0.08em", background: "#00ff9d12", border: "1px solid #00ff9d33", padding: "1px 6px", borderRadius: 3 }}>
          IN PORTFOLIO
        </span>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span className="ticker-tag" style={{ fontSize: 13, padding: "3px 10px" }}>{stock.ticker}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#c9d1d9", fontSize: 12 }}>{stock.name}</div>
          <div style={{ color: "#8b949e", fontSize: 11 }}>{stock.sector}</div>
        </div>
        {/* Live price badge */}
        {quote && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>${quote.price}</div>
            <div style={{ color: quote.positive ? "#00ff9d" : "#ff6b35", fontSize: 11 }}>
              {quote.positive ? "+" : ""}{quote.changePct?.toFixed(2)}%
            </div>
          </div>
        )}
      </div>

      {/* Score bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "#8b949e", fontSize: 11 }}>VALUATION SCORE</span>
          <span style={{ color: vl.color, fontSize: 13, fontWeight: 600 }}>{score} / 100</span>
        </div>
        <WeightBar value={score} color={vl.color} />
        <div style={{ textAlign: "right", marginTop: 4 }}>
          <ValuationBadge label={vl.label} color={vl.color} />
        </div>
      </div>

      {/* Multiples — live if available */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { label: "P/E",     val: pe,       thresh: 30 },
          { label: "P/B",     val: pb,       thresh: 5  },
          { label: "EV/EBIT", val: evEbitda, thresh: 18 },
        ].map(({ label, val, thresh }) => (
          <div key={label} style={{ background: "#161b22", borderRadius: 4, padding: "8px 10px", textAlign: "center" }}>
            <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 4 }}>{label}</div>
            <div style={{ color: val > thresh ? "#ff6b35" : "#00ff9d", fontWeight: 600 }}>{val ?? "—"}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", color: "#8b949e", fontSize: 11, borderTop: "1px solid #1c2333", paddingTop: 10 }}>
        <span>β <span style={{ color: "#c9d1d9" }}>{detail?.beta?.toFixed(2) ?? stock.beta}</span></span>
        <span>Ret <span style={{ color: "#00ff9d" }}>{stock.expectedReturn}%</span></span>
        <span>Vol <span style={{ color: "#ffd700" }}>{stock.volatility}%</span></span>
        <span>Div <span style={{ color: "#c084fc" }}>{stock.dividend}%</span></span>
        <span style={{ color: "#8b949e44" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded live detail */}
      {expanded && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1c2333" }} onClick={e => e.stopPropagation()}>
          {!detail && <div style={{ display: "flex", gap: 8, alignItems: "center" }}><Spinner /><span style={{ color: "#8b949e", fontSize: 11 }}>Loading live data…</span></div>}
          {detail && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
              {[
                { label: "REVENUE",       val: fmt(detail.revenue) },
                { label: "REV GROWTH",    val: detail.revenueGrowth != null ? `${(detail.revenueGrowth * 100).toFixed(1)}%` : "—" },
                { label: "GROSS MARGIN",  val: detail.grossMargin  != null ? `${(detail.grossMargin  * 100).toFixed(1)}%` : "—" },
                { label: "PROFIT MARGIN", val: detail.profitMargin != null ? `${(detail.profitMargin * 100).toFixed(1)}%` : "—" },
                { label: "ROE",           val: detail.roe          != null ? `${(detail.roe          * 100).toFixed(1)}%` : "—" },
                { label: "ANALYST TARGET",val: detail.targetPrice  != null ? `$${detail.targetPrice.toFixed(2)}` : "—" },
                { label: "52W HIGH",      val: detail.high52       != null ? `$${detail.high52.toFixed(2)}` : "—" },
                { label: "52W LOW",       val: detail.low52        != null ? `$${detail.low52.toFixed(2)}`  : "—" },
                { label: "MARKET CAP",    val: fmt(detail.marketCap) },
                { label: "DCF UPSIDE",    val: detail.dcfUpside    != null ? `${detail.dcfUpside > 0 ? "+" : ""}${detail.dcfUpside}%` : "—" },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: "#0d1117", borderRadius: 4, padding: "7px 8px", textAlign: "center" }}>
                  <div style={{ color: "#8b949e44", fontSize: 9, marginBottom: 3, letterSpacing: "0.05em" }}>{label}</div>
                  <div style={{ color: "#c9d1d9", fontSize: 12, fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </div>
          )}
          {detail?.recommendation && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#8b949e", fontSize: 10 }}>ANALYST CONSENSUS:</span>
              <span style={{ color: "#00ff9d", fontWeight: 700, fontSize: 12 }}>{detail.recommendation.toUpperCase()}</span>
              {detail.buyPct != null && <span style={{ color: "#8b949e", fontSize: 10 }}>({detail.buyPct}% BUY · {detail.totalRecs} analysts)</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
