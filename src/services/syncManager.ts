import type { Company, Project, TimeEntry, Invoice } from '../types';
import type { BusinessProfile } from '../utils/storage';
import {
  companiesToRows, projectsToRows, timeEntriesToRows, invoicesToRows, profileToRows,
  rowsToCompanies, rowsToProjects, rowsToTimeEntries, rowsToInvoices, rowsToProfile,
} from './sheetsDataMapper';

const SPREADSHEET_ID_KEY = 'ct_sheets_spreadsheetId';
const LAST_SYNC_KEY = 'ct_sheets_lastSyncTime';
const DATA_SHEET_NAMES = ['Companies', 'Projects', 'TimeEntries', 'Invoices', 'Profile'];
const SHEET_NAMES = [...DATA_SHEET_NAMES, '_Metadata'];

export function getSpreadsheetId(): string | null {
  return localStorage.getItem(SPREADSHEET_ID_KEY);
}

export function setSpreadsheetId(id: string): void {
  localStorage.setItem(SPREADSHEET_ID_KEY, id);
}

export function clearSpreadsheetId(): void {
  localStorage.removeItem(SPREADSHEET_ID_KEY);
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function setLastSyncTime(iso: string): void {
  localStorage.setItem(LAST_SYNC_KEY, iso);
}

export function clearLastSyncTime(): void {
  localStorage.removeItem(LAST_SYNC_KEY);
}

async function createSpreadsheet(): Promise<string> {
  const response = await gapi.client.sheets.spreadsheets.create({
    resource: {
      properties: { title: 'Consulting Tracker Backup' },
      sheets: SHEET_NAMES.map((title) => ({
        properties: { title },
      })),
    },
  });
  const id = response.result.spreadsheetId;
  setSpreadsheetId(id);
  return id;
}

async function ensureSheets(spreadsheetId: string): Promise<void> {
  // Get existing sheet names
  const resp = await gapi.client.request({
    path: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
    method: 'GET',
  });
  const existingNames = new Set(
    resp.result.sheets.map((s: { properties: { title: string } }) => s.properties.title)
  );

  // Add missing sheets
  const requests = SHEET_NAMES
    .filter((name) => !existingNames.has(name))
    .map((title) => ({ addSheet: { properties: { title } } }));

  if (requests.length > 0) {
    await gapi.client.request({
      path: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      method: 'POST',
      body: { requests },
    });
  }
}

export interface SyncData {
  companies: Company[];
  projects: Project[];
  timeEntries: TimeEntry[];
  invoices: Invoice[];
  profile: BusinessProfile;
}

// --- _Metadata sheet helpers ---

async function readRemoteLastModified(spreadsheetId: string): Promise<string | null> {
  try {
    const resp = await gapi.client.request({
      path: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('_Metadata!A1:B2')}`,
      method: 'GET',
    });
    const rows: string[][] = resp.result.values || [];
    // Expect [["Key","Value"],["lastModified","<iso>"]]
    if (rows.length >= 2 && rows[1][0] === 'lastModified') {
      return rows[1][1] || null;
    }
    return null;
  } catch {
    // Legacy spreadsheet without _Metadata sheet
    return null;
  }
}

async function writeRemoteLastModified(spreadsheetId: string, iso: string): Promise<void> {
  // Clear then write
  try {
    await gapi.client.request({
      path: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('_Metadata!A:Z')}:clear`,
      method: 'POST',
      body: {},
    });
  } catch {
    // Ignore if sheet doesn't exist yet
  }
  await gapi.client.request({
    path: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent('_Metadata!A1')}?valueInputOption=RAW`,
    method: 'PUT',
    body: {
      values: [['Key', 'Value'], ['lastModified', iso]],
    },
  });
}

// --- Merge algorithm ---

function mergeArray<T extends { id: string; updatedAt: string }>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>();
  // Start with remote records
  for (const r of remote) {
    map.set(r.id, r);
  }
  // Overlay local — newer wins, ties go to local
  for (const l of local) {
    const existing = map.get(l.id);
    if (!existing || l.updatedAt >= existing.updatedAt) {
      map.set(l.id, l);
    }
  }
  return Array.from(map.values());
}

export function mergeData(local: SyncData, remote: SyncData): SyncData {
  return {
    companies: mergeArray(local.companies, remote.companies),
    projects: mergeArray(local.projects, remote.projects),
    timeEntries: mergeArray(local.timeEntries, remote.timeEntries),
    invoices: mergeArray(local.invoices, remote.invoices),
    profile: local.profile, // Local profile always wins
  };
}

// --- Conflict detection ---

export async function checkForConflict(spreadsheetId: string): Promise<{
  hasConflict: boolean;
  remoteData: SyncData | null;
}> {
  const localLastSync = getLastSyncTime();
  if (!localLastSync) {
    // First sync or after reconnect — no conflict possible
    return { hasConflict: false, remoteData: null };
  }

  const remoteLastModified = await readRemoteLastModified(spreadsheetId);
  if (!remoteLastModified) {
    // No metadata on remote — legacy spreadsheet, no conflict
    return { hasConflict: false, remoteData: null };
  }

  if (remoteLastModified > localLastSync) {
    // Remote was modified since our last sync — conflict
    const remoteData = await pullFromSheets();
    return { hasConflict: true, remoteData };
  }

  return { hasConflict: false, remoteData: null };
}

export async function syncToSheets(data: SyncData): Promise<string> {
  let spreadsheetId = getSpreadsheetId();

  if (!spreadsheetId) {
    spreadsheetId = await createSpreadsheet();
  } else {
    // Ensure all sheets exist (in case user deleted one)
    await ensureSheets(spreadsheetId);
  }

  // Clear data sheets (not _Metadata — we write that separately)
  for (const name of DATA_SHEET_NAMES) {
    try {
      await gapi.client.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${name}!A:Z`,
      });
    } catch {
      // Sheet might not exist yet, ignore
    }
  }

  // Write all data
  const allData = [
    { range: 'Companies!A1', values: companiesToRows(data.companies) },
    { range: 'Projects!A1', values: projectsToRows(data.projects) },
    { range: 'TimeEntries!A1', values: timeEntriesToRows(data.timeEntries) },
    { range: 'Invoices!A1', values: invoicesToRows(data.invoices) },
    { range: 'Profile!A1', values: profileToRows(data.profile) },
  ];

  await gapi.client.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    resource: {
      valueInputOption: 'RAW',
      data: allData,
    },
  });

  // Write metadata timestamp and record locally
  const now = new Date().toISOString();
  await writeRemoteLastModified(spreadsheetId, now);
  setLastSyncTime(now);

  return spreadsheetId;
}

export function getSpreadsheetUrl(): string | null {
  const id = getSpreadsheetId();
  return id ? `https://docs.google.com/spreadsheets/d/${id}` : null;
}

export async function pullFromSheets(): Promise<SyncData | null> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return null;

  // Encode ranges as repeated query params (batchGet requires this format)
  const rangeParams = DATA_SHEET_NAMES.map((name) => `ranges=${encodeURIComponent(`${name}!A:Z`)}`).join('&');
  const resp = await gapi.client.request({
    path: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangeParams}`,
    method: 'GET',
  });

  const valueRanges: { values?: string[][] }[] = resp.result.valueRanges || [];
  const getRows = (i: number): string[][] => valueRanges[i]?.values || [];

  // Record sync time from remote metadata
  const remoteTs = await readRemoteLastModified(spreadsheetId);
  if (remoteTs) {
    setLastSyncTime(remoteTs);
  }

  return {
    companies: rowsToCompanies(getRows(0)),
    projects: rowsToProjects(getRows(1)),
    timeEntries: rowsToTimeEntries(getRows(2)),
    invoices: rowsToInvoices(getRows(3)),
    profile: rowsToProfile(getRows(4)),
  };
}

export async function findSpreadsheet(): Promise<string | null> {
  const q = encodeURIComponent("name='Consulting Tracker Backup' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
  const resp = await gapi.client.request({
    path: `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${encodeURIComponent('files(id,name)')}&spaces=drive`,
    method: 'GET',
  });

  const files = resp.result.files;
  if (files && files.length > 0) {
    const id = files[0].id;
    setSpreadsheetId(id);
    return id;
  }
  return null;
}
