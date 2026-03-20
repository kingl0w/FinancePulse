use axum::{extract::State, routing::{delete, get, post}, Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::jwt::{create_token_pair, validate_token};
use crate::auth::middleware::AuthUser;
use crate::auth::password::{hash_password, validate_email, validate_password, verify_password};
use crate::error::AppError;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/refresh", post(refresh))
        .route("/me", get(me))
        .route("/account", delete(delete_account))
}

#[derive(Debug, Deserialize)]
struct RegisterRequest {
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Debug, Deserialize)]
struct RefreshRequest {
    refresh_token: String,
}

#[derive(Debug, Serialize)]
struct UserResponse {
    id: Uuid,
    email: String,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
struct AuthResponse {
    user: UserResponse,
    access_token: String,
    refresh_token: String,
}

async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let email = body.email.trim().to_lowercase();
    validate_email(&email)?;
    validate_password(&body.password)?;

    let existing = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM users WHERE email = $1",
    )
    .bind(&email)
    .fetch_one(&state.db)
    .await?;

    if existing > 0 {
        return Err(AppError::BadRequest(
            "An account with this email already exists".to_string(),
        ));
    }

    let password_hash = hash_password(&body.password)?;
    let id = Uuid::new_v4();
    let now = Utc::now();

    sqlx::query(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(&email)
    .bind(&password_hash)
    .bind(now)
    .execute(&state.db)
    .await?;

    let watchlist_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO watchlists (id, user_id, name, symbols, sort_order, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(watchlist_id)
    .bind(id)
    .bind("My Watchlist")
    .bind(&vec!["BTC", "ETH", "AAPL", "MSFT", "SPY"])
    .bind(0i32)
    .bind(now)
    .bind(now)
    .execute(&state.db)
    .await?;

    let (access_token, refresh_token) = create_token_pair(id, &state.config)?;

    Ok(Json(AuthResponse {
        user: UserResponse {
            id,
            email,
            created_at: now,
        },
        access_token,
        refresh_token,
    }))
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let email = body.email.trim().to_lowercase();

    let user = sqlx::query_as::<_, crate::models::User>(
        "SELECT id, email, password_hash, created_at FROM users WHERE email = $1",
    )
    .bind(&email)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Auth("Invalid email or password".to_string()))?;

    if !verify_password(&body.password, &user.password_hash)? {
        return Err(AppError::Auth("Invalid email or password".to_string()));
    }

    let (access_token, refresh_token) = create_token_pair(user.id, &state.config)?;

    Ok(Json(AuthResponse {
        user: UserResponse {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
        },
        access_token,
        refresh_token,
    }))
}

async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let claims = validate_token(&body.refresh_token, &state.config.jwt_refresh_secret)?;

    if claims.token_type != "refresh" {
        return Err(AppError::Auth(
            "Invalid token type: expected refresh token".to_string(),
        ));
    }

    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::Auth("Invalid user ID in token".to_string()))?;

    let user = sqlx::query_as::<_, crate::models::User>(
        "SELECT id, email, password_hash, created_at FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::Auth("User no longer exists".to_string()))?;

    let (access_token, refresh_token) = create_token_pair(user.id, &state.config)?;

    Ok(Json(AuthResponse {
        user: UserResponse {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
        },
        access_token,
        refresh_token,
    }))
}

async fn me(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<UserResponse>, AppError> {
    let user = sqlx::query_as::<_, crate::models::User>(
        "SELECT id, email, password_hash, created_at FROM users WHERE id = $1",
    )
    .bind(auth.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("User not found".to_string()))?;

    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
    }))
}

async fn delete_account(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(auth.user_id)
        .execute(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to delete account: {e}")))?;

    Ok(Json(serde_json::json!({ "message": "Account deleted" })))
}
