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
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(THEME_KEY) === 'dark';
}

export default function ThemeInit() {
  useEffect(() => {
    const isDark = getSavedTheme();
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, []);
  return null;
}
