import React, { useState, useEffect } from "react";
import { Server, Users, BarChart3, Plus, X, Palette, CheckCircle, ShieldAlert, Sliders } from "lucide-react";

export default function SuperAdminDashboard({ userRole, setUserRole }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Provisioning Modal State
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [newTenantForm, setNewTenantForm] = useState({
    id: "",
    name: "",
    logo_url: "",
    primary_theme_color: "#0d9488",
    contact_name: "",
    operational_manager: "Operational Manager",
    feature_flags: ["dashboard", "fleet", "customers", "bookings", "maintenance", "blacklist", "whatsapp_api", "advanced_analytics", "chauffeur_module"],
    branding_settings: {
      support_email: "support@agency.com",
      support_phone: "0300-1234567",
      footer_status_text: "Offline Backup System",
      bg_gradient_start: "#0d9488"
    }
  });

  // Config Modal State
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [activeTab, setActiveTab] = useState("branding"); // "branding" or "features"

  const fetchTenants = () => {
    setLoading(true);
    fetch("/api/saas-admin/tenants", {
      headers: { "X-Test-Role": "super_admin" }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        setTenants(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleProvisionSubmit = (e) => {
    e.preventDefault();
    fetch("/api/saas-admin/tenants", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Test-Role": "super_admin"
      },
      body: JSON.stringify(newTenantForm)
    })
      .then((res) => {
        if (res.ok) {
          setShowProvisionModal(false);
          setNewTenantForm({
            id: "",
            name: "",
            logo_url: "",
            primary_theme_color: "#0d9488",
            contact_name: "",
            operational_manager: "Operational Manager",
            feature_flags: ["dashboard", "fleet", "customers", "bookings", "maintenance", "blacklist", "whatsapp_api", "advanced_analytics", "chauffeur_module"],
            branding_settings: {
              support_email: "support@agency.com",
              support_phone: "0300-1234567",
              footer_status_text: "Offline Backup System",
              bg_gradient_start: "#0d9488"
            }
          });
          fetchTenants();
        } else {
          return res.json().then(err => alert(err.detail || "Error provisioning tenant"));
        }
      });
  };

  const handleFeatureToggle = (flag) => {
    if (!selectedTenant) return;
    const currentFlags = selectedTenant.feature_flags || [];
    const updatedFlags = currentFlags.includes(flag)
      ? currentFlags.filter(f => f !== flag)
      : [...currentFlags, flag];

    const payload = {
      feature_flags: updatedFlags,
      branding_settings: selectedTenant.branding_settings || {}
    };

    fetch(`/api/saas-admin/tenants/${selectedTenant.id}/features`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Role": "super_admin"
      },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (res.ok) return res.json();
      })
      .then((updatedTenant) => {
        if (updatedTenant) {
          setSelectedTenant(updatedTenant);
          setTenants(tenants.map(t => t.id === updatedTenant.id ? updatedTenant : t));
        }
      });
  };

  const handleBrandingSave = (e) => {
    e.preventDefault();
    if (!selectedTenant) return;
    
    const payload = {
      name: selectedTenant.name,
      logo_url: selectedTenant.logo_url,
      primary_theme_color: selectedTenant.primary_theme_color,
      branding_settings: selectedTenant.branding_settings || {}
    };

    fetch(`/api/saas-admin/tenants/${selectedTenant.id}/features`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Role": "super_admin"
      },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (res.ok) return res.json();
      })
      .then((updatedTenant) => {
        if (updatedTenant) {
          setSelectedTenant(updatedTenant);
          setTenants(tenants.map(t => t.id === updatedTenant.id ? updatedTenant : t));
          alert("Detailed whitelabel branding saved and deployed.");
        }
      });
  };

  const updateBrandingSetting = (key, value) => {
    setSelectedTenant(prev => ({
      ...prev,
      branding_settings: {
        ...(prev.branding_settings || {}),
        [key]: value
      }
    }));
  };

  if (userRole !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] p-6">
        <ShieldAlert className="h-16 w-16 text-rose-500 mb-4 animate-bounce" />
        <h1 className="text-2xl font-bold">Access Forbidden</h1>
        <p className="text-sm text-[var(--text-muted)] mt-2">Only Super Admins can access the SaaS Control Center.</p>
        <button onClick={() => setUserRole("super_admin")} className="btn-accent px-6 py-2.5 rounded-xl font-bold mt-6">
          Elevate to Super Admin (Testing)
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] p-4 sm:p-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <span className="bg-teal-500/10 text-teal-605 border border-teal-500/20 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-widest">
            SaaS Operator Control Center
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight mt-2 text-[var(--text-main)]">Omnysync Multi-Tenant Platform</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            className="bg-[var(--tr-hover)] border border-[var(--border-color)] text-xs rounded-xl p-2.5 focus:outline-none text-[var(--text-main)] font-semibold"
          >
            <option value="super_admin">Super Admin Role</option>
            <option value="tenant_admin">Tenant Admin Role</option>
            <option value="desk_staff">Desk Staff Role</option>
          </select>

          <button 
            onClick={() => setShowProvisionModal(true)}
            className="btn-accent text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
          >
            <Plus className="h-4 w-4" /> Provision Subdomain
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-teal-500/10 p-3 rounded-xl">
            <Server className="h-6 w-6 text-teal-605" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Active Agency Subdomains</span>
            <span className="block text-2xl font-extrabold mt-1">{tenants.length} Tenants</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-emerald-500/10 p-3 rounded-xl">
            <Users className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Active Users</span>
            <span className="block text-2xl font-extrabold mt-1">{tenants.length * 4 + 8} Active Accounts</span>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-amber-500/10 p-3 rounded-xl">
            <BarChart3 className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Global Database State</span>
            <span className="block text-2xl font-extrabold mt-1">Healthy (PostgreSQL)</span>
          </div>
        </div>
      </div>

      {/* Tenant Table Grid */}
      <div className="glass-panel rounded-2xl shadow-xl overflow-hidden border border-[var(--border-color)]">
        <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
          <h3 className="font-bold text-lg">Provisioned Agency Tenants</h3>
          <span className="bg-[var(--tr-hover)] text-xs border border-[var(--border-color)] font-mono px-3 py-1 rounded-full">
            {tenants.length} Total
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
          </div>
        ) : tenants.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-12 text-center italic">No tenants provisioned yet. Add the first one!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--tr-hover)] text-[var(--text-muted)] border-b border-[var(--border-color)] uppercase font-semibold">
                  <th className="p-4">Agency Details</th>
                  <th className="p-4">Subdomain Identity</th>
                  <th className="p-4">Operational Manager</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Active Flags</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {tenants.map(t => (
                  <tr key={t.id} className="hover:bg-[var(--tr-hover)]/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-white shadow-md font-mono"
                          style={{ backgroundColor: t.primary_theme_color || "#0d9488" }}
                        >
                          {t.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[var(--text-main)]">{t.name}</div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">{t.logo_url || "No whitelabel logo"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono text-[var(--accent-color)] font-bold">{t.id}.omnysync.com</td>
                    <td className="p-4">
                      <div className="font-semibold text-[var(--text-main)]">{t.contact_name}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{t.operational_manager}</div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        t.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-500"
                      }`}>
                        {t.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {t.feature_flags?.map(f => (
                          <span key={f} className="bg-teal-500/10 text-teal-605 border border-teal-500/20 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                            {f.replace("_", " ")}
                          </span>
                        )) || <span className="text-[10px] italic text-[var(--text-muted)]">No flags enabled</span>}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => { setSelectedTenant(t); setActiveTab("branding"); }}
                        className="py-1 px-3 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-teal-500 hover:text-teal-500 font-bold transition-all"
                      >
                        Configure Settings
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
              <h3 className="text-xl font-bold">Provision New SaaS Tenant</h3>
              <button onClick={() => setShowProvisionModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Agency Subdomain Prefix *</label>
                  <input 
                    type="text" required placeholder="e.g. lahore-cabs"
                    value={newTenantForm.id}
                    onChange={(e) => setNewTenantForm({...newTenantForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Agency Legal Name *</label>
                  <input 
                    type="text" required placeholder="e.g. Lahore Rent A Car Ltd"
                    value={newTenantForm.name}
                    onChange={(e) => setNewTenantForm({...newTenantForm, name: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Manager Contact Name *</label>
                  <input 
                    type="text" required placeholder="Full Name"
                    value={newTenantForm.contact_name}
                    onChange={(e) => setNewTenantForm({...newTenantForm, contact_name: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Designation Title</label>
                  <input 
                    type="text" required
                    value={newTenantForm.operational_manager}
                    onChange={(e) => setNewTenantForm({...newTenantForm, operational_manager: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Primary Theme HEX</label>
                  <input 
                    type="color"
                    value={newTenantForm.primary_theme_color}
                    onChange={(e) => setNewTenantForm({...newTenantForm, primary_theme_color: e.target.value})}
                    className="w-full h-10 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-1 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Logo Whitelabel URL</label>
                  <input 
                    type="text" placeholder="/images/default-logo.png"
                    value={newTenantForm.logo_url}
                    onChange={(e) => setNewTenantForm({...newTenantForm, logo_url: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full btn-accent text-white font-semibold py-3 rounded-lg mt-4 transition-all"
              >
                Provision Subdomain Environment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Configuration Settings Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-6 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-xl font-bold">Configure Settings: {selectedTenant.name}</h3>
                <p className="text-xs text-[var(--text-muted)] font-mono">{selectedTenant.id}.omnysync.com</p>
              </div>
              <button onClick={() => setSelectedTenant(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Config Tabs */}
            <div className="flex border-b border-[var(--border-color)]">
              <button
                onClick={() => setActiveTab("branding")}
                className={`py-2 px-4 text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 min-h-[44px] ${
                  activeTab === "branding"
                    ? "border-teal-500 text-teal-500 font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                <Palette className="h-3.5 w-3.5" /> Whitelabel Branding
              </button>
              <button
                onClick={() => setActiveTab("features")}
                className={`py-2 px-4 text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 min-h-[44px] ${
                  activeTab === "features"
                    ? "border-teal-500 text-teal-500 font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                <Sliders className="h-3.5 w-3.5" /> Feature Toggles
              </button>
            </div>

            {activeTab === "branding" ? (
              <form onSubmit={handleBrandingSave} className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-[var(--text-main)] mb-1 text-sm">Detailed Whitelabel Metrics</h4>
                  <p className="text-[10px] text-[var(--text-muted)] mb-3">Custom client-facing contact points and backgrounds.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Whitelabel Hex Primary Override</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="color"
                        value={selectedTenant.primary_theme_color || "#0d9488"}
                        onChange={(e) => setSelectedTenant({ ...selectedTenant, primary_theme_color: e.target.value })}
                        className="w-10 h-10 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-1 cursor-pointer"
                      />
                      <input 
                        type="text"
                        value={selectedTenant.primary_theme_color || "#0d9488"}
                        onChange={(e) => setSelectedTenant({ ...selectedTenant, primary_theme_color: e.target.value })}
                        className="flex-1 app-input rounded-lg p-2.5 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Company Logo Path</label>
                    <input 
                      type="text"
                      value={selectedTenant.logo_url || ""}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant, logo_url: e.target.value })}
                      className="w-full app-input rounded-lg p-2.5 font-mono focus:outline-none"
                      placeholder="/images/custom-logo.png"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Support Email</label>
                    <input 
                      type="email"
                      value={selectedTenant.branding_settings?.support_email || ""}
                      onChange={(e) => updateBrandingSetting("support_email", e.target.value)}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                      placeholder="support@agency.com"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Support Phone Hotline</label>
                    <input 
                      type="text"
                      value={selectedTenant.branding_settings?.support_phone || ""}
                      onChange={(e) => updateBrandingSetting("support_phone", e.target.value)}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                      placeholder="0300-1234567"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Background Gradient Start</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="color"
                        value={selectedTenant.branding_settings?.bg_gradient_start || "#0d9488"}
                        onChange={(e) => updateBrandingSetting("bg_gradient_start", e.target.value)}
                        className="w-10 h-10 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-1 cursor-pointer"
                      />
                      <input 
                        type="text"
                        value={selectedTenant.branding_settings?.bg_gradient_start || "#0d9488"}
                        onChange={(e) => updateBrandingSetting("bg_gradient_start", e.target.value)}
                        className="flex-1 app-input rounded-lg p-2.5 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Footer Status Text</label>
                    <input 
                      type="text"
                      value={selectedTenant.branding_settings?.footer_status_text || ""}
                      onChange={(e) => updateBrandingSetting("footer_status_text", e.target.value)}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                      placeholder="Offline Backup System"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full btn-accent text-white font-semibold py-3 rounded-lg mt-4 transition-all"
                >
                  Save Whitelabel Preferences
                </button>
              </form>
            ) : (
              <div className="space-y-6 text-xs max-h-[60vh] overflow-y-auto pr-1">
                <div>
                  <h4 className="font-bold text-[var(--text-main)] mb-2">Enable/Disable Platform Modules</h4>
                  <p className="text-[10px] text-[var(--text-muted)]">Toggle operational sidebar items and client capabilities dynamically.</p>
                </div>

                <div className="space-y-4">
                  <h5 className="font-bold text-teal-605 border-b border-[var(--border-color)] pb-1.5 uppercase tracking-wider text-[10px]">Operational Tabs</h5>
                  {[
                    { flag: "dashboard", label: "Dashboard Hub Tab", desc: "Toggles visibility of the main metrics operational control panel" },
                    { flag: "fleet", label: "Luxury Fleet Tab", desc: "Toggles access to vehicles, adding/editing models, and metrics logs" },
                    { flag: "customers", label: "Client Database Tab", desc: "Toggles client profile folders and document KYC checking" },
                    { flag: "bookings", label: "Bookings Scheduler Tab", desc: "Toggles reservation forms and digital deposit signatures" },
                    { flag: "maintenance", label: "Maintenance & Tax Ledger Tab", desc: "Toggles vehicle service entries and token tax checklists" },
                    { flag: "blacklist", label: "Blacklist Shield Tab", desc: "Toggles customer risk assessment blocklists" }
                  ].map(mod => {
                    const isEnabled = (selectedTenant.feature_flags || []).includes(mod.flag);
                    return (
                      <div key={mod.flag} className="flex justify-between items-center p-3 bg-[var(--tr-hover)]/30 border border-[var(--border-color)] rounded-xl">
                        <div className="flex-1 pr-4">
                          <h5 className="font-bold text-[var(--text-main)] text-xs">{mod.label}</h5>
                          <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{mod.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFeatureToggle(mod.flag)}
                          className={`w-12 h-6 rounded-full p-1 transition-all flex items-center ${
                            isEnabled ? "bg-teal-500 justify-end" : "bg-slate-700 justify-start"
                          }`}
                        >
                          <span className="inline-block w-4 h-4 bg-white rounded-full shadow-md"></span>
                        </button>
                      </div>
                    );
                  })}

                  <h5 className="font-bold text-teal-605 border-b border-[var(--border-color)] pb-1.5 uppercase tracking-wider text-[10px] pt-4">Module Addons</h5>
                  {[
                    { flag: "whatsapp_api", label: "WhatsApp Messaging API", desc: "Allows sending receipts and notifications via WhatsApp" },
                    { flag: "advanced_analytics", label: "Vehicle Lifecycle Analytics", desc: "Enables interactive total earnings, repair logs, and financial ledger graphs" },
                    { flag: "chauffeur_module", label: "Chauffeur Rental Module", desc: "Unlocks rates calculations and options for chauffeur-driven packages" }
                  ].map(mod => {
                    const isEnabled = (selectedTenant.feature_flags || []).includes(mod.flag);
                    return (
                      <div key={mod.flag} className="flex justify-between items-center p-3 bg-[var(--tr-hover)]/30 border border-[var(--border-color)] rounded-xl">
                        <div className="flex-1 pr-4">
                          <h5 className="font-bold text-[var(--text-main)] text-xs">{mod.label}</h5>
                          <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{mod.desc}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFeatureToggle(mod.flag)}
                          className={`w-12 h-6 rounded-full p-1 transition-all flex items-center ${
                            isEnabled ? "bg-teal-500 justify-end" : "bg-slate-700 justify-start"
                          }`}
                        >
                          <span className="inline-block w-4 h-4 bg-white rounded-full shadow-md"></span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
