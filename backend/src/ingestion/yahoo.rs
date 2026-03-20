use std::time::Duration;

use fred::interfaces::KeysInterface;
use serde::Deserialize;

use super::finnhub::DEFAULT_SYMBOLS;

/// Yahoo Finance symbols for indices, commodity futures, and treasury yields.
/// Each entry: (yahoo_symbol, display_name, clean_symbol, category)
const YAHOO_EXTRA_SYMBOLS: &[(&str, &str, &str, &str)] = &[
    // Major indices
    ("^GSPC", "S&P 500", "SP500", "index"),
    ("^DJI", "Dow Jones", "DOW", "index"),
    ("^IXIC", "Nasdaq Composite", "NASDAQ", "index"),
    ("^RUT", "Russell 2000", "RUSSELL", "index"),
    ("^VIX", "VIX Volatility", "VIX", "index"),
    ("^FTSE", "FTSE 100", "FTSE", "index"),
    ("^N225", "Nikkei 225", "NIKKEI", "index"),
    ("^HSI", "Hang Seng", "HSI", "index"),
    ("^GDAXI", "DAX", "DAX", "index"),
    // Commodity futures
    ("GC=F", "Gold", "GOLD", "commodity"),
    ("SI=F", "Silver", "SILVER", "commodity"),
    ("CL=F", "Crude Oil WTI", "CRUDE_OIL", "commodity"),
    ("BZ=F", "Brent Crude", "BRENT", "commodity"),
    ("NG=F", "Natural Gas", "NATGAS", "commodity"),
    ("HG=F", "Copper", "COPPER", "commodity"),
    ("PL=F", "Platinum", "PLATINUM", "commodity"),
    ("PA=F", "Palladium", "PALLADIUM", "commodity"),
    ("ZC=F", "Corn Futures", "CORN_F", "commodity"),
    ("ZW=F", "Wheat Futures", "WHEAT_F", "commodity"),
    ("ZS=F", "Soybeans", "SOYBEANS", "commodity"),
    ("KC=F", "Coffee", "COFFEE", "commodity"),
    ("CT=F", "Cotton", "COTTON", "commodity"),
    ("SB=F", "Sugar", "SUGAR", "commodity"),
    // Treasury yields
    ("^TNX", "10Y Treasury Yield", "US10Y", "bonds"),
    ("^TYX", "30Y Treasury Yield", "US30Y", "bonds"),
    ("^FVX", "5Y Treasury Yield", "US5Y", "bonds"),
];

/// Map a clean symbol back to a Yahoo Finance symbol for history fetching.
pub fn clean_to_yahoo_symbol(clean: &str) -> Option<&'static str> {
    YAHOO_EXTRA_SYMBOLS
        .iter()
        .find(|&&(_, _, cs, _)| cs == clean)
        .map(|&(ys, _, _, _)| ys)
}

/// Check if a clean symbol is a Yahoo extra symbol.
pub fn is_yahoo_extra(symbol: &str) -> bool {
    YAHOO_EXTRA_SYMBOLS.iter().any(|&(_, _, cs, _)| cs == symbol)
}

#[derive(Debug, Deserialize)]
struct YahooChartResponse {
    chart: YahooChart,
}

#[derive(Debug, Deserialize)]
struct YahooChart {
    result: Option<Vec<YahooChartResult>>,
}

#[derive(Debug, Deserialize)]
struct YahooChartResult {
    meta: YahooMeta,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct YahooMeta {
    #[serde(rename = "regularMarketPrice")]
    regular_market_price: Option<f64>,
    #[serde(rename = "regularMarketVolume")]
    regular_market_volume: Option<f64>,
    #[serde(rename = "marketCap")]
    market_cap: Option<f64>,
    #[serde(rename = "previousClose")]
    previous_close: Option<f64>,
    #[serde(rename = "chartPreviousClose")]
    chart_previous_close: Option<f64>,
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0")
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to build HTTP client")
}

async fn fetch_stock_meta(symbol: &str) -> Result<YahooMeta, String> {
    let url = format!(
        "https://query1.finance.yahoo.com/v8/finance/chart/{}?range=1d&interval=1d",
        symbol
    );
    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Yahoo Finance request failed for {symbol}: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Yahoo Finance returned status {} for {symbol}", resp.status()));
    }

    let chart: YahooChartResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Yahoo Finance response for {symbol}: {e}"))?;

    let result = chart
        .chart
        .result
        .and_then(|mut r| if r.is_empty() { None } else { Some(r.remove(0)) })
        .ok_or_else(|| format!("No chart data for {symbol}"))?;

    Ok(result.meta)
}

pub async fn start(redis: fred::prelude::Client) {
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(5));

    loop {
        tracing::info!("Yahoo Finance stock metadata poll starting for {} symbols", DEFAULT_SYMBOLS.len());

        let mut handles = Vec::with_capacity(DEFAULT_SYMBOLS.len());

        for &symbol in DEFAULT_SYMBOLS {
            let redis = redis.clone();
            let sem = semaphore.clone();
            handles.push(tokio::spawn(async move {
                let _permit = sem.acquire().await;
                match fetch_stock_meta(symbol).await {
                    Ok(meta) => {
                        let price = meta.regular_market_price.unwrap_or(0.0);
                        let prev_close = meta.previous_close
                            .or(meta.chart_previous_close)
                            .unwrap_or(0.0);
                        let change_pct = if prev_close > 0.0 {
                            ((price - prev_close) / prev_close) * 100.0
                        } else {
                            0.0
                        };

                        let json = serde_json::json!({
                            "price": price,
                            "volume_24h": meta.regular_market_volume.unwrap_or(0.0),
                            "market_cap": meta.market_cap.unwrap_or(0.0),
                            "price_change_24h_pct": change_pct,
                        });

                        let key = format!("stock:meta:{symbol}");
                        let _: Result<(), _> = redis
                            .set(
                                &key,
                                json.to_string().as_str(),
                                Some(fred::prelude::Expiration::EX(360)),
                                None,
                                false,
                            )
                            .await;

                        tracing::debug!(
                            symbol,
                            volume = meta.regular_market_volume.unwrap_or(0.0),
                            "Stored stock metadata"
                        );
                    }
                    Err(e) => {
                        tracing::warn!("Yahoo Finance meta fetch failed: {e}");
                    }
                }
            }));
        }

        futures_util::future::join_all(handles).await;
        tracing::info!("Yahoo Finance stock metadata poll complete");

        tokio::time::sleep(Duration::from_secs(300)).await;
    }
}

/// Polls Yahoo Finance for index values, commodity futures, and treasury yields.
/// Runs every 2 minutes with concurrency limited to 3.
pub async fn start_indices_commodities(redis: fred::prelude::Client) {
    let semaphore = std::sync::Arc::new(tokio::sync::Semaphore::new(3));

    loop {
        tracing::info!(
            "Yahoo Finance indices/commodities poll starting for {} symbols",
            YAHOO_EXTRA_SYMBOLS.len()
        );

        for &(yahoo_symbol, display_name, clean_symbol, category) in YAHOO_EXTRA_SYMBOLS {
            let redis = redis.clone();
            let sem = semaphore.clone();
            let _permit = sem.acquire().await;

            match fetch_stock_meta(yahoo_symbol).await {
                Ok(meta) => {
                    let price = meta.regular_market_price.unwrap_or(0.0);
                    if price <= 0.0 {
                        tracing::debug!(yahoo_symbol, "Skipping — no price data");
                        tokio::time::sleep(Duration::from_millis(500)).await;
                        continue;
                    }

                    let prev_close = meta.previous_close
                        .or(meta.chart_previous_close)
                        .unwrap_or(0.0);
                    let change_pct = if prev_close > 0.0 {
                        ((price - prev_close) / prev_close) * 100.0
                    } else {
                        0.0
                    };

                    let json = serde_json::json!({
                        "price": price,
                        "change_percent": change_pct,
                        "name": display_name,
                        "category": category,
                        "yahoo_symbol": yahoo_symbol,
                        "volume_24h": meta.regular_market_volume.unwrap_or(0.0),
                    });

                    let key = format!("yahoo:index:{clean_symbol}");
                    let _: Result<(), _> = redis
                        .set(
                            &key,
                            json.to_string().as_str(),
                            Some(fred::prelude::Expiration::EX(180)),
                            None,
                            false,
                        )
                        .await;

                    tracing::debug!(
                        clean_symbol,
                        yahoo_symbol,
                        price,
                        change_pct,
                        "Stored Yahoo index/commodity data"
                    );
                }
                Err(e) => {
                    tracing::warn!("Yahoo index/commodity fetch failed for {yahoo_symbol}: {e}");
                }
            }

            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        tracing::info!("Yahoo Finance indices/commodities poll complete");
        tokio::time::sleep(Duration::from_secs(120)).await;
    }
}
