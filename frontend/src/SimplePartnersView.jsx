import React, { useEffect, useState } from "react";
import { Handshake, Plus, Trash2, Edit2, X, Phone, Car } from "lucide-react";

// Simple Mode Partners: a plain directory of the other rent-a-car
// businesses this agency works with, and how many cars each has.
// Backed by the existing /api/partner-agencies endpoints (the same data
// the full Suppliers section uses). Only shown in Simple Mode.
export default function SimplePartnersView({ addSignal = 0 }) {
  const [partners, setPartners] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);

  const emptyForm = {
    agency_name: "",
    contact_person: "",
    phone: "",
    whatsapp: "",
    city: "",
    total_cars_count: "",
    notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const res = await fetch("/api/partner-agencies");
      if (res.ok) setPartners(await res.json());
    } catch (err) {
      console.error("Error loading partners:", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  useEffect(() => {
    if (addSignal) openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal]);

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      agency_name: p.agency_name || "",
      contact_person: p.contact_person || "",
      phone: p.phone || "",
      whatsapp: p.whatsapp || "",
      city: p.city || "",
      total_cars_count: p.total_cars_count ?? "",
      notes: p.notes || "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const payload = {
      ...form,
      contact_person: form.contact_person || null,
      whatsapp: form.whatsapp || null,
      city: form.city || null,
      notes: form.notes || null,
      total_cars_count: parseInt(form.total_cars_count, 10) || 0,
    };
    const res = await fetch(editing ? `/api/partner-agencies/${editing.id}` : "/api/partner-agencies", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowModal(false);
      setEditing(null);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Error saving the partner.");
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Remove partner "${p.agency_name}" from your list?`)) return;
    const res = await fetch(`/api/partner-agencies/${p.id}`, { method: "DELETE" });
    if (res.ok) {
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Error removing the partner.");
    }
  };

  const totalCars = partners.reduce((acc, p) => acc + (Number(p.total_cars_count) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)] flex items-center gap-2">
            <Handshake className="h-7 w-7" /> Partners
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            The rent-a-car businesses you know and work with. You have {partners.length} partner(s) with {totalCars} car(s) in total.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-lg"
        >
          <Plus className="h-4 w-4" /> Add Partner
        </button>
      </div>

      {partners.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-8 text-center">
          <p className="text-[var(--text-muted)]">No partners yet. Tap "Add Partner" to add the first rent-a-car business you work with.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {partners.map((p) => (
            <div key={p.id} className="glass-panel rounded-2xl border border-[var(--border-color)] p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-[var(--text-main)] truncate">{p.agency_name}</p>
                  {p.contact_person && <p className="text-sm text-[var(--text-muted)]">{p.contact_person}</p>}
                  {p.city && <p className="text-sm text-[var(--text-muted)]">{p.city}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--tr-hover)]" title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(p)} className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-rose-500/10 text-rose-600" title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <p className="flex items-center gap-2 text-[var(--text-main)]">
                  <Phone className="h-4 w-4 text-[var(--text-muted)]" /> {p.phone}
                  {p.whatsapp && <span className="text-[var(--text-muted)]">· WhatsApp {p.whatsapp}</span>}
                </p>
                <p className="flex items-center gap-2 text-[var(--text-main)]">
                  <Car className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="font-bold">{Number(p.total_cars_count) || 0} cars</span>
                </p>
                {p.notes && <p className="text-[var(--text-muted)]">{p.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="glass-panel rounded-2xl border border-[var(--border-color)] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-main)]">{editing ? "Edit Partner" : "Add Partner"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--tr-hover)]"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Rent-a-Car Name *</label>
                <input required value={form.agency_name} onChange={(e) => setForm({ ...form, agency_name: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="e.g. City Rent A Car" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Contact Person</label>
                  <input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="e.g. Ahmed" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">City</label>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="e.g. Lahore" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Phone *</label>
                  <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="03xx xxxxxxx" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">WhatsApp</label>
                  <input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="03xx xxxxxxx" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">How Many Cars Do They Have?</label>
                <input type="number" min="0" step="1" value={form.total_cars_count} onChange={(e) => setForm({ ...form, total_cars_count: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="e.g. 12" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Notes</label>
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="Anything to remember about them" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl flex-1">
                  {editing ? "Save Changes" : "Add Partner"}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] font-semibold text-[var(--text-main)]">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
