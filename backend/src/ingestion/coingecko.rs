use std::collections::HashMap;
use std::time::Duration;

use chrono::Utc;
use fred::prelude::*;
use serde::Deserialize;

use crate::models::PriceUpdate;
use crate::ws::broadcast;

const BASE_URL: &str = "https://api.coingecko.com/api/v3";
const POLL_INTERVAL: Duration = Duration::from_secs(30);
const CACHE_TTL_SECS: i64 = 300;

pub const COIN_MAP: &[(&str, &str)] = &[
    ("bitcoin", "BTC"),
    ("ethereum", "ETH"),
    ("solana", "SOL"),
    ("binancecoin", "BNB"),
    ("ripple", "XRP"),
    ("cardano", "ADA"),
    ("dogecoin", "DOGE"),
    ("polkadot", "DOT"),
    ("avalanche-2", "AVAX"),
    ("chainlink", "LINK"),
    ("polygon-ecosystem-token", "POL"),
    ("litecoin", "LTC"),
    ("uniswap", "UNI"),
    ("near", "NEAR"),
    ("internet-computer", "ICP"),
    ("aptos", "APT"),
    ("arbitrum", "ARB"),
    ("optimism", "OP"),
    ("sui", "SUI"),
    ("stellar", "XLM"),
    ("pepe", "PEPE"),
    ("immutable-x", "IMX"),
    ("render-token", "RENDER"),
    ("fetch-ai", "FET"),
    ("the-graph", "GRT"),
    ("injective-protocol", "INJ"),
    ("sei-network", "SEI"),
    ("hedera-hashgraph", "HBAR"),
    ("algorand", "ALGO"),
    ("the-sandbox", "SAND"),
    ("decentraland", "MANA"),
    ("axie-infinity", "AXS"),
    ("curve-dao-token", "CRV"),
    ("maker", "MKR"),
    ("compound-governance-token", "COMP"),
    ("synthetix-network-token", "SNX"),
    ("lido-dao", "LDO"),
    ("shiba-inu", "SHIB"),
    ("bitcoin-cash", "BCH"),
    ("aave", "AAVE"),
    ("cosmos", "ATOM"),
    ("filecoin", "FIL"),
    ("apecoin", "APE"),
];

pub fn symbol_to_coingecko_id(symbol: &str) -> Option<&'static str> {
    COIN_MAP
        .iter()
        .find(|(_, sym)| *sym == symbol)
        .map(|(id, _)| *id)
}

#[derive(Debug, Deserialize)]
struct CoinMarketData {
    id: String,
    #[allow(dead_code)]
    symbol: String,
    name: String,
    current_price: Option<f64>,
    market_cap: Option<f64>,
    total_volume: Option<f64>,
    price_change_percentage_24h: Option<f64>,
    image: Option<String>,
}

fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("FinancePulse/1.0 (market-data-aggregator)")
        .timeout(Duration::from_secs(15))
        .build()
        .expect("Failed to create HTTP client")
}

pub async fn start(redis: fred::prelude::Client) {
    let http = build_http_client();

    let coin_ids: Vec<&str> = COIN_MAP.iter().map(|(id, _)| *id).collect();
    let ids_param = coin_ids.join(",");

    let id_to_symbol: HashMap<&str, &str> =
        COIN_MAP.iter().map(|&(id, sym)| (id, sym)).collect();

    tracing::info!("CoinGecko: performing initial metadata fetch");
    if let Err(e) = fetch_and_publish(&http, &redis, &ids_param, &id_to_symbol).await {
        tracing::error!("CoinGecko initial fetch failed: {e}");
    }

    let mut interval = tokio::time::interval(POLL_INTERVAL);
    interval.tick().await;

    loop {
        interval.tick().await;

        if let Err(e) = fetch_and_publish(&http, &redis, &ids_param, &id_to_symbol).await {
            tracing::warn!("CoinGecko poll failed: {e}");
        }
    }
}

async fn fetch_and_publish(
    http: &reqwest::Client,
    redis: &fred::prelude::Client,
    ids_param: &str,
    id_to_symbol: &HashMap<&str, &str>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = format!(
        "{}/coins/markets?vs_currency=usd&ids={}&order=market_cap_desc&per_page=50&page=1&sparkline=false",
        BASE_URL, ids_param
    );

    let resp = http.get(&url).send().await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("CoinGecko returned {status}: {body}").into());
    }

    let coins: Vec<CoinMarketData> = resp.json().await?;
    tracing::debug!("CoinGecko fetched {} coins", coins.len());

    for coin in &coins {
        let symbol = match id_to_symbol.get(coin.id.as_str()) {
            Some(s) => *s,
            None => continue,
        };

        let price = match coin.current_price {
            Some(p) => p,
            None => continue,
        };

        let metadata = serde_json::json!({
            "symbol": symbol,
            "name": coin.name,
            "image": coin.image,
            "market_cap": coin.market_cap,
            "total_volume": coin.total_volume,
            "price_change_24h_pct": coin.price_change_percentage_24h,
            "price": price,
        });
        let cache_key = format!("crypto:meta:{symbol}");
        let _: () = redis
            .set(
                &cache_key,
                metadata.to_string().as_str(),
                Some(Expiration::EX(CACHE_TTL_SECS)),
                None,
                false,
            )
            .await?;

        let update = PriceUpdate {
            symbol: symbol.to_string(),
            price,
            volume: coin.total_volume.unwrap_or(0.0),
            timestamp: Utc::now(),
            source: "coingecko".to_string(),
        };
        broadcast::publish_price_update(redis, &update).await?;

        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    Ok(())
}

pub async fn fetch_market_chart(
    coingecko_id: &str,
    days: u32,
) -> Result<Vec<(f64, f64)>, Box<dyn std::error::Error + Send + Sync>> {
    let http = build_http_client();
    let url = format!(
        "{}/coins/{}/market_chart?vs_currency=usd&days={}",
        BASE_URL, coingecko_id, days
    );

    tokio::time::sleep(Duration::from_secs(2)).await;

    let resp = http.get(&url).send().await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("CoinGecko market_chart returned {status}: {body}").into());
    }

    let body: serde_json::Value = resp.json().await?;

    let prices = body
        .get("prices")
        .and_then(|p| p.as_array())
        .cloned()
        .unwrap_or_default();

    let mut result = Vec::new();
    for pair in prices {
        if let Some(arr) = pair.as_array() {
            if arr.len() == 2 {
                let ts = arr[0].as_f64().unwrap_or(0.0);
                let price = arr[1].as_f64().unwrap_or(0.0);
                result.push((ts, price));
            }
        }
    }

    Ok(result)
}
