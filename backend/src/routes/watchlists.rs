use axum::{
    extract::{Path, State},
    routing::{delete, get, post, put},
    Json, Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::error::AppError;
use crate::models::Watchlist;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_watchlists).post(create_watchlist))
        .route("/{id}", put(update_watchlist).delete(delete_watchlist))
        .route("/{id}/symbols", post(add_symbol))
        .route("/{id}/symbols/{symbol}", delete(remove_symbol))
        .route("/check/{symbol}", get(check_symbol))
}

#[derive(Debug, Deserialize)]
struct CreateWatchlistRequest {
    name: String,
}

#[derive(Debug, Deserialize)]
struct UpdateWatchlistRequest {
    name: Option<String>,
    symbols: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct AddSymbolRequest {
    symbol: String,
}

#[derive(Debug, Serialize)]
struct CheckResponse {
    in_watchlist: bool,
    watchlist_id: Option<Uuid>,
}

async fn list_watchlists(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<Watchlist>>, AppError> {
    let watchlists = sqlx::query_as::<_, Watchlist>(
        "SELECT id, user_id, name, symbols, sort_order, created_at, updated_at \
         FROM watchlists WHERE user_id = $1 ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(auth.user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(watchlists))
}

async fn create_watchlist(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateWatchlistRequest>,
) -> Result<Json<Watchlist>, AppError> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest("Name cannot be empty".to_string()));
    }
    if name.len() > 100 {
        return Err(AppError::BadRequest("Name must be 100 characters or fewer".to_string()));
    }

    let id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query(
        "INSERT INTO watchlists (id, user_id, name, symbols, sort_order, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(&name)
    .bind(&Vec::<String>::new())
    .bind(0i32)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await?;

    Ok(Json(Watchlist {
        id,
        user_id: auth.user_id,
        name,
        symbols: vec![],
        sort_order: 0,
        created_at: now,
        updated_at: now,
    }))
}

async fn update_watchlist(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateWatchlistRequest>,
) -> Result<Json<Watchlist>, AppError> {
    let existing = sqlx::query_as::<_, Watchlist>(
        "SELECT id, user_id, name, symbols, sort_order, created_at, updated_at \
         FROM watchlists WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Watchlist not found".to_string()))?;

    let name = body.name.map(|n| n.trim().to_string()).unwrap_or(existing.name);
    if name.len() > 100 {
        return Err(AppError::BadRequest("Name must be 100 characters or fewer".to_string()));
    }
    let symbols = body.symbols.unwrap_or(existing.symbols);
    if symbols.len() > 50 {
        return Err(AppError::BadRequest("Watchlist can contain at most 50 symbols".to_string()));
    }
    let now = Utc::now();

    sqlx::query(
        "UPDATE watchlists SET name = $1, symbols = $2, updated_at = $3 WHERE id = $4 AND user_id = $5",
    )
    .bind(&name)
    .bind(&symbols)
    .bind(now)
    .bind(id)
    .bind(auth.user_id)
    .execute(&state.db)
    .await?;

    Ok(Json(Watchlist {
        id,
        user_id: auth.user_id,
        name,
        symbols,
        sort_order: existing.sort_order,
        created_at: existing.created_at,
        updated_at: now,
    }))
}

async fn delete_watchlist(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query("DELETE FROM watchlists WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(auth.user_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Watchlist not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn add_symbol(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<AddSymbolRequest>,
) -> Result<Json<Watchlist>, AppError> {
    let symbol = body.symbol.trim().to_uppercase();
    if symbol.is_empty() {
        return Err(AppError::BadRequest("Symbol cannot be empty".to_string()));
    }
    if symbol.len() > 20 {
        return Err(AppError::BadRequest("Symbol must be 20 characters or fewer".to_string()));
    }

    sqlx::query(
        "UPDATE watchlists SET symbols = array_append(symbols, $1), updated_at = $2 \
         WHERE id = $3 AND user_id = $4 AND NOT ($1 = ANY(symbols)) AND array_length(symbols, 1) < 50",
    )
    .bind(&symbol)
    .bind(Utc::now())
    .bind(id)
    .bind(auth.user_id)
    .execute(&state.db)
    .await?;

    let watchlist = sqlx::query_as::<_, Watchlist>(
        "SELECT id, user_id, name, symbols, sort_order, created_at, updated_at \
         FROM watchlists WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Watchlist not found".to_string()))?;

    Ok(Json(watchlist))
}

async fn remove_symbol(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((id, symbol)): Path<(Uuid, String)>,
) -> Result<Json<Watchlist>, AppError> {
    let symbol = symbol.trim().to_uppercase();

    sqlx::query(
        "UPDATE watchlists SET symbols = array_remove(symbols, $1), updated_at = $2 \
         WHERE id = $3 AND user_id = $4",
    )
    .bind(&symbol)
    .bind(Utc::now())
    .bind(id)
    .bind(auth.user_id)
    .execute(&state.db)
    .await?;

    let watchlist = sqlx::query_as::<_, Watchlist>(
        "SELECT id, user_id, name, symbols, sort_order, created_at, updated_at \
         FROM watchlists WHERE id = $1 AND user_id = $2",
    )
    .bind(id)
    .bind(auth.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Watchlist not found".to_string()))?;

    Ok(Json(watchlist))
}

async fn check_symbol(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(symbol): Path<String>,
) -> Result<Json<CheckResponse>, AppError> {
    let symbol = symbol.trim().to_uppercase();

    let result = sqlx::query_as::<_, (Uuid,)>(
        "SELECT id FROM watchlists WHERE user_id = $1 AND $2 = ANY(symbols) LIMIT 1",
    )
    .bind(auth.user_id)
    .bind(&symbol)
    .fetch_optional(&state.db)
    .await?;

    Ok(Json(CheckResponse {
        in_watchlist: result.is_some(),
        watchlist_id: result.map(|r| r.0),
    }))
}
