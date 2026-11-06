// came with a friend's invite link (?invite=<playerId>): remember it for the first join, then tidy the address
{
  const inv = new URLSearchParams(location.search).get('invite');
  if (inv && /^[\w-]{8,64}$/.test(inv)) {
    localStorage.setItem('es:invitedBy', inv);
    history.replaceState(null, '', location.pathname + location.hash);
  }
}
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
