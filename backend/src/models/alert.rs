use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "alert_direction", rename_all = "lowercase")]
pub enum AlertDirection {
    Above,
    Below,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Alert {
    pub id: Uuid,
    pub user_id: Uuid,
    pub symbol: String,
    pub target_price: f64,
    pub direction: AlertDirection,
    pub triggered: bool,
    pub created_at: DateTime<Utc>,
}
