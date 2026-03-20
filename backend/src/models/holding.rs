use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "asset_type", rename_all = "lowercase")]
pub enum AssetType {
    Stock,
    Crypto,
    Etf,
    Commodity,
    Index,
    Bonds,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Holding {
    pub id: Uuid,
    pub portfolio_id: Uuid,
    pub symbol: String,
    pub quantity: f64,
    pub avg_cost: f64,
    pub asset_type: AssetType,
    pub added_at: DateTime<Utc>,
}
