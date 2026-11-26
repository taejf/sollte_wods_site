import type { Metadata } from 'next'
import localFont from 'next/font/local'
import Script from 'next/script'
import ThemeInit from '@/components/ThemeInit'
import './globals.css'

/** Modo oscuro forzado en todo el sitio. */
const THEME_BOOT_SCRIPT = `(function(){try{document.documentElement.classList.add('dark');}catch(e){document.documentElement.classList.add('dark');}})();`

const nunito = localFont({
  src: [
    {
      path: '../assets/fonts/Nunito/Nunito-VariableFont_wght.ttf',
      weight: '200 1000',
      style: 'normal',
    },
    {
      path: '../assets/fonts/Nunito/Nunito-Italic-VariableFont_wght.ttf',
      weight: '200 1000',
      style: 'italic',
    },
  ],
  variable: '--font-nunito',
  display: 'swap',
})

const bebasNeue = localFont({
  src: '../assets/fonts/Bebas_Neue/BebasNeue-Regular.ttf',
  weight: '400',
  style: 'normal',
  variable: '--font-bebas-neue',
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
    <html
      lang="es"
      suppressHydrationWarning
      className={`${nunito.variable} ${bebasNeue.variable}`}
    >
      <head>
        <Script id="theme-boot" strategy="beforeInteractive">
          {THEME_BOOT_SCRIPT}
        </Script>
      </head>
      <body suppressHydrationWarning className="antialiased">
        <ThemeInit />
        {children}
      </body>
    </html>
  )
}
