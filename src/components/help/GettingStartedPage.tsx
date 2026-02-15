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

        {/* Tips */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Tips</h3>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            <li>Use the <Link to="/reports" className="text-blue-600 hover:text-blue-800 font-medium">Reports</Link> tab for work summaries, invoicing status, and revenue breakdowns</li>
            <li>The Dashboard revenue chart shows monthly or weekly earnings at a glance</li>
            <li>Duplicate time entries with the "Dup" button for recurring work</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
