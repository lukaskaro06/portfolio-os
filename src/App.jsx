// src/App.jsx
import { useState, useMemo } from "react";
import "./index.css";

import { usePersistence }  from "./hooks/usePersistence";
import { usePortfolio }    from "./hooks/usePortfolio";
import { useMarketData }   from "./hooks/useMarketData";
import { useStockData }    from "./hooks/useStockData";

import Header           from "./components/Header";
import LiveDataBanner   from "./components/LiveDataBanner";
import SyncBadge        from "./components/SyncBadge";
import PortfolioBuilder from "./components/PortfolioBuilder";
import ValuationScreen  from "./components/ValuationScreen";
import Optimizer        from "./components/Optimizer";
import MonteCarloTab    from "./components/MonteCarlo";
import AnalyticsTab     from "./components/Analytics";
import BacktestTab      from "./components/Backtest";
import DCFTab           from "./components/DCF";
import WorldMonitor     from "./components/WorldMonitor";
import NewsSentiment    from "./components/NewsSentiment";
import MarketWatch      from "./components/MarketWatch";
import MacroPanel       from "./components/MacroPanel";
import FXCryptoPanel    from "./components/FXCryptoPanel";
import CommoditiesPanel from "./components/CommoditiesPanel";
import Screener         from "./components/Screener";

export default function App() {
  const [activeTab, setActiveTab] = useState("builder");

  // ── Persistence (Supabase + localStorage) ──────────────
  const {
    holdings:         persistedHoldings,
    riskTolerance:    persistedRisk,
    watchlist:        persistedWatchlist,
    syncStatus,
    loaded,
    setHoldings:      setPersistedHoldings,
    setRiskTolerance: setPersistedRisk,
    setWatchlist:     setPersistedWatchlist,
    hasSupabase,
  } = usePersistence();

  // ── Portfolio state (mutations wired to persistence) ───
  const {
    holdings, totalWeight, metrics, sectorBreakdown,
    riskTolerance, setRiskTolerance,
    addStock, removeStock, updateWeight, equalWeight,
    optimize, addCustomStock,
  } = usePortfolio({
    holdings:      persistedHoldings,
    setHoldings:   setPersistedHoldings,
    riskTolerance: persistedRisk,
    setRiskTolerance: setPersistedRisk,
  });

  // ── Legacy market data (FMP / static enrichment) ───────
  const {
    enrichedHoldings, loading: dataLoading,
    errors: dataErrors, lastFetch, hasApiKey, refresh,
  } = useMarketData(holdings);

  // ── Watchlist ──────────────────────────────────────────
  const watchlistTickers    = persistedWatchlist;
  const setWatchlistTickers = setPersistedWatchlist;

  // ── Smart tab-aware polling ────────────────────────────
  const allTickers = useMemo(() => {
    const portfolioTickers = holdings.map(h => h.ticker);
    const tabsNeedingAll   = ["marketwatch", "macro", "fx", "commodities", "screener"];
    if (tabsNeedingAll.includes(activeTab)) {
      return [...new Set([...portfolioTickers, ...watchlistTickers])];
    }
    if (["backtest", "montecarlo", "world", "news"].includes(activeTab)) {
      return [];
    }
    return portfolioTickers;
  }, [holdings, watchlistTickers, activeTab]);

  const stockData = useStockData(allTickers);

  // ── Enrich holdings with live prices ──────────────────
  const liveHoldings = useMemo(() => {
    return enrichedHoldings.map(h => {
      const q = stockData.getQuote(h.ticker);
      if (!q) return h;
      return {
        ...h,
        livePrice:     q.price,
        liveChange:    q.change,
        liveChangePct: q.changePct,
        livePositive:  q.positive,
        liveName:      q.name,
        liveMarketCap: q.marketCap,
        liveVolume:    q.volume,
        sparkline:     q.sparkline ?? h.sparkline ?? [],
        price:         q.price ?? h.price,
      };
    });
  // eslint-disable-next-line
  }, [enrichedHoldings, stockData.quotes]);

  const isFullscreen = activeTab === "world";

  // ── Don't render until initial load is done ────────────
  // Prevents flash of default holdings before DB data arrives
  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 20, height: 20, border: "2px solid #1c2333", borderTopColor: "#00ff9d", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span style={{ color: "#8b949e", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>
          {hasSupabase ? "LOADING PORTFOLIO…" : "INITIALISING…"}
        </span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header
        metrics={metrics}
        totalWeight={totalWeight}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <LiveDataBanner
        hasApiKey={hasApiKey}
        loading={dataLoading || stockData.loading}
        errors={dataErrors}
        lastFetch={stockData.lastUpdate ?? lastFetch}
        onRefresh={() => { refresh(); stockData.refresh(); }}
      />

      {/* Supabase sync status badge */}
      <SyncBadge status={syncStatus} hasSupabase={hasSupabase} />

      <main style={isFullscreen
        ? { maxWidth: "100%" }
        : { maxWidth: 1320, margin: "0 auto", padding: "24px 24px 60px" }
      }>
        {activeTab === "builder"     && (
          <PortfolioBuilder
            holdings={liveHoldings}
            totalWeight={totalWeight}
            metrics={metrics}
            addStock={addStock}
            removeStock={removeStock}
            updateWeight={updateWeight}
            equalWeight={equalWeight}
            addCustomStock={addCustomStock}
            onOptimize={() => { optimize(); setActiveTab("optimizer"); }}
            stockData={stockData}
          />
        )}
        {activeTab === "valuation"   && <ValuationScreen  holdings={liveHoldings} stockData={stockData} />}
        {activeTab === "optimizer"   && <Optimizer         holdings={liveHoldings} metrics={metrics} riskTolerance={riskTolerance} setRiskTolerance={setRiskTolerance} optimize={optimize} />}
        {activeTab === "backtest"    && <BacktestTab       holdings={liveHoldings} />}
        {activeTab === "dcf"         && <DCFTab            holdings={liveHoldings} stockData={stockData} />}
        {activeTab === "montecarlo"  && <MonteCarloTab     metrics={metrics} liveHoldings={liveHoldings} />}
        {activeTab === "charts"      && <AnalyticsTab      holdings={liveHoldings} sectorBreakdown={sectorBreakdown} stockData={stockData} />}
        {activeTab === "world"       && <WorldMonitor      holdings={liveHoldings} />}
        {activeTab === "news"        && <NewsSentiment     holdings={liveHoldings} />}
        {activeTab === "screener"    && (
          <Screener
            stockData={stockData}
            holdings={liveHoldings}
            onAddToPortfolio={stock => addStock(stock)}
          />
        )}
        {activeTab === "marketwatch" && (
          <MarketWatch
            holdings={liveHoldings}
            stockData={stockData}
            watchlistTickers={watchlistTickers}
            setWatchlistTickers={setWatchlistTickers}
            onAddToPortfolio={ticker => addStock(ticker)}
          />
        )}
        {activeTab === "macro"       && <MacroPanel />}
        {activeTab === "fx"          && <FXCryptoPanel />}
        {activeTab === "commodities" && <CommoditiesPanel />}
      </main>
    </div>
  );
}
