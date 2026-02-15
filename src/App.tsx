import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StorageProvider } from './contexts/StorageContext';
import { SyncProvider } from './contexts/SyncContext';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './components/dashboard/DashboardPage';
import TimePage from './components/time/TimePage';
import InvoicesPage from './components/invoices/InvoicesPage';
import CompaniesPage from './components/companies/CompaniesPage';
import ReportsPage from './components/reports/ReportsPage';
import SettingsPage from './components/settings/SettingsPage';

export default function App() {
  return (
    <StorageProvider>
      <SyncProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/time" element={<TimePage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SyncProvider>
    </StorageProvider>
  );
}
