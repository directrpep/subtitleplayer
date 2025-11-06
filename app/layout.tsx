import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BLU Timed Text QA Tool',
  description: 'Frame-accurate QC tool for subtitles, captions and media streams.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
