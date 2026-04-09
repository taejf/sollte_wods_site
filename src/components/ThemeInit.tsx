'use client'

import { useEffect } from 'react'

const THEME_KEY = 'theme'

export default function ThemeInit() {
  useEffect(() => {
    document.documentElement.classList.add('dark')
    localStorage.setItem(THEME_KEY, 'dark')
  }, [])
  return null
}
