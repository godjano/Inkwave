import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Inkweave — Fantasy Book Writing Studio',
  description: 'A modern writing studio for fantasy authors',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen">{children}</main>
      </body>
    </html>
  );
}
