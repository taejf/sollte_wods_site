import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import Script from 'next/script'
import ThemeInit from '@/components/ThemeInit'
import './globals.css'

/** Alineado con `ThemeInit` / `getSavedTheme`: por defecto oscuro; solo `theme=light` en localStorage fuerza claro. */
const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');document.documentElement.classList.toggle('dark',t!=='light');}catch(e){document.documentElement.classList.add('dark');}})();`

const heebo = Heebo({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-heebo',
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
      <body suppressHydrationWarning className={`${heebo.variable} font-sans antialiased`}>
        <ThemeInit />
        {children}
      </body>
    </html>
  )
}
