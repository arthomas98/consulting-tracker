import type { Currency } from '../types';

const CACHE_KEY = 'ct_exchangeRates';
const STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  rate: number;
  fetchedAt: number;
}

type RateCache = Record<string, CacheEntry>;

function readCache(): RateCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: RateCache): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export async function getExchangeRate(from: Currency, date?: string): Promise<number | null> {
  if (from === 'USD') return 1.0;

  const cacheKey = `${from}-${date || 'latest'}`;
  const cache = readCache();
  const entry = cache[cacheKey];

  if (entry && (Date.now() - entry.fetchedAt) < STALE_MS) {
    return entry.rate;
  }

  try {
    const endpoint = date
      ? `https://api.frankfurter.dev/v1/${date}?from=${from}&to=USD`
      : `https://api.frankfurter.dev/v1/latest?from=${from}&to=USD`;
    const res = await fetch(endpoint);
    if (!res.ok) return entry?.rate ?? null;
    const data = await res.json();
    const rate = data.rates?.USD;
    if (typeof rate !== 'number') return entry?.rate ?? null;

    cache[cacheKey] = { rate, fetchedAt: Date.now() };
    writeCache(cache);
    return rate;
  } catch {
    return entry?.rate ?? null;
  }
}

export function convertToUSD(amount: number, _currency: Currency, rate: number | null): number | null {
  if (rate == null) return null;
  return amount * rate;
}

export async function preloadRates(): Promise<Record<Currency, number | null>> {
  const [eurRate, gbpRate] = await Promise.all([
    getExchangeRate('EUR'),
    getExchangeRate('GBP'),
  ]);
  return { USD: 1, EUR: eurRate, GBP: gbpRate };
}
