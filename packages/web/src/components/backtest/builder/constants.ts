export const INDICATOR_TYPES = [
  { type: "SMA",  label: "Simple MA",   desc: "Smoothed price average",       params: ["period"] },
  { type: "EMA",  label: "Exp MA",      desc: "Faster-reacting average",       params: ["period"] },
  { type: "RSI",  label: "RSI",         desc: "Momentum oscillator 0–100",     params: ["period"] },
  { type: "MACD", label: "MACD",        desc: "Trend + momentum",              params: ["period"] },
  { type: "ICT",  label: "ICT",         desc: "FVG + liquidity sweeps",        params: ["period"] },
  { type: "VRVP", label: "VRVP",        desc: "Volume at price (POC/VAH/VAL)", params: ["period"] },
];

export const ENV_VARS = ["open", "high", "low", "close", "volume", "time"];

export const OPERATORS = [">", "<", ">=", "<=", "===", "!=="];

export const CONDITION_BLOCKS = [
  { id: "price_above_ma",  label: "Price above MA",  icon: "↑", category: "trend",    expr: "close > sma20",                       indRequired: [{name:"sma20",type:"SMA",period:20}] },
  { id: "price_below_ma",  label: "Price below MA",  icon: "↓", category: "trend",    expr: "close < sma20",                       indRequired: [{name:"sma20",type:"SMA",period:20}] },
  { id: "ma_cross_up",     label: "MA crosses up",   icon: "✕", category: "trend",    expr: "sma20 > sma50",                       indRequired: [{name:"sma20",type:"SMA",period:20},{name:"sma50",type:"SMA",period:50}] },
  { id: "rsi_oversold",    label: "RSI oversold",    icon: "◉", category: "momentum", expr: "rsi14 < 30",                          indRequired: [{name:"rsi14",type:"RSI",period:14}] },
  { id: "rsi_overbought",  label: "RSI overbought",  icon: "◎", category: "momentum", expr: "rsi14 > 70",                          indRequired: [{name:"rsi14",type:"RSI",period:14}] },
  { id: "volume_spike",    label: "Volume spike",    icon: "▲", category: "volume",   expr: "volume > 0",                          indRequired: [] },
  { id: "ict_fvg_bull",    label: "ICT Bull FVG",    icon: "⬡", category: "ict",      expr: "ict_fvg_bull === 1",                  indRequired: [{name:"ict",type:"ICT",period:10}] },
  { id: "ict_sweep_ssl",   label: "ICT SSL Sweep",   icon: "◈", category: "ict",      expr: "ict_sweep_ssl === 1",                 indRequired: [{name:"ict",type:"ICT",period:20}] },
  { id: "vrvp_poc_bounce", label: "VRVP POC Bounce", icon: "✦", category: "vrvp",     expr: "low <= vrvp_poc && close > vrvp_poc", indRequired: [{name:"vrvp",type:"VRVP",period:50}] },
];

export const PRESETS = [
  { label: "Golden Cross",        icon: "✦", desc: "Buy when fast MA crosses above slow MA",
    buyCondition: "sma20 > sma50",                      sellCondition: "sma20 < sma50",                stopLoss: 2,   takeProfit: 6,
    indicators: [{name:"sma20",type:"SMA",period:20},{name:"sma50",type:"SMA",period:50}] },
  { label: "RSI Oversold Bounce", icon: "◈", desc: "Buy dips, sell overbought",
    buyCondition: "rsi14 < 30",                         sellCondition: "rsi14 > 70",                   stopLoss: 3,   takeProfit: 9,
    indicators: [{name:"rsi14",type:"RSI",period:14}] },
  { label: "EMA Ribbon",          icon: "⬡", desc: "Trend-following with multiple EMAs",
    buyCondition: "ema8 > ema21 && ema21 > ema55",      sellCondition: "ema8 < ema21",                 stopLoss: 1.5, takeProfit: 4.5,
    indicators: [{name:"ema8",type:"EMA",period:8},{name:"ema21",type:"EMA",period:21},{name:"ema55",type:"EMA",period:55}] },
  { label: "ICT FVG",             icon: "◐", desc: "Trade fair value gaps with trend filter",
    buyCondition: "ict_fvg_bull === 1 && close > open", sellCondition: "ict_fvg_bear === 1",            stopLoss: 1.5, takeProfit: 4,
    indicators: [{name:"ict",type:"ICT",period:10}] },
  { label: "VRVP POC",            icon: "⬟", desc: "Bounce off volume point of control",
    buyCondition: "low <= vrvp_poc && close > vrvp_poc",sellCondition: "high >= vrvp_poc && close < vrvp_poc", stopLoss: 1.5, takeProfit: 3,
    indicators: [{name:"vrvp",type:"VRVP",period:50}] },
  { label: "ICT Sweep",           icon: "⟁", desc: "Enter after liquidity sweep events",
    buyCondition: "ict_sweep_ssl === 1",                sellCondition: "ict_sweep_bsl === 1",           stopLoss: 1.5, takeProfit: 4,
    indicators: [{name:"ict",type:"ICT",period:20}] },
];

export const NL_EXAMPLES = [
  "Buy when the 20-day average crosses above the 50-day average",
  "Enter long when RSI drops below 30 and price is above 200 EMA",
  "Buy on a bullish fair value gap with a 1.5% stop loss and 4% target",
];

export const DOCS_VARS = [
  { token: "close",          desc: "Current candle close price" },
  { token: "open",           desc: "Current candle open price" },
  { token: "high / low",     desc: "Candle high / low" },
  { token: "volume",         desc: "Current candle volume" },
  { token: "smaN / emaN",    desc: "SMA/EMA value (named indicator)" },
  { token: "rsiN",           desc: "RSI value 0–100" },
  { token: "ict_fvg_bull",   desc: "1 when bullish FVG present" },
  { token: "ict_fvg_bear",   desc: "1 when bearish FVG present" },
  { token: "ict_sweep_bsl",  desc: "1 on buy-side liquidity sweep" },
  { token: "ict_sweep_ssl",  desc: "1 on sell-side liquidity sweep" },
  { token: "vrvp_poc",       desc: "Point of Control price" },
  { token: "vrvp_vah / val", desc: "Value Area High / Low" },
];

export const EXPERT_TEMPLATES: Record<string, { label: string; code: string }> = {
  sma: { label: "SMA Cross", code: `{
  "name": "SMA Crossover",
  "initialBalance": 10000,
  "buyCondition": "sma20 > sma50",
  "sellCondition": "sma20 < sma50",
  "stopLossPct": 2,
  "takeProfitPct": 5,
  "entryFeePct": 0.05,
  "exitFeePct": 0.05,
  "slippagePct": 0.1,
  "indicators": [
    { "name": "sma20", "type": "SMA", "period": 20 },
    { "name": "sma50", "type": "SMA", "period": 50 }
  ]
}` },
  ict: { label: "ICT Combo", code: `{
  "name": "ICT FVG + Sweep",
  "initialBalance": 10000,
  "buyCondition": "ict_fvg_bull === 1 && close > open",
  "sellCondition": "ict_fvg_bear === 1 || ict_sweep_bsl === 1",
  "stopLossPct": 1.5,
  "takeProfitPct": 4,
  "entryFeePct": 0.05,
  "exitFeePct": 0.05,
  "slippagePct": 0.05,
  "indicators": [
    { "name": "ict", "type": "ICT", "period": 10 }
  ]
}` },
  vrvp: { label: "VRVP + RSI", code: `{
  "name": "VRVP POC + RSI Filter",
  "initialBalance": 10000,
  "buyCondition": "low <= vrvp_poc && close > vrvp_poc && rsi14 < 50",
  "sellCondition": "high >= vrvp_poc && close < vrvp_poc || rsi14 > 70",
  "stopLossPct": 1.5,
  "takeProfitPct": 3,
  "entryFeePct": 0.05,
  "exitFeePct": 0.05,
  "indicators": [
    { "name": "vrvp", "type": "VRVP", "period": 50 },
    { "name": "rsi14", "type": "RSI", "period": 14 }
  ]
}` },
  portfolio: { label: "Portfolio", code: `{
  "name": "Multi-Symbol EMA",
  "initialBalance": 10000,
  "buyCondition": "ema21 > ema55",
  "sellCondition": "ema21 < ema55",
  "stopLossPct": 2,
  "takeProfitPct": 6,
  "entryFeePct": 0.05,
  "exitFeePct": 0.05,
  "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
  "indicators": [
    { "name": "ema21", "type": "EMA", "period": 21 },
    { "name": "ema55", "type": "EMA", "period": 55 }
  ]
}` },
};

export const TABS = [
  { id: "wizard",  label: "GUIDED",        icon: "◈", badge: "BEGINNER"     },
  { id: "blocks",  label: "DRAG & DROP",   icon: "⬡", badge: "BEGINNER"     },
  { id: "natural", label: "PLAIN ENGLISH", icon: "✦", badge: "BEGINNER"     },
  { id: "visual",  label: "VISUAL RULES",  icon: "⊞", badge: "INTERMEDIATE" },
  { id: "expert",  label: "CODE EDITOR",   icon: "⌨", badge: "EXPERT"       },
] as const;

export const BADGE_COLOR: Record<string, string> = {
  BEGINNER:     "#00ffc8",
  INTERMEDIATE: "#7b9fff",
  EXPERT:       "#ff9900",
};

export const DEFAULT_SHARED = {
  selectedPreset: null as string | null,
  buyCondition:   "sma20 > sma50",
  sellCondition:  "sma20 < sma50",
  stopLoss:       2,
  takeProfit:     5,
  balance:        10000,
  entryFee:       0.05,
  exitFee:        0.05,
  slippage:       0.1,
  indicators:     [
    { name: "sma20", type: "SMA", period: 20 },
    { name: "sma50", type: "SMA", period: 50 },
  ] as { name: string; type: string; period: number }[],
};

export type SharedState = typeof DEFAULT_SHARED;
