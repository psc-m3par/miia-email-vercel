import { readSheet, writeSheet, appendSheet } from './sheets';

const TOKENS_RANGE = 'Tokens!A:D';

interface TokenData {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiry: string;
}

const tokenCache: Record<string, { token: string | null; timestamp: number }> = {};

export async function getToken(email: string, spreadsheetId?: string): Promise<TokenData | null> {
  try {
    const rows = await readSheet(TOKENS_RANGE, spreadsheetId);
    if (rows.length < 2) return null;
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0] || '').toLowerCase().trim() === email.toLowerCase().trim()) {
        return {
          email: rows[i][0],
          accessToken: rows[i][1] || '',
          refreshToken: rows[i][2] || '',
          expiry: rows[i][3] || '',
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveToken(data: TokenData, spreadsheetId?: string): Promise<void> {
  const rows = await readSheet(TOKENS_RANGE, spreadsheetId).catch(() => []);
  let found = false;

  for (let i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toLowerCase().trim() === data.email.toLowerCase().trim()) {
      const rowIndex = i + 1;
      await writeSheet('Tokens!A' + rowIndex + ':D' + rowIndex, [[data.email, data.accessToken, data.refreshToken, data.expiry]], spreadsheetId);
      found = true;
      break;
    }
  }

  if (!found) {
    if (rows.length === 0) {
      await writeSheet('Tokens!A1:D1', [['EMAIL', 'ACCESS_TOKEN', 'REFRESH_TOKEN', 'EXPIRY']], spreadsheetId);
    }
    await appendSheet('Tokens!A:D', [[data.email, data.accessToken, data.refreshToken, data.expiry]], spreadsheetId);
  }
}

export async function refreshAccessToken(email: string, spreadsheetId?: string): Promise<string | null> {
  const cacheKey = email.toLowerCase().trim();
  const cached = tokenCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < 300000) {
    return cached.token;
  }

  const token = await getToken(email, spreadsheetId);
  if (!token || !token.refreshToken) {
    console.error('No refresh token for ' + email);
    tokenCache[cacheKey] = { token: null, timestamp: Date.now() };
    return null;
  }

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await res.json();

    if (data.access_token) {
      const expiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
      await saveToken({ ...token, accessToken: data.access_token, expiry }, spreadsheetId);
      tokenCache[cacheKey] = { token: data.access_token, timestamp: Date.now() };
      return data.access_token;
    }

    console.error('Refresh failed for ' + email + ': ' + JSON.stringify(data));
    tokenCache[cacheKey] = { token: null, timestamp: Date.now() };
    return null;
  } catch (err) {
    console.error('Refresh error for ' + email + ': ' + err);
    tokenCache[cacheKey] = { token: null, timestamp: Date.now() };
    return null;
  }
}

export async function getValidAccessToken(email: string, spreadsheetId?: string): Promise<string | null> {
  const cacheKey = email.toLowerCase().trim();
  const cached = tokenCache[cacheKey];
  if (cached && cached.token && Date.now() - cached.timestamp < 300000) {
    return cached.token;
  }

  const token = await getToken(email, spreadsheetId);
  if (!token) return null;

  const expiry = new Date(token.expiry);
  if (expiry > new Date(Date.now() + 60000)) {
    tokenCache[cacheKey] = { token: token.accessToken, timestamp: Date.now() };
    return token.accessToken;
  }

  return refreshAccessToken(email, spreadsheetId);
}
