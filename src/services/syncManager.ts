import type { Company, Project, TimeEntry, Invoice } from '../types';
import type { BusinessProfile } from '../utils/storage';
import {
  companiesToRows, projectsToRows, timeEntriesToRows, invoicesToRows, profileToRows,
  rowsToCompanies, rowsToProjects, rowsToTimeEntries, rowsToInvoices, rowsToProfile,
} from './sheetsDataMapper';

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

export async function pullFromSheets(): Promise<SyncData | null> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) return null;

  // Encode ranges as repeated query params (batchGet requires this format)
  const rangeParams = SHEET_NAMES.map((name) => `ranges=${encodeURIComponent(`${name}!A:Z`)}`).join('&');
  const resp = await gapi.client.request({
    path: `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangeParams}`,
    method: 'GET',
  });

  const valueRanges: { values?: string[][] }[] = resp.result.valueRanges || [];
  const getRows = (i: number): string[][] => valueRanges[i]?.values || [];

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
