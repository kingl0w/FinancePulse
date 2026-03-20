use std::time::Duration;
use fred::prelude::*;
use serde::{Deserialize, Serialize};

const POLL_INTERVAL: Duration = Duration::from_secs(300);
const CACHE_TTL_SECS: i64 = 300;
const API_URL: &str = "https://gamma-api.polymarket.com/events";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawEvent {
    #[allow(dead_code)]
    id: Option<String>,
    title: Option<String>,
    slug: Option<String>,
    image: Option<String>,
    end_date: Option<String>,
    #[serde(default)]
    volume24hr: f64,
    #[serde(default)]
    liquidity: f64,
    #[serde(default)]
    markets: Vec<RawMarket>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawMarket {
    condition_id: Option<String>,
    question: Option<String>,
    outcome_prices: Option<String>,
    #[allow(dead_code)]
    outcomes: Option<String>,
    #[allow(dead_code)]
    slug: Option<String>,
    end_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessedMarket {
    pub id: String,
    pub question: String,
    pub yes_price: f64,
    pub no_price: f64,
    pub volume_24h: f64,
    pub liquidity: f64,
    pub slug: String,
    pub image: String,
    pub end_date: String,
    pub category: String,
}

fn infer_category(question: &str) -> &'static str {
    let q = question.to_lowercase();

    if q.contains("bitcoin") || q.contains("btc") || q.contains("ethereum") || q.contains("eth ")
       || q.contains("crypto") || q.contains("solana") || q.contains("token") || q.contains("defi")
       || q.contains("stablecoin") || q.contains("altcoin")
    {
        return "crypto";
    }

    if q.contains("president") || q.contains("election") || q.contains("congress") || q.contains("senate")
       || q.contains("republican") || q.contains("democrat") || q.contains("trump") || q.contains("biden")
       || q.contains("governor") || q.contains("vote") || q.contains("political") || q.contains("parliament")
       || q.contains("minister") || q.contains("legislation") || q.contains("impeach")
    {
        return "politics";
    }

    if q.contains("fed ") || q.contains("federal reserve") || q.contains("interest rate") || q.contains("inflation")
       || q.contains("gdp") || q.contains("recession") || q.contains("unemployment") || q.contains("stock market")
       || q.contains("s&p") || q.contains("nasdaq") || q.contains("treasury") || q.contains("tariff")
       || q.contains("trade war") || q.contains("debt ceiling") || q.contains("cpi")
    {
        return "economics";
    }

    if q.contains("nba") || q.contains("nfl") || q.contains("mlb") || q.contains("nhl")
       || q.contains("soccer") || q.contains("football") || q.contains("basketball")
       || q.contains("super bowl") || q.contains("world cup") || q.contains("champion")
       || q.contains("playoff") || q.contains("f1") || q.contains("ufc")
       || q.contains("tennis") || q.contains("golf") || q.contains("olympics")
       || q.contains("series") || q.contains("finals") || q.contains("stanley cup")
       || q.contains("oilers") || q.contains("lakers") || q.contains("yankees")
    {
        return "sports";
    }

    if q.contains("war") || q.contains("iran") || q.contains("israel") || q.contains("ukraine")
       || q.contains("russia") || q.contains("china") || q.contains("military") || q.contains("regime")
       || q.contains("ceasefire") || q.contains("sanctions") || q.contains("nato")
       || q.contains("nuclear") || q.contains("invasion")
    {
        return "geopolitics";
    }

    if q.contains("elon") || q.contains("musk") || q.contains("twitter") || q.contains("ai ")
       || q.contains("apple") || q.contains("google") || q.contains("meta ") || q.contains("openai")
       || q.contains("tiktok") || q.contains("spacex") || q.contains("chatgpt")
    {
        return "tech";
    }

    "other"
}

fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("FinancePulse/1.0")
        .timeout(Duration::from_secs(15))
        .build()
        .expect("Failed to create HTTP client")
}

pub async fn start(redis: fred::prelude::Client) {
    let http = build_http_client();

    tracing::info!("Polymarket: performing initial fetch");
    if let Err(e) = fetch_and_cache(&http, &redis).await {
        tracing::error!("Polymarket initial fetch failed: {e}");
    }

    let mut interval = tokio::time::interval(POLL_INTERVAL);
    interval.tick().await;

    loop {
        interval.tick().await;
        if let Err(e) = fetch_and_cache(&http, &redis).await {
            tracing::warn!("Polymarket poll failed: {e}");
        }
    }
}

async fn fetch_and_cache(
    http: &reqwest::Client,
    redis: &fred::prelude::Client,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    use fred::interfaces::KeysInterface;

    let resp = http
        .get(API_URL)
        .query(&[
            ("closed", "false"),
            ("order", "volume24hr"),
            ("ascending", "false"),
            ("limit", "50"),
        ])
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Polymarket returned {status}: {body}").into());
    }

    let raw_events: Vec<RawEvent> = resp.json().await?;
    tracing::debug!("Polymarket fetched {} events", raw_events.len());

    let processed: Vec<ProcessedMarket> = raw_events
        .into_iter()
        .filter_map(|event| {
            let slug = event.slug.filter(|s| !s.is_empty())?;
            let title = event.title.filter(|t| !t.is_empty())?;

            // Use the first market's prices; fall back to 50/50
            let (yes_price, no_price, condition_id, market_end_date) =
                if let Some(primary) = event.markets.first() {
                    let (y, n) = primary
                        .outcome_prices
                        .as_deref()
                        .map(parse_outcome_prices)
                        .unwrap_or((0.5, 0.5));
                    let cid = primary.condition_id.clone().unwrap_or_default();
                    let med = primary.end_date.clone();
                    (y, n, cid, med)
                } else {
                    (0.5, 0.5, String::new(), None)
                };

            // Use the primary market's question if available, otherwise event title
            let question = event
                .markets
                .first()
                .and_then(|m| m.question.clone())
                .unwrap_or_else(|| title.clone());

            let end_date = event
                .end_date
                .or(market_end_date)
                .unwrap_or_default();

            Some(ProcessedMarket {
                category: infer_category(&question).to_string(),
                id: condition_id,
                question,
                yes_price,
                no_price,
                volume_24h: event.volume24hr,
                liquidity: event.liquidity,
                slug,
                image: event.image.unwrap_or_default(),
                end_date,
            })
        })
        .collect();

    let json = serde_json::to_string(&processed)?;
    redis
        .set::<(), _, _>(
            "polymarket:trending",
            json.as_str(),
            Some(Expiration::EX(CACHE_TTL_SECS)),
            None,
            false,
        )
        .await?;

    tracing::info!("Polymarket: cached {} events", processed.len());
    Ok(())
}

fn parse_outcome_prices(prices_str: &str) -> (f64, f64) {
    if let Ok(parsed) = serde_json::from_str::<Vec<String>>(prices_str) {
        let yes = parsed.first().and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.5);
        let no = parsed.get(1).and_then(|s| s.parse::<f64>().ok()).unwrap_or(1.0 - yes);
        (yes, no)
    } else {
        (0.5, 0.5)
    }
}

pub async fn get_cached_trending(
    redis: &fred::prelude::Client,
) -> Result<Vec<ProcessedMarket>, Box<dyn std::error::Error + Send + Sync>> {
    use fred::interfaces::KeysInterface;

    let cached: Option<String> = redis.get("polymarket:trending").await?;
    match cached {
        Some(json) => Ok(serde_json::from_str(&json)?),
        None => Ok(vec![]),
    }
}
