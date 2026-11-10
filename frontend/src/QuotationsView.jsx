import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import { FileText, Plus, Search, Trash2, X, Download, Send, Edit2, CalendarCheck } from "lucide-react";

export default function QuotationsView({ quotations = [], cars = [], branding, fetchData, prefillQuote, setPrefillQuote, onConvertQuoteToBooking }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const emptyForm = {
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    company_name: "",
    car_id: "",
    vehicle_description: "",
    start_date: today,
    end_date: today,
    days: 1,
    daily_rate: 5000,
    chauffeur_included: false,
    chauffeur_daily_rate: 1500,
    discount_amount: 0,
    tax_percentage: 0,
    valid_until: nextWeek,
    status: "Draft",
    notes: "Fuel & toll taxes excluded unless specified. Valid CNIC & Security Deposit required at handover."
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (prefillQuote) {
      setEditingQuote(null);
      setForm({
        ...emptyForm,
        ...prefillQuote
      });
      setShowModal(true);
      if (setPrefillQuote) setPrefillQuote(null);
    }
  }, [prefillQuote]);

  useEffect(() => {
    if (editingQuote) {
      setForm({
        customer_name: editingQuote.customer_name || "",
        customer_phone: editingQuote.customer_phone || "",
        customer_email: editingQuote.customer_email || "",
        company_name: editingQuote.company_name || "",
        car_id: editingQuote.car_id || "",
        vehicle_description: editingQuote.vehicle_description || "",
        start_date: editingQuote.start_date ? String(editingQuote.start_date).slice(0, 10) : today,
        end_date: editingQuote.end_date ? String(editingQuote.end_date).slice(0, 10) : today,
        days: editingQuote.days || 1,
        daily_rate: editingQuote.daily_rate || 0,
        chauffeur_included: !!editingQuote.chauffeur_included,
        chauffeur_daily_rate: editingQuote.chauffeur_daily_rate || 0,
        discount_amount: editingQuote.discount_amount || 0,
        tax_percentage: editingQuote.tax_percentage || 0,
        valid_until: editingQuote.valid_until ? String(editingQuote.valid_until).slice(0, 10) : nextWeek,
        status: editingQuote.status || "Draft",
        notes: editingQuote.notes || ""
      });
    } else if (!prefillQuote && showModal && !form.customer_name) {
      setForm(emptyForm);
    }
  }, [editingQuote, showModal]);

  // Auto-calculate days when dates change
  const updateDates = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    let diff = 1;
    if (!isNaN(s) && !isNaN(e) && e >= s) {
      diff = Math.max(1, Math.round((e - s) / 86400000) + 1);
    }
    setForm(prev => ({ ...prev, start_date: start, end_date: end, days: diff }));
  };

  const handleCarSelect = (carId) => {
    const car = cars.find(c => String(c.id) === String(carId));
    setForm(prev => ({
      ...prev,
      car_id: carId,
      vehicle_description: car ? `${car.make_model} ${car.model_year} (${car.plate_number})` : prev.vehicle_description
    }));
  };

  const calcTotal = (f = form) => {
    const days = Math.max(1, parseInt(f.days, 10) || 1);
    const base = days * (parseFloat(f.daily_rate) || 0);
    const chauf = f.chauffeur_included ? days * (parseFloat(f.chauffeur_daily_rate) || 0) : 0;
    const disc = parseFloat(f.discount_amount) || 0;
    const sub = Math.max(0, base + chauf - disc);
    const tax = sub * ((parseFloat(f.tax_percentage) || 0) / 100);
    return { base, chauf, disc, sub, tax, total: Math.round(sub + tax) };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const totals = calcTotal(form);
    const method = editingQuote ? "PUT" : "POST";
    const url = editingQuote ? `/api/quotations/${editingQuote.id}` : "/api/quotations";
    const payload = {
      ...form,
      car_id: form.car_id ? parseInt(form.car_id, 10) : null,
      days: parseInt(form.days, 10) || 1,
      daily_rate: parseFloat(form.daily_rate) || 0,
      chauffeur_daily_rate: parseFloat(form.chauffeur_daily_rate) || 0,
      discount_amount: parseFloat(form.discount_amount) || 0,
      tax_percentage: parseFloat(form.tax_percentage) || 0,
      total_amount: totals.total,
      valid_until: form.valid_until || null
    };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setShowModal(false);
      setEditingQuote(null);
      setForm(emptyForm);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.detail || "Error saving quotation.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this quotation?")) return;
    const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const downloadPDF = (q) => {
    const doc = new jsPDF();
    const brand = (branding?.name || "Rent A Car Management System").toUpperCase();
    const phone = branding?.branding_settings?.support_phone || "";
    const email = branding?.branding_settings?.support_email || "";

    doc.setFillColor(13, 148, 136);
    doc.rect(0, 0, 210, 38, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(brand, 15, 16);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("OFFICIAL INVOICE QUOTATION / PRICE ESTIMATE", 15, 25);
    doc.text(`Quote #${q.quote_number || q.id}`, 155, 16);
    doc.text(`Date: ${String(q.created_at || "").slice(0, 10) || today}`, 155, 25);

    doc.setTextColor(39, 39, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("PREPARED FOR:", 15, 52);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Client Name: ${q.customer_name}`, 15, 60);
    if (q.company_name) doc.text(`Company: ${q.company_name}`, 15, 66);
    doc.text(`Phone: ${q.customer_phone}`, 15, q.company_name ? 72 : 66);
    if (q.valid_until) doc.text(`Valid Until: ${q.valid_until}`, 130, 60);
    doc.text(`Status: ${q.status}`, 130, 66);

    // Table Header
    let y = 85;
    doc.setFillColor(241, 245, 249);
    doc.rect(15, y, 180, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Description", 18, y + 7);
    doc.text("Days", 112, y + 7);
    doc.text("Rate/Day", 132, y + 7);
    doc.text("Amount (PKR)", 162, y + 7);

    y += 18;
    doc.setFont("helvetica", "normal");
    const baseAmt = q.days * q.daily_rate;
    doc.text(`${q.vehicle_description}`, 18, y);
    doc.text(`${q.days}`, 115, y);
    doc.text(`${q.daily_rate.toLocaleString()}`, 132, y);
    doc.text(`${baseAmt.toLocaleString()}`, 165, y);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Rental Period: ${q.start_date} to ${q.end_date}`, 18, y + 6);
    doc.setTextColor(39, 39, 42);
    doc.setFontSize(10);

    if (q.chauffeur_included) {
      y += 14;
      const chaufAmt = q.days * q.chauffeur_daily_rate;
      doc.text("Dedicated Chauffeur / Driver Service", 18, y);
      doc.text(`${q.days}`, 115, y);
      doc.text(`${q.chauffeur_daily_rate.toLocaleString()}`, 132, y);
      doc.text(`${chaufAmt.toLocaleString()}`, 165, y);
    }

    y += 18;
    doc.line(15, y, 195, y);
    y += 10;

    if (q.discount_amount > 0) {
      doc.text("Discount:", 130, y);
      doc.text(`- PKR ${q.discount_amount.toLocaleString()}`, 162, y);
      y += 7;
    }
    if (q.tax_percentage > 0) {
      doc.text(`Tax (${q.tax_percentage}%):`, 130, y);
      const sub = Math.max(0, baseAmt + (q.chauffeur_included ? q.days * q.chauffeur_daily_rate : 0) - q.discount_amount);
      doc.text(`+ PKR ${Math.round(sub * (q.tax_percentage / 100)).toLocaleString()}`, 162, y);
      y += 7;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(13, 148, 136);
    doc.text("ESTIMATED TOTAL:", 112, y + 4);
    doc.text(`PKR ${Number(q.total_amount).toLocaleString()}`, 158, y + 4);

    if (q.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(39, 39, 42);
      doc.text("TERMS & NOTES:", 15, y + 24);
      doc.setFont("helvetica", "normal");
      const splitNotes = doc.splitTextToSize(q.notes, 180);
      doc.text(splitNotes, 15, y + 30);
    }

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`${brand} ${phone ? `| Tel: ${phone}` : ""} ${email ? `| ${email}` : ""}`, 15, 282);
    doc.save(`Quotation_${q.quote_number || q.id}_${q.customer_name.replace(/\s+/g, "_")}.pdf`);
  };

  const sendWhatsApp = (q) => {
    const clean = (q.customer_phone || "").replace(/[^0-9]/g, "");
    if (!clean) return alert("No phone number on quotation.");
    const num = clean.startsWith("0") ? "92" + clean.substring(1) : clean;
    const brand = branding?.name || "Rent A Car Management System";
    const text =
      `*INVOICE QUOTATION #${q.quote_number || q.id}* - ${brand}\n` +
      `Dear ${q.customer_name},\n` +
      `Vehicle: ${q.vehicle_description}\n` +
      `Dates: ${q.start_date} to ${q.end_date} (${q.days} day(s))\n` +
      `Daily Rate: PKR ${q.daily_rate.toLocaleString()}\n` +
      (q.chauffeur_included ? `Chauffeur: Included (PKR ${q.chauffeur_daily_rate}/day)\n` : "") +
      (q.discount_amount > 0 ? `Discount: PKR ${q.discount_amount.toLocaleString()}\n` : "") +
      `*Total Estimated Amount: PKR ${Number(q.total_amount).toLocaleString()}*\n` +
      (q.valid_until ? `Valid Until: ${q.valid_until}\n` : "") +
      `Reply to confirm your booking!`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const filtered = quotations.filter(q => {
    const mSearch =
      q.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      q.quote_number?.toLowerCase().includes(search.toLowerCase()) ||
      q.vehicle_description?.toLowerCase().includes(search.toLowerCase());
    const mStatus = statusFilter === "All" || q.status === statusFilter;
    return mSearch && mStatus;
  });

  const liveTotals = calcTotal(form);

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Invoice Quotations</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Create official rental price estimates, download PDFs, share on WhatsApp & convert to bookings.</p>
        </div>
        <button
          onClick={() => { setEditingQuote(null); setForm(emptyForm); setShowModal(true); }}
          className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> Create Quotation
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by quote #, client name or vehicle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full app-input rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="app-input rounded-xl px-4 py-3 text-sm focus:outline-none"
        >
          <option value="All">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Sent">Sent</option>
          <option value="Accepted">Accepted</option>
          <option value="Converted">Converted</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--tr-hover)] text-[var(--text-muted)] border-b border-[var(--border-color)] uppercase font-semibold">
                <th className="p-4">Quote #</th>
                <th className="p-4">Client</th>
                <th className="p-4">Vehicle & Duration</th>
                <th className="p-4">Total Estimate</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[var(--text-muted)] italic">
                    No quotations created yet. Click "Create Quotation" to send an estimate.
                  </td>
                </tr>
              ) : filtered.map(q => (
                <tr key={q.id} className="hover:bg-[var(--tr-hover)]/30">
                  <td className="p-4 font-mono font-bold text-[var(--accent-color)]">{q.quote_number || `QT-${q.id}`}</td>
                  <td className="p-4">
                    <div className="font-bold text-sm text-[var(--text-main)]">{q.customer_name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{q.customer_phone} {q.company_name ? `· ${q.company_name}` : ""}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-[var(--text-main)]">{q.vehicle_description}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{q.start_date} → {q.end_date} ({q.days}d)</div>
                  </td>
                  <td className="p-4">
                    <div className="font-extrabold text-sm text-teal-500">PKR {Number(q.total_amount).toLocaleString()}</div>
                    <div className="text-[10px] text-[var(--text-muted)]">Valid until: {q.valid_until || "N/A"}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      q.status === "Accepted" || q.status === "Converted" ? "bg-emerald-500/10 text-emerald-500"
                        : q.status === "Sent" ? "bg-sky-500/10 text-sky-500"
                        : q.status === "Expired" ? "bg-rose-500/10 text-rose-500"
                        : "bg-amber-500/10 text-amber-500"
                    }`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => downloadPDF(q)}
                        className="py-1.5 px-2.5 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 hover:bg-teal-500/20 font-bold text-[11px] flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" /> PDF
                      </button>
                      <button
                        onClick={() => sendWhatsApp(q)}
                        className="py-1.5 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 font-bold text-[11px] flex items-center gap-1"
                      >
                        <Send className="h-3 w-3" /> WhatsApp
                      </button>
                      {onConvertQuoteToBooking && q.status !== "Converted" && (
                        <button
                          onClick={() => onConvertQuoteToBooking(q)}
                          className="py-1.5 px-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 font-bold text-[11px] flex items-center gap-1"
                        >
                          <CalendarCheck className="h-3 w-3" /> Book
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingQuote(q); setShowModal(true); }}
                        className="p-1.5 rounded-lg border border-[var(--border-color)] hover:border-teal-500 text-[var(--text-muted)]"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
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

      {/* Create/Edit Quotation Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold">{editingQuote ? `Edit Quotation ${editingQuote.quote_number}` : "Create Invoice Quotation"}</h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Client Name *</label>
                  <input type="text" required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Phone *</label>
                  <input type="text" required value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Company (Optional)</label>
                  <input type="text" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Select Vehicle from Fleet</label>
                  <select value={form.car_id} onChange={e => handleCarSelect(e.target.value)} className="w-full app-input rounded-lg p-2.5">
                    <option value="">-- Custom Vehicle Description --</option>
                    {cars.map(c => (
                      <option key={c.id} value={c.id}>{c.make_model} {c.model_year} ({c.plate_number})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Vehicle Description *</label>
                  <input type="text" required value={form.vehicle_description} onChange={e => setForm({ ...form, vehicle_description: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="e.g. Toyota Prado TX 2023" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Start Date *</label>
                  <input type="date" required value={form.start_date} onChange={e => updateDates(e.target.value, form.end_date)} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">End Date *</label>
                  <input type="date" required value={form.end_date} onChange={e => updateDates(form.start_date, e.target.value)} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Days</label>
                  <input type="number" min="1" required value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Daily Rate (PKR) *</label>
                  <input type="number" min="0" required value={form.daily_rate} onChange={e => setForm({ ...form, daily_rate: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--border-color)] cursor-pointer">
                  <input type="checkbox" checked={form.chauffeur_included} onChange={e => setForm({ ...form, chauffeur_included: e.target.checked })} />
                  <span className="font-semibold">Include Driver</span>
                </label>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Driver / Day (PKR)</label>
                  <input type="number" min="0" disabled={!form.chauffeur_included} value={form.chauffeur_daily_rate} onChange={e => setForm({ ...form, chauffeur_daily_rate: e.target.value })} className="w-full app-input rounded-lg p-2.5 disabled:opacity-40" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Discount (PKR)</label>
                  <input type="number" min="0" value={form.discount_amount} onChange={e => setForm({ ...form, discount_amount: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Tax (%)</label>
                  <input type="number" min="0" step="0.1" value={form.tax_percentage} onChange={e => setForm({ ...form, tax_percentage: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Valid Until</label>
                  <input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Quotation Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full app-input rounded-lg p-2.5">
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent to Client</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Converted">Converted</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Terms & Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
              </div>

              <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-between">
                <div className="text-[var(--text-muted)]">
                  <div>Rent: PKR {liveTotals.base.toLocaleString()} {form.chauffeur_included ? `+ Driver: PKR ${liveTotals.chauf.toLocaleString()}` : ""}</div>
                  {liveTotals.disc > 0 && <div>Discount: -PKR {liveTotals.disc.toLocaleString()}</div>}
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-teal-500 block">Estimated Total</span>
                  <span className="text-2xl font-extrabold text-teal-500">PKR {liveTotals.total.toLocaleString()}</span>
                </div>
              </div>

              <button type="submit" className="w-full btn-accent text-white font-semibold py-3 rounded-xl">
                {editingQuote ? "Update Quotation" : "Save Quotation"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
