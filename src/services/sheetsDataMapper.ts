import type { Company, Currency, BillingType, Project, TimeEntry, Invoice, InvoiceStatus, InvoiceDetailLevel, LineItem, Expense, ExpenseCategory } from '../types';
import type { BusinessProfile } from '../utils/storage';

// Map app data to Google Sheets rows (header + data rows).
//
// IMPORTANT: every field on the entity types must round-trip through these
// mappers. A field missing here is silently stripped whenever a record travels
// through the sheet (pull on another machine, or a conflict merge where the
// remote copy wins) — and the stripped copy then propagates everywhere via
// last-write-wins. When adding a field to a type, append a column at the END
// of the header (existing indices are load-bearing for old sheets) and guard
// the reverse mapper with header.includes().

export function companiesToRows(companies: Company[]): string[][] {
  const header = ['ID', 'Name', 'Currency', 'Hourly Rate', 'Invoice Required', 'Payment Terms', 'Payment Method', 'Contact Name', 'Contact Email', 'Notes', 'Active', 'Created', 'Updated', 'Billing Type', 'Monthly Rate', 'Next Invoice Number', 'Billing Address', 'VAT Reverse Charge', 'VAT Notice Text', 'Bank ID', 'Deleted At'];
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
    c.billingAddress || '',
    c.vatReverseCharge ? 'Yes' : '',
    c.vatNoticeText || '',
    c.bankId || '',
    c.deletedAt || '',
  ]);
  return [header, ...rows];
}

export function projectsToRows(projects: Project[]): string[][] {
  const header = ['ID', 'Company ID', 'Name', 'Active', 'Created', 'Updated', 'Deleted At'];
  const rows = projects.map((p) => [
    p.id, p.companyId, p.name,
    p.isActive ? 'Yes' : 'No',
    p.createdAt, p.updatedAt,
    p.deletedAt || '',
  ]);
  return [header, ...rows];
}

export function timeEntriesToRows(entries: TimeEntry[]): string[][] {
  const header = ['ID', 'Company ID', 'Project ID', 'Date', 'Hours', 'Fixed Amount', 'Description', 'Paid Date', 'Created', 'Updated', 'Payment Note', 'Deleted At'];
  const rows = entries.map((e) => [
    e.id, e.companyId, e.projectId || '', e.date,
    String(e.hours),
    e.fixedAmount != null ? String(e.fixedAmount) : '',
    e.description, e.paidDate || '',
    e.createdAt, e.updatedAt,
    e.paymentNote || '',
    e.deletedAt || '',
  ]);
  return [header, ...rows];
}

export function invoicesToRows(invoices: Invoice[]): string[][] {
  const header = ['ID', 'Company ID', 'Invoice #', 'Date', 'Time Entry IDs', 'Total Hours', 'Total Amount', 'Currency', 'Rate Used', 'Status', 'Paid Date', 'Notes', 'Created', 'Updated', 'Billing Type', 'Retainer Month', 'Exchange Rate to USD', 'Paid Amount (USD)', 'Payment Note', 'Line Items (JSON)', 'Detail Level', 'Bill To Name Override', 'Bill To Address Override', 'Bank ID Override', 'Deleted At'];
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
    i.paidAmountUSD != null ? String(i.paidAmountUSD) : '',
    i.paymentNote || '',
    i.lineItems && i.lineItems.length > 0 ? JSON.stringify(i.lineItems) : '',
    i.detailLevel || '',
    i.billToNameOverride || '',
    i.billToAddressOverride || '',
    i.bankIdOverride || '',
    i.deletedAt || '',
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
    ['Banks (JSON)', JSON.stringify(profile.banks ?? [])],
    ['Default Bank ID', profile.defaultBankId || ''],
  ];
}

// Reverse mappers: Google Sheets rows → app data

export function rowsToCompanies(rows: string[][]): Company[] {
  if (rows.length <= 1) return []; // header only or empty
  const header = rows[0];
  const hasBillingType = header.includes('Billing Type');
  const hasNextInvoice = header.includes('Next Invoice Number');
  const hasBillingAddress = header.includes('Billing Address');
  const hasVat = header.includes('VAT Reverse Charge');
  const hasBankId = header.includes('Bank ID');
  const hasDeletedAt = header.includes('Deleted At');
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
    billingAddress: hasBillingAddress && r[16] ? r[16] : undefined,
    vatReverseCharge: hasVat && r[17] === 'Yes' ? true : undefined,
    vatNoticeText: hasVat && r[18] ? r[18] : undefined,
    bankId: hasBankId && r[19] ? r[19] : undefined,
    deletedAt: hasDeletedAt && r[20] ? r[20] : undefined,
  }));
}

export function rowsToProjects(rows: string[][]): Project[] {
  if (rows.length <= 1) return [];
  const hasDeletedAt = rows[0].includes('Deleted At');
  return rows.slice(1).map((r) => ({
    id: r[0],
    companyId: r[1],
    name: r[2],
    isActive: r[3] !== 'No',
    createdAt: r[4],
    updatedAt: r[5],
    deletedAt: hasDeletedAt && r[6] ? r[6] : undefined,
  }));
}

export function rowsToTimeEntries(rows: string[][]): TimeEntry[] {
  if (rows.length <= 1) return [];
  const header = rows[0];
  const hasPaymentNote = header.includes('Payment Note');
  const hasDeletedAt = header.includes('Deleted At');
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
    paymentNote: hasPaymentNote && r[10] ? r[10] : undefined,
    deletedAt: hasDeletedAt && r[11] ? r[11] : undefined,
  }));
}

function parseLineItems(json: string | undefined): LineItem[] | undefined {
  if (!json) return undefined;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function rowsToInvoices(rows: string[][]): Invoice[] {
  if (rows.length <= 1) return [];
  const header = rows[0];
  const hasBillingType = header.includes('Billing Type');
  const hasExchangeRate = header.includes('Exchange Rate to USD');
  const hasPaidAmountUSD = header.includes('Paid Amount (USD)');
  const hasPaymentNote = header.includes('Payment Note');
  const hasLineItems = header.includes('Line Items (JSON)');
  const hasOverrides = header.includes('Bill To Name Override');
  const hasDeletedAt = header.includes('Deleted At');
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
    paidAmountUSD: hasPaidAmountUSD && r[17] ? parseFloat(r[17]) : undefined,
    paymentNote: hasPaymentNote && r[18] ? r[18] : undefined,
    lineItems: hasLineItems ? parseLineItems(r[19]) : undefined,
    detailLevel: hasLineItems && r[20] ? r[20] as InvoiceDetailLevel : undefined,
    billToNameOverride: hasOverrides && r[21] ? r[21] : undefined,
    billToAddressOverride: hasOverrides && r[22] ? r[22] : undefined,
    bankIdOverride: hasOverrides && r[23] ? r[23] : undefined,
    deletedAt: hasDeletedAt && r[24] ? r[24] : undefined,
    createdAt: r[12],
    updatedAt: r[13],
  }));
}

export function expensesToRows(expenses: Expense[]): string[][] {
  const header = ['ID', 'Date', 'Category', 'Description', 'Amount', 'Currency', 'Vendor', 'Payment Method', 'Has Receipt', 'Company ID', 'Recurring', 'Notes', 'Created', 'Updated', 'Deleted At'];
  const rows = expenses.map((e) => [
    e.id, e.date, e.category, e.description,
    String(e.amount), e.currency,
    e.vendor || '', e.paymentMethod || '',
    e.hasReceipt ? 'Yes' : 'No',
    e.companyId || '',
    e.recurring ? 'Yes' : 'No',
    e.notes || '',
    e.createdAt, e.updatedAt,
    e.deletedAt || '',
  ]);
  return [header, ...rows];
}

export function rowsToExpenses(rows: string[][]): Expense[] {
  if (rows.length <= 1) return [];
  const hasDeletedAt = rows[0].includes('Deleted At');
  return rows.slice(1).map((r) => ({
    id: r[0],
    date: r[1],
    category: (r[2] as ExpenseCategory) || 'other',
    description: r[3],
    amount: parseFloat(r[4]) || 0,
    currency: (r[5] as Currency) || 'USD',
    vendor: r[6] || undefined,
    paymentMethod: r[7] || undefined,
    hasReceipt: r[8] === 'Yes',
    companyId: r[9] || undefined,
    recurring: r[10] === 'Yes',
    notes: r[11] || undefined,
    createdAt: r[12],
    updatedAt: r[13],
    deletedAt: hasDeletedAt && r[14] ? r[14] : undefined,
  }));
}

export function rowsToProfile(rows: string[][]): BusinessProfile {
  const map = new Map<string, string>();
  for (const row of rows.slice(1)) {
    if (row[0]) map.set(row[0], row[1] || '');
  }
  let banks: BusinessProfile['banks'];
  const banksJson = map.get('Banks (JSON)');
  if (banksJson) {
    try {
      const parsed = JSON.parse(banksJson);
      if (Array.isArray(parsed)) banks = parsed;
    } catch {
      banks = [];
    }
  }
  return {
    name: map.get('Name') || '',
    address: map.get('Address') || '',
    email: map.get('Email') || '',
    phone: map.get('Phone') || '',
    ein: map.get('EIN') || '',
    banks,
    defaultBankId: map.get('Default Bank ID') || undefined,
    // Legacy single-bank fields — kept so older sheets still import via the getProfile() migration.
    routingNumber: map.get('Routing Number') || undefined,
    swiftCode: map.get('SWIFT Code') || undefined,
    accountNumber: map.get('Account Number') || undefined,
    bankName: map.get('Bank Name') || undefined,
    accountName: map.get('Account Name') || undefined,
  };
}
