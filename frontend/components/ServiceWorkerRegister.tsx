'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Installability is best-effort; a failed registration shouldn't break the app.
      });
    }
  }, []);

  return null;
}
