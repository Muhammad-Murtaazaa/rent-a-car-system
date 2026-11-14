import React, { useState } from "react";
import { Lock, Eye, EyeOff, ShieldCheck, ArrowRight, Car, AlertCircle } from "lucide-react";

export default function TenantPasswordGate({ branding, tenantId, onLoginSuccess }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const agencyName = branding?.name || (tenantId ? tenantId.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) : "Agency Workspace");
  const logoUrl = branding?.logo_url;
  const themeColor = branding?.primary_theme_color || "#0d9488";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter your password.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/tenant-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId || "default",
          username: username.trim(),
          password: password.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("active_tenant_id", data.tenant.id);
        localStorage.setItem("tenant_token", data.access_token);
        localStorage.setItem("tenant_user", JSON.stringify(data.user));
        if (onLoginSuccess) {
          onLoginSuccess(data.access_token, data.user);
        } else {
          window.location.reload();
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Incorrect username or password. Please try again.");
      }
    } catch {
      setError("Unable to connect to the server. Please check your network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-[#070b14] text-white relative overflow-hidden select-none">
      {/* Background ambient glowing spheres */}
      <div 
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[128px] opacity-25 pointer-events-none"
        style={{ backgroundColor: themeColor }}
      />
      <div 
        className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-[128px] opacity-20 pointer-events-none"
        style={{ backgroundColor: themeColor }}
      />

      <div className="w-full max-w-md relative z-10 animate-scale-up">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 backdrop-blur-2xl p-7 sm:p-9 shadow-2xl space-y-6">
          
          {/* Header & Logo */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-2.5 shadow-lg relative">
              {logoUrl ? (
                <img src={logoUrl} alt={agencyName} className="max-h-full max-w-full object-contain rounded" />
              ) : (
                <Car className="h-8 w-8 text-teal-400" />
              )}
              <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Lock className="h-3 w-3" />
              </div>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white capitalize">
                {agencyName}
              </h1>
              <div className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-[11px] font-mono text-teal-300">
                <span>🔒</span>
                <span>{tenantId ? `${tenantId}.omnysync.com` : "Private Workspace"}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
              This system is password-protected. Enter your agency credentials to unlock your workspace.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2 animate-shake">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Username / Email
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-mono"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter workspace password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950/70 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: themeColor,
                boxShadow: `0 4px 20px ${themeColor}40`
              }}
            >
              {loading ? (
                <span>Unlocking Workspace...</span>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Badges */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
              <span>TLS 256-Bit Encrypted</span>
            </div>
            <span>Omnysync Cloud</span>
          </div>

        </div>
      </div>
    </div>
  );
}
