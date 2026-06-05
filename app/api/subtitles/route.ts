import { NextRequest, NextResponse } from 'next/server';
import { extractSubtitles } from '@/lib/extract-subtitles';

const EPISODE_REGEX = /^https?:\/\/svetserialu\.to\/serial\/[\w-]+\/s\d{2}e\d{2}/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body.url?.trim();

    if (!url || !EPISODE_REGEX.test(url)) {
      return NextResponse.json(
        { error: 'Zadej platný odkaz na epizodu ze svetserialu.to' },
        { status: 400 }
      );
    }

    const { srt, title } = await extractSubtitles(url);

    const headers = new Headers();
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    headers.set(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(title)}.srt"`
    );

    return new NextResponse(srt, { status: 200, headers });
  } catch (err) {
    console.error('Subtitle extraction error:', err);
    const message =
      err instanceof Error ? err.message : 'Nepodařilo se načíst data, zkus to znovu';
    const status = message.includes('platný') ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
