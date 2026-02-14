/* eslint-disable @typescript-eslint/no-explicit-any */
declare namespace google.accounts.oauth2 {
  interface TokenClient {
    requestAccessToken(config?: { prompt?: string }): void;
  }
  interface TokenResponse {
    access_token: string;
    error?: string;
  }
  function initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
  }): TokenClient;
  function revoke(token: string): void;
}

declare namespace gapi {
  function load(api: string, callback: () => void): void;
  namespace client {
    function init(config: { discoveryDocs: string[] }): Promise<void>;
    function getToken(): { access_token: string } | null;
    function setToken(token: null): void;
    namespace sheets.spreadsheets {
      function create(params: { resource: any }): Promise<{ result: { spreadsheetId: string } }>;
      namespace values {
        function batchUpdate(params: {
          spreadsheetId: string;
          resource: any;
        }): Promise<any>;
        function clear(params: {
          spreadsheetId: string;
          range: string;
        }): Promise<any>;
      }
    }
    function request(params: { path: string; method: string; body?: any }): Promise<any>;
  }
}
