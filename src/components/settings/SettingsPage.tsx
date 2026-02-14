import { useRef, useState } from 'react';
import { useStorage } from '../../contexts/StorageContext';
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

        if (!confirm(`This will replace all your current data with:\n\n• ${data.companies.length} companies\n• ${data.projects.length} projects\n• ${data.timeEntries.length} time entries\n• ${data.invoices.length} invoices\n\nContinue?`)) {
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
      } catch {
        setMessage({ type: 'error', text: 'Failed to parse file. Please select a valid JSON backup.' });
      }
    };
    reader.readAsText(file);

    // Reset file input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = '';
  }

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
