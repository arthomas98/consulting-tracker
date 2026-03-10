import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useStorage } from './StorageContext';
import { writeAll } from '../utils/storage';
import { initGapi, initGis, requestAccessToken, revokeToken, hasValidToken } from '../services/googleAuth';
import {
  syncToSheets, pullFromSheets, findSpreadsheet,
  getSpreadsheetId, clearSpreadsheetId, getSpreadsheetUrl,
  checkForConflict, mergeData, clearLastSyncTime,
} from '../services/syncManager';

export interface SyncStatus {
  state: 'idle' | 'pushing' | 'pulling' | 'conflict' | 'error';
  isConnected: boolean;
  lastPushAt: Date | null;
  lastError: string | null;
}

interface SyncContextValue {
  syncStatus: SyncStatus;
  triggerPush: () => void;
  forcePush: () => Promise<void>;
  forcePull: () => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  spreadsheetUrl: string | null;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const DEBOUNCE_MS = 2000;
const TOKEN_CHECK_MS = 30000; // Check token expiration every 30 seconds

// Helper to detect auth errors from GAPI responses
function isAuthError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('401') || msg.includes('auth') || msg.includes('invalid credentials') || msg.includes('login required');
  }
  if (typeof err === 'object' && err !== null) {
    const e = err as { status?: number; result?: { error?: { code?: number } } };
    if (e.status === 401 || e.result?.error?.code === 401) return true;
  }
  return false;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const e = err as { result?: { error?: { message?: string } } };
    if (e.result?.error?.message) return e.result.error.message;
  }
  return 'Unknown error';
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'idle',
    isConnected: false,
    lastPushAt: null,
    lastError: null,
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(getSpreadsheetUrl());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Track whether a push is currently in flight to avoid overlapping pushes
  const pushingRef = useRef(false);

  // Use a ref for storage so the push function always reads latest data
  const storageRef = useRef(storage);
  storageRef.current = storage;

  // --- Core push logic ---
  // Only pushes if we already have a valid token. Never triggers auth popup
  // (popups must come from user gestures like clicking Connect/Sync Now).
  const doPush = useCallback(async () => {
    if (pushingRef.current) return;
    if (!getSpreadsheetId()) return;

    if (!hasValidToken()) {
      // Token expired — flag it once so the UI shows a warning
      if (mountedRef.current) {
        setSyncStatus((s) => {
          if (s.isConnected) {
            return { ...s, state: 'error', isConnected: false, lastError: 'Session expired. Reconnect to resume syncing.' };
          }
          return s;
        });
      }
      return;
    }

    pushingRef.current = true;
    setSyncStatus((s) => ({ ...s, state: 'pushing', lastError: null }));

    try {
      const spreadsheetId = getSpreadsheetId();
      if (!spreadsheetId) return;

      const { companies, projects, timeEntries, invoices, expenses, profile } = storageRef.current;

      // Safety: never push empty data over an existing spreadsheet
      if (companies.length === 0 && timeEntries.length === 0) {
        console.log('[Sync] Skipping push — local data is empty');
        if (mountedRef.current) {
          setSyncStatus((s) => ({ ...s, state: 'idle' }));
        }
        return;
      }

      const localData = { companies, projects, timeEntries, invoices, expenses, profile };

      // Check for conflict before pushing
      const { hasConflict, remoteData } = await checkForConflict(spreadsheetId);

      if (hasConflict && remoteData) {
        console.log('[Sync] Conflict detected — merging...');
        if (mountedRef.current) {
          setSyncStatus((s) => ({ ...s, state: 'conflict' }));
        }
        const merged = mergeData(localData, remoteData);
        // Save merged data locally first (safe even if push fails)
        writeAll(merged);
        storageRef.current.refresh();
        // Push merged data to remote
        await syncToSheets(merged);
      } else {
        await syncToSheets(localData);
      }

      if (mountedRef.current) {
        const now = new Date();
        setSyncStatus((s) => ({ ...s, state: 'idle', lastPushAt: now, isConnected: true, lastError: null }));
        setSpreadsheetUrl(getSpreadsheetUrl());
      }
    } catch (err) {
      if (mountedRef.current) {
        if (isAuthError(err)) {
          setSyncStatus((s) => ({ ...s, state: 'error', lastError: 'Session expired. Reconnect to resume syncing.', isConnected: false }));
        } else {
          const msg = getErrorMessage(err);
          setSyncStatus((s) => ({ ...s, state: 'error', lastError: msg }));
        }
      }
    } finally {
      pushingRef.current = false;
    }
  }, []);

  // --- Debounced push ---
  const triggerPush = useCallback(() => {
    if (!getSpreadsheetId()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doPush();
    }, DEBOUNCE_MS);
  }, [doPush]);

  // --- Force push (immediate, re-authenticates if needed) ---
  const forcePush = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Re-authenticate if token is expired (user clicked Sync Now)
    if (!hasValidToken() && getSpreadsheetId()) {
      try {
        setSyncStatus((s) => ({ ...s, state: 'pushing', lastError: null }));
        await requestAccessToken();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Authentication failed';
        setSyncStatus((s) => ({ ...s, state: 'error', lastError: msg }));
        return;
      }
    }

    await doPush();
  }, [doPush]);

  // --- Force pull ---
  const forcePull = useCallback(async () => {
    if (!getSpreadsheetId()) return;

    setSyncStatus((s) => ({ ...s, state: 'pulling', lastError: null }));
    try {
      if (!hasValidToken()) {
        await requestAccessToken();
      }

      const data = await pullFromSheets();
      if (data && mountedRef.current) {
        writeAll(data);
        storageRef.current.refresh();
        setSyncStatus((s) => ({ ...s, state: 'idle', isConnected: true, lastError: null }));
      }
    } catch (err) {
      if (mountedRef.current) {
        if (isAuthError(err)) {
          setSyncStatus((s) => ({ ...s, state: 'error', lastError: 'Session expired. Reconnect to resume syncing.', isConnected: false }));
        } else {
          const msg = getErrorMessage(err);
          setSyncStatus((s) => ({ ...s, state: 'error', lastError: msg }));
        }
      }
    }
  }, []);

  // --- Connect (OAuth + first sync) ---
  const connect = useCallback(async () => {
    setSyncStatus((s) => ({ ...s, state: 'pushing', lastError: null }));
    try {
      await initGapi();
      await initGis();
      await requestAccessToken();
      console.log('[Sync] Auth complete, token valid:', hasValidToken());

      // Check if spreadsheet already exists in Drive
      if (!getSpreadsheetId()) {
        console.log('[Sync] No spreadsheet ID, searching Drive...');
        const found = await findSpreadsheet();
        console.log('[Sync] findSpreadsheet result:', found);
      } else {
        console.log('[Sync] Existing spreadsheet ID:', getSpreadsheetId());
      }

      // If we found a spreadsheet and local data is empty, pull from Sheets
      const { companies, timeEntries } = storageRef.current;
      console.log('[Sync] Local data: companies=%d, timeEntries=%d, spreadsheetId=%s',
        companies.length, timeEntries.length, getSpreadsheetId());

      if (getSpreadsheetId() && companies.length === 0 && timeEntries.length === 0) {
        console.log('[Sync] Local empty, pulling from Sheets...');
        setSyncStatus((s) => ({ ...s, state: 'pulling' }));
        const data = await pullFromSheets();
        console.log('[Sync] Pull result: companies=%d, timeEntries=%d',
          data?.companies.length ?? 0, data?.timeEntries.length ?? 0);
        if (data && mountedRef.current) {
          writeAll(data);
          storageRef.current.refresh();
        }
      } else {
        // Push current local data to Sheets
        console.log('[Sync] Pushing local data to Sheets...');
        const { companies: c, projects, timeEntries: te, invoices, expenses, profile } = storageRef.current;
        await syncToSheets({ companies: c, projects, timeEntries: te, invoices, expenses, profile });
        console.log('[Sync] Push complete');
      }

      if (mountedRef.current) {
        const now = new Date();
        setSyncStatus({ state: 'idle', isConnected: true, lastPushAt: now, lastError: null });
        setSpreadsheetUrl(getSpreadsheetUrl());
      }
    } catch (err) {
      console.error('[Sync] Connect error:', err);
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : 'Connection failed';
        setSyncStatus((s) => ({ ...s, state: 'error', lastError: msg, isConnected: false }));
      }
    }
  }, []);

  // --- Disconnect ---
  const disconnect = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    revokeToken();
    clearSpreadsheetId();
    clearLastSyncTime();
    setSyncStatus({ state: 'idle', isConnected: false, lastPushAt: null, lastError: null });
    setSpreadsheetUrl(null);
  }, []);

  // --- Listen for data changes ---
  useEffect(() => {
    const handler = () => triggerPush();
    window.addEventListener('ct:data-changed', handler);
    return () => window.removeEventListener('ct:data-changed', handler);
  }, [triggerPush]);

  // --- Periodic token expiration check ---
  // Detects when the Google token expires while the user is idle,
  // so the UI updates proactively instead of waiting for a failed push.
  useEffect(() => {
    const interval = setInterval(() => {
      if (getSpreadsheetId() && !hasValidToken()) {
        setSyncStatus((s) => {
          if (s.isConnected) {
            return { ...s, state: 'error', isConnected: false, lastError: 'Session expired. Reconnect to resume syncing.' };
          }
          return s;
        });
      }
    }, TOKEN_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  // --- Startup: eagerly init GAPI/GIS so they're ready when user clicks Connect ---
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await initGapi();
        await initGis();

        // If we have a spreadsheet ID and a valid in-memory token, mark connected
        if (getSpreadsheetId() && hasValidToken() && !cancelled) {
          setSyncStatus((s) => ({ ...s, isConnected: true }));
          setSpreadsheetUrl(getSpreadsheetUrl());
        }
      } catch {
        // GAPI/GIS load failed — will retry when user clicks Connect
      }
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Cleanup (reset on StrictMode remount) ---
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <SyncContext.Provider value={{ syncStatus, triggerPush, forcePush, forcePull, connect, disconnect, spreadsheetUrl }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be inside SyncProvider');
  return ctx;
}
