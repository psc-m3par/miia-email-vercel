import { NextResponse } from 'next/server';
import { readPainel, readTemplates, readTeses, appendSheet, getAllSpreadsheetIds } from '@/lib/sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sid = getAllSpreadsheetIds()[0];

    const [painel, templates, teses] = await Promise.all([
      readPainel(sid),
      readTemplates(sid),
      readTeses(sid),
    ]);

    const tmplCats = new Set(templates.map(t => t.category.trim().toLowerCase()));
    const missing = painel.filter(p => !tmplCats.has(p.category.trim().toLowerCase()));

    if (missing.length === 0) {
      return NextResponse.json({ message: 'Todas as categorias já têm template', fixed: 0 });
    }

    const results: { category: string; status: string; template?: string }[] = [];

    for (const p of missing) {
      const tese = teses.find(t =>
        t.categoria?.trim().toLowerCase() === p.category.trim().toLowerCase() && t.status === 'APROVADA'
      );
      const corpo = tese?.template || tese?.tese || `Proposta para {{firstName}} - ${p.category}`;

      try {
        await appendSheet('Templates!A:W', [[
          p.category,
          `Proposta para {{firstName}}`,
          corpo,
          `Re: Proposta para {{firstName}}`,
          `Olá {{firstName}}, gostaria de retomar nosso contato.`,
          `Re: Proposta para {{firstName}}`,
          `{{firstName}}, esta é nossa última tentativa de contato.`,
          `{{firstName}}, viu meu último email?`,
          `{{firstName}}, viu meu último email?`,
          `{{firstName}}, faz sentido uma conversa rápida?`,
          `{{firstName}}, faz sentido uma conversa rápida?`,
          `{{firstName}}, só subindo isso na caixa de entrada.`,
          `{{firstName}}, só subindo isso na caixa de entrada.`,
          `{{firstName}}, ainda faz sentido conversar sobre isso?`,
          `{{firstName}}, ainda faz sentido conversar sobre isso?`,
          `{{firstName}}, me avisa se preferir que eu volte em outro momento.`,
          `{{firstName}}, me avisa se preferir que eu volte em outro momento.`,
          `{{firstName}}, última tentativa por aqui.`,
          `{{firstName}}, última tentativa por aqui.`,
          `{{firstName}}, estou interpretando o silêncio como 'agora não'. Se mudar, estou por aqui.`,
          `{{firstName}}, estou interpretando o silêncio como 'agora não'. Se mudar, estou por aqui.`,
          `{{firstName}}, vou parar por aqui. Se fizer sentido no futuro, é só responder esse email.`,
          `{{firstName}}, vou parar por aqui. Se fizer sentido no futuro, é só responder esse email.`,
        ]], sid);
        results.push({ category: p.category, status: 'created', template: corpo.slice(0, 100) + '...' });
      } catch (e: any) {
        results.push({ category: p.category, status: 'error: ' + e.message });
      }
    }

    return NextResponse.json({
      message: `Fixed ${results.filter(r => r.status === 'created').length}/${missing.length} missing templates`,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
