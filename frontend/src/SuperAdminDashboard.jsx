import React, { useState, useEffect } from "react";
import {
  Server, Users, BarChart3, Plus, X, Palette, CheckCircle,
  ShieldAlert, Sliders, Clock, Trash2, Power, Sparkles, ExternalLink, Car,
  Lock, KeyRound, Eye, EyeOff, Copy, ArrowRight, ShieldCheck, RefreshCw, LogOut
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

function slugify(text) {
  return (text || "")
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generatePassword(name) {
  const clean = (name || "Rental").replace(/[^a-zA-Z0-9]/g, "");
  const prefix = clean.length >= 3 ? clean.charAt(0).toUpperCase() + clean.slice(1, 5) : "Car";
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}#${num}!`;
}

export default function SuperAdminDashboard({ userRole, setUserRole, onLoginAsTenant }) {
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("saas_super_admin_token") || "";
    }
    return "";
  });

  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authenticating, setAuthenticating] = useState(false);

  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auto-slug control
  const [isSlugManual, setIsSlugManual] = useState(false);

  const defaultForm = () => {
    const initialPass = generatePassword("Agency");
    return {
      id: "",
      name: "",
      logo_url: "",
      primary_theme_color: "#0d9488",
      contact_name: "",
      operational_manager: "Manager",
      plan_type: "trial_7d",
      subscription_status: "trialing",
      trial_ends_at: addDaysISO(7),
      is_active: true,
      admin_username: "",
      admin_password: initialPass,
      admin_email: "",
      feature_flags: [...ALL_FLAGS],
      branding_settings: {
        support_email: "support@omnysync.com",
        support_phone: "0300-1234567",
        hub_label: "Main Hub",
        address: "Lahore, Pakistan",
        footer_status_text: "Cloud SaaS Platform",
        bg_gradient_start: "#0d9488"
      }
    };
  };

  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [newTenantForm, setNewTenantForm] = useState(defaultForm);
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Success Handoff Modal
  const [provisionedHandoff, setProvisionedHandoff] = useState(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Config Modal State
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [activeTab, setActiveTab] = useState("branding"); // "branding" | "features" | "subscription"

  // Reset Password Modal
  const [resetTargetTenant, setResetTargetTenant] = useState(null);
  const [newResetPassword, setNewResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchTenants = async () => {
    if (!adminToken) return;
    setLoading(true);
    try {
      const headers = {
        "Authorization": `Bearer ${adminToken}`,
        "X-Test-Role": "super_admin"
      };
      const [tRes, sRes] = await Promise.all([
        fetch("/api/saas-admin/tenants", { headers }),
        fetch("/api/saas-admin/stats", { headers })
      ]);
      if (tRes.status === 401 || tRes.status === 403) {
        localStorage.removeItem("saas_super_admin_token");
        setAdminToken("");
        return;
      }
      if (tRes.ok) setTenants(await tRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminToken) {
      fetchTenants();
    }
  }, [adminToken]);

  const handleSuperAdminLogin = async (e) => {
    e.preventDefault();
    setAuthenticating(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth/super-admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("saas_super_admin_token", data.access_token);
        setAdminToken(data.access_token);
        setPasswordInput("");
      } else {
        const err = await res.json();
        setAuthError(err.detail || "Invalid Super Admin Master Password");
      }
    } catch {
      setAuthError("Connection error while validating credentials.");
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLockAdmin = () => {
    localStorage.removeItem("saas_super_admin_token");
    setAdminToken("");
    if (setUserRole) setUserRole("tenant_admin");
    if (typeof window !== "undefined" && window.location.hash === "#admin") {
      window.location.hash = "";
    }
  };

  // Auto-slug & Auto-credentials sync on Agency Name change
  const handleAgencyNameChange = (val) => {
    const autoSlug = slugify(val);
    setNewTenantForm(prev => {
      const updated = { ...prev, name: val };
      if (!isSlugManual) {
        updated.id = autoSlug;
        updated.admin_username = autoSlug ? `admin@${autoSlug}.com` : "";
        updated.admin_email = autoSlug ? `admin@${autoSlug}.com` : "";
      }
      if (!prev.contact_name) {
        updated.contact_name = "Manager";
      }
      updated.branding_settings = {
        ...prev.branding_settings,
        hub_label: val ? `${val} Main Hub` : "Main Hub"
      };
      return updated;
    });
  };

  const handleRegeneratePassword = () => {
    const newPass = generatePassword(newTenantForm.name || newTenantForm.id);
    setNewTenantForm(prev => ({ ...prev, admin_password: newPass }));
  };

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
      id: newTenantForm.id.toLowerCase().trim(),
      admin_username: newTenantForm.admin_username || `admin_${newTenantForm.id}`,
      admin_password: newTenantForm.admin_password || `${newTenantForm.id}#2026!`,
      admin_email: newTenantForm.admin_email || `admin@${newTenantForm.id}.com`,
      trial_ends_at: newTenantForm.trial_ends_at || null
    };

    try {
      const res = await fetch("/api/saas-admin/tenants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`,
          "X-Test-Role": "super_admin"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setShowProvisionModal(false);
        setProvisionedHandoff({
          tenant: data.tenant || payload,
          credentials: data.credentials ? {
            ...data.credentials,
            login_url: payload.id === "default" ? "https://racms.omnysync.com" : `https://racms.omnysync.com/?tenant=${payload.id}`
          } : {
            subdomain: payload.id,
            login_url: payload.id === "default" ? "https://racms.omnysync.com" : `https://racms.omnysync.com/?tenant=${payload.id}`,
            username: payload.admin_username,
            password: payload.admin_password,
            email: payload.admin_email
          }
        });
        setNewTenantForm(defaultForm());
        setIsSlugManual(false);
        fetchTenants();
      } else {
        const err = await res.json();
        alert(err.detail || "Error provisioning tenant");
      }
    } catch {
      alert("Error sending provisioning request.");
    }
  };

  const copyClientInvite = () => {
    if (!provisionedHandoff) return;
    const { tenant, credentials } = provisionedHandoff;
    const text = `🚗 *Welcome to your Rent-A-Car Management Platform!*\n\n` +
      `Your agency cloud workspace has been activated:\n` +
      `🏢 *Agency:* ${tenant.name}\n` +
      `🌐 *Web Portal:* ${credentials.login_url || `https://${credentials.subdomain}.racms.omnysync.com`}\n` +
      `👤 *Admin Username:* ${credentials.username}\n` +
      `🔑 *Initial Password:* ${credentials.password}\n` +
      `⏳ *Plan:* ${tenant.plan_type === "trial_7d" ? "7-Day Free Trial (Active)" : "Active Plan"}\n\n` +
      `You can immediately log in to manage your Fleet (chassis numbers), Customers (cheques, passport, KYC), Bookings, Multi-vehicle Quotations, Invoices, Receipts, and Letterhead.\n\n` +
      `Support: ${tenant.branding_settings?.support_phone || "0300-1234567"}`;

    navigator.clipboard.writeText(text);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 3000);
  };

  const handleLoginAsTenantClick = (tenantId) => {
    if (onLoginAsTenant) {
      onLoginAsTenant(tenantId);
    } else {
      localStorage.setItem("active_tenant_id", tenantId);
      if (setUserRole) setUserRole("tenant_admin");
      if (typeof window !== "undefined") {
        window.location.hash = "";
        window.location.reload();
      }
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
        "Authorization": `Bearer ${adminToken}`,
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
        "Authorization": `Bearer ${adminToken}`,
        "X-Test-Role": "super_admin"
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const updatedTenant = await res.json();
      setSelectedTenant(updatedTenant);
      setTenants(tenants.map(t => t.id === updatedTenant.id ? updatedTenant : t));
      alert("Tenant settings saved.");
    }
  };

  const handleExtendTrial = async (tenantId, days = 7) => {
    const res = await fetch(`/api/saas-admin/tenants/${tenantId}/extend-trial?days=${days}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "X-Test-Role": "super_admin"
      }
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
        "Authorization": `Bearer ${adminToken}`,
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
    if (!window.confirm(`Delete tenant '${tenantId}' permanently? All associated users and settings will be removed.`)) return;
    const res = await fetch(`/api/saas-admin/tenants/${tenantId}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${adminToken}`,
        "X-Test-Role": "super_admin"
      }
    });
    if (res.ok) fetchTenants();
    else {
      const err = await res.json();
      alert(err.detail || "Cannot delete tenant");
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetTargetTenant || !newResetPassword.trim()) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/saas-admin/tenants/${resetTargetTenant.id}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`,
          "X-Test-Role": "super_admin"
        },
        body: JSON.stringify({ new_password: newResetPassword.trim() })
      });
      if (res.ok) {
        alert(`Password for tenant '${resetTargetTenant.id}' updated successfully!`);
        setResetTargetTenant(null);
        setNewResetPassword("");
      } else {
        const err = await res.json();
        alert(err.detail || "Error resetting password");
      }
    } catch {
      alert("Failed to reset password.");
    } finally {
      setResetting(false);
    }
  };

  // --- PASSWORD LOCK GATE (IF NOT AUTHENTICATED) ---
  if (!adminToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] p-4">
        <div className="glass-panel w-full max-w-md p-8 rounded-2xl border border-[var(--border-color)] shadow-2xl text-center space-y-6">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-inner">
            <Lock className="h-8 w-8" />
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-teal-500 bg-teal-500/10 px-2.5 py-1 rounded-full border border-teal-500/20">
              Restricted Operator Access
            </span>
            <h2 className="text-2xl font-extrabold mt-3">SaaS Super Admin Gate</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              Enter the Super Admin master password to manage multi-tenant environments, trials, and credentials.
            </p>
          </div>

          <form onSubmit={handleSuperAdminLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Master Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  placeholder="Enter Master Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full app-input rounded-xl py-2.5 pl-3 pr-10 text-sm focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authenticating}
              className="w-full btn-accent text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              {authenticating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {authenticating ? "Verifying..." : "Unlock Operator Console"}
            </button>
          </form>

          <div className="pt-2 border-t border-[var(--border-color)]">
            <button
              type="button"
              onClick={() => {
                if (setUserRole) setUserRole("tenant_admin");
                if (typeof window !== "undefined" && window.location.hash === "#admin") {
                  window.location.hash = "";
                }
              }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] hover:underline"
            >
              ← Return to Agency Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- SUPER ADMIN AUTHENTICATED CONSOLE ---
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] p-4 sm:p-8 space-y-8">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-[var(--border-color)] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 text-[10px] font-extrabold uppercase px-3 py-1 rounded-full tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" /> Super Admin Active
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mt-2 text-[var(--text-main)]">Omnysync Multi-Tenant Platform</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Provision client subdomains, auto-generate credentials, activate 7-day free trials, and initialize isolated workspaces.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => { setNewTenantForm(defaultForm()); setIsSlugManual(false); setShowProvisionModal(true); }}
            className="btn-accent text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 shadow-md min-h-[44px]"
          >
            <Plus className="h-4 w-4" /> + Provision New Tenant / 7d Trial
          </button>

          <button
            onClick={handleLockAdmin}
            className="py-2.5 px-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-bold text-xs flex items-center gap-1.5 transition-colors"
            title="Lock Super Admin and return to workspace"
          >
            <LogOut className="h-4 w-4" /> Lock & Exit
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
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Total Active Tenants</span>
            <span className="block text-2xl font-extrabold mt-0.5">{stats?.total_tenants ?? tenants.length} Agencies</span>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] flex items-center gap-4">
          <div className="bg-amber-500/10 p-3 rounded-xl">
            <Clock className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">7-Day Free Trials Active</span>
            <span className="block text-2xl font-extrabold mt-0.5">{stats?.trial_tenants ?? tenants.filter(t => t.subscription_status === "trialing").length} Trials</span>
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
          <p className="text-sm text-[var(--text-muted)] py-12 text-center italic">No tenants provisioned yet. Add your first tenant!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--tr-hover)] text-[var(--text-muted)] border-b border-[var(--border-color)] uppercase font-semibold">
                  <th className="p-4">Agency Details</th>
                  <th className="p-4">Subdomain & Portal</th>
                  <th className="p-4">Plan & Trial</th>
                  <th className="p-4">Status</th>
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
                      <td className="p-4">
                        <div className="flex flex-col gap-0.5">
                          <a
                            href={t.id === "default" ? "https://racms.omnysync.com" : `https://racms.omnysync.com/?tenant=${t.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-400 font-bold inline-flex items-center gap-1 hover:underline text-xs"
                          >
                            {t.id === "default" ? "racms.omnysync.com" : `racms.omnysync.com/?tenant=${t.id}`}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          {t.id !== "default" && (
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                              subdomain: {t.id}.omnysync.com
                            </span>
                          )}
                        </div>
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
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleLoginAsTenantClick(t.id)}
                            title="Open & Login to this Tenant's workspace"
                            className="py-1.5 px-2.5 rounded-lg bg-teal-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm hover:brightness-110"
                          >
                            <ArrowRight className="h-3 w-3" /> Login as Tenant
                          </button>

                          <button
                            onClick={() => { setResetTargetTenant(t); setNewResetPassword(generatePassword(t.name)); }}
                            title="Reset or Change Password"
                            className="py-1.5 px-2.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-teal-500 font-semibold text-[11px] flex items-center gap-1"
                          >
                            <KeyRound className="h-3 w-3 text-amber-500" /> Password
                          </button>

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

      {/* PROVISIONING MODAL WITH AUTO-SLUG & AUTO-CREDENTIALS */}
      {showProvisionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-5 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-xl font-bold">Provision New SaaS Tenant</h3>
                <p className="text-xs text-[var(--text-muted)]">Subdomain, database isolation, and initial credentials will be created automatically.</p>
              </div>
              <button onClick={() => setShowProvisionModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-4 text-xs">
              {/* Plan Selector */}
              <div className="p-3.5 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-2">
                <label className="block font-bold text-[var(--text-main)]">Subscription Plan</label>
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
                          ? "bg-teal-500 text-white border-teal-500 shadow-sm"
                          : "bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-muted)]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {newTenantForm.plan_type === "trial_7d" && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-amber-500 font-semibold">Trial automatically ends on:</span>
                    <input
                      type="date"
                      value={newTenantForm.trial_ends_at}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, trial_ends_at: e.target.value })}
                      className="app-input rounded-lg px-2 py-1 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Agency Name (Typing auto-slugs and auto-generates username & password) */}
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Agency Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Azeem Rent A Car"
                  value={newTenantForm.name}
                  onChange={(e) => handleAgencyNameChange(e.target.value)}
                  className="w-full app-input rounded-lg p-2.5 focus:outline-none text-sm font-semibold"
                />
              </div>

              {/* Auto-Subdomain Prefix */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[var(--text-muted)]">Subdomain Prefix *</label>
                  <span className="text-[10px] text-teal-400 font-mono">Auto-generated</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. azeem"
                    value={newTenantForm.id}
                    onChange={(e) => {
                      setIsSlugManual(true);
                      setNewTenantForm({ ...newTenantForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") });
                    }}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none font-mono text-sm"
                  />
                </div>
                <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                  Live Portal: <strong className="text-teal-400">https://racms.omnysync.com/?tenant={newTenantForm.id || "subdomain"}</strong>
                </span>
              </div>

              {/* Credentials Section */}
              <div className="p-3.5 rounded-xl border border-teal-500/30 bg-teal-500/5 space-y-3">
                <div className="flex items-center gap-2 text-teal-400 font-bold text-xs">
                  <KeyRound className="h-4 w-4" />
                  <span>Tenant Admin Initial Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Admin Username / Email</label>
                    <input
                      type="text"
                      required
                      value={newTenantForm.admin_username}
                      onChange={(e) => setNewTenantForm({ ...newTenantForm, admin_username: e.target.value })}
                      placeholder="admin@agency.com"
                      className="w-full app-input rounded-lg p-2 focus:outline-none font-mono text-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">Initial Password</label>
                      <button
                        type="button"
                        onClick={handleRegeneratePassword}
                        className="text-[10px] text-teal-400 hover:underline"
                      >
                        Generate New
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showFormPassword ? "text" : "password"}
                        required
                        value={newTenantForm.admin_password}
                        onChange={(e) => setNewTenantForm({ ...newTenantForm, admin_password: e.target.value })}
                        className="w-full app-input rounded-lg p-2 pr-8 focus:outline-none font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFormPassword(!showFormPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      >
                        {showFormPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Person Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Contact Person Name</label>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={newTenantForm.contact_name}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, contact_name: e.target.value })}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Support Phone</label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={newTenantForm.branding_settings.support_phone}
                    onChange={(e) => setNewTenantForm({
                      ...newTenantForm,
                      branding_settings: { ...newTenantForm.branding_settings, support_phone: e.target.value }
                    })}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* Theme Color */}
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Primary Theme Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newTenantForm.primary_theme_color}
                    onChange={(e) => setNewTenantForm({ ...newTenantForm, primary_theme_color: e.target.value })}
                    className="h-10 w-16 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-1 cursor-pointer"
                  />
                  <span className="font-mono text-xs">{newTenantForm.primary_theme_color}</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full btn-accent text-white font-bold py-3.5 rounded-xl mt-3 transition-all shadow-lg text-sm flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {newTenantForm.plan_type === "trial_7d" ? "Launch 7-Day Free Trial Environment" : "Provision Tenant Environment"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PROVISION SUCCESS & CREDENTIALS HANDOFF MODAL */}
      {provisionedHandoff && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 border border-teal-500/40 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                  Ready & Initialized
                </span>
                <h3 className="text-xl font-bold mt-1 text-[var(--text-main)]">Tenant Provisioned Successfully!</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  The tenant database environment is initialized. Deliver these credentials to the client.
                </p>
              </div>
            </div>

            {/* Credentials Card */}
            <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] space-y-2.5 text-xs font-mono">
              <div className="flex justify-between items-center py-1 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)]">Agency Name:</span>
                <span className="font-bold font-sans text-sm text-[var(--text-main)]">{provisionedHandoff.tenant.name}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)]">Web Portal URL:</span>
                <a
                  href={provisionedHandoff.credentials.login_url || `https://racms.omnysync.com/?tenant=${provisionedHandoff.tenant.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-teal-400 hover:underline"
                >
                  {provisionedHandoff.credentials.login_url || `https://racms.omnysync.com/?tenant=${provisionedHandoff.tenant.id}`}
                </a>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)]">Username:</span>
                <span className="font-bold text-[var(--text-main)]">{provisionedHandoff.credentials.username}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[var(--border-color)]">
                <span className="text-[var(--text-muted)]">Password:</span>
                <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {provisionedHandoff.credentials.password}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--text-muted)]">Subscription:</span>
                <span className="font-bold text-emerald-400">
                  {provisionedHandoff.tenant.plan_type === "trial_7d" ? `7-Day Free Trial (Ends ${provisionedHandoff.tenant.trial_ends_at})` : "Active"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={copyClientInvite}
                className="w-full py-3 px-4 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25 font-bold text-xs flex items-center justify-center gap-2 transition-all"
              >
                {copiedInvite ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                {copiedInvite ? "Copied to Clipboard!" : "Copy Full WhatsApp / Email Client Invite"}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleLoginAsTenantClick(provisionedHandoff.tenant.id)}
                  className="btn-accent text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md"
                >
                  <ArrowRight className="h-4 w-4" /> Open & Login as Tenant
                </button>
                <button
                  type="button"
                  onClick={() => setProvisionedHandoff(null)}
                  className="py-2.5 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTargetTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4 border border-[var(--border-color)]">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border-color)]">
              <div>
                <h3 className="font-bold text-base">Reset Tenant Password</h3>
                <p className="text-xs text-[var(--text-muted)]">{resetTargetTenant.name} ({resetTargetTenant.id})</p>
              </div>
              <button onClick={() => setResetTargetTenant(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-[var(--text-muted)]">New Password</label>
                  <button
                    type="button"
                    onClick={() => setNewResetPassword(generatePassword(resetTargetTenant.name))}
                    className="text-[10px] text-teal-400 hover:underline"
                  >
                    Generate New
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full app-input rounded-lg p-2.5 font-mono text-xs focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResetTargetTenant(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-[var(--border-color)] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="w-1/2 btn-accent text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-1"
                >
                  {resetting ? "Saving..." : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TENANT CONFIGURATION MODAL */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-xl font-bold">{selectedTenant.name}</h3>
                <span className="text-xs text-[var(--text-muted)] font-mono">{selectedTenant.id}.omnysync.com</span>
              </div>
              <button onClick={() => setSelectedTenant(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] min-h-[44px] min-w-[44px] flex items-center justify-center">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex border-b border-[var(--border-color)] gap-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("branding")}
                className={`pb-2.5 border-b-2 transition-all ${activeTab === "branding" ? "border-teal-500 text-teal-400" : "border-transparent text-[var(--text-muted)]"}`}
              >
                Branding & Details
              </button>
              <button
                onClick={() => setActiveTab("features")}
                className={`pb-2.5 border-b-2 transition-all ${activeTab === "features" ? "border-teal-500 text-teal-400" : "border-transparent text-[var(--text-muted)]"}`}
              >
                Module Flags
              </button>
            </div>

            {activeTab === "branding" && (
              <form onSubmit={handleBrandingSave} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[var(--text-muted)] mb-1">Agency Name</label>
                    <input
                      type="text"
                      value={selectedTenant.name}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant, name: e.target.value })}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-muted)] mb-1">Primary Theme Color</label>
                    <input
                      type="color"
                      value={selectedTenant.primary_theme_color || "#0d9488"}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant, primary_theme_color: e.target.value })}
                      className="w-full h-10 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-1 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[var(--text-muted)] mb-1">Contact Person</label>
                    <input
                      type="text"
                      value={selectedTenant.contact_name}
                      onChange={(e) => setSelectedTenant({ ...selectedTenant, contact_name: e.target.value })}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[var(--text-muted)] mb-1">Plan</label>
                    <select
                      value={selectedTenant.plan_type}
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

                <div className="flex justify-end gap-2 pt-3">
                  <button type="button" onClick={() => setSelectedTenant(null)} className="px-4 py-2 rounded-lg border border-[var(--border-color)]">
                    Cancel
                  </button>
                  <button type="submit" className="btn-accent px-5 py-2 rounded-lg font-bold text-white">
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {activeTab === "features" && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--text-muted)]">Toggle which features and views are active for this tenant:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_FLAGS.map(flag => {
                    const active = (selectedTenant.feature_flags || []).includes(flag);
                    return (
                      <button
                        key={flag}
                        type="button"
                        onClick={() => handleFeatureToggle(flag)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                          active
                            ? "bg-teal-500/15 border-teal-500/30 text-teal-400"
                            : "bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-muted)]"
                        }`}
                      >
                        <span className="capitalize">{flag.replace(/_/g, " ")}</span>
                        <CheckCircle className={`h-4 w-4 ${active ? "opacity-100" : "opacity-20"}`} />
                      </button>
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
