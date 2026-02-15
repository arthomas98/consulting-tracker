const CLIENT_ID = '140904375032-lbfq1ro3rptbjfc231mkgbjng0b5fmet.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://sheets.googleapis.com/$discovery/rest?version=v4';

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let gapiInitialized = false;
let gisInitialized = false;

export interface AuthState {
  isSignedIn: boolean;
  accessToken: string | null;
}

function waitForScript(check: () => boolean, timeout = 10000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (check()) { resolve(); return; }
    const start = Date.now();
    const interval = setInterval(() => {
      if (check()) { clearInterval(interval); resolve(); }
      else if (Date.now() - start > timeout) { clearInterval(interval); reject(new Error('Script load timeout')); }
    }, 100);
  });
}

export async function initGapi(): Promise<void> {
  if (gapiInitialized) return;
  await waitForScript(() => typeof gapi !== 'undefined');
  await new Promise<void>((resolve) => gapi.load('client', resolve));
  await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
  gapiInitialized = true;
}

export async function initGis(): Promise<void> {
  if (gisInitialized) return;
  await waitForScript(() => typeof google !== 'undefined' && !!google.accounts);
  gisInitialized = true;
}

// Track the latest pending resolve/reject so concurrent calls work correctly
let pendingResolve: ((token: string) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;

const AUTH_TIMEOUT_MS = 120000; // 2 minutes

export function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    pendingResolve = resolve;
    pendingReject = reject;

    const timer = setTimeout(() => {
      if (pendingReject) {
        pendingReject(new Error('Sign-in timed out. Please try again.'));
        pendingResolve = null;
        pendingReject = null;
      }
    }, AUTH_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      pendingResolve = null;
      pendingReject = null;
    }

    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
          if (response.error) {
            pendingReject?.(new Error(response.error));
          } else {
            pendingResolve?.(response.access_token);
          }
          cleanup();
        },
        error_callback: (error) => {
          if (error.type === 'popup_closed') {
            pendingReject?.(new Error('Sign-in cancelled.'));
          } else if (error.type === 'popup_failed_to_open') {
            pendingReject?.(new Error('Popup blocked. Please allow popups for this site and try again.'));
          } else {
            pendingReject?.(new Error(error.message || `Sign-in error: ${error.type}`));
          }
          cleanup();
        },
      });
    }
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function revokeToken(): void {
  const token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token);
    gapi.client.setToken(null);
  }
}

export function hasValidToken(): boolean {
  const token = gapi.client.getToken();
  return !!token?.access_token;
}
