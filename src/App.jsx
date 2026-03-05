import { useState } from "react";
import "./index.css";

import { usePortfolio }   from "./hooks/usePortfolio";
import { useMarketData }  from "./hooks/useMarketData";

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
import MarketWatch from "./components/MarketWatch";

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
        loading={dataLoading}
        errors={dataErrors}
        lastFetch={lastFetch}
        onRefresh={refresh}
      />
      <main style={isFullscreen
        ? { maxWidth: "100%" }
        : { maxWidth: 1320, margin: "0 auto", padding: "24px 24px 60px" }
      }>
        {activeTab === "builder"    && <PortfolioBuilder holdings={enrichedHoldings} totalWeight={totalWeight} metrics={metrics} addStock={addStock} removeStock={removeStock} updateWeight={updateWeight} equalWeight={equalWeight} addCustomStock={addCustomStock} onOptimize={() => { optimize(); setActiveTab("optimizer"); }} />}
        {activeTab === "valuation"  && <ValuationScreen  holdings={enrichedHoldings} />}
        {activeTab === "optimizer"  && <Optimizer         holdings={enrichedHoldings} metrics={metrics} riskTolerance={riskTolerance} setRiskTolerance={setRiskTolerance} optimize={optimize} />}
        {activeTab === "backtest"   && <BacktestTab       holdings={enrichedHoldings} />}
        {activeTab === "dcf"        && <DCFTab             holdings={enrichedHoldings} />}
        {activeTab === "montecarlo" && <MonteCarloTab      metrics={metrics} />}
        {activeTab === "charts"     && <AnalyticsTab       holdings={enrichedHoldings} sectorBreakdown={sectorBreakdown} />}
        {activeTab === "world"      && <WorldMonitor       holdings={enrichedHoldings} />}
        {activeTab === "news"       && <NewsSentiment      holdings={enrichedHoldings} />}
        {activeTab === "marketwatch" && <MarketWatch holdings={enrichedHoldings} onAddToPortfolio={(quote) => addStock(quote.ticker)} />}
      </main>
    </div>
  );
}
