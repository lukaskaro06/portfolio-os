import { STOCK_UNIVERSE } from "../data/stocks";
import { getValuationScore, getValuationLabel } from "../utils/finance";
import { SectionLabel, ValuationBadge, WeightBar } from "./UI";

// ── ValuationScreen ────────────────────────────────────────
// Card grid showing composite valuation scores, multiples,
// and risk/return stats for every tracked security.
export default function ValuationScreen({ holdings }) {
  const inPortfolioTickers = new Set(holdings.map(h => h.ticker));

  return (
    <div>
      <SectionLabel>Valuation Screen — All Tracked Securities</SectionLabel>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, fontSize: 11 }}>
        {[
          { label: "UNDERVALUED", color: "#00ff9d" },
          { label: "FAIR VALUE",  color: "#ffd700" },
          { label: "OVERVALUED",  color: "#ff6b35" },
        ].map(({ label, color }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b949e" }}>
            <span style={{ width: 10, height: 10, background: color, borderRadius: 2, display: "inline-block" }} />
            {label}
          </span>
        ))}
        <span style={{ color: "#8b949e", marginLeft: "auto" }}>
          Score = composite of P/E · P/B · EV/EBITDA (higher = cheaper)
        </span>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 14,
      }}>
        {STOCK_UNIVERSE.map(stock => (
          <StockCard
            key={stock.ticker}
            stock={stock}
            inPortfolio={inPortfolioTickers.has(stock.ticker)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Individual Stock Card ──────────────────────────────────
function StockCard({ stock, inPortfolio }) {
  const score = getValuationScore(stock);
  const vl    = getValuationLabel(score);

  return (
    <div
      className="stat-card"
      style={{ borderColor: inPortfolio ? "#00ff9d33" : "#1c2333", position: "relative" }}
    >
      {inPortfolio && (
        <span style={{
          position: "absolute", top: 10, right: 10,
          fontSize: 9, color: "#00ff9d",
          letterSpacing: "0.08em", background: "#00ff9d12",
          border: "1px solid #00ff9d33", padding: "1px 6px", borderRadius: 3,
        }}>
          IN PORTFOLIO
        </span>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
        <span className="ticker-tag" style={{ fontSize: 13, padding: "3px 10px" }}>{stock.ticker}</span>
        <div>
          <div style={{ color: "#c9d1d9", fontSize: 12 }}>{stock.name}</div>
          <div style={{ color: "#8b949e", fontSize: 11 }}>{stock.sector}</div>
        </div>
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

      {/* Multiples */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { label: "P/E",      val: stock.pe,       thresh: 30 },
          { label: "P/B",      val: stock.pb,       thresh: 5  },
          { label: "EV/EBIT",  val: stock.evEbitda, thresh: 18 },
        ].map(({ label, val, thresh }) => (
          <div key={label} style={{
            background: "#161b22", borderRadius: 4,
            padding: "8px 10px", textAlign: "center",
          }}>
            <div style={{ color: "#8b949e", fontSize: 10, marginBottom: 4 }}>{label}</div>
            <div style={{ color: val > thresh ? "#ff6b35" : "#00ff9d", fontWeight: 600 }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        color: "#8b949e", fontSize: 11,
        borderTop: "1px solid #1c2333", paddingTop: 10,
      }}>
        <span>β <span style={{ color: "#c9d1d9" }}>{stock.beta}</span></span>
        <span>Ret <span style={{ color: "#00ff9d" }}>{stock.expectedReturn}%</span></span>
        <span>Vol <span style={{ color: "#ffd700" }}>{stock.volatility}%</span></span>
        <span>Div <span style={{ color: "#c084fc" }}>{stock.dividend}%</span></span>
      </div>
    </div>
  );
}
