import { NextRequest, NextResponse } from 'next/server';
import { readContatos, getAllSpreadsheetIds, FUP_CONFIG, anyFupHasStatus } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

function getStatus(c: any): string {
  if (anyFupHasStatus(c, 'RESPONDIDO')) return 'respondido';
  if (anyFupHasStatus(c, 'BOUNCE') || c.email1Enviado.startsWith('BOUNCE')) return 'bounced';
  if (c.email1Enviado.startsWith('ERRO') || FUP_CONFIG.some(f => (c[f.curField] || '').startsWith('ERRO'))) return 'erro';
  for (let i = FUP_CONFIG.length - 1; i >= 0; i--) {
    const f = FUP_CONFIG[i];
    if ((c[f.curField] || '').startsWith('OK')) return `fup${f.n}_enviado`;
  }
  if (c.email1Enviado.startsWith('OK')) return 'email1_enviado';
  if (!c.email1Enviado) return 'pendente';
  return 'outro';
}

export async function POST(req: NextRequest) {
  try {
    const { exactContacts } = await req.json();

    if (!exactContacts || !Array.isArray(exactContacts)) {
      return NextResponse.json({ error: 'Nenhum contato enviado' }, { status: 400 });
    }

    // Read existing contacts from sheet
    const spreadsheetId = getAllSpreadsheetIds()[0];
    const { contacts: sheetContacts } = await readContatos(spreadsheetId);

    // Build lookup by email (lowercase, trimmed)
    const emailLookup: Record<string, any> = {};
    for (const c of sheetContacts) {
      if (c.email) {
        const key = c.email.toLowerCase().trim();
        if (!emailLookup[key]) {
          emailLookup[key] = {
            status: getStatus(c),
            pipeline: c.pipeline || '',
            email1Enviado: c.email1Enviado,
            fup1Enviado: c.fup1Enviado,
            fup2Enviado: c.fup2Enviado,
            category: c.category,
          };
        }
      }
    }

    // Enrich exact contacts with sheet data
    const enriched = exactContacts.map((ec: any) => {
      const match = ec.email ? emailLookup[ec.email.toLowerCase().trim()] : null;
      return {
        ...ec,
        matched: !!match,
        status: match?.status || 'nao_encontrado',
        pipeline: match?.pipeline || '',
        sheetCategory: match?.category || '',
      };
    });

    const totalMatched = enriched.filter((c: any) => c.matched).length;
    const totalUnmatched = enriched.filter((c: any) => !c.matched).length;

    return NextResponse.json({
      contacts: enriched,
      stats: {
        total: enriched.length,
        matched: totalMatched,
        unmatched: totalUnmatched,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
