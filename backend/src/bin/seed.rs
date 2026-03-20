use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2,
};
use chrono::Utc;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

const TEST_EMAIL: &str = "test@financepulse.com";
const TEST_PASSWORD: &str = "password123";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL environment variable is required");

    let pool = PgPoolOptions::new()
        .max_connections(2)
        .connect(&database_url)
        .await?;

    println!("Connected to database");

    sqlx::migrate!().run(&pool).await?;
    println!("Migrations applied");

    let deleted = sqlx::query("DELETE FROM users WHERE email = $1")
        .bind(TEST_EMAIL)
        .execute(&pool)
        .await?;

    if deleted.rows_affected() > 0 {
        println!("Deleted existing test user and all associated data");
    }

    let user_id = Uuid::new_v4();
    let now = Utc::now();

    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(TEST_PASSWORD.as_bytes(), &salt)
        .map_err(|e| format!("Failed to hash password: {e}"))?
        .to_string();

    sqlx::query(
        "INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)",
    )
    .bind(user_id)
    .bind(TEST_EMAIL)
    .bind(&password_hash)
    .bind(now)
    .execute(&pool)
    .await?;

    println!("Created test user: {TEST_EMAIL} (id: {user_id})");

    sqlx::query(
        "INSERT INTO watchlists (id, user_id, name, symbols, sort_order, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind("My Watchlist")
    .bind(&vec!["BTC", "ETH", "AAPL", "MSFT", "SPY"])
    .bind(0i32)
    .bind(now)
    .bind(now)
    .execute(&pool)
    .await?;

    println!("Created default watchlist");

    let tech_id = Uuid::new_v4();
    sqlx::query("INSERT INTO portfolios (id, user_id, name, created_at) VALUES ($1, $2, $3, $4)")
        .bind(tech_id)
        .bind(user_id)
        .bind("Tech Growth")
        .bind(now)
        .execute(&pool)
        .await?;

    let tech_holdings: &[(&str, f64, f64, &str)] = &[
        ("AAPL", 10.0, 230.0, "stock"),
        ("MSFT", 5.0, 380.0, "stock"),
        ("NVDA", 20.0, 150.0, "stock"),
    ];

    for (symbol, quantity, avg_cost, asset_type) in tech_holdings {
        sqlx::query(
            "INSERT INTO holdings (id, portfolio_id, symbol, quantity, avg_cost, asset_type, added_at) \
             VALUES ($1, $2, $3, $4, $5, $6::asset_type, $7)",
        )
        .bind(Uuid::new_v4())
        .bind(tech_id)
        .bind(*symbol)
        .bind(*quantity)
        .bind(*avg_cost)
        .bind(*asset_type)
        .bind(now)
        .execute(&pool)
        .await?;
    }

    println!("Created portfolio \"Tech Growth\" with 3 holdings");

    let crypto_id = Uuid::new_v4();
    sqlx::query("INSERT INTO portfolios (id, user_id, name, created_at) VALUES ($1, $2, $3, $4)")
        .bind(crypto_id)
        .bind(user_id)
        .bind("Crypto Mix")
        .bind(now)
        .execute(&pool)
        .await?;

    let crypto_holdings: &[(&str, f64, f64, &str)] = &[
        ("BTC", 0.5, 65000.0, "crypto"),
        ("ETH", 5.0, 2000.0, "crypto"),
        ("SOL", 50.0, 80.0, "crypto"),
    ];

    for (symbol, quantity, avg_cost, asset_type) in crypto_holdings {
        sqlx::query(
            "INSERT INTO holdings (id, portfolio_id, symbol, quantity, avg_cost, asset_type, added_at) \
             VALUES ($1, $2, $3, $4, $5, $6::asset_type, $7)",
        )
        .bind(Uuid::new_v4())
        .bind(crypto_id)
        .bind(*symbol)
        .bind(*quantity)
        .bind(*avg_cost)
        .bind(*asset_type)
        .bind(now)
        .execute(&pool)
        .await?;
    }

    println!("Created portfolio \"Crypto Mix\" with 3 holdings");

    let alerts: &[(&str, f64, &str)] = &[
        ("BTC", 70000.0, "above"),
        ("AAPL", 160.0, "below"),
        ("ETH", 3000.0, "above"),
    ];

    for (symbol, target_price, direction) in alerts {
        sqlx::query(
            "INSERT INTO alerts (id, user_id, symbol, target_price, direction, triggered, created_at) \
             VALUES ($1, $2, $3, $4, $5::alert_direction, $6, $7)",
        )
        .bind(Uuid::new_v4())
        .bind(user_id)
        .bind(*symbol)
        .bind(*target_price)
        .bind(*direction)
        .bind(false)
        .bind(now)
        .execute(&pool)
        .await?;
    }

    println!("Created 3 sample alerts");

    print_credentials();

    Ok(())
}

fn print_credentials() {
    println!("\n{}", "=".repeat(60));
    println!("  Test User Credentials");
    println!("{}", "=".repeat(60));
    println!("  Email:    {TEST_EMAIL}");
    println!("  Password: {TEST_PASSWORD}");
    println!("{}", "-".repeat(60));
    println!("  Login with curl:");
    println!();
    println!(
        "  curl -s -X POST http://localhost:8080/api/auth/login \\"
    );
    println!("    -H \"Content-Type: application/json\" \\");
    println!(
        "    -d '{{\"email\": \"{TEST_EMAIL}\", \"password\": \"{TEST_PASSWORD}\"}}' | jq ."
    );
    println!("{}", "=".repeat(60));
}
