// 指令

// 1. price: 价格，220
// 2. liquidity_depth: 流动性深度，1000
// 3. accuracy: 历史价格准确度，0.95
struct PriceUpdate {
  price: u64,
  liquidity_depth: u64,
  accuracy: f64,
}

pub fn verify_price_udpate(
  price_update: PriceUpdate,
  current_slot: u64,
) -> Result<()> {
  // 1. 时效性，比较当前 slot 和 price_update 的 slot，如果相差太大，则认为价格无效
  if current_slot - price_update.slot > 100 {
    return Err(error!(ErrorCode::InvalidPriceUpdate));
  }
  // 2. 置信区间
  // 最大允许变化率 20%
  const MAX_RATIO = 0.2;
  let max_allowed_change = price_update.price * MAX_RATIO;
  let min_allowed_change = price_update.price - max_allowed_change;
  let max_allowed_change = price_update.price + max_allowed_change;
  let min_allowed_change = price_update.price - max_allowed_change;
  if price_update.price < min_allowed_change || price_update.price > max_allowed_change {
    return Err(error!(ErrorCode::InvalidPriceUpdate));
  }
  // 3. 流动性深度
  if price_update.liquidity_depth < 1000 {
    return Err(error!(ErrorCode::InvalidPriceUpdate));
  }
}