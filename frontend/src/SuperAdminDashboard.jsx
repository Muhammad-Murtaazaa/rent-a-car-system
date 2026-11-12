import React, { useState, useEffect } from "react";
import {
  Server, Users, BarChart3, Plus, X, Palette, CheckCircle,
  ShieldAlert, Sliders, Clock, Trash2, Power, Sparkles, ExternalLink, Car
} from "lucide-react";

const ALL_FLAGS = [
  "dashboard", "fleet", "customers", "leads", "quotations",
  "bookings", "receipts", "employees", "maintenance", "blacklist",
  "whatsapp_api", "advanced_analytics", "chauffeur_module", "suppliers"
];

function calcDaysLeft(trialEndsAt) {
  if (!trialEndsAt) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(trialEndsAt + "T00:00:00");
  return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function SuperAdminDashboard({ userRole, setUserRole }) {
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const defaultForm = () => ({
    id: "",
    name: "",
    logo_url: "",
    primary_theme_color: "#0d9488",
    contact_name: "",
    operational_manager: "Operational Manager",
    plan_type: "trial_7d",
    subscription_status: "trialing",
    trial_ends_at: addDaysISO(7),
    is_active: true,
    feature_flags: [...ALL_FLAGS],
    branding_settings: {
      support_email: "support@omnysync.com",
      support_phone: "0300-1234567",
      footer_status_text: "Cloud SaaS Platform",
      bg_gradient_start: "#0d9488"
    }
  });

  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [newTenantForm, setNewTenantForm] = useState(defaultForm);

  // Config Modal State
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [activeTab, setActiveTab] = useState("branding"); // "branding" | "features" | "subscription"

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        fetch("/api/saas-admin/tenants", { headers: { "X-Test-Role": "super_admin" } }),
        fetch("/api/saas-admin/stats", { headers: { "X-Test-Role": "super_admin" } })
      ]);
      if (tRes.ok) setTenants(await tRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handlePlanChangeInProvision = (plan) => {
    if (plan === "trial_7d") {
      setNewTenantForm(prev => ({
        ...prev,
        plan_type: "trial_7d",
        subscription_status: "trialing",
        trial_ends_at: addDaysISO(7)
      }));
    } else {
      setNewTenantForm(prev => ({
        ...prev,
        plan_type: plan,
        subscription_status: "active",
        trial_ends_at: ""
      }));
    }
  };

  const handleProvisionSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...newTenantForm,
      trial_ends_at: newTenantForm.trial_ends_at || null
    };
    const res = await fetch("/api/saas-admin/tenants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Role": "super_admin"
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setShowProvisionModal(false);
      setNewTenantForm(defaultForm());
      fetchTenants();
    } else {
      const err = await res.json();
      alert(err.detail || "Error provisioning tenant");
    }
  };

  const handleFeatureToggle = async (flag) => {
    if (!selectedTenant) return;
    const currentFlags = selectedTenant.feature_flags || [];
    const updatedFlags = currentFlags.includes(flag)
      ? currentFlags.filter(f => f !== flag)
      : [...currentFlags, flag];

    const res = await fetch(`/api/saas-admin/tenants/${selectedTenant.id}/features`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Role": "super_admin"
      },
      body: JSON.stringify({
        feature_flags: updatedFlags,
        branding_settings: selectedTenant.branding_settings || {}
      })
    });
    if (res.ok) {
      const updatedTenant = await res.json();
      setSelectedTenant(updatedTenant);
      setTenants(tenants.map(t => t.id === updatedTenant.id ? updatedTenant : t));
    }
  };

  const handleBrandingSave = async (e) => {
    e.preventDefault();
    if (!selectedTenant) return;

    const payload = {
      name: selectedTenant.name,
      logo_url: selectedTenant.logo_url,
      primary_theme_color: selectedTenant.primary_theme_color,
      contact_name: selectedTenant.contact_name,
      operational_manager: selectedTenant.operational_manager,
      plan_type: selectedTenant.plan_type,
      subscription_status: selectedTenant.subscription_status,
      trial_ends_at: selectedTenant.trial_ends_at || null,
      is_active: selectedTenant.is_active,
      branding_settings: selectedTenant.branding_settings || {}
    };

    const res = await fetch(`/api/saas-admin/tenants/${selectedTenant.id}/features`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Role": "super_admin"
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const updatedTenant = await res.json();
      setSelectedTenant(updatedTenant);
      setTenants(tenants.map(t => t.id === updatedTenant.id ? updatedTenant : t));
      alert("Tenant settings & subscription saved.");
    }
  };

  const handleExtendTrial = async (tenantId, days = 7) => {
    const res = await fetch(`/api/saas-admin/tenants/${tenantId}/extend-trial?days=${days}`, {
      method: "POST",
      headers: { "X-Test-Role": "super_admin" }
    });
    if (res.ok) {
      fetchTenants();
    }
  };

  const handleToggleActive = async (tenant) => {
    const res = await fetch(`/api/saas-admin/tenants/${tenant.id}/features`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Role": "super_admin"
      },
      body: JSON.stringify({
        is_active: !tenant.is_active,
        subscription_status: !tenant.is_active ? "active" : "suspended"
      })
    });
    if (res.ok) fetchTenants();
  };

  const handleDeleteTenant = async (tenantId) => {
    if (!window.confirm(`Delete tenant '${tenantId}' permanently?`)) return;
    const res = await fetch(`/api/saas-admin/tenants/${tenantId}`, {
      method: "DELETE",
      headers: { "X-Test-Role": "super_admin" }
    });
    if (res.ok) fetchTenants();
    else {
      const err = await res.json();
      alert(err.detail || "Cannot delete tenant");
    }
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
          <span className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-widest">
            SaaS Operator Control Center
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight mt-2 text-[var(--text-main)]">Omnysync Multi-Tenant Admin</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">Provision client subdomains, 7-day free trials, white-label branding & module access.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value)}
            className="bg-[var(--tr-hover)] border border-[var(--border-color)] text-xs rounded-xl p-2.5 focus:outline-none text-[var(--text-main)] font-semibold"
          >
            <option value="super_admin">Super Admin Role</option>
            <option value="tenant_admin">Back to App (Tenant Admin)</option>
            <option value="desk_staff">Back to App (Desk Staff)</option>
          </select>

          <button
            onClick={() => { setNewTenantForm(defaultForm()); setShowProvisionModal(true); }}
            className="btn-accent text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
          >
            <Plus className="h-4 w-4" /> Provision Client / 7-Day Trial
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-teal-500/10 p-3 rounded-xl">
            <Server className="h-6 w-6 text-teal-500" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Provisioned Agencies</span>
            <span className="block text-2xl font-extrabold mt-0.5">{stats?.total_tenants ?? tenants.length} Tenants</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-amber-500/10 p-3 rounded-xl">
            <Clock className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Active 7-Day Trials</span>
            <span className="block text-2xl font-extrabold mt-0.5">{stats?.trial_tenants ?? tenants.filter(t => t.subscription_status === "trialing").length} Trialing</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-emerald-500/10 p-3 rounded-xl">
            <Car className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Platform Fleet & Clients</span>
            <span className="block text-xl font-extrabold mt-0.5">{stats?.total_cars ?? 0} Cars · {stats?.total_customers ?? 0} Clients</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-sky-500/10 p-3 rounded-xl">
            <BarChart3 className="h-6 w-6 text-sky-500" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Database Engine</span>
            <span className="block text-lg font-extrabold mt-0.5">{stats?.db_engine || "SQLite (WAL Mode)"}</span>
          </div>
        </div>
      </div>

      {/* Tenant Table Grid */}
      <div className="glass-panel rounded-2xl shadow-xl overflow-hidden border border-[var(--border-color)]">
        <div className="p-6 border-b border-[var(--border-color)] flex justify-between items-center">
          <h3 className="font-bold text-lg">Provisioned Agency Tenants & Free Trials</h3>
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
                  <th className="p-4">Subdomain</th>
                  <th className="p-4">Plan & Trial</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Modules</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {tenants.map(t => {
                  const daysLeft = calcDaysLeft(t.trial_ends_at);
                  const isTrialExpired = t.subscription_status === "trialing" && daysLeft !== null && daysLeft < 0;
                  return (
                    <tr key={t.id} className="hover:bg-[var(--tr-hover)]/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-white shadow-md font-mono shrink-0"
                            style={{ backgroundColor: t.primary_theme_color || "#0d9488" }}
                          >
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-[var(--text-main)]">{t.name}</div>
                            <div className="text-[10px] text-[var(--text-muted)]">{t.contact_name} · {t.operational_manager}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono">
                        <a
                          href={`https://${t.id === "default" ? "racms" : t.id}.omnysync.com`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--accent-color)] font-bold inline-flex items-center gap-1 hover:underline"
                        >
                          {t.id === "default" ? "racms" : t.id}.omnysync.com
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="p-4">
                        <div className="font-bold capitalize text-[var(--text-main)]">
                          {t.plan_type === "trial_7d" ? "7-Day Free Trial" : (t.plan_type || "Standard")}
                        </div>
                        {t.trial_ends_at && (
                          <div className={`text-[10px] font-mono mt-0.5 ${isTrialExpired ? "text-rose-500 font-bold" : "text-amber-500 font-semibold"}`}>
                            {isTrialExpired
                              ? `Expired (${t.trial_ends_at})`
                              : `${daysLeft} day(s) left · Ends ${t.trial_ends_at}`}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          !t.is_active || isTrialExpired || t.subscription_status === "expired"
                            ? "bg-rose-500/10 text-rose-500"
                            : t.subscription_status === "trialing"
                            ? "bg-amber-500/10 text-amber-500"
                            : "bg-emerald-500/10 text-emerald-500"
                        }`}>
                          {!t.is_active ? "Suspended" : isTrialExpired ? "Trial Expired" : (t.subscription_status || "Active")}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-[11px] font-bold text-[var(--text-muted)]">
                          {t.feature_flags?.length || 0} / {ALL_FLAGS.length} enabled
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleExtendTrial(t.id, 7)}
                            title="Start or Extend 7-Day Free Trial"
                            className="py-1.5 px-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 font-bold text-[11px] flex items-center gap-1"
                          >
                            <Sparkles className="h-3 w-3" /> +7d Trial
                          </button>
                          <button
                            onClick={() => { setSelectedTenant(t); setActiveTab("branding"); }}
                            className="py-1.5 px-2.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-teal-500 hover:text-teal-500 font-bold text-[11px]"
                          >
                            Configure
                          </button>
                          {t.id !== "default" && (
                            <>
                              <button
                                onClick={() => handleToggleActive(t)}
                                title={t.is_active ? "Suspend Tenant" : "Activate Tenant"}
                                className="p-1.5 rounded-lg border border-[var(--border-color)] hover:border-teal-500 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTenant(t.id)}
                                title="Delete Tenant"
                                className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-xl font-bold">Provision New SaaS Client</h3>
              <button onClick={() => setShowProvisionModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-4 text-xs">
              {/* Plan Selector */}
              <div className="p-3 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-2">
                <label className="block font-bold text-[var(--text-main)]">Subscription Plan *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: "trial_7d", label: "7-Day Free Trial" },
                    { id: "monthly", label: "Monthly Paid" },
                    { id: "yearly", label: "Yearly Paid" },
                    { id: "standard", label: "Lifetime" }
                  ].map(p => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => handlePlanChangeInProvision(p.id)}
                      className={`py-2 px-2 rounded-lg font-bold border text-[11px] transition-all ${
                        newTenantForm.plan_type === p.id
                          ? "bg-teal-500 text-white border-teal-500"
                          : "bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-muted)]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {newTenantForm.plan_type === "trial_7d" && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-amber-500 font-semibold">Trial automatically expires on:</span>
                    <input
                      type="date"
                      value={newTenantForm.trial_ends_at}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, trial_ends_at: e.target.value })}
                      className="app-input rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Agency Subdomain Prefix *</label>
                  <input
                    type="text" required placeholder="e.g. lahore-cabs"
                    value={newTenantForm.id}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-[var(--text-muted)] mt-1 block">{newTenantForm.id || "client"}.omnysync.com</span>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Agency Legal Name *</label>
                  <input
                    type="text" required placeholder="e.g. Royal Rent A Car"
                    value={newTenantForm.name}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, name: e.target.value })}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Client Contact Name *</label>
                  <input
                    type="text" required placeholder="Full Name"
                    value={newTenantForm.contact_name}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, contact_name: e.target.value })}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Designation Title</label>
                  <input
                    type="text" required
                    value={newTenantForm.operational_manager}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, operational_manager: e.target.value })}
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
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, primary_theme_color: e.target.value })}
                    className="w-full h-10 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-1 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Support Phone</label>
                  <input
                    type="text" placeholder="0300-1234567"
                    value={newTenantForm.branding_settings.support_phone}
                    onChange={(e) => setNewTenantForm({
                      ...newTenantForm,
                      branding_settings: { ...newTenantForm.branding_settings, support_phone: e.target.value }
                    })}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full btn-accent text-white font-semibold py-3 rounded-lg mt-2 transition-all"
              >
                {newTenantForm.plan_type === "trial_7d" ? "Launch 7-Day Free Trial Environment" : "Provision Subdomain Environment"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Configuration Settings Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-5 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-xl font-bold">Configure: {selectedTenant.name}</h3>
                <p className="text-xs text-[var(--text-muted)] font-mono">{selectedTenant.id}.omnysync.com</p>
              </div>
              <button onClick={() => setSelectedTenant(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Config Tabs */}
            <div className="flex border-b border-[var(--border-color)] gap-1">
              <button
                onClick={() => setActiveTab("branding")}
                className={`py-2 px-4 text-xs font-semibold transition-all border-b-2 flex items-center gap-1.5 min-h-[44px] ${
                  activeTab === "branding"
                    ? "border-teal-500 text-teal-500 font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                <Palette className="h-3.5 w-3.5" /> Branding & Trial
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Agency Name</label>
                    <input
                      type="text"
                      value={selectedTenant.name || ""}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant, name: e.target.value })}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Plan Type</label>
                    <select
                      value={selectedTenant.plan_type || "standard"}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant, plan_type: e.target.value })}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                    >
                      <option value="trial_7d">7-Day Free Trial</option>
                      <option value="monthly">Monthly Paid</option>
                      <option value="yearly">Yearly Paid</option>
                      <option value="standard">Lifetime / Standard</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-[var(--tr-hover)]/30 border border-[var(--border-color)]">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Subscription Status</label>
                    <select
                      value={selectedTenant.subscription_status || "active"}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant, subscription_status: e.target.value })}
                      className="w-full app-input rounded-lg p-2 focus:outline-none"
                    >
                      <option value="trialing">Trialing</option>
                      <option value="active">Active (Paid)</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Trial Ends On</label>
                    <input
                      type="date"
                      value={selectedTenant.trial_ends_at || ""}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant, trial_ends_at: e.target.value })}
                      className="w-full app-input rounded-lg p-2 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Account Access</label>
                    <select
                      value={selectedTenant.is_active ? "true" : "false"}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant, is_active: e.target.value === "true" })}
                      className="w-full app-input rounded-lg p-2 focus:outline-none"
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Primary Theme Color</label>
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
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Company Logo URL</label>
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
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Support Phone</label>
                    <input
                      type="text"
                      value={selectedTenant.branding_settings?.support_phone || ""}
                      onChange={(e) => updateBrandingSetting("support_phone", e.target.value)}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full btn-accent text-white font-semibold py-3 rounded-lg mt-2 transition-all"
                >
                  Save Tenant Settings & Subscription
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-xs max-h-[60vh] overflow-y-auto pr-1">
                <div className="space-y-3">
                  <h5 className="font-bold text-teal-500 border-b border-[var(--border-color)] pb-1.5 uppercase tracking-wider text-[10px]">Platform Modules</h5>
                  {[
                    { flag: "dashboard", label: "Dashboard Hub", desc: "Main KPIs, fleet alerts and live overview" },
                    { flag: "fleet", label: "Fleet & Chassis Management", desc: "Vehicles, chassis numbers, odometer & docs" },
                    { flag: "customers", label: "Customers & KYC / Guarantors", desc: "Client profiles, cheque, passport & 2 guarantors details" },
                    { flag: "leads", label: "Leads CRM", desc: "Prospects pipeline, follow-ups & conversion" },
                    { flag: "quotations", label: "Invoice Quotations", desc: "PDF price estimates and client quotes" },
                    { flag: "bookings", label: "Bookings Scheduler", desc: "Reservations, contracts & billing" },
                    { flag: "receipts", label: "Receipt Generator", desc: "Official payment, deposit & refund receipts" },
                    { flag: "employees", label: "Employee & Payroll Management", desc: "Staff, drivers, salaries & payment logs" },
                    { flag: "maintenance", label: "Maintenance & Tax Ledger", desc: "Service logs, oil alerts & token tax" },
                    { flag: "blacklist", label: "Blacklist Shield", desc: "High-risk CNIC blocklist" },
                    { flag: "whatsapp_api", label: "WhatsApp Messaging", desc: "Direct WhatsApp receipts, quotes & follow-ups" },
                    { flag: "advanced_analytics", label: "Vehicle Lifecycle Analytics", desc: "Revenue charts and profit reports" },
                    { flag: "chauffeur_module", label: "Chauffeur Rental Module", desc: "Chauffeur daily wage calculations" },
                    { flag: "suppliers", label: "Suppliers & Sublet Deals", desc: "Outsourced cars, supplier rent costs, client markups & net profit" }
                  ].map(mod => {
                    const isEnabled = (selectedTenant.feature_flags || []).includes(mod.flag);
                    return (
                      <div key={mod.flag} className="flex justify-between items-center p-3 bg-[var(--tr-hover)]/30 border border-[var(--border-color)] rounded-xl">
                        <div className="flex-1 pr-4">
                          <h5 className="font-bold text-[var(--text-main)] text-xs">{mod.label}</h5>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{mod.desc}</p>
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
