import { useRef, useState } from 'react';
import { useStorage } from '../../contexts/StorageContext';
import { useSync } from '../../contexts/SyncContext';
import type { BusinessProfile } from '../../utils/storage';

const STORAGE_KEYS = {
  companies: 'ct_companies',
  projects: 'ct_projects',
  timeEntries: 'ct_timeEntries',
  invoices: 'ct_invoices',
  profile: 'ct_profile',
} as const;

const EXPECTED_KEYS = ['companies', 'projects', 'timeEntries', 'invoices'] as const;

export default function SettingsPage() {
  const { companies, projects, timeEntries, invoices, profile, saveProfile, refresh } = useStorage();
  const { syncStatus, forcePush, forcePull, connect, disconnect, spreadsheetUrl, triggerPush } = useSync();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editProfile, setEditProfile] = useState<BusinessProfile>({ ...profile });
  const [profileSaved, setProfileSaved] = useState(false);

  function handleSaveProfile() {
    saveProfile(editProfile);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  function handleExport() {
    const data = { companies, projects, timeEntries, invoices, profile };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consulting-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: 'Data exported successfully.' });
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);

        // Validate structure
        for (const key of EXPECTED_KEYS) {
          if (!Array.isArray(data[key])) {
            setMessage({ type: 'error', text: `Invalid file: missing or invalid "${key}" array.` });
            return;
          }
        }

        if (!confirm(`This will replace all your current data with:\n\n\u2022 ${data.companies.length} companies\n\u2022 ${data.projects.length} projects\n\u2022 ${data.timeEntries.length} time entries\n\u2022 ${data.invoices.length} invoices\n\nContinue?`)) {
          return;
        }

        // Write to localStorage
        localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(data.companies));
        localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(data.projects));
        localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(data.timeEntries));
        localStorage.setItem(STORAGE_KEYS.invoices, JSON.stringify(data.invoices));
        if (data.profile) {
          localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(data.profile));
        }

        refresh();
        setEditProfile(data.profile || profile);
        setMessage({ type: 'success', text: `Imported ${data.companies.length} companies, ${data.projects.length} projects, ${data.timeEntries.length} time entries, ${data.invoices.length} invoices.` });

        // Push imported data to Sheets if connected
        triggerPush();
      } catch {
        setMessage({ type: 'error', text: 'Failed to parse file. Please select a valid JSON backup.' });
      }
    };
    reader.readAsText(file);

    // Reset file input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSyncNow() {
    setMessage(null);
    try {
      await forcePush();
      setMessage({ type: 'success', text: `Data synced to Google Sheets.` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: `Sync failed: ${msg}` });
    }
  }

  async function handleConnect() {
    setMessage(null);
    try {
      await connect();
      setMessage({ type: 'success', text: 'Connected to Google Sheets.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: `Connection failed: ${msg}` });
    }
  }

  async function handlePull() {
    if (!confirm('Pull data from Google Sheets? This will overwrite all your local data.')) return;
    setMessage(null);
    try {
      await forcePull();
      setEditProfile({ ...profile });
      setMessage({ type: 'success', text: 'Data pulled from Google Sheets.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessage({ type: 'error', text: `Pull failed: ${msg}` });
    }
  }

  function handleDisconnect() {
    if (!confirm('Disconnect Google Sheets? The spreadsheet will remain in your Google Drive but will no longer auto-sync.')) return;
    disconnect();
    setMessage({ type: 'success', text: 'Disconnected from Google Sheets.' });
  }

  const isBusy = syncStatus.state === 'pushing' || syncStatus.state === 'pulling' || syncStatus.state === 'conflict';
  const statusLabel = syncStatus.state === 'conflict'
    ? 'Merging changes...'
    : syncStatus.isConnected
      ? syncStatus.lastPushAt
        ? `Connected \u2014 Last synced: ${syncStatus.lastPushAt.toLocaleTimeString()}`
        : 'Connected'
      : syncStatus.lastError
        ? `Error: ${syncStatus.lastError}`
        : 'Not connected';

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      <div className="space-y-6 max-w-xl">
        {/* Business Profile */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Business Profile</h3>
          <p className="text-sm text-gray-500 mb-4">This information appears on your printed invoices.</p>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={editProfile.name}
                onChange={(e) => setEditProfile({ ...editProfile, name: e.target.value })}
                placeholder="Your full name or business name"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={editProfile.address}
                onChange={(e) => setEditProfile({ ...editProfile, address: e.target.value })}
                placeholder="Street address, City, State, ZIP"
                rows={2}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editProfile.email}
                  onChange={(e) => setEditProfile({ ...editProfile, email: e.target.value })}
                  placeholder="you@example.com"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editProfile.phone}
                  onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">EIN</label>
              <input
                type="text"
                value={editProfile.ein}
                onChange={(e) => setEditProfile({ ...editProfile, ein: e.target.value })}
                placeholder="XX-XXXXXXX"
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="border-t pt-3 mt-1">
              <p className="text-sm font-medium text-gray-700 mb-3">Banking Information</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Routing #</label>
                    <input
                      type="text"
                      value={editProfile.routingNumber || ''}
                      onChange={(e) => setEditProfile({ ...editProfile, routingNumber: e.target.value })}
                      placeholder="XXXXXXXXX"
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account #</label>
                    <input
                      type="text"
                      value={editProfile.accountNumber || ''}
                      onChange={(e) => setEditProfile({ ...editProfile, accountNumber: e.target.value })}
                      placeholder="XXXXXXXXXXXX"
                      className="w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT Code</label>
                  <input
                    type="text"
                    value={editProfile.swiftCode || ''}
                    onChange={(e) => setEditProfile({ ...editProfile, swiftCode: e.target.value })}
                    placeholder="XXXXXXXX"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveProfile}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Save Profile
              </button>
              {profileSaved && <span className="text-sm text-green-600">Saved!</span>}
            </div>
          </div>
        </div>

        {/* Google Sheets Sync */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Google Sheets Backup</h3>
          <p className="text-sm text-gray-500 mb-4">Auto-syncs your data to a Google Sheet in your Drive. Changes push automatically.</p>

          <div className="space-y-3">
            <p className={`text-xs font-medium ${syncStatus.isConnected ? 'text-green-600' : syncStatus.lastError ? 'text-amber-600' : 'text-gray-500'}`}>
              {statusLabel}
            </p>

            <div className="flex items-center gap-3">
              {syncStatus.isConnected ? (
                <>
                  <button
                    onClick={handleSyncNow}
                    disabled={isBusy}
                    className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncStatus.state === 'conflict' ? 'Merging...' : syncStatus.state === 'pushing' ? 'Pushing...' : 'Sync Now'}
                  </button>
                  <button
                    onClick={handlePull}
                    disabled={isBusy}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncStatus.state === 'pulling' ? 'Pulling...' : 'Pull from Sheets'}
                  </button>
                  <button
                    onClick={handleDisconnect}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={isBusy}
                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBusy ? 'Connecting...' : 'Connect & Sync'}
                </button>
              )}
            </div>

            {spreadsheetUrl && (
              <p className="text-sm">
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Open spreadsheet in Google Sheets
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Export */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Export Data</h3>
          <p className="text-sm text-gray-500 mb-3">Download all your data as a JSON file for backup or transfer to another browser.</p>
          <div className="flex items-center gap-4">
            <button
              onClick={handleExport}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Export JSON
            </button>
            <span className="text-xs text-gray-400">
              {companies.length} companies, {projects.length} projects, {timeEntries.length} entries, {invoices.length} invoices
            </span>
          </div>
        </div>

        {/* Import */}
        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Import Data</h3>
          <p className="text-sm text-gray-500 mb-3">Load data from a previously exported JSON file. This will replace all current data.</p>
          <label className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors">
            Choose File
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
        </div>

        {/* Status message */}
        {message && (
          <div className={`rounded-lg px-4 py-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
