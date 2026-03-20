use std::time::Duration;

use chrono::{DateTime, Utc};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

use crate::config::Config;
use crate::models::PriceUpdate;
use crate::ws::broadcast;

pub const DEFAULT_SYMBOLS: &[&str] = &[
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA",
    "META", "AMD", "NFLX", "DIS",
    "INTC", "IBM", "CRM", "ORCL", "PYPL", "SQ",
    "SHOP", "COIN", "UBER", "ABNB", "BA", "JPM",
    "GS", "V", "MA", "WMT", "COST", "HD", "JNJ", "PFE",
    "PLTR", "SOFI", "RIVN", "LCID", "F", "GM",
    "T", "VZ", "PEP", "KO", "MCD", "SBUX", "NKE",
    "BABA", "TSM", "AVGO", "LLY", "UNH", "PG", "XOM", "CVX",
    "SPY", "QQQ", "DIA", "IWM", "VTI", "VOO",
    "XLF", "XLK", "XLE", "XLV",
    "EFA", "EEM", "AGG", "ARKK", "SOXL", "TQQQ",
    "GLD", "SLV", "USO", "UNG",
    "WEAT", "CORN", "DBA", "PDBC",
    "GOVT", "HYG", "LQD",
    "TLT",
    "VIXY",
];

#[derive(Debug, Deserialize)]
struct FinnhubTradeEntry {
    #[allow(dead_code)]
    c: Option<Vec<String>>,
    p: f64,
    s: String,
    t: i64,
    v: f64,
}

#[derive(Debug, Deserialize)]
struct FinnhubMessage {
    #[serde(rename = "type")]
    msg_type: String,
    data: Option<Vec<FinnhubTradeEntry>>,
}

pub async fn start(redis: fred::prelude::Client, config: Config) {
    let api_key = config.finnhub_api_key.trim().to_string();
    if api_key.is_empty() {
        tracing::warn!("FINNHUB_API_KEY not set, skipping Finnhub stock feed");
        return;
    }

    let ws_url = format!("wss://ws.finnhub.io/?token={}", api_key);
    tracing::info!(
        url = %ws_url.replace(&api_key, &format!("{}***", &api_key[..4.min(api_key.len())])),
        key_len = api_key.len(),
        "Finnhub WebSocket URL constructed"
    );

    let mut backoff = Duration::from_secs(1);
    let max_backoff = Duration::from_secs(30);

    loop {
        tracing::info!("Connecting to Finnhub WebSocket");

        match connect_async(ws_url.as_str()).await {
            Ok((ws_stream, response)) => {
                tracing::info!(
                    status = %response.status(),
                    "Connected to Finnhub WebSocket"
                );
                backoff = Duration::from_secs(1);

                let (mut write, mut read) = ws_stream.split();

                for symbol in DEFAULT_SYMBOLS {
                    let sub_msg = serde_json::json!({
                        "type": "subscribe",
                        "symbol": symbol,
                    });
                    if let Err(e) = write.send(Message::Text(sub_msg.to_string().into())).await {
                        tracing::error!("Failed to send Finnhub subscription for {symbol}: {e}");
                        break;
                    }
                }
                tracing::info!("Finnhub subscriptions sent for {} symbols", DEFAULT_SYMBOLS.len());

                while let Some(msg_result) = read.next().await {
                    match msg_result {
                        Ok(Message::Text(text)) => {
                            if let Err(e) = handle_message(&text, &redis, &mut write).await {
                                tracing::warn!("Error handling Finnhub message: {e}");
                            }
                        }
                        Ok(Message::Ping(payload)) => {
                            if let Err(e) = write.send(Message::Pong(payload)).await {
                                tracing::warn!("Failed to send Finnhub pong: {e}");
                                break;
                            }
                        }
                        Ok(Message::Close(frame)) => {
                            tracing::warn!(?frame, "Finnhub WebSocket closed by server");
                            break;
                        }
                        Err(e) => {
                            tracing::error!("Finnhub WebSocket error: {e}");
                            break;
                        }
                        _ => {}
                    }
                }

                tracing::warn!("Finnhub stream ended, will reconnect");
            }
            Err(e) => {
                tracing::error!(error = %e, debug = ?e, "Failed to connect to Finnhub");
            }
        }

        tracing::info!(
            backoff_secs = backoff.as_secs(),
            "Reconnecting to Finnhub in {} seconds",
            backoff.as_secs()
        );
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(max_backoff);
    }
}

async fn handle_message(
    text: &str,
    redis: &fred::prelude::Client,
    write: &mut futures_util::stream::SplitSink<
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        Message,
    >,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let msg: FinnhubMessage = serde_json::from_str(text)?;

    match msg.msg_type.as_str() {
        "ping" => {
            let pong = serde_json::json!({"type": "pong"});
            write.send(Message::Text(pong.to_string().into())).await?;
            tracing::trace!("Finnhub ping/pong");
            return Ok(());
        }
        "trade" => {}
        _ => return Ok(()),
    }

    let trades = match msg.data {
        Some(t) => t,
        None => return Ok(()),
    };

    for trade in trades {
        let timestamp = DateTime::<Utc>::from_timestamp_millis(trade.t)
            .unwrap_or_else(Utc::now);

        let update = PriceUpdate {
            symbol: trade.s.to_uppercase(),
            price: trade.p,
            volume: trade.v,
            timestamp,
            source: "finnhub".to_string(),
        };

        broadcast::publish_price_update(redis, &update).await?;
    }

    Ok(())
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("FinancePulse/1.0")
        .timeout(Duration::from_secs(10))
        .build()
        .expect("Failed to build HTTP client")
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct FinnhubQuote {
    pub c: f64,
    pub d: Option<f64>,
    pub dp: Option<f64>,
    pub h: f64,
    pub l: f64,
    pub o: f64,
    pub pc: f64,
    pub t: i64,
}

pub async fn fetch_quote(symbol: &str, api_key: &str) -> Result<FinnhubQuote, String> {
    let url = format!(
        "https://finnhub.io/api/v1/quote?symbol={}&token={}",
        symbol, api_key
    );
    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Finnhub quote request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Finnhub quote returned status {}", resp.status()));
    }

    let quote: FinnhubQuote = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Finnhub quote: {e}"))?;

    if quote.c == 0.0 {
        return Err(format!("No quote data for {symbol}"));
    }

    Ok(quote)
}

#[derive(Debug, Deserialize)]
pub struct FinnhubCandles {
    pub c: Option<Vec<f64>>,
    pub h: Option<Vec<f64>>,
    pub l: Option<Vec<f64>>,
    pub o: Option<Vec<f64>>,
    pub t: Option<Vec<i64>>,
    pub v: Option<Vec<f64>>,
    pub s: String,
}

pub async fn fetch_candles(
    symbol: &str,
    resolution: &str,
    from: i64,
    to: i64,
    api_key: &str,
) -> Result<FinnhubCandles, String> {
    let url = format!(
        "https://finnhub.io/api/v1/stock/candle?symbol={}&resolution={}&from={}&to={}&token={}",
        symbol, resolution, from, to, api_key
    );
    tracing::info!(url = %url.replace(api_key, "***"), "Finnhub candle request");

    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Finnhub candles request failed: {e}"))?;

    let status = resp.status();
    tracing::info!(status = %status, "Finnhub candle response status");

    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        tracing::warn!(status = %status, body = %body, "Finnhub candles error response");
        return Err(format!("Finnhub candles returned status {status}: {body}"));
    }

    let body_text = resp.text().await
        .map_err(|e| format!("Failed to read Finnhub candles body: {e}"))?;

    tracing::debug!(body_len = body_text.len(), "Finnhub candle response body length");

    let candles: FinnhubCandles = serde_json::from_str(&body_text)
        .map_err(|e| format!("Failed to parse Finnhub candles: {e}, body: {}", &body_text[..body_text.len().min(200)]))?;

    Ok(candles)
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct FinnhubSearchResult {
    pub description: String,
    #[serde(rename = "displaySymbol")]
    pub display_symbol: String,
    pub symbol: String,
    #[serde(rename = "type")]
    pub security_type: String,
}

#[derive(Debug, Deserialize)]
struct FinnhubSearchResponse {
    #[allow(dead_code)]
    count: u32,
    result: Vec<FinnhubSearchResult>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct FinnhubNewsArticle {
    pub category: Option<String>,
    pub datetime: i64,
    pub headline: String,
    pub id: Option<i64>,
    pub image: Option<String>,
    pub related: Option<String>,
    pub source: Option<String>,
    pub summary: Option<String>,
    pub url: String,
}

pub async fn fetch_company_news(
    symbol: &str,
    from: &str,
    to: &str,
    api_key: &str,
) -> Result<Vec<FinnhubNewsArticle>, String> {
    let url = format!(
        "https://finnhub.io/api/v1/company-news?symbol={}&from={}&to={}&token={}",
        symbol, from, to, api_key
    );
    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Finnhub news request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Finnhub news returned status {}", resp.status()));
    }

    let articles: Vec<FinnhubNewsArticle> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Finnhub news: {e}"))?;

    Ok(articles)
}

pub async fn fetch_general_news(category: &str, api_key: &str) -> Result<Vec<FinnhubNewsArticle>, String> {
    let url = format!(
        "https://finnhub.io/api/v1/news?category={}&token={}",
        category, api_key
    );
    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Finnhub general news request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Finnhub general news returned status {}", resp.status()));
    }

    let articles: Vec<FinnhubNewsArticle> = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Finnhub general news: {e}"))?;

    Ok(articles)
}

pub async fn search_symbols(query: &str, api_key: &str) -> Result<Vec<FinnhubSearchResult>, String> {
    let url = format!(
        "https://finnhub.io/api/v1/search?q={}&token={}",
        query, api_key
    );
    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Finnhub search request failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Finnhub search returned status {}", resp.status()));
    }

    let search: FinnhubSearchResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Finnhub search: {e}"))?;

    Ok(search.result)
}
