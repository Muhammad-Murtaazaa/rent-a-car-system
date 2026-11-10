import React, { useState, useEffect } from "react";
import {
  FileText, Plus, Search, Trash2, X, Download, Send, Edit2,
  MinusCircle, Building2, ScrollText, Receipt, CheckCircle
} from "lucide-react";
import { generateVehiclesInvoicePDF, generateLetterheadPDF } from "./pdfTemplates";

export default function InvoicesLettersView({
  vehicleInvoices = [],
  officialLetters = [],
  cars = [],
  branding,
  setBranding,
  fetchData
}) {
  const [subTab, setSubTab] = useState("invoices"); // "invoices" | "letterhead" | "agency"
  const [search, setSearch] = useState("");
  const [showInvModal, setShowInvModal] = useState(false);
  const [editingInv, setEditingInv] = useState(null);

  const [showLetterModal, setShowLetterModal] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const bSettings = branding?.branding_settings || {};

  const emptyInvForm = {
    invoice_mode: "client", // "client" | "settlement"
    invoice_to: "",
    customer_phone: "",
    period_label: "",
    invoice_date: today,
    vehicle_items: [{ name: "", period: "1 Day", amount: "" }],
    expense_items: [],
    received_amount: 0,
    show_bank_details: true,
    bank_name: bSettings.bank_name || "",
    account_title: bSettings.account_title || branding?.name || "",
    account_number: bSettings.account_number || "",
    terms_text: bSettings.terms_and_conditions ||
      "By accepting this invoice, you agree to the rental period, payment terms, security deposit, responsible vehicle use, damage responsibility, maintenance coverage, insurance terms, liability waiver, cancellation policy, and dispute resolution.",
    status: "Unpaid"
  };
  const [invForm, setInvForm] = useState(emptyInvForm);

  const [letterForm, setLetterForm] = useState({
    letter_date: today,
    recipient: "",
    subject: "",
    body: ""
  });

  const [agencyForm, setAgencyForm] = useState({
    name: branding?.name || "Rent A Car Management System",
    tagline: bSettings.tagline || "TOURS & TRAVELS",
    address: bSettings.address || "Lahore, Pakistan",
    support_phone: bSettings.support_phone || "0300-1234567",
    support_email: bSettings.support_email || "support@rentacarmanagement.com",
    website: bSettings.website || "racms.omnysync.com",
    ntn: bSettings.ntn || "",
    bank_name: bSettings.bank_name || "",
    account_title: bSettings.account_title || branding?.name || "",
    account_number: bSettings.account_number || "",
    pdf_accent_color: bSettings.pdf_accent_color || "#e68a1e",
    terms_and_conditions: bSettings.terms_and_conditions ||
      "By accepting this invoice, you agree to the rental period, payment terms, security deposit, responsible vehicle use, damage responsibility, maintenance coverage, insurance terms, liability waiver, cancellation policy, and dispute resolution."
  });

  useEffect(() => {
    const s = branding?.branding_settings || {};
    setAgencyForm({
      name: branding?.name || "Rent A Car Management System",
      tagline: s.tagline || "TOURS & TRAVELS",
      address: s.address || "Lahore, Pakistan",
      support_phone: s.support_phone || "0300-1234567",
      support_email: s.support_email || "support@rentacarmanagement.com",
      website: s.website || "racms.omnysync.com",
      ntn: s.ntn || "",
      bank_name: s.bank_name || "",
      account_title: s.account_title || branding?.name || "",
      account_number: s.account_number || "",
      pdf_accent_color: s.pdf_accent_color || "#e68a1e",
      terms_and_conditions: s.terms_and_conditions ||
        "By accepting this invoice, you agree to the rental period, payment terms, security deposit, responsible vehicle use, damage responsibility, maintenance coverage, insurance terms, liability waiver, cancellation policy, and dispute resolution."
    });
  }, [branding]);

  useEffect(() => {
    if (editingInv) {
      setInvForm({
        invoice_mode: editingInv.invoice_mode || "client",
        invoice_to: editingInv.invoice_to || "",
        customer_phone: editingInv.customer_phone || "",
        period_label: editingInv.period_label || "",
        invoice_date: editingInv.invoice_date ? String(editingInv.invoice_date).slice(0, 10) : today,
        vehicle_items: editingInv.vehicle_items?.length ? editingInv.vehicle_items : [{ name: "", period: "1 Day", amount: "" }],
        expense_items: editingInv.expense_items || [],
        received_amount: editingInv.received_amount || 0,
        show_bank_details: editingInv.show_bank_details !== false,
        bank_name: editingInv.bank_name || bSettings.bank_name || "",
        account_title: editingInv.account_title || bSettings.account_title || branding?.name || "",
        account_number: editingInv.account_number || bSettings.account_number || "",
        terms_text: editingInv.terms_text || bSettings.terms_and_conditions || "",
        status: editingInv.status || "Unpaid"
      });
    }
  }, [editingInv, showInvModal]);

  const totalRent = (invForm.vehicle_items || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalExpense = (invForm.expense_items || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const receivedAmt = parseFloat(invForm.received_amount) || 0;
  const finalBalanceOrPayable = invForm.invoice_mode === "settlement" || (invForm.expense_items || []).length > 0
    ? totalRent - totalExpense
    : totalRent - receivedAmt;

  const addCommissionRow = (pct = 20) => {
    const amt = Math.round(totalRent * (pct / 100));
    setInvForm(prev => ({
      ...prev,
      expense_items: [...(prev.expense_items || []), { description: `Commission ${pct}%`, amount: amt }]
    }));
  };

  const handleSaveInvoice = async (e) => {
    e.preventDefault();
    const vItems = (invForm.vehicle_items || [])
      .filter(v => v.name.trim() !== "")
      .map(v => ({ name: v.name.trim(), period: v.period || "1 Day", amount: parseFloat(v.amount) || 0 }));
    if (vItems.length === 0) return alert("Add at least one vehicle line item.");

    const eItems = (invForm.expense_items || [])
      .filter(ex => ex.description.trim() !== "")
      .map(ex => ({ description: ex.description.trim(), amount: parseFloat(ex.amount) || 0 }));

    const method = editingInv ? "PUT" : "POST";
    const url = editingInv ? `/api/vehicle-invoices/${editingInv.id}` : "/api/vehicle-invoices";
    const payload = {
      ...invForm,
      vehicle_items: vItems,
      expense_items: eItems,
      total_rent: totalRent,
      total_expense: totalExpense,
      received_amount: receivedAmt,
      payable_or_balance: finalBalanceOrPayable
    };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setShowInvModal(false);
      setEditingInv(null);
      setInvForm(emptyInvForm);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.detail || "Failed to save invoice.");
    }
  };

  const handleDeleteInvoice = async (id) => {
    if (!window.confirm("Delete this invoice?")) return;
    const res = await fetch(`/api/vehicle-invoices/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const handleSaveLetter = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/letters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(letterForm)
    });
    if (res.ok) {
      const created = await res.json();
      setShowLetterModal(false);
      setLetterForm({ letter_date: today, recipient: "", subject: "", body: "" });
      generateLetterheadPDF(created, branding);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.detail || "Failed to save letter.");
    }
  };

  const handleDeleteLetter = async (id) => {
    if (!window.confirm("Delete this letter record?")) return;
    const res = await fetch(`/api/letters/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const handleSaveAgencyProfile = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/tenant/branding", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: agencyForm.name,
        branding_settings: {
          tagline: agencyForm.tagline,
          address: agencyForm.address,
          support_phone: agencyForm.support_phone,
          support_email: agencyForm.support_email,
          website: agencyForm.website,
          ntn: agencyForm.ntn,
          bank_name: agencyForm.bank_name,
          account_title: agencyForm.account_title,
          account_number: agencyForm.account_number,
          pdf_accent_color: agencyForm.pdf_accent_color,
          terms_and_conditions: agencyForm.terms_and_conditions
        }
      })
    });
    if (res.ok) {
      const updated = await res.json();
      if (setBranding) setBranding(prev => ({ ...prev, ...updated }));
      alert("Agency PDF & Bank Profile saved! All invoices, quotes & letterheads will use these details.");
    } else {
      alert("Failed to save agency settings.");
    }
  };

  const sendInvoiceWhatsApp = (inv) => {
    const clean = (inv.customer_phone || "").replace(/[^0-9]/g, "");
    if (!clean) return alert("No phone number on this invoice.");
    const num = clean.startsWith("0") ? "92" + clean.substring(1) : clean;
    const brand = branding?.name || "Rent A Car Management System";
    const lines = (inv.vehicle_items || []).map(v => `• ${v.name} (${v.period}): PKR ${Number(v.amount).toLocaleString()}`).join("\n");
    const isSettlement = inv.invoice_mode === "settlement" || (inv.expense_items || []).length > 0;
    const text =
      `*VEHICLES INVOICE #${inv.invoice_number || inv.id}* - ${brand}\n` +
      `To: ${inv.invoice_to}${inv.period_label ? ` (${inv.period_label})` : ""}\n\n` +
      `${lines}\n` +
      `Total Rent: PKR ${Number(inv.total_rent).toLocaleString()}\n` +
      (isSettlement
        ? `Expenses: PKR ${Number(inv.total_expense).toLocaleString()}\n*Payable Amount: PKR ${Number(inv.payable_or_balance).toLocaleString()}*`
        : `Received: PKR ${Number(inv.received_amount).toLocaleString()}\n*Balance Due: PKR ${Number(inv.payable_or_balance).toLocaleString()}*`);
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const filteredInvoices = vehicleInvoices.filter(i =>
    i.invoice_to?.toLowerCase().includes(search.toLowerCase()) ||
    (i.invoice_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (i.period_label || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Invoices & Official Letterhead</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Generate multi-vehicle client invoices, owner settlement statements with expenses, and official letterheads.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {subTab === "invoices" && (
            <>
              <button
                onClick={() => { setEditingInv(null); setInvForm({ ...emptyInvForm, invoice_mode: "client" }); setShowInvModal(true); }}
                className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
              >
                <Plus className="h-4 w-4" /> New Client Invoice
              </button>
              <button
                onClick={() => {
                  setEditingInv(null);
                  setInvForm({
                    ...emptyInvForm,
                    invoice_mode: "settlement",
                    show_bank_details: false,
                    expense_items: [{ description: "", amount: "" }]
                  });
                  setShowInvModal(true);
                }}
                className="py-2.5 px-4 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25 font-semibold text-xs flex items-center gap-2 min-h-[44px]"
              >
                <Plus className="h-4 w-4" /> New Settlement / Expense Invoice
              </button>
            </>
          )}
          {subTab === "letterhead" && (
            <>
              <button
                onClick={() => generateLetterheadPDF({ letter_date: "", letter_number: "", recipient: "", subject: "", body: "" }, branding)}
                className="py-2.5 px-4 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25 font-semibold text-xs flex items-center gap-2 min-h-[44px]"
              >
                <Download className="h-4 w-4" /> Download Blank Letterhead PDF
              </button>
              <button
                onClick={() => setShowLetterModal(true)}
                className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
              >
                <Plus className="h-4 w-4" /> Compose Official Letter
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[var(--border-color)] pb-2">
        {[
          { id: "invoices", label: "Vehicles Invoices & Settlements", icon: Receipt },
          { id: "letterhead", label: "Official Letterhead", icon: ScrollText },
          { id: "agency", label: "Agency PDF & Bank Settings", icon: Building2 }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
              subTab === t.id
                ? "bg-teal-500 text-white shadow-sm"
                : "bg-[var(--tr-hover)]/40 text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: VEHICLES INVOICES */}
      {subTab === "invoices" && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search invoices by client/owner name, period or invoice #..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full app-input rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none"
            />
          </div>

          <div className="glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[var(--tr-hover)] text-[var(--text-muted)] border-b border-[var(--border-color)] uppercase font-semibold">
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Invoice To</th>
                    <th className="p-4">Vehicles</th>
                    <th className="p-4">Breakdown</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-[var(--text-muted)] italic">
                        No vehicles invoices yet. Click "New Client Invoice" or "New Settlement / Expense Invoice" above.
                      </td>
                    </tr>
                  ) : filteredInvoices.map(inv => {
                    const isSettlement = inv.invoice_mode === "settlement" || (inv.expense_items || []).length > 0;
                    return (
                      <tr key={inv.id} className="hover:bg-[var(--tr-hover)]/30">
                        <td className="p-4 font-mono font-bold text-[var(--accent-color)]">
                          <div>{inv.invoice_number}</div>
                          <div className="text-[10px] text-[var(--text-muted)] font-normal">{inv.invoice_date}</div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isSettlement ? "bg-amber-500/10 text-amber-500" : "bg-teal-500/10 text-teal-500"
                          }`}>
                            {isSettlement ? "Settlement / Expense" : "Client Billing"}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-sm text-[var(--text-main)]">{inv.invoice_to}</div>
                          {inv.period_label && <div className="text-[11px] text-[var(--text-muted)]">{inv.period_label}</div>}
                        </td>
                        <td className="p-4 space-y-0.5">
                          {(inv.vehicle_items || []).map((v, idx) => (
                            <div key={idx} className="text-[11px]">
                              <span className="font-semibold">{v.name}</span> ({v.period}) — PKR {Number(v.amount).toLocaleString()}
                            </div>
                          ))}
                        </td>
                        <td className="p-4 font-mono">
                          <div>Total Rent: <span className="font-bold">PKR {Number(inv.total_rent).toLocaleString()}</span></div>
                          {isSettlement ? (
                            <>
                              <div className="text-rose-400">Expense: -PKR {Number(inv.total_expense).toLocaleString()}</div>
                              <div className="font-extrabold text-amber-500">Payable: PKR {Number(inv.payable_or_balance).toLocaleString()}</div>
                            </>
                          ) : (
                            <>
                              <div className="text-emerald-500">Received: PKR {Number(inv.received_amount).toLocaleString()}</div>
                              <div className="font-extrabold text-teal-500">Balance: PKR {Number(inv.payable_or_balance).toLocaleString()}</div>
                            </>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              onClick={() => generateVehiclesInvoicePDF(inv, branding)}
                              className="py-1.5 px-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 font-bold text-[11px] flex items-center gap-1"
                            >
                              <Download className="h-3 w-3" /> PDF
                            </button>
                            <button
                              onClick={() => sendInvoiceWhatsApp(inv)}
                              className="py-1.5 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 font-bold text-[11px] flex items-center gap-1"
                            >
                              <Send className="h-3 w-3" /> WhatsApp
                            </button>
                            <button
                              onClick={() => { setEditingInv(inv); setShowInvModal(true); }}
                              className="p-1.5 rounded-lg border border-[var(--border-color)] hover:border-teal-500 text-[var(--text-muted)]"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteInvoice(inv.id)}
                              className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: OFFICIAL LETTERHEAD */}
      {subTab === "letterhead" && (
        <div className="glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--tr-hover)] text-[var(--text-muted)] border-b border-[var(--border-color)] uppercase font-semibold">
                  <th className="p-4">Letter #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Recipient</th>
                  <th className="p-4">Subject</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {officialLetters.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-[var(--text-muted)] italic">
                      No composed letters saved yet. Click "Download Blank Letterhead PDF" or "Compose Official Letter".
                    </td>
                  </tr>
                ) : officialLetters.map(l => (
                  <tr key={l.id} className="hover:bg-[var(--tr-hover)]/30">
                    <td className="p-4 font-mono font-bold text-[var(--accent-color)]">{l.letter_number}</td>
                    <td className="p-4">{l.letter_date}</td>
                    <td className="p-4 font-semibold">{l.recipient || "General"}</td>
                    <td className="p-4">{l.subject || "(No subject)"}</td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => generateLetterheadPDF(l, branding)}
                          className="py-1.5 px-3 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold text-[11px] flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" /> PDF
                        </button>
                        <button
                          onClick={() => handleDeleteLetter(l.id)}
                          className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: AGENCY PDF & BANK SETTINGS */}
      {subTab === "agency" && (
        <form onSubmit={handleSaveAgencyProfile} className="glass-panel rounded-2xl border border-[var(--border-color)] p-6 space-y-5 text-xs max-w-3xl">
          <div>
            <h3 className="text-base font-bold text-[var(--text-main)]">Agency Header, NTN & Bank Account Profile</h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">These details automatically appear on every PDF Invoice, Quotation, and Official Letterhead.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Agency Legal Name *</label>
              <input type="text" required value={agencyForm.name} onChange={e => setAgencyForm({ ...agencyForm, name: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Tagline (for Letterhead)</label>
              <input type="text" value={agencyForm.tagline} onChange={e => setAgencyForm({ ...agencyForm, tagline: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="TOURS & TRAVELS" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Phone Number</label>
              <input type="text" value={agencyForm.support_phone} onChange={e => setAgencyForm({ ...agencyForm, support_phone: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="0322-8893598" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Email Address</label>
              <input type="email" value={agencyForm.support_email} onChange={e => setAgencyForm({ ...agencyForm, support_email: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Website</label>
              <input type="text" value={agencyForm.website} onChange={e => setAgencyForm({ ...agencyForm, website: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">NTN Number</label>
              <input type="text" value={agencyForm.ntn} onChange={e => setAgencyForm({ ...agencyForm, ntn: e.target.value })} className="w-full app-input rounded-lg p-2.5 font-mono" placeholder="3530120023371" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-[var(--text-muted)] mb-1">Office Address</label>
              <input type="text" value={agencyForm.address} onChange={e => setAgencyForm({ ...agencyForm, address: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="Mian Plaza, Johar Town, Lahore" />
            </div>
            <div>
              <label className="block font-semibold text-[var(--text-muted)] mb-1">PDF Theme Color</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={agencyForm.pdf_accent_color} onChange={e => setAgencyForm({ ...agencyForm, pdf_accent_color: e.target.value })} className="w-10 h-10 rounded-lg border border-[var(--border-color)] cursor-pointer p-1 bg-[var(--bg-app)]" />
                <input type="text" value={agencyForm.pdf_accent_color} onChange={e => setAgencyForm({ ...agencyForm, pdf_accent_color: e.target.value })} className="flex-1 app-input rounded-lg p-2.5 font-mono" />
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border-color)] pt-4 space-y-3">
            <p className="font-bold uppercase text-amber-500 text-[11px]">Bank Account Details (Shown on Client Invoices)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Bank Name</label>
                <input type="text" value={agencyForm.bank_name} onChange={e => setAgencyForm({ ...agencyForm, bank_name: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="Faysal Bank" />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Account Title</label>
                <input type="text" value={agencyForm.account_title} onChange={e => setAgencyForm({ ...agencyForm, account_title: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Account Number / IBAN</label>
                <input type="text" value={agencyForm.account_number} onChange={e => setAgencyForm({ ...agencyForm, account_number: e.target.value })} className="w-full app-input rounded-lg p-2.5 font-mono" placeholder="3165787000004066" />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--text-muted)] mb-1">Default Terms & Conditions</label>
            <textarea rows={3} value={agencyForm.terms_and_conditions} onChange={e => setAgencyForm({ ...agencyForm, terms_and_conditions: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
          </div>

          <button type="submit" className="btn-accent text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Save Agency PDF & Bank Profile
          </button>
        </form>
      )}

      {/* MODAL: CREATE / EDIT VEHICLES INVOICE */}
      {showInvModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold">{editingInv ? `Edit Invoice ${editingInv.invoice_number}` : "Create Vehicles Invoice"}</h3>
              <button onClick={() => setShowInvModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-[var(--tr-hover)]/40 border border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setInvForm({ ...invForm, invoice_mode: "client", show_bank_details: true })}
                  className={`py-2 rounded-lg font-bold transition-all ${invForm.invoice_mode === "client" ? "bg-teal-500 text-white" : "text-[var(--text-muted)]"}`}
                >
                  Client Billing Invoice (Total / Received / Balance)
                </button>
                <button
                  type="button"
                  onClick={() => setInvForm({ ...invForm, invoice_mode: "settlement", show_bank_details: false })}
                  className={`py-2 rounded-lg font-bold transition-all ${invForm.invoice_mode === "settlement" ? "bg-amber-500 text-white" : "text-[var(--text-muted)]"}`}
                >
                  Owner / Settlement Invoice (Rent − Expenses)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Invoice To *</label>
                  <input type="text" required value={invForm.invoice_to} onChange={e => setInvForm({ ...invForm, invoice_to: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="e.g. Mr Saqlain / Shaukat Khanum" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Period / Subtitle</label>
                  <input type="text" value={invForm.period_label} onChange={e => setInvForm({ ...invForm, period_label: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="e.g. Month Of October" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Phone (for WhatsApp)</label>
                  <input type="text" value={invForm.customer_phone} onChange={e => setInvForm({ ...invForm, customer_phone: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="03001234567" />
                </div>
              </div>

              {/* Vehicle Rows */}
              <div className="border border-[var(--border-color)] rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold uppercase text-teal-500 text-[11px]">Vehicles / Items</span>
                  <button
                    type="button"
                    onClick={() => setInvForm(p => ({ ...p, vehicle_items: [...p.vehicle_items, { name: "", period: "1 Day", amount: "" }] }))}
                    className="px-2.5 py-1 rounded bg-teal-500/10 text-teal-500 font-bold text-[11px]"
                  >
                    + Add Vehicle
                  </button>
                </div>
                {invForm.vehicle_items.map((v, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text" required placeholder="Vehicle (e.g. Prado / 4c Saloon)"
                      value={v.name}
                      onChange={e => setInvForm(p => ({ ...p, vehicle_items: p.vehicle_items.map((row, i) => i === idx ? { ...row, name: e.target.value } : row) }))}
                      className="col-span-5 app-input rounded-lg p-2"
                    />
                    <input
                      type="text" required placeholder="18 Days / Per Month"
                      value={v.period}
                      onChange={e => setInvForm(p => ({ ...p, vehicle_items: p.vehicle_items.map((row, i) => i === idx ? { ...row, period: e.target.value } : row) }))}
                      className="col-span-3 app-input rounded-lg p-2"
                    />
                    <input
                      type="number" required min="0" placeholder="Amount"
                      value={v.amount}
                      onChange={e => setInvForm(p => ({ ...p, vehicle_items: p.vehicle_items.map((row, i) => i === idx ? { ...row, amount: e.target.value } : row) }))}
                      className="col-span-3 app-input rounded-lg p-2 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setInvForm(p => ({ ...p, vehicle_items: p.vehicle_items.filter((_, i) => i !== idx) }))}
                      className="col-span-1 text-rose-500 flex justify-center p-1"
                    >
                      <MinusCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Expense Rows */}
              <div className="border border-[var(--border-color)] rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <span className="font-bold uppercase text-amber-500 text-[11px]">Expense Deductions (Optional — Smart Card, Tracker, Wash, Commission)</span>
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => addCommissionRow(20)} className="px-2 py-1 rounded bg-amber-500/10 text-amber-500 font-bold text-[10px]">+ 20% Commission</button>
                    <button
                      type="button"
                      onClick={() => setInvForm(p => ({ ...p, expense_items: [...p.expense_items, { description: "", amount: "" }] }))}
                      className="px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 font-bold text-[11px]"
                    >
                      + Add Expense
                    </button>
                  </div>
                </div>
                {invForm.expense_items.map((ex, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text" required placeholder="e.g. Prado Smart Card / Revo Tracker Fee / Compressor Belt+Wash"
                      value={ex.description}
                      onChange={e => setInvForm(p => ({ ...p, expense_items: p.expense_items.map((row, i) => i === idx ? { ...row, description: e.target.value } : row) }))}
                      className="col-span-8 app-input rounded-lg p-2"
                    />
                    <input
                      type="number" required min="0" placeholder="Amount"
                      value={ex.amount}
                      onChange={e => setInvForm(p => ({ ...p, expense_items: p.expense_items.map((row, i) => i === idx ? { ...row, amount: e.target.value } : row) }))}
                      className="col-span-3 app-input rounded-lg p-2 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setInvForm(p => ({ ...p, expense_items: p.expense_items.filter((_, i) => i !== idx) }))}
                      className="col-span-1 text-rose-500 flex justify-center p-1"
                    >
                      <MinusCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Payment & Bank Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                {invForm.invoice_mode === "client" && (
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Amount Received (PKR)</label>
                    <input type="number" min="0" value={invForm.received_amount} onChange={e => setInvForm({ ...invForm, received_amount: e.target.value })} className="w-full app-input rounded-lg p-2.5 font-mono" />
                  </div>
                )}
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Invoice Date</label>
                  <input type="date" value={invForm.invoice_date} onChange={e => setInvForm({ ...invForm, invoice_date: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--border-color)] cursor-pointer">
                  <input type="checkbox" checked={invForm.show_bank_details} onChange={e => setInvForm({ ...invForm, show_bank_details: e.target.checked })} />
                  <span className="font-semibold">Show Bank Account Box</span>
                </label>
              </div>

              {invForm.show_bank_details && (
                <div className="grid grid-cols-3 gap-2">
                  <input type="text" placeholder="Bank Name" value={invForm.bank_name} onChange={e => setInvForm({ ...invForm, bank_name: e.target.value })} className="app-input rounded-lg p-2" />
                  <input type="text" placeholder="Account Title" value={invForm.account_title} onChange={e => setInvForm({ ...invForm, account_title: e.target.value })} className="app-input rounded-lg p-2" />
                  <input type="text" placeholder="Account No" value={invForm.account_number} onChange={e => setInvForm({ ...invForm, account_number: e.target.value })} className="app-input rounded-lg p-2 font-mono" />
                </div>
              )}

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div>Total Rent: <strong className="font-mono">PKR {totalRent.toLocaleString()}</strong></div>
                  {totalExpense > 0 && <div className="text-rose-400">Expenses: -PKR {totalExpense.toLocaleString()}</div>}
                  {invForm.invoice_mode === "client" && receivedAmt > 0 && <div className="text-emerald-500">Received: PKR {receivedAmt.toLocaleString()}</div>}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-amber-500 block">
                    {invForm.invoice_mode === "settlement" || totalExpense > 0 ? "Payable Amount" : "Balance Due"}
                  </span>
                  <span className="text-2xl font-extrabold text-amber-500">PKR {finalBalanceOrPayable.toLocaleString()}</span>
                </div>
              </div>

              <button type="submit" className="w-full btn-accent text-white font-semibold py-3 rounded-xl">
                {editingInv ? "Update Invoice" : "Save Vehicles Invoice"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COMPOSE OFFICIAL LETTER */}
      {showLetterModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold">Compose Official Letterhead PDF</h3>
              <button onClick={() => setShowLetterModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveLetter} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Date *</label>
                  <input type="date" required value={letterForm.letter_date} onChange={e => setLetterForm({ ...letterForm, letter_date: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">To / Recipient</label>
                  <input type="text" value={letterForm.recipient} onChange={e => setLetterForm({ ...letterForm, recipient: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="e.g. Whom It May Concern / Client" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Subject</label>
                <input type="text" value={letterForm.subject} onChange={e => setLetterForm({ ...letterForm, subject: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="e.g. Vehicle Authorization / NOC / Rental Proposal" />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Letter Body (Leave blank for empty letterhead)</label>
                <textarea rows={6} value={letterForm.body} onChange={e => setLetterForm({ ...letterForm, body: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="Write your official letter text here..." />
              </div>
              <button type="submit" className="w-full btn-accent text-white font-semibold py-3 rounded-xl">
                Save & Download Letterhead PDF
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
