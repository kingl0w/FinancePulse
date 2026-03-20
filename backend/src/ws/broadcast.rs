use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::ws::Message;
use fred::prelude::*;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

use crate::models::PriceUpdate;

pub struct ClientState {
    pub sender: mpsc::Sender<Message>,
    pub subscribed_symbols: HashSet<String>,
}

pub type ClientRegistry = Arc<RwLock<HashMap<Uuid, ClientState>>>;

pub fn new_registry() -> ClientRegistry {
    Arc::new(RwLock::new(HashMap::new()))
}

pub async fn register_client(
    registry: &ClientRegistry,
    client_id: Uuid,
) -> mpsc::Receiver<Message> {
    let (tx, rx) = mpsc::channel::<Message>(256);
    let state = ClientState {
        sender: tx,
        subscribed_symbols: HashSet::new(),
    };
    registry.write().await.insert(client_id, state);
    tracing::info!(%client_id, "Client registered");
    rx
}

pub async fn unregister_client(registry: &ClientRegistry, client_id: Uuid) {
    registry.write().await.remove(&client_id);
    tracing::info!(%client_id, "Client unregistered");
}

pub async fn subscribe_symbols(
    registry: &ClientRegistry,
    client_id: Uuid,
    symbols: Vec<String>,
) {
    let mut map = registry.write().await;
    if let Some(client) = map.get_mut(&client_id) {
        for s in &symbols {
            client.subscribed_symbols.insert(s.clone());
        }
        tracing::debug!(%client_id, ?symbols, "Client subscribed");
    }
}

pub async fn unsubscribe_symbols(
    registry: &ClientRegistry,
    client_id: Uuid,
    symbols: Vec<String>,
) {
    let mut map = registry.write().await;
    if let Some(client) = map.get_mut(&client_id) {
        for s in &symbols {
            client.subscribed_symbols.remove(s);
        }
        tracing::debug!(%client_id, ?symbols, "Client unsubscribed");
    }
}

pub async fn start_broadcast_listener(
    redis_config: Config,
    registry: ClientRegistry,
) -> Result<(), Error> {
    let subscriber = Builder::from_config(redis_config)
        .build_subscriber_client()?;
    subscriber.init().await?;

    subscriber.psubscribe("prices:*").await?;
    tracing::info!("Broadcast listener subscribed to prices:*");

    let throttle: Arc<RwLock<HashMap<String, Instant>>> =
        Arc::new(RwLock::new(HashMap::new()));
    let throttle_interval = Duration::from_millis(250);

    let mut message_stream = subscriber.message_rx();

    tokio::spawn(async move {
        while let Ok(msg) = message_stream.recv().await {
            let channel = msg.channel.to_string();
            let symbol = match channel.strip_prefix("prices:") {
                Some(s) => s.to_string(),
                None => continue,
            };

            {
                let now = Instant::now();
                let mut th = throttle.write().await;
                if let Some(last) = th.get(&symbol) {
                    if now.duration_since(*last) < throttle_interval {
                        continue;
                    }
                }
                th.insert(symbol.clone(), now);
            }

            let payload: String = match msg.value.convert() {
                Ok(s) => s,
                Err(e) => {
                    tracing::warn!("Failed to convert Redis message value: {e}");
                    continue;
                }
            };

            let update: PriceUpdate = match serde_json::from_str(&payload) {
                Ok(u) => u,
                Err(e) => {
                    tracing::warn!(%symbol, "Failed to parse PriceUpdate: {e}");
                    continue;
                }
            };

            let ws_msg = serde_json::json!({
                "type": "price",
                "symbol": update.symbol,
                "price": update.price,
                "volume": update.volume,
                "timestamp": update.timestamp.to_rfc3339(),
            });
            let text = Message::Text(ws_msg.to_string().into());

            let registry_guard = registry.read().await;
            let mut dead_clients: Vec<Uuid> = Vec::new();

            for (&client_id, client) in registry_guard.iter() {
                if client.subscribed_symbols.contains(&symbol) {
                    if client.sender.try_send(text.clone()).is_err() {
                        dead_clients.push(client_id);
                    }
                }
            }
            drop(registry_guard);

            if !dead_clients.is_empty() {
                let mut map = registry.write().await;
                for id in dead_clients {
                    map.remove(&id);
                    tracing::debug!(%id, "Removed dead client from registry");
                }
            }
        }

        tracing::warn!("Broadcast listener message stream ended");
    });

    Ok(())
}

pub async fn publish_price_update(
    redis: &fred::prelude::Client,
    update: &PriceUpdate,
) -> Result<(), Error> {
    let channel = format!("prices:{}", update.symbol);
    let payload = serde_json::to_string(update).unwrap_or_default();
    let _: i64 = redis.publish(&channel, payload.as_str()).await?;

    let cache_key = format!("price:{}", update.symbol);
    let _: () = redis
        .set(
            &cache_key,
            payload.as_str(),
            Some(Expiration::EX(300)),
            None,
            false,
        )
        .await?;

    Ok(())
}
