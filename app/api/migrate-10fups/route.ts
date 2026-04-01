import { NextResponse } from 'next/server';
import { readPainel, readTemplates, readSheet, writeSheet, appendSheet, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

const DEFAULT_FUP_SUBJECTS = [
  '{{firstName}}, viu meu último email?',
  '{{firstName}}, faz sentido uma conversa rápida?',
  '{{firstName}}, só subindo isso na caixa de entrada.',
  '{{firstName}}, ainda faz sentido conversar sobre isso?',
  '{{firstName}}, me avisa se preferir que eu volte em outro momento.',
  '{{firstName}}, última tentativa por aqui.',
  "{{firstName}}, estou interpretando o silêncio como 'agora não'. Se mudar, estou por aqui.",
  '{{firstName}}, vou parar por aqui. Se fizer sentido no futuro, é só responder esse email.',
];

export async function GET() {
  try {
    const sid = getAllSpreadsheetIds()[0];
    const results: string[] = [];

    // 1. Update Painel headers (add diasFup3-10 in columns L-S)
    try {
      const painelRows = await readSheet('Painel!A1:S1', sid);
      const currentHeaders = painelRows[0] || [];
      if (!currentHeaders[11]) {
        await writeSheet('Painel!L1:S1', [['diasFup3', 'diasFup4', 'diasFup5', 'diasFup6', 'diasFup7', 'diasFup8', 'diasFup9', 'diasFup10']], sid);
        results.push('Painel headers L-S added');
      } else {
        results.push('Painel headers already exist');
      }
    } catch (e: any) {
      results.push('Painel headers error: ' + e.message);
    }

    // 2. Set default diasFup3-10 = 2 for all existing painel rows
    try {
      const painel = await readPainel(sid);
      let updated = 0;
      for (const p of painel) {
        if (!p.diasFup3 || p.diasFup3 === 2) {
          // Check if column L is empty for this row
          const cell = await readSheet(`Painel!L${p.rowIndex}`, sid);
          if (!cell[0]?.[0]) {
            await writeSheet(`Painel!L${p.rowIndex}:S${p.rowIndex}`, [[2, 2, 2, 2, 2, 2, 2, 2]], sid);
            updated++;
          }
        }
      }
      results.push(`Painel diasFup3-10 set for ${updated} rows`);
    } catch (e: any) {
      results.push('Painel diasFup error: ' + e.message);
    }

    // 3. Update Templates headers (add fup3Assunto-fup10Corpo in columns H-W)
    try {
      const tmplRows = await readSheet('Templates!A1:W1', sid);
      const currentHeaders = tmplRows[0] || [];
      if (!currentHeaders[7]) {
        await writeSheet('Templates!H1:W1', [[
          'fup3Assunto', 'fup3Corpo', 'fup4Assunto', 'fup4Corpo',
          'fup5Assunto', 'fup5Corpo', 'fup6Assunto', 'fup6Corpo',
          'fup7Assunto', 'fup7Corpo', 'fup8Assunto', 'fup8Corpo',
          'fup9Assunto', 'fup9Corpo', 'fup10Assunto', 'fup10Corpo',
        ]], sid);
        results.push('Templates headers H-W added');
      } else {
        results.push('Templates headers already exist');
      }
    } catch (e: any) {
      results.push('Templates headers error: ' + e.message);
    }

    // 4. Populate FUP3-10 for existing templates that don't have them
    try {
      const templates = await readTemplates(sid);
      let updated = 0;
      for (let i = 0; i < templates.length; i++) {
        const t = templates[i];
        if (!t.fup3Assunto) {
          const row = i + 2;
          const fupData: string[] = [];
          for (const subj of DEFAULT_FUP_SUBJECTS) {
            fupData.push(subj); // assunto
            fupData.push(subj); // corpo (same as subject for short FUPs)
          }
          await writeSheet(`Templates!H${row}:W${row}`, [fupData], sid);
          updated++;
        }
      }
      results.push(`Templates FUP3-10 populated for ${updated} rows`);
    } catch (e: any) {
      results.push('Templates FUP3-10 error: ' + e.message);
    }

    // 5. Update Contatos headers (add fup3Enviado-fup10Enviado in columns O-V)
    try {
      const contatosRows = await readSheet('Contatos!A1:V1', sid);
      const currentHeaders = contatosRows[0] || [];
      if (!currentHeaders[14]) {
        await writeSheet('Contatos!O1:V1', [[
          'fup3Enviado', 'fup4Enviado', 'fup5Enviado', 'fup6Enviado',
          'fup7Enviado', 'fup8Enviado', 'fup9Enviado', 'fup10Enviado',
        ]], sid);
        results.push('Contatos headers O-V added');
      } else {
        results.push('Contatos headers already exist');
      }
    } catch (e: any) {
      results.push('Contatos headers error: ' + e.message);
    }

    return NextResponse.json({ ok: true, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
