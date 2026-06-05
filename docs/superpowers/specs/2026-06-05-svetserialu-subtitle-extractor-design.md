# SvetSerialu Subtitle Extractor - Design

## Overview
Next.js web app deployed on Vercel. User pastes a svetserialu.to episode URL, clicks button, gets Czech subtitles as `.srt` download.

## Architecture

```
Frontend (pages/index.tsx)          API Route (pages/api/subtitles.ts)
┌──────────────────────┐    POST    ┌──────────────────────────────┐
│  URL input            │──────────▶│ 1. Fetch episode HTML        │
│  Submit button        │           │ 2. Parse data-iframe URLs    │
│  Loading spinner      │◀──────────│ 3. Fetch player iframe       │
│  Auto-download .srt   │   .srt    │ 4. Extract VTT track URL     │
└──────────────────────┘           │ 5. Download VTT → Convert SRT│
                                    │ 6. Return SRT                 │
                                    └──────────────────────────────┘
```

## API: POST /api/subtitles

**Request:** `{ url: string }`
**Response:** `Content-Type: text/plain; charset=utf-8` + `Content-Disposition: attachment`

### Pipeline steps:
1. **Validate URL** — must match `svetserialu.to/serial/*/s##e##`
2. **Fetch episode page** — with `User-Agent` and `Referer` headers
3. **Parse HTML** — find `a.source_link[data-iframe]` elements, decode base64
4. **For each source** (Filemoon, Vidmoly, Streamtape, Mixdrop):
   - Fetch the proxy iframe URL to get the actual player embed
   - Look for `<track kind="subtitles" srclang="cs">` or VTT URLs in JS configs
   - If found, download VTT content
5. **Convert VTT → SRT**:
   - Parse WEBVTT timestamps (`00:00:01.500 --> 00:00:04.200`)
   - Convert to SRT format (`,` instead of `.`, add index numbers)
   - Strip VTT metadata/headers
6. **Return SRT** with filename derived from episode title

## Frontend
- Single page with dark theme (aesthetic matching svetserialu.to)
- Input for URL + "Stáhnout titulky" button
- States: idle, loading, success (auto-download), error
- Responsive, minimal CSS (Tailwind optional, raw CSS fine)

## Error Handling
| Scenario | Message |
|----------|---------|
| Invalid URL | "Zadej platný odkaz na epizodu ze svetserialu.to" |
| No subtitles found | "Tato epizoda nemá dostupné české titulky" |
| Fetch failed | "Nepodařilo se načíst data, zkus to znovu" |
| Timeout (15s) | "Vypršel časový limit" |

## Tech Stack
- **Framework:** Next.js (App Router)
- **Runtime:** Node.js (Vercel serverless)
- **HTML parsing:** cheerio
- **CSS:** CSS Modules or inline (no external deps needed beyond cheerio)
- **Deployment:** Vercel (zero-config)
