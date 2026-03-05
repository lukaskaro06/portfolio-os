// ── Color palette used across charts ──────────────────────
export const CHART_COLORS = [
  "#00ff9d", "#00c8ff", "#ff6b35", "#ffd700",
  "#c084fc", "#fb7185", "#34d399", "#60a5fa",
  "#f9a825", "#e879f9",
];

// ── Risk-free rate assumption (%) ──────────────────────────
export const RISK_FREE_RATE = 4.5;

// ── Stock universe ─────────────────────────────────────────
// Fields:
//   ticker, name, sector
//   pe        – trailing P/E
//   pb        – price-to-book
//   evEbitda  – EV / EBITDA
//   beta      – market beta
//   expectedReturn – analyst-consensus expected annual return (%)
//   volatility     – annualised historical volatility (%)
//   dividend       – trailing dividend yield (%)
export const STOCK_UNIVERSE = [
  {
    ticker: "AAPL", name: "Apple Inc.", sector: "Technology",
    pe: 28.4, pb: 46.2, evEbitda: 22.1,
    beta: 1.19, expectedReturn: 12.4, volatility: 24.1, dividend: 0.5,
  },
  {
    ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology",
    pe: 35.2, pb: 13.8, evEbitda: 26.4,
    beta: 0.90, expectedReturn: 13.1, volatility: 21.8, dividend: 0.8,
  },
  {
    ticker: "JPM", name: "JPMorgan Chase", sector: "Financials",
    pe: 11.2, pb: 1.7, evEbitda: 8.9,
    beta: 1.12, expectedReturn: 10.2, volatility: 22.5, dividend: 2.4,
  },
  {
    ticker: "JNJ", name: "Johnson & Johnson", sector: "Healthcare",
    pe: 15.8, pb: 5.2, evEbitda: 12.3,
    beta: 0.55, expectedReturn: 7.8, volatility: 14.2, dividend: 3.1,
  },
  {
    ticker: "XOM", name: "Exxon Mobil", sector: "Energy",
    pe: 13.4, pb: 2.1, evEbitda: 7.8,
    beta: 0.85, expectedReturn: 9.5, volatility: 25.6, dividend: 3.5,
  },
  {
    ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Disc.",
    pe: 42.1, pb: 8.9, evEbitda: 18.7,
    beta: 1.32, expectedReturn: 15.2, volatility: 29.3, dividend: 0.0,
  },
  {
    ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology",
    pe: 55.3, pb: 30.1, evEbitda: 38.2,
    beta: 1.68, expectedReturn: 18.4, volatility: 42.7, dividend: 0.1,
  },
  {
    ticker: "PG", name: "Procter & Gamble", sector: "Staples",
    pe: 24.6, pb: 7.8, evEbitda: 17.4,
    beta: 0.48, expectedReturn: 7.2, volatility: 13.8, dividend: 2.5,
  },
  {
    ticker: "V", name: "Visa Inc.", sector: "Financials",
    pe: 30.1, pb: 14.2, evEbitda: 22.8,
    beta: 0.97, expectedReturn: 11.8, volatility: 19.4, dividend: 0.8,
  },
  {
    ticker: "HD", name: "Home Depot", sector: "Consumer Disc.",
    pe: 21.3, pb: 50.4, evEbitda: 16.1,
    beta: 1.04, expectedReturn: 10.6, volatility: 20.8, dividend: 2.3,
  },
  {
    ticker: "META", name: "Meta Platforms", sector: "Technology",
    pe: 24.8, pb: 7.1, evEbitda: 16.3,
    beta: 1.25, expectedReturn: 14.5, volatility: 33.2, dividend: 0.4,
  },
  {
    ticker: "BRK", name: "Berkshire Hathaway", sector: "Financials",
    pe: 20.4, pb: 1.5, evEbitda: 11.2,
    beta: 0.88, expectedReturn: 9.8, volatility: 18.4, dividend: 0.0,
  },
  {
    ticker: "UNH", name: "UnitedHealth Group", sector: "Healthcare",
    pe: 19.2, pb: 5.8, evEbitda: 14.7,
    beta: 0.60, expectedReturn: 11.3, volatility: 17.9, dividend: 1.5,
  },
  {
    ticker: "TSM", name: "Taiwan Semiconductor", sector: "Technology",
    pe: 22.1, pb: 5.6, evEbitda: 14.9,
    beta: 1.10, expectedReturn: 14.1, volatility: 30.5, dividend: 1.7,
  },
  {
    ticker: "NEE", name: "NextEra Energy", sector: "Utilities",
    pe: 18.7, pb: 3.2, evEbitda: 15.3,
    beta: 0.42, expectedReturn: 8.1, volatility: 18.6, dividend: 2.8,
  },
];
