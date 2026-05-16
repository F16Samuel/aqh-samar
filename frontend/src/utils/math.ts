/**
 * Statistical utility functions for the AQH-SAMAR analytics engine.
 */

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mode(values: number[]): number {
  if (!values.length) return 0;
  const freq: Record<number, number> = {};
  values.forEach((v) => { freq[v] = (freq[v] || 0) + 1; });
  let maxCount = 0;
  let modeVal = values[0];
  for (const [val, count] of Object.entries(freq)) {
    if (count > maxCount) { maxCount = count; modeVal = Number(val); }
  }
  return modeVal;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(mean(squareDiffs));
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

/** Leniency bias: positive means manager scores are HIGHER than employee actuals */
export function biasIndex(managerScores: number[], employeeScores: number[]): number {
  if (!managerScores.length || !employeeScores.length) return 0;
  return mean(managerScores) - mean(employeeScores);
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}
