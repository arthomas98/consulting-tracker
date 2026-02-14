import type { Company, Project, TimeEntry, Invoice } from '../types';

export interface BusinessProfile {
  name: string;
  address: string;
  email: string;
  phone: string;
  ein: string;
}

const KEYS = {
  companies: 'ct_companies',
  projects: 'ct_projects',
  timeEntries: 'ct_timeEntries',
  invoices: 'ct_invoices',
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
  return read<Company>(KEYS.companies);
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
  return read<Invoice>(KEYS.invoices);
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

// Business Profile
const emptyProfile: BusinessProfile = { name: '', address: '', email: '', phone: '', ein: '' };

export function getProfile(): BusinessProfile {
  const raw = localStorage.getItem(KEYS.profile);
  return raw ? JSON.parse(raw) : { ...emptyProfile };
}

export function saveProfile(profile: BusinessProfile): BusinessProfile {
  localStorage.setItem(KEYS.profile, JSON.stringify(profile));
  return profile;
}
