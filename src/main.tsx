import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Allow the native context menu inside the rendered Markdown content
// (so users can Copy / Select All / Look Up), but keep it suppressed
// on the rest of the UI chrome (sidebar, toolbar, titlebar, etc.).
document.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement | null;
  if (target?.closest(".markdown-body")) return;
  e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
