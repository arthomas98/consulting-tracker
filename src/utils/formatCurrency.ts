import type { Currency } from '../types';

const formatters: Record<Currency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  EUR: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }),
  GBP: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
};

export function formatCurrency(amount: number, currency: Currency): string {
  return formatters[currency].format(amount);
}

const currencySymbols: Record<Currency, string> = { USD: '$', EUR: '\u20AC', GBP: '\u00A3' };

export function formatCurrencyShort(amount: number, currency: Currency): string {
  const sym = currencySymbols[currency];
  if (amount >= 1000) {
    return `${sym}${(amount / 1000).toFixed(1)}k`;
  }
  return `${sym}${Math.round(amount)}`;
}

export function formatHours(hours: number): string {
  return hours.toFixed(2);
}
