use super::*;

fn approx_eq(a: f64, b: f64, eps: f64) -> bool {
    (a - b).abs() < eps
}

fn assert_approx(actual: Option<f64>, expected: Option<f64>, eps: f64, label: &str) {
    match (actual, expected) {
        (Some(a), Some(e)) => {
            assert!(
                approx_eq(a, e, eps),
                "{label}: expected ~{e}, got {a} (diff={})",
                (a - e).abs()
            );
        }
        (None, None) => {}
        _ => panic!("{label}: expected {expected:?}, got {actual:?}"),
    }
}

#[test]
fn sma_known_values() {
    let prices = [1.0, 2.0, 3.0, 4.0, 5.0];
    let result = sma(&prices, 3);
    assert_eq!(result.len(), 5);
    assert_approx(result[0], None, 1e-10, "sma[0]");
    assert_approx(result[1], None, 1e-10, "sma[1]");
    assert_approx(result[2], Some(2.0), 1e-10, "sma[2]");
    assert_approx(result[3], Some(3.0), 1e-10, "sma[3]");
    assert_approx(result[4], Some(4.0), 1e-10, "sma[4]");
}

#[test]
fn sma_period_1() {
    let prices = [10.0, 20.0, 30.0];
    let result = sma(&prices, 1);
    assert_approx(result[0], Some(10.0), 1e-10, "sma_p1[0]");
    assert_approx(result[1], Some(20.0), 1e-10, "sma_p1[1]");
    assert_approx(result[2], Some(30.0), 1e-10, "sma_p1[2]");
}

#[test]
fn sma_empty_input() {
    let result = sma(&[], 5);
    assert!(result.is_empty());
}

#[test]
fn sma_period_exceeds_data() {
    let prices = [1.0, 2.0];
    let result = sma(&prices, 5);
    assert_eq!(result, vec![None, None]);
}

#[test]
fn ema_converges_toward_recent() {
    let prices = [10.0, 10.0, 10.0, 10.0, 10.0, 20.0, 20.0, 20.0, 20.0, 20.0];
    let result = ema(&prices, 5);

    assert_approx(result[4], Some(10.0), 1e-10, "ema[4]");

    let v5 = result[5].unwrap();
    let v9 = result[9].unwrap();
    assert!(v5 > 10.0 && v5 < 20.0, "ema[5] should be between 10 and 20, got {v5}");
    assert!(v9 > v5, "ema should increase toward 20");
    assert!(v9 > 15.0, "ema[9] should be close to 20, got {v9}");
}

#[test]
fn ema_empty_input() {
    let result = ema(&[], 5);
    assert!(result.is_empty());
}

#[test]
fn ema_period_exceeds_data() {
    let prices = [1.0, 2.0];
    let result = ema(&prices, 5);
    assert_eq!(result, vec![None, None]);
}

#[test]
fn ema_first_value_equals_sma() {
    let prices = [2.0, 4.0, 6.0, 8.0, 10.0];
    let result = ema(&prices, 5);
    assert_approx(result[4], Some(6.0), 1e-10, "ema first value");
}

#[test]
fn rsi_flat_prices_near_50() {
    let prices = [100.0, 100.1, 99.9, 100.05, 99.95, 100.02, 99.98, 100.0,
                  100.01, 99.99, 100.03, 99.97, 100.04, 99.96, 100.0, 100.01];
    let result = rsi(&prices, 14);

    for val in result.iter().flatten() {
        assert!(
            *val > 20.0 && *val < 80.0,
            "RSI for flat prices should be near 50, got {val}"
        );
    }
}

#[test]
fn rsi_consistent_gains_above_70() {
    let mut prices = vec![100.0];
    for i in 1..30 {
        prices.push(100.0 + i as f64 * 2.0);
    }
    let result = rsi(&prices, 14);

    let last = result.last().unwrap().unwrap();
    assert!(last > 70.0, "RSI for consistent gains should be >70, got {last}");
}

#[test]
fn rsi_consistent_losses_below_30() {
    let mut prices = vec![200.0];
    for i in 1..30 {
        prices.push(200.0 - i as f64 * 2.0);
    }
    let result = rsi(&prices, 14);

    let last = result.last().unwrap().unwrap();
    assert!(last < 30.0, "RSI for consistent losses should be <30, got {last}");
}

#[test]
fn rsi_range_0_to_100() {
    let prices: Vec<f64> = (0..100).map(|i| 50.0 + (i as f64 * 0.7).sin() * 20.0).collect();
    let result = rsi(&prices, 14);
    for val in result.iter().flatten() {
        assert!(*val >= 0.0 && *val <= 100.0, "RSI out of range: {val}");
    }
}

#[test]
fn rsi_empty_input() {
    let result = rsi(&[], 14);
    assert!(result.is_empty());
}

#[test]
fn rsi_insufficient_data() {
    let prices = [1.0, 2.0, 3.0];
    let result = rsi(&prices, 14);
    assert!(result.iter().all(|v| v.is_none()));
}

#[test]
fn macd_output_lengths() {
    let prices: Vec<f64> = (0..50).map(|i| 100.0 + (i as f64 * 0.5).sin() * 10.0).collect();
    let result = macd(&prices, 12, 26, 9);
    assert_eq!(result.macd_line.len(), 50);
    assert_eq!(result.signal_line.len(), 50);
    assert_eq!(result.histogram.len(), 50);
}

#[test]
fn macd_histogram_sign_reflects_crossover() {
    let mut prices: Vec<f64> = vec![50.0; 26];
    for i in 0..30 {
        prices.push(50.0 + i as f64 * 1.5);
    }
    let result = macd(&prices, 12, 26, 9);

    let positive_macd = result.macd_line.iter().flatten().any(|v| *v > 0.0);
    assert!(positive_macd, "Rising prices should produce positive MACD values");
}

#[test]
fn macd_empty_input() {
    let result = macd(&[], 12, 26, 9);
    assert!(result.macd_line.is_empty());
}

#[test]
fn bollinger_middle_equals_sma() {
    let prices: Vec<f64> = (1..=30).map(|i| i as f64).collect();
    let result = bollinger_bands(&prices, 20, 2.0);
    let sma_result = sma(&prices, 20);

    for i in 0..prices.len() {
        assert_approx(result.middle[i], sma_result[i], 1e-10, &format!("bb middle[{i}]"));
    }
}

#[test]
fn bollinger_upper_greater_than_lower() {
    let prices: Vec<f64> = (0..30).map(|i| 100.0 + (i as f64 * 0.3).sin() * 5.0).collect();
    let result = bollinger_bands(&prices, 20, 2.0);

    for i in 0..prices.len() {
        if let (Some(u), Some(m), Some(l)) = (result.upper[i], result.middle[i], result.lower[i]) {
            assert!(u > m, "upper[{i}]={u} should be > middle={m}");
            assert!(m > l, "middle[{i}]={m} should be > lower={l}");
        }
    }
}

#[test]
fn bollinger_constant_prices_bands_equal_mean() {
    let prices = vec![42.0; 25];
    let result = bollinger_bands(&prices, 20, 2.0);

    for i in 19..25 {
        assert_approx(result.upper[i], Some(42.0), 1e-10, &format!("bb const upper[{i}]"));
        assert_approx(result.middle[i], Some(42.0), 1e-10, &format!("bb const mid[{i}]"));
        assert_approx(result.lower[i], Some(42.0), 1e-10, &format!("bb const lower[{i}]"));
    }
}

#[test]
fn bollinger_empty_input() {
    let result = bollinger_bands(&[], 20, 2.0);
    assert!(result.upper.is_empty());
    assert!(result.middle.is_empty());
    assert!(result.lower.is_empty());
}

#[test]
fn bollinger_period_exceeds_data() {
    let prices = [1.0, 2.0, 3.0];
    let result = bollinger_bands(&prices, 20, 2.0);
    assert!(result.upper.iter().all(|v| v.is_none()));
    assert!(result.middle.iter().all(|v| v.is_none()));
    assert!(result.lower.iter().all(|v| v.is_none()));
}
