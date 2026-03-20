use std::time::Duration;

use fred::interfaces::KeysInterface;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::AlertDirection;

#[derive(Debug, sqlx::FromRow)]
struct PendingAlert {
    id: Uuid,
    user_id: Uuid,
    symbol: String,
    target_price: f64,
    direction: AlertDirection,
}

pub fn spawn(db: PgPool, redis: fred::prelude::Client) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(5));

        loop {
            interval.tick().await;

            if let Err(e) = check_alerts(&db, &redis).await {
                tracing::warn!("Alert checker error: {e}");
            }
        }
    });
    tracing::info!("Alert checker background task started (5s interval)");
}

async fn check_alerts(
    db: &PgPool,
    redis: &fred::prelude::Client,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let alerts = sqlx::query_as::<_, PendingAlert>(
        "SELECT id, user_id, symbol, target_price, direction \
         FROM alerts WHERE triggered = false",
    )
    .fetch_all(db)
    .await?;

    if alerts.is_empty() {
        return Ok(());
    }

    for alert in &alerts {
        let price = get_price(redis, &alert.symbol).await;
        let price = match price {
            Some(p) => p,
            None => continue,
        };

        let triggered = match alert.direction {
            AlertDirection::Above => price >= alert.target_price,
            AlertDirection::Below => price <= alert.target_price,
        };

        if triggered {
            sqlx::query("UPDATE alerts SET triggered = true WHERE id = $1")
                .bind(alert.id)
                .execute(db)
                .await?;

            tracing::info!(
                alert_id = %alert.id,
                user_id = %alert.user_id,
                symbol = %alert.symbol,
                direction = ?alert.direction,
                target = alert.target_price,
                current = price,
                "Alert triggered"
            );
        }
    }

    Ok(())
}

async fn get_price(redis: &fred::prelude::Client, symbol: &str) -> Option<f64> {
    let cache_key = format!("crypto:meta:{}", symbol.to_uppercase());
    if let Ok(Some(json_str)) = redis.get::<Option<String>, _>(&cache_key).await {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
            if let Some(price) = parsed.get("price").and_then(|p| p.as_f64()) {
                return Some(price);
            }
        }
    }

    let latest_key = format!("price:latest:{}", symbol.to_uppercase());
    if let Ok(Some(price_str)) = redis.get::<Option<String>, _>(&latest_key).await {
        if let Ok(price) = price_str.parse::<f64>() {
            return Some(price);
        }
    }

    None
}
