use axum::{
    extract::{Path, State},
    routing::{delete, get, post, put},
    Json, Router,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::error::AppError;
use crate::models::{AssetType, Holding, Portfolio};
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_portfolios).post(create_portfolio))
        .route("/{id}", get(get_portfolio).delete(delete_portfolio))
        .route("/{id}/holdings", post(add_holding))
        .route(
            "/{id}/holdings/{hid}",
            put(update_holding).delete(remove_holding),
        )
        .route("/{id}/performance", get(get_performance))
}

#[derive(Debug, Deserialize)]
struct CreatePortfolioRequest {
    name: String,
}

#[derive(Debug, Serialize)]
struct PortfolioSummary {
    id: Uuid,
    name: String,
    holding_count: i64,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct HoldingWithPrice {
    #[serde(flatten)]
    holding: Holding,
    current_price: Option<f64>,
    current_value: Option<f64>,
    total_cost: f64,
    pnl: Option<f64>,
    pnl_percent: Option<f64>,
}

#[derive(Debug, Serialize)]
struct PortfolioDetail {
    id: Uuid,
    name: String,
    created_at: DateTime<Utc>,
    holdings: Vec<HoldingWithPrice>,
}

#[derive(Debug, Deserialize)]
struct AddHoldingRequest {
    symbol: String,
    quantity: f64,
    avg_cost: f64,
    asset_type: AssetType,
}

#[derive(Debug, Deserialize)]
struct UpdateHoldingRequest {
    quantity: Option<f64>,
    avg_cost: Option<f64>,
}

#[derive(Debug, Serialize)]
struct PerformanceResponse {
    total_value: f64,
    total_cost: f64,
    total_pnl: f64,
    total_pnl_percent: f64,
    holdings: Vec<HoldingWithPrice>,
}

async fn get_current_price(redis: &fred::prelude::Client, symbol: &str) -> Option<f64> {
    use fred::interfaces::KeysInterface;
    let cache_key = format!("crypto:meta:{}", symbol.to_uppercase());
    if let Ok(val) = redis.get::<Option<String>, _>(&cache_key).await {
        if let Some(json_str) = val {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
                if let Some(price) = parsed.get("price").and_then(|p| p.as_f64()) {
                    return Some(price);
                }
            }
        }
    }
    let latest_key = format!("price:latest:{}", symbol.to_uppercase());
    if let Ok(val) = redis.get::<Option<String>, _>(&latest_key).await {
        if let Some(price_str) = val {
            if let Ok(price) = price_str.parse::<f64>() {
                return Some(price);
            }
        }
    }
    None
}

fn enrich_holding(holding: Holding, current_price: Option<f64>) -> HoldingWithPrice {
    let total_cost = holding.quantity * holding.avg_cost;
    let (current_value, pnl, pnl_percent) = match current_price {
        Some(price) => {
            let cv = holding.quantity * price;
            let p = cv - total_cost;
            let pp = if total_cost > 0.0 {
                (p / total_cost) * 100.0
            } else {
                0.0
            };
            (Some(cv), Some(p), Some(pp))
        }
        None => (None, None, None),
    };
    HoldingWithPrice {
        holding,
        current_price,
        current_value,
        total_cost,
        pnl,
        pnl_percent,
    }
}

async fn verify_portfolio_ownership(
    db: &sqlx::PgPool,
    portfolio_id: Uuid,
    user_id: Uuid,
) -> Result<Portfolio, AppError> {
    let portfolio = sqlx::query_as::<_, Portfolio>(
        "SELECT id, user_id, name, created_at FROM portfolios WHERE id = $1",
    )
    .bind(portfolio_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| AppError::NotFound("Portfolio not found".to_string()))?;

    if portfolio.user_id != user_id {
        return Err(AppError::NotFound("Portfolio not found".to_string()));
    }
    Ok(portfolio)
}

async fn list_portfolios(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<PortfolioSummary>>, AppError> {
    let rows = sqlx::query_as::<_, (Uuid, String, DateTime<Utc>, i64)>(
        "SELECT p.id, p.name, p.created_at, COUNT(h.id) as holding_count \
         FROM portfolios p \
         LEFT JOIN holdings h ON h.portfolio_id = p.id \
         WHERE p.user_id = $1 \
         GROUP BY p.id, p.name, p.created_at \
         ORDER BY p.created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(&state.db)
    .await?;

    let summaries = rows
        .into_iter()
        .map(|(id, name, created_at, holding_count)| PortfolioSummary {
            id,
            name,
            holding_count,
            created_at,
        })
        .collect();

    Ok(Json(summaries))
}

async fn create_portfolio(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreatePortfolioRequest>,
) -> Result<Json<Portfolio>, AppError> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::BadRequest(
            "Portfolio name cannot be empty".to_string(),
        ));
    }
    if name.len() > 100 {
        return Err(AppError::BadRequest(
            "Portfolio name cannot exceed 100 characters".to_string(),
        ));
    }

    let id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query(
        "INSERT INTO portfolios (id, user_id, name, created_at) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(&name)
    .bind(now)
    .execute(&state.db)
    .await?;

    Ok(Json(Portfolio {
        id,
        user_id: auth.user_id,
        name,
        created_at: now,
    }))
}

async fn get_portfolio(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<PortfolioDetail>, AppError> {
    let portfolio = verify_portfolio_ownership(&state.db, id, auth.user_id).await?;

    let holdings = sqlx::query_as::<_, Holding>(
        "SELECT id, portfolio_id, symbol, quantity, avg_cost, asset_type, added_at \
         FROM holdings WHERE portfolio_id = $1 ORDER BY added_at DESC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let mut enriched = Vec::with_capacity(holdings.len());
    for h in holdings {
        let price = get_current_price(&state.redis, &h.symbol).await;
        enriched.push(enrich_holding(h, price));
    }

    Ok(Json(PortfolioDetail {
        id: portfolio.id,
        name: portfolio.name,
        created_at: portfolio.created_at,
        holdings: enriched,
    }))
}

async fn delete_portfolio(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    verify_portfolio_ownership(&state.db, id, auth.user_id).await?;

    sqlx::query("DELETE FROM portfolios WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn add_holding(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(portfolio_id): Path<Uuid>,
    Json(body): Json<AddHoldingRequest>,
) -> Result<Json<Holding>, AppError> {
    verify_portfolio_ownership(&state.db, portfolio_id, auth.user_id).await?;

    let symbol = body.symbol.trim().to_uppercase();
    if symbol.is_empty() {
        return Err(AppError::BadRequest("Symbol cannot be empty".to_string()));
    }
    if body.quantity <= 0.0 {
        return Err(AppError::BadRequest(
            "Quantity must be greater than 0".to_string(),
        ));
    }
    if body.avg_cost <= 0.0 {
        return Err(AppError::BadRequest(
            "Average cost must be greater than 0".to_string(),
        ));
    }

    let existing = sqlx::query_as::<_, Holding>(
        "SELECT id, portfolio_id, symbol, quantity, avg_cost, asset_type, added_at \
         FROM holdings WHERE portfolio_id = $1 AND symbol = $2",
    )
    .bind(portfolio_id)
    .bind(&symbol)
    .fetch_optional(&state.db)
    .await?;

    if let Some(existing) = existing {
        let new_quantity = existing.quantity + body.quantity;
        let new_avg_cost = ((existing.quantity * existing.avg_cost)
            + (body.quantity * body.avg_cost))
            / new_quantity;

        sqlx::query("UPDATE holdings SET quantity = $1, avg_cost = $2 WHERE id = $3")
            .bind(new_quantity)
            .bind(new_avg_cost)
            .bind(existing.id)
            .execute(&state.db)
            .await?;

        Ok(Json(Holding {
            quantity: new_quantity,
            avg_cost: new_avg_cost,
            ..existing
        }))
    } else {
        let id = Uuid::new_v4();
        let now = Utc::now();

        let asset_type_str = match body.asset_type {
            AssetType::Stock => "stock",
            AssetType::Crypto => "crypto",
            AssetType::Etf => "etf",
            AssetType::Commodity => "commodity",
            AssetType::Index => "index",
            AssetType::Bonds => "bonds",
        };

        sqlx::query(
            "INSERT INTO holdings (id, portfolio_id, symbol, quantity, avg_cost, asset_type, added_at) \
             VALUES ($1, $2, $3, $4, $5, $6::asset_type, $7)",
        )
        .bind(id)
        .bind(portfolio_id)
        .bind(&symbol)
        .bind(body.quantity)
        .bind(body.avg_cost)
        .bind(asset_type_str)
        .bind(now)
        .execute(&state.db)
        .await?;

        Ok(Json(Holding {
            id,
            portfolio_id,
            symbol,
            quantity: body.quantity,
            avg_cost: body.avg_cost,
            asset_type: body.asset_type,
            added_at: now,
        }))
    }
}

async fn update_holding(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((portfolio_id, hid)): Path<(Uuid, Uuid)>,
    Json(body): Json<UpdateHoldingRequest>,
) -> Result<Json<Holding>, AppError> {
    verify_portfolio_ownership(&state.db, portfolio_id, auth.user_id).await?;

    let mut holding = sqlx::query_as::<_, Holding>(
        "SELECT id, portfolio_id, symbol, quantity, avg_cost, asset_type, added_at \
         FROM holdings WHERE id = $1 AND portfolio_id = $2",
    )
    .bind(hid)
    .bind(portfolio_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Holding not found".to_string()))?;

    if let Some(qty) = body.quantity {
        if qty <= 0.0 {
            return Err(AppError::BadRequest(
                "Quantity must be greater than 0".to_string(),
            ));
        }
        holding.quantity = qty;
    }
    if let Some(cost) = body.avg_cost {
        if cost <= 0.0 {
            return Err(AppError::BadRequest(
                "Average cost must be greater than 0".to_string(),
            ));
        }
        holding.avg_cost = cost;
    }

    sqlx::query("UPDATE holdings SET quantity = $1, avg_cost = $2 WHERE id = $3")
        .bind(holding.quantity)
        .bind(holding.avg_cost)
        .bind(hid)
        .execute(&state.db)
        .await?;

    Ok(Json(holding))
}

async fn remove_holding(
    State(state): State<AppState>,
    auth: AuthUser,
    Path((portfolio_id, hid)): Path<(Uuid, Uuid)>,
) -> Result<Json<serde_json::Value>, AppError> {
    verify_portfolio_ownership(&state.db, portfolio_id, auth.user_id).await?;

    let result = sqlx::query("DELETE FROM holdings WHERE id = $1 AND portfolio_id = $2")
        .bind(hid)
        .bind(portfolio_id)
        .execute(&state.db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Holding not found".to_string()));
    }

    Ok(Json(serde_json::json!({ "deleted": true })))
}

async fn get_performance(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<PerformanceResponse>, AppError> {
    verify_portfolio_ownership(&state.db, id, auth.user_id).await?;

    let holdings = sqlx::query_as::<_, Holding>(
        "SELECT id, portfolio_id, symbol, quantity, avg_cost, asset_type, added_at \
         FROM holdings WHERE portfolio_id = $1 ORDER BY added_at DESC",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    let mut total_value = 0.0;
    let mut total_cost = 0.0;
    let mut enriched = Vec::with_capacity(holdings.len());

    for h in holdings {
        let price = get_current_price(&state.redis, &h.symbol).await;
        let cost = h.quantity * h.avg_cost;
        total_cost += cost;
        if let Some(p) = price {
            total_value += h.quantity * p;
        }
        enriched.push(enrich_holding(h, price));
    }

    let total_pnl = total_value - total_cost;
    let total_pnl_percent = if total_cost > 0.0 {
        (total_pnl / total_cost) * 100.0
    } else {
        0.0
    };

    Ok(Json(PerformanceResponse {
        total_value,
        total_cost,
        total_pnl,
        total_pnl_percent,
        holdings: enriched,
    }))
}
