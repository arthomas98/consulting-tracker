import type { Company, Project, TimeEntry, Invoice } from '../types';
import type { BusinessProfile } from '../utils/storage';

// Map app data to Google Sheets rows (header + data rows)

export function companiesToRows(companies: Company[]): string[][] {
  const header = ['ID', 'Name', 'Currency', 'Hourly Rate', 'Invoice Required', 'Payment Terms', 'Payment Method', 'Contact Name', 'Contact Email', 'Notes', 'Active', 'Created', 'Updated'];
  const rows = companies.map((c) => [
    c.id, c.name, c.currency, String(c.hourlyRate),
    c.invoiceRequired ? 'Yes' : 'No',
    c.paymentTerms || '', c.paymentMethod || '',
    c.contactName || '', c.contactEmail || '',
    c.notes || '', c.isActive ? 'Yes' : 'No',
    c.createdAt, c.updatedAt,
  ]);
  return [header, ...rows];
}

export function projectsToRows(projects: Project[]): string[][] {
  const header = ['ID', 'Company ID', 'Name', 'Active', 'Created', 'Updated'];
  const rows = projects.map((p) => [
    p.id, p.companyId, p.name,
    p.isActive ? 'Yes' : 'No',
    p.createdAt, p.updatedAt,
  ]);
  return [header, ...rows];
}

export function timeEntriesToRows(entries: TimeEntry[]): string[][] {
  const header = ['ID', 'Company ID', 'Project ID', 'Date', 'Hours', 'Fixed Amount', 'Description', 'Paid Date', 'Created', 'Updated'];
  const rows = entries.map((e) => [
    e.id, e.companyId, e.projectId || '', e.date,
    String(e.hours),
    e.fixedAmount != null ? String(e.fixedAmount) : '',
    e.description, e.paidDate || '',
    e.createdAt, e.updatedAt,
  ]);
  return [header, ...rows];
}

export function invoicesToRows(invoices: Invoice[]): string[][] {
  const header = ['ID', 'Company ID', 'Invoice #', 'Date', 'Time Entry IDs', 'Total Hours', 'Total Amount', 'Currency', 'Rate Used', 'Status', 'Paid Date', 'Notes', 'Created', 'Updated'];
  const rows = invoices.map((i) => [
    i.id, i.companyId, i.invoiceNumber || '', i.invoiceDate,
    i.timeEntryIds.join(';'),
    String(i.totalHours), String(i.totalAmount),
    i.currency, String(i.rateUsed),
    i.status, i.paidDate || '',
    i.notes || '', i.createdAt, i.updatedAt,
  ]);
  return [header, ...rows];
}

export function profileToRows(profile: BusinessProfile): string[][] {
  const header = ['Field', 'Value'];
  return [
    header,
    ['Name', profile.name],
    ['Address', profile.address],
    ['Email', profile.email],
    ['Phone', profile.phone],
    ['EIN', profile.ein],
  ];
}
