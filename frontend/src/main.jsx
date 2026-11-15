import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initOfflineSync } from './offlineSync.js'

// Automatically detect tenant from query parameter (?tenant=xyz or ?t=xyz) or subdomain
if (typeof window !== "undefined") {
  const urlParams = new URLSearchParams(window.location.search);
  const qTenant = urlParams.get("tenant") || urlParams.get("t");
  if (qTenant) {
    localStorage.setItem("active_tenant_id", qTenant.toLowerCase().trim());
  } else {
    const host = window.location.hostname;
    const parts = host.split(".");
    if (parts.length >= 3 && !["www", "racms", "localhost", "127"].includes(parts[0])) {
      localStorage.setItem("active_tenant_id", parts[0]);
    }
  }
}

// Initialize Offline PWA caching, Background Sync & API Auth header injection
initOfflineSync();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
