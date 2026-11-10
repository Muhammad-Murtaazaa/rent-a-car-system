import React, { useState, useEffect } from "react";
import { Users, Plus, Search, Edit2, Trash2, X, Wallet, Phone, Calendar, BadgeCheck } from "lucide-react";

export default function EmployeesView({ employees = [], fetchData }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [showPayModal, setShowPayModal] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [payForm, setPayForm] = useState({
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: "Cash",
    month_label: new Date().toISOString().slice(0, 7),
    notes: ""
  });

  const emptyForm = {
    full_name: "",
    role: "Driver",
    phone: "",
    cnic_number: "",
    address: "",
    license_number: "",
    salary_type: "Monthly",
    salary_amount: 0,
    joining_date: new Date().toISOString().slice(0, 10),
    status: "Active",
    notes: ""
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (editingEmployee) {
      setForm({
        full_name: editingEmployee.full_name || "",
        role: editingEmployee.role || "Driver",
        phone: editingEmployee.phone || "",
        cnic_number: editingEmployee.cnic_number || "",
        address: editingEmployee.address || "",
        license_number: editingEmployee.license_number || "",
        salary_type: editingEmployee.salary_type || "Monthly",
        salary_amount: editingEmployee.salary_amount || 0,
        joining_date: editingEmployee.joining_date ? String(editingEmployee.joining_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        status: editingEmployee.status || "Active",
        notes: editingEmployee.notes || ""
      });
    } else {
      setForm(emptyForm);
    }
  }, [editingEmployee, showModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingEmployee ? "PUT" : "POST";
    const url = editingEmployee ? `/api/employees/${editingEmployee.id}` : "/api/employees";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        salary_amount: parseFloat(form.salary_amount) || 0
      })
    });
    if (res.ok) {
      setShowModal(false);
      setEditingEmployee(null);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.detail || "Failed to save employee.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this employee record?")) return;
    const res = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!payTarget) return;
    const res = await fetch(`/api/employees/${payTarget.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payForm,
        amount: parseFloat(payForm.amount)
      })
    });
    if (res.ok) {
      setShowPayModal(false);
      setPayTarget(null);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.detail || "Failed to record salary payment.");
    }
  };

  const filtered = employees.filter(emp => {
    const matchSearch =
      emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.phone?.includes(search) ||
      (emp.cnic_number || "").includes(search);
    const matchRole = roleFilter === "All" || emp.role === roleFilter;
    return matchSearch && matchRole;
  });

  const activeCount = employees.filter(e => e.status === "Active").length;
  const driversCount = employees.filter(e => e.role === "Driver" && e.status === "Active").length;
  const monthlyPayroll = employees
    .filter(e => e.status === "Active" && e.salary_type === "Monthly")
    .reduce((sum, e) => sum + (e.salary_amount || 0), 0);
  const totalPaidAllTime = employees.reduce(
    (sum, e) => sum + (e.payments || []).reduce((ps, p) => ps + (p.amount || 0), 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Employee & Payroll Management</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage drivers, desk staff, managers, salaries, and payout history.</p>
        </div>
        <button
          onClick={() => { setEditingEmployee(null); setShowModal(true); }}
          className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> Add Employee
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[11px] font-bold uppercase text-[var(--text-muted)]">Active Staff</span>
          <div className="text-2xl font-extrabold mt-1 text-[var(--text-main)]">{activeCount} / {employees.length}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[11px] font-bold uppercase text-[var(--text-muted)]">Active Drivers</span>
          <div className="text-2xl font-extrabold mt-1 text-teal-500">{driversCount}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[11px] font-bold uppercase text-[var(--text-muted)]">Monthly Salary Commitment</span>
          <div className="text-2xl font-extrabold mt-1 text-amber-500">PKR {monthlyPayroll.toLocaleString()}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[11px] font-bold uppercase text-[var(--text-muted)]">Total Salaries Paid</span>
          <div className="text-2xl font-extrabold mt-1 text-emerald-500">PKR {totalPaidAllTime.toLocaleString()}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by employee name, phone or CNIC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full app-input rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="app-input rounded-xl px-4 py-3 text-sm focus:outline-none"
        >
          <option value="All">All Roles</option>
          <option value="Driver">Drivers</option>
          <option value="Desk Staff">Desk Staff</option>
          <option value="Manager">Managers</option>
          <option value="Mechanic">Mechanics</option>
          <option value="Accountant">Accountants</option>
          <option value="Washer">Washers</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--tr-hover)] text-[var(--text-muted)] border-b border-[var(--border-color)] uppercase font-semibold">
                <th className="p-4">Employee</th>
                <th className="p-4">Role & Status</th>
                <th className="p-4">Contact & CNIC</th>
                <th className="p-4">Salary Package</th>
                <th className="p-4">Total Paid</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[var(--text-muted)] italic">
                    No employees found. Click "Add Employee" to register your team.
                  </td>
                </tr>
              ) : filtered.map(emp => {
                const paidTotal = (emp.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
                return (
                  <tr key={emp.id} className="hover:bg-[var(--tr-hover)]/30">
                    <td className="p-4">
                      <div className="font-bold text-sm text-[var(--text-main)]">{emp.full_name}</div>
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" /> Joined: {emp.joining_date}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-500 font-bold text-[10px] uppercase">{emp.role}</span>
                      <div className="mt-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          emp.status === "Active" ? "bg-emerald-500/10 text-emerald-500"
                            : emp.status === "On Leave" ? "bg-amber-500/10 text-amber-500"
                            : "bg-rose-500/10 text-rose-500"
                        }`}>
                          {emp.status}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 space-y-0.5">
                      <div className="font-medium text-[var(--text-main)] flex items-center gap-1">
                        <Phone className="h-3 w-3 text-teal-500" /> {emp.phone}
                      </div>
                      {emp.cnic_number && <div className="text-[11px] text-[var(--text-muted)] font-mono">CNIC: {emp.cnic_number}</div>}
                      {emp.license_number && <div className="text-[11px] text-[var(--text-muted)] font-mono">Lic: {emp.license_number}</div>}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-[var(--text-main)]">PKR {(emp.salary_amount || 0).toLocaleString()}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{emp.salary_type}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-emerald-500">PKR {paidTotal.toLocaleString()}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{(emp.payments || []).length} payment(s)</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setPayTarget(emp);
                            setPayForm({
                              amount: String(emp.salary_amount || ""),
                              payment_date: new Date().toISOString().slice(0, 10),
                              payment_method: "Cash",
                              month_label: new Date().toISOString().slice(0, 7),
                              notes: ""
                            });
                            setShowPayModal(true);
                          }}
                          className="py-1.5 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 font-bold text-[11px] flex items-center gap-1"
                        >
                          <Wallet className="h-3 w-3" /> Pay Salary
                        </button>
                        <button
                          onClick={() => { setEditingEmployee(emp); setShowModal(true); }}
                          className="p-1.5 rounded-lg border border-[var(--border-color)] hover:border-teal-500 text-[var(--text-muted)] hover:text-teal-500"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id)}
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

      {/* Add/Edit Employee Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold text-[var(--text-main)]">{editingEmployee ? "Edit Employee" : "Add New Employee"}</h3>
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
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Role *</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full app-input rounded-lg p-2.5">
                    <option value="Driver">Driver / Chauffeur</option>
                    <option value="Desk Staff">Desk Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Mechanic">Mechanic</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Washer">Car Washer</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Phone *</label>
                  <input type="text" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="03001234567" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">CNIC Number</label>
                  <input type="text" value={form.cnic_number} onChange={e => setForm({ ...form, cnic_number: e.target.value })} className="w-full app-input rounded-lg p-2.5 font-mono" placeholder="35201-xxxxxxx-x" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Salary Type</label>
                  <select value={form.salary_type} onChange={e => setForm({ ...form, salary_type: e.target.value })} className="w-full app-input rounded-lg p-2.5">
                    <option value="Monthly">Monthly Fixed</option>
                    <option value="Daily">Daily Wage</option>
                    <option value="Per Trip">Per Trip</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Salary Amount (PKR)</label>
                  <input type="number" min="0" value={form.salary_amount} onChange={e => setForm({ ...form, salary_amount: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Driving License</label>
                  <input type="text" value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Joining Date</label>
                  <input type="date" required value={form.joining_date} onChange={e => setForm({ ...form, joining_date: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full app-input rounded-lg p-2.5">
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Home Address</label>
                <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
              </div>
              <button type="submit" className="w-full btn-accent text-white font-semibold py-3 rounded-xl">
                {editingEmployee ? "Save Employee Updates" : "Register Employee"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Pay Salary Modal */}
      {showPayModal && payTarget && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 border border-[var(--border-color)]">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold">Pay Salary: {payTarget.full_name}</h3>
              <button onClick={() => setShowPayModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handlePaySubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Amount (PKR) *</label>
                  <input type="number" required min="1" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Payment Date *</label>
                  <input type="date" required value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Method</label>
                  <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })} className="w-full app-input rounded-lg p-2.5">
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="EasyPaisa/JazzCash">EasyPaisa / JazzCash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Salary Month</label>
                  <input type="month" value={payForm.month_label} onChange={e => setPayForm({ ...payForm, month_label: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Notes</label>
                <input type="text" value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="Salary / Bonus / Advance" />
              </div>
              <button type="submit" className="w-full btn-accent text-white font-semibold py-3 rounded-xl">
                Confirm Salary Payment
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
