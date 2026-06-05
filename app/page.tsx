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
