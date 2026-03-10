import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import ThemeInit from '@/components/ThemeInit';
import './globals.css';

const heebo = Heebo({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-heebo'
});

export const metadata: Metadata = {
  title: 'Sollte WODs',
  description: 'WOD del día - Sollte'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${heebo.variable} font-sans antialiased`}>
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
