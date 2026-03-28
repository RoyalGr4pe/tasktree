'use client';

import { useEffect } from 'react';

function applyThemeValue(theme: string | null | undefined) {
  if (!theme) return;
  const dark = theme === 'dark' || theme === 'black';
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', dark);
}

/**
 * Applies the dark/light class to <html> based on:
 * 1. monday SDK context `theme` field (most reliable — fires when context is ready)
 * 2. ?theme=dark/light query param
 * 3. localStorage preference
 * 4. OS prefers-color-scheme
 */
export default function ThemeProvider() {
  useEffect(() => {
    // Initial apply from URL params / localStorage / OS
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

    // Subscribe to monday SDK context — this fires once context is ready and
    // whenever the user changes their theme in monday, giving us the authoritative value.
    let mondayInstance: { listen: (event: string, cb: (res: { data: Record<string, unknown> }) => void) => void } | null = null;
    import('monday-sdk-js').then(({ default: mondaySdk }) => {
      mondayInstance = mondaySdk();
      mondayInstance.listen('context', (res: { data: Record<string, unknown> }) => {
        const theme = res.data?.theme as string | undefined;
        if (theme) applyThemeValue(theme);
      });
    }).catch(() => { /* not in monday iframe */ });

    return () => {
      mq.removeEventListener('change', applyTheme);
      // monday SDK has no removeListener API; instance is GC'd with the component
    };
  }, []);

  return null;
}
