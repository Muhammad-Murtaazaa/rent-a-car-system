import React, { useState, useEffect } from "react";
import { UserPlus, Plus, Search, Edit2, Trash2, X, Send, FileText, CheckCircle, Phone, Calendar } from "lucide-react";

export default function LeadsView({ leads = [], cars = [], branding, fetchData, onCreateQuoteFromLead, onConvertLeadToCustomer }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);

  const emptyForm = {
    full_name: "",
    phone: "",
    email: "",
    interested_vehicle: "",
    car_id: "",
    pickup_date: "",
    duration_days: 1,
    quoted_amount: 0,
    source: "Phone Call",
    status: "New",
    follow_up_date: new Date().toISOString().slice(0, 10),
    notes: ""
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (editingLead) {
      setForm({
        full_name: editingLead.full_name || "",
        phone: editingLead.phone || "",
        email: editingLead.email || "",
        interested_vehicle: editingLead.interested_vehicle || "",
        car_id: editingLead.car_id || "",
        pickup_date: editingLead.pickup_date ? String(editingLead.pickup_date).slice(0, 10) : "",
        duration_days: editingLead.duration_days || 1,
        quoted_amount: editingLead.quoted_amount || 0,
        source: editingLead.source || "Phone Call",
        status: editingLead.status || "New",
        follow_up_date: editingLead.follow_up_date ? String(editingLead.follow_up_date).slice(0, 10) : "",
        notes: editingLead.notes || ""
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingLead, showModal]);

  const handleCarPick = (carId) => {
    const car = cars.find(c => String(c.id) === String(carId));
    setForm(prev => ({
      ...prev,
      car_id: carId,
      interested_vehicle: car ? `${car.make_model} (${car.plate_number})` : prev.interested_vehicle
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingLead ? "PUT" : "POST";
    const url = editingLead ? `/api/leads/${editingLead.id}` : "/api/leads";
    const payload = {
      ...form,
      car_id: form.car_id ? parseInt(form.car_id, 10) : null,
      pickup_date: form.pickup_date || null,
      follow_up_date: form.follow_up_date || null,
      duration_days: parseInt(form.duration_days, 10) || 1,
      quoted_amount: parseFloat(form.quoted_amount) || 0
    };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setShowModal(false);
      setEditingLead(null);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.detail || "Failed to save lead.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this customer lead?")) return;
    const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const handleQuickStatus = async (lead, newStatus) => {
    const res = await fetch(`/api/leads/${lead.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) fetchData();
  };

  const sendWhatsApp = (lead) => {
    const clean = (lead.phone || "").replace(/[^0-9]/g, "");
    if (!clean) return alert("No phone number on lead.");
    const num = clean.startsWith("0") ? "92" + clean.substring(1) : clean;
    const brand = branding?.name || "Rent A Car Management System";
    const text = `Assalam-o-Alaikum ${lead.full_name}, thank you for contacting ${brand}! Regarding your inquiry for ${lead.interested_vehicle || "our vehicle"} (${lead.duration_days} day(s)), please let us know how we can confirm your booking.`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const filtered = leads.filter(l => {
    const matchSearch =
      l.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search) ||
      (l.interested_vehicle || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || l.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusBadge = (status) => {
    switch (status) {
      case "New": return "bg-sky-500/10 text-sky-500";
      case "Contacted": return "bg-amber-500/10 text-amber-500";
      case "Quoted": return "bg-indigo-500/10 text-indigo-500";
      case "Converted": return "bg-emerald-500/10 text-emerald-500";
      case "Lost": return "bg-rose-500/10 text-rose-500";
      default: return "bg-slate-500/10 text-slate-400";
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Customer Leads & Inquiries</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Track prospective rental inquiries, follow-ups, quotations, and conversions.</p>
        </div>
        <button
          onClick={() => { setEditingLead(null); setShowModal(true); }}
          className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> Add Customer Lead
        </button>
      </div>

      {/* Pipeline Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {["New", "Contacted", "Quoted", "Converted", "Lost"].map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(statusFilter === st ? "All" : st)}
            className={`glass-panel p-4 rounded-2xl border text-left transition-all ${
              statusFilter === st ? "border-teal-500 ring-1 ring-teal-500/40" : "border-[var(--border-color)]"
            }`}
          >
            <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{st}</span>
            <div className="text-2xl font-extrabold mt-1 text-[var(--text-main)]">
              {leads.filter(l => l.status === st).length}
            </div>
          </button>
        ))}
      </div>

      {/* Search & Filter Pills */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search leads by name, phone or vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full app-input rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="app-input rounded-xl px-4 py-3 text-sm focus:outline-none"
        >
          <option value="All">All Lead Stages</option>
          <option value="New">New</option>
          <option value="Contacted">Contacted</option>
          <option value="Quoted">Quoted</option>
          <option value="Converted">Converted</option>
          <option value="Lost">Lost</option>
        </select>
      </div>

      {/* Leads Table */}
      <div className="glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--tr-hover)] text-[var(--text-muted)] border-b border-[var(--border-color)] uppercase font-semibold">
                <th className="p-4">Prospect</th>
                <th className="p-4">Vehicle & Dates</th>
                <th className="p-4">Source & Follow-up</th>
                <th className="p-4">Stage</th>
                <th className="p-4 text-center">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-[var(--text-muted)] italic">
                    No customer leads yet. Click "Add Customer Lead" to capture inquiries.
                  </td>
                </tr>
              ) : filtered.map(lead => (
                <tr key={lead.id} className="hover:bg-[var(--tr-hover)]/30">
                  <td className="p-4">
                    <div className="font-bold text-sm text-[var(--text-main)]">{lead.full_name}</div>
                    <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 text-teal-500" /> {lead.phone}
                    </div>
                    {lead.notes && <div className="text-[10px] text-[var(--text-muted)] mt-1 max-w-xs truncate">{lead.notes}</div>}
                  </td>
                  <td className="p-4 space-y-0.5">
                    <div className="font-semibold text-[var(--text-main)]">{lead.interested_vehicle || "Any Vehicle"}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {lead.pickup_date ? `Pickup: ${lead.pickup_date}` : "Flexible date"} · {lead.duration_days} day(s)
                    </div>
                    {lead.quoted_amount > 0 && (
                      <div className="text-[11px] font-bold text-teal-500">Est: PKR {lead.quoted_amount.toLocaleString()}</div>
                    )}
                  </td>
                  <td className="p-4 space-y-1">
                    <span className="px-2 py-0.5 rounded bg-[var(--tr-hover)] border border-[var(--border-color)] text-[10px] font-semibold">
                      {lead.source}
                    </span>
                    {lead.follow_up_date && (
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Follow-up: {lead.follow_up_date}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <select
                      value={lead.status}
                      onChange={(e) => handleQuickStatus(lead, e.target.value)}
                      className={`px-2 py-1 rounded-lg text-[11px] font-bold border border-transparent focus:outline-none cursor-pointer ${statusBadge(lead.status)}`}
                    >
                      <option value="New">New</option>
                      <option value="Contacted">Contacted</option>
                      <option value="Quoted">Quoted</option>
                      <option value="Converted">Converted</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => sendWhatsApp(lead)}
                        title="Send WhatsApp Follow-up"
                        className="py-1.5 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 font-bold text-[11px] flex items-center gap-1"
                      >
                        <Send className="h-3 w-3" /> WhatsApp
                      </button>
                      {onCreateQuoteFromLead && (
                        <button
                          onClick={() => onCreateQuoteFromLead(lead)}
                          title="Generate Quotation"
                          className="py-1.5 px-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 font-bold text-[11px] flex items-center gap-1"
                        >
                          <FileText className="h-3 w-3" /> Quote
                        </button>
                      )}
                      {onConvertLeadToCustomer && lead.status !== "Converted" && (
                        <button
                          onClick={() => { handleQuickStatus(lead, "Converted"); onConvertLeadToCustomer(lead); }}
                          title="Convert Lead to Customer"
                          className="py-1.5 px-2.5 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 hover:bg-teal-500/20 font-bold text-[11px] flex items-center gap-1"
                        >
                          <CheckCircle className="h-3 w-3" /> Convert
                        </button>
                      )}
                      <button
                        onClick={() => { setEditingLead(lead); setShowModal(true); }}
                        className="p-1.5 rounded-lg border border-[var(--border-color)] hover:border-teal-500 text-[var(--text-muted)] hover:text-teal-500"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(lead.id)}
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

      {/* Add/Edit Lead Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold">{editingLead ? "Edit Lead" : "New Customer Lead"}</h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Full Name *</label>
                  <input type="text" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Phone Number *</label>
                  <input type="text" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="03001234567" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Select Fleet Car (Optional)</label>
                  <select value={form.car_id} onChange={e => handleCarPick(e.target.value)} className="w-full app-input rounded-lg p-2.5">
                    <option value="">-- Custom / Any --</option>
                    {cars.map(c => (
                      <option key={c.id} value={c.id}>{c.make_model} ({c.plate_number})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Interested Vehicle</label>
                  <input type="text" value={form.interested_vehicle} onChange={e => setForm({ ...form, interested_vehicle: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="e.g. Toyota Prado / Civic" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Pickup Date</label>
                  <input type="date" value={form.pickup_date} onChange={e => setForm({ ...form, pickup_date: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Days</label>
                  <input type="number" min="1" value={form.duration_days} onChange={e => setForm({ ...form, duration_days: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Quoted Amt (PKR)</label>
                  <input type="number" min="0" value={form.quoted_amount} onChange={e => setForm({ ...form, quoted_amount: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Lead Source</label>
                  <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} className="w-full app-input rounded-lg p-2.5">
                    <option value="Phone Call">Phone Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Social Media">Facebook / Instagram</option>
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full app-input rounded-lg p-2.5">
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                    <option value="Quoted">Quoted</option>
                    <option value="Converted">Converted</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Follow-up Date</label>
                  <input type="date" value={form.follow_up_date} onChange={e => setForm({ ...form, follow_up_date: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="Client requirements, destination, driver needed, etc." />
              </div>
              <button type="submit" className="w-full btn-accent text-white font-semibold py-3 rounded-xl">
                {editingLead ? "Save Lead Changes" : "Save Customer Lead"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
