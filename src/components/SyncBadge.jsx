// src/components/SyncBadge.jsx
// Small persistent indicator showing cloud save status.
// Sits just below the LiveDataBanner.

export default function SyncBadge({ status, hasSupabase }) {
  // Don't show anything when idle or no Supabase configured
  if (!hasSupabase) return (
    <div style={{
      padding: "4px 24px",
      background: "#ffd70008",
      borderBottom: "1px solid #ffd70022",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ color: "#ffd70066", fontSize: 10, letterSpacing: "0.08em" }}>
        ⚠ LOCAL ONLY — add REACT_APP_SUPABASE_URL + REACT_APP_SUPABASE_ANON_KEY to .env to enable cloud save
      </span>
    </div>
  );

  if (status === "idle") return null;

  const config = {
    saving: { color: "#ffd700", icon: "↑", text: "SAVING…",  bg: "#ffd70008", border: "#ffd70022" },
    saved:  { color: "#00ff9d", icon: "✓", text: "SAVED",    bg: "#00ff9d08", border: "#00ff9d22" },
    error:  { color: "#ff6b35", icon: "⚠", text: "SAVE FAILED — check console", bg: "#ff6b3508", border: "#ff6b3522" },
  }[status] ?? null;

  if (!config) return null;

  return (
    <div style={{
      padding: "4px 24px",
      background: config.bg,
      borderBottom: `1px solid ${config.border}`,
      display: "flex", alignItems: "center", gap: 8,
      transition: "all 0.3s",
    }}>
      <span style={{ color: config.color, fontSize: 10, letterSpacing: "0.08em", fontFamily: "'IBM Plex Mono', monospace" }}>
        {config.icon} {config.text}
      </span>
      {status === "saved" && (
        <span style={{ color: "#8b949e44", fontSize: 10 }}>Portfolio synced to Supabase</span>
      )}
    </div>
  );
}
