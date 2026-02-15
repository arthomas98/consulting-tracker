import { NavLink, Outlet } from 'react-router-dom';
import { useSync } from '../../contexts/SyncContext';

const tabs = [
  { to: '/', label: 'Dashboard' },
  { to: '/time', label: 'Time' },
  { to: '/invoices', label: 'Invoices' },
  { to: '/companies', label: 'Companies' },
  { to: '/reports', label: 'Reports' },
];

function SyncIndicator() {
  const { syncStatus } = useSync();

  if (!syncStatus.isConnected && syncStatus.state === 'idle') return null;

  const isSpinning = syncStatus.state === 'pushing' || syncStatus.state === 'pulling';
  const isError = syncStatus.state === 'error';

  const title = isSpinning
    ? syncStatus.state === 'pushing' ? 'Syncing to Sheets...' : 'Pulling from Sheets...'
    : isError
      ? `Sync error: ${syncStatus.lastError}`
      : syncStatus.lastPushAt
        ? `Synced at ${syncStatus.lastPushAt.toLocaleTimeString()}`
        : 'Connected to Google Sheets';

  return (
    <span className="p-1.5" title={title}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`w-4.5 h-4.5 ${
          isSpinning ? 'text-white animate-pulse' : isError ? 'text-amber-300' : 'text-green-300'
        }`}
      >
        {isError ? (
          // Cloud with exclamation
          <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 0 1-1.44-8.765 4.5 4.5 0 0 1 8.302-3.046 3.5 3.5 0 0 1 4.504 4.272A4 4 0 0 1 15 17H5.5Zm5.25-9.25a.75.75 0 0 0-1.5 0v4a.75.75 0 0 0 1.5 0v-4Zm-.75 7a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
        ) : (
          // Cloud with checkmark
          <path fillRule="evenodd" d="M5.5 17a4.5 4.5 0 0 1-1.44-8.765 4.5 4.5 0 0 1 8.302-3.046 3.5 3.5 0 0 1 4.504 4.272A4 4 0 0 1 15 17H5.5Zm8.022-6.078-3.5 3.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06l1.47 1.47 2.97-2.97a.75.75 0 0 1 1.06 1.06Z" clipRule="evenodd" />
        )}
      </svg>
    </span>
  );
}

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gradient-to-r from-indigo-600 to-blue-600 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-lg font-semibold text-white tracking-tight">Consulting Tracker</h1>
            <nav className="flex items-center gap-1">
              {tabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'text-indigo-100 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  {tab.label}
                </NavLink>
              ))}
              <SyncIndicator />
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `ml-1 p-1.5 rounded-md transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'text-indigo-200 hover:text-white hover:bg-white/10'
                  }`
                }
                title="Settings"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.982.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
                </svg>
              </NavLink>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
