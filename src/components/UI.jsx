// ── Shared presentational components ──────────────────────

// Recharts tooltip styled to match the dark terminal theme
export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0d1117",
      border: "1px solid #00ff9d33",
      padding: "10px 14px",
      fontFamily: "monospace",
      fontSize: 12,
      borderRadius: 4,
    }}>
      {(label || payload[0]?.payload?.ticker) && (
        <p style={{ color: "#00ff9d", marginBottom: 6, fontWeight: 600 }}>
          {label || payload[0]?.payload?.ticker}
        </p>
      )}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || "#c9d1d9", lineHeight: 1.7 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
          {p.unit || ""}
        </p>
      ))}
    </div>
  );
}

// A labelled key-value row used in summary panels
export function MetricRow({ label, value, valueColor = "#c9d1d9" }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      padding: "6px 0",
      borderBottom: "1px solid #0d111766",
    }}>
      <span style={{ color: "#8b949e", fontSize: 11 }}>{label}</span>
      <span style={{ color: valueColor, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// Spinning loader indicator
export function Spinner() {
  return (
    <span
      className="spin"
      style={{
        display: "inline-block",
        width: 14, height: 14,
        border: "2px solid #1c2333",
        borderTopColor: "#00ff9d",
        borderRadius: "50%",
      }}
    />
  );
}

// Coloured badge: UNDERVALUED / FAIR VALUE / OVERVALUED
export function ValuationBadge({ label, color }) {
  return (
    <span style={{
      background: color + "1a",
      color,
      border: `1px solid ${color}44`,
      padding: "2px 10px",
      borderRadius: 3,
      fontSize: 10,
      letterSpacing: "0.08em",
      fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

// Weight percentage bar
export function WeightBar({ value, color = "#00ff9d" }) {
  return (
    <div style={{ height: 4, background: "#1c2333", borderRadius: 2, overflow: "hidden" }}>
      <div style={{
        height: "100%",
        width: `${Math.min(100, value)}%`,
        background: color,
        borderRadius: 2,
        transition: "width 0.5s ease",
      }} />
    </div>
  );
}

// Section header / label
export function SectionLabel({ children, action }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    }}>
      <span style={{
        color: "#8b949e",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}>
        {children}
      </span>
      {action}
    </div>
  );
}
