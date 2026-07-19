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

// Deletions are tombstones (deletedAt set), not removals: sync merges have no
// other way to tell "deleted here" from "created on the other machine", so a
// hard delete resurrects on the next merge. Raw readers include tombstones
// (sync needs them); public getters filter to live records for the UI. Save
// and delete functions therefore MUST operate on the raw arrays — writing a
// live-filtered array back would drop every tombstone.

type Tombstoned = { deletedAt?: string };

function isLive<T extends Tombstoned>(record: T): boolean {
  return !record.deletedAt;
}

function upsertRaw<T extends { id: string }>(all: T[], record: T): T[] {
  const idx = all.findIndex((x) => x.id === record.id);
  return idx >= 0 ? all.map((x) => (x.id === record.id ? record : x)) : [...all, record];
}

function tombstoneRaw<T extends { id: string; updatedAt: string } & Tombstoned>(all: T[], id: string): T[] {
  const now = new Date().toISOString();
  return all.map((x) => (x.id === id ? { ...x, deletedAt: now, updatedAt: now } : x));
}

// Companies
function readRawCompanies(): Company[] {
  return read<Company>(KEYS.companies).map((c) => ({
    ...c,
    billingType: c.billingType || 'hourly',
  }));
}

export function getCompanies(): Company[] {
  return readRawCompanies().filter(isLive);
}

export function saveCompany(company: Company): Company[] {
  const updated = upsertRaw(readRawCompanies(), company);
  write(KEYS.companies, updated);
  return updated.filter(isLive);
}

export function deleteCompany(id: string): Company[] {
  const updated = tombstoneRaw(readRawCompanies(), id);
  write(KEYS.companies, updated);
  return updated.filter(isLive);
}

// Projects
function readRawProjects(): Project[] {
  return read<Project>(KEYS.projects);
}

export function getProjects(): Project[] {
  return readRawProjects().filter(isLive);
}

export function saveProject(project: Project): Project[] {
  const updated = upsertRaw(readRawProjects(), project);
  write(KEYS.projects, updated);
  return updated.filter(isLive);
}

export function deleteProject(id: string): Project[] {
  const updated = tombstoneRaw(readRawProjects(), id);
  write(KEYS.projects, updated);
  return updated.filter(isLive);
}

// Time Entries
function readRawTimeEntries(): TimeEntry[] {
  return read<TimeEntry>(KEYS.timeEntries);
}

export function getTimeEntries(): TimeEntry[] {
  return readRawTimeEntries().filter(isLive);
}

export function saveTimeEntry(entry: TimeEntry): TimeEntry[] {
  const updated = upsertRaw(readRawTimeEntries(), entry);
  write(KEYS.timeEntries, updated);
  return updated.filter(isLive);
}

export function deleteTimeEntry(id: string): TimeEntry[] {
  const updated = tombstoneRaw(readRawTimeEntries(), id);
  write(KEYS.timeEntries, updated);
  return updated.filter(isLive);
}

export function saveTimeEntries(entries: TimeEntry[]): TimeEntry[] {
  // Bulk replace of the live set — carry existing tombstones through
  const tombstones = readRawTimeEntries().filter(
    (e) => e.deletedAt && !entries.some((n) => n.id === e.id)
  );
  write(KEYS.timeEntries, [...entries, ...tombstones]);
  return entries.filter(isLive);
}

// Invoices
function readRawInvoices(): Invoice[] {
  return read<Invoice>(KEYS.invoices).map((i) => ({
    ...i,
    billingType: i.billingType || 'hourly',
    exchangeRateToUSD: i.exchangeRateToUSD ?? (i.currency === 'USD' ? 1.0 : undefined),
  }));
}

export function getInvoices(): Invoice[] {
  return readRawInvoices().filter(isLive);
}

export function saveInvoice(invoice: Invoice): Invoice[] {
  const updated = upsertRaw(readRawInvoices(), invoice);
  write(KEYS.invoices, updated);
  return updated.filter(isLive);
}

export function deleteInvoice(id: string): Invoice[] {
  const updated = tombstoneRaw(readRawInvoices(), id);
  write(KEYS.invoices, updated);
  return updated.filter(isLive);
}

// Expenses
function readRawExpenses(): Expense[] {
  return read<Expense>(KEYS.expenses);
}

export function getExpenses(): Expense[] {
  return readRawExpenses().filter(isLive);
}

export function saveExpense(expense: Expense): Expense[] {
  const updated = upsertRaw(readRawExpenses(), expense);
  write(KEYS.expenses, updated);
  return updated.filter(isLive);
}

export function deleteExpense(id: string): Expense[] {
  const updated = tombstoneRaw(readRawExpenses(), id);
  write(KEYS.expenses, updated);
  return updated.filter(isLive);
}

// Full raw snapshot including tombstones — this is what sync must push/merge.
// The React state in StorageContext holds only live records, so building a
// sync payload from there would strip tombstones and deletions would stop
// propagating.
export function getSyncSnapshot(): {
  companies: Company[];
  projects: Project[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  expenses: Expense[];
  profile: BusinessProfile;
} {
  return {
    companies: readRawCompanies(),
    projects: readRawProjects(),
    timeEntries: readRawTimeEntries(),
    invoices: readRawInvoices(),
    expenses: readRawExpenses(),
    profile: getProfile(),
  };
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
