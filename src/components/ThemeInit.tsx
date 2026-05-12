'use client'

import { useEffect } from 'react'

export default function ThemeInit() {
  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])
  return null
}
