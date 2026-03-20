#[cfg(test)]
mod tests;

pub fn sma(prices: &[f64], period: usize) -> Vec<Option<f64>> {
    if period == 0 || prices.is_empty() {
        return vec![None; prices.len()];
    }

    let mut result = Vec::with_capacity(prices.len());

    let mut window_sum = 0.0;

    for (i, &price) in prices.iter().enumerate() {
        window_sum += price;
        if i >= period {
            window_sum -= prices[i - period];
        }
        if i + 1 >= period {
            result.push(Some(window_sum / period as f64));
        } else {
            result.push(None);
        }
    }

    result
}

pub fn ema(prices: &[f64], period: usize) -> Vec<Option<f64>> {
    if period == 0 || prices.is_empty() || period > prices.len() {
        return vec![None; prices.len()];
    }

    let multiplier = 2.0 / (period as f64 + 1.0);
    let mut result = Vec::with_capacity(prices.len());

    let initial_sma: f64 = prices[..period].iter().sum::<f64>() / period as f64;

    for i in 0..prices.len() {
        if i + 1 < period {
            result.push(None);
        } else if i + 1 == period {
            result.push(Some(initial_sma));
        } else {
            let prev = result[i - 1].unwrap();
            let val = (prices[i] - prev) * multiplier + prev;
            result.push(Some(val));
        }
    }

    result
}

pub fn rsi(prices: &[f64], period: usize) -> Vec<Option<f64>> {
    if period == 0 || prices.len() < period + 1 {
        return vec![None; prices.len()];
    }

    let mut result = Vec::with_capacity(prices.len());
    result.push(None);

    let mut gains = Vec::with_capacity(prices.len() - 1);
    let mut losses = Vec::with_capacity(prices.len() - 1);
    for i in 1..prices.len() {
        let delta = prices[i] - prices[i - 1];
        gains.push(if delta > 0.0 { delta } else { 0.0 });
        losses.push(if delta < 0.0 { -delta } else { 0.0 });
    }

    let mut avg_gain: f64 = gains[..period].iter().sum::<f64>() / period as f64;
    let mut avg_loss: f64 = losses[..period].iter().sum::<f64>() / period as f64;

    for _ in 0..period - 1 {
        result.push(None);
    }

    let rs = if avg_loss == 0.0 {
        f64::INFINITY
    } else {
        avg_gain / avg_loss
    };
    result.push(Some(100.0 - 100.0 / (1.0 + rs)));

    for i in period..gains.len() {
        avg_gain = (avg_gain * (period as f64 - 1.0) + gains[i]) / period as f64;
        avg_loss = (avg_loss * (period as f64 - 1.0) + losses[i]) / period as f64;

        let rs = if avg_loss == 0.0 {
            f64::INFINITY
        } else {
            avg_gain / avg_loss
        };
        result.push(Some(100.0 - 100.0 / (1.0 + rs)));
    }

    result
}

#[derive(Debug, Clone)]
pub struct MacdResult {
    pub macd_line: Vec<Option<f64>>,
    pub signal_line: Vec<Option<f64>>,
    pub histogram: Vec<Option<f64>>,
}

pub fn macd(prices: &[f64], fast: usize, slow: usize, signal: usize) -> MacdResult {
    let n = prices.len();
    let ema_fast = ema(prices, fast);
    let ema_slow = ema(prices, slow);

    let macd_line: Vec<Option<f64>> = (0..n)
        .map(|i| match (ema_fast[i], ema_slow[i]) {
            (Some(f), Some(s)) => Some(f - s),
            _ => None,
        })
        .collect();

    let macd_values: Vec<f64> = macd_line.iter().filter_map(|v| *v).collect();
    let signal_ema = ema(&macd_values, signal);

    let mut signal_line = vec![None; n];
    let mut sig_idx = 0;
    for i in 0..n {
        if macd_line[i].is_some() {
            signal_line[i] = signal_ema[sig_idx];
            sig_idx += 1;
        }
    }

    let histogram: Vec<Option<f64>> = (0..n)
        .map(|i| match (macd_line[i], signal_line[i]) {
            (Some(m), Some(s)) => Some(m - s),
            _ => None,
        })
        .collect();

    MacdResult {
        macd_line,
        signal_line,
        histogram,
    }
}

#[derive(Debug, Clone)]
pub struct BollingerResult {
    pub upper: Vec<Option<f64>>,
    pub middle: Vec<Option<f64>>,
    pub lower: Vec<Option<f64>>,
}

pub fn bollinger_bands(prices: &[f64], period: usize, num_std_dev: f64) -> BollingerResult {
    let middle = sma(prices, period);
    let n = prices.len();

    let mut upper = vec![None; n];
    let mut lower = vec![None; n];

    for i in 0..n {
        if let Some(mean) = middle[i] {
            let start = i + 1 - period;
            let variance: f64 = prices[start..=i]
                .iter()
                .map(|&p| (p - mean).powi(2))
                .sum::<f64>()
                / period as f64;
            let std_dev = variance.sqrt();

            upper[i] = Some(mean + num_std_dev * std_dev);
            lower[i] = Some(mean - num_std_dev * std_dev);
        }
    }

    BollingerResult {
        upper,
        middle,
        lower,
    }
}
