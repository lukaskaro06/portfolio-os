// src/App.jsx
import { useState, useMemo } from "react";
import "./index.css";

import { usePortfolio }   from "./hooks/usePortfolio";
import { useMarketData }  from "./hooks/useMarketData";
import { useStockData }   from "./hooks/useStockData";

import Header           from "./components/Header";
import LiveDataBanner   from "./components/LiveDataBanner";
import PortfolioBuilder from "./components/PortfolioBuilder";
import ValuationScreen  from "./components/ValuationScreen";
import Optimizer        from "./components/Optimizer";
import BacktestTab      from "./components/Backtest";
import DCFTab           from "./components/DCF";
import MonteCarloTab    from "./components/MonteCarlo";
import AnalyticsTab     from "./components/Analytics";
import WorldMonitor     from "./components/WorldMonitor";
import NewsSentiment    from "./components/NewsSentiment";
import MarketWatch      from "./components/MarketWatch";

export default function App() {
  const [activeTab, setActiveTab] = useState("builder");

  // ── Portfolio state ────────────────────────────────────
  const {
    holdings, totalWeight, metrics, sectorBreakdown,
    riskTolerance, setRiskTolerance,
    addStock, removeStock, updateWeight, equalWeight, optimize,
  } = usePortfolio();

  // ── Legacy FMP live data (banner / enrichedHoldings) ──
  const {
    enrichedHoldings, loading: fmpLoading,
    errors: fmpErrors, lastFetch, hasApiKey, refresh: fmpRefresh,
  } = useMarketData(holdings);

  // ── Watchlist state (persisted) ────────────────────────
  const [watchlistTickers, setWatchlistTickers] = useState(() => {
    try {
      const s = localStorage.getItem("mw_watchlist");
      return s ? JSON.parse(s) : ["AAPL","MSFT","GOOGL","AMZN","NVDA","SPY","QQQ","BTC-USD"];
    } catch { return ["AAPL","MSFT","GOOGL","AMZN","NVDA","SPY","QQQ","BTC-USD"]; }
  });

  // ── Global live data — ONE fetch for ALL tabs ──────────
  // Merge portfolio tickers + watchlist into a single unique list
  const allTickers = useMemo(() => {
    const portfolio = holdings.map(h => h.ticker);
    return [...new Set([...portfolio, ...watchlistTickers])];
  }, [holdings, watchlistTickers]);

  const stockData = useStockData(allTickers);

  // ── Enrich holdings with live prices from global store ─
  // This is what every tab receives — always has livePrice / changePct
  const liveHoldings = useMemo(() => {
    return enrichedHoldings.map(h => {
      const q = stockData.getQuote(h.ticker);
      if (!q) return h;
      return {
        ...h,
        // Live price fields — used by DCF, Analytics, Backtest, MonteCarlo
        livePrice:     q.price,
        liveChange:    q.change,
        liveChangePct: q.changePct,
        livePositive:  q.positive,
        liveName:      q.name,
        liveMarketCap: q.marketCap,
        liveVolume:    q.volume,
        sparkline:     q.sparkline,
        // Override price with live price so DCF uses real market price
        price:         q.price ?? h.price,
      };
    });
  }, [enrichedHoldings, stockData.quotes]); // eslint-disable-line

  // ── Live portfolio metrics (fed into MonteCarlo / Optimizer) ─
  // metrics already computed from usePortfolio — it uses holdings weights
  // and static expectedReturn/volatility, which is fine for simulation

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
        loading={fmpLoading || stockData.loading}
        errors={fmpErrors}
        lastFetch={stockData.lastUpdate ?? lastFetch}
        onRefresh={() => { fmpRefresh(); stockData.refresh(); }}
      />

      <main style={
        activeTab === "world"
          ? { maxWidth: "100%" }
          : { maxWidth: 1320, margin: "0 auto", padding: "24px 24px 60px" }
      }>

        {activeTab === "builder" && (
          <PortfolioBuilder
            holdings={liveHoldings}
            totalWeight={totalWeight}
            metrics={metrics}
            addStock={addStock}
            removeStock={removeStock}
            updateWeight={updateWeight}
            equalWeight={equalWeight}
            onOptimize={() => { optimize(); setActiveTab("optimizer"); }}
            stockData={stockData}
          />
        )}

        {activeTab === "valuation" && (
          <ValuationScreen
            holdings={liveHoldings}
            stockData={stockData}
          />
        )}

        {activeTab === "optimizer" && (
          <Optimizer
            holdings={liveHoldings}
            metrics={metrics}
            riskTolerance={riskTolerance}
            setRiskTolerance={setRiskTolerance}
            optimize={optimize}
          />
        )}

        {/* Backtest gets liveHoldings so ticker list is always current */}
        {activeTab === "backtest" && (
          <BacktestTab holdings={liveHoldings} />
        )}

        {/* DCF gets liveHoldings — h.price is now the live market price */}
        {activeTab === "dcf" && (
          <DCFTab holdings={liveHoldings} stockData={stockData} />
        )}

        {/* MonteCarlo uses portfolio-level metrics (ret/vol) */}
        {activeTab === "montecarlo" && (
          <MonteCarloTab metrics={metrics} liveHoldings={liveHoldings} />
        )}

        {/* Analytics uses liveHoldings for charts */}
        {activeTab === "charts" && (
          <AnalyticsTab
            holdings={liveHoldings}
            sectorBreakdown={sectorBreakdown}
            stockData={stockData}
          />
        )}

        {activeTab === "world" && (
          <WorldMonitor holdings={liveHoldings} />
        )}

        {activeTab === "news" && (
          <NewsSentiment holdings={liveHoldings} />
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

      </main>
    </div>
  );
}
