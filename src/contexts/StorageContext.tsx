import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Company, Project, TimeEntry, Invoice, Expense } from '../types';
import type { BusinessProfile } from '../utils/storage';
import * as storage from '../utils/storage';

// --- Individual context types ---

interface CompaniesContextValue {
  companies: Company[];
  saveCompany: (company: Company) => void;
  deleteCompany: (id: string) => void;
}

interface ProjectsContextValue {
  projects: Project[];
  saveProject: (project: Project) => void;
  deleteProject: (id: string) => void;
}

interface TimeEntriesContextValue {
  timeEntries: TimeEntry[];
  saveTimeEntry: (entry: TimeEntry) => void;
  deleteTimeEntry: (id: string) => void;
  saveTimeEntries: (entries: TimeEntry[]) => void;
}

interface InvoicesContextValue {
  invoices: Invoice[];
  saveInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
}

interface ExpensesContextValue {
  expenses: Expense[];
  saveExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
}

interface ProfileContextValue {
  profile: BusinessProfile;
  saveProfile: (profile: BusinessProfile) => void;
}

interface RefreshContextValue {
  refresh: () => void;
}

// --- Contexts ---

const CompaniesCtx = createContext<CompaniesContextValue | null>(null);
const ProjectsCtx = createContext<ProjectsContextValue | null>(null);
const TimeEntriesCtx = createContext<TimeEntriesContextValue | null>(null);
const InvoicesCtx = createContext<InvoicesContextValue | null>(null);
const ExpensesCtx = createContext<ExpensesContextValue | null>(null);
const ProfileCtx = createContext<ProfileContextValue | null>(null);
const RefreshCtx = createContext<RefreshContextValue | null>(null);

// --- Provider ---

export function StorageProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState(() => storage.getCompanies());
  const [projects, setProjects] = useState(() => storage.getProjects());
  const [timeEntries, setTimeEntries] = useState(() => storage.getTimeEntries());
  const [invoices, setInvoices] = useState(() => storage.getInvoices());
  const [expenses, setExpenses] = useState(() => storage.getExpenses());
  const [profile, setProfile] = useState(() => storage.getProfile());

  const notifyDataChange = useCallback(() => {
    window.dispatchEvent(new CustomEvent('ct:data-changed'));
  }, []);

  const saveCompany = useCallback((company: Company) => {
    setCompanies(storage.saveCompany(company));
    notifyDataChange();
  }, [notifyDataChange]);

  const deleteCompanyFn = useCallback((id: string) => {
    setCompanies(storage.deleteCompany(id));
    notifyDataChange();
  }, [notifyDataChange]);

  const saveProject = useCallback((project: Project) => {
    setProjects(storage.saveProject(project));
    notifyDataChange();
  }, [notifyDataChange]);

  const deleteProjectFn = useCallback((id: string) => {
    setProjects(storage.deleteProject(id));
    notifyDataChange();
  }, [notifyDataChange]);

  const saveTimeEntry = useCallback((entry: TimeEntry) => {
    setTimeEntries(storage.saveTimeEntry(entry));
    notifyDataChange();
  }, [notifyDataChange]);

  const deleteTimeEntryFn = useCallback((id: string) => {
    setTimeEntries(storage.deleteTimeEntry(id));
    notifyDataChange();
  }, [notifyDataChange]);

  const saveTimeEntries = useCallback((entries: TimeEntry[]) => {
    setTimeEntries(storage.saveTimeEntries(entries));
    notifyDataChange();
  }, [notifyDataChange]);

  const saveInvoice = useCallback((invoice: Invoice) => {
    setInvoices(storage.saveInvoice(invoice));
    notifyDataChange();
  }, [notifyDataChange]);

  const deleteInvoiceFn = useCallback((id: string) => {
    setInvoices(storage.deleteInvoice(id));
    notifyDataChange();
  }, [notifyDataChange]);

  const saveExpenseFn = useCallback((expense: Expense) => {
    setExpenses(storage.saveExpense(expense));
    notifyDataChange();
  }, [notifyDataChange]);

  const deleteExpenseFn = useCallback((id: string) => {
    setExpenses(storage.deleteExpense(id));
    notifyDataChange();
  }, [notifyDataChange]);

  const saveProfileFn = useCallback((profile: BusinessProfile) => {
    setProfile(storage.saveProfile(profile));
    notifyDataChange();
  }, [notifyDataChange]);

  const refresh = useCallback(() => {
    setCompanies(storage.getCompanies());
    setProjects(storage.getProjects());
    setTimeEntries(storage.getTimeEntries());
    setInvoices(storage.getInvoices());
    setExpenses(storage.getExpenses());
    setProfile(storage.getProfile());
  }, []);

  const companiesValue = useMemo(() => ({
    companies, saveCompany, deleteCompany: deleteCompanyFn,
  }), [companies, saveCompany, deleteCompanyFn]);

  const projectsValue = useMemo(() => ({
    projects, saveProject, deleteProject: deleteProjectFn,
  }), [projects, saveProject, deleteProjectFn]);

  const timeEntriesValue = useMemo(() => ({
    timeEntries, saveTimeEntry, deleteTimeEntry: deleteTimeEntryFn, saveTimeEntries,
  }), [timeEntries, saveTimeEntry, deleteTimeEntryFn, saveTimeEntries]);

  const invoicesValue = useMemo(() => ({
    invoices, saveInvoice, deleteInvoice: deleteInvoiceFn,
  }), [invoices, saveInvoice, deleteInvoiceFn]);

  const expensesValue = useMemo(() => ({
    expenses, saveExpense: saveExpenseFn, deleteExpense: deleteExpenseFn,
  }), [expenses, saveExpenseFn, deleteExpenseFn]);

  const profileValue = useMemo(() => ({
    profile, saveProfile: saveProfileFn,
  }), [profile, saveProfileFn]);

  const refreshValue = useMemo(() => ({ refresh }), [refresh]);

  return (
    <RefreshCtx.Provider value={refreshValue}>
      <CompaniesCtx.Provider value={companiesValue}>
        <ProjectsCtx.Provider value={projectsValue}>
          <TimeEntriesCtx.Provider value={timeEntriesValue}>
            <InvoicesCtx.Provider value={invoicesValue}>
              <ExpensesCtx.Provider value={expensesValue}>
                <ProfileCtx.Provider value={profileValue}>
                  {children}
                </ProfileCtx.Provider>
              </ExpensesCtx.Provider>
            </InvoicesCtx.Provider>
          </TimeEntriesCtx.Provider>
        </ProjectsCtx.Provider>
      </CompaniesCtx.Provider>
    </RefreshCtx.Provider>
  );
}

// --- Granular hooks ---

export function useCompanies() {
  const ctx = useContext(CompaniesCtx);
  if (!ctx) throw new Error('useCompanies must be inside StorageProvider');
  return ctx;
}

export function useProjects() {
  const ctx = useContext(ProjectsCtx);
  if (!ctx) throw new Error('useProjects must be inside StorageProvider');
  return ctx;
}

export function useTimeEntries() {
  const ctx = useContext(TimeEntriesCtx);
  if (!ctx) throw new Error('useTimeEntries must be inside StorageProvider');
  return ctx;
}

export function useInvoices() {
  const ctx = useContext(InvoicesCtx);
  if (!ctx) throw new Error('useInvoices must be inside StorageProvider');
  return ctx;
}

export function useExpenses() {
  const ctx = useContext(ExpensesCtx);
  if (!ctx) throw new Error('useExpenses must be inside StorageProvider');
  return ctx;
}

export function useProfile() {
  const ctx = useContext(ProfileCtx);
  if (!ctx) throw new Error('useProfile must be inside StorageProvider');
  return ctx;
}

export function useRefresh() {
  const ctx = useContext(RefreshCtx);
  if (!ctx) throw new Error('useRefresh must be inside StorageProvider');
  return ctx;
}

// --- Backward-compatible composite hook ---

export function useStorage() {
  const { companies, saveCompany, deleteCompany } = useCompanies();
  const { projects, saveProject, deleteProject } = useProjects();
  const { timeEntries, saveTimeEntry, deleteTimeEntry, saveTimeEntries } = useTimeEntries();
  const { invoices, saveInvoice, deleteInvoice } = useInvoices();
  const { expenses, saveExpense, deleteExpense } = useExpenses();
  const { profile, saveProfile } = useProfile();
  const { refresh } = useRefresh();
  return {
    companies, saveCompany, deleteCompany,
    projects, saveProject, deleteProject,
    timeEntries, saveTimeEntry, deleteTimeEntry, saveTimeEntries,
    invoices, saveInvoice, deleteInvoice,
    expenses, saveExpense, deleteExpense,
    profile, saveProfile,
    refresh,
  };
}
