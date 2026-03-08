// src/components/SyncBadge.jsx
export default function SyncBadge({ status, hasSupabase }) {
  if (!hasSupabase) return (
    <div style={{ padding:"3px 24px", background:"#ffd70006", borderBottom:"1px solid #ffd70015", display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ color:"#ffd70055", fontSize:10, letterSpacing:"0.07em", fontFamily:"'IBM Plex Mono',monospace" }}>
        ⚠ LOCAL ONLY — add REACT_APP_SUPABASE_URL + REACT_APP_SUPABASE_ANON_KEY to .env for cloud save
      </span>
    </div>
  );

  if (status === "idle") return null;

  const cfg = {
    saving: { color:"#ffd700", icon:"↑", text:"SAVING…",          bg:"#ffd70008", border:"#ffd70022" },
    saved:  { color:"#00ff9d", icon:"✓", text:"SAVED TO CLOUD",   bg:"#00ff9d08", border:"#00ff9d22" },
    error:  { color:"#ff6b35", icon:"⚠", text:"SAVE FAILED — check browser console", bg:"#ff6b3508", border:"#ff6b3522" },
  }[status];

  if (!cfg) return null;

  return (
    <div style={{ padding:"4px 24px", background:cfg.bg, borderBottom:`1px solid ${cfg.border}`, display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ color:cfg.color, fontSize:10, letterSpacing:"0.08em", fontFamily:"'IBM Plex Mono',monospace" }}>
        {cfg.icon} {cfg.text}
      </span>
    </div>
  );
}
