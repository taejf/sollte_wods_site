'use client';

import { useEffect } from 'react';

const THEME_KEY = 'theme';

export function applyTheme(dark: boolean) {
  if (typeof document === 'undefined') return;
  if (dark) {
    document.documentElement.classList.add('dark');
    localStorage.setItem(THEME_KEY, 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem(THEME_KEY, 'light');
  }
}

export function getSavedTheme(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(THEME_KEY);
  return saved !== 'light';
}

export default function ThemeInit() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    const isDark = saved !== 'light';
    if (isDark) {
      document.documentElement.classList.add('dark');
      if (!saved) localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);
  return null;
}
