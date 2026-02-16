import type { Company, Currency, BillingType, Project, TimeEntry, Invoice, InvoiceStatus } from '../types';
import type { BusinessProfile } from '../utils/storage';

// Map app data to Google Sheets rows (header + data rows)

export function companiesToRows(companies: Company[]): string[][] {
  const header = ['ID', 'Name', 'Currency', 'Hourly Rate', 'Invoice Required', 'Payment Terms', 'Payment Method', 'Contact Name', 'Contact Email', 'Notes', 'Active', 'Created', 'Updated', 'Billing Type', 'Monthly Rate', 'Next Invoice Number'];
  const rows = companies.map((c) => [
    c.id, c.name, c.currency, String(c.hourlyRate),
    c.invoiceRequired ? 'Yes' : 'No',
    c.paymentTerms || '', c.paymentMethod || '',
    c.contactName || '', c.contactEmail || '',
    c.notes || '', c.isActive ? 'Yes' : 'No',
    c.createdAt, c.updatedAt,
    c.billingType || 'hourly',
    c.monthlyRate != null ? String(c.monthlyRate) : '',
    c.nextInvoiceNumber != null ? String(c.nextInvoiceNumber) : '',
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
  const header = ['ID', 'Company ID', 'Invoice #', 'Date', 'Time Entry IDs', 'Total Hours', 'Total Amount', 'Currency', 'Rate Used', 'Status', 'Paid Date', 'Notes', 'Created', 'Updated', 'Billing Type', 'Retainer Month', 'Exchange Rate to USD'];
  const rows = invoices.map((i) => [
    i.id, i.companyId, i.invoiceNumber || '', i.invoiceDate,
    i.timeEntryIds.join(';'),
    String(i.totalHours), String(i.totalAmount),
    i.currency, String(i.rateUsed),
    i.status, i.paidDate || '',
    i.notes || '', i.createdAt, i.updatedAt,
    i.billingType || 'hourly',
    i.retainerMonth || '',
    i.exchangeRateToUSD != null ? String(i.exchangeRateToUSD) : '',
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
    ['Routing Number', profile.routingNumber || ''],
    ['SWIFT Code', profile.swiftCode || ''],
    ['Account Number', profile.accountNumber || ''],
  ];
}

// Reverse mappers: Google Sheets rows → app data

export function rowsToCompanies(rows: string[][]): Company[] {
  if (rows.length <= 1) return []; // header only or empty
  const header = rows[0];
  const hasBillingType = header.includes('Billing Type');
  const hasNextInvoice = header.includes('Next Invoice Number');
  return rows.slice(1).map((r) => ({
    id: r[0],
    name: r[1],
    currency: (r[2] as Currency) || 'USD',
    billingType: (hasBillingType && r[13] ? r[13] as BillingType : 'hourly'),
    hourlyRate: parseFloat(r[3]) || 0,
    monthlyRate: hasBillingType && r[14] ? parseFloat(r[14]) : undefined,
    nextInvoiceNumber: hasNextInvoice && r[15] ? parseInt(r[15], 10) : undefined,
    invoiceRequired: r[4] === 'Yes',
    paymentTerms: r[5] || undefined,
    paymentMethod: r[6] || undefined,
    contactName: r[7] || undefined,
    contactEmail: r[8] || undefined,
    notes: r[9] || undefined,
    isActive: r[10] !== 'No',
    createdAt: r[11],
    updatedAt: r[12],
  }));
}

export function rowsToProjects(rows: string[][]): Project[] {
  if (rows.length <= 1) return [];
  return rows.slice(1).map((r) => ({
    id: r[0],
    companyId: r[1],
    name: r[2],
    isActive: r[3] !== 'No',
    createdAt: r[4],
    updatedAt: r[5],
  }));
}

export function rowsToTimeEntries(rows: string[][]): TimeEntry[] {
  if (rows.length <= 1) return [];
  return rows.slice(1).map((r) => ({
    id: r[0],
    companyId: r[1],
    projectId: r[2] || undefined,
    date: r[3],
    hours: parseFloat(r[4]) || 0,
    fixedAmount: r[5] ? parseFloat(r[5]) : undefined,
    description: r[6],
    paidDate: r[7] || undefined,
    createdAt: r[8],
    updatedAt: r[9],
  }));
}

export function rowsToInvoices(rows: string[][]): Invoice[] {
  if (rows.length <= 1) return [];
  const header = rows[0];
  const hasBillingType = header.includes('Billing Type');
  const hasExchangeRate = header.includes('Exchange Rate to USD');
  return rows.slice(1).map((r) => ({
    id: r[0],
    companyId: r[1],
    invoiceNumber: r[2] || undefined,
    invoiceDate: r[3],
    timeEntryIds: r[4] ? r[4].split(';') : [],
    totalHours: parseFloat(r[5]) || 0,
    totalAmount: parseFloat(r[6]) || 0,
    currency: (r[7] as Currency) || 'USD',
    rateUsed: parseFloat(r[8]) || 0,
    status: (r[9] as InvoiceStatus) || 'draft',
    paidDate: r[10] || undefined,
    notes: r[11] || undefined,
    billingType: (hasBillingType && r[14] ? r[14] as BillingType : 'hourly'),
    retainerMonth: hasBillingType && r[15] ? r[15] : undefined,
    exchangeRateToUSD: hasExchangeRate && r[16] ? parseFloat(r[16]) : undefined,
    createdAt: r[12],
    updatedAt: r[13],
  }));
}

export function rowsToProfile(rows: string[][]): BusinessProfile {
  const map = new Map<string, string>();
  for (const row of rows.slice(1)) {
    if (row[0]) map.set(row[0], row[1] || '');
  }
  return {
    name: map.get('Name') || '',
    address: map.get('Address') || '',
    email: map.get('Email') || '',
    phone: map.get('Phone') || '',
    ein: map.get('EIN') || '',
    routingNumber: map.get('Routing Number') || undefined,
    swiftCode: map.get('SWIFT Code') || undefined,
    accountNumber: map.get('Account Number') || undefined,
  };
}
