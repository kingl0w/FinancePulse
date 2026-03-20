use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use chrono::{Duration, Utc};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::models::HistoricalCandle;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/search", get(search))
        .route("/compare", get(compare))
        .route("/{symbol}/quote", get(get_quote))
        .route("/{symbol}/history", get(get_history))
}

#[derive(Debug, Serialize)]
struct QuoteResponse {
    symbol: String,
    price: Option<f64>,
    volume: Option<f64>,
    change_24h: Option<f64>,
    change_percent_24h: Option<f64>,
    market_cap: Option<f64>,
    source: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    stale: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HistoryQuery {
    range: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct IndicatorsQuery {
    range: Option<String>,
    indicators: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    q: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CompareQuery {
    symbols: Option<String>,
    range: Option<String>,
}

#[derive(Debug, Serialize)]
struct CompareResponse {
    series: std::collections::HashMap<String, Vec<ComparePoint>>,
}

#[derive(Debug, Serialize)]
struct ComparePoint {
    timestamp: chrono::DateTime<chrono::Utc>,
    pct_change: f64,
}

#[derive(Debug, Serialize)]
struct SearchResult {
    symbol: String,
    name: String,
    asset_type: String,
}

struct SymbolEntry {
    symbol: &'static str,
    name: &'static str,
    asset_type: &'static str,
}

const CRYPTO_SYMBOLS: &[SymbolEntry] = &[
    SymbolEntry { symbol: "BTC", name: "Bitcoin", asset_type: "crypto" },
    SymbolEntry { symbol: "ETH", name: "Ethereum", asset_type: "crypto" },
    SymbolEntry { symbol: "SOL", name: "Solana", asset_type: "crypto" },
    SymbolEntry { symbol: "BNB", name: "Binance Coin", asset_type: "crypto" },
    SymbolEntry { symbol: "XRP", name: "Ripple", asset_type: "crypto" },
    SymbolEntry { symbol: "ADA", name: "Cardano", asset_type: "crypto" },
    SymbolEntry { symbol: "DOGE", name: "Dogecoin", asset_type: "crypto" },
    SymbolEntry { symbol: "DOT", name: "Polkadot", asset_type: "crypto" },
    SymbolEntry { symbol: "AVAX", name: "Avalanche", asset_type: "crypto" },
    SymbolEntry { symbol: "LINK", name: "Chainlink", asset_type: "crypto" },
    SymbolEntry { symbol: "POL", name: "Polygon", asset_type: "crypto" },
    SymbolEntry { symbol: "LTC", name: "Litecoin", asset_type: "crypto" },
    SymbolEntry { symbol: "UNI", name: "Uniswap", asset_type: "crypto" },
    SymbolEntry { symbol: "NEAR", name: "NEAR Protocol", asset_type: "crypto" },
    SymbolEntry { symbol: "ICP", name: "Internet Computer", asset_type: "crypto" },
    SymbolEntry { symbol: "APT", name: "Aptos", asset_type: "crypto" },
    SymbolEntry { symbol: "ARB", name: "Arbitrum", asset_type: "crypto" },
    SymbolEntry { symbol: "OP", name: "Optimism", asset_type: "crypto" },
    SymbolEntry { symbol: "SUI", name: "Sui", asset_type: "crypto" },
    SymbolEntry { symbol: "XLM", name: "Stellar", asset_type: "crypto" },
    SymbolEntry { symbol: "MATIC", name: "Polygon (MATIC)", asset_type: "crypto" },
    SymbolEntry { symbol: "SHIB", name: "Shiba Inu", asset_type: "crypto" },
    SymbolEntry { symbol: "BCH", name: "Bitcoin Cash", asset_type: "crypto" },
    SymbolEntry { symbol: "AAVE", name: "Aave", asset_type: "crypto" },
    SymbolEntry { symbol: "ATOM", name: "Cosmos", asset_type: "crypto" },
    SymbolEntry { symbol: "FIL", name: "Filecoin", asset_type: "crypto" },
    SymbolEntry { symbol: "APE", name: "ApeCoin", asset_type: "crypto" },
    SymbolEntry { symbol: "PEPE", name: "Pepe", asset_type: "crypto" },
    SymbolEntry { symbol: "IMX", name: "Immutable X", asset_type: "crypto" },
    SymbolEntry { symbol: "RENDER", name: "Render", asset_type: "crypto" },
    SymbolEntry { symbol: "FET", name: "Fetch.ai", asset_type: "crypto" },
    SymbolEntry { symbol: "GRT", name: "The Graph", asset_type: "crypto" },
    SymbolEntry { symbol: "INJ", name: "Injective", asset_type: "crypto" },
    SymbolEntry { symbol: "SEI", name: "Sei", asset_type: "crypto" },
    SymbolEntry { symbol: "HBAR", name: "Hedera", asset_type: "crypto" },
    SymbolEntry { symbol: "ALGO", name: "Algorand", asset_type: "crypto" },
    SymbolEntry { symbol: "SAND", name: "The Sandbox", asset_type: "crypto" },
    SymbolEntry { symbol: "MANA", name: "Decentraland", asset_type: "crypto" },
    SymbolEntry { symbol: "AXS", name: "Axie Infinity", asset_type: "crypto" },
    SymbolEntry { symbol: "CRV", name: "Curve DAO", asset_type: "crypto" },
    SymbolEntry { symbol: "MKR", name: "Maker", asset_type: "crypto" },
    SymbolEntry { symbol: "COMP", name: "Compound", asset_type: "crypto" },
    SymbolEntry { symbol: "SNX", name: "Synthetix", asset_type: "crypto" },
    SymbolEntry { symbol: "LDO", name: "Lido DAO", asset_type: "crypto" },
];

const SYMBOLS: &[SymbolEntry] = &[
    SymbolEntry { symbol: "AAPL", name: "Apple Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "MSFT", name: "Microsoft Corporation", asset_type: "stock" },
    SymbolEntry { symbol: "GOOGL", name: "Alphabet Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "AMZN", name: "Amazon.com Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "TSLA", name: "Tesla Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "NVDA", name: "NVIDIA Corporation", asset_type: "stock" },
    SymbolEntry { symbol: "META", name: "Meta Platforms Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "BRK.B", name: "Berkshire Hathaway Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "JPM", name: "JPMorgan Chase & Co.", asset_type: "stock" },
    SymbolEntry { symbol: "V", name: "Visa Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "JNJ", name: "Johnson & Johnson", asset_type: "stock" },
    SymbolEntry { symbol: "WMT", name: "Walmart Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "PG", name: "Procter & Gamble Co.", asset_type: "stock" },
    SymbolEntry { symbol: "MA", name: "Mastercard Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "UNH", name: "UnitedHealth Group Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "HD", name: "Home Depot Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "DIS", name: "Walt Disney Co.", asset_type: "stock" },
    SymbolEntry { symbol: "PYPL", name: "PayPal Holdings Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "NFLX", name: "Netflix Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "ADBE", name: "Adobe Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "CRM", name: "Salesforce Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "AMD", name: "Advanced Micro Devices Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "INTC", name: "Intel Corporation", asset_type: "stock" },
    SymbolEntry { symbol: "CSCO", name: "Cisco Systems Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "ORCL", name: "Oracle Corporation", asset_type: "stock" },
    SymbolEntry { symbol: "BA", name: "Boeing Co.", asset_type: "stock" },
    SymbolEntry { symbol: "GS", name: "Goldman Sachs Group Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "IBM", name: "IBM", asset_type: "stock" },
    SymbolEntry { symbol: "SQ", name: "Block Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "SHOP", name: "Shopify Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "COIN", name: "Coinbase Global", asset_type: "stock" },
    SymbolEntry { symbol: "UBER", name: "Uber Technologies", asset_type: "stock" },
    SymbolEntry { symbol: "ABNB", name: "Airbnb Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "COST", name: "Costco Wholesale", asset_type: "stock" },
    SymbolEntry { symbol: "PFE", name: "Pfizer Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "PLTR", name: "Palantir Technologies", asset_type: "stock" },
    SymbolEntry { symbol: "SOFI", name: "SoFi Technologies", asset_type: "stock" },
    SymbolEntry { symbol: "RIVN", name: "Rivian Automotive", asset_type: "stock" },
    SymbolEntry { symbol: "LCID", name: "Lucid Group", asset_type: "stock" },
    SymbolEntry { symbol: "F", name: "Ford Motor Co.", asset_type: "stock" },
    SymbolEntry { symbol: "GM", name: "General Motors", asset_type: "stock" },
    SymbolEntry { symbol: "T", name: "AT&T Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "VZ", name: "Verizon Communications", asset_type: "stock" },
    SymbolEntry { symbol: "PEP", name: "PepsiCo Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "KO", name: "Coca-Cola Co.", asset_type: "stock" },
    SymbolEntry { symbol: "MCD", name: "McDonald's Corp.", asset_type: "stock" },
    SymbolEntry { symbol: "SBUX", name: "Starbucks Corp.", asset_type: "stock" },
    SymbolEntry { symbol: "NKE", name: "Nike Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "BABA", name: "Alibaba Group", asset_type: "stock" },
    SymbolEntry { symbol: "TSM", name: "Taiwan Semiconductor", asset_type: "stock" },
    SymbolEntry { symbol: "AVGO", name: "Broadcom Inc.", asset_type: "stock" },
    SymbolEntry { symbol: "LLY", name: "Eli Lilly & Co.", asset_type: "stock" },
    SymbolEntry { symbol: "XOM", name: "Exxon Mobil Corp.", asset_type: "stock" },
    SymbolEntry { symbol: "CVX", name: "Chevron Corp.", asset_type: "stock" },
    SymbolEntry { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", asset_type: "etf" },
    SymbolEntry { symbol: "QQQ", name: "Invesco QQQ Trust", asset_type: "etf" },
    SymbolEntry { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF", asset_type: "etf" },
    SymbolEntry { symbol: "IWM", name: "iShares Russell 2000 ETF", asset_type: "etf" },
    SymbolEntry { symbol: "XLF", name: "Financial Select Sector SPDR", asset_type: "etf" },
    SymbolEntry { symbol: "XLK", name: "Technology Select Sector SPDR", asset_type: "etf" },
    SymbolEntry { symbol: "XLE", name: "Energy Select Sector SPDR", asset_type: "etf" },
    SymbolEntry { symbol: "XLV", name: "Health Care Select Sector SPDR", asset_type: "etf" },
    SymbolEntry { symbol: "EFA", name: "iShares MSCI EAFE ETF", asset_type: "etf" },
    SymbolEntry { symbol: "EEM", name: "iShares MSCI Emerging Markets ETF", asset_type: "etf" },
    SymbolEntry { symbol: "AGG", name: "iShares Core US Aggregate Bond ETF", asset_type: "etf" },
    SymbolEntry { symbol: "ARKK", name: "ARK Innovation ETF", asset_type: "etf" },
    SymbolEntry { symbol: "SOXL", name: "Direxion Semiconductor Bull 3X", asset_type: "etf" },
    SymbolEntry { symbol: "TQQQ", name: "ProShares UltraPro QQQ", asset_type: "etf" },
    SymbolEntry { symbol: "VTI", name: "Vanguard Total Stock Market ETF", asset_type: "etf" },
    SymbolEntry { symbol: "VOO", name: "Vanguard S&P 500 ETF", asset_type: "etf" },
    SymbolEntry { symbol: "GLD", name: "SPDR Gold Shares", asset_type: "commodity" },
    SymbolEntry { symbol: "SLV", name: "iShares Silver Trust", asset_type: "commodity" },
    SymbolEntry { symbol: "USO", name: "United States Oil Fund", asset_type: "commodity" },
    SymbolEntry { symbol: "UNG", name: "United States Natural Gas Fund", asset_type: "commodity" },
    SymbolEntry { symbol: "WEAT", name: "Teucrium Wheat Fund", asset_type: "commodity" },
    SymbolEntry { symbol: "CORN", name: "Teucrium Corn Fund", asset_type: "commodity" },
    SymbolEntry { symbol: "DBA", name: "Invesco DB Agriculture Fund", asset_type: "commodity" },
    SymbolEntry { symbol: "PDBC", name: "Invesco Optimum Yield Commodity ETF", asset_type: "commodity" },
    SymbolEntry { symbol: "GOVT", name: "iShares US Treasury Bond ETF", asset_type: "bonds" },
    SymbolEntry { symbol: "HYG", name: "iShares iBoxx High Yield Bond ETF", asset_type: "bonds" },
    SymbolEntry { symbol: "LQD", name: "iShares Investment Grade Bond ETF", asset_type: "bonds" },
    SymbolEntry { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", asset_type: "bonds" },
    SymbolEntry { symbol: "VIXY", name: "ProShares VIX Short-Term Futures ETF", asset_type: "etf" },
    SymbolEntry { symbol: "BTC", name: "Bitcoin", asset_type: "crypto" },
    SymbolEntry { symbol: "ETH", name: "Ethereum", asset_type: "crypto" },
    SymbolEntry { symbol: "SOL", name: "Solana", asset_type: "crypto" },
    SymbolEntry { symbol: "BNB", name: "BNB", asset_type: "crypto" },
    SymbolEntry { symbol: "XRP", name: "Ripple", asset_type: "crypto" },
    SymbolEntry { symbol: "ADA", name: "Cardano", asset_type: "crypto" },
    SymbolEntry { symbol: "DOGE", name: "Dogecoin", asset_type: "crypto" },
    SymbolEntry { symbol: "DOT", name: "Polkadot", asset_type: "crypto" },
    SymbolEntry { symbol: "AVAX", name: "Avalanche", asset_type: "crypto" },
    SymbolEntry { symbol: "LINK", name: "Chainlink", asset_type: "crypto" },
    SymbolEntry { symbol: "POL", name: "Polygon", asset_type: "crypto" },
    SymbolEntry { symbol: "LTC", name: "Litecoin", asset_type: "crypto" },
    SymbolEntry { symbol: "UNI", name: "Uniswap", asset_type: "crypto" },
    SymbolEntry { symbol: "NEAR", name: "NEAR Protocol", asset_type: "crypto" },
    SymbolEntry { symbol: "ICP", name: "Internet Computer", asset_type: "crypto" },
    SymbolEntry { symbol: "APT", name: "Aptos", asset_type: "crypto" },
    SymbolEntry { symbol: "ARB", name: "Arbitrum", asset_type: "crypto" },
    SymbolEntry { symbol: "OP", name: "Optimism", asset_type: "crypto" },
    SymbolEntry { symbol: "SUI", name: "Sui", asset_type: "crypto" },
    SymbolEntry { symbol: "XLM", name: "Stellar", asset_type: "crypto" },
    SymbolEntry { symbol: "MATIC", name: "Polygon (MATIC)", asset_type: "crypto" },
    SymbolEntry { symbol: "SHIB", name: "Shiba Inu", asset_type: "crypto" },
    SymbolEntry { symbol: "BCH", name: "Bitcoin Cash", asset_type: "crypto" },
    SymbolEntry { symbol: "AAVE", name: "Aave", asset_type: "crypto" },
    SymbolEntry { symbol: "ATOM", name: "Cosmos", asset_type: "crypto" },
    SymbolEntry { symbol: "FIL", name: "Filecoin", asset_type: "crypto" },
    SymbolEntry { symbol: "APE", name: "ApeCoin", asset_type: "crypto" },
    SymbolEntry { symbol: "PEPE", name: "Pepe", asset_type: "crypto" },
    SymbolEntry { symbol: "IMX", name: "Immutable X", asset_type: "crypto" },
    SymbolEntry { symbol: "RENDER", name: "Render", asset_type: "crypto" },
    SymbolEntry { symbol: "FET", name: "Fetch.ai", asset_type: "crypto" },
    SymbolEntry { symbol: "GRT", name: "The Graph", asset_type: "crypto" },
    SymbolEntry { symbol: "INJ", name: "Injective", asset_type: "crypto" },
    SymbolEntry { symbol: "SEI", name: "Sei", asset_type: "crypto" },
    SymbolEntry { symbol: "HBAR", name: "Hedera", asset_type: "crypto" },
    SymbolEntry { symbol: "ALGO", name: "Algorand", asset_type: "crypto" },
    SymbolEntry { symbol: "SAND", name: "The Sandbox", asset_type: "crypto" },
    SymbolEntry { symbol: "MANA", name: "Decentraland", asset_type: "crypto" },
    SymbolEntry { symbol: "AXS", name: "Axie Infinity", asset_type: "crypto" },
    SymbolEntry { symbol: "CRV", name: "Curve DAO", asset_type: "crypto" },
    SymbolEntry { symbol: "MKR", name: "Maker", asset_type: "crypto" },
    SymbolEntry { symbol: "COMP", name: "Compound", asset_type: "crypto" },
    SymbolEntry { symbol: "SNX", name: "Synthetix", asset_type: "crypto" },
    SymbolEntry { symbol: "LDO", name: "Lido DAO", asset_type: "crypto" },
    // Yahoo indices
    SymbolEntry { symbol: "SP500", name: "S&P 500", asset_type: "index" },
    SymbolEntry { symbol: "DOW", name: "Dow Jones", asset_type: "index" },
    SymbolEntry { symbol: "NASDAQ", name: "Nasdaq Composite", asset_type: "index" },
    SymbolEntry { symbol: "RUSSELL", name: "Russell 2000", asset_type: "index" },
    SymbolEntry { symbol: "VIX", name: "VIX Volatility", asset_type: "index" },
    SymbolEntry { symbol: "FTSE", name: "FTSE 100", asset_type: "index" },
    SymbolEntry { symbol: "NIKKEI", name: "Nikkei 225", asset_type: "index" },
    SymbolEntry { symbol: "HSI", name: "Hang Seng", asset_type: "index" },
    SymbolEntry { symbol: "DAX", name: "DAX", asset_type: "index" },
    // Yahoo commodity futures
    SymbolEntry { symbol: "GOLD", name: "Gold", asset_type: "commodity" },
    SymbolEntry { symbol: "SILVER", name: "Silver", asset_type: "commodity" },
    SymbolEntry { symbol: "CRUDE_OIL", name: "Crude Oil WTI", asset_type: "commodity" },
    SymbolEntry { symbol: "BRENT", name: "Brent Crude", asset_type: "commodity" },
    SymbolEntry { symbol: "NATGAS", name: "Natural Gas", asset_type: "commodity" },
    SymbolEntry { symbol: "COPPER", name: "Copper", asset_type: "commodity" },
    SymbolEntry { symbol: "PLATINUM", name: "Platinum", asset_type: "commodity" },
    SymbolEntry { symbol: "PALLADIUM", name: "Palladium", asset_type: "commodity" },
    SymbolEntry { symbol: "CORN_F", name: "Corn Futures", asset_type: "commodity" },
    SymbolEntry { symbol: "WHEAT_F", name: "Wheat Futures", asset_type: "commodity" },
    SymbolEntry { symbol: "SOYBEANS", name: "Soybeans", asset_type: "commodity" },
    SymbolEntry { symbol: "COFFEE", name: "Coffee", asset_type: "commodity" },
    SymbolEntry { symbol: "COTTON", name: "Cotton", asset_type: "commodity" },
    SymbolEntry { symbol: "SUGAR", name: "Sugar", asset_type: "commodity" },
    // Yahoo treasury yields
    SymbolEntry { symbol: "US10Y", name: "10Y Treasury Yield", asset_type: "bonds" },
    SymbolEntry { symbol: "US30Y", name: "30Y Treasury Yield", asset_type: "bonds" },
    SymbolEntry { symbol: "US5Y", name: "5Y Treasury Yield", asset_type: "bonds" },
];

fn is_crypto(symbol: &str) -> bool {
    CRYPTO_SYMBOLS.iter().any(|s| s.symbol == symbol)
}

async fn get_quote(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
) -> Result<Json<QuoteResponse>, AppError> {
    use fred::interfaces::KeysInterface;
    let symbol = symbol.trim().to_uppercase();

    let mut live_price: Option<f64> = None;
    let mut live_volume: Option<f64> = None;
    let mut live_source: Option<String> = None;
    {
        let price_key = format!("price:{symbol}");
        if let Ok(Some(json_str)) = state.redis.get::<Option<String>, _>(&price_key).await {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                live_price = parsed.get("price").and_then(|p| p.as_f64());
                live_volume = parsed.get("volume").and_then(|v| v.as_f64());
                live_source = parsed
                    .get("source")
                    .and_then(|s| s.as_str())
                    .map(|s| s.to_string());
            }
        }
    }

    let mut meta_price: Option<f64> = None;
    let mut meta_volume: Option<f64> = None;
    let mut meta_change_pct: Option<f64> = None;
    let mut meta_market_cap: Option<f64> = None;
    {
        let cache_key = format!("crypto:meta:{symbol}");
        if let Ok(Some(json_str)) = state.redis.get::<Option<String>, _>(&cache_key).await {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                meta_price = parsed.get("price").and_then(|p| p.as_f64());
                meta_volume = parsed.get("total_volume").and_then(|v| v.as_f64());
                meta_change_pct = parsed.get("price_change_24h_pct").and_then(|v| v.as_f64());
                meta_market_cap = parsed.get("market_cap").and_then(|v| v.as_f64());
            }
        }
    }

    let mut stock_volume: Option<f64> = None;
    let mut stock_market_cap: Option<f64> = None;
    let mut stock_change_pct: Option<f64> = None;
    let mut stock_price: Option<f64> = None;
    {
        let stock_key = format!("stock:meta:{symbol}");
        if let Ok(Some(json_str)) = state.redis.get::<Option<String>, _>(&stock_key).await {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                stock_price = parsed.get("price").and_then(|p| p.as_f64());
                stock_volume = parsed.get("volume_24h").and_then(|v| v.as_f64());
                stock_market_cap = parsed.get("market_cap").and_then(|v| v.as_f64());
                stock_change_pct = parsed.get("price_change_24h_pct").and_then(|v| v.as_f64());
            }
        }
    }

    // Check Yahoo index/commodity/bonds cache
    let mut yahoo_price: Option<f64> = None;
    let mut yahoo_volume: Option<f64> = None;
    let mut yahoo_change_pct: Option<f64> = None;
    {
        let yahoo_key = format!("yahoo:index:{symbol}");
        if let Ok(Some(json_str)) = state.redis.get::<Option<String>, _>(&yahoo_key).await {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                yahoo_price = parsed.get("price").and_then(|p| p.as_f64());
                yahoo_volume = parsed.get("volume_24h").and_then(|v| v.as_f64());
                yahoo_change_pct = parsed.get("change_percent").and_then(|v| v.as_f64());
            }
        }
    }

    let price = live_price.or(meta_price).or(stock_price).or(yahoo_price);
    if let Some(p) = price {
        let source = live_source.unwrap_or_else(|| {
            if is_crypto(&symbol) {
                "coingecko".to_string()
            } else if yahoo_price.is_some() {
                "yahoo".to_string()
            } else {
                "finnhub".to_string()
            }
        });
        return Ok(Json(QuoteResponse {
            symbol,
            price: Some(p),
            volume: live_volume.or(meta_volume).or(stock_volume).or(yahoo_volume),
            change_24h: None,
            change_percent_24h: meta_change_pct.or(stock_change_pct).or(yahoo_change_pct),
            market_cap: meta_market_cap.or(stock_market_cap),
            source,
            stale: None,
            message: None,
        }));
    }

    if !is_crypto(&symbol) && !crate::ingestion::yahoo::is_yahoo_extra(&symbol) && !state.config.finnhub_api_key.is_empty() {
        match crate::ingestion::finnhub::fetch_quote(&symbol, &state.config.finnhub_api_key).await {
            Ok(quote) => {
                return Ok(Json(QuoteResponse {
                    symbol,
                    price: Some(quote.c),
                    volume: None,
                    change_24h: quote.d,
                    change_percent_24h: quote.dp,
                    market_cap: None,
                    source: "finnhub".to_string(),
                    stale: None,
                    message: None,
                }));
            }
            Err(e) => {
                tracing::warn!("Finnhub quote fallback failed for {symbol}: {e}");
            }
        }
    }

    Ok(Json(QuoteResponse {
        symbol,
        price: None,
        volume: None,
        change_24h: None,
        change_percent_24h: None,
        market_cap: None,
        source: "none".to_string(),
        stale: Some(true),
        message: Some("Price data temporarily unavailable".to_string()),
    }))
}

async fn get_history(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(query): Query<HistoryQuery>,
) -> Result<Json<Vec<HistoricalCandle>>, AppError> {
    let symbol = symbol.trim().to_uppercase();
    let range = query.range.unwrap_or_else(|| "1M".to_string());
    let candles = fetch_candles(&state, &symbol, &range).await?;
    Ok(Json(candles))
}

async fn compare(
    State(state): State<AppState>,
    Query(query): Query<CompareQuery>,
) -> Result<Json<CompareResponse>, AppError> {
    let symbols_str = query.symbols.unwrap_or_default();
    let range = query.range.unwrap_or_else(|| "1M".to_string());

    let symbols: Vec<String> = symbols_str
        .split(',')
        .map(|s| s.trim().to_uppercase())
        .filter(|s| !s.is_empty())
        .collect();

    if symbols.is_empty() {
        return Err(AppError::BadRequest("No symbols provided".to_string()));
    }
    if symbols.len() > 4 {
        return Err(AppError::BadRequest("Maximum 4 symbols allowed".to_string()));
    }

    let mut series = std::collections::HashMap::new();

    for sym in &symbols {
        match fetch_candles(&state, sym, &range).await {
            Ok(candles) if !candles.is_empty() => {
                let base_price = candles[0].close;
                if base_price == 0.0 {
                    continue;
                }
                let points: Vec<ComparePoint> = candles
                    .iter()
                    .map(|c| ComparePoint {
                        timestamp: c.timestamp,
                        pct_change: ((c.close - base_price) / base_price) * 100.0,
                    })
                    .collect();
                series.insert(sym.clone(), points);
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!("Compare: failed to fetch candles for {sym}: {e}");
            }
        }
    }

    Ok(Json(CompareResponse { series }))
}

async fn fetch_candles(
    state: &AppState,
    symbol: &str,
    range: &str,
) -> Result<Vec<HistoricalCandle>, AppError> {
    let is_intraday = matches!(range, "1m" | "5m" | "15m" | "30m" | "1H");

    let since = match range {
        "1m" | "5m" | "15m" | "30m" => Utc::now() - Duration::days(1),
        "1H" => Utc::now() - Duration::days(2),
        "1D" => Utc::now() - Duration::days(1),
        "1W" => Utc::now() - Duration::weeks(1),
        "1M" => Utc::now() - Duration::days(30),
        "3M" => Utc::now() - Duration::days(90),
        "1Y" => Utc::now() - Duration::days(365),
        _ => {
            return Err(AppError::BadRequest(
                "Invalid range. Use: 1m, 5m, 15m, 30m, 1H, 1D, 1W, 1M, 3M, 1Y".to_string(),
            ))
        }
    };

    if !is_intraday {
        let candles = sqlx::query_as::<_, HistoricalCandle>(
            "SELECT symbol, timestamp, open, high, low, close, volume \
             FROM price_history \
             WHERE symbol = $1 AND timestamp >= $2 \
             ORDER BY timestamp ASC",
        )
        .bind(symbol)
        .bind(since)
        .fetch_all(&state.db)
        .await?;

        if !candles.is_empty() {
            return Ok(candles);
        }
    }

    // For Yahoo-sourced indices/commodities/bonds, fetch from Yahoo using the mapped symbol
    if let Some(yahoo_sym) = crate::ingestion::yahoo::clean_to_yahoo_symbol(symbol) {
        match fetch_yahoo_history(yahoo_sym, range).await {
            Ok(fetched) if !fetched.is_empty() => {
                // Re-label candles with the clean symbol for consistency
                let fetched: Vec<HistoricalCandle> = fetched
                    .into_iter()
                    .map(|mut c| { c.symbol = symbol.to_string(); c })
                    .collect();
                if !is_intraday {
                    for candle in &fetched {
                        let _ = sqlx::query(
                            "INSERT INTO price_history (id, symbol, timestamp, open, high, low, close, volume) \
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
                             ON CONFLICT DO NOTHING",
                        )
                        .bind(uuid::Uuid::new_v4())
                        .bind(&candle.symbol)
                        .bind(candle.timestamp)
                        .bind(candle.open)
                        .bind(candle.high)
                        .bind(candle.low)
                        .bind(candle.close)
                        .bind(candle.volume)
                        .execute(&state.db)
                        .await;
                    }
                }
                return Ok(fetched);
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!("Yahoo history fetch failed for {symbol} ({yahoo_sym}): {e}");
            }
        }
        return Ok(vec![]);
    }

    if is_crypto(symbol) {
        let days = match range {
            "1m" | "5m" | "15m" | "30m" | "1D" => 1,
            "1H" => 2,
            "1W" => 7,
            "1M" => 30,
            "3M" => 90,
            "1Y" => 365,
            _ => 30,
        };
        if let Some(cg_id) = crate::ingestion::coingecko::symbol_to_coingecko_id(symbol) {
            match crate::ingestion::coingecko::fetch_market_chart(cg_id, days).await {
                Ok(points) if !points.is_empty() => {
                    let fetched = synthesize_candles_with_interval(symbol, &points, range);
                    if !is_intraday {
                        for candle in &fetched {
                            let _ = sqlx::query(
                                "INSERT INTO price_history (id, symbol, timestamp, open, high, low, close, volume) \
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
                                 ON CONFLICT DO NOTHING",
                            )
                            .bind(uuid::Uuid::new_v4())
                            .bind(&candle.symbol)
                            .bind(candle.timestamp)
                            .bind(candle.open)
                            .bind(candle.high)
                            .bind(candle.low)
                            .bind(candle.close)
                            .bind(candle.volume)
                            .execute(&state.db)
                            .await;
                        }
                    }
                    return Ok(fetched);
                }
                Ok(_) => {}
                Err(e) => {
                    tracing::warn!("CoinGecko history fetch failed for {symbol}: {e}");
                }
            }
        }
    } else {
        match fetch_finnhub_history(state, symbol, range).await {
            Ok(fetched) if !fetched.is_empty() => return Ok(fetched),
            Ok(_) => {}
            Err(e) => {
                tracing::warn!("Finnhub candle fetch failed for {symbol}: {e}");
            }
        }

        match fetch_yahoo_history(symbol, range).await {
            Ok(fetched) if !fetched.is_empty() => {
                if !is_intraday {
                    for candle in &fetched {
                        let _ = sqlx::query(
                            "INSERT INTO price_history (id, symbol, timestamp, open, high, low, close, volume) \
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
                             ON CONFLICT DO NOTHING",
                        )
                        .bind(uuid::Uuid::new_v4())
                        .bind(&candle.symbol)
                        .bind(candle.timestamp)
                        .bind(candle.open)
                        .bind(candle.high)
                        .bind(candle.low)
                        .bind(candle.close)
                        .bind(candle.volume)
                        .execute(&state.db)
                        .await;
                    }
                }
                return Ok(fetched);
            }
            Ok(_) => {}
            Err(e) => {
                tracing::warn!("Yahoo Finance candle fetch failed for {symbol}: {e}");
            }
        }
    }

    Ok(vec![])
}

async fn fetch_finnhub_history(
    state: &AppState,
    symbol: &str,
    range: &str,
) -> Result<Vec<HistoricalCandle>, AppError> {
    if state.config.finnhub_api_key.is_empty() {
        return Err(AppError::ExternalApi(
            "FINNHUB_API_KEY not configured".to_string(),
        ));
    }

    let now = Utc::now().timestamp();

    let (resolution, from) = match range {
        "1m" => ("1", now - 86400),
        "5m" => ("5", now - 86400),
        "15m" => ("15", now - 2 * 86400),
        "30m" => ("30", now - 2 * 86400),
        "1H" => ("60", now - 5 * 86400),
        "1D" => ("5", now - 86400),
        "1W" => ("15", now - 7 * 86400),
        "1M" => ("D", now - 30 * 86400),
        "3M" => ("D", now - 90 * 86400),
        "1Y" => ("W", now - 365 * 86400),
        _ => ("D", now - 30 * 86400),
    };

    tracing::info!(
        symbol = symbol,
        range = range,
        resolution = resolution,
        from = from,
        to = now,
        "Fetching Finnhub candles"
    );

    let candles = crate::ingestion::finnhub::fetch_candles(
        symbol,
        resolution,
        from,
        now,
        &state.config.finnhub_api_key,
    )
    .await
    .map_err(|e| AppError::ExternalApi(e))?;

    tracing::info!(
        symbol = symbol,
        status = %candles.s,
        count = candles.t.as_ref().map(|t| t.len()).unwrap_or(0),
        "Finnhub candles response"
    );

    if candles.s != "ok" {
        return Ok(vec![]);
    }

    let timestamps = candles.t.unwrap_or_default();
    let opens = candles.o.unwrap_or_default();
    let highs = candles.h.unwrap_or_default();
    let lows = candles.l.unwrap_or_default();
    let closes = candles.c.unwrap_or_default();
    let volumes = candles.v.unwrap_or_default();

    let len = timestamps.len();
    let mut result = Vec::with_capacity(len);

    for i in 0..len {
        let ts = chrono::DateTime::from_timestamp(timestamps[i], 0)
            .unwrap_or_else(|| Utc::now());

        let candle = HistoricalCandle {
            symbol: symbol.to_string(),
            timestamp: ts,
            open: opens.get(i).copied().unwrap_or(0.0),
            high: highs.get(i).copied().unwrap_or(0.0),
            low: lows.get(i).copied().unwrap_or(0.0),
            close: closes.get(i).copied().unwrap_or(0.0),
            volume: volumes.get(i).copied().unwrap_or(0.0),
        };

        let is_intraday = matches!(range, "1m" | "5m" | "15m" | "30m" | "1H");
        if !is_intraday {
            let _ = sqlx::query(
                "INSERT INTO price_history (id, symbol, timestamp, open, high, low, close, volume) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
                 ON CONFLICT DO NOTHING",
            )
            .bind(uuid::Uuid::new_v4())
            .bind(&candle.symbol)
            .bind(candle.timestamp)
            .bind(candle.open)
            .bind(candle.high)
            .bind(candle.low)
            .bind(candle.close)
            .bind(candle.volume)
            .execute(&state.db)
            .await;
        }

        result.push(candle);
    }

    Ok(result)
}

async fn fetch_yahoo_history(
    symbol: &str,
    range: &str,
) -> Result<Vec<HistoricalCandle>, String> {
    let (yf_range, yf_interval) = match range {
        "1m" => ("1d", "1m"),
        "5m" => ("1d", "5m"),
        "15m" => ("5d", "15m"),
        "30m" => ("5d", "30m"),
        "1H" => ("5d", "60m"),
        "1D" => ("1d", "5m"),
        "1W" => ("5d", "15m"),
        "1M" => ("1mo", "1d"),
        "3M" => ("3mo", "1d"),
        "1Y" => ("1y", "1wk"),
        _ => ("1mo", "1d"),
    };

    let url = format!(
        "https://query1.finance.yahoo.com/v8/finance/chart/{}?range={}&interval={}&includePrePost=false",
        symbol, yf_range, yf_interval
    );

    tracing::info!(url = %url, "Yahoo Finance candle request");

    let http = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    let resp = http
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Yahoo Finance request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        return Err(format!("Yahoo Finance returned status {status}"));
    }

    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Yahoo Finance response: {e}"))?;

    let result = body
        .get("chart")
        .and_then(|c| c.get("result"))
        .and_then(|r| r.as_array())
        .and_then(|arr| arr.first());

    let result = match result {
        Some(r) => r,
        None => return Ok(vec![]),
    };

    let timestamps = match result.get("timestamp").and_then(|t| t.as_array()) {
        Some(ts) => ts,
        None => return Ok(vec![]),
    };

    let quote = result
        .get("indicators")
        .and_then(|ind| ind.get("quote"))
        .and_then(|q| q.as_array())
        .and_then(|arr| arr.first());

    let quote = match quote {
        Some(q) => q,
        None => return Ok(vec![]),
    };

    let opens = quote.get("open").and_then(|v| v.as_array());
    let highs = quote.get("high").and_then(|v| v.as_array());
    let lows = quote.get("low").and_then(|v| v.as_array());
    let closes = quote.get("close").and_then(|v| v.as_array());
    let volumes = quote.get("volume").and_then(|v| v.as_array());

    let len = timestamps.len();
    let mut candles = Vec::with_capacity(len);

    for i in 0..len {
        let ts_secs = timestamps[i].as_i64().unwrap_or(0);
        let ts = chrono::DateTime::from_timestamp(ts_secs, 0)
            .unwrap_or_else(|| Utc::now());

        let open = opens.and_then(|a| a.get(i)).and_then(|v| v.as_f64());
        let high = highs.and_then(|a| a.get(i)).and_then(|v| v.as_f64());
        let low = lows.and_then(|a| a.get(i)).and_then(|v| v.as_f64());
        let close = closes.and_then(|a| a.get(i)).and_then(|v| v.as_f64());
        let volume = volumes.and_then(|a| a.get(i)).and_then(|v| v.as_f64());

        if let (Some(o), Some(h), Some(l), Some(c)) = (open, high, low, close) {
            candles.push(HistoricalCandle {
                symbol: symbol.to_string(),
                timestamp: ts,
                open: o,
                high: h,
                low: l,
                close: c,
                volume: volume.unwrap_or(0.0),
            });
        }
    }

    tracing::info!(
        symbol = symbol,
        range = range,
        count = candles.len(),
        "Yahoo Finance candles fetched"
    );

    Ok(candles)
}

fn synthesize_candles_with_interval(symbol: &str, points: &[(f64, f64)], range: &str) -> Vec<HistoricalCandle> {
    use chrono::DateTime;

    let interval_ms: f64 = match range {
        "1m" => 60_000.0,
        "5m" => 300_000.0,
        "15m" => 900_000.0,
        "30m" => 1_800_000.0,
        "1H" => 3_600_000.0,
        "1D" | "1W" => 3_600_000.0,
        _ => 86_400_000.0,
    };

    let mut candles: Vec<HistoricalCandle> = Vec::new();
    let mut bucket_start: Option<f64> = None;
    let mut open = 0.0;
    let mut high = f64::MIN;
    let mut low = f64::MAX;
    let mut close = 0.0;

    for &(ts_ms, price) in points {
        let bucket = (ts_ms / interval_ms).floor() * interval_ms;

        match bucket_start {
            Some(bs) if bs == bucket => {
                if price > high {
                    high = price;
                }
                if price < low {
                    low = price;
                }
                close = price;
            }
            Some(_bs) => {
                let ts = DateTime::from_timestamp_millis(_bs as i64)
                    .unwrap_or_else(|| Utc::now());
                candles.push(HistoricalCandle {
                    symbol: symbol.to_string(),
                    timestamp: ts,
                    open,
                    high,
                    low,
                    close,
                    volume: 0.0,
                });
                bucket_start = Some(bucket);
                open = price;
                high = price;
                low = price;
                close = price;
            }
            None => {
                bucket_start = Some(bucket);
                open = price;
                high = price;
                low = price;
                close = price;
            }
        }
    }

    if let Some(bs) = bucket_start {
        let ts = DateTime::from_timestamp_millis(bs as i64)
            .unwrap_or_else(|| Utc::now());
        candles.push(HistoricalCandle {
            symbol: symbol.to_string(),
            timestamp: ts,
            open,
            high,
            low,
            close,
            volume: 0.0,
        });
    }

    candles
}

pub async fn get_indicators(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
    Query(query): Query<IndicatorsQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let symbol = symbol.trim().to_uppercase();
    let range = query.range.unwrap_or_else(|| "1M".to_string());

    let candles = fetch_candles(&state, &symbol, &range).await?;

    if candles.is_empty() {
        return Ok(Json(serde_json::json!({
            "symbol": symbol,
            "range": range,
            "candles": [],
            "indicators": {}
        })));
    }

    let closes: Vec<f64> = candles.iter().map(|c| c.close).collect();

    let requested: Vec<String> = query
        .indicators
        .unwrap_or_else(|| "sma_20,ema_12,rsi_14,macd,bollinger".to_string())
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .collect();

    let mut indicators = serde_json::Map::new();

    for ind in &requested {
        match ind.as_str() {
            s if s.starts_with("sma_") => {
                if let Ok(period) = s[4..].parse::<usize>() {
                    let values = crate::indicators::sma(&closes, period);
                    indicators.insert(ind.clone(), serde_json::to_value(&values).unwrap());
                }
            }
            s if s.starts_with("ema_") => {
                if let Ok(period) = s[4..].parse::<usize>() {
                    let values = crate::indicators::ema(&closes, period);
                    indicators.insert(ind.clone(), serde_json::to_value(&values).unwrap());
                }
            }
            s if s.starts_with("rsi_") => {
                if let Ok(period) = s[4..].parse::<usize>() {
                    let values = crate::indicators::rsi(&closes, period);
                    indicators.insert(ind.clone(), serde_json::to_value(&values).unwrap());
                }
            }
            "macd" => {
                let result = crate::indicators::macd(&closes, 12, 26, 9);
                indicators.insert(
                    "macd".to_string(),
                    serde_json::json!({
                        "macd_line": result.macd_line,
                        "signal_line": result.signal_line,
                        "histogram": result.histogram,
                    }),
                );
            }
            s if s.starts_with("macd_") => {
                let parts: Vec<&str> = s[5..].split('_').collect();
                if parts.len() == 3 {
                    if let (Ok(fast), Ok(slow), Ok(signal)) = (
                        parts[0].parse::<usize>(),
                        parts[1].parse::<usize>(),
                        parts[2].parse::<usize>(),
                    ) {
                        let result = crate::indicators::macd(&closes, fast, slow, signal);
                        indicators.insert(
                            ind.clone(),
                            serde_json::json!({
                                "macd_line": result.macd_line,
                                "signal_line": result.signal_line,
                                "histogram": result.histogram,
                            }),
                        );
                    }
                }
            }
            "bollinger" => {
                let result = crate::indicators::bollinger_bands(&closes, 20, 2.0);
                indicators.insert(
                    "bollinger".to_string(),
                    serde_json::json!({
                        "upper": result.upper,
                        "middle": result.middle,
                        "lower": result.lower,
                    }),
                );
            }
            s if s.starts_with("bollinger_") => {
                let parts: Vec<&str> = s[10..].split('_').collect();
                if parts.len() == 2 {
                    if let (Ok(period), Ok(std_dev)) = (
                        parts[0].parse::<usize>(),
                        parts[1].parse::<f64>(),
                    ) {
                        let result = crate::indicators::bollinger_bands(&closes, period, std_dev);
                        indicators.insert(
                            ind.clone(),
                            serde_json::json!({
                                "upper": result.upper,
                                "middle": result.middle,
                                "lower": result.lower,
                            }),
                        );
                    }
                }
            }
            _ => {}
        }
    }

    Ok(Json(serde_json::json!({
        "symbol": symbol,
        "range": range,
        "candles": candles,
        "indicators": indicators,
    })))
}

async fn search(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<SearchResult>>, AppError> {
    let q = query
        .q
        .unwrap_or_default()
        .trim()
        .to_lowercase();

    if q.is_empty() {
        return Err(AppError::BadRequest(
            "Query parameter 'q' is required".to_string(),
        ));
    }

    let mut results: Vec<SearchResult> = CRYPTO_SYMBOLS
        .iter()
        .filter(|s| {
            s.symbol.to_lowercase().contains(&q)
                || s.name.to_lowercase().contains(&q)
        })
        .take(5)
        .map(|s| SearchResult {
            symbol: s.symbol.to_string(),
            name: s.name.to_string(),
            asset_type: s.asset_type.to_string(),
        })
        .collect();

    if !state.config.finnhub_api_key.is_empty() {
        match crate::ingestion::finnhub::search_symbols(&q, &state.config.finnhub_api_key).await {
            Ok(finnhub_results) => {
                for r in finnhub_results.into_iter().take(10 - results.len()) {
                    if results.iter().any(|existing| existing.symbol == r.symbol) {
                        continue;
                    }
                    results.push(SearchResult {
                        symbol: r.symbol,
                        name: r.description,
                        asset_type: "stock".to_string(),
                    });
                }
            }
            Err(e) => {
                tracing::warn!("Finnhub search failed: {e}");
                let stock_results: Vec<SearchResult> = SYMBOLS
                    .iter()
                    .filter(|s| {
                        s.asset_type == "stock"
                            && (s.symbol.to_lowercase().contains(&q)
                                || s.name.to_lowercase().contains(&q))
                    })
                    .take(10 - results.len())
                    .map(|s| SearchResult {
                        symbol: s.symbol.to_string(),
                        name: s.name.to_string(),
                        asset_type: s.asset_type.to_string(),
                    })
                    .collect();
                results.extend(stock_results);
            }
        }
    } else {
        let stock_results: Vec<SearchResult> = SYMBOLS
            .iter()
            .filter(|s| {
                s.asset_type == "stock"
                    && (s.symbol.to_lowercase().contains(&q)
                        || s.name.to_lowercase().contains(&q))
            })
            .take(10 - results.len())
            .map(|s| SearchResult {
                symbol: s.symbol.to_string(),
                name: s.name.to_string(),
                asset_type: s.asset_type.to_string(),
            })
            .collect();
        results.extend(stock_results);
    }

    // Also search indices, commodity futures, and bonds
    let extra_results: Vec<SearchResult> = SYMBOLS
        .iter()
        .filter(|s| {
            matches!(s.asset_type, "index" | "commodity" | "bonds")
                && (s.symbol.to_lowercase().contains(&q)
                    || s.name.to_lowercase().contains(&q))
        })
        .filter(|s| !results.iter().any(|existing| existing.symbol == s.symbol))
        .take(5)
        .map(|s| SearchResult {
            symbol: s.symbol.to_string(),
            name: s.name.to_string(),
            asset_type: s.asset_type.to_string(),
        })
        .collect();
    results.extend(extra_results);

    Ok(Json(results))
}

const STOCK_SPARKLINE_SYMBOLS: &[&str] = &[
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "SPY", "QQQ", "AMD",
    "NFLX", "DIS", "INTC", "IBM", "CRM", "ORCL", "PYPL", "SQ", "SHOP", "COIN",
    "UBER", "ABNB", "BA", "JPM", "GS", "V", "MA", "WMT", "COST", "HD", "JNJ", "PFE",
    "PLTR", "SOFI", "RIVN", "LCID", "F", "GM", "T", "VZ",
    "PEP", "KO", "MCD", "SBUX", "NKE", "BABA", "TSM", "AVGO",
    "LLY", "UNH", "PG", "XOM", "CVX",
    "WEAT", "CORN", "DBA", "PDBC", "GOVT", "HYG", "LQD",
    "SP500", "DOW", "NASDAQ", "GOLD", "SILVER", "CRUDE_OIL", "US10Y",
];

pub async fn get_sparklines(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, AppError> {
    use fred::interfaces::KeysInterface;
    use std::time::Duration;

    let cache_key = "sparkline:all";
    let cache_ttl: i64 = 600;

    if let Ok(Some(cached)) = state.redis.get::<Option<String>, _>(cache_key).await {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&cached) {
            return Ok(Json(parsed));
        }
    }

    let mut result = serde_json::Map::new();

    let coin_ids: Vec<&str> = crate::ingestion::coingecko::COIN_MAP
        .iter()
        .map(|(id, _)| *id)
        .collect();
    let ids_param = coin_ids.join(",");

    let http = reqwest::Client::builder()
        .user_agent("FinancePulse/1.0 (market-data-aggregator)")
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| AppError::ExternalApi(format!("HTTP client error: {e}")))?;

    let url = format!(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids={}&order=market_cap_desc&per_page=50&page=1&sparkline=true",
        ids_param
    );

    match http.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(coins) = resp.json::<Vec<serde_json::Value>>().await {
                let id_to_symbol: std::collections::HashMap<&str, &str> =
                    crate::ingestion::coingecko::COIN_MAP
                        .iter()
                        .map(|&(id, sym)| (id, sym))
                        .collect();

                for coin in &coins {
                    let coin_id = match coin.get("id").and_then(|v| v.as_str()) {
                        Some(id) => id,
                        None => continue,
                    };
                    let symbol = match id_to_symbol.get(coin_id) {
                        Some(s) => *s,
                        None => continue,
                    };
                    if let Some(sparkline) = coin
                        .get("sparkline_in_7d")
                        .and_then(|s| s.get("price"))
                        .and_then(|p| p.as_array())
                    {
                        let prices: Vec<f64> = sparkline
                            .iter()
                            .filter_map(|v| v.as_f64())
                            .collect();
                        let downsampled = if prices.len() > 168 {
                            let step = prices.len() as f64 / 168.0;
                            (0..168)
                                .map(|i| prices[(i as f64 * step) as usize])
                                .collect::<Vec<f64>>()
                        } else {
                            prices
                        };
                        result.insert(
                            symbol.to_string(),
                            serde_json::Value::Array(
                                downsampled.into_iter().map(serde_json::Value::from).collect(),
                            ),
                        );
                    }
                }
            }
        }
        Ok(resp) => {
            tracing::warn!("CoinGecko sparkline returned status {}", resp.status());
        }
        Err(e) => {
            tracing::warn!("CoinGecko sparkline request failed: {e}");
        }
    }

    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(5));
    let futures: Vec<_> = STOCK_SPARKLINE_SYMBOLS
        .iter()
        .map(|&sym| {
            let sem = semaphore.clone();
            async move {
                let _permit = sem.acquire().await;
                match fetch_yahoo_history(sym, "1W").await {
                    Ok(candles) if !candles.is_empty() => {
                        let closes: Vec<f64> = candles.iter().map(|c| c.close).collect();
                        Some((sym.to_string(), closes))
                    }
                    Ok(_) => None,
                    Err(e) => {
                        tracing::debug!("Stock sparkline fetch failed for {sym}: {e}");
                        None
                    }
                }
            }
        })
        .collect();

    let stock_results = futures_util::future::join_all(futures).await;
    for item in stock_results.into_iter().flatten() {
        result.insert(
            item.0,
            serde_json::Value::Array(
                item.1.into_iter().map(serde_json::Value::from).collect(),
            ),
        );
    }

    let value = serde_json::Value::Object(result);

    let _: Result<(), _> = state
        .redis
        .set(
            cache_key,
            value.to_string().as_str(),
            Some(fred::prelude::Expiration::EX(cache_ttl)),
            None,
            false,
        )
        .await;

    Ok(Json(value))
}

#[derive(Debug, Serialize)]
pub struct TrendingAsset {
    symbol: String,
    name: String,
    price: f64,
    change_24h: Option<f64>,
    change_percent_24h: Option<f64>,
    volume: Option<f64>,
    market_cap: Option<f64>,
    asset_type: String,
}

const ALL_TRACKED: &[(&str, &str, &str)] = &[
    ("BTC", "Bitcoin", "crypto"),
    ("ETH", "Ethereum", "crypto"),
    ("SOL", "Solana", "crypto"),
    ("AVAX", "Avalanche", "crypto"),
    ("LINK", "Chainlink", "crypto"),
    ("DOGE", "Dogecoin", "crypto"),
    ("ADA", "Cardano", "crypto"),
    ("DOT", "Polkadot", "crypto"),
    ("MATIC", "Polygon (MATIC)", "crypto"),
    ("UNI", "Uniswap", "crypto"),
    ("SHIB", "Shiba Inu", "crypto"),
    ("XRP", "Ripple", "crypto"),
    ("LTC", "Litecoin", "crypto"),
    ("BCH", "Bitcoin Cash", "crypto"),
    ("AAVE", "Aave", "crypto"),
    ("ATOM", "Cosmos", "crypto"),
    ("FIL", "Filecoin", "crypto"),
    ("APE", "ApeCoin", "crypto"),
    ("NEAR", "NEAR Protocol", "crypto"),
    ("OP", "Optimism", "crypto"),
    ("PEPE", "Pepe", "crypto"),
    ("IMX", "Immutable X", "crypto"),
    ("RENDER", "Render", "crypto"),
    ("FET", "Fetch.ai", "crypto"),
    ("GRT", "The Graph", "crypto"),
    ("INJ", "Injective", "crypto"),
    ("SEI", "Sei", "crypto"),
    ("HBAR", "Hedera", "crypto"),
    ("ALGO", "Algorand", "crypto"),
    ("SAND", "The Sandbox", "crypto"),
    ("MANA", "Decentraland", "crypto"),
    ("AXS", "Axie Infinity", "crypto"),
    ("CRV", "Curve DAO", "crypto"),
    ("MKR", "Maker", "crypto"),
    ("COMP", "Compound", "crypto"),
    ("SNX", "Synthetix", "crypto"),
    ("LDO", "Lido DAO", "crypto"),
    ("AAPL", "Apple Inc.", "stock"),
    ("MSFT", "Microsoft Corp.", "stock"),
    ("GOOGL", "Alphabet Inc.", "stock"),
    ("AMZN", "Amazon.com Inc.", "stock"),
    ("TSLA", "Tesla Inc.", "stock"),
    ("NVDA", "NVIDIA Corp.", "stock"),
    ("META", "Meta Platforms", "stock"),
    ("AMD", "AMD", "stock"),
    ("NFLX", "Netflix Inc.", "stock"),
    ("DIS", "Walt Disney Co.", "stock"),
    ("INTC", "Intel Corp.", "stock"),
    ("IBM", "IBM", "stock"),
    ("CRM", "Salesforce Inc.", "stock"),
    ("ORCL", "Oracle Corp.", "stock"),
    ("PYPL", "PayPal Holdings", "stock"),
    ("SQ", "Block Inc.", "stock"),
    ("SHOP", "Shopify Inc.", "stock"),
    ("COIN", "Coinbase Global", "stock"),
    ("UBER", "Uber Technologies", "stock"),
    ("ABNB", "Airbnb Inc.", "stock"),
    ("BA", "Boeing Co.", "stock"),
    ("JPM", "JPMorgan Chase", "stock"),
    ("GS", "Goldman Sachs", "stock"),
    ("V", "Visa Inc.", "stock"),
    ("MA", "Mastercard Inc.", "stock"),
    ("WMT", "Walmart Inc.", "stock"),
    ("COST", "Costco Wholesale", "stock"),
    ("HD", "Home Depot Inc.", "stock"),
    ("JNJ", "Johnson & Johnson", "stock"),
    ("PFE", "Pfizer Inc.", "stock"),
    ("PLTR", "Palantir Technologies", "stock"),
    ("SOFI", "SoFi Technologies", "stock"),
    ("RIVN", "Rivian Automotive", "stock"),
    ("LCID", "Lucid Group", "stock"),
    ("F", "Ford Motor Co.", "stock"),
    ("GM", "General Motors", "stock"),
    ("T", "AT&T Inc.", "stock"),
    ("VZ", "Verizon Communications", "stock"),
    ("PEP", "PepsiCo Inc.", "stock"),
    ("KO", "Coca-Cola Co.", "stock"),
    ("MCD", "McDonald's Corp.", "stock"),
    ("SBUX", "Starbucks Corp.", "stock"),
    ("NKE", "Nike Inc.", "stock"),
    ("BABA", "Alibaba Group", "stock"),
    ("TSM", "Taiwan Semiconductor", "stock"),
    ("AVGO", "Broadcom Inc.", "stock"),
    ("LLY", "Eli Lilly & Co.", "stock"),
    ("UNH", "UnitedHealth Group", "stock"),
    ("PG", "Procter & Gamble", "stock"),
    ("XOM", "Exxon Mobil Corp.", "stock"),
    ("CVX", "Chevron Corp.", "stock"),
    ("SPY", "S&P 500 ETF", "etf"),
    ("QQQ", "Invesco QQQ Trust", "etf"),
    ("DIA", "SPDR Dow Jones Industrial Average ETF", "etf"),
    ("IWM", "iShares Russell 2000 ETF", "etf"),
    ("XLF", "Financial Select Sector SPDR", "etf"),
    ("XLK", "Technology Select Sector SPDR", "etf"),
    ("XLE", "Energy Select Sector SPDR", "etf"),
    ("XLV", "Health Care Select Sector SPDR", "etf"),
    ("VIXY", "ProShares VIX Short-Term Futures ETF", "etf"),
    ("EFA", "iShares MSCI EAFE ETF", "etf"),
    ("EEM", "iShares MSCI Emerging Markets ETF", "etf"),
    ("AGG", "iShares Core US Aggregate Bond ETF", "etf"),
    ("ARKK", "ARK Innovation ETF", "etf"),
    ("SOXL", "Direxion Semiconductor Bull 3X", "etf"),
    ("TQQQ", "ProShares UltraPro QQQ", "etf"),
    ("VTI", "Vanguard Total Stock Market ETF", "etf"),
    ("VOO", "Vanguard S&P 500 ETF", "etf"),
    ("GLD", "SPDR Gold Shares", "commodity"),
    ("SLV", "iShares Silver Trust", "commodity"),
    ("USO", "United States Oil Fund", "commodity"),
    ("UNG", "United States Natural Gas Fund", "commodity"),
    ("WEAT", "Teucrium Wheat Fund", "commodity"),
    ("CORN", "Teucrium Corn Fund", "commodity"),
    ("DBA", "Invesco DB Agriculture Fund", "commodity"),
    ("PDBC", "Invesco Optimum Yield Commodity ETF", "commodity"),
    ("GOVT", "iShares US Treasury Bond ETF", "bonds"),
    ("HYG", "iShares iBoxx High Yield Bond ETF", "bonds"),
    ("LQD", "iShares Investment Grade Bond ETF", "bonds"),
    ("TLT", "iShares 20+ Year Treasury Bond ETF", "bonds"),
    // Yahoo indices
    ("SP500", "S&P 500", "index"),
    ("DOW", "Dow Jones", "index"),
    ("NASDAQ", "Nasdaq Composite", "index"),
    ("RUSSELL", "Russell 2000", "index"),
    ("VIX", "VIX Volatility", "index"),
    ("FTSE", "FTSE 100", "index"),
    ("NIKKEI", "Nikkei 225", "index"),
    ("HSI", "Hang Seng", "index"),
    ("DAX", "DAX", "index"),
    // Yahoo commodity futures
    ("GOLD", "Gold", "commodity"),
    ("SILVER", "Silver", "commodity"),
    ("CRUDE_OIL", "Crude Oil WTI", "commodity"),
    ("BRENT", "Brent Crude", "commodity"),
    ("NATGAS", "Natural Gas", "commodity"),
    ("COPPER", "Copper", "commodity"),
    ("PLATINUM", "Platinum", "commodity"),
    ("PALLADIUM", "Palladium", "commodity"),
    ("CORN_F", "Corn Futures", "commodity"),
    ("WHEAT_F", "Wheat Futures", "commodity"),
    ("SOYBEANS", "Soybeans", "commodity"),
    ("COFFEE", "Coffee", "commodity"),
    ("COTTON", "Cotton", "commodity"),
    ("SUGAR", "Sugar", "commodity"),
    // Yahoo treasury yields
    ("US10Y", "10Y Treasury Yield", "bonds"),
    ("US30Y", "30Y Treasury Yield", "bonds"),
    ("US5Y", "5Y Treasury Yield", "bonds"),
];

async fn fetch_asset_data(
    redis: &fred::prelude::Client,
    symbol: &str,
) -> (Option<f64>, Option<f64>, Option<f64>) {
    use fred::interfaces::KeysInterface;

    let mut price: Option<f64> = None;
    let mut volume: Option<f64> = None;
    let mut change_pct: Option<f64> = None;

    let price_key = format!("price:{symbol}");
    if let Ok(Some(json_str)) = redis.get::<Option<String>, _>(&price_key).await {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
            price = parsed.get("price").and_then(|p| p.as_f64());
            volume = parsed.get("volume").and_then(|v| v.as_f64());
        }
    }

    let meta_key = format!("crypto:meta:{symbol}");
    if let Ok(Some(json_str)) = redis.get::<Option<String>, _>(&meta_key).await {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
            if price.is_none() {
                price = parsed.get("price").and_then(|p| p.as_f64());
            }
            if volume.is_none() {
                volume = parsed.get("total_volume").and_then(|v| v.as_f64());
            }
            change_pct = parsed.get("price_change_24h_pct").and_then(|v| v.as_f64());
        }
    }

    let stock_meta_key = format!("stock:meta:{symbol}");
    if let Ok(Some(json_str)) = redis.get::<Option<String>, _>(&stock_meta_key).await {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
            if price.is_none() {
                price = parsed.get("price").and_then(|p| p.as_f64());
            }
            if volume.is_none() {
                volume = parsed.get("volume_24h").and_then(|v| v.as_f64());
            }
            if change_pct.is_none() {
                change_pct = parsed.get("price_change_24h_pct").and_then(|v| v.as_f64());
            }
        }
    }

    // Check Yahoo index/commodity/bonds cache
    let yahoo_key = format!("yahoo:index:{symbol}");
    if let Ok(Some(json_str)) = redis.get::<Option<String>, _>(&yahoo_key).await {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
            if price.is_none() {
                price = parsed.get("price").and_then(|p| p.as_f64());
            }
            if volume.is_none() {
                volume = parsed.get("volume_24h").and_then(|v| v.as_f64());
            }
            if change_pct.is_none() {
                change_pct = parsed.get("change_percent").and_then(|v| v.as_f64());
            }
        }
    }

    (price, volume, change_pct)
}

pub async fn get_trending(
    State(state): State<AppState>,
) -> Result<Json<Vec<TrendingAsset>>, AppError> {
    use fred::interfaces::KeysInterface;

    let mut assets = Vec::with_capacity(ALL_TRACKED.len());

    for &(symbol, name, asset_type) in ALL_TRACKED {
        let (mut price, volume, mut change_pct) =
            fetch_asset_data(&state.redis, symbol).await;

        if price.is_none() && asset_type != "crypto" && !state.config.finnhub_api_key.is_empty() {
            if let Ok(quote) = crate::ingestion::finnhub::fetch_quote(symbol, &state.config.finnhub_api_key).await {
                price = Some(quote.c);
                change_pct = quote.dp;
            }
        }

        if let Some(p) = price {
            let market_cap = if asset_type == "crypto" {
                let mut mcap: Option<f64> = None;
                let meta_key = format!("crypto:meta:{symbol}");
                if let Ok(Some(json_str)) = state.redis.get::<Option<String>, _>(&meta_key).await {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                        mcap = parsed.get("market_cap").and_then(|v| v.as_f64()).filter(|&v| v > 0.0);
                    }
                }
                Some(mcap.unwrap_or_else(|| crypto_market_cap_fallback(symbol)))
            } else {
                let mut mcap: Option<f64> = None;
                let stock_meta_key = format!("stock:meta:{symbol}");
                if let Ok(Some(json_str)) = state.redis.get::<Option<String>, _>(&stock_meta_key).await {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                        mcap = parsed.get("market_cap").and_then(|v| v.as_f64()).filter(|&v| v > 0.0);
                    }
                }
                mcap.or_else(|| stock_market_cap(symbol))
            };

            assets.push(TrendingAsset {
                symbol: symbol.to_string(),
                name: name.to_string(),
                price: p,
                change_24h: change_pct.map(|pct| p * pct / 100.0),
                change_percent_24h: change_pct,
                volume,
                market_cap,
                asset_type: asset_type.to_string(),
            });
        }
    }

    assets.sort_by(|a, b| {
        let mcap_a = a.market_cap.unwrap_or(0.0);
        let mcap_b = b.market_cap.unwrap_or(0.0);
        mcap_b.partial_cmp(&mcap_a).unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(Json(assets))
}

#[derive(Debug, Serialize)]
pub struct HeatmapEntry {
    symbol: String,
    name: String,
    price: f64,
    change_24h: Option<f64>,
    market_cap: f64,
    category: String,
}

fn crypto_market_cap_fallback(symbol: &str) -> f64 {
    match symbol {
        "BTC" => 1_400_000_000_000.0,
        "ETH" => 250_000_000_000.0,
        "BNB" => 90_000_000_000.0,
        "XRP" => 70_000_000_000.0,
        "SOL" => 40_000_000_000.0,
        "DOGE" => 13_000_000_000.0,
        "ADA" => 10_000_000_000.0,
        "BCH" => 9_000_000_000.0,
        "DOT" => 7_000_000_000.0,
        "LINK" => 6_000_000_000.0,
        "SHIB" => 5_000_000_000.0,
        "AVAX" => 4_000_000_000.0,
        "LTC" => 4_000_000_000.0,
        "UNI" => 3_500_000_000.0,
        "NEAR" => 3_000_000_000.0,
        "ATOM" => 2_000_000_000.0,
        "FIL" => 2_000_000_000.0,
        "AAVE" => 1_600_000_000.0,
        "OP" => 1_000_000_000.0,
        "APE" => 500_000_000.0,
        "MATIC" | "POL" => 5_000_000_000.0,
        "ICP" => 3_000_000_000.0,
        "APT" => 3_000_000_000.0,
        "ARB" => 2_000_000_000.0,
        "SUI" => 3_000_000_000.0,
        "XLM" => 3_500_000_000.0,
        "PEPE" => 3_000_000_000.0,
        "HBAR" => 3_000_000_000.0,
        "MKR" => 2_000_000_000.0,
        "RENDER" => 2_500_000_000.0,
        "INJ" => 1_500_000_000.0,
        "FET" => 1_500_000_000.0,
        "GRT" => 1_500_000_000.0,
        "ALGO" => 1_500_000_000.0,
        "LDO" => 1_500_000_000.0,
        "IMX" => 1_000_000_000.0,
        "SEI" => 800_000_000.0,
        "SAND" => 700_000_000.0,
        "MANA" => 600_000_000.0,
        "AXS" => 600_000_000.0,
        "CRV" => 500_000_000.0,
        "COMP" => 500_000_000.0,
        "SNX" => 400_000_000.0,
        _ => 500_000_000.0,
    }
}

fn stock_market_cap(symbol: &str) -> Option<f64> {
    match symbol {
        "AAPL" => Some(3_900_000_000_000.0),
        "MSFT" => Some(3_200_000_000_000.0),
        "GOOGL" => Some(2_100_000_000_000.0),
        "AMZN" => Some(2_000_000_000_000.0),
        "NVDA" => Some(3_000_000_000_000.0),
        "META" => Some(1_500_000_000_000.0),
        "TSLA" => Some(860_000_000_000.0),
        "SPY" => Some(560_000_000_000.0),
        "QQQ" => Some(300_000_000_000.0),
        "JPM" => Some(680_000_000_000.0),
        "V" => Some(580_000_000_000.0),
        "MA" => Some(430_000_000_000.0),
        "WMT" => Some(680_000_000_000.0),
        "JNJ" => Some(380_000_000_000.0),
        "AMD" => Some(220_000_000_000.0),
        "NFLX" => Some(390_000_000_000.0),
        "CRM" => Some(270_000_000_000.0),
        "ORCL" => Some(380_000_000_000.0),
        "COIN" => Some(50_000_000_000.0),
        "UBER" => Some(160_000_000_000.0),
        "BA" => Some(140_000_000_000.0),
        "GS" => Some(180_000_000_000.0),
        "INTC" => Some(100_000_000_000.0),
        "IBM" => Some(210_000_000_000.0),
        "PYPL" => Some(80_000_000_000.0),
        "SQ" => Some(45_000_000_000.0),
        "SHOP" => Some(120_000_000_000.0),
        "ABNB" => Some(80_000_000_000.0),
        "COST" => Some(400_000_000_000.0),
        "HD" => Some(380_000_000_000.0),
        "PFE" => Some(150_000_000_000.0),
        "DIS" => Some(200_000_000_000.0),
        "IWM" => Some(60_000_000_000.0),
        "DIA" => Some(35_000_000_000.0),
        "XLF" => Some(45_000_000_000.0),
        "XLK" => Some(50_000_000_000.0),
        "XLE" => Some(35_000_000_000.0),
        "XLV" => Some(30_000_000_000.0),
        "VIXY" => Some(500_000_000.0),
        "EFA" => Some(50_000_000_000.0),
        "EEM" => Some(25_000_000_000.0),
        "AGG" => Some(90_000_000_000.0),
        "ARKK" => Some(6_000_000_000.0),
        "SOXL" => Some(10_000_000_000.0),
        "TQQQ" => Some(22_000_000_000.0),
        "VTI" => Some(420_000_000_000.0),
        "VOO" => Some(500_000_000_000.0),
        "GLD" => Some(65_000_000_000.0),
        "SLV" => Some(15_000_000_000.0),
        "USO" => Some(3_000_000_000.0),
        "UNG" => Some(500_000_000.0),
        "PG" => Some(380_000_000_000.0),
        "PLTR" => Some(250_000_000_000.0),
        "SOFI" => Some(15_000_000_000.0),
        "RIVN" => Some(15_000_000_000.0),
        "LCID" => Some(8_000_000_000.0),
        "F" => Some(40_000_000_000.0),
        "GM" => Some(50_000_000_000.0),
        "T" => Some(150_000_000_000.0),
        "VZ" => Some(170_000_000_000.0),
        "PEP" => Some(220_000_000_000.0),
        "KO" => Some(260_000_000_000.0),
        "MCD" => Some(210_000_000_000.0),
        "SBUX" => Some(110_000_000_000.0),
        "NKE" => Some(115_000_000_000.0),
        "BABA" => Some(250_000_000_000.0),
        "TSM" => Some(600_000_000_000.0),
        "AVGO" => Some(800_000_000_000.0),
        "LLY" => Some(700_000_000_000.0),
        "UNH" => Some(500_000_000_000.0),
        "XOM" => Some(460_000_000_000.0),
        "CVX" => Some(260_000_000_000.0),
        "WEAT" => Some(500_000_000.0),
        "CORN" => Some(200_000_000.0),
        "DBA" => Some(800_000_000.0),
        "PDBC" => Some(5_000_000_000.0),
        "GOVT" => Some(20_000_000_000.0),
        "HYG" => Some(15_000_000_000.0),
        "LQD" => Some(30_000_000_000.0),
        "TLT" => Some(50_000_000_000.0),
        // Yahoo indices (visual weight, not real market cap)
        "SP500" => Some(40_000_000_000_000.0),
        "DOW" => Some(15_000_000_000_000.0),
        "NASDAQ" => Some(25_000_000_000_000.0),
        "RUSSELL" => Some(3_000_000_000_000.0),
        "FTSE" => Some(3_000_000_000_000.0),
        "NIKKEI" => Some(4_000_000_000_000.0),
        "HSI" => Some(2_000_000_000_000.0),
        "DAX" => Some(2_000_000_000_000.0),
        // Yahoo commodity futures
        "GOLD" => Some(13_000_000_000_000.0),
        "SILVER" => Some(1_500_000_000_000.0),
        "CRUDE_OIL" => Some(3_000_000_000_000.0),
        "BRENT" => Some(2_500_000_000_000.0),
        "NATGAS" => Some(500_000_000_000.0),
        "COPPER" => Some(300_000_000_000.0),
        "PLATINUM" => Some(200_000_000_000.0),
        "PALLADIUM" => Some(100_000_000_000.0),
        "CORN_F" => Some(150_000_000_000.0),
        "WHEAT_F" => Some(100_000_000_000.0),
        "SOYBEANS" => Some(150_000_000_000.0),
        "COFFEE" => Some(100_000_000_000.0),
        "COTTON" => Some(100_000_000_000.0),
        "SUGAR" => Some(100_000_000_000.0),
        // Yahoo treasury yields
        "US10Y" => Some(500_000_000_000.0),
        "US30Y" => Some(300_000_000_000.0),
        "US5Y" => Some(200_000_000_000.0),
        _ => None,
    }
}

fn stock_category(symbol: &str) -> &'static str {
    match symbol {
        "AAPL" | "MSFT" | "GOOGL" | "META" | "NVDA" | "AMD" | "INTC" | "IBM"
        | "CRM" | "ORCL" | "NFLX" | "ADBE" | "CSCO" | "SHOP" | "SQ" | "COIN"
        | "PLTR" | "T" | "VZ" | "BABA" | "TSM" | "AVGO" => "tech",
        "JPM" | "GS" | "V" | "MA" | "PYPL" | "SOFI" => "finance",
        "JNJ" | "PFE" | "LLY" | "UNH" => "healthcare",
        "AMZN" | "TSLA" | "WMT" | "COST" | "HD" | "DIS" | "UBER" | "ABNB"
        | "RIVN" | "LCID" | "F" | "GM" | "PEP" | "KO" | "MCD" | "SBUX" | "NKE" | "PG" => "consumer",
        "BA" | "XOM" | "CVX" => "industrial",
        "SPY" | "QQQ" | "DIA" | "IWM" | "XLF" | "XLK" | "XLE" | "XLV" | "VIXY"
        | "EFA" | "EEM" | "AGG" | "ARKK" | "SOXL" | "TQQQ" | "VTI" | "VOO" => "etf",
        "GLD" | "SLV" | "USO" | "UNG" | "WEAT" | "CORN" | "DBA" | "PDBC"
        | "GOLD" | "SILVER" | "CRUDE_OIL" | "BRENT" | "NATGAS" | "COPPER"
        | "PLATINUM" | "PALLADIUM" | "CORN_F" | "WHEAT_F" | "SOYBEANS"
        | "COFFEE" | "COTTON" | "SUGAR" => "commodity",
        "TLT" | "GOVT" | "HYG" | "LQD" | "US10Y" | "US30Y" | "US5Y" => "bonds",
        "SP500" | "DOW" | "NASDAQ" | "RUSSELL" | "VIX" | "FTSE" | "NIKKEI" | "HSI" | "DAX" => "index",
        _ => "other",
    }
}

pub async fn get_heatmap(
    State(state): State<AppState>,
) -> Result<Json<Vec<HeatmapEntry>>, AppError> {
    use fred::interfaces::KeysInterface;

    let mut entries = Vec::new();

    for &(symbol, name, asset_type) in ALL_TRACKED {
        // Skip VIX from heatmap — it's a volatility index, not a market cap thing
        if symbol == "VIX" {
            continue;
        }

        let (price, _volume, change_pct) =
            fetch_asset_data(&state.redis, symbol).await;

        let price = match price {
            Some(p) => p,
            None => continue,
        };

        let (market_cap, category, final_change) = if asset_type == "crypto" {
            let mut mcap = 0.0;
            let mut crypto_change = change_pct;
            let meta_key = format!("crypto:meta:{symbol}");
            if let Ok(Some(json_str)) = state.redis.get::<Option<String>, _>(&meta_key).await {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                    mcap = parsed.get("market_cap").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    if crypto_change.is_none() {
                        crypto_change = parsed.get("price_change_24h_pct").and_then(|v| v.as_f64());
                    }
                }
            }
            if mcap <= 0.0 {
                mcap = crypto_market_cap_fallback(symbol);
            }
            (mcap, "crypto", crypto_change)
        } else {
            let mut mcap = stock_market_cap(symbol).unwrap_or(0.0);
            let mut stock_change = change_pct;
            let stock_key = format!("stock:meta:{symbol}");
            if let Ok(Some(json_str)) = state.redis.get::<Option<String>, _>(&stock_key).await {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                    if stock_change.is_none() {
                        stock_change = parsed.get("price_change_24h_pct").and_then(|v| v.as_f64());
                    }
                    if let Some(live_mcap) = parsed.get("market_cap").and_then(|v| v.as_f64()) {
                        if live_mcap > 0.0 {
                            mcap = live_mcap;
                        }
                    }
                }
            }
            if stock_change.is_none() && !state.config.finnhub_api_key.is_empty() {
                if let Ok(quote) = crate::ingestion::finnhub::fetch_quote(symbol, &state.config.finnhub_api_key).await {
                    stock_change = quote.dp;
                }
            }

            (mcap, stock_category(symbol), stock_change)
        };

        entries.push(HeatmapEntry {
            symbol: symbol.to_string(),
            name: name.to_string(),
            price,
            change_24h: final_change,
            market_cap,
            category: category.to_string(),
        });
    }

    Ok(Json(entries))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewsArticle {
    title: String,
    url: String,
    source: String,
    published_at: String,
    image: Option<String>,
    sentiment: String,
}

fn classify_sentiment(title: &str) -> &'static str {
    let t = title.to_lowercase();

    let bullish = [
        "surge", "soar", "rally", "jump", "gain", "rise", "bull", "boom",
        "record high", "all-time high", "breakout", "upside", "buy",
        "outperform", "beat", "exceed", "upgrade", "positive", "growth",
        "profit", "revenue beat", "strong", "momentum", "recovery",
        "optimis", "confidence", "support", "accumulation", "adoption",
    ];

    let bearish = [
        "crash", "plunge", "drop", "fall", "decline", "bear", "bust",
        "record low", "breakdown", "downside", "sell", "dump",
        "underperform", "miss", "downgrade", "negative", "loss",
        "recession", "weak", "fear", "panic", "liquidat", "warning",
        "risk", "concern", "trouble", "crisis", "slash", "cut",
        "layoff", "bankrupt", "fraud", "hack", "exploit", "ban",
    ];

    let b = bullish.iter().filter(|k| t.contains(*k)).count();
    let s = bearish.iter().filter(|k| t.contains(*k)).count();

    if b > s { "bullish" }
    else if s > b { "bearish" }
    else { "neutral" }
}

pub async fn get_news(
    State(state): State<AppState>,
    Path(symbol): Path<String>,
) -> Result<Json<Vec<NewsArticle>>, AppError> {
    use fred::interfaces::KeysInterface;

    let symbol = symbol.trim().to_uppercase();

    let cache_key = format!("news:{symbol}");
    if let Ok(Some(cached)) = state.redis.get::<Option<String>, _>(&cache_key).await {
        if let Ok(parsed) = serde_json::from_str::<Vec<NewsArticle>>(&cached) {
            return Ok(Json(parsed));
        }
    }

    let articles = if is_crypto(&symbol) {
        fetch_crypto_news(&symbol, &state.config.finnhub_api_key).await?
    } else {
        fetch_stock_news(&symbol, &state.config.finnhub_api_key).await?
    };

    if let Ok(json_str) = serde_json::to_string(&articles) {
        let _: Result<(), _> = state
            .redis
            .set(
                &cache_key,
                json_str.as_str(),
                Some(fred::prelude::Expiration::EX(300)),
                None,
                false,
            )
            .await;
    }

    Ok(Json(articles))
}

pub async fn get_general_news(
    State(state): State<AppState>,
) -> Result<Json<Vec<NewsArticle>>, AppError> {
    use fred::interfaces::KeysInterface;

    if let Ok(Some(cached)) = state.redis.get::<Option<String>, _>("news:general").await {
        if let Ok(parsed) = serde_json::from_str::<Vec<NewsArticle>>(&cached) {
            return Ok(Json(parsed));
        }
    }

    let mut all_articles: Vec<NewsArticle> = Vec::new();

    if !state.config.finnhub_api_key.is_empty() {
        match crate::ingestion::finnhub::fetch_general_news("general", &state.config.finnhub_api_key).await {
            Ok(articles) => {
                for a in articles.into_iter().take(20) {
                    let ts = chrono::DateTime::from_timestamp(a.datetime, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_default();
                    let sent = classify_sentiment(&a.headline).to_string();
                    all_articles.push(NewsArticle {
                        title: a.headline,
                        url: a.url,
                        source: a.source.unwrap_or_else(|| "Unknown".to_string()),
                        published_at: ts,
                        image: a.image,
                        sentiment: sent,
                    });
                }
            }
            Err(e) => tracing::warn!("Finnhub general news failed: {e}"),
        }

        match crate::ingestion::finnhub::fetch_general_news("crypto", &state.config.finnhub_api_key).await {
            Ok(articles) => {
                for a in articles.into_iter().take(20) {
                    let ts = chrono::DateTime::from_timestamp(a.datetime, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_default();
                    let sent = classify_sentiment(&a.headline).to_string();
                    all_articles.push(NewsArticle {
                        title: a.headline,
                        url: a.url,
                        source: a.source.unwrap_or_else(|| "Unknown".to_string()),
                        published_at: ts,
                        image: a.image,
                        sentiment: sent,
                    });
                }
            }
            Err(e) => tracing::warn!("Finnhub crypto news failed: {e}"),
        }
    }

    all_articles.sort_by(|a, b| b.published_at.cmp(&a.published_at));
    all_articles.truncate(40);

    if let Ok(json_str) = serde_json::to_string(&all_articles) {
        let _: Result<(), _> = state.redis.set(
            "news:general",
            json_str.as_str(),
            Some(fred::prelude::Expiration::EX(300)),
            None,
            false,
        ).await;
    }

    Ok(Json(all_articles))
}

async fn fetch_stock_news(symbol: &str, api_key: &str) -> Result<Vec<NewsArticle>, AppError> {
    if api_key.is_empty() {
        return Ok(vec![]);
    }

    let to = Utc::now().format("%Y-%m-%d").to_string();
    let from = (Utc::now() - Duration::days(7)).format("%Y-%m-%d").to_string();

    match crate::ingestion::finnhub::fetch_company_news(symbol, &from, &to, api_key).await {
        Ok(articles) => {
            let mut result: Vec<NewsArticle> = articles
                .into_iter()
                .take(20)
                .map(|a| {
                    let ts = chrono::DateTime::from_timestamp(a.datetime, 0)
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_default();
                    let sent = classify_sentiment(&a.headline).to_string();
                    NewsArticle {
                        title: a.headline,
                        url: a.url,
                        source: a.source.unwrap_or_else(|| "Unknown".to_string()),
                        published_at: ts,
                        image: a.image,
                        sentiment: sent,
                    }
                })
                .collect();
            result.sort_by(|a, b| b.published_at.cmp(&a.published_at));
            Ok(result)
        }
        Err(e) => {
            tracing::warn!("Finnhub company news failed for {symbol}: {e}");
            Ok(vec![])
        }
    }
}

pub async fn get_predictions_trending(
    State(state): State<AppState>,
) -> Result<Json<Vec<crate::ingestion::polymarket::ProcessedMarket>>, AppError> {
    match crate::ingestion::polymarket::get_cached_trending(&state.redis).await {
        Ok(markets) => Ok(Json(markets)),
        Err(e) => {
            tracing::warn!("Failed to get predictions: {e}");
            Err(AppError::Internal("Failed to fetch prediction markets".to_string()))
        }
    }
}

pub async fn get_prediction_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    use fred::interfaces::KeysInterface;

    let cache_key = format!("polymarket:slug:{slug}");
    if let Ok(Some(cached)) = state.redis.get::<Option<String>, _>(&cache_key).await {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&cached) {
            return Ok(Json(parsed));
        }
    }

    let http = reqwest::Client::builder()
        .user_agent("FinancePulse/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let resp = http
        .get("https://gamma-api.polymarket.com/markets")
        .query(&[("slug", slug.as_str())])
        .send()
        .await
        .map_err(|e| AppError::ExternalApi(e.to_string()))?;

    if !resp.status().is_success() {
        return Err(AppError::NotFound(format!("Prediction market '{slug}' not found")));
    }

    let data: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| AppError::ExternalApi(e.to_string()))?;

    let _ = state.redis.set::<(), _, _>(
        &cache_key,
        serde_json::to_string(&data).unwrap_or_default().as_str(),
        Some(fred::types::Expiration::EX(120)),
        None,
        false,
    ).await;

    Ok(Json(data))
}

async fn fetch_crypto_news(symbol: &str, finnhub_api_key: &str) -> Result<Vec<NewsArticle>, AppError> {
    let crypto_panic_url = format!(
        "https://cryptopanic.com/api/free/v1/posts/?currencies={}&public=true",
        symbol
    );

    let http = reqwest::Client::builder()
        .user_agent("FinancePulse/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::ExternalApi(format!("HTTP client error: {e}")))?;

    match http.get(&crypto_panic_url).send().await {
        Ok(resp) if resp.status().is_success() => {
            if let Ok(body) = resp.json::<serde_json::Value>().await {
                if let Some(results) = body.get("results").and_then(|r| r.as_array()) {
                    let mut articles: Vec<NewsArticle> = results
                        .iter()
                        .take(20)
                        .filter_map(|r| {
                            let title = r.get("title")?.as_str()?.to_string();
                            let url = r.get("url")?.as_str()?.to_string();
                            let source = r
                                .get("source")
                                .and_then(|s| s.get("title"))
                                .and_then(|t| t.as_str())
                                .unwrap_or("Unknown")
                                .to_string();
                            let published_at = r
                                .get("published_at")
                                .and_then(|p| p.as_str())
                                .unwrap_or_default()
                                .to_string();
                            let sent = classify_sentiment(&title).to_string();
                            Some(NewsArticle {
                                title,
                                url,
                                source,
                                published_at,
                                image: None,
                                sentiment: sent,
                            })
                        })
                        .collect();
                    articles.sort_by(|a, b| b.published_at.cmp(&a.published_at));
                    return Ok(articles);
                }
            }
        }
        Ok(resp) => {
            tracing::warn!("CryptoPanic returned status {}", resp.status());
        }
        Err(e) => {
            tracing::warn!("CryptoPanic request failed: {e}");
        }
    }

    if !finnhub_api_key.is_empty() {
        match crate::ingestion::finnhub::fetch_general_news("crypto", finnhub_api_key).await {
            Ok(articles) => {
                let mut result: Vec<NewsArticle> = articles
                    .into_iter()
                    .take(20)
                    .map(|a| {
                        let ts = chrono::DateTime::from_timestamp(a.datetime, 0)
                            .map(|dt| dt.to_rfc3339())
                            .unwrap_or_default();
                        let sent = classify_sentiment(&a.headline).to_string();
                        NewsArticle {
                            title: a.headline,
                            url: a.url,
                            source: a.source.unwrap_or_else(|| "Unknown".to_string()),
                            published_at: ts,
                            image: a.image,
                            sentiment: sent,
                        }
                    })
                    .collect();
                result.sort_by(|a, b| b.published_at.cmp(&a.published_at));
                return Ok(result);
            }
            Err(e) => {
                tracing::warn!("Finnhub general news fallback failed: {e}");
            }
        }
    }

    Ok(vec![])
}

const FOREX_PAIRS: &[(&str, &str)] = &[
    ("EURUSD=X", "EUR/USD"),
    ("GBPUSD=X", "GBP/USD"),
    ("USDJPY=X", "USD/JPY"),
    ("USDCHF=X", "USD/CHF"),
    ("AUDUSD=X", "AUD/USD"),
    ("USDCAD=X", "USD/CAD"),
    ("NZDUSD=X", "NZD/USD"),
    ("EURGBP=X", "EUR/GBP"),
    ("EURJPY=X", "EUR/JPY"),
    ("GBPJPY=X", "GBP/JPY"),
    ("USDCNY=X", "USD/CNY"),
    ("USDINR=X", "USD/INR"),
    ("USDMXN=X", "USD/MXN"),
    ("USDBRL=X", "USD/BRL"),
    ("USDKRW=X", "USD/KRW"),
    ("DX-Y.NYB", "US Dollar Index"),
];

#[derive(Debug, Serialize, Deserialize)]
pub struct CurrencyEntry {
    pair: String,
    name: String,
    rate: f64,
    change_pct: Option<f64>,
    direction: String,
}

pub async fn get_currencies(
    State(state): State<AppState>,
) -> Result<Json<Vec<CurrencyEntry>>, AppError> {
    use fred::interfaces::KeysInterface;

    if let Ok(Some(cached)) = state.redis.get::<Option<String>, _>("currencies:all").await {
        if let Ok(parsed) = serde_json::from_str::<Vec<CurrencyEntry>>(&cached) {
            return Ok(Json(parsed));
        }
    }

    let http = reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Internal(format!("HTTP client error: {e}")))?;

    let mut entries = Vec::with_capacity(FOREX_PAIRS.len());

    for &(yahoo_symbol, display_name) in FOREX_PAIRS {
        let url = format!(
            "https://query1.finance.yahoo.com/v8/finance/chart/{}?range=1d&interval=1d",
            yahoo_symbol
        );

        match http.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => {
                if let Ok(body) = resp.json::<serde_json::Value>().await {
                    if let Some(result) = body
                        .get("chart")
                        .and_then(|c| c.get("result"))
                        .and_then(|r| r.as_array())
                        .and_then(|a| a.first())
                    {
                        let meta = result.get("meta");
                        let rate = meta
                            .and_then(|m| m.get("regularMarketPrice"))
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);
                        let prev_close = meta
                            .and_then(|m| m.get("previousClose").or_else(|| m.get("chartPreviousClose")))
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);

                        let change_pct = if prev_close > 0.0 {
                            Some(((rate - prev_close) / prev_close) * 100.0)
                        } else {
                            None
                        };

                        let direction = match change_pct {
                            Some(c) if c > 0.01 => "up",
                            Some(c) if c < -0.01 => "down",
                            _ => "flat",
                        };

                        if rate > 0.0 {
                            entries.push(CurrencyEntry {
                                pair: display_name.to_string(),
                                name: display_name.to_string(),
                                rate,
                                change_pct,
                                direction: direction.to_string(),
                            });
                        }
                    }
                }
            }
            Ok(resp) => {
                tracing::warn!("Yahoo Finance returned {} for {yahoo_symbol}", resp.status());
            }
            Err(e) => {
                tracing::warn!("Yahoo Finance forex request failed for {yahoo_symbol}: {e}");
            }
        }
    }

    if let Ok(json_str) = serde_json::to_string(&entries) {
        let _: Result<(), _> = state.redis.set(
            "currencies:all",
            json_str.as_str(),
            Some(fred::prelude::Expiration::EX(300)),
            None,
            false,
        ).await;
    }

    Ok(Json(entries))
}
