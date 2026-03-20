use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub jwt_refresh_secret: String,
    pub finnhub_api_key: String,
    pub alpha_vantage_key: String,
    pub server_host: String,
    pub server_port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: required_var("DATABASE_URL"),
            redis_url: required_var("REDIS_URL"),
            jwt_secret: required_var("JWT_SECRET"),
            jwt_refresh_secret: required_var("JWT_REFRESH_SECRET"),
            finnhub_api_key: env::var("FINNHUB_API_KEY")
                .unwrap_or_default()
                .trim()
                .to_string(),
            alpha_vantage_key: env::var("ALPHA_VANTAGE_KEY").unwrap_or_default(),
            server_host: env::var("SERVER_HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: env::var("SERVER_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8080),
        }
    }

    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }
}

fn required_var(name: &str) -> String {
    env::var(name).unwrap_or_else(|_| panic!("{name} environment variable is required"))
}
