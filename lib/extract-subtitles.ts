import * as cheerio from 'cheerio';
import { fetchPage } from './fetch-page';
import { vttToSrt } from './vtt-to-srt';
import type { SubtitlesResult } from './types';

const BASE = 'https://svetserialu.to';

interface SubtitleEntry {
  file: string;
  label: string;
  kind: string;
  default?: boolean;
}

export async function extractSubtitles(episodeUrl: string): Promise<SubtitlesResult> {
  const html = await fetchPage(episodeUrl);
  const $ = cheerio.load(html);

  const rawTitle = $('h1.h1episode').text().trim();
  const title = sanitizeFilename(rawTitle) || 'titulky';

  const hasSubtitles = $('.ifsrt.subtitles-active').length > 0;
  if (!hasSubtitles) {
    throw new Error('Tato epizoda nemá dostupné české titulky');
  }

  const apiParams = extractSubtitleApiParams($);
  if (apiParams.length === 0) {
    throw new Error('Nepodařilo se najít zdroje videa');
  }

  for (const params of apiParams) {
    try {
      const subsUrl = `${BASE}/jsonsubs/${params.sourceId}/${params.episodeId}`;
      const srt = await fetchSubtitlesJson(subsUrl);
      if (srt) return { srt, title };
    } catch {
      continue;
    }
  }

  throw new Error('Tato epizoda nemá dostupné české titulky');
}

function extractSubtitleApiParams($: cheerio.CheerioAPI): Array<{ sourceId: string; episodeId: string }> {
  const params: Array<{ sourceId: string; episodeId: string }> = [];
  const seen = new Set<string>();

  $('a.source_link').each((_, el) => {
    const encoded = $(el).attr('data-iframe');
    if (!encoded) return;

    try {
      const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
      const url = new URL(decoded, BASE);
      const sourceId = url.searchParams.get('sourceId');
      const episodeId = url.searchParams.get('episodeId');

      if (sourceId && episodeId) {
        const key = `${sourceId}:${episodeId}`;
        if (!seen.has(key)) {
          seen.add(key);
          params.push({ sourceId, episodeId });
        }
      }
    } catch {
      // skip invalid base64 or URL
    }
  });

  return params;
}

async function fetchSubtitlesJson(subsUrl: string): Promise<string | null> {
  const jsonText = await fetchPage(subsUrl, BASE);
  const entries: SubtitleEntry[] = JSON.parse(jsonText);

  const czEntry = entries.find(
    (e) => e.label.toLowerCase() === 'czsk' || e.label.toLowerCase() === 'cz'
  );
  if (!czEntry) return null;

  const vtt = await fetchPage(czEntry.file, BASE);
  return vttToSrt(vtt);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}
