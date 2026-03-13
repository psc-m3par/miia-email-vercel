import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/tokens';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { senderEmail, spreadsheetId, contactEmail, contactName, dateTime, durationMin = 30 } = await req.json();
    if (!senderEmail || !dateTime) {
      return NextResponse.json({ error: 'senderEmail e dateTime são obrigatórios' }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(senderEmail, spreadsheetId);
    if (!accessToken) {
      return NextResponse.json({ error: 'Token não encontrado. Reconecte o Gmail.' }, { status: 401 });
    }

    const start = new Date(dateTime);
    const end = new Date(start.getTime() + durationMin * 60000);

    const eventBody: any = {
      summary: contactName ? `Reunião com ${contactName}` : 'Reunião MIIA',
      start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
      end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
      conferenceData: {
        createRequest: {
          requestId: `miia-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    if (contactEmail) {
      eventBody.attendees = [{ email: contactEmail }];
    }

    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.error?.message || 'Calendar API error ' + res.status }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({
      ok: true,
      meetLink: data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri || '',
      eventLink: data.htmlLink || '',
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
