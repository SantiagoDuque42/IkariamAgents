/**
 * Project one town from a dated reading. A single hypothetical delivery arrives after the preceding
 * consumption interval. Proposed quantities are measured before and after the arrival separately.
 */
export function wineScenario({ stock, net, horizon, delivery = 0, eta = 0, capacity }) {
  const initial = stock;
  const limit = capacity == null ? Infinity : capacity;
  const falls = net < 0;
  const arrives = delivery > 0 && eta <= horizon;
  const beforeTime = arrives ? eta : horizon;
  const before = Math.max(0, Math.min(limit, initial + net * beforeTime));
  const realDelivery = arrives ? Math.min(delivery, Math.max(0, limit - before)) : 0;
  const after = before + realDelivery;
  const ending = Math.max(0, Math.min(limit, after + (arrives ? net * (horizon - eta) : 0)));
  const firstEmpty = falls ? initial / -net : initial === 0 && net === 0 ? 0 : null;
  const exhaustedBefore = firstEmpty != null && firstEmpty <= beforeTime;
  const exhaustedAfter = arrives && falls && after / -net <= horizon - eta;
  const firstGap = exhaustedBefore ? firstEmpty : exhaustedAfter ? eta + after / -net : null;
  const toRefill = falls ? Math.max(0, Math.ceil(-net * horizon - initial - realDelivery)) : 0;
  const points = [];
  const firstPass = (time) => Math.max(0, Math.min(limit, initial + net * time));
  points.push({ hour: 0, stock: initial });
  if (firstEmpty != null && firstEmpty > 0 && firstEmpty < beforeTime) points.push({ hour: firstEmpty, stock: 0 });
  if (arrives) {
    if (eta > 0) points.push({ hour: eta, stock: before });
    points.push({ hour: eta, stock: after });
  }
  if (exhaustedAfter) points.push({ hour: eta + after / -net, stock: 0 });
  if (!arrives && net > 0 && limit < Infinity) {
    const full = (limit - initial) / net;
    if (full > 0 && full < horizon) points.push({ hour: full, stock: limit });
  }
  if (arrives && net > 0 && limit < Infinity) {
    const full = eta + (limit - after) / net;
    if (full > eta && full < horizon) points.push({ hour: full, stock: limit });
  }
  if (arrives && net > 0 && limit < Infinity) {
    const full = (limit - initial) / net;
    if (full > 0 && full < eta) points.splice(1, 0, { hour: full, stock: firstPass(full) });
  }
  if (points.at(-1).hour !== horizon) points.push({ hour: horizon, stock: ending });
  return { ending, firstGap, toRefill, arrives, exhaustedBeforeDelivery: arrives && exhaustedBefore, realDelivery, points };
}
