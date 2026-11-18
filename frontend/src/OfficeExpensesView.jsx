import React, { useMemo, useState, useEffect } from "react";
import { Briefcase, Plus, Search, Trash2, Edit2, X, Eye, Download, Paperclip } from "lucide-react";
import { localTodayStr } from "./dateUtils";
import { fileViewUrl, fileDownloadUrl } from "./fileUtils";

// Office Maintenance: the agency's own running costs (rent, utilities,
// fuel, salaries...). Kept apart from booking money and vehicle workshop
// costs; the Dashboard / Reports totals fold these in as cash out.
const PRESET_CATEGORIES = [
  "Office Rent", "Utilities", "Fuel", "Salaries", "Repairs",
  "Supplies", "Marketing", "Other",
];
const PAYMENT_METHODS = ["Cash", "Cheque", "Bank Transfer", "Online Transfer"];

export default function OfficeExpensesView({ officeExpenses = [], fetchData, addSignal = 0 }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [uploading, setUploading] = useState(false);

  const emptyForm = {
    expense_date: localTodayStr(),
    category: "Other",
    description: "",
    amount: "",
    paid_by: "",
    payment_method: "Cash",
    attachments: [],
  };
  const [form, setForm] = useState(emptyForm);

  const knownCategories = useMemo(() => {
    const set = new Set(PRESET_CATEGORIES);
    (officeExpenses || []).forEach((e) => { if (e.category) set.add(e.category); });
    return [...set];
  }, [officeExpenses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (officeExpenses || []).filter((e) => {
      if (categoryFilter !== "All" && e.category !== categoryFilter) return false;
      if (dateFrom && e.expense_date < dateFrom) return false;
      if (dateTo && e.expense_date > dateTo) return false;
      if (q) {
        const hay = `${e.category || ""} ${e.description || ""} ${e.paid_by || ""} ${e.payment_method || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [officeExpenses, search, categoryFilter, dateFrom, dateTo]);

  const filteredTotal = filtered.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const thisMonthKey = localTodayStr().slice(0, 7);
  const thisMonthTotal = (officeExpenses || [])
    .filter((e) => (e.expense_date || "").startsWith(thisMonthKey))
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const grandTotal = (officeExpenses || []).reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  const categoryTotals = useMemo(() => {
    const map = {};
    filtered.forEach((e) => {
      const key = e.category || "Other";
      map[key] = (map[key] || 0) + (Number(e.amount) || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  // Simple Mode quick action: open the add-expense form when the signal bumps.
  useEffect(() => {
    if (addSignal) openAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal]);

  const openEdit = (e) => {
    setEditing(e);
    setForm({
      expense_date: e.expense_date || localTodayStr(),
      category: e.category || "Other",
      description: e.description || "",
      amount: e.amount ?? "",
      paid_by: e.paid_by || "",
      payment_method: e.payment_method || "Cash",
      attachments: Array.isArray(e.attachments) ? e.attachments : [],
    });
    setShowModal(true);
  };

  const handleUpload = async (ev) => {
    const files = Array.from(ev.target.files || []);
    ev.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      const added = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/uploads", { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || `Upload failed for ${f.name}`);
        }
        const data = await res.json();
        added.push({ name: data.filename || f.name, file_path: data.file_path });
      }
      setForm((prev) => ({ ...prev, attachments: [...(prev.attachments || []), ...added] }));
    } catch (err) {
      alert(err.message || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    const payload = {
      ...form,
      amount: Number(form.amount) || 0,
      paid_by: form.paid_by || null,
    };
    const res = await fetch(editing ? `/api/office-expenses/${editing.id}` : "/api/office-expenses", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowModal(false);
      setEditing(null);
      fetchData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Error saving the office expense.");
    }
  };

  const handleDelete = async (e) => {
    if (!window.confirm(`Delete this office expense (${e.category} — PKR ${Number(e.amount || 0).toLocaleString()})?`)) return;
    const res = await fetch(`/api/office-expenses/${e.id}`, { method: "DELETE" });
    if (res.ok) {
      fetchData();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || "Error deleting the office expense.");
    }
  };

  const fmt = (n) => `PKR ${Number(n || 0).toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)] flex items-center gap-2">
            <Briefcase className="h-7 w-7" /> Office Maintenance
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Office running expenses — rent, utilities, fuel, salaries and more. These totals also flow into the Dashboard and Reports as cash out.</p>
        </div>
        <button
          onClick={openAdd}
          className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-lg"
        >
          <Plus className="h-4 w-4" /> Add Expense
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "This Month", value: fmt(thisMonthTotal) },
          { label: "Filtered Period Total", value: fmt(filteredTotal) },
          { label: "All Time", value: fmt(grandTotal) },
        ].map((c) => (
          <div key={c.label} className="glass-panel rounded-2xl border border-[var(--border-color)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{c.label}</p>
            <p className="text-xl font-bold text-[var(--text-main)] mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Per-category totals for the current filter */}
      {categoryTotals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categoryTotals.map(([cat, total]) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? "All" : cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${categoryFilter === cat ? "bg-teal-600 text-white border-teal-600" : "border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--tr-hover)]"}`}
            >
              {cat}: {fmt(total)}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Search</label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Description, category, paid by..."
              className="w-full app-input rounded-lg p-2 pl-8 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Category</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="app-input rounded-lg p-2 text-sm">
            <option value="All">All Categories</option>
            {knownCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">From</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="app-input rounded-lg p-2 text-sm" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">To</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="app-input rounded-lg p-2 text-sm" />
        </div>
        {(dateFrom || dateTo || categoryFilter !== "All" || search) && (
          <button
            onClick={() => { setSearch(""); setCategoryFilter("All"); setDateFrom(""); setDateTo(""); }}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--tr-hover)]"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* List */}
      <div className="glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/20 border-b border-[var(--border-color)] text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
                <th className="p-4">Date</th>
                <th className="p-4">Category</th>
                <th className="p-4">Description</th>
                <th className="p-4">Paid By</th>
                <th className="p-4">Method</th>
                <th className="p-4">Receipts</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-855 text-sm">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-[var(--tr-hover)] transition-colors">
                  <td className="p-4 whitespace-nowrap text-[var(--text-main)]">{e.expense_date}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-700 dark:text-purple-400 font-semibold">{e.category}</span>
                  </td>
                  <td className="p-4 text-[var(--text-main)]">{e.description || "—"}</td>
                  <td className="p-4 text-[var(--text-muted)]">{e.paid_by || "—"}</td>
                  <td className="p-4 text-[var(--text-muted)]">{e.payment_method || "Cash"}</td>
                  <td className="p-4">
                    {Array.isArray(e.attachments) && e.attachments.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {e.attachments.map((a, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 text-xs">
                            <Paperclip className="h-3 w-3 text-[var(--text-muted)]" />
                            <span className="max-w-[140px] truncate text-[var(--text-main)]">{a.name}</span>
                            <a href={fileViewUrl(a.file_path)} target="_blank" rel="noreferrer" className="text-teal-700 dark:text-teal-400 inline-flex items-center gap-0.5 font-semibold"><Eye className="h-3 w-3" /> View</a>
                            <a href={fileDownloadUrl(a.file_path)} className="text-teal-700 dark:text-teal-400 inline-flex items-center gap-0.5 font-semibold"><Download className="h-3 w-3" /></a>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="p-4 font-bold text-[var(--text-main)] whitespace-nowrap">{fmt(e.amount)}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-[var(--tr-hover)]" title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDelete(e)} className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-rose-500/10 text-rose-600" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-[var(--text-muted)]">
                    No office expenses found. Click "Add Expense" to record the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div className="glass-panel rounded-2xl border border-[var(--border-color)] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[var(--text-main)]">{editing ? "Edit Office Expense" : "Add Office Expense"}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-[var(--tr-hover)]"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Date *</label>
                  <input type="date" required value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Amount (PKR) *</label>
                  <input type="number" min="0" step="any" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="e.g. 45000" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Category * (pick or type your own)</label>
                <input
                  list="office-expense-categories"
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full app-input rounded-lg p-2 text-sm"
                  placeholder="Office Rent, Utilities, Fuel..."
                />
                <datalist id="office-expense-categories">
                  {knownCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="e.g. November office rent" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Paid By</label>
                  <input value={form.paid_by} onChange={(e) => setForm({ ...form, paid_by: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm" placeholder="e.g. Owner / Manager name" />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Payment Method</label>
                  <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className="w-full app-input rounded-lg p-2 text-sm">
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    {form.payment_method && !PAYMENT_METHODS.includes(form.payment_method) && (
                      <option value={form.payment_method}>{form.payment_method} (previous)</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Receipts / Documents</label>
                <input type="file" multiple onChange={handleUpload} className="w-full app-input rounded-lg p-2 text-sm" />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Unlimited files of any type (bills, receipts, scans...). Select several at once.</p>
                {uploading && <p className="text-xs text-[var(--text-muted)] mt-1">Uploading...</p>}
                {(form.attachments || []).length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {form.attachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs border border-[var(--border-color)] rounded-lg px-2.5 py-1.5">
                        <Paperclip className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="flex-1 truncate text-[var(--text-main)]">{a.name}</span>
                        <a href={fileViewUrl(a.file_path)} target="_blank" rel="noreferrer" className="text-teal-700 dark:text-teal-400 font-semibold inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> View</a>
                        <a href={fileDownloadUrl(a.file_path)} className="text-teal-700 dark:text-teal-400 font-semibold inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" /></a>
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((_, x) => x !== i) }))}
                          className="text-rose-600 font-semibold inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl flex-1">
                  {editing ? "Save Changes" : "Add Expense"}
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
