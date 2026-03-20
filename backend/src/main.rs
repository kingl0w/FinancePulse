mod auth;
mod config;
mod db;
mod error;
pub mod indicators;
mod ingestion;
mod models;
mod routes;
mod tasks;
mod ws;

use axum::Router;
use fred::interfaces::ClientLike;
use sqlx::PgPool;
use tokio::net::TcpListener;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::Config;
use ws::broadcast::{self, ClientRegistry};

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub config: Config,
    pub redis: fred::prelude::Client,
    pub ws_registry: ClientRegistry,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            "financepulse_backend=debug,tower_http=debug,axum=trace".into()
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env();
    let bind_addr = config.bind_addr();

    let pool = db::create_pool(&config)
        .await
        .expect("Failed to create database pool");

    let redis_config = fred::prelude::Config::from_url(&config.redis_url)
        .expect("Invalid REDIS_URL");
    let redis: fred::prelude::Client = fred::prelude::Builder::from_config(redis_config.clone())
        .build()
        .expect("Failed to build Redis client");
    redis.init().await.expect("Failed to connect to Redis");
    tracing::info!("Redis client connected");

    let registry = broadcast::new_registry();
    broadcast::start_broadcast_listener(redis_config.clone(), registry.clone())
        .await
        .expect("Failed to start broadcast listener");
    tracing::info!("Broadcast listener started");

    let _ingestion_handles = ingestion::start_all_ingestion(&config, redis.clone());

    tasks::alert_checker::spawn(pool.clone(), redis.clone());

    let state = AppState {
        db: pool,
        config: config.clone(),
        redis,
        ws_registry: registry,
    };

    let allowed_origins_str = std::env::var("ALLOWED_ORIGINS")
        .unwrap_or_else(|_| "http://localhost:3000,http://localhost:3003".to_string());
    let origins: Vec<axum::http::HeaderValue> = allowed_origins_str
        .split(',')
        .filter_map(|s| {
            let trimmed = s.trim();
            if trimmed.is_empty() {
                return None;
            }
            match trimmed.parse::<axum::http::HeaderValue>() {
                Ok(val) => Some(val),
                Err(e) => {
                    tracing::warn!("Ignoring invalid CORS origin '{trimmed}': {e}");
                    None
                }
            }
        })
        .collect();
    tracing::info!("CORS allowed origins: {allowed_origins_str}");
    let cors = CorsLayer::new()
        .allow_origin(origins)
        .allow_methods(Any)
        .allow_headers(Any);

    let api_routes = Router::new()
        .route("/api/predictions/trending", axum::routing::get(routes::market::get_predictions_trending))
        .route("/api/predictions/{slug}", axum::routing::get(routes::market::get_prediction_by_slug))
        .route("/api/market/trending", axum::routing::get(routes::market::get_trending))
        .route("/api/market/sparklines", axum::routing::get(routes::market::get_sparklines))
        .route("/api/market/heatmap", axum::routing::get(routes::market::get_heatmap))
        .route("/api/market/currencies", axum::routing::get(routes::market::get_currencies))
        .route("/api/market/{symbol}/indicators", axum::routing::get(routes::market::get_indicators))
        .route("/api/market/{symbol}/news", axum::routing::get(routes::market::get_news))
        .route("/api/market/news", axum::routing::get(routes::market::get_general_news))
        .nest("/api/auth", routes::auth::router())
        .nest("/api/portfolio", routes::portfolio::router())
        .nest("/api/alerts", routes::alerts::router())
        .nest("/api/watchlists", routes::watchlists::router())
        .nest("/api/market", routes::market::router())
        .layer(CompressionLayer::new());

    let app = Router::new()
        .route("/ws", axum::routing::get(ws::server::ws_handler))
        .merge(api_routes)
        .layer(axum::Extension(config))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let listener = TcpListener::bind(&bind_addr).await.unwrap();
    tracing::info!("FinancePulse backend listening on {bind_addr}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("Failed to install CTRL+C signal handler");
    tracing::info!("Shutdown signal received, starting graceful shutdown");
}
