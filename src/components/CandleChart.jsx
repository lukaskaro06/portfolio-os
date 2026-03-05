// src/components/CandleChart.jsx
// ─────────────────────────────────────────────────────────────
// Proper SVG candlestick chart with:
//   • Real OHLC candle bodies + wicks rendered as SVG rects/lines
//   • Mouse wheel zoom (pinch on mobile)
//   • Click+drag pan
//   • Crosshair + OHLCV tooltip
//   • Volume bars underneath
//   • Range selector (intraday 5m/15m/1h + daily/weekly)

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { fetchCandles } from "../hooks/useStockData";
import { Spinner } from "./UI";

// ── Formatters ─────────────────────────────────────────────
const fmtVol = n => {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(0)}K`;
  return String(n);
};

// ── Range config ───────────────────────────────────────────
export const RANGE_GROUPS = [
  {
    label: "INTRADAY", color: "#00c8ff",
    ranges: [
      { key: "1d-1m",  label: "1m"    },
      { key: "1d",     label: "5m"    },
      { key: "5d",     label: "5m·5d" },
      { key: "5d-15m", label: "15m"   },
      { key: "1mo-1h", label: "1h"    },
    ],
  },
  {
    label: "DAILY", color: "#00ff9d",
    ranges: [
      { key: "1mo", label: "1M" },
      { key: "3mo", label: "3M" },
      { key: "6mo", label: "6M" },
    ],
  },
  {
    label: "WEEKLY", color: "#ffd700",
    ranges: [
      { key: "1y", label: "1Y" },
      { key: "2y", label: "2Y" },
      { key: "5y", label: "5Y" },
    ],
  },
];

// ── Main component ─────────────────────────────────────────
export default function CandleChart({
  ticker,
  height      = 280,
  volumeHeight= 50,
  defaultRange= "1d",
}) {
  const [candles,  setCandles]  = useState([]);
  const [range,    setRange]    = useState(defaultRange);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // Viewport: start index + count of visible candles
  const [viewStart,  setViewStart]  = useState(0);
  const [viewCount,  setViewCount]  = useState(60);

  // Crosshair
  const [hoverIdx,  setHoverIdx]   = useState(null);
  const [mousePos,  setMousePos]   = useState({ x: 0, y: 0 });

  // Drag state
  const dragRef     = useRef({ dragging: false, startX: 0, startView: 0 });
  const svgRef      = useRef(null);
  const containerRef= useRef(null);
  const [svgWidth,  setSvgWidth]   = useState(600);

  // ── Measure container width ──────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      setSvgWidth(entries[0].contentRect.width || 600);
    });
    ro.observe(el);
    setSvgWidth(el.clientWidth || 600);
    return () => ro.disconnect();
  }, []);

  // ── Load candles ─────────────────────────────────────────
  const loadRange = useCallback(async r => {
    setRange(r); setLoading(true); setError(null); setHoverIdx(null);
    try {
      const data = await fetchCandles(ticker, r);
      setCandles(data);
      // Reset viewport: show last N candles
      const defaultView = Math.min(80, data.length);
      setViewCount(defaultView);
      setViewStart(Math.max(0, data.length - defaultView));
    } catch (e) { setError(e.message); setCandles([]); }
    finally     { setLoading(false); }
  }, [ticker]);

  useEffect(() => { loadRange(defaultRange); }, [loadRange]);

  // ── Visible slice ────────────────────────────────────────
  const visible = useMemo(() => {
    const end = Math.min(viewStart + viewCount, candles.length);
    return candles.slice(viewStart, end);
  }, [candles, viewStart, viewCount]);

  // ── Price scale ──────────────────────────────────────────
  const { minP, maxP, minV, maxV } = useMemo(() => {
    if (!visible.length) return { minP:0, maxP:1, minV:0, maxV:1 };
    const lows   = visible.map(c => c.low  ?? c.close).filter(Boolean);
    const highs  = visible.map(c => c.high ?? c.close).filter(Boolean);
    const vols   = visible.map(c => c.volume ?? 0);
    const pad    = (Math.max(...highs) - Math.min(...lows)) * 0.05 || 1;
    return {
      minP: Math.min(...lows)  - pad,
      maxP: Math.max(...highs) + pad,
      minV: 0,
      maxV: Math.max(...vols, 1),
    };
  }, [visible]);

  // SVG layout constants
  const PAD_L    = 60;  // left axis
  const PAD_R    = 10;
  const PAD_T    = 10;
  const PAD_B    = 22;  // x-axis labels
  const chartW   = svgWidth - PAD_L - PAD_R;
  const chartH   = height;
  const totalH   = height + volumeHeight + PAD_B;

  // Price → Y pixel
  const py = useCallback(p =>
    PAD_T + (1 - (p - minP) / (maxP - minP)) * (chartH - PAD_T),
  [minP, maxP, chartH]);

  // Volume → Y pixel (in volume strip)
  const vy = useCallback(v =>
    height + volumeHeight - (v / maxV) * volumeHeight,
  [height, volumeHeight, maxV]);

  // Candle width
  const candleW = visible.length ? Math.max(chartW / visible.length, 2) : 8;
  const bodyMin = 1;

  // ── Wheel zoom ───────────────────────────────────────────
  const onWheel = useCallback(e => {
    e.preventDefault();
    const delta    = e.deltaY > 0 ? 1.15 : 0.87;   // zoom in/out
    const newCount = Math.round(Math.min(Math.max(viewCount * delta, 10), candles.length));
    // Keep center candle fixed
    const center   = viewStart + Math.round(viewCount / 2);
    const newStart = Math.max(0, Math.min(center - Math.round(newCount / 2), candles.length - newCount));
    setViewCount(newCount);
    setViewStart(newStart);
  }, [viewCount, viewStart, candles.length]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // ── Drag pan ─────────────────────────────────────────────
  const onMouseDown = useCallback(e => {
    dragRef.current = { dragging: true, startX: e.clientX, startView: viewStart };
  }, [viewStart]);

  const onMouseMove = useCallback(e => {
    const { dragging, startX, startView } = dragRef.current;
    // Update crosshair position
    const rect   = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX   = e.clientX - rect.left - PAD_L;
    const idx    = Math.floor((svgX / chartW) * visible.length);
    if (idx >= 0 && idx < visible.length) setHoverIdx(idx);
    else setHoverIdx(null);
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

    if (!dragging) return;
    const dx      = e.clientX - startX;
    const shift   = -Math.round((dx / chartW) * viewCount);
    const newStart= Math.max(0, Math.min(startView + shift, candles.length - viewCount));
    setViewStart(newStart);
  }, [chartW, viewCount, visible.length, candles.length]);

  const onMouseUp   = useCallback(() => { dragRef.current.dragging = false; }, []);
  const onMouseLeave= useCallback(() => { dragRef.current.dragging = false; setHoverIdx(null); }, []);

  // ── Price axis ticks ─────────────────────────────────────
  const priceTicks = useMemo(() => {
    const range  = maxP - minP;
    const step   = Math.pow(10, Math.floor(Math.log10(range / 5)));
    const ticks  = [];
    let   v      = Math.ceil(minP / step) * step;
    while (v <= maxP) { ticks.push(+v.toFixed(4)); v += step; }
    return ticks;
  }, [minP, maxP]);

  // ── X-axis labels (show ~6) ───────────────────────────────
  const xLabels = useMemo(() => {
    const step = Math.max(1, Math.floor(visible.length / 6));
    return visible
      .map((c, i) => ({ i, label: c.date }))
      .filter((_, i) => i % step === 0);
  }, [visible]);

  // ── Hovered candle ────────────────────────────────────────
  const hovered = hoverIdx != null ? visible[hoverIdx] : null;

  const color = defaultRange ? "#00ff9d" : "#00ff9d";

  return (
    <div ref={containerRef} style={{ width: "100%", userSelect: "none" }}>

      {/* Range selectors */}
      <div style={{ marginBottom: 10 }}>
        {RANGE_GROUPS.map(g => (
          <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
            <span style={{ color: g.color, fontSize: 9, letterSpacing: "0.1em", fontWeight: 700, minWidth: 52 }}>{g.label}</span>
            {g.ranges.map(r => {
              const active = range === r.key;
              return (
                <button key={r.key} onClick={() => loadRange(r.key)} style={{
                  background:   active ? g.color + "25" : "transparent",
                  color:        active ? g.color : "#8b949e",
                  border:       `1px solid ${active ? g.color + "66" : "#1c233366"}`,
                  padding:      "2px 9px", borderRadius: 3, fontSize: 10,
                  cursor:       "pointer", fontFamily: "monospace",
                  fontWeight:   active ? 700 : 400,
                  transition:   "all 0.1s",
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.color = g.color; e.currentTarget.style.borderColor = g.color + "44"; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.color = "#8b949e"; e.currentTarget.style.borderColor = "#1c233366"; }}}
                >{r.label}</button>
              );
            })}
          </div>
        ))}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 3 }}>
          <span style={{ color: "#8b949e44", fontSize: 10 }}>
            {visible.length} of {candles.length} candles · scroll to zoom · drag to pan
          </span>
          {loading && <Spinner />}
        </div>
      </div>

      {error && <p style={{ color: "#ff6b35", fontSize: 11, marginBottom: 6 }}>⚠ {error}</p>}

      {/* OHLCV tooltip */}
      {hovered && (
        <div style={{
          display: "flex", gap: 16, padding: "6px 14px",
          background: "#12151c", border: "1px solid #1c2333",
          borderRadius: 4, fontSize: 11, fontFamily: "monospace",
          marginBottom: 6, flexWrap: "wrap",
        }}>
          <span style={{ color: "#8b949e" }}>{hovered.date}</span>
          {hovered.open  != null && <span>O <b style={{ color: "#c9d1d9" }}>${hovered.open}</b></span>}
          {hovered.high  != null && <span>H <b style={{ color: "#00ff9d" }}>${hovered.high}</b></span>}
          {hovered.low   != null && <span>L <b style={{ color: "#ff6b35" }}>${hovered.low}</b></span>}
          {hovered.close != null && (
            <span>C <b style={{ color: hovered.close >= (hovered.open ?? hovered.close) ? "#00ff9d" : "#ff6b35", fontSize: 12 }}>${hovered.close}</b></span>
          )}
          {hovered.open  != null && hovered.close != null && (() => {
            const chg    = hovered.close - hovered.open;
            const chgPct = (chg / hovered.open * 100).toFixed(2);
            const up     = chg >= 0;
            return <span style={{ color: up ? "#00ff9d" : "#ff6b35" }}>{up?"+":""}{chg.toFixed(2)} ({up?"+":""}{chgPct}%)</span>;
          })()}
          {hovered.volume!= null && <span style={{ color: "#8b949e" }}>Vol <b>{fmtVol(hovered.volume)}</b></span>}
        </div>
      )}

      {/* SVG canvas */}
      {!loading && visible.length > 0 && (
        <svg
          ref={svgRef}
          width={svgWidth}
          height={totalH}
          style={{ cursor: dragRef.current?.dragging ? "grabbing" : "crosshair", display: "block" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        >
          {/* Background */}
          <rect x={PAD_L} y={PAD_T} width={chartW} height={chartH - PAD_T} fill="#0d1117" />

          {/* Grid lines */}
          {priceTicks.map(tick => {
            const y = py(tick);
            if (y < PAD_T || y > chartH) return null;
            return (
              <g key={tick}>
                <line x1={PAD_L} y1={y} x2={PAD_L + chartW} y2={y} stroke="#1c2333" strokeWidth={1} />
                <text x={PAD_L - 5} y={y + 4} textAnchor="end" fontSize={9} fill="#8b949e">
                  {tick >= 1000 ? tick.toFixed(0) : tick >= 10 ? tick.toFixed(1) : tick.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          {xLabels.map(({ i, label }) => {
            const cx = PAD_L + (i + 0.5) * candleW;
            return (
              <text key={i} x={cx} y={chartH + 14} textAnchor="middle" fontSize={9} fill="#8b949e">
                {label}
              </text>
            );
          })}

          {/* ── Candles ───────────────────────────────────── */}
          {visible.map((c, i) => {
            const cx    = PAD_L + i * candleW + candleW / 2;
            const isUp  = c.close >= (c.open ?? c.close);
            const clr   = isUp ? "#00ff9d" : "#ff6b35";
            const bodyTop    = py(Math.max(c.open ?? c.close, c.close));
            const bodyBottom = py(Math.min(c.open ?? c.close, c.close));
            const bodyH      = Math.max(bodyBottom - bodyTop, bodyMin);
            const wickTop    = c.high != null ? py(c.high) : bodyTop;
            const wickBottom = c.low  != null ? py(c.low)  : bodyBottom;
            const bw         = Math.max(candleW * 0.6, 2);

            return (
              <g key={i}>
                {/* Upper wick */}
                <line
                  x1={cx} y1={wickTop}
                  x2={cx} y2={bodyTop}
                  stroke={clr} strokeWidth={1.5}
                />
                {/* Body */}
                <rect
                  x={cx - bw / 2} y={bodyTop}
                  width={bw} height={bodyH}
                  fill={isUp ? clr : clr}
                  opacity={isUp ? 0.9 : 0.85}
                  stroke={clr} strokeWidth={0.5}
                />
                {/* Lower wick */}
                <line
                  x1={cx} y1={bodyTop + bodyH}
                  x2={cx} y2={wickBottom}
                  stroke={clr} strokeWidth={1.5}
                />
              </g>
            );
          })}

          {/* ── Volume strip ──────────────────────────────── */}
          <rect x={PAD_L} y={height} width={chartW} height={volumeHeight} fill="#080c12" />
          {visible.map((c, i) => {
            const isUp = c.close >= (c.open ?? c.close);
            const vTop = vy(c.volume ?? 0);
            const vH   = height + volumeHeight - vTop;
            const bw   = Math.max(candleW * 0.6, 2);
            const cx   = PAD_L + i * candleW + candleW / 2;
            return (
              <rect
                key={i}
                x={cx - bw / 2} y={vTop}
                width={bw} height={Math.max(vH, 1)}
                fill={isUp ? "#00ff9d" : "#ff6b35"} opacity={0.35}
              />
            );
          })}
          <line x1={PAD_L} y1={height} x2={PAD_L + chartW} y2={height} stroke="#1c2333" strokeWidth={1} />

          {/* ── Crosshair ─────────────────────────────────── */}
          {hoverIdx != null && (() => {
            const cx = PAD_L + (hoverIdx + 0.5) * candleW;
            return (
              <>
                <line x1={cx} y1={PAD_T} x2={cx} y2={chartH + volumeHeight} stroke="#8b949e44" strokeWidth={1} strokeDasharray="4 3" />
                <line x1={PAD_L} y1={mousePos.y} x2={PAD_L + chartW} y2={mousePos.y} stroke="#8b949e44" strokeWidth={1} strokeDasharray="4 3" />
                {/* Price label on Y axis */}
                {mousePos.y > PAD_T && mousePos.y < chartH && (() => {
                  const p = minP + (1 - (mousePos.y - PAD_T) / (chartH - PAD_T)) * (maxP - minP);
                  return (
                    <g>
                      <rect x={0} y={mousePos.y - 9} width={PAD_L - 3} height={16} fill="#1c2333" rx={2} />
                      <text x={PAD_L - 6} y={mousePos.y + 4} textAnchor="end" fontSize={9} fill="#c9d1d9">
                        {p >= 100 ? p.toFixed(1) : p.toFixed(2)}
                      </text>
                    </g>
                  );
                })()}
              </>
            );
          })()}

          {/* Left axis border */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={height + volumeHeight} stroke="#1c2333" strokeWidth={1} />
        </svg>
      )}

      {/* Zoom/pan hint */}
      {!loading && candles.length > 0 && (
        <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 10, color: "#8b949e44" }}>
          <span>🖱 scroll to zoom</span>
          <span>✋ drag to pan</span>
          <span style={{ marginLeft: "auto" }}>
            viewing candles {viewStart + 1}–{Math.min(viewStart + viewCount, candles.length)} of {candles.length}
          </span>
        </div>
      )}

      {!loading && candles.length === 0 && !error && (
        <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "#8b949e44", fontSize: 11 }}>
          No data for this range
        </div>
      )}
    </div>
  );
}
