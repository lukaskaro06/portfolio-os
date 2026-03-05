import { useState, useMemo } from "react";
import "./index.css";

import { usePortfolio }   from "./hooks/usePortfolio";
import { useMarketData }  from "./hooks/useMarketData";
import { useStockData }   from "./hooks/useStockData";

import Header             from "./components/Header";
import PortfolioBuilder   from "./components/PortfolioBuilder";
import ValuationScreen    from "./components/ValuationScreen";
import Optimizer          from "./components/Optimizer";
import MonteCarloTab      from "./components/MonteCarlo";
import AnalyticsTab       from "./components/Analytics";
import BacktestTab        from "./components/Backtest";
import DCFTab             from "./components/DCF";
import WorldMonitor       from "./components/WorldMonitor";
import NewsSentiment      from "./components/NewsSentiment";
import LiveDataBanner     from "./components/LiveDataBanner";
import MarketWatch        from "./components/MarketWatch";

export default function App() {
  const [activeTab, setActiveTab] = useState("builder");

  const {
    holdings, totalWeight, metrics, sectorBreakdown,
    riskTolerance, setRiskTolerance,
    addStock, removeStock, updateWeight, equalWeight,
    optimize, addCustomStock,
  } = usePortfolio();

  const {
    enrichedHoldings, loading: dataLoading,
    errors: dataErrors, lastFetch, hasApiKey, refresh,
  } = useMarketData(holdings);

  // ── Global live data — fetched ONCE, shared everywhere ──
  // All portfolio tickers + watchlist tickers live here
  const [watchlistTickers, setWatchlistTickers] = useState(() => {
    try {
      const saved = localStorage.getItem("mw_watchlist");
      return saved ? JSON.parse(saved) : ["AAPL","MSFT","GOOGL","AMZN","NVDA","SPY","QQQ","BTC-USD"];
    } catch { return ["AAPL","MSFT","GOOGL","AMZN","NVDA","SPY","QQQ","BTC-USD"]; }
  });

  // Merge portfolio tickers + watchlist into one unique list
  const allTrackedTickers = useMemo(() => {
    const portfolioTickers = holdings.map(h => h.ticker);
    return [...new Set([...portfolioTickers, ...watchlistTickers])];
  }, [holdings, watchlistTickers]);

  // One global data store
  const stockData = useStockData(allTrackedTickers);

  // Enrich holdings with live quotes from global store
  const liveEnrichedHoldings = useMemo(() => {
    return enrichedHoldings.map(h => {
      const q = stockData.getQuote(h.ticker);
      if (!q) return h;
      return {
        ...h,
        livePrice:     q.price,
        liveChange:    q.change,
        liveChangePct: q.changePct,
        livePositive:  q.positive,
        sparkline:     q.sparkline,
        liveName:      q.name,
        liveMarketCap: q.marketCap,
        liveVolume:    q.volume,
      };
    });
  }, [enrichedHoldings, stockData.quotes]);

  const isFullscreen = activeTab === "world";

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header
        metrics={metrics}
        totalWeight={totalWeight}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stockData={stockData}
        holdings={liveEnrichedHoldings}
      />
      <LiveDataBanner
        hasApiKey={hasApiKey}
        loading={dataLoading || stockData.loading}
        errors={dataErrors}
        lastFetch={stockData.lastUpdate ?? lastFetch}
        onRefresh={() => { refresh(); stockData.refresh(); }}
      />
      <main style={isFullscreen
        ? { maxWidth: "100%" }
        : { maxWidth: 1320, margin: "0 auto", padding: "24px 24px 60px" }
      }>
        {activeTab === "builder" && (
          <PortfolioBuilder
            holdings={liveEnrichedHoldings}
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
        {activeTab === "valuation" && (
          <ValuationScreen
            holdings={liveEnrichedHoldings}
            stockData={stockData}
          />
        )}
        {activeTab === "optimizer" && (
          <Optimizer
            holdings={liveEnrichedHoldings}
            metrics={metrics}
            riskTolerance={riskTolerance}
            setRiskTolerance={setRiskTolerance}
            optimize={optimize}
          />
        )}
        {activeTab === "backtest"   && <BacktestTab  holdings={liveEnrichedHoldings} />}
        {activeTab === "dcf"        && <DCFTab        holdings={liveEnrichedHoldings} stockData={stockData} />}
        {activeTab === "montecarlo" && <MonteCarloTab metrics={metrics} />}
        {activeTab === "charts"     && <AnalyticsTab  holdings={liveEnrichedHoldings} sectorBreakdown={sectorBreakdown} />}
        {activeTab === "world"      && <WorldMonitor  holdings={liveEnrichedHoldings} />}
        {activeTab === "news"       && <NewsSentiment holdings={liveEnrichedHoldings} />}
        {activeTab === "marketwatch" && (
          <MarketWatch
            holdings={liveEnrichedHoldings}
            stockData={stockData}
            watchlistTickers={watchlistTickers}
            setWatchlistTickers={setWatchlistTickers}
            onAddToPortfolio={(quote) => addStock(quote.ticker)}
          />
        )}
      </main>
    </div>
  );
}
