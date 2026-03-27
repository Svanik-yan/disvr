import {
  getRepeatSearchSignals,
  getSatisfiedSearchSignals,
  getLowConfidenceSignals,
  upsertServiceSignal,
  aggregateDailyStats,
} from "./db.js";

// ─── Signal Aggregation (called by Cron) ───
// Analyzes request_logs to detect passive user behavior signals:
//   repeat_search → reliability penalty (users searching same thing = first results didn't help)
//   satisfied     → quality/reliability bonus (search once, no follow-up = happy user)
//   low_confidence → global multiplier (recommended often but never reported on = uncertain)

export async function runSignalAggregation(db: D1Database): Promise<{
  repeat: number;
  satisfied: number;
  low_confidence: number;
  daily_stats: number;
}> {
  // 1. Repeat search signals → penalty per service
  const repeatSignals = await getRepeatSearchSignals(db);
  let repeatCount = 0;
  for (const { service_ids, repeat_count } of repeatSignals) {
    const ids = parseServiceIds(service_ids);
    // Penalty: -0.05 per repeat occurrence, capped at -0.3
    const penalty = Math.max(-0.3, -0.05 * repeat_count);
    for (const sid of ids) {
      await upsertServiceSignal(db, {
        service_id: sid,
        signal_type: "repeat_search",
        signal_value: penalty,
        sample_count: repeat_count,
      });
      repeatCount++;
    }
  }

  // 2. Satisfied search signals → bonus per service
  const satisfiedSignals = await getSatisfiedSearchSignals(db);
  let satisfiedCount = 0;
  for (const { service_ids, satisfied_count } of satisfiedSignals) {
    const ids = parseServiceIds(service_ids);
    // Bonus: +0.02 per satisfied search, capped at +0.2
    const bonus = Math.min(0.2, 0.02 * satisfied_count);
    for (const sid of ids) {
      await upsertServiceSignal(db, {
        service_id: sid,
        signal_type: "satisfied",
        signal_value: bonus,
        sample_count: satisfied_count,
      });
      satisfiedCount++;
    }
  }

  // 3. Low confidence signals → multiplier per service
  const lowConfSignals = await getLowConfidenceSignals(db);
  let lowConfCount = 0;
  for (const { service_id, recommend_count } of lowConfSignals) {
    // Multiplier: 0.7 for services recommended 50+ times with 0 reports,
    // scales linearly from 1.0 (10 recs) to 0.7 (50+ recs)
    const multiplier = Math.max(0.7, 1.0 - (recommend_count - 10) * 0.3 / 40);
    await upsertServiceSignal(db, {
      service_id,
      signal_type: "low_confidence",
      signal_value: multiplier,
      sample_count: recommend_count,
    });
    lowConfCount++;
  }

  // 4. Aggregate daily stats
  const statsResult = await aggregateDailyStats(db);

  return {
    repeat: repeatCount,
    satisfied: satisfiedCount,
    low_confidence: lowConfCount,
    daily_stats: statsResult,
  };
}

function parseServiceIds(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
