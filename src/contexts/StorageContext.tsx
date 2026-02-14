import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Company, Project, TimeEntry, Invoice } from '../types';
import type { BusinessProfile } from '../utils/storage';
import * as storage from '../utils/storage';

interface StorageState {
  companies: Company[];
  projects: Project[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  profile: BusinessProfile;
}

interface StorageContextValue extends StorageState {
  saveCompany: (company: Company) => void;
  deleteCompany: (id: string) => void;
  saveProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  saveTimeEntry: (entry: TimeEntry) => void;
  deleteTimeEntry: (id: string) => void;
  saveTimeEntries: (entries: TimeEntry[]) => void;
  saveInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
  saveProfile: (profile: BusinessProfile) => void;
  refresh: () => void;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function StorageProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StorageState>(() => ({
    companies: storage.getCompanies(),
    projects: storage.getProjects(),
    timeEntries: storage.getTimeEntries(),
    invoices: storage.getInvoices(),
    profile: storage.getProfile(),
  }));

  const refresh = useCallback(() => {
    setState({
      companies: storage.getCompanies(),
      projects: storage.getProjects(),
      timeEntries: storage.getTimeEntries(),
      invoices: storage.getInvoices(),
      profile: storage.getProfile(),
    });
  }, []);

  const saveCompany = useCallback((company: Company) => {
    const updated = storage.saveCompany(company);
    setState((s) => ({ ...s, companies: updated }));
  }, []);

  const deleteCompany = useCallback((id: string) => {
    const updated = storage.deleteCompany(id);
    setState((s) => ({ ...s, companies: updated }));
  }, []);

  const saveProject = useCallback((project: Project) => {
    const updated = storage.saveProject(project);
    setState((s) => ({ ...s, projects: updated }));
  }, []);

  const deleteProject = useCallback((id: string) => {
    const updated = storage.deleteProject(id);
    setState((s) => ({ ...s, projects: updated }));
  }, []);

  const saveTimeEntry = useCallback((entry: TimeEntry) => {
    const updated = storage.saveTimeEntry(entry);
    setState((s) => ({ ...s, timeEntries: updated }));
  }, []);

  const deleteTimeEntry = useCallback((id: string) => {
    const updated = storage.deleteTimeEntry(id);
    setState((s) => ({ ...s, timeEntries: updated }));
  }, []);

  const saveTimeEntries = useCallback((entries: TimeEntry[]) => {
    const updated = storage.saveTimeEntries(entries);
    setState((s) => ({ ...s, timeEntries: updated }));
  }, []);

  const saveInvoice = useCallback((invoice: Invoice) => {
    const updated = storage.saveInvoice(invoice);
    setState((s) => ({ ...s, invoices: updated }));
  }, []);

  const deleteInvoice = useCallback((id: string) => {
    const updated = storage.deleteInvoice(id);
    setState((s) => ({ ...s, invoices: updated }));
  }, []);

  const saveProfileFn = useCallback((profile: BusinessProfile) => {
    const updated = storage.saveProfile(profile);
    setState((s) => ({ ...s, profile: updated }));
  }, []);

  return (
    <StorageContext.Provider
      value={{
        ...state,
        saveCompany,
        deleteCompany,
        saveProject,
        deleteProject,
        saveTimeEntry,
        deleteTimeEntry,
        saveTimeEntries,
        saveInvoice,
        deleteInvoice,
        saveProfile: saveProfileFn,
        refresh,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage(): StorageContextValue {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be inside StorageProvider');
  return ctx;
}
