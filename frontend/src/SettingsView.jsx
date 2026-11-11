import React, { useState, useEffect } from "react";
import { Settings, Upload, Palette, Building2, Landmark, FileText, CheckCircle, Download, Trash2, Sparkles } from "lucide-react";
import { generateLetterheadPDF } from "./pdfTemplates";

const COLOR_PRESETS = [
  { name: "Teal", hex: "#0d9488" },
  { name: "Amber Gold", hex: "#e68a1e" },
  { name: "Royal Blue", hex: "#2563eb" },
  { name: "Emerald", hex: "#059669" },
  { name: "Crimson", hex: "#e11d48" },
  { name: "Indigo", hex: "#4f46e5" },
];

export default function SettingsView({ branding, setBranding }) {
  const s = branding?.branding_settings || {};
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const [form, setForm] = useState({
    name: branding?.name || "Rent A Car Management System",
    logo_url: branding?.logo_url || "",
    primary_theme_color: branding?.primary_theme_color || "#0d9488",
    tagline: s.tagline || "TOURS & TRAVELS",
    hub_label: s.hub_label || "Lahore Hub",
    address: s.address || "Lahore, Pakistan",
    support_phone: s.support_phone || "0300-1234567",
    support_email: s.support_email || "support@rentacarmanagement.com",
    website: s.website || "racms.omnysync.com",
    ntn: s.ntn || "",
    bank_name: s.bank_name || "",
    account_title: s.account_title || branding?.name || "",
    account_number: s.account_number || "",
    pdf_accent_color: s.pdf_accent_color || "#e68a1e",
    sign_label: s.sign_label || "sign",
    footer_status_text: s.footer_status_text || "Cloud SaaS Ready",
    terms_and_conditions: s.terms_and_conditions ||
      "By accepting this invoice, you agree to the rental period, payment terms, security deposit, responsible vehicle use, damage responsibility, maintenance coverage, insurance terms, liability waiver, cancellation policy, and dispute resolution."
  });

  useEffect(() => {
    const bs = branding?.branding_settings || {};
    setForm({
      name: branding?.name || "Rent A Car Management System",
      logo_url: branding?.logo_url || "",
      primary_theme_color: branding?.primary_theme_color || "#0d9488",
      tagline: bs.tagline || "TOURS & TRAVELS",
      hub_label: bs.hub_label || "Lahore Hub",
      address: bs.address || "Lahore, Pakistan",
      support_phone: bs.support_phone || "0300-1234567",
      support_email: bs.support_email || "support@rentacarmanagement.com",
      website: bs.website || "racms.omnysync.com",
      ntn: bs.ntn || "",
      bank_name: bs.bank_name || "",
      account_title: bs.account_title || branding?.name || "",
      account_number: bs.account_number || "",
      pdf_accent_color: bs.pdf_accent_color || "#e68a1e",
      sign_label: bs.sign_label || "sign",
      footer_status_text: bs.footer_status_text || "Cloud SaaS Ready",
      terms_and_conditions: bs.terms_and_conditions ||
        "By accepting this invoice, you agree to the rental period, payment terms, security deposit, responsible vehicle use, damage responsibility, maintenance coverage, insurance terms, liability waiver, cancellation policy, and dispute resolution."
    });
  }, [branding]);

  const applyThemeColorLive = (hex) => {
    setForm(prev => ({ ...prev, primary_theme_color: hex }));
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      document.documentElement.style.setProperty("--accent-color", hex);
      document.documentElement.style.setProperty("--accent-hover", hex + "dd");
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tenant/upload-logo", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setForm(prev => ({ ...prev, logo_url: data.logo_url }));
        if (setBranding) setBranding(prev => ({ ...prev, logo_url: data.logo_url }));
      } else {
        const err = await res.json();
        alert(err.detail || "Logo upload failed.");
      }
    } catch {
      alert("Error uploading logo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/tenant/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          logo_url: form.logo_url,
          primary_theme_color: form.primary_theme_color,
          branding_settings: {
            tagline: form.tagline,
            hub_label: form.hub_label,
            address: form.address,
            support_phone: form.support_phone,
            support_email: form.support_email,
            website: form.website,
            ntn: form.ntn,
            bank_name: form.bank_name,
            account_title: form.account_title,
            account_number: form.account_number,
            pdf_accent_color: form.pdf_accent_color,
            sign_label: form.sign_label,
            footer_status_text: form.footer_status_text,
            terms_and_conditions: form.terms_and_conditions
          }
        })
      });
      if (res.ok) {
        const updated = await res.json();
        if (setBranding) setBranding(prev => ({ ...prev, ...updated }));
        applyThemeColorLive(form.primary_theme_color);
        setSavedToast(true);
        setTimeout(() => setSavedToast(false), 3500);
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to save settings.");
      }
    } finally {
      setSaving(false);
    }
  };

  const previewBranding = {
    ...branding,
    name: form.name,
    logo_url: form.logo_url,
    primary_theme_color: form.primary_theme_color,
    branding_settings: {
      ...(branding?.branding_settings || {}),
      ...form
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Agency Settings & White-Label Studio</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Customize your logo, app colors, letterhead design, NTN, bank account, and invoice terms.</p>
        </div>
        <button
          type="button"
          onClick={() => generateLetterheadPDF({ letter_date: "", letter_number: "", recipient: "", subject: "", body: "" }, previewBranding)}
          className="py-2.5 px-4 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25 font-semibold text-xs flex items-center gap-2 min-h-[44px]"
        >
          <Download className="h-4 w-4" /> Preview Sample Letterhead PDF
        </button>
      </div>

      {savedToast && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs font-bold flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          All white-label branding, theme colors, bank details, and letterhead settings saved!
        </div>
      )}

      {/* LIVE LETTERHEAD PREVIEW BANNER */}
      <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Live Letterhead & Invoice Header Preview
          </span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">Updates live as you edit below</span>
        </div>
        <div
          className="rounded-xl overflow-hidden shadow-md text-slate-950 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          style={{ backgroundColor: form.pdf_accent_color || "#e68a1e" }}
        >
          <div className="flex items-center gap-4">
            {form.logo_url && (
              <img
                src={form.logo_url}
                alt="Agency Logo"
                className="h-14 w-20 object-contain bg-slate-950/90 rounded-lg p-1.5 shadow"
              />
            )}
            <div>
              <h3 className="text-xl font-black tracking-wide uppercase leading-tight">{form.name || "RENT A CAR MANAGEMENT SYSTEM"}</h3>
              <p className="text-xs font-bold uppercase tracking-widest opacity-85">{form.tagline || "TOURS & TRAVELS"}</p>
            </div>
          </div>
          <div className="text-[11px] font-semibold sm:text-right space-y-0.5">
            <div>{form.website} · {form.support_phone}</div>
            <div>{form.address} · {form.support_email}</div>
            {form.ntn && <div className="font-mono font-bold">NTN: {form.ntn}</div>}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* SECTION 1: LOGO & COLORS */}
        <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-6 space-y-5">
          <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--text-main)] border-b border-[var(--border-color)] pb-3">
            <Palette className="h-4 w-4 text-teal-500" /> Logo, Colors & App Branding
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Uploader */}
            <div className="space-y-2.5">
              <label className="block font-semibold text-[var(--text-muted)]">Company Logo (Sidebar, Invoices, Quotes & Letterhead)</label>
              <div className="flex items-center gap-4">
                {form.logo_url ? (
                  <div className="relative h-16 w-28 rounded-xl border border-[var(--border-color)] bg-slate-950 flex items-center justify-center p-2">
                    <img src={form.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, logo_url: "" }))}
                      className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 shadow"
                      title="Remove Logo"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-28 rounded-xl border border-dashed border-[var(--border-color)] flex items-center justify-center text-[10px] text-[var(--text-muted)]">
                    No Logo Set
                  </div>
                )}
                <div className="flex-1 space-y-2">
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 font-bold cursor-pointer hover:bg-teal-500/20">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploading ? "Uploading..." : "Upload Logo Image"}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  <input
                    type="text"
                    placeholder="Or paste logo image URL (/uploads/... or https://...)"
                    value={form.logo_url}
                    onChange={e => setForm({ ...form, logo_url: e.target.value })}
                    className="w-full app-input rounded-lg p-2 font-mono text-[11px]"
                  />
                </div>
              </div>
            </div>

            {/* Theme & PDF Color Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block font-semibold text-[var(--text-muted)]">Software UI Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.primary_theme_color}
                    onChange={e => applyThemeColorLive(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-[var(--border-color)] cursor-pointer p-1 bg-[var(--bg-app)]"
                  />
                  <input
                    type="text"
                    value={form.primary_theme_color}
                    onChange={e => applyThemeColorLive(e.target.value)}
                    className="flex-1 app-input rounded-lg p-2.5 font-mono"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => applyThemeColorLive(c.hex)}
                      title={c.name}
                      className="w-5 h-5 rounded-full border border-white/30 shadow-sm"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-semibold text-[var(--text-muted)]">PDF & Letterhead Accent Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.pdf_accent_color}
                    onChange={e => setForm({ ...form, pdf_accent_color: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-[var(--border-color)] cursor-pointer p-1 bg-[var(--bg-app)]"
                  />
                  <input
                    type="text"
                    value={form.pdf_accent_color}
                    onChange={e => setForm({ ...form, pdf_accent_color: e.target.value })}
                    className="flex-1 app-input rounded-lg p-2.5 font-mono"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setForm({ ...form, pdf_accent_color: c.hex })}
                      title={c.name}
                      className="w-5 h-5 rounded-full border border-white/30 shadow-sm"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Company / Agency Name *</label>
              <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Letterhead Tagline</label>
              <input type="text" value={form.tagline} onChange={e => setForm({ ...form, tagline: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="TOURS & TRAVELS" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Sidebar Location Label</label>
              <input type="text" value={form.hub_label} onChange={e => setForm({ ...form, hub_label: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="Lahore Hub" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Footer Status Text</label>
              <input type="text" value={form.footer_status_text} onChange={e => setForm({ ...form, footer_status_text: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
            </div>
          </div>
        </div>

        {/* SECTION 2: CONTACT, ADDRESS & NTN */}
        <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-6 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--text-main)] border-b border-[var(--border-color)] pb-3">
            <Building2 className="h-4 w-4 text-teal-500" /> Office Contact, Address & Tax (NTN)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Business Phone</label>
              <input type="text" value={form.support_phone} onChange={e => setForm({ ...form, support_phone: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="0322-8893-598" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Business Email</label>
              <input type="email" value={form.support_email} onChange={e => setForm({ ...form, support_email: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Website</label>
              <input type="text" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Office Address</label>
              <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="Mian Plaza, Johar Town, Lahore" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">NTN / Tax Registration No</label>
              <input type="text" value={form.ntn} onChange={e => setForm({ ...form, ntn: e.target.value })} className="w-full app-input rounded-lg p-2.5 font-mono" placeholder="3530120023371" />
            </div>
          </div>
        </div>

        {/* SECTION 3: BANK ACCOUNT DETAILS */}
        <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-6 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--text-main)] border-b border-[var(--border-color)] pb-3">
            <Landmark className="h-4 w-4 text-amber-500" /> Bank Account Details (Printed on Client Invoices)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Bank Name</label>
              <input type="text" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="Faysal Bank" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Account Title</label>
              <input type="text" value={form.account_title} onChange={e => setForm({ ...form, account_title: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Account No / IBAN</label>
              <input type="text" value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} className="w-full app-input rounded-lg p-2.5 font-mono" placeholder="3165787000004066" />
            </div>
          </div>
        </div>

        {/* SECTION 4: LETTERHEAD & INVOICE TERMS */}
        <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-6 space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--text-main)] border-b border-[var(--border-color)] pb-3">
            <FileText className="h-4 w-4 text-teal-500" /> Letterhead Signature & Default Terms
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Signature Line Label</label>
              <input type="text" value={form.sign_label} onChange={e => setForm({ ...form, sign_label: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="sign" />
            </div>
            <div className="sm:col-span-3">
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Default Invoice & Quotation Terms & Conditions</label>
              <textarea rows={3} value={form.terms_and_conditions} onChange={e => setForm({ ...form, terms_and_conditions: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="btn-accent text-white font-bold py-3.5 px-8 rounded-xl text-sm flex items-center gap-2 shadow-lg"
          >
            <Settings className="h-4 w-4" />
            {saving ? "Saving Changes..." : "Save All Customization & Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
