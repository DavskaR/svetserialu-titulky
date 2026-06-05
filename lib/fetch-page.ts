export async function fetchPage(url: string, referer?: string): Promise<string> {
  const isMainSite = url.includes('svetserialu.to');

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'cs-CZ,cs;q=0.9,sk;q=0.8,en;q=0.7',
    Referer: referer || 'https://svetserialu.to/',
  };

  if (isMainSite) {
    headers['Cache-Control'] = 'no-cache';
    headers['Sec-Ch-Ua'] = '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"';
    headers['Sec-Ch-Ua-Mobile'] = '?0';
    headers['Sec-Ch-Ua-Platform'] = '"Windows"';
    headers['Sec-Fetch-Dest'] = 'document';
    headers['Sec-Fetch-Mode'] = 'navigate';
    headers['Sec-Fetch-Site'] = 'none';
    headers['Sec-Fetch-User'] = '?1';
    headers['Upgrade-Insecure-Requests'] = '1';
  }

  const res = await fetch(url, { headers });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return res.text();
}
