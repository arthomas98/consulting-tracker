import type { TimeEntry, Invoice, Company, Currency } from '../types';

export function roundToQuarter(hours: number): number {
  return Math.round(hours * 4) / 4;
}

export function parseHoursInput(input: string): number | null {
  const trimmed = input.trim();
  // HH:MM format
  const timeMatch = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    if (m >= 60) return null;
    return roundToQuarter(h + m / 60);
  }
  // Decimal format
  const num = parseFloat(trimmed);
  if (isNaN(num) || num < 0) return null;
  return roundToQuarter(num);
}

export function entryAmount(entry: TimeEntry, rate: number): number {
  return entry.fixedAmount != null ? entry.fixedAmount : entry.hours * rate;
}

export function totalHours(entries: TimeEntry[]): number {
  return entries.reduce((sum, e) => sum + e.hours, 0);
}

export function totalAmount(entries: TimeEntry[], rate: number): number {
  return entries.reduce((sum, e) => sum + entryAmount(e, rate), 0);
}

export interface CurrencyTotal {
  currency: Currency;
  hours: number;
  amount: number;
}

export function totalsByCurrency(
  entries: TimeEntry[],
  companies: Company[]
): CurrencyTotal[] {
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const totals = new Map<Currency, { hours: number; amount: number }>();

  for (const entry of entries) {
    const company = companyMap.get(entry.companyId);
    if (!company) continue;
    const cur = company.currency;
    const existing = totals.get(cur) || { hours: 0, amount: 0 };
    existing.hours += entry.hours;
    existing.amount += entryAmount(entry, company.hourlyRate);
    totals.set(cur, existing);
  }

  return Array.from(totals.entries()).map(([currency, t]) => ({
    currency,
    hours: t.hours,
    amount: t.amount,
  }));
}

export function generateInvoiceNumber(invoices: Invoice[], year: number): string {
  const yearPrefix = String(year);
  const yearInvoices = invoices.filter(
    (i) => i.invoiceNumber?.startsWith(yearPrefix + '-')
  );
  const maxNum = yearInvoices.reduce((max, i) => {
    const num = parseInt(i.invoiceNumber!.split('-')[1], 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `${yearPrefix}-${String(maxNum + 1).padStart(3, '0')}`;
}

export function getEntryPaymentStatus(
  entry: TimeEntry,
  company: Company | undefined,
  invoices: Invoice[]
): string {
  if (!company) return 'Unknown';

  const invoice = invoices.find((i) => i.timeEntryIds.includes(entry.id));

  if (invoice) {
    switch (invoice.status) {
      case 'paid': return 'Paid';
      case 'sent': return 'Invoiced / Awaiting payment';
      case 'draft': return 'Draft';
    }
  }

  if (entry.paidDate) return 'Paid';
  if (!company.invoiceRequired) return 'Unpaid';
  return 'Uninvoiced';
}
