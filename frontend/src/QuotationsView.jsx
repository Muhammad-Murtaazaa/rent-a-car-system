import React, { useState, useEffect } from "react";
import { 
  FileText, Plus, Search, Trash2, X, Download, Send, Edit2, 
  CalendarCheck, MinusCircle, Building2, User, Phone, Mail, 
  Car, Sparkles, Check, DollarSign, Calendar
} from "lucide-react";
import { generateVehiclesQuotationPDF } from "./pdfTemplates";

export default function QuotationsView({ 
  quotations = [], 
  cars = [], 
  branding, 
  fetchData, 
  prefillQuote, 
  setPrefillQuote, 
  onConvertQuoteToBooking 
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingQuote, setEditingQuote] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const defaultTerms = branding?.branding_settings?.terms_and_conditions ||
    "By accepting this quotation, you agree to the rental period, payment terms, security deposit, responsible vehicle use, damage responsibility, maintenance coverage, and insurance terms.";

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
    items: [{ name: "", days_label: "Per Day", amount: "" }],
    notes: defaultTerms
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (prefillQuote) {
      setEditingQuote(null);
      const initItems = prefillQuote.vehicle_description
        ? [{ name: prefillQuote.vehicle_description, days_label: `${prefillQuote.days || 1} Day(s)`, amount: (prefillQuote.daily_rate || 5000) * (prefillQuote.days || 1) }]
        : [{ name: "", days_label: "Per Day", amount: "" }];
      setForm({
        ...emptyForm,
        ...prefillQuote,
        items: initItems
      });
      setShowModal(true);
      if (setPrefillQuote) setPrefillQuote(null);
    }
  }, [prefillQuote]);

  useEffect(() => {
    if (editingQuote) {
      const existingItems = Array.isArray(editingQuote.items) && editingQuote.items.length > 0
        ? editingQuote.items
        : [{ name: editingQuote.vehicle_description || "", days_label: `${editingQuote.days || 1} Day(s)`, amount: editingQuote.total_amount || 0 }];
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
        items: existingItems,
        notes: editingQuote.notes || defaultTerms
      });
    }
  }, [editingQuote, showModal]);

  const addItemRow = () => {
    setForm(prev => ({
      ...prev,
      items: [...(prev.items || []), { name: "", days_label: "Per Day", amount: "" }]
    }));
  };

  const removeItemRow = (idx) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const updateItemRow = (idx, field, val) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    }));
  };

  const addQuickFleetCar = (carId) => {
    const car = cars.find(c => String(c.id) === String(carId));
    if (!car) return;
    setForm(prev => {
      const cleaned = (prev.items || []).filter(r => r.name.trim() !== "");
      return {
        ...prev,
        car_id: car.id,
        items: [...cleaned, { name: `${car.make_model} (${car.plate_number})`, days_label: "Per Day", amount: "" }]
      };
    });
  };

  const itemsTotal = (form.items || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const discountVal = parseFloat(form.discount_amount) || 0;
  const taxPct = parseFloat(form.tax_percentage) || 0;
  const subAfterDiscount = Math.max(0, itemsTotal - discountVal);
  const taxVal = Math.round(subAfterDiscount * (taxPct / 100));
  const finalGrandTotal = subAfterDiscount + taxVal;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = (form.items || [])
      .filter(r => r.name.trim() !== "")
      .map(r => ({
        name: r.name.trim(),
        days_label: r.days_label || "Per Day",
        amount: parseFloat(r.amount) || 0
      }));

    if (validItems.length === 0) {
      alert("Please add at least one vehicle line item.");
      return;
    }

    const descSummary = validItems.map(r => r.name).join(", ");
    const method = editingQuote ? "PUT" : "POST";
    const url = editingQuote ? `/api/quotations/${editingQuote.id}` : "/api/quotations";

    const payload = {
      ...form,
      car_id: form.car_id ? parseInt(form.car_id, 10) : null,
      vehicle_description: descSummary,
      days: parseInt(form.days, 10) || 1,
      daily_rate: validItems[0]?.amount || 0,
      discount_amount: discountVal,
      tax_percentage: taxPct,
      total_amount: finalGrandTotal,
      items: validItems,
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
    if (!window.confirm("Delete this quotation record?")) return;
    const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const sendWhatsApp = (q) => {
    const clean = (q.customer_phone || "").replace(/[^0-9]/g, "");
    if (!clean) return alert("No phone number on quotation.");
    const num = clean.startsWith("0") ? "92" + clean.substring(1) : clean;
    const brand = branding?.name || "Rent A Car Management System";
    const itemsList = (q.items && q.items.length > 0)
      ? q.items.map(i => `• ${i.name} (${i.days_label}): PKR ${Number(i.amount).toLocaleString()}`).join("\n")
      : `• ${q.vehicle_description}: PKR ${Number(q.total_amount).toLocaleString()}`;
    const text =
      `*VEHICLES RATE QUOTATION #${q.quote_number || q.id}* - ${brand}\n` +
      `Quotation To: ${q.company_name || q.customer_name}\n\n` +
      `*QUOTED VEHICLES:*\n${itemsList}\n\n` +
      `*Total Quoted: PKR ${Number(q.total_amount).toLocaleString()}*\n` +
      (q.valid_until ? `Valid Until: ${q.valid_until}\n\n` : "") +
      `Reply to this message to confirm and reserve your fleet!`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const filtered = quotations.filter(q => {
    const mSearch =
      (q.customer_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.company_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.quote_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (q.vehicle_description || "").toLowerCase().includes(search.toLowerCase());
    const mStatus = statusFilter === "All" || q.status === statusFilter;
    return mSearch && mStatus;
  });

  return (
    <div className="space-y-6">
      {/* Page Toolbar */}
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">
            Vehicles Quotations
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Build multi-vehicle rate cards, client proposals & corporate price estimates with PDF export and WhatsApp share.
          </p>
        </div>
        <button
          onClick={() => { setEditingQuote(null); setForm(emptyForm); setShowModal(true); }}
          className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> Create Quotation
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by Quote #, Client, Company, or Vehicle Name..."
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
          <option value="Sent">Sent to Client</option>
          <option value="Accepted">Accepted</option>
          <option value="Converted">Converted to Booking</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      {/* Quotations Table */}
      <div className="glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--tr-hover)] text-[var(--text-muted)] border-b border-[var(--border-color)] uppercase font-semibold">
                <th className="p-4">Quote #</th>
                <th className="p-4">Quotation To</th>
                <th className="p-4">Quoted Vehicles Rate List</th>
                <th className="p-4">Grand Total</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[var(--text-muted)] italic">
                    No quotations found. Click "Create Quotation" to build a new corporate or individual quote.
                  </td>
                </tr>
              ) : filtered.map(q => (
                <tr key={q.id} className="hover:bg-[var(--tr-hover)]/30 transition-colors">
                  <td className="p-4 font-mono font-bold text-[var(--accent-color)]">
                    {q.quote_number || `QT-${q.id}`}
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-sm text-[var(--text-main)]">
                      {q.company_name || q.customer_name}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {q.customer_name} · <span className="font-mono">{q.customer_phone}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    {Array.isArray(q.items) && q.items.length > 0 ? (
                      <div className="space-y-1">
                        {q.items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="text-[11px] flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                            <span className="font-semibold text-[var(--text-main)]">{item.name}</span>
                            <span className="text-[var(--text-muted)]">({item.days_label})</span>
                            <span className="font-mono font-bold text-teal-600 dark:text-teal-400">PKR {Number(item.amount).toLocaleString()}</span>
                          </div>
                        ))}
                        {q.items.length > 3 && (
                          <div className="text-[10px] text-teal-500 font-bold pl-3">
                            +{q.items.length - 3} more vehicle(s)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="font-semibold text-[var(--text-main)]">{q.vehicle_description}</div>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="font-extrabold text-sm text-teal-600 dark:text-teal-400 font-mono">
                      PKR {Number(q.total_amount).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">
                      Valid until: <span className="font-mono">{q.valid_until ? String(q.valid_until).slice(0, 10) : "N/A"}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      q.status === "Accepted" || q.status === "Converted" ? "bg-emerald-500/10 text-emerald-500" :
                      q.status === "Sent" ? "bg-sky-500/10 text-sky-500" :
                      q.status === "Expired" ? "bg-rose-500/10 text-rose-500" :
                      "bg-amber-500/10 text-amber-500"
                    }`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => generateVehiclesQuotationPDF(q, branding)}
                        className="py-1 px-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 font-bold text-[11px] flex items-center gap-1"
                        title="Download PDF"
                      >
                        <Download className="h-3 w-3" /> PDF
                      </button>
                      <button
                        onClick={() => sendWhatsApp(q)}
                        className="py-1 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 font-bold text-[11px] flex items-center gap-1"
                        title="Share on WhatsApp"
                      >
                        <Send className="h-3 w-3" /> WA
                      </button>
                      {onConvertQuoteToBooking && q.status !== "Converted" && (
                        <button
                          onClick={() => onConvertQuoteToBooking(q)}
                          className="py-1 px-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 font-bold text-[11px] flex items-center gap-1"
                          title="Convert to Active Booking"
                        >
                          <CalendarCheck className="h-3 w-3" /> Book
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingQuote(q); setShowModal(true); }}
                        className="py-1 px-2 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-teal-500 text-[var(--accent-color)] flex items-center gap-1 text-[11px] font-semibold"
                        title="Edit Quotation"
                      >
                        <Edit2 className="h-3 w-3" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="p-1 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
                        title="Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Styled Quotation Edit / Create Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-3xl rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 border border-[var(--border-color)] max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-[var(--border-color)]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-[var(--text-main)]">
                      {editingQuote ? `Edit Quotation ${editingQuote.quote_number || `#QT-${editingQuote.id}`}` : "Create Vehicles Quotation"}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Professional rate card proposal with corporate PDF generation
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { setShowModal(false); setEditingQuote(null); }} 
                className="p-1.5 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-xs">
              {/* Section 1: Client & Company Information */}
              <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)]/50 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-500 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> 1. Client & Corporate Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Company / Organization</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Packages Mall / Corporate Client"
                      value={form.company_name} 
                      onChange={e => setForm({ ...form, company_name: e.target.value })} 
                      className="w-full app-input rounded-xl p-2.5 font-medium" 
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Contact Person Name *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Full Name"
                      value={form.customer_name} 
                      onChange={e => setForm({ ...form, customer_name: e.target.value })} 
                      className="w-full app-input rounded-xl p-2.5 font-medium" 
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Phone Number *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="03001234567"
                      value={form.customer_phone} 
                      onChange={e => setForm({ ...form, customer_phone: e.target.value })} 
                      className="w-full app-input rounded-xl p-2.5 font-mono" 
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Vehicles Rate List Builder */}
              <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)]/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                      <Car className="h-3.5 w-3.5" /> 2. Quoted Vehicles (Rate List)
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                      Add vehicles with custom periods & rates
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      onChange={e => { if (e.target.value) { addQuickFleetCar(e.target.value); e.target.value = ""; } }} 
                      className="app-input rounded-xl px-3 py-1.5 text-xs font-semibold"
                    >
                      <option value="">+ Add from Fleet</option>
                      {cars.map(c => <option key={c.id} value={c.id}>{c.make_model} ({c.plate_number})</option>)}
                    </select>
                    <button 
                      type="button" 
                      onClick={addItemRow} 
                      className="px-3 py-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/25 font-bold text-xs flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Row
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  {(form.items || []).map((row, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-5">
                        <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Vehicle Name & Model</label>
                        <input
                          type="text" 
                          required 
                          placeholder="e.g. Toyota Prado / Honda Civic"
                          value={row.name} 
                          onChange={e => updateItemRow(idx, "name", e.target.value)}
                          className="w-full app-input rounded-lg p-2 font-medium"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Rental Period</label>
                        <input
                          type="text" 
                          required 
                          placeholder="Per Day / 3 Days / Month"
                          value={row.days_label} 
                          onChange={e => updateItemRow(idx, "days_label", e.target.value)}
                          className="w-full app-input rounded-lg p-2"
                        />
                      </div>
                      <div className="col-span-5 sm:col-span-3">
                        <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Quoted Rate (PKR)</label>
                        <input
                          type="number" 
                          required 
                          min="0" 
                          placeholder="Amount in PKR"
                          value={row.amount} 
                          onChange={e => updateItemRow(idx, "amount", e.target.value)}
                          className="w-full app-input rounded-lg p-2 font-mono font-bold"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center pt-3.5">
                        <button 
                          type="button" 
                          onClick={() => removeItemRow(idx)} 
                          className="text-rose-500 hover:bg-rose-500/10 p-1.5 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <MinusCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Financial Summary & Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Discount Amount (PKR)</label>
                  <input 
                    type="number" 
                    min="0" 
                    placeholder="0"
                    value={form.discount_amount} 
                    onChange={e => setForm({ ...form, discount_amount: e.target.value })} 
                    className="w-full app-input rounded-xl p-2.5 font-mono" 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Tax (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    placeholder="0"
                    value={form.tax_percentage} 
                    onChange={e => setForm({ ...form, tax_percentage: e.target.value })} 
                    className="w-full app-input rounded-xl p-2.5 font-mono" 
                  />
                </div>
                <div className="p-3 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-teal-500/10 border border-amber-500/30 flex flex-col justify-center text-right">
                  <span className="text-[10px] font-bold uppercase text-amber-500 block">Final Quoted Total</span>
                  <span className="text-xl font-extrabold text-amber-500 font-mono">
                    PKR {finalGrandTotal.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Items Sum: PKR {itemsTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Section 4: Validity & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Quote Validity Date</label>
                  <input 
                    type="date" 
                    value={form.valid_until} 
                    onChange={e => setForm({ ...form, valid_until: e.target.value })} 
                    className="w-full app-input rounded-xl p-2.5 font-mono" 
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Status</label>
                  <select 
                    value={form.status} 
                    onChange={e => setForm({ ...form, status: e.target.value })} 
                    className="w-full app-input rounded-xl p-2.5 font-semibold"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent to Client</option>
                    <option value="Accepted">Accepted by Client</option>
                    <option value="Converted">Converted to Booking</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
              </div>

              {/* Terms and Notes */}
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Terms & Conditions / Special Notes</label>
                <textarea 
                  rows={2} 
                  value={form.notes} 
                  onChange={e => setForm({ ...form, notes: e.target.value })} 
                  className="w-full app-input rounded-xl p-2.5" 
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingQuote(null); }}
                  className="w-1/3 py-3 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 btn-accent text-white font-bold py-3 rounded-xl text-sm shadow-lg hover:shadow-xl transition-all"
                >
                  {editingQuote ? "Save & Update Quotation" : "Generate Vehicles Quotation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
