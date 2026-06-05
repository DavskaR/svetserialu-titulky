import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'cs,en;q=0.9,sk;q=0.8',
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `HTTP ${res.status}` }, { status: res.status });
    }

    const body = await res.text();
    return NextResponse.json({ body });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Fetch failed' },
      { status: 502 }
    );
  }
}
