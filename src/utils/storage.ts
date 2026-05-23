import type { Company, Project, TimeEntry, Invoice, Expense } from '../types';

export interface BankAccount {
  id: string;
  label: string;
  bankName?: string;
  bankAddress?: string;
  accountName?: string;
  accountNumber?: string;
  routingNumber?: string;
  swiftCode?: string;
}

export interface BusinessProfile {
  name: string;
  address: string;
  email: string;
  phone: string;
  ein: string;
  banks?: BankAccount[];
  defaultBankId?: string;
  // Legacy single-bank fields — migrated into `banks` by getProfile().
  // Kept optional so old JSON backups still import.
  routingNumber?: string;
  swiftCode?: string;
  accountNumber?: string;
  bankName?: string;
  accountName?: string;
}

const KEYS = {
  companies: 'ct_companies',
  projects: 'ct_projects',
  timeEntries: 'ct_timeEntries',
  invoices: 'ct_invoices',
  expenses: 'ct_expenses',
  profile: 'ct_profile',
} as const;

function read<T>(key: string): T[] {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

function write<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Companies
export function getCompanies(): Company[] {
  return read<Company>(KEYS.companies).map((c) => ({
    ...c,
    billingType: c.billingType || 'hourly',
  }));
}

export function saveCompany(company: Company): Company[] {
  const companies = getCompanies();
  const idx = companies.findIndex((c) => c.id === company.id);
  const updated = idx >= 0
    ? companies.map((c) => (c.id === company.id ? company : c))
    : [...companies, company];
  write(KEYS.companies, updated);
  return updated;
}

export function deleteCompany(id: string): Company[] {
  const updated = getCompanies().filter((c) => c.id !== id);
  write(KEYS.companies, updated);
  return updated;
}

// Projects
export function getProjects(): Project[] {
  return read<Project>(KEYS.projects);
}

export function saveProject(project: Project): Project[] {
  const projects = getProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  const updated = idx >= 0
    ? projects.map((p) => (p.id === project.id ? project : p))
    : [...projects, project];
  write(KEYS.projects, updated);
  return updated;
}

export function deleteProject(id: string): Project[] {
  const updated = getProjects().filter((p) => p.id !== id);
  write(KEYS.projects, updated);
  return updated;
}

// Time Entries
export function getTimeEntries(): TimeEntry[] {
  return read<TimeEntry>(KEYS.timeEntries);
}

export function saveTimeEntry(entry: TimeEntry): TimeEntry[] {
  const entries = getTimeEntries();
  const idx = entries.findIndex((e) => e.id === entry.id);
  const updated = idx >= 0
    ? entries.map((e) => (e.id === entry.id ? entry : e))
    : [...entries, entry];
  write(KEYS.timeEntries, updated);
  return updated;
}

export function deleteTimeEntry(id: string): TimeEntry[] {
  const updated = getTimeEntries().filter((e) => e.id !== id);
  write(KEYS.timeEntries, updated);
  return updated;
}

export function saveTimeEntries(entries: TimeEntry[]): TimeEntry[] {
  write(KEYS.timeEntries, entries);
  return entries;
}

// Invoices
export function getInvoices(): Invoice[] {
  return read<Invoice>(KEYS.invoices).map((i) => ({
    ...i,
    billingType: i.billingType || 'hourly',
    exchangeRateToUSD: i.exchangeRateToUSD ?? (i.currency === 'USD' ? 1.0 : undefined),
  }));
}

export function saveInvoice(invoice: Invoice): Invoice[] {
  const invoices = getInvoices();
  const idx = invoices.findIndex((i) => i.id === invoice.id);
  const updated = idx >= 0
    ? invoices.map((i) => (i.id === invoice.id ? invoice : i))
    : [...invoices, invoice];
  write(KEYS.invoices, updated);
  return updated;
}

export function deleteInvoice(id: string): Invoice[] {
  const updated = getInvoices().filter((i) => i.id !== id);
  write(KEYS.invoices, updated);
  return updated;
}

// Expenses
export function getExpenses(): Expense[] {
  return read<Expense>(KEYS.expenses);
}

export function saveExpense(expense: Expense): Expense[] {
  const expenses = getExpenses();
  const idx = expenses.findIndex((e) => e.id === expense.id);
  const updated = idx >= 0
    ? expenses.map((e) => (e.id === expense.id ? expense : e))
    : [...expenses, expense];
  write(KEYS.expenses, updated);
  return updated;
}

export function deleteExpense(id: string): Expense[] {
  const updated = getExpenses().filter((e) => e.id !== id);
  write(KEYS.expenses, updated);
  return updated;
}

// Bulk write (used when pulling from Sheets)
export function writeAll(data: {
  companies: Company[];
  projects: Project[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  expenses: Expense[];
  profile: BusinessProfile;
}): void {
  write(KEYS.companies, data.companies);
  write(KEYS.projects, data.projects);
  write(KEYS.timeEntries, data.timeEntries);
  write(KEYS.invoices, data.invoices);
  write(KEYS.expenses, data.expenses);
  localStorage.setItem(KEYS.profile, JSON.stringify(data.profile));
}

// Business Profile
const emptyProfile: BusinessProfile = { name: '', address: '', email: '', phone: '', ein: '', banks: [] };

function migrateProfile(profile: BusinessProfile): BusinessProfile {
  if (Array.isArray(profile.banks)) {
    // Already migrated; just guarantee defaultBankId points at an existing bank if possible.
    if (profile.banks.length > 0 && !profile.banks.some((b) => b.id === profile.defaultBankId)) {
      return { ...profile, defaultBankId: profile.banks[0].id };
    }
    return profile;
  }
  const hasLegacy = !!(profile.bankName || profile.accountName || profile.accountNumber || profile.routingNumber || profile.swiftCode);
  if (!hasLegacy) {
    return { ...profile, banks: [] };
  }
  const id = `bank_${Date.now()}`;
  const migrated: BankAccount = {
    id,
    label: profile.bankName || 'Default',
    bankName: profile.bankName,
    accountName: profile.accountName,
    accountNumber: profile.accountNumber,
    routingNumber: profile.routingNumber,
    swiftCode: profile.swiftCode,
  };
  const { bankName: _bn, accountName: _an, accountNumber: _acn, routingNumber: _rn, swiftCode: _sc, ...rest } = profile;
  return { ...rest, banks: [migrated], defaultBankId: id };
}

export function getProfile(): BusinessProfile {
  const raw = localStorage.getItem(KEYS.profile);
  const parsed: BusinessProfile = raw ? JSON.parse(raw) : { ...emptyProfile };
  const migrated = migrateProfile(parsed);
  // Persist migration so legacy fields don't get re-read every load.
  if (raw && migrated !== parsed) {
    localStorage.setItem(KEYS.profile, JSON.stringify(migrated));
  }
  return migrated;
}

export function saveProfile(profile: BusinessProfile): BusinessProfile {
  const normalized = migrateProfile(profile);
  localStorage.setItem(KEYS.profile, JSON.stringify(normalized));
  return normalized;
}
