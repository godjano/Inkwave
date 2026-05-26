import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Inkweave — Fantasy Book Writing Studio',
  description: 'A modern writing studio for fantasy authors',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
