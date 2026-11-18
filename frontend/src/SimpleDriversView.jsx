import React, { useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, Edit2, X, Phone } from "lucide-react";
import { localTodayStr } from "./dateUtils";

// Simple Mode Drivers: one page, two plain lists.
// - "Our Drivers" are Employees with the Driver role, so they appear in
//   the booking form's driver picker automatically.
// - "Freelance Drivers" are the /api/drivers directory.
// Only shown in Simple Mode.
export default function SimpleDriversView() {
  const [employees, setEmployees] = useState([]);
  const [freelancers, setFreelancers] = useState([]);
  const [modal, setModal] = useState(null); // "company" | "freelance" | null
  const [editing, setEditing] = useState(null);

  const emptyForm = { name: "", phone: "", cnic: "", license_number: "", daily_wage: "" };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const [empRes, drvRes] = await Promise.all([
        fetch("/api/employees?limit=1000"),
        fetch("/api/drivers"),
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
      if (drvRes.ok) setFreelancers(await drvRes.json());
    } catch (err) {
      console.error("Error loading drivers:", err);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const companyDrivers = (employees || []).filter((e) => e.role === "Driver" && e.status !== "Inactive");

  const openAdd = (kind) => {
    setEditing(null);
    setForm(emptyForm);
    setModal(kind);
  };

  const openEditCompany = (e) => {
    setEditing(e);
    setForm({
      name: e.full_name || "",
      phone: e.phone || "",
      cnic: e.cnic_number || "",
      license_number: e.license_number || "",
      daily_wage: "",
    });
    setModal("company");
  };

  const openEditFreelance = (d) => {
    setEditing(d);
    setForm({
      name: d.name || "",
      phone: d.phone || "",
      cnic: d.cnic || "",
      license_number: d.license_number || "",
      daily_wage: d.daily_wage ?? "",
    });
    setModal("freelance");
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    let res;
    if (modal === "company") {
      const payload = {
        full_name: form.name,
        phone: form.phone,
        cnic_number: form.cnic || null,
        license_number: form.license_number || null,
        role: "Driver",
        status: "Active",
        joining_date: editing?.joining_date || localTodayStr(),
        salary_type: editing?.salary_type || "Monthly",
        salary_amount: editing?.salary_amount || 0,
      };
      res = await fetch(editing ? `/api/employees/${editing.id}` : "/api/employees", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      const payload = {
        name: form.name,
        phone: form.phone,
        cnic: form.cnic || null,
        license_number: form.license_number || null,
        daily_wage: Number(form.daily_wage) || 0,
        driver_type: "Freelance",
        status: editing?.status || "Available",
      };
      res = await fetch(editing ? `/api/drivers/${editing.id}` : "/api/drivers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    if (res.ok) {
      setModal(null);
      setEditing(null);
      load();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Error saving the driver.");
    }
  };

  const handleDeleteCompany = async (e) => {
    if (!window.confirm(`Remove driver "${e.full_name}"?`)) return;
    const res = await fetch(`/api/employees/${e.id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Error removing the driver.");
    }
  };

  const handleDeleteFreelance = async (d) => {
    if (!window.confirm(`Remove freelance driver "${d.name}"?`)) return;
    const res = await fetch(`/api/drivers/${d.id}`, { method: "DELETE" });
    if (res.ok) load();
    else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Error removing the driver.");
    }
  };

  const DriverCard = ({ title, phone, cnic, license, extra, onEdit, onDelete }) => (
    <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-bold text-[var(--text-main)]">{title}</p>
        <div className="flex gap-1.5 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--tr-hover)]" title="Edit">
            <Edit2 className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-rose-500/10 text-rose-600" title="Remove">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-2 space-y-1 text-sm text-[var(--text-muted)]">
        <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {phone}</p>
        {cnic && <p>CNIC: {cnic}</p>}
        {license && <p>Licence: {license}</p>}
        {extra}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)] flex items-center gap-2">
          <KeyRound className="h-7 w-7" /> Drivers
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">All your drivers in one place — your own drivers and the freelance drivers you call when needed.</p>
      </div>

      {/* Company drivers */}
      <section className="space-y-4">
        <div className="page-toolbar">
          <h3 className="text-lg font-bold text-[var(--text-main)]">Our Drivers ({companyDrivers.length})</h3>
          <button onClick={() => openAdd("company")} className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-lg">
            <Plus className="h-4 w-4" /> Add Our Driver
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] -mt-2">These drivers appear in the booking form — just search their name when you make a booking.</p>
        {companyDrivers.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-6 text-center">
            <p className="text-[var(--text-muted)]">No drivers yet. Tap "Add Our Driver" to add the first one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {companyDrivers.map((e) => (
              <DriverCard
                key={e.id}
                title={e.full_name}
                phone={e.phone}
                cnic={e.cnic_number}
                license={e.license_number}
                onEdit={() => openEditCompany(e)}
                onDelete={() => handleDeleteCompany(e)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Freelance drivers */}
      <section className="space-y-4">
        <div className="page-toolbar">
          <h3 className="text-lg font-bold text-[var(--text-main)]">Freelance Drivers ({freelancers.length})</h3>
          <button onClick={() => openAdd("freelance")} className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-lg">
            <Plus className="h-4 w-4" /> Add Freelance Driver
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] -mt-2">Drivers who are not on your staff — keep their number and daily wage here so you can call them anytime.</p>
        {freelancers.length === 0 ? (
          <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-6 text-center">
            <p className="text-[var(--text-muted)]">No freelance drivers yet. Tap "Add Freelance Driver" to add the first one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {freelancers.map((d) => (
              <DriverCard
                key={d.id}
                title={d.name}
                phone={d.phone}
                cnic={d.cnic}
                license={d.license_number}
                extra={Number(d.daily_wage) > 0 ? <p>Daily wage: <span className="font-bold text-[var(--text-main)]">PKR {Number(d.daily_wage).toLocaleString()}</span></p> : null}
                onEdit={() => openEditFreelance(d)}
                onDelete={() => handleDeleteFreelance(d)}
              />
            ))}
          </div>
        )}
      </section>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(null)}>
          <div className="glass-panel rounded-2xl border border-[var(--border-color)] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-main)]">
                {editing ? "Edit Driver" : modal === "company" ? "Add Our Driver" : "Add Freelance Driver"}
              </h3>
              <button onClick={() => setModal(null)} className="p-1.5 rounded-lg hover:bg-[var(--tr-hover)]"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Driver Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Phone *</label>
                <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="03xx xxxxxxx" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">CNIC</label>
                  <input value={form.cnic} onChange={(e) => setForm({ ...form, cnic: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="xxxxx-xxxxxxx-x" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Driving Licence No</label>
                  <input value={form.license_number} onChange={(e) => setForm({ ...form, license_number: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="Licence number" />
                </div>
              </div>
              {modal === "freelance" && (
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Daily Wage (PKR)</label>
                  <input type="number" min="0" step="any" value={form.daily_wage} onChange={(e) => setForm({ ...form, daily_wage: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="e.g. 3000" />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl flex-1">
                  {editing ? "Save Changes" : "Add Driver"}
                </button>
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2.5 rounded-xl border border-[var(--border-color)] font-semibold text-[var(--text-main)]">
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
