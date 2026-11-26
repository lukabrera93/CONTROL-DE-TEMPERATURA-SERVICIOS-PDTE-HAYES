import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Recover automatically once if a stale cached HTML references an old chunk after deploy
window.addEventListener('vite:preloadError', () => {
  const reloadKey = 'controlterm_chunk_reload';
  try {
    if (!sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, '1');
      window.location.reload();
    }
  } catch {
    window.location.reload();
  }
});

if (
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  window.location.protocol.startsWith('http')
) {
  try {
    registerSW({
      immediate: true,
      onRegisterError() {
        // Ignore service worker registration errors so the app keeps working normally
      },
    });
  } catch {
    // Ignore synchronous SW registration errors
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
