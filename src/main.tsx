import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error listener for debugging white screen issues
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global JS Error:", { message, source, lineno, colno, error });
  return false;
};

window.onunhandledrejection = function(event) {
  console.error("Unhandled Promise Rejection:", event.reason);
  if (event.reason) {
    if (event.reason.message) console.error("Rejection Message:", event.reason.message);
    if (event.reason.stack) console.error("Rejection Stack:", event.reason.stack);
    if (event.reason.code) console.error("Rejection Code:", event.reason.code);
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
