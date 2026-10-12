import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import localFont from 'next/font/local'
import Script from 'next/script'
import ThemeInit from '@/components/ThemeInit'
import './globals.css'

/** Modo oscuro forzado en todo el sitio. */
const THEME_BOOT_SCRIPT = `(function(){try{document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`

const heebo = Heebo({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-heebo',
})

const nosifer = localFont({
  src: [
    { path: '../assets/fonts/Nosifer/Nosifer-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../assets/fonts/Nosifer/Nosifer-Regular.ttf', weight: '600', style: 'normal' },
    { path: '../assets/fonts/Nosifer/Nosifer-Regular.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-nosifer',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sollte WODs',
  description: 'WOD del día - Sollte',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script id="theme-boot" strategy="beforeInteractive">
          {THEME_BOOT_SCRIPT}
        </Script>
      </head>
      <body suppressHydrationWarning className={`${heebo.variable} ${nosifer.variable} font-sans antialiased`}>
        <ThemeInit />
        {children}
      </body>
    </html>
  )
}
