use axum::{
    extract::{Path, State},
    routing::{delete, get, post},
    Json, Router,
};
use chrono::Utc;
use serde::Deserialize;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::error::AppError;
use crate::models::{Alert, AlertDirection};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_alerts).post(create_alert))
        .route("/{id}", delete(delete_alert))
}

#[derive(Debug, Deserialize)]
struct CreateAlertRequest {
    symbol: String,
    target_price: f64,
    direction: AlertDirection,
}

async fn list_alerts(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Alert>>, AppError> {
    let alerts = sqlx::query_as::<_, Alert>(
        "SELECT id, user_id, symbol, target_price, direction, triggered, created_at \
         FROM alerts WHERE user_id = $1 ORDER BY created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(alerts))
}

async fn create_alert(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateAlertRequest>,
) -> Result<Json<Alert>, AppError> {
    let symbol = body.symbol.trim().to_uppercase();
    if symbol.is_empty() {
        return Err(AppError::BadRequest("Symbol cannot be empty".to_string()));
    }
    if body.target_price <= 0.0 {
        return Err(AppError::BadRequest(
            "Target price must be greater than 0".to_string(),
        ));
    }

    let id = Uuid::new_v4();
    let now = Utc::now();

    let direction_str = match body.direction {
        AlertDirection::Above => "above",
        AlertDirection::Below => "below",
    };

    sqlx::query(
        "INSERT INTO alerts (id, user_id, symbol, target_price, direction, triggered, created_at) \
         VALUES ($1, $2, $3, $4, $5::alert_direction, $6, $7)",
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(&symbol)
    .bind(body.target_price)
    .bind(direction_str)
    .bind(false)
    .bind(now)
    .execute(&state.db)
    .await?;

    Ok(Json(Alert {
        id,
        user_id: auth.user_id,
        symbol,
        target_price: body.target_price,
        direction: body.direction,
        triggered: false,
        created_at: now,
    }))
}

async fn delete_alert(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query("DELETE FROM alerts WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth.user_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Alert not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}
