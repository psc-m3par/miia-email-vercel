import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { readContatos, getAllSpreadsheetIds, appendLog } from '@/lib/sheets';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

async function getSheetId(sheetName: string, spreadsheetId: string): Promise<number | null> {
  const sheets = getSheets();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets?.find(
    (s: any) => s.properties?.title === sheetName
  );
  return sheet?.properties?.sheetId ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const category = body.category as string;

    if (!category) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    const allIds = getAllSpreadsheetIds();
    let totalRemoved = 0;

    for (const spreadsheetId of allIds) {
      const { contacts } = await readContatos(spreadsheetId);

      // Filter contacts by the specified category
      const catContacts = contacts.filter(
        c => c.category.normalize('NFC').toLowerCase() === category.normalize('NFC').toLowerCase()
      );

      // Group by email (lowercased)
      const emailGroups = new Map<string, typeof catContacts>();
      for (const contact of catContacts) {
        const emailKey = contact.email.trim().toLowerCase();
        if (!emailKey) continue;
        const group = emailGroups.get(emailKey) || [];
        group.push(contact);
        emailGroups.set(emailKey, group);
      }

      // For each duplicate group, decide which rows to delete
      const rowsToDelete: number[] = [];

      const emailKeys = Array.from(emailGroups.keys());
      for (const key of emailKeys) {
        const group = emailGroups.get(key)!;
        if (group.length <= 1) continue; // no duplicates

        // Keep the one that has email1Enviado with a status (non-empty).
        // If multiple have status, keep the first one found with status.
        // If none have status, keep the first one.
        const withStatus = group.filter(c => c.email1Enviado && c.email1Enviado.trim() !== '');
        const withoutStatus = group.filter(c => !c.email1Enviado || c.email1Enviado.trim() === '');

        let toKeep: typeof group[0];
        let toRemove: typeof group;

        if (withStatus.length > 0) {
          // Keep the first one with status, delete the rest
          toKeep = withStatus[0];
          toRemove = group.filter(c => c.rowIndex !== toKeep.rowIndex);
        } else {
          // None have status, keep the first one
          toKeep = group[0];
          toRemove = group.slice(1);
        }

        for (const c of toRemove) {
          // rowIndex from readContatos is the 1-based spreadsheet row number
          // For deleteDimension, we need 0-based index, so subtract 1
          rowsToDelete.push(c.rowIndex - 1);
        }
      }

      if (rowsToDelete.length === 0) continue;

      // Sort descending so we delete from bottom to top (avoids index shifting)
      rowsToDelete.sort((a, b) => b - a);

      const sheetId = await getSheetId('Contatos', spreadsheetId);
      if (sheetId === null) continue;

      const requests = rowsToDelete.map(rowIndex => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS' as const,
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }));

      const sheets = getSheets();
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });

      totalRemoved += rowsToDelete.length;

      await appendLog('dedup', category, rowsToDelete.length, 'ok', `Removed ${rowsToDelete.length} duplicate contacts`, spreadsheetId);
    }

    return NextResponse.json({ removed: totalRemoved, category });
  } catch (error: any) {
    console.error('Dedup error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
