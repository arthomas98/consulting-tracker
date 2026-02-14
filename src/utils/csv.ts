import type { TimeEntry, Invoice, Company, Project } from '../types';
import { getEntryPaymentStatus, entryAmount } from './calculations';
import { formatDate } from './dateUtils';

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function toCsvRow(cells: string[]): string {
  return cells.map(escapeCsv).join(',');
}

export function exportTimeEntriesCsv(
  entries: TimeEntry[],
  companies: Company[],
  invoices: Invoice[],
  projects: Project[]
): string {
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const header = ['Date', 'Company', 'Project', 'Hours', 'Rate', 'Currency', 'Amount', 'Description', 'Invoice #', 'Invoice Status', 'Paid Date'];
  const rows = entries
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const company = companyMap.get(e.companyId);
      const project = e.projectId ? projectMap.get(e.projectId) : undefined;
      const invoice = invoices.find((i) => i.timeEntryIds.includes(e.id));
      const rate = company?.hourlyRate ?? 0;
      const currency = company?.currency ?? 'USD';
      const status = getEntryPaymentStatus(e, company, invoices);
      const paidDate = invoice?.status === 'paid' ? invoice.paidDate ?? '' : e.paidDate ?? '';
      return toCsvRow([
        formatDate(e.date),
        company?.name ?? '',
        project?.name ?? '',
        String(e.hours),
        String(rate),
        currency,
        String(entryAmount(e, rate)),
        e.description,
        invoice?.invoiceNumber ?? '',
        status,
        paidDate ? formatDate(paidDate) : '',
      ]);
    });
  return [toCsvRow(header), ...rows].join('\n');
}

export function exportInvoicesCsv(
  invoices: Invoice[],
  companies: Company[]
): string {
  const companyMap = new Map(companies.map((c) => [c.id, c]));
  const header = ['Invoice #', 'Company', 'Date', 'Hours', 'Amount', 'Currency', 'Status', 'Paid Date'];
  const rows = invoices
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate))
    .map((i) => {
      const company = companyMap.get(i.companyId);
      return toCsvRow([
        i.invoiceNumber ?? '',
        company?.name ?? '',
        formatDate(i.invoiceDate),
        String(i.totalHours),
        String(i.totalAmount),
        i.currency,
        i.status,
        i.paidDate ? formatDate(i.paidDate) : '',
      ]);
    });
  return [toCsvRow(header), ...rows].join('\n');
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
