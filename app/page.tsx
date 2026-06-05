'use client';

import { useState, FormEvent } from 'react';
import styles from './page.module.css';

function vttToSrt(vtt: string): string {
  const normalized = vtt.replace(/\r\n/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);
  const cues: Array<{ timing: string; text: string }> = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx === -1) continue;

    const timing = lines[timeIdx];
    const textLines = lines
      .slice(timeIdx + 1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (textLines.length === 0) continue;

    cues.push({ timing: timing.replace(/\.(\d{3})/g, ',$1'), text: textLines.join('\n') });
  }

  if (cues.length === 0) return '';
  return cues.map((c, i) => `${i + 1}\n${c.timing}\n${c.text}`).join('\n\n') + '\n';
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}

function decodeBase64(str: string): string {
  try { return atob(str); } catch { return ''; }
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus('');

    if (!url.trim()) {
      setError('Zadej odkaz na epizodu');
      return;
    }

    setLoading(true);

    try {
      setStatus('Stahuji stránku epizody...');
      const html = await fetchPage(url.trim());
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const titleEl = doc.querySelector('h1.h1episode');
      const title = sanitizeFilename(titleEl?.textContent?.trim() || '') || 'titulky';

      const hasSubtitles = doc.querySelector('.ifsrt.subtitles-active');
      if (!hasSubtitles) {
        throw new Error('Tato epizoda nemá dostupné české titulky');
      }

      const sourceLinks = doc.querySelectorAll('a.source_link');
      const apiParams: Array<{ sourceId: string; episodeId: string }> = [];
      const seen = new Set<string>();

      for (const link of sourceLinks) {
        const encoded = link.getAttribute('data-iframe');
        if (!encoded) continue;

        const decoded = decodeBase64(encoded);
        const match = decoded.match(/sourceId=(\d+)&episodeId=(\d+)/);
        if (match) {
          const key = `${match[1]}:${match[2]}`;
          if (!seen.has(key)) {
            seen.add(key);
            apiParams.push({ sourceId: match[1], episodeId: match[2] });
          }
        }
      }

      if (apiParams.length === 0) {
        throw new Error('Nepodařilo se najít zdroje titulků');
      }

      setStatus('Hledám české titulky...');
      let srt: string | null = null;

      for (const params of apiParams) {
        const subsUrl = `https://svetserialu.to/jsonsubs/${params.sourceId}/${params.episodeId}`;
        try {
          const jsonText = await fetchPage(subsUrl);
          const subs = JSON.parse(jsonText);

          const cz = subs.find(
            (s: { label: string; file: string }) =>
              s.label.toLowerCase() === 'czsk' || s.label.toLowerCase() === 'cz'
          );
          if (cz?.file) {
            setStatus('Stahuji a převádím titulky...');
            const vtt = await fetchPage(cz.file);
            srt = vttToSrt(vtt);
            break;
          }
        } catch {
          continue;
        }
      }

      if (!srt) {
        throw new Error('Tato epizoda nemá dostupné české titulky');
      }

      const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${title}.srt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setStatus(`Staženo: ${title}.srt`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se načíst data, zkus to znovu');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.logo}>SvetSerialu Titulky</h1>
      <p className={styles.subtitle}>Stáhni české titulky jako .srt</p>

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://svetserialu.to/serial/nazev/s01e01"
          className={styles.input}
        />
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? 'Stahuji...' : 'Stáhnout titulky'}
        </button>
      </form>

      <p className={styles.hint}>Vlož odkaz na epizodu a stiskni tlačítko</p>

      {status && !error && <div className={styles.success}>{status}</div>}
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url);
    if (res.ok) return res.text();
    if (res.status === 429 && i < maxRetries - 1) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    throw new Error(`HTTP ${res.status}`);
  }
  throw new Error('Max retries reached');
}

async function fetchPage(url: string): Promise<string> {
  const sources = [
    async () => {
      const res = await fetchWithRetry('https://cors.eu.org/' + url);
      return res;
    },
    async () => {
      const res = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    async () => {
      const res = await fetch('https://corsproxy.io/?' + encodeURIComponent(url));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    async () => {
      const res = await fetch('https://webcache.googleusercontent.com/search?q=cache:' + encodeURIComponent(url));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    },
    async () => {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.body || (await res.text());
    },
  ];

  const errors: string[] = [];
  for (const source of sources) {
    try {
      return await source();
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  throw new Error('Nepodařilo se načíst stránku. Zkus to prosím znovu.');
}
