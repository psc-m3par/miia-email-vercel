import { NextResponse } from 'next/server';
import { readSheet, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const allIds = getAllSpreadsheetIds();
    const seen = new Set<string>();
    const accounts: { email: string; status: 'ativo' | 'expirado'; expiry: string }[] = [];

    for (const id of allIds) {
      try {
        const rows = await readSheet('Tokens!A:D', id);
        if (rows.length < 2) continue;
        for (let i = 1; i < rows.length; i++) {
          const email = (rows[i][0] || '').trim();
          const refreshToken = rows[i][2] || '';
          const expiry = rows[i][3] || '';
          if (!email || seen.has(email.toLowerCase())) continue;
          seen.add(email.toLowerCase());
          // Has refresh token = always ativo (can renew). No refresh = check expiry.
          const ativo = !!refreshToken || (!!expiry && new Date(expiry) > new Date());
          // Derive display name from email (e.g. "psc@miia.tech" -> "psc")
          const name = email.split('@')[0] || email;
          accounts.push({ email, name, status: ativo ? 'ativo' : 'expirado', expiry });
        }
      } catch {}
    }

    return NextResponse.json(accounts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
