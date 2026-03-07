// src/data/stocks.js
// Static stock universe used by Portfolio Builder, Valuation Screen, Optimizer
// Fields: ticker, name, sector, pe, pb, evEbitda, beta, expectedReturn, volatility, dividend

export const STOCK_UNIVERSE = [
  // Technology
  { ticker:"AAPL",  name:"Apple Inc.",              sector:"Technology",     pe:28,  pb:45,  evEbitda:22, beta:1.20, expectedReturn:13, volatility:22, dividend:0.5  },
  { ticker:"MSFT",  name:"Microsoft Corp.",          sector:"Technology",     pe:32,  pb:12,  evEbitda:24, beta:0.90, expectedReturn:14, volatility:20, dividend:0.8  },
  { ticker:"NVDA",  name:"NVIDIA Corp.",             sector:"Technology",     pe:55,  pb:30,  evEbitda:45, beta:1.70, expectedReturn:20, volatility:45, dividend:0.1  },
  { ticker:"GOOGL", name:"Alphabet Inc.",            sector:"Technology",     pe:23,  pb:6,   evEbitda:16, beta:1.10, expectedReturn:13, volatility:23, dividend:0.0  },
  { ticker:"META",  name:"Meta Platforms Inc.",      sector:"Technology",     pe:24,  pb:7,   evEbitda:14, beta:1.25, expectedReturn:15, volatility:28, dividend:0.4  },
  { ticker:"AMZN",  name:"Amazon.com Inc.",          sector:"Consumer Disc.", pe:42,  pb:9,   evEbitda:18, beta:1.30, expectedReturn:15, volatility:26, dividend:0.0  },
  { ticker:"TSLA",  name:"Tesla Inc.",               sector:"Consumer Disc.", pe:75,  pb:12,  evEbitda:50, beta:2.00, expectedReturn:18, volatility:55, dividend:0.0  },
  { ticker:"ORCL",  name:"Oracle Corp.",             sector:"Technology",     pe:22,  pb:null,evEbitda:18, beta:1.00, expectedReturn:11, volatility:22, dividend:1.4  },
  { ticker:"CRM",   name:"Salesforce Inc.",          sector:"Technology",     pe:45,  pb:4,   evEbitda:25, beta:1.20, expectedReturn:12, volatility:28, dividend:0.0  },
  { ticker:"AMD",   name:"Advanced Micro Devices",   sector:"Technology",     pe:48,  pb:4,   evEbitda:35, beta:1.80, expectedReturn:18, volatility:42, dividend:0.0  },
  { ticker:"INTC",  name:"Intel Corp.",              sector:"Technology",     pe:12,  pb:1,   evEbitda:8,  beta:1.10, expectedReturn:8,  volatility:28, dividend:2.0  },
  { ticker:"ADBE",  name:"Adobe Inc.",               sector:"Technology",     pe:28,  pb:12,  evEbitda:22, beta:1.10, expectedReturn:12, volatility:25, dividend:0.0  },
  { ticker:"CSCO",  name:"Cisco Systems Inc.",       sector:"Technology",     pe:14,  pb:4,   evEbitda:10, beta:0.85, expectedReturn:9,  volatility:18, dividend:3.2  },
  { ticker:"QCOM",  name:"Qualcomm Inc.",            sector:"Technology",     pe:16,  pb:6,   evEbitda:12, beta:1.30, expectedReturn:12, volatility:28, dividend:2.1  },
  { ticker:"TXN",   name:"Texas Instruments Inc.",   sector:"Technology",     pe:32,  pb:9,   evEbitda:22, beta:1.00, expectedReturn:11, volatility:22, dividend:2.8  },
  // Financials
  { ticker:"JPM",   name:"JPMorgan Chase & Co.",     sector:"Financials",     pe:12,  pb:2,   evEbitda:null,beta:1.10,expectedReturn:12, volatility:22, dividend:2.4  },
  { ticker:"BAC",   name:"Bank of America Corp.",    sector:"Financials",     pe:11,  pb:1,   evEbitda:null,beta:1.30,expectedReturn:11, volatility:25, dividend:2.5  },
  { ticker:"GS",    name:"Goldman Sachs Group",      sector:"Financials",     pe:13,  pb:1.5, evEbitda:null,beta:1.40,expectedReturn:13, volatility:26, dividend:2.2  },
  { ticker:"MS",    name:"Morgan Stanley",           sector:"Financials",     pe:14,  pb:2,   evEbitda:null,beta:1.30,expectedReturn:12, volatility:24, dividend:3.5  },
  { ticker:"V",     name:"Visa Inc.",                sector:"Financials",     pe:28,  pb:14,  evEbitda:22, beta:0.95, expectedReturn:14, volatility:18, dividend:0.8  },
  { ticker:"MA",    name:"Mastercard Inc.",          sector:"Financials",     pe:32,  pb:50,  evEbitda:25, beta:1.05, expectedReturn:14, volatility:19, dividend:0.6  },
  { ticker:"BRK",   name:"Berkshire Hathaway B",     sector:"Financials",     pe:22,  pb:1.5, evEbitda:null,beta:0.85,expectedReturn:11, volatility:18, dividend:0.0  },
  { ticker:"AXP",   name:"American Express Co.",     sector:"Financials",     pe:19,  pb:6,   evEbitda:null,beta:1.20,expectedReturn:12, volatility:22, dividend:1.3  },
  // Healthcare
  { ticker:"JNJ",   name:"Johnson & Johnson",        sector:"Healthcare",     pe:14,  pb:4,   evEbitda:12, beta:0.60, expectedReturn:9,  volatility:14, dividend:3.2  },
  { ticker:"UNH",   name:"UnitedHealth Group",       sector:"Healthcare",     pe:18,  pb:5,   evEbitda:14, beta:0.75, expectedReturn:11, volatility:18, dividend:1.5  },
  { ticker:"LLY",   name:"Eli Lilly and Co.",        sector:"Healthcare",     pe:55,  pb:40,  evEbitda:45, beta:0.45, expectedReturn:14, volatility:28, dividend:0.7  },
  { ticker:"ABBV",  name:"AbbVie Inc.",              sector:"Healthcare",     pe:16,  pb:null,evEbitda:14, beta:0.65, expectedReturn:10, volatility:18, dividend:3.6  },
  { ticker:"MRK",   name:"Merck & Co. Inc.",         sector:"Healthcare",     pe:13,  pb:5,   evEbitda:11, beta:0.55, expectedReturn:9,  volatility:16, dividend:2.7  },
  { ticker:"PFE",   name:"Pfizer Inc.",              sector:"Healthcare",     pe:12,  pb:2,   evEbitda:9,  beta:0.55, expectedReturn:8,  volatility:18, dividend:5.8  },
  { ticker:"TMO",   name:"Thermo Fisher Scientific", sector:"Healthcare",     pe:28,  pb:5,   evEbitda:20, beta:0.85, expectedReturn:12, volatility:20, dividend:0.3  },
  // Consumer
  { ticker:"WMT",   name:"Walmart Inc.",             sector:"Consumer Staples",pe:28, pb:6,   evEbitda:16, beta:0.55, expectedReturn:9,  volatility:14, dividend:1.3  },
  { ticker:"PG",    name:"Procter & Gamble Co.",     sector:"Consumer Staples",pe:26, pb:7,   evEbitda:20, beta:0.55, expectedReturn:8,  volatility:13, dividend:2.4  },
  { ticker:"KO",    name:"Coca-Cola Co.",            sector:"Consumer Staples",pe:22, pb:10,  evEbitda:18, beta:0.55, expectedReturn:7,  volatility:13, dividend:3.1  },
  { ticker:"PEP",   name:"PepsiCo Inc.",             sector:"Consumer Staples",pe:21, pb:11,  evEbitda:16, beta:0.55, expectedReturn:8,  volatility:14, dividend:3.0  },
  { ticker:"COST",  name:"Costco Wholesale Corp.",   sector:"Consumer Staples",pe:48, pb:14,  evEbitda:35, beta:0.75, expectedReturn:12, volatility:18, dividend:0.6  },
  { ticker:"HD",    name:"Home Depot Inc.",          sector:"Consumer Disc.", pe:22,  pb:null,evEbitda:16, beta:1.05, expectedReturn:12, volatility:20, dividend:2.5  },
  { ticker:"NKE",   name:"Nike Inc.",               sector:"Consumer Disc.", pe:30,  pb:10,  evEbitda:22, beta:1.05, expectedReturn:11, volatility:22, dividend:1.8  },
  { ticker:"MCD",   name:"McDonald's Corp.",         sector:"Consumer Disc.", pe:22,  pb:null,evEbitda:18, beta:0.75, expectedReturn:10, volatility:16, dividend:2.4  },
  // Energy
  { ticker:"XOM",   name:"Exxon Mobil Corp.",        sector:"Energy",         pe:14,  pb:2,   evEbitda:8,  beta:1.10, expectedReturn:10, volatility:22, dividend:3.6  },
  { ticker:"CVX",   name:"Chevron Corp.",            sector:"Energy",         pe:13,  pb:2,   evEbitda:7,  beta:1.05, expectedReturn:10, volatility:22, dividend:4.2  },
  { ticker:"COP",   name:"ConocoPhillips",           sector:"Energy",         pe:13,  pb:3,   evEbitda:7,  beta:1.20, expectedReturn:11, volatility:26, dividend:2.0  },
  // Industrials
  { ticker:"BA",    name:"Boeing Co.",               sector:"Industrials",    pe:null,pb:null,evEbitda:null,beta:1.40,expectedReturn:10, volatility:32, dividend:0.0  },
  { ticker:"CAT",   name:"Caterpillar Inc.",         sector:"Industrials",    pe:15,  pb:6,   evEbitda:12, beta:1.10, expectedReturn:12, volatility:24, dividend:1.8  },
  { ticker:"RTX",   name:"RTX Corp.",                sector:"Industrials",    pe:32,  pb:2,   evEbitda:16, beta:0.90, expectedReturn:10, volatility:20, dividend:2.2  },
  { ticker:"HON",   name:"Honeywell International",  sector:"Industrials",    pe:22,  pb:8,   evEbitda:16, beta:0.90, expectedReturn:10, volatility:18, dividend:2.2  },
  { ticker:"DE",    name:"Deere & Company",          sector:"Industrials",    pe:13,  pb:5,   evEbitda:10, beta:1.10, expectedReturn:11, volatility:24, dividend:1.4  },
  // Real Estate / Utilities
  { ticker:"NEE",   name:"NextEra Energy Inc.",      sector:"Utilities",      pe:20,  pb:3,   evEbitda:14, beta:0.50, expectedReturn:8,  volatility:18, dividend:2.8  },
  { ticker:"AMT",   name:"American Tower Corp.",     sector:"Real Estate",    pe:42,  pb:18,  evEbitda:22, beta:0.75, expectedReturn:10, volatility:20, dividend:3.0  },
  // Communications
  { ticker:"DIS",   name:"Walt Disney Co.",          sector:"Communications", pe:35,  pb:2,   evEbitda:16, beta:1.15, expectedReturn:10, volatility:24, dividend:0.0  },
  { ticker:"NFLX",  name:"Netflix Inc.",             sector:"Communications", pe:40,  pb:14,  evEbitda:28, beta:1.25, expectedReturn:15, volatility:32, dividend:0.0  },
  { ticker:"T",     name:"AT&T Inc.",                sector:"Communications", pe:14,  pb:1,   evEbitda:7,  beta:0.65, expectedReturn:7,  volatility:16, dividend:5.8  },
  { ticker:"VZ",    name:"Verizon Communications",   sector:"Communications", pe:10,  pb:2,   evEbitda:7,  beta:0.50, expectedReturn:7,  volatility:14, dividend:6.5  },
  // ETFs
  { ticker:"SPY",   name:"SPDR S&P 500 ETF",         sector:"ETF",            pe:22,  pb:4,   evEbitda:14, beta:1.00, expectedReturn:10, volatility:16, dividend:1.3  },
  { ticker:"QQQ",   name:"Invesco QQQ Trust",        sector:"ETF",            pe:30,  pb:8,   evEbitda:20, beta:1.20, expectedReturn:12, volatility:20, dividend:0.5  },
  { ticker:"IWM",   name:"iShares Russell 2000 ETF", sector:"ETF",            pe:18,  pb:2,   evEbitda:12, beta:1.25, expectedReturn:11, volatility:22, dividend:1.2  },
  { ticker:"GLD",   name:"SPDR Gold Shares",         sector:"Commodities",    pe:null,pb:null,evEbitda:null,beta:0.10,expectedReturn:6,  volatility:14, dividend:0.0  },
];

export const CHART_COLORS = [
  "#00ff9d", "#00c8ff", "#ffd700", "#c084fc", "#ff6b35",
  "#f97316", "#ef4444", "#06b6d4", "#8b5cf6", "#ec4899",
  "#14b8a6", "#84cc16", "#f59e0b", "#6366f1", "#d946ef",
  "#0ea5e9", "#22c55e", "#eab308", "#a855f7", "#f43f5e",
];
