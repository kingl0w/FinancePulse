pub mod coinbase;
pub mod coingecko;
pub mod finnhub;
pub mod polymarket;
pub mod yahoo;

use fred::prelude::*;
use tokio::task::JoinHandle;

use crate::config::Config;

pub fn start_all_ingestion(
    config: &Config,
    redis: Client,
) -> Vec<JoinHandle<()>> {
    let mut handles = Vec::new();

    let coinbase_redis = redis.clone();
    handles.push(tokio::spawn(async move {
        coinbase::start(coinbase_redis).await;
    }));
    tracing::info!("Spawned Coinbase ingestion task");

    let finnhub_redis = redis.clone();
    let finnhub_config = config.clone();
    handles.push(tokio::spawn(async move {
        finnhub::start(finnhub_redis, finnhub_config).await;
    }));
    tracing::info!("Spawned Finnhub ingestion task");

    let coingecko_redis = redis.clone();
    handles.push(tokio::spawn(async move {
        coingecko::start(coingecko_redis).await;
    }));
    tracing::info!("Spawned CoinGecko ingestion task");

    let yahoo_redis = redis.clone();
    handles.push(tokio::spawn(async move {
        yahoo::start(yahoo_redis).await;
    }));
    tracing::info!("Spawned Yahoo Finance stock metadata poller");

    let yahoo_idx_redis = redis.clone();
    handles.push(tokio::spawn(async move {
        yahoo::start_indices_commodities(yahoo_idx_redis).await;
    }));
    tracing::info!("Spawned Yahoo Finance indices/commodities poller");

    let polymarket_redis = redis.clone();
    handles.push(tokio::spawn(async move {
        polymarket::start(polymarket_redis).await;
    }));
    tracing::info!("Spawned Polymarket prediction market poller");

    handles
}
