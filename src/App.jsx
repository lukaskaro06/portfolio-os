import { useState, useMemo } from "react";
import "./index.css";

import { usePortfolio }  from "./hooks/usePortfolio";
import { useMarketData } from "./hooks/useMarketData";
import { useStockData }  from "./hooks/useStockData";

import Screener from "./components/Screener";
import Header           from "./components/Header";
import LiveDataBanner   from "./components/LiveDataBanner";
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

export default function App() {
  const [activeTab, setActiveTab] = useState("builder");

  // ── Portfolio state ─────────────────────────────────────
  const {
    holdings, totalWeight, metrics, sectorBreakdown,
    riskTolerance, setRiskTolerance,
    addStock, removeStock, updateWeight, equalWeight,
    optimize, addCustomStock,
  } = usePortfolio();

  // ── Legacy market data (FMP / static enrichment) ────────
  const {
    enrichedHoldings, loading: dataLoading,
    errors: dataErrors, lastFetch, hasApiKey, refresh,
  } = useMarketData(holdings);

  // ── Watchlist (persisted to localStorage) ──────────────
  const [watchlistTickers, setWatchlistTickers] = useState(() => {
    try {
      const saved = localStorage.getItem("mw_watchlist");
      return saved
        ? JSON.parse(saved)
        : ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "SPY", "QQQ", "BTC-USD"];
    } catch {
      return ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "SPY", "QQQ", "BTC-USD"];
    }
  });

  // ── Smart tab-aware polling ─────────────────────────────
  // Only poll tickers relevant to the active tab
  const allTickers = useMemo(() => {
    const portfolioTickers = holdings.map(h => h.ticker);
    const tabsNeedingAll   = ["marketwatch", "macro", "fx", "commodities"];
    if (tabsNeedingAll.includes(activeTab)) {
      return [...new Set([...portfolioTickers, ...watchlistTickers])];
    }
    if (["backtest", "montecarlo", "world", "news"].includes(activeTab)) {
      return [];
    }
    return portfolioTickers;
  }, [holdings, watchlistTickers, activeTab]);

  const stockData = useStockData(allTickers);

  // ── Enrich holdings with live prices ───────────────────
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
        rateLimited={stockData.rateLimited}
        retryIn={stockData.retryIn}
      />

      <main style={isFullscreen
        ? { maxWidth: "100%" }
        : { maxWidth: 1320, margin: "0 auto", padding: "24px 24px 60px" }
      }>
        {activeTab === "builder"    && (
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
        {activeTab === "screener" && (
          <Screener
          stockData={stockData}
          holdings={liveHoldings}
          onAddToPortfolio={stock => addStock(stock)}
           />
           )}
      </main>
    </div>
  );
}
