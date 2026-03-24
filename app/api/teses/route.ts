import { NextRequest, NextResponse } from 'next/server';
import { readTeses, appendTese, updateTese, getAllSpreadsheetIds, appendSheet, writeSheet } from '@/lib/sheets';
import { sendEmail } from '@/lib/gmail';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sid = getAllSpreadsheetIds()[0];
    const teses = await readTeses(sid);
    return NextResponse.json(teses);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sid = getAllSpreadsheetIds()[0];

    const { tese, template, potenciaisClientes, nomeRemetente, aprovador, criadoPor, categoria } = body;
    if (!tese) return NextResponse.json({ error: 'Tese é obrigatória' }, { status: 400 });
    if (!categoria) return NextResponse.json({ error: 'Categoria é obrigatória' }, { status: 400 });

    const id = await appendTese(
      {
        tese,
        template: template || '',
        potenciaisClientes: potenciaisClientes || '',
        status: 'NOVA',
        criadoPor: criadoPor || '',
        nomeRemetente: nomeRemetente || '',
        aprovador: aprovador || '',
        threadId: '',
        comentarios: [],
        dataCriacao: new Date().toISOString(),
        categoria,
      },
      sid
    );

    return NextResponse.json({ ok: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const sid = getAllSpreadsheetIds()[0];
    const { rowIndex, action, ...rest } = body;

    if (!rowIndex) return NextResponse.json({ error: 'rowIndex é obrigatório' }, { status: 400 });

    // Load current tese to get existing data
    const teses = await readTeses(sid);
    const tese = teses.find(t => t.rowIndex === rowIndex);
    if (!tese) return NextResponse.json({ error: 'Tese não encontrada' }, { status: 404 });

    if (action === 'enviar-aprovacao') {
      // Move to APROVACAO and send email to approver
      const { aprovador, senderEmail } = rest;
      if (!aprovador) return NextResponse.json({ error: 'Aprovador é obrigatório' }, { status: 400 });
      if (!senderEmail) return NextResponse.json({ error: 'senderEmail é obrigatório' }, { status: 400 });

      const subject = `[MIIA] Nova Tese para Aprovação: ${tese.tese.slice(0, 60)}${tese.tese.length > 60 ? '...' : ''}`;
      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #2563eb;">Nova Tese para Aprovação</h2>
          <p>Uma nova tese foi submetida para sua aprovação:</p>

          <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 8px; color: #1e293b;">Tese</h3>
            <p style="margin: 0; color: #475569; white-space: pre-wrap;">${tese.tese}</p>
          </div>

          ${tese.template ? `
          <div style="background: #f8fafc; border-left: 4px solid #7c3aed; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 8px; color: #1e293b;">Template sugerido</h3>
            <p style="margin: 0; color: #475569; white-space: pre-wrap;">${tese.template}</p>
          </div>
          ` : ''}

          ${tese.potenciaisClientes ? `
          <div style="background: #f8fafc; border-left: 4px solid #059669; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 8px; color: #1e293b;">Potenciais clientes</h3>
            <p style="margin: 0; color: #475569; white-space: pre-wrap;">${tese.potenciaisClientes}</p>
          </div>
          ` : ''}

          <p style="color: #64748b; font-size: 14px;">Criado por: ${tese.criadoPor || 'Equipe MIIA'}</p>
          <p style="color: #94a3b8; font-size: 12px;">Para aprovar ou adicionar comentários, acesse o painel MIIA.</p>
        </div>
      `;

      const emailResult = await sendEmail(senderEmail, aprovador, subject, htmlBody, undefined, sid, tese.nomeRemetente || 'MIIA');

      await updateTese(rowIndex, {
        status: 'APROVACAO',
        aprovador,
        threadId: emailResult.threadId || '',
        senderEmail: senderEmail,
      }, sid);

      return NextResponse.json({ ok: true, threadId: emailResult.threadId, emailSent: emailResult.success });
    }

    if (action === 'aprovar') {
      // Move to APROVADA and create category + template in sheets
      const categoria = rest.categoria || tese.categoria;
      if (!categoria) return NextResponse.json({ error: 'Categoria é obrigatória' }, { status: 400 });

      // Create category in Painel sheet
      // Columns: category, responsavel, nomeRemetente, emailsHora, diasFup1, diasFup2, ativo, cc, ultimoEnvio, horaInicio, horaFim
      await appendSheet('Painel!A:K', [[
        categoria,
        tese.criadoPor || '',
        tese.nomeRemetente || '',
        20,
        3,
        7,
        'FALSE',
        '',
        '',
        8,
        21,
      ]], sid);

      // Create template in Templates sheet
      // Columns: category, assunto, corpo, fup1Assunto, fup1Corpo, fup2Assunto, fup2Corpo
      await appendSheet('Templates!A:G', [[
        categoria,
        `Proposta para {{firstName}}`,
        tese.template || tese.tese,
        `Re: Proposta para {{firstName}}`,
        `Olá {{firstName}}, gostaria de retomar nosso contato.`,
        `Re: Proposta para {{firstName}}`,
        `{{firstName}}, esta é nossa última tentativa de contato.`,
      ]], sid);

      await updateTese(rowIndex, {
        status: 'APROVADA',
        categoria,
      }, sid);

      return NextResponse.json({ ok: true });
    }

    if (action === 'comentar') {
      const { autor, texto } = rest;
      if (!texto) return NextResponse.json({ error: 'Texto do comentário é obrigatório' }, { status: 400 });

      const novoComentario = {
        autor: autor || 'Desconhecido',
        texto,
        timestamp: new Date().toISOString(),
      };
      const comentarios = [...(tese.comentarios || []), novoComentario];

      await updateTese(rowIndex, { comentarios }, sid);
      return NextResponse.json({ ok: true, comentario: novoComentario });
    }

    if (action === 'reenviar') {
      // Go back to APROVACAO from AJUSTE/APROVADA (re-send for approval with updated template)
      const { senderEmail, aprovador, template: newTemplate } = rest;
      const targetAprovador = aprovador || tese.aprovador;
      if (!senderEmail || !targetAprovador) {
        return NextResponse.json({ error: 'senderEmail e aprovador são obrigatórios' }, { status: 400 });
      }

      // Update template if provided
      const updatedTemplate = newTemplate !== undefined ? newTemplate : tese.template;

      const subject = `[MIIA] Tese Atualizada para Revisão: ${tese.tese.slice(0, 50)}${tese.tese.length > 50 ? '...' : ''}`;
      const ultimosComentarios = (tese.comentarios || []).slice(-3).map(c =>
        `<li><strong>${c.autor}</strong> (${new Date(c.timestamp).toLocaleDateString('pt-BR')}): ${c.texto}</li>`
      ).join('');

      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #2563eb;">Tese Atualizada para Revisão</h2>
          <p>A tese foi atualizada com base nos comentários recebidos:</p>
          <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 8px; color: #1e293b;">Tese</h3>
            <p style="margin: 0; color: #475569; white-space: pre-wrap;">${tese.tese}</p>
          </div>
          ${updatedTemplate ? `
          <div style="background: #f8fafc; border-left: 4px solid #7c3aed; padding: 16px; margin: 16px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 8px; color: #1e293b;">Template atualizado</h3>
            <p style="margin: 0; color: #475569; white-space: pre-wrap;">${updatedTemplate}</p>
          </div>
          ` : ''}
          ${ultimosComentarios ? `<div style="margin: 16px 0;"><h3>Últimos comentários:</h3><ul>${ultimosComentarios}</ul></div>` : ''}
          <p style="color: #94a3b8; font-size: 12px;">Acesse o painel MIIA para aprovar ou comentar.</p>
        </div>
      `;

      const emailResult = await sendEmail(senderEmail, targetAprovador, subject, htmlBody, undefined, sid, tese.nomeRemetente || 'MIIA');

      const updateFields: Record<string, any> = {
        status: 'APROVACAO',
        aprovador: targetAprovador,
        threadId: emailResult.threadId || tese.threadId,
        senderEmail: senderEmail,
      };
      if (newTemplate !== undefined) {
        updateFields.template = newTemplate;
      }

      await updateTese(rowIndex, updateFields, sid);

      return NextResponse.json({ ok: true, emailSent: emailResult.success });
    }

    // Generic field update
    const { tese: teseText, template, potenciaisClientes, status, nomeRemetente, aprovador, threadId, categoria } = rest;
    const fieldsToUpdate: Record<string, any> = {};
    if (teseText !== undefined) fieldsToUpdate.tese = teseText;
    if (template !== undefined) fieldsToUpdate.template = template;
    if (potenciaisClientes !== undefined) fieldsToUpdate.potenciaisClientes = potenciaisClientes;
    if (status !== undefined) fieldsToUpdate.status = status;
    if (nomeRemetente !== undefined) fieldsToUpdate.nomeRemetente = nomeRemetente;
    if (aprovador !== undefined) fieldsToUpdate.aprovador = aprovador;
    if (threadId !== undefined) fieldsToUpdate.threadId = threadId;
    if (categoria !== undefined) fieldsToUpdate.categoria = categoria;

    if (Object.keys(fieldsToUpdate).length > 0) {
      await updateTese(rowIndex, fieldsToUpdate, sid);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rowIndex = parseInt(searchParams.get('rowIndex') || '');
    if (!rowIndex) return NextResponse.json({ error: 'rowIndex é obrigatório' }, { status: 400 });
    const sid = getAllSpreadsheetIds()[0];
    await writeSheet(`Teses!A${rowIndex}:L${rowIndex}`, [['', '', '', '', '', '', '', '', '', '', '', '']], sid);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
