export default function Header({ metrics, totalWeight, activeTab, setActiveTab }) {
  const tabs = [
    { id: "builder",    label: "// PORTFOLIO BUILDER" },
    { id: "valuation",  label: "// VALUATION SCREEN"  },
    { id: "optimizer",  label: "// OPTIMIZER"          },
    { id: "backtest",   label: "// BACKTEST"           },
    { id: "dcf",        label: "// DCF MODEL"          },
    { id: "montecarlo", label: "// MONTE CARLO"        },
    { id: "charts",     label: "// ANALYTICS"          },
    { id: "world",      label: "// WORLD MONITOR"      },
    { id: "news",       label: "// NEWS & SENTIMENT"   },  // NEW
  ];

  const weightOk    = Math.abs(totalWeight - 100) < 0.1;
  const weightOver  = totalWeight > 100.05;
  const weightColor = weightOk ? "#00ff9d" : weightOver ? "#ff6b35" : "#ffd700";

  return (
    <div style={{ borderBottom: "1px solid #1c2333", background: "#060a0f", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ padding: "0 24px" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", alignItems: "center", gap: 32, height: 52 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, background: "#00ff9d", borderRadius: "50%", boxShadow: "0 0 8px #00ff9d" }} className="blink" />
            <span style={{ color: "#00ff9d", fontWeight: 600, letterSpacing: "0.08em", fontSize: 14 }}>PORTFOLIO_OS</span>
            <span style={{ color: "#2d3748", fontSize: 11 }}>v2.5.0</span>
          </div>
          <div style={{ flex: 1 }} />
          {metrics && (
            <div style={{ display: "flex", gap: 24, fontSize: 12 }}>
              <KPI label="RET"    value={`${metrics.ret}%`}     color="#00ff9d" />
              <KPI label="VOL"    value={`${metrics.vol}%`}     color="#ffd700" />
              <KPI label="SHARPE" value={metrics.sharpe}         color={parseFloat(metrics.sharpe) >= 1 ? "#00ff9d" : "#ff6b35"} />
              <KPI label="β"      value={metrics.beta}           color="#c9d1d9" />
              <KPI label="DIV"    value={`${metrics.divYield}%`} color="#c084fc" />
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span style={{ color: weightColor, fontWeight: 600 }}>WT {totalWeight.toFixed(1)}%</span>
            {!weightOk && <span style={{ color: "#ff6b35", fontSize: 10 }}>{weightOver ? "⚠ OVER" : "⚠ UNDER"}</span>}
          </div>
        </div>
      </div>
      <div style={{ padding: "0 24px", background: "#0a0e14" }}>
        <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              cursor: "pointer", background: "transparent", border: "none",
              borderBottom: `2px solid ${activeTab === t.id ? "#00ff9d" : "transparent"}`,
              color: activeTab === t.id ? "#00ff9d" : "#8b949e",
              padding: "9px 14px", fontSize: 11, letterSpacing: "0.07em",
              fontFamily: "inherit", transition: "all 0.15s", whiteSpace: "nowrap",
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, color }) {
  return (
    <span style={{ color: "#8b949e" }}>
      {label} <span style={{ color, fontWeight: 600 }}>{value}</span>
    </span>
  );
}
