import type { Config } from 'tailwindcss'

/**
 * Utilidades usadas solo en strings/constantes o devueltas por helpers en
 * `dashboard/page.tsx`. Sin safelist, el JIT de Tailwind puede omitirlas y
 * la UI queda sin estilos en esas zonas.
 */
const dashboardSafelist = [
  "divide-y-2",
  "divide-[#d0d0d0]",
  "dark:divide-gray-500",
  "py-2",
  "sm:py-3",
  "first:pt-0",
  "last:pb-0",
  "text-[#333]",
  "dark:text-gray-200",
  "text-[1em]",
  "sm:text-[1.125em]",
  "md:text-[1.5em]",
  "lg:text-[2.5em]",
  "min-w-0",
  "break-words",
  "border-b-2",
  "border-b-[#d0d0d0]",
  "dark:border-b-gray-500",
  "border-b-0",
  "md:border-l-2",
  "md:border-l-[#d0d0d0]",
  "md:dark:border-l-gray-500",
  "md:pl-3",
  "xl:border-l-2",
  "xl:border-l-[#d0d0d0]",
  "xl:dark:border-l-gray-500",
  "xl:pl-3",
] as const

export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  safelist: [...dashboardSafelist],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-heebo)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config
