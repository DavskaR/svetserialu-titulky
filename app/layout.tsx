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
