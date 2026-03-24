'use client';

import { useEffect } from 'react';

/**
 * Applies the dark/light class to <html> based on:
 * 1. ?theme=dark/light query param (monday.com passes this)
 * 2. localStorage preference
 * 3. OS prefers-color-scheme
 */
export default function ThemeProvider() {
  useEffect(() => {
    function applyTheme() {
      const params = new URLSearchParams(window.location.search);
      const paramTheme = params.get('theme');

      let dark = false;

      if (paramTheme === 'dark' || paramTheme === 'black') {
        dark = true;
        localStorage.setItem('theme', 'dark');
      } else if (paramTheme === 'light') {
        dark = false;
        localStorage.setItem('theme', 'light');
      } else {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark') {
          dark = true;
        } else if (stored === 'light') {
          dark = false;
        } else {
          dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
      }

      document.documentElement.classList.toggle('dark', dark);
    }

    applyTheme();

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, []);

  return null;
}
