import { NextResponse } from 'next/server';
import { getDashboardStats, readConfig, writeConfig, getAllSpreadsheetIds } from '@/lib/sheets';
import { sendEmail } from '@/lib/gmail';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const horaAtual = parseInt(
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })
  );
  const hojeStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

  const spreadsheetId = getAllSpreadsheetIds()[0];
  const config = await readConfig(spreadsheetId);

  const horaRelatorio = parseInt(config.hora_relatorio || '-1');
  const emailRelatorio = config.email_relatorio || '';
  const ultimoRelatorio = config.ultimo_relatorio || '';

  if (horaRelatorio < 0) return NextResponse.json({ ok: false, reason: 'nao configurado' });
  if (horaAtual !== horaRelatorio) return NextResponse.json({ ok: false, reason: 'fora do horario' });
  if (ultimoRelatorio === hojeStr) return NextResponse.json({ ok: false, reason: 'ja enviado hoje' });
  if (!emailRelatorio) return NextResponse.json({ ok: false, reason: 'email nao configurado' });

  const { stats, totalGeral, painel } = await getDashboardStats();
  const senderEmail = painel[0]?.responsavel;
  if (!senderEmail) return NextResponse.json({ ok: false, reason: 'nenhum responsavel' });

  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  });

  const catRows = Object.entries(stats).map(([cat, s]: [string, any]) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-weight:500;color:#1e293b">${cat}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#2563eb">${s.hojeEmail1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#4f46e5">${s.hojeFup1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#7c3aed">${s.hojeFup2}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#16a34a;font-weight:bold">${s.respondidos}</td>
    </tr>`).join('');

  const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:24px">
  <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:28px 32px;border-radius:16px 16px 0 0">
    <h1 style="color:white;margin:0;font-size:22px;font-weight:700">MIIA — Relatório do Dia</h1>
    <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px">${dataFormatada}</p>
  </div>
  <div style="background:white;padding:28px 32px;border:1px solid #e2e8f0;border-top:none">
    <div style="display:flex;gap:12px;margin-bottom:28px">
      <div style="flex:1;background:#eff6ff;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#2563eb">${totalGeral.hojeEmail1}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em">Emails 1</div>
      </div>
      <div style="flex:1;background:#eef2ff;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#4f46e5">${totalGeral.hojeFup1 + totalGeral.hojeFup2}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em">FUPs</div>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:32px;font-weight:700;color:#16a34a">${totalGeral.respondidos}</div>
        <div style="font-size:11px;color:#64748b;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em">Respondidos</div>
      </div>
    </div>
    <h2 style="font-size:13px;font-weight:600;color:#64748b;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.05em">Atividade de Hoje por Categoria</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fafafa;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f1f5f9">
          <th style="padding:10px 12px;text-align:left;color:#475569;font-weight:600">Categoria</th>
          <th style="padding:10px 12px;text-align:center;color:#2563eb;font-weight:600">Email 1</th>
          <th style="padding:10px 12px;text-align:center;color:#4f46e5;font-weight:600">FUP1</th>
          <th style="padding:10px 12px;text-align:center;color:#7c3aed;font-weight:600">FUP2</th>
          <th style="padding:10px 12px;text-align:center;color:#16a34a;font-weight:600">Respondidos</th>
        </tr>
      </thead>
      <tbody>${catRows}</tbody>
    </table>
  </div>
  <div style="background:#f1f5f9;padding:14px 32px;border-radius:0 0 16px 16px;border:1px solid #e2e8f0;border-top:none">
    <p style="color:#94a3b8;font-size:11px;margin:0">MIIA Email Automation &bull; Relatório automático gerado às ${horaAtual}h</p>
  </div>
</div>`;

  const result = await sendEmail(
    senderEmail, emailRelatorio,
    `MIIA — Relatório do dia ${dataFormatada}`,
    htmlBody, undefined, spreadsheetId, 'MIIA'
  );

  if (result.success) {
    await writeConfig('ultimo_relatorio', hojeStr, spreadsheetId);
    return NextResponse.json({ ok: true, enviado: true });
  }

  return NextResponse.json({ ok: false, error: result.error });
}
