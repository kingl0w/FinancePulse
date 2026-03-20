use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use uuid::Uuid;

use super::broadcast;
use crate::AppState;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

#[derive(Debug, Deserialize)]
struct WsIncoming {
    #[serde(rename = "type")]
    msg_type: String,
    symbols: Option<Vec<String>>,
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let client_id = Uuid::new_v4();
    let registry = &state.ws_registry;
    tracing::info!(%client_id, "WebSocket client connected");

    let mut rx = broadcast::register_client(registry, client_id).await;
    let (mut ws_sink, mut ws_stream) = socket.split();

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_sink.send(msg).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = ws_stream.next().await {
        match msg {
            Message::Text(text) => {
                let parsed: Result<WsIncoming, _> = serde_json::from_str(&text);
                match parsed {
                    Ok(incoming) => match incoming.msg_type.as_str() {
                        "subscribe" => {
                            if let Some(symbols) = incoming.symbols {
                                let normalized: Vec<String> =
                                    symbols.into_iter().map(|s| s.to_uppercase()).collect();
                                broadcast::subscribe_symbols(
                                    registry,
                                    client_id,
                                    normalized.clone(),
                                )
                                .await;
                                let ack = serde_json::json!({
                                    "type": "subscribed",
                                    "symbols": normalized,
                                });
                                let guard = registry.read().await;
                                if let Some(client) = guard.get(&client_id) {
                                    let _ = client.sender.try_send(Message::Text(
                                        ack.to_string().into(),
                                    ));
                                }
                            }
                        }
                        "unsubscribe" => {
                            if let Some(symbols) = incoming.symbols {
                                let normalized: Vec<String> =
                                    symbols.into_iter().map(|s| s.to_uppercase()).collect();
                                broadcast::unsubscribe_symbols(
                                    registry,
                                    client_id,
                                    normalized.clone(),
                                )
                                .await;
                                let ack = serde_json::json!({
                                    "type": "unsubscribed",
                                    "symbols": normalized,
                                });
                                let guard = registry.read().await;
                                if let Some(client) = guard.get(&client_id) {
                                    let _ = client.sender.try_send(Message::Text(
                                        ack.to_string().into(),
                                    ));
                                }
                            }
                        }
                        "ping" => {
                            let pong = serde_json::json!({ "type": "pong" });
                            let guard = registry.read().await;
                            if let Some(client) = guard.get(&client_id) {
                                let _ = client.sender.try_send(Message::Text(
                                    pong.to_string().into(),
                                ));
                            }
                        }
                        other => {
                            tracing::debug!(%client_id, msg_type = %other, "Unknown message type");
                        }
                    },
                    Err(e) => {
                        tracing::debug!(%client_id, "Failed to parse WS message: {e}");
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    send_task.abort();
    broadcast::unregister_client(registry, client_id).await;
    tracing::info!(%client_id, "WebSocket client disconnected");
}
