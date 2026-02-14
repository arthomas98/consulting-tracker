import type { Currency } from '../types';

const formatters: Record<Currency, Intl.NumberFormat> = {
  USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  EUR: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }),
};

export function formatCurrency(amount: number, currency: Currency): string {
  return formatters[currency].format(amount);
}

export function formatCurrencyShort(amount: number, currency: Currency): string {
  if (amount >= 1000) {
    return `${currency === 'EUR' ? '\u20AC' : '$'}${(amount / 1000).toFixed(1)}k`;
  }
  return `${currency === 'EUR' ? '\u20AC' : '$'}${Math.round(amount)}`;
}

export function formatHours(hours: number): string {
  return hours.toFixed(2);
}
