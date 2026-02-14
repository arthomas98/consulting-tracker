import type { Company, Project, TimeEntry, Invoice } from '../types';
import type { BusinessProfile } from '../utils/storage';
import { companiesToRows, projectsToRows, timeEntriesToRows, invoicesToRows, profileToRows } from './sheetsDataMapper';

const SPREADSHEET_ID_KEY = 'ct_sheets_spreadsheetId';
const SHEET_NAMES = ['Companies', 'Projects', 'TimeEntries', 'Invoices', 'Profile'];

export function getSpreadsheetId(): string | null {
  return localStorage.getItem(SPREADSHEET_ID_KEY);
}

export function setSpreadsheetId(id: string): void {
  localStorage.setItem(SPREADSHEET_ID_KEY, id);
}

export function clearSpreadsheetId(): void {
  localStorage.removeItem(SPREADSHEET_ID_KEY);
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

export async function syncToSheets(data: SyncData): Promise<string> {
  let spreadsheetId = getSpreadsheetId();

  if (!spreadsheetId) {
    spreadsheetId = await createSpreadsheet();
  } else {
    // Ensure all sheets exist (in case user deleted one)
    await ensureSheets(spreadsheetId);
  }

  // Clear all sheets
  for (const name of SHEET_NAMES) {
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

  return spreadsheetId;
}

export function getSpreadsheetUrl(): string | null {
  const id = getSpreadsheetId();
  return id ? `https://docs.google.com/spreadsheets/d/${id}` : null;
}
