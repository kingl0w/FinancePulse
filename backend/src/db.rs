use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

use crate::config::Config;
use crate::error::AppError;

pub async fn create_pool(config: &Config) -> Result<PgPool, AppError> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(&config.database_url)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to connect to database: {e}")))?;

    sqlx::migrate!()
        .run(&pool)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to run migrations: {e}")))?;

    tracing::info!("Database pool created and migrations applied");
    Ok(pool)
}
