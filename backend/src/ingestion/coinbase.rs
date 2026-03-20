use std::time::Duration;

use chrono::{DateTime, Utc};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

use crate::models::PriceUpdate;
use crate::ws::broadcast;

const COINBASE_WS_URL: &str = "wss://ws-feed.exchange.coinbase.com";

const PRODUCT_IDS: &[&str] = &[
    "BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD", "LINK-USD",
    "DOGE-USD", "ADA-USD", "DOT-USD", "POL-USD", "UNI-USD",
    "SHIB-USD", "XRP-USD", "LTC-USD", "BCH-USD", "AAVE-USD",
    "ATOM-USD", "FIL-USD", "APE-USD", "NEAR-USD", "OP-USD",
    "PEPE-USD", "ARB-USD", "IMX-USD", "RENDER-USD", "FET-USD",
    "GRT-USD", "INJ-USD", "SEI-USD", "SUI-USD", "APT-USD",
    "HBAR-USD", "ALGO-USD", "SAND-USD", "MANA-USD", "AXS-USD",
    "CRV-USD", "MKR-USD", "COMP-USD", "SNX-USD", "LDO-USD",
];

#[derive(Debug, Deserialize)]
struct CoinbaseTicker {
    #[serde(rename = "type")]
    msg_type: String,
    product_id: Option<String>,
    price: Option<String>,
    open_24h: Option<String>,
    volume_24h: Option<String>,
    low_24h: Option<String>,
    high_24h: Option<String>,
    #[allow(dead_code)]
    best_bid: Option<String>,
    #[allow(dead_code)]
    best_ask: Option<String>,
    time: Option<String>,
}

fn normalize_symbol(product_id: &str) -> String {
    product_id
        .split('-')
        .next()
        .unwrap_or(product_id)
        .to_uppercase()
}

pub async fn start(redis: fred::prelude::Client) {
    let mut backoff = Duration::from_secs(1);
    let max_backoff = Duration::from_secs(30);

    loop {
        tracing::info!("Connecting to Coinbase Exchange WebSocket");

        match connect_async(COINBASE_WS_URL).await {
            Ok((ws_stream, _)) => {
                tracing::info!("Connected to Coinbase Exchange WebSocket");
                backoff = Duration::from_secs(1);

                let (mut write, mut read) = ws_stream.split();

                let subscribe = serde_json::json!({
                    "type": "subscribe",
                    "product_ids": PRODUCT_IDS,
                    "channels": ["ticker"]
                });
                if let Err(e) = write.send(Message::Text(subscribe.to_string().into())).await {
                    tracing::error!("Failed to send Coinbase subscription: {e}");
                    tokio::time::sleep(backoff).await;
                    backoff = (backoff * 2).min(max_backoff);
                    continue;
                }
                tracing::info!("Coinbase subscription sent for {} products", PRODUCT_IDS.len());

                while let Some(msg_result) = read.next().await {
                    match msg_result {
                        Ok(Message::Text(text)) => {
                            if let Err(e) = handle_message(&text, &redis).await {
                                tracing::warn!("Error handling Coinbase message: {e}");
                            }
                        }
                        Ok(Message::Ping(payload)) => {
                            if let Err(e) = write.send(Message::Pong(payload)).await {
                                tracing::warn!("Failed to send Coinbase pong: {e}");
                                break;
                            }
                        }
                        Ok(Message::Close(frame)) => {
                            tracing::warn!(?frame, "Coinbase WebSocket closed by server");
                            break;
                        }
                        Err(e) => {
                            tracing::error!("Coinbase WebSocket error: {e}");
                            break;
                        }
                        _ => {}
                    }
                }

                tracing::warn!("Coinbase stream ended, will reconnect");
            }
            Err(e) => {
                tracing::error!("Failed to connect to Coinbase Exchange: {e}");
            }
        }

        tracing::info!(
            backoff_secs = backoff.as_secs(),
            "Reconnecting to Coinbase in {} seconds",
            backoff.as_secs()
        );
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(max_backoff);
    }
}

async fn handle_message(
    text: &str,
    redis: &fred::prelude::Client,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let ticker: CoinbaseTicker = serde_json::from_str(text)?;

    match ticker.msg_type.as_str() {
        "subscriptions" => {
            tracing::info!("Coinbase subscription confirmed");
            return Ok(());
        }
        "heartbeat" => {
            tracing::trace!("Coinbase heartbeat received");
            return Ok(());
        }
        "error" => {
            tracing::error!("Coinbase error: {text}");
            return Ok(());
        }
        "ticker" => {}
        _ => return Ok(()),
    }

    let product_id = match &ticker.product_id {
        Some(id) => id.as_str(),
        None => return Ok(()),
    };

    let price: f64 = match &ticker.price {
        Some(p) => p.parse()?,
        None => return Ok(()),
    };

    let volume: f64 = ticker
        .volume_24h
        .as_ref()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.0);

    let open_24h: f64 = ticker
        .open_24h
        .as_ref()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.0);

    let high_24h: f64 = ticker
        .high_24h
        .as_ref()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.0);

    let low_24h: f64 = ticker
        .low_24h
        .as_ref()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0.0);

    let change_24h = if open_24h > 0.0 {
        ((price - open_24h) / open_24h) * 100.0
    } else {
        0.0
    };

    let timestamp = ticker
        .time
        .as_ref()
        .and_then(|t| DateTime::parse_from_rfc3339(t).ok())
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);

    let symbol = normalize_symbol(product_id);

    let update = PriceUpdate {
        symbol: symbol.clone(),
        price,
        volume,
        timestamp,
        source: "coinbase".to_string(),
    };

    broadcast::publish_price_update(redis, &update).await?;

    let meta = serde_json::json!({
        "price": price,
        "open_24h": open_24h,
        "high_24h": high_24h,
        "low_24h": low_24h,
        "total_volume": volume,
        "price_change_24h_pct": change_24h,
        "source": "coinbase",
    });

    use fred::interfaces::KeysInterface;
    let meta_key = format!("crypto:meta:{symbol}");
    let _: () = redis
        .set(
            &meta_key,
            meta.to_string().as_str(),
            Some(fred::prelude::Expiration::EX(300)),
            None,
            false,
        )
        .await?;

    Ok(())
}
