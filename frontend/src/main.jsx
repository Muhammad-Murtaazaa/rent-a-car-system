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

// Global fetch interceptor to automatically scope every API request to the active tenant & attach tokens
const originalFetch = window.fetch;
window.fetch = function (resource, init = {}) {
  try {
    const url = typeof resource === "string" ? resource : resource?.url || "";
    if (url.startsWith("/api/")) {
      const headers = new Headers(init.headers || {});
      const activeTenant = localStorage.getItem("active_tenant_id") || "default";
      const tenantToken = localStorage.getItem("tenant_token");
      const superAdminToken = localStorage.getItem("saas_super_admin_token");

      if (!headers.has("X-Tenant-ID")) {
        headers.set("X-Tenant-ID", activeTenant);
      }
      if (!headers.has("Authorization")) {
        if (url.startsWith("/api/saas-admin/") && superAdminToken) {
          headers.set("Authorization", `Bearer ${superAdminToken}`);
        } else if (tenantToken) {
          headers.set("Authorization", `Bearer ${tenantToken}`);
        }
      }
      return originalFetch(resource, { ...init, headers });
    }
  } catch (e) {
    console.error("fetch interceptor error", e);
  }
  return originalFetch(resource, init);
};

initOfflineSync()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
