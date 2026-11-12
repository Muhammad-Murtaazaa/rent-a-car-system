import React, { useState } from "react";
import { 
  Building2, Plus, Search, Trash2, Edit2, X, Send, 
  DollarSign, TrendingUp, Car, Phone, Calendar, ArrowRightLeft,
  CheckCircle, Clock, AlertCircle, FileSpreadsheet
} from "lucide-react";

export default function SuppliersView({ supplierDeals = [], fetchData, branding = {} }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

  const emptyForm = {
    supplier_name: "",
    supplier_phone: "",
    supplier_cnic: "",
    car_make_model: "",
    car_plate_number: "",
    car_color: "",
    customer_name: "",
    customer_phone: "",
    start_date: today,
    end_date: nextWeek,
    days: 5,
    supplier_daily_rate: 10000,
    supplier_total_cost: 50000,
    client_daily_rate: 15000,
    client_total_rent: 75000,
    commission_amount: 25000,
    driver_expense: 0,
    fuel_expense: 0,
    other_expense: 0,
    total_expenses: 0,
    net_cash_profit: 25000,
    client_received_amount: 0,
    client_remaining_balance: 75000,
    supplier_paid_amount: 0,
    supplier_remaining_payable: 50000,
    status: "Active",
    notes: ""
  };

  const [form, setForm] = useState(emptyForm);

  const openAdd = () => {
    setEditingDeal(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (deal) => {
    setEditingDeal(deal);
    setForm({
      ...deal,
      start_date: deal.start_date ? String(deal.start_date).slice(0, 10) : today,
      end_date: deal.end_date ? String(deal.end_date).slice(0, 10) : today
    });
    setShowModal(true);
  };

  // Live recalculations
  const updateDatesAndDays = (start, end, customDays = null) => {
    let daysCount = customDays;
    if (daysCount === null || daysCount === undefined) {
      const d1 = new Date(start);
      const d2 = new Date(end);
      daysCount = Math.max(1, Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)));
    }
    const suppCost = Math.round(daysCount * (parseFloat(form.supplier_daily_rate) || 0));
    const clientRent = Math.round(daysCount * (parseFloat(form.client_daily_rate) || 0));
    const grossComm = clientRent - suppCost;
    const totExp = (parseFloat(form.driver_expense) || 0) + (parseFloat(form.fuel_expense) || 0) + (parseFloat(form.other_expense) || 0);
    const netProfit = grossComm - totExp;
    const clientRec = parseFloat(form.client_received_amount) || 0;
    const suppPaid = parseFloat(form.supplier_paid_amount) || 0;

    setForm(prev => ({
      ...prev,
      start_date: start,
      end_date: end,
      days: daysCount,
      supplier_total_cost: suppCost,
      client_total_rent: clientRent,
      commission_amount: grossComm,
      total_expenses: totExp,
      net_cash_profit: netProfit,
      client_remaining_balance: Math.max(0, clientRent - clientRec),
      supplier_remaining_payable: Math.max(0, suppCost - suppPaid)
    }));
  };

  const updateRatesAndExpenses = (field, val) => {
    const next = { ...form, [field]: val };
    const days = parseInt(next.days, 10) || 1;
    const sRate = parseFloat(field === "supplier_daily_rate" ? val : next.supplier_daily_rate) || 0;
    const cRate = parseFloat(field === "client_daily_rate" ? val : next.client_daily_rate) || 0;
    const sCost = field === "supplier_total_cost" ? (parseFloat(val) || 0) : Math.round(days * sRate);
    const cRent = field === "client_total_rent" ? (parseFloat(val) || 0) : Math.round(days * cRate);
    
    const dExp = parseFloat(field === "driver_expense" ? val : next.driver_expense) || 0;
    const fExp = parseFloat(field === "fuel_expense" ? val : next.fuel_expense) || 0;
    const oExp = parseFloat(field === "other_expense" ? val : next.other_expense) || 0;
    const totExp = dExp + fExp + oExp;

    const grossComm = cRent - sCost;
    const netProfit = grossComm - totExp;

    const cRec = parseFloat(field === "client_received_amount" ? val : next.client_received_amount) || 0;
    const sPaid = parseFloat(field === "supplier_paid_amount" ? val : next.supplier_paid_amount) || 0;

    setForm({
      ...next,
      supplier_daily_rate: sRate,
      supplier_total_cost: sCost,
      client_daily_rate: cRate,
      client_total_rent: cRent,
      commission_amount: grossComm,
      driver_expense: dExp,
      fuel_expense: fExp,
      other_expense: oExp,
      total_expenses: totExp,
      net_cash_profit: netProfit,
      client_remaining_balance: Math.max(0, cRent - cRec),
      supplier_remaining_payable: Math.max(0, sCost - sPaid)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingDeal ? "PUT" : "POST";
    const url = editingDeal ? `/api/supplier-deals/${editingDeal.id}` : "/api/supplier-deals";

    const payload = {
      ...form,
      days: parseInt(form.days, 10) || 1,
      supplier_daily_rate: parseFloat(form.supplier_daily_rate) || 0,
      supplier_total_cost: parseFloat(form.supplier_total_cost) || 0,
      client_daily_rate: parseFloat(form.client_daily_rate) || 0,
      client_total_rent: parseFloat(form.client_total_rent) || 0,
      commission_amount: parseFloat(form.commission_amount) || 0,
      driver_expense: parseFloat(form.driver_expense) || 0,
      fuel_expense: parseFloat(form.fuel_expense) || 0,
      other_expense: parseFloat(form.other_expense) || 0,
      total_expenses: parseFloat(form.total_expenses) || 0,
      net_cash_profit: parseFloat(form.net_cash_profit) || 0,
      client_received_amount: parseFloat(form.client_received_amount) || 0,
      client_remaining_balance: parseFloat(form.client_remaining_balance) || 0,
      supplier_paid_amount: parseFloat(form.supplier_paid_amount) || 0,
      supplier_remaining_payable: parseFloat(form.supplier_remaining_payable) || 0
    };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setShowModal(false);
      setEditingDeal(null);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.detail || "Error saving supplier deal.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this supplier sublet deal record?")) return;
    const res = await fetch(`/api/supplier-deals/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const sendSupplierWhatsApp = (deal) => {
    const raw = deal.supplier_phone || "";
    const clean = raw.replace(/[^0-9]/g, "");
    if (!clean) return alert("Supplier has no valid phone number.");
    const num = clean.startsWith("0") ? "92" + clean.substring(1) : clean;
    const brand = branding?.name || "Rent A Car Management System";
    const text = 
      `*VEHICLE SUBLET DEAL CONFIRMATION* - ${brand}\n` +
      `Supplier / Owner: ${deal.supplier_name}\n` +
      `Vehicle: ${deal.car_make_model} (${deal.car_plate_number})\n` +
      `Rental Period: ${deal.start_date} to ${deal.end_date} (${deal.days} days)\n` +
      `Agreed Supplier Rate: PKR ${Number(deal.supplier_daily_rate).toLocaleString()}/day\n` +
      `Total Cost Payable: PKR ${Number(deal.supplier_total_cost).toLocaleString()}\n` +
      `Amount Paid: PKR ${Number(deal.supplier_paid_amount).toLocaleString()}\n` +
      `*Remaining Balance to Supplier: PKR ${Number(deal.supplier_remaining_payable).toLocaleString()}*`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const sendClientWhatsApp = (deal) => {
    const raw = deal.customer_phone || "";
    const clean = raw.replace(/[^0-9]/g, "");
    if (!clean) return alert("Client has no valid phone number.");
    const num = clean.startsWith("0") ? "92" + clean.substring(1) : clean;
    const brand = branding?.name || "Rent A Car Management System";
    const text = 
      `*VEHICLE RENTAL BOOKING* - ${brand}\n` +
      `Dear ${deal.customer_name},\n` +
      `Vehicle: ${deal.car_make_model} (${deal.car_plate_number})\n` +
      `Duration: ${deal.start_date} to ${deal.end_date} (${deal.days} days)\n` +
      `Total Rent: PKR ${Number(deal.client_total_rent).toLocaleString()}\n` +
      `Advance Paid: PKR ${Number(deal.client_received_amount).toLocaleString()}\n` +
      `*Remaining Balance Due: PKR ${Number(deal.client_remaining_balance).toLocaleString()}*`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Filtered list
  const filtered = supplierDeals.filter(d => {
    const s = search.toLowerCase();
    const matchSearch = 
      (d.supplier_name || "").toLowerCase().includes(s) ||
      (d.car_make_model || "").toLowerCase().includes(s) ||
      (d.car_plate_number || "").toLowerCase().includes(s) ||
      (d.customer_name || "").toLowerCase().includes(s);
    const matchStatus = statusFilter === "All" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // KPI calculations
  const totalDeals = supplierDeals.length;
  const totalClientRevenue = supplierDeals.reduce((s, d) => s + (d.client_total_rent || 0), 0);
  const totalSupplierCost = supplierDeals.reduce((s, d) => s + (d.supplier_total_cost || 0), 0);
  const totalExpensesCut = supplierDeals.reduce((s, d) => s + (d.total_expenses || 0), 0);
  const totalGrossCommission = supplierDeals.reduce((s, d) => s + (d.commission_amount || 0), 0);
  const totalNetCashProfit = supplierDeals.reduce((s, d) => s + (d.net_cash_profit || 0), 0);
  const totalClientReceivable = supplierDeals.reduce((s, d) => s + (d.client_remaining_balance || 0), 0);
  const totalSupplierPayable = supplierDeals.reduce((s, d) => s + (d.supplier_remaining_payable || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Toolbar */}
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">
            Supplier & Sublet Deals
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Source cars from external suppliers/owners, rent to clients, and track commission & cash profit after cutting all expenses.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> New Sublet Car Deal
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">Total Sourced Deals</span>
          <div className="text-2xl font-extrabold text-[var(--text-main)] mt-1">{totalDeals}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Sold: <span className="font-semibold text-teal-500">PKR {totalClientRevenue.toLocaleString()}</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">Supplier Payout Cost</span>
          <div className="text-2xl font-extrabold text-amber-500 mt-1">PKR {totalSupplierCost.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Payable: <span className="font-semibold text-rose-500">PKR {totalSupplierPayable.toLocaleString()}</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">Total Expenses Cut</span>
          <div className="text-2xl font-extrabold text-orange-500 mt-1">PKR {totalExpensesCut.toLocaleString()}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Gross Comm: <span className="font-semibold text-teal-400">PKR {totalGrossCommission.toLocaleString()}</span>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider block">Net Cash Profit</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            PKR {totalNetCashProfit.toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Pending Client: <span className="font-semibold text-amber-500">PKR {totalClientReceivable.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by Supplier, Car Plate, Make/Model, or Client Name..."
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
          <option value="All">All Deal Statuses</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Pending Payment">Pending Payment</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      {/* Deals Table (Desktop) */}
      <div className="hidden lg:block glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--tr-hover)] text-[var(--text-muted)] border-b border-[var(--border-color)] uppercase font-semibold">
              <th className="p-4">Supplier / Owner</th>
              <th className="p-4">Sourced Car</th>
              <th className="p-4">Rented To (Client)</th>
              <th className="p-4">Cost vs Sold</th>
              <th className="p-4">Commission & Profit</th>
              <th className="p-4">Payment Ledger</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-color)]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-10 text-center text-[var(--text-muted)] italic">
                  No sublet supplier deals logged yet. Click "New Sublet Car Deal" to record an outsourced rental.
                </td>
              </tr>
            ) : filtered.map(d => (
              <tr key={d.id} className="hover:bg-[var(--tr-hover)]/30 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-sm text-[var(--text-main)]">{d.supplier_name}</div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">{d.supplier_phone}</div>
                  {d.supplier_cnic && <div className="text-[10px] text-[var(--text-muted)] font-mono">{d.supplier_cnic}</div>}
                </td>
                <td className="p-4">
                  <div className="font-bold text-[var(--text-main)]">{d.car_make_model}</div>
                  <div className="text-teal-700 dark:text-teal-400 font-mono font-bold">{d.car_plate_number}</div>
                  {d.car_color && <div className="text-[10px] text-[var(--text-muted)]">{d.car_color}</div>}
                </td>
                <td className="p-4">
                  <div className="font-bold text-[var(--text-main)]">{d.customer_name}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{d.customer_phone}</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                    {String(d.start_date).slice(0, 10)} → {String(d.end_date).slice(0, 10)} ({d.days}d)
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-[11px]">
                    <span className="text-[var(--text-muted)]">Taken:</span>{" "}
                    <span className="font-semibold text-amber-500 font-mono">PKR {Number(d.supplier_total_cost).toLocaleString()}</span>
                  </div>
                  <div className="text-[11px]">
                    <span className="text-[var(--text-muted)]">Sold:</span>{" "}
                    <span className="font-semibold text-teal-500 font-mono">PKR {Number(d.client_total_rent).toLocaleString()}</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-[11px] text-teal-400 font-bold">
                    Gross Comm: PKR {Number(d.commission_amount).toLocaleString()}
                  </div>
                  {d.total_expenses > 0 && (
                    <div className="text-[10px] text-orange-400">
                      - Exp: PKR {Number(d.total_expenses).toLocaleString()}
                    </div>
                  )}
                  <div className="mt-1">
                    <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Net: PKR {Number(d.net_cash_profit).toLocaleString()}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="text-[10px]">
                    <span className="text-[var(--text-muted)]">Client Bal:</span>{" "}
                    <span className={d.client_remaining_balance > 0 ? "font-bold text-rose-500" : "font-bold text-emerald-500"}>
                      {d.client_remaining_balance > 0 ? `PKR ${Number(d.client_remaining_balance).toLocaleString()}` : "✓ Paid"}
                    </span>
                  </div>
                  <div className="text-[10px] mt-0.5">
                    <span className="text-[var(--text-muted)]">Supplier Bal:</span>{" "}
                    <span className={d.supplier_remaining_payable > 0 ? "font-bold text-amber-500" : "font-bold text-emerald-500"}>
                      {d.supplier_remaining_payable > 0 ? `PKR ${Number(d.supplier_remaining_payable).toLocaleString()}` : "✓ Paid"}
                    </span>
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    d.status === "Completed" ? "bg-emerald-500/10 text-emerald-500" :
                    d.status === "Active" ? "bg-teal-500/10 text-teal-500" :
                    d.status === "Pending Payment" ? "bg-amber-500/10 text-amber-500" :
                    "bg-rose-500/10 text-rose-500"
                  }`}>
                    {d.status}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => sendSupplierWhatsApp(d)}
                      className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20"
                      title="WhatsApp to Supplier"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => sendClientWhatsApp(d)}
                      className="p-1.5 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 hover:bg-teal-500/20"
                      title="WhatsApp to Client"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEdit(d)}
                      className="p-1.5 rounded-lg border border-[var(--border-color)] hover:border-teal-500 text-[var(--text-muted)]"
                      title="Edit Deal"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
                      title="Delete Deal"
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

      {/* Mobile Cards */}
      <div className="grid grid-cols-1 gap-4 lg:hidden">
        {filtered.map(d => (
          <div key={d.id} className="glass-panel p-4 rounded-2xl border border-[var(--border-color)] space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm text-[var(--text-main)]">{d.car_make_model}</h4>
                <p className="text-[11px] font-mono font-bold text-teal-600 dark:text-teal-400">{d.car_plate_number}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                d.status === "Completed" ? "bg-emerald-500/10 text-emerald-500" :
                d.status === "Active" ? "bg-teal-500/10 text-teal-500" : "bg-amber-500/10 text-amber-500"
              }`}>
                {d.status}
              </span>
            </div>

            <div className="text-xs space-y-1 text-[var(--text-muted)] border-t border-b border-[var(--border-color)] py-2">
              <p><span className="font-semibold text-[var(--text-main)]">Supplier:</span> {d.supplier_name} ({d.supplier_phone})</p>
              <p><span className="font-semibold text-[var(--text-main)]">Rented To:</span> {d.customer_name} ({d.customer_phone})</p>
              <p><span className="font-semibold text-[var(--text-main)]">Duration:</span> {d.days} days ({String(d.start_date).slice(0, 10)} → {String(d.end_date).slice(0, 10)})</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block">Supplier Cost</span>
                <span className="font-bold text-amber-500 font-mono">PKR {Number(d.supplier_total_cost).toLocaleString()}</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)]">
                <span className="text-[10px] text-[var(--text-muted)] block">Client Price</span>
                <span className="font-bold text-teal-500 font-mono">PKR {Number(d.client_total_rent).toLocaleString()}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Net Cash Profit</span>
                <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">PKR {Number(d.net_cash_profit).toLocaleString()}</span>
              </div>
              <div className="text-right text-[10px] text-[var(--text-muted)]">
                <div>Comm: PKR {Number(d.commission_amount).toLocaleString()}</div>
                <div>Exp: PKR {Number(d.total_expenses).toLocaleString()}</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
              <button onClick={() => sendSupplierWhatsApp(d)} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1">
                <Send className="h-3.5 w-3.5" /> Supplier WA
              </button>
              <button onClick={() => sendClientWhatsApp(d)} className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 text-xs font-semibold flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Client WA
              </button>
              <button onClick={() => openEdit(d)} className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)]">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Deal Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-4 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold text-[var(--text-main)]">
                {editingDeal ? `Edit Sublet Deal #${editingDeal.id}` : "Log Sourced / Sublet Car Deal"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Section 1: Supplier & Car Sourced */}
              <div className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]/40 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> 1. Supplier / Car Owner Sourced From
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Supplier / Owner Name *</label>
                    <input type="text" required placeholder="e.g. Usman Car Rentals / Malik" value={form.supplier_name} onChange={e => setForm({...form, supplier_name: e.target.value})} className="w-full app-input rounded-lg p-2" />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Supplier Phone *</label>
                    <input type="text" required placeholder="03001234567" value={form.supplier_phone} onChange={e => setForm({...form, supplier_phone: e.target.value})} className="w-full app-input rounded-lg p-2" />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Supplier CNIC</label>
                    <input type="text" placeholder="35201xxxxxxx" value={form.supplier_cnic || ""} onChange={e => setForm({...form, supplier_cnic: e.target.value})} className="w-full app-input rounded-lg p-2 font-mono" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Car Make & Model *</label>
                    <input type="text" required placeholder="e.g. Toyota Land Cruiser V8" value={form.car_make_model} onChange={e => setForm({...form, car_make_model: e.target.value})} className="w-full app-input rounded-lg p-2" />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Plate Number *</label>
                    <input type="text" required placeholder="e.g. LEM-23-4567" value={form.car_plate_number} onChange={e => setForm({...form, car_plate_number: e.target.value.toUpperCase()})} className="w-full app-input rounded-lg p-2 font-mono" />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Color</label>
                    <input type="text" placeholder="e.g. Black / White" value={form.car_color || ""} onChange={e => setForm({...form, car_color: e.target.value})} className="w-full app-input rounded-lg p-2" />
                  </div>
                </div>
              </div>

              {/* Section 2: Client & Rental Schedule */}
              <div className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]/40 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-teal-500 flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5" /> 2. Client Rented To & Duration
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Client Full Name *</label>
                    <input type="text" required placeholder="Customer Full Name" value={form.customer_name} onChange={e => setForm({...form, customer_name: e.target.value})} className="w-full app-input rounded-lg p-2" />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Client Phone *</label>
                    <input type="text" required placeholder="03211234567" value={form.customer_phone} onChange={e => setForm({...form, customer_phone: e.target.value})} className="w-full app-input rounded-lg p-2" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Start Date</label>
                    <input type="date" required value={form.start_date} onChange={e => updateDatesAndDays(e.target.value, form.end_date)} className="w-full app-input rounded-lg p-2" />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">End Date</label>
                    <input type="date" required value={form.end_date} onChange={e => updateDatesAndDays(form.start_date, e.target.value)} className="w-full app-input rounded-lg p-2" />
                  </div>
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Rental Days</label>
                    <input type="number" min="1" value={form.days} onChange={e => updateDatesAndDays(form.start_date, form.end_date, parseInt(e.target.value, 10))} className="w-full app-input rounded-lg p-2 font-mono" />
                  </div>
                </div>
              </div>

              {/* Section 3: Financials - Taken Cost vs Sold Price */}
              <div className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]/40 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" /> 3. Sourced Price vs Client Price (Commission)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-2">
                    <span className="font-bold text-[10px] uppercase text-amber-500 block">Supplier Cost (Price Taken)</span>
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Supplier Daily Rate</label>
                      <input type="number" min="0" value={form.supplier_daily_rate} onChange={e => updateRatesAndExpenses("supplier_daily_rate", e.target.value)} className="w-full app-input rounded-lg p-1.5 font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Total Sourced Cost (PKR)</label>
                      <input type="number" min="0" value={form.supplier_total_cost} onChange={e => updateRatesAndExpenses("supplier_total_cost", e.target.value)} className="w-full app-input rounded-lg p-1.5 font-mono font-bold" />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg border border-teal-500/20 bg-teal-500/5 space-y-2">
                    <span className="font-bold text-[10px] uppercase text-teal-500 block">Client Price (Price Sold)</span>
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Client Daily Rate</label>
                      <input type="number" min="0" value={form.client_daily_rate} onChange={e => updateRatesAndExpenses("client_daily_rate", e.target.value)} className="w-full app-input rounded-lg p-1.5 font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Total Client Rent (PKR)</label>
                      <input type="number" min="0" value={form.client_total_rent} onChange={e => updateRatesAndExpenses("client_total_rent", e.target.value)} className="w-full app-input rounded-lg p-1.5 font-mono font-bold" />
                    </div>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-teal-500/10 border border-teal-500/20 flex justify-between items-center text-xs">
                  <span className="font-bold text-teal-700 dark:text-teal-400">Gross Commission Made (Client - Supplier):</span>
                  <span className="font-mono font-extrabold text-teal-700 dark:text-teal-400 text-sm">PKR {form.commission_amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Section 4: Expenses to Cut & Net Cash Profit */}
              <div className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]/40 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" /> 4. Expenses Cut & Net Cash Profit
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Driver / Chauffeur (PKR)</label>
                    <input type="number" min="0" value={form.driver_expense} onChange={e => updateRatesAndExpenses("driver_expense", e.target.value)} className="w-full app-input rounded-lg p-2 font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Fuel Expense (PKR)</label>
                    <input type="number" min="0" value={form.fuel_expense} onChange={e => updateRatesAndExpenses("fuel_expense", e.target.value)} className="w-full app-input rounded-lg p-2 font-mono" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Challans / Misc (PKR)</label>
                    <input type="number" min="0" value={form.other_expense} onChange={e => updateRatesAndExpenses("other_expense", e.target.value)} className="w-full app-input rounded-lg p-2 font-mono" />
                  </div>
                </div>

                {/* Final Net Cash Profit Callout */}
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Remaining Cash Profit After Cutting Every Expense</span>
                    <span className="text-xs text-[var(--text-muted)]">Gross Comm (PKR {form.commission_amount.toLocaleString()}) - Total Expenses (PKR {form.total_expenses.toLocaleString()})</span>
                  </div>
                  <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                    PKR {form.net_cash_profit.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Section 5: Payments & Remaining Dues */}
              <div className="p-3.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]/40 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">5. Payments Received & Balances</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)]">Client Paid Advance (PKR)</label>
                    <input type="number" min="0" value={form.client_received_amount} onChange={e => updateRatesAndExpenses("client_received_amount", e.target.value)} className="w-full app-input rounded-lg p-2 font-mono" />
                    <span className="text-[10px] text-[var(--text-muted)] block">Client Remaining: <b className="text-rose-500 font-mono">PKR {form.client_remaining_balance.toLocaleString()}</b></span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)]">Paid to Supplier (PKR)</label>
                    <input type="number" min="0" value={form.supplier_paid_amount} onChange={e => updateRatesAndExpenses("supplier_paid_amount", e.target.value)} className="w-full app-input rounded-lg p-2 font-mono" />
                    <span className="text-[10px] text-[var(--text-muted)] block">Supplier Payable: <b className="text-amber-500 font-mono">PKR {form.supplier_remaining_payable.toLocaleString()}</b></span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Deal Status</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full app-input rounded-lg p-2.5">
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Pending Payment">Pending Payment</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Deal Notes / Terms</label>
                  <input type="text" placeholder="e.g. Returned with full tank, commission cleared" value={form.notes || ""} onChange={e => setForm({...form, notes: e.target.value})} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>

              <button type="submit" className="w-full btn-accent text-white font-bold py-3 rounded-xl text-sm">
                {editingDeal ? "Update Sublet Deal" : "Save Sourced Sublet Deal"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
