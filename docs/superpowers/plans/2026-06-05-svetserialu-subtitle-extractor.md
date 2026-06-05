# SvetSerialu Subtitle Extractor - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js web app on Vercel that accepts a svetserialu.to episode URL, extracts Czech subtitles, and downloads them as .srt file.

**Architecture:** Single-page app with one API route. Frontend submits URL → API scrapes svetserialu.to page, follows video source endpoints to find .vtt subtitle URLs, downloads and converts VTT to SRT, returns file download.

**Tech Stack:** Next.js 14 (App Router), cheerio (HTML parsing), serverless on Vercel.

---

### File Map

| Path | Purpose |
|------|---------|
| `package.json` | Project config, dependencies |
| `tsconfig.json` | TypeScript config |
| `next.config.js` | Next.js config (server external) |
| `app/layout.tsx` | Root layout + metadata |
| `app/page.tsx` | Main page: URL input form |
| `app/page.module.css` | Page styles (dark theme) |
| `app/api/subtitles/route.ts` | API route: orchestrates extraction |
| `lib/types.ts` | Shared TypeScript types |
| `lib/vtt-to-srt.ts` | VTT → SRT pure converter |
| `lib/fetch-page.ts` | HTTP fetch helper with browser headers |
| `lib/extract-subtitles.ts` | Main extraction logic |

---

### Task 1: Project scaffold

**Files:** Create `package.json`, `tsconfig.json`, `next.config.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "svetserialu-titulky",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "cheerio": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['cheerio'],
};

module.exports = nextConfig;
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json next.config.js
git commit -m "chore: scaffold Next.js project"
```

---

### Task 2: Types

**Files:** Create `lib/types.ts`

- [ ] **Step 1: Create lib/types.ts**

```typescript
export interface SubtitlesResult {
  srt: string;
  title: string;
}

export interface ApiRequest {
  url: string;
}

export interface ApiSuccessResponse {
  srt: string;
  title: string;
}

export interface ApiErrorResponse {
  error: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared types"
```

---

### Task 3: VTT to SRT converter

**Files:** Create `lib/vtt-to-srt.ts`

- [ ] **Step 1: Write the converter with tests inline (test manually after)**

Create `lib/vtt-to-srt.ts`:

```typescript
export function vttToSrt(vtt: string): string {
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

    const srtTiming = timing.replace(/\.(\d{3})/g, ',$1');
    cues.push({ timing: srtTiming, text: textLines.join('\n') });
  }

  if (cues.length === 0) {
    return vttToSrtLegacy(vtt);
  }

  return cues.map((c, i) => `${i + 1}\n${c.timing}\n${c.text}`).join('\n\n') + '\n';
}

function vttToSrtLegacy(vtt: string): string {
  const normalized = vtt.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  let result = '';
  let index = 0;
  let cueTiming = '';
  let cueLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.includes('-->')) {
      if (cueTiming && cueLines.length > 0) {
        index++;
        result += `${index}\n${cueTiming}\n${cueLines.join('\n')}\n\n`;
        cueLines = [];
      }
      cueTiming = line.replace(/\.(\d{3})/g, ',$1');
      continue;
    }

    if (line.length === 0 && cueTiming && cueLines.length > 0) {
      index++;
      result += `${index}\n${cueTiming}\n${cueLines.join('\n')}\n\n`;
      cueTiming = '';
      cueLines = [];
      continue;
    }

    if (cueTiming && line.length > 0) {
      cueLines.push(line);
    }
  }

  if (cueTiming && cueLines.length > 0) {
    index++;
    result += `${index}\n${cueTiming}\n${cueLines.join('\n')}\n\n`;
  }

  return result.trim() ? result.trim() + '\n' : '';
}
```

- [ ] **Step 2: Quick smoke test via Node**

```bash
node -e "
const { vttToSrt } = require('./lib/vtt-to-srt');
const vtt = 'WEBVTT\n\n00:00:01.500 --> 00:00:04.200\nAhoj světe\n\n00:00:05.000 --> 00:00:08.000\nJak se máš?';
console.log(vttToSrt(vtt));
"
```

Expected output:
```
1
00:00:01,500 --> 00:00:04,200
Ahoj světe

2
00:00:05,000 --> 00:00:08,000
Jak se máš?
```

- [ ] **Step 3: Commit**

```bash
git add lib/vtt-to-srt.ts
git commit -m "feat: add VTT to SRT converter"
```

---

### Task 4: Fetch helper

**Files:** Create `lib/fetch-page.ts`

- [ ] **Step 1: Create lib/fetch-page.ts**

```typescript
export async function fetchPage(url: string, referer?: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'cs,en;q=0.9,sk;q=0.8',
      Referer: referer || 'https://svetserialu.to/',
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return res.text();
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/fetch-page.ts
git commit -m "feat: add fetch helper with browser headers"
```

---

### Task 5: Subtitle extraction logic

**Files:** Create `lib/extract-subtitles.ts`

- [ ] **Step 1: Create lib/extract-subtitles.ts**

```typescript
import * as cheerio from 'cheerio';
import { fetchPage } from './fetch-page';
import { vttToSrt } from './vtt-to-srt';
import type { SubtitlesResult } from './types';

const BASE = 'https://svetserialu.to';

export async function extractSubtitles(episodeUrl: string): Promise<SubtitlesResult> {
  const html = await fetchPage(episodeUrl);
  const $ = cheerio.load(html);

  const rawTitle = $('h1.h1episode').text().trim();
  const title = sanitizeFilename(rawTitle) || 'titulky';

  const hasSubtitles = $('.ifsrt.subtitles-active').length > 0;
  if (!hasSubtitles) {
    throw new Error('Tato epizoda nemá dostupné české titulky');
  }

  const sourceUrls: string[] = [];
  $('a.source_link').each((_, el) => {
    const encoded = $(el).attr('data-iframe');
    if (encoded) {
      try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        const full = decoded.startsWith('http') ? decoded : `${BASE}${decoded}`;
        sourceUrls.push(full);
      } catch {
        // skip invalid base64
      }
    }
  });

  if (sourceUrls.length === 0) {
    throw new Error('Nepodařilo se najít zdroje videa');
  }

  const errors: string[] = [];
  for (const sourceUrl of sourceUrls) {
    try {
      const srt = await tryExtractFromSource(sourceUrl);
      if (srt) return { srt, title };
    } catch (e) {
      errors.push(`${sourceUrl}: ${e}`);
    }
  }

  throw new Error('Tato epizoda nemá dostupné české titulky');
}

async function tryExtractFromSource(sourceUrl: string): Promise<string | null> {
  const html = await fetchPage(sourceUrl, BASE);
  const $ = cheerio.load(html);

  // Method 1: <track> elements
  const trackEl = $(
    'track[kind="subtitles"][srclang*="cs"], track[kind="subtitles"][srclang*="sk"], track[kind="captions"][srclang*="cs"], track[kind="captions"][srclang*="sk"]'
  ).first();
  if (trackEl.length > 0) {
    const src = trackEl.attr('src');
    if (src) {
      const vttUrl = resolveUrl(src, sourceUrl);
      return await fetchAndConvert(vttUrl);
    }
  }

  // Method 2: VTT URLs in <script> tags
  const scripts = $('script')
    .map((_, el) => $(el).html() || '')
    .get();
  for (const script of scripts) {
    const match = script.match(/["']((?:https?:)?\/\/[^"'\s]*\.vtt[^"'\s]*)["']/i);
    if (match) {
      const vttUrl = resolveUrl(match[1], sourceUrl);
      try {
        return await fetchAndConvert(vttUrl);
      } catch {
        continue;
      }
    }
  }

  // Method 3: Nested iframe (recursive)
  const iframeSrc = $('iframe').first().attr('src');
  if (iframeSrc) {
    const nestedUrl = resolveUrl(iframeSrc, sourceUrl);
    return await tryExtractFromSource(nestedUrl);
  }

  return null;
}

async function fetchAndConvert(vttUrl: string): Promise<string> {
  const vtt = await fetchPage(vttUrl, BASE);
  return vttToSrt(vtt);
}

function resolveUrl(src: string, base: string): string {
  if (src.startsWith('http')) return src;
  if (src.startsWith('//')) return `https:${src}`;
  try {
    return new URL(src, base).toString();
  } catch {
    return `${base.replace(/\/$/, '')}/${src.replace(/^\//, '')}`;
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/extract-subtitles.ts
git commit -m "feat: add subtitle extraction logic"
```

---

### Task 6: API route

**Files:** Create `app/api/subtitles/route.ts`

- [ ] **Step 1: Create app/api/subtitles/route.ts**

```typescript
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
    const message =
      err instanceof Error ? err.message : 'Nepodařilo se načíst data, zkus to znovu';
    const status = message.includes('platný') ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/subtitles/route.ts
git commit -m "feat: add API route for subtitle extraction"
```

---

### Task 7: Root layout

**Files:** Create `app/layout.tsx`

- [ ] **Step 1: Create app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SvetSerialu Titulky',
  description: 'Stáhni české titulky ze svetserialu.to jako SRT',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Create app/globals.css**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  background: #0f1117;
  color: #e0e0e0;
}

body {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: add root layout and global styles"
```

---

### Task 8: Main page

**Files:** Create `app/page.tsx`, `app/page.module.css`

- [ ] **Step 1: Create app/page.module.css**

```css
.container {
  width: 100%;
  max-width: 560px;
  padding: 2rem 1.5rem;
  text-align: center;
}

.logo {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 0.3rem;
  color: #fff;
}

.subtitle {
  font-size: 0.9rem;
  color: #888;
  margin-bottom: 2rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.input {
  width: 100%;
  padding: 0.9rem 1rem;
  border: 2px solid #2a2d36;
  border-radius: 10px;
  background: #1a1d27;
  color: #e0e0e0;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: #4a90d9;
}

.input::placeholder {
  color: #555;
}

.button {
  padding: 0.9rem 1rem;
  border: none;
  border-radius: 10px;
  background: #4a90d9;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}

.button:hover {
  background: #3a7bc8;
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  margin-top: 1rem;
  padding: 0.8rem 1rem;
  background: #3a1515;
  border: 1px solid #6b2020;
  border-radius: 8px;
  color: #f87171;
  font-size: 0.9rem;
}

.success {
  margin-top: 1rem;
  padding: 0.8rem 1rem;
  background: #0f2d1a;
  border: 1px solid #1a5c30;
  border-radius: 8px;
  color: #4ade80;
  font-size: 0.9rem;
}

.hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: #555;
}
```

- [ ] **Step 2: Create app/page.tsx**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import styles from './page.module.css';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!url.trim()) {
      setError('Zadej odkaz na epizodu');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Neznámá chyba');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = match ? decodeURIComponent(match[1]) : 'titulky.srt';

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      setSuccess(`Staženo: ${filename}`);
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
          {loading ? 'Stahuji titulky...' : 'Stáhnout titulky'}
        </button>
      </form>

      <p className={styles.hint}>Vlož odkaz na epizodu a stiskni tlačítko</p>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx app/page.module.css
git commit -m "feat: add main page with URL input form"
```

---

### Task 9: Build and verify

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Test VTT converter**

```bash
node -e "
const vtt = \`WEBVTT

00:00:01.500 --> 00:00:04.200
Ahoj, toto je test.

00:00:05.100 --> 00:00:08.300
Druhý řádek titulků.\`;
const fs = require('fs');
const content = fs.readFileSync('./lib/vtt-to-srt.ts', 'utf-8');
eval(content.replace('export ', ''));
console.log(vttToSrt(vtt));
"
```

- [ ] **Step 3: Start dev server and manual test**

```bash
npm run dev
```

Open `http://localhost:3000` and test with the URL `https://svetserialu.to/serial/cape-fear/s01e01`.

- [ ] **Step 4: Check the response**

Expected: Either a .srt download starts, or an appropriate error message is shown.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: any fixes from testing"
```
