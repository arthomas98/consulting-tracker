import { Link } from 'react-router-dom';

export default function GettingStartedPage() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-sm text-blue-600 hover:text-blue-800">&larr; Back to Dashboard</Link>
      </div>
      <h2 className="text-2xl font-bold mb-2">Getting Started</h2>
      <p className="text-sm text-gray-500 mb-6">
        Consulting Tracker helps you log consulting time, invoice clients, and track payments — all in your browser with no account required.
      </p>

      <div className="space-y-6 max-w-2xl">
        {/* Step 1 */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">1. Add a Company</h3>
          <p className="text-sm text-gray-600">
            Go to the <Link to="/companies" className="text-blue-600 hover:text-blue-800 font-medium">Companies</Link> page and add your clients. For each company you can set:
          </p>
          <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>Hourly rate and currency (USD or EUR)</li>
            <li>Whether they require invoices or pay per-entry</li>
            <li>Payment terms, payment method, and contact info</li>
            <li>Projects within each company to categorize your work</li>
          </ul>
        </div>

        {/* Step 2 */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">2. Log Time</h3>
          <p className="text-sm text-gray-600">
            Record your work on the <Link to="/time" className="text-blue-600 hover:text-blue-800 font-medium">Time</Link> page or use the Quick Entry form on the Dashboard. Each entry includes a date, company, optional project, description, and hours.
          </p>
          <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
            <li><strong>Hours mode</strong> — enter hours worked, amount is calculated from the company rate</li>
            <li><strong>Amount mode</strong> — enter a fixed dollar amount for flat-fee work</li>
          </ul>
        </div>

        {/* Step 3 */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">3. Create Invoices</h3>
          <p className="text-sm text-gray-600">
            For companies that require invoices, go to the <Link to="/invoices" className="text-blue-600 hover:text-blue-800 font-medium">Invoices</Link> page to create them. Select uninvoiced time entries, review the total, and generate an invoice. You can print or save as PDF.
          </p>
          <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>Invoices move through statuses: Draft &rarr; Sent &rarr; Paid</li>
            <li>Your business profile (set in Settings) appears on printed invoices</li>
          </ul>
        </div>

        {/* Step 4 */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">4. Track Payments</h3>
          <p className="text-sm text-gray-600">
            Payment tracking depends on how the company is set up:
          </p>
          <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
            <li><strong>Invoice-required companies</strong> — mark invoices as paid on the Invoices page</li>
            <li><strong>Non-invoice companies</strong> — mark individual entries as paid directly on the Time page or Dashboard</li>
          </ul>
          <p className="text-sm text-gray-600 mt-2">
            The Dashboard shows all outstanding payments at a glance.
          </p>
        </div>

        {/* Step 5 */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">5. Back Up Your Data</h3>
          <p className="text-sm text-gray-600">
            Your data lives in your browser's local storage. To keep it safe:
          </p>
          <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
            <li><strong>Google Sheets sync</strong> — connect in <Link to="/settings" className="text-blue-600 hover:text-blue-800 font-medium">Settings</Link> to automatically back up to a spreadsheet in your Google Drive</li>
            <li><strong>JSON export</strong> — download a full backup file from Settings at any time</li>
            <li><strong>JSON import</strong> — restore from a backup file to transfer data between browsers</li>
          </ul>
        </div>

        {/* Google Integration */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">6. Google Sheets Integration</h3>
          <p className="text-sm text-gray-600">
            The app can connect to your Google account to back up all data to a spreadsheet in your Google Drive. This is a one-way push — your local data syncs to the cloud, not the other way around.
          </p>
          <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>Go to <Link to="/settings" className="text-blue-600 hover:text-blue-800 font-medium">Settings</Link> and click <strong>Connect & Sync</strong></li>
            <li>Sign in with Google and grant permission to create spreadsheets</li>
            <li>A "Consulting Tracker Backup" spreadsheet is created in your Drive with 5 tabs: Companies, Projects, TimeEntries, Invoices, and Profile</li>
            <li>Data auto-syncs whenever you make changes — you can also click <strong>Sync Now</strong> to push manually</li>
            <li>Use <strong>Pull from Sheets</strong> to restore data from the spreadsheet (replaces all local data)</li>
            <li>You can disconnect at any time — the spreadsheet stays in your Drive</li>
          </ul>
          <p className="text-sm text-gray-600 mt-2">
            The app uses Google OAuth 2.0 (via Google Identity Services) and requests only the <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">spreadsheets</code> and <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">drive.file</code> scopes — it can only access spreadsheets it creates, not your other files.
          </p>
        </div>

        {/* Tips */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Tips</h3>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>Use the <Link to="/reports" className="text-blue-600 hover:text-blue-800 font-medium">Reports</Link> tab for work summaries, invoicing status, and revenue breakdowns</li>
            <li>The Dashboard revenue chart shows monthly or weekly earnings at a glance</li>
            <li>Duplicate time entries with the "Dup" button for recurring work</li>
          </ul>
        </div>

        {/* Architecture */}
        <h2 className="text-xl font-bold pt-4">Architecture</h2>
        <p className="text-sm text-gray-500 -mt-4">
          How the app is built under the hood.
        </p>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Local-First SPA</h3>
          <p className="text-sm text-gray-600">
            Consulting Tracker is a local-first single-page application. All data is stored in your browser's <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">localStorage</code> — there is no backend server. The app works offline and loads instantly because it never waits on a network request for core functionality.
          </p>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Tech Stack</h3>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li><strong>React 18</strong> with TypeScript for type-safe UI components</li>
            <li><strong>Vite</strong> for fast builds and hot module replacement</li>
            <li><strong>Tailwind CSS v4</strong> for utility-first styling</li>
            <li><strong>React Router v6</strong> for client-side navigation</li>
            <li><strong>Vercel</strong> for static hosting with SPA routing</li>
          </ul>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Data Flow</h3>
          <p className="text-sm text-gray-600 mb-2">
            Data follows an offline-first pattern:
          </p>
          <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
            <li>User action updates React state via the StorageContext</li>
            <li>State change is immediately persisted to localStorage</li>
            <li>If Google Sheets is connected, the sync manager pushes changes to the cloud (debounced)</li>
          </ol>
          <p className="text-sm text-gray-600 mt-2">
            This means the app always feels fast — cloud sync happens in the background and never blocks the UI.
          </p>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">State Management</h3>
          <p className="text-sm text-gray-600">
            Global state is managed with React Context (no Redux or external state libraries). The <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">StorageContext</code> provides all CRUD operations and data to every component. A separate <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">SyncContext</code> handles Google Sheets connection state and sync operations.
          </p>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Project Structure</h3>
          <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto">{`src/
  types/              TypeScript interfaces
  utils/              Pure utility functions
    storage.ts          localStorage CRUD layer
    calculations.ts     Amount & totals logic
    dateUtils.ts        Date helpers (ISO strings)
    formatCurrency.ts   Number formatting
    csv.ts              CSV export
  services/
    googleAuth.ts       OAuth2 token flow
    sheetsDataMapper.ts Data-to-rows mapping
    syncManager.ts      Cloud sync management
  contexts/
    StorageContext.tsx   Global state provider
    SyncContext.tsx      Google Sheets sync state
  components/
    layout/             App shell & navigation
    dashboard/          Summary cards, charts, quick entry
    time/               Time entry list & forms
    invoices/           Invoice CRUD & print
    companies/          Company & project management
    reports/            Work, invoicing & revenue reports
    settings/           Profile, export/import, Sheets sync
    help/               This getting started guide`}</pre>
        </div>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Google Sheets as Cloud Database</h3>
          <p className="text-sm text-gray-600">
            Rather than a traditional backend database, the app uses Google Sheets as an optional cloud store. Benefits:
          </p>
          <ul className="mt-2 text-sm text-gray-600 list-disc list-inside space-y-1">
            <li><strong>User-owned data</strong> — the spreadsheet lives in your Google Drive, not on a third-party server</li>
            <li><strong>Free storage</strong> — no database costs</li>
            <li><strong>Inspectable</strong> — you can open the spreadsheet and view/edit your data directly</li>
            <li><strong>No backend needed</strong> — OAuth and API calls happen client-side</li>
          </ul>
          <p className="text-sm text-gray-600 mt-2">
            A data mapper layer (<code className="text-xs bg-gray-100 px-1 py-0.5 rounded">sheetsDataMapper.ts</code>) translates between app models and spreadsheet rows. On each sync, all sheets are cleared and rewritten with current data.
          </p>
        </div>
      </div>
    </div>
  );
}
