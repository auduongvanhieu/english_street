import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { AdminApp } from './App';

// the game's CSS pins #root to the viewport; the admin pages scroll normally
document.body.style.overscrollBehavior = 'auto';
document.getElementById('root')!.style.height = 'auto';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
