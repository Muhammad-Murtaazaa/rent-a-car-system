import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { Receipt, Plus, Search, Trash2, X, Download, Send, Printer } from "lucide-react";

export default function ReceiptsView({ receipts = [], bookings = [], branding, fetchData }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const emptyForm = {
    receipt_type: "Booking Payment",
    booking_id: "",
    customer_name: "",
    customer_phone: "",
    vehicle_info: "",
    amount: "",
    payment_method: "Cash",
    reference_no: "",
    receipt_date: today,
    notes: ""
  };
  const [form, setForm] = useState(emptyForm);

  const handleBookingPick = (bookingId) => {
    const b = bookings.find(item => String(item.id) === String(bookingId));
    if (!b) {
      setForm(prev => ({ ...prev, booking_id: "" }));
      return;
    }
    const vehicles = b.booked_cars?.length > 0
      ? b.booked_cars.map(bc => `${bc.car?.make_model || ""} (${bc.car?.plate_number || ""})`).join(", ")
      : b.car ? `${b.car.make_model} (${b.car.plate_number})` : "";
    setForm(prev => ({
      ...prev,
      booking_id: bookingId,
      customer_name: b.customer?.full_name || "",
      customer_phone: b.customer?.phone_primary || "",
      vehicle_info: vehicles,
      amount: prev.receipt_type === "Security Deposit" ? String(b.security_deposit_amount || "") : prev.amount
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        booking_id: form.booking_id ? parseInt(form.booking_id, 10) : null,
        amount: parseFloat(form.amount)
      })
    });
    if (res.ok) {
      const created = await res.json();
      setShowModal(false);
      setForm(emptyForm);
      setPreviewReceipt(created);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.detail || "Failed to generate receipt.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this receipt?")) return;
    const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const downloadReceiptPDF = (r) => {
    const doc = new jsPDF({ format: "a5", orientation: "portrait" });
    const brand = (branding?.name || "Rent A Car Management System").toUpperCase();
    const phone = branding?.branding_settings?.support_phone || "";

    doc.setFillColor(13, 148, 136);
    doc.rect(0, 0, 148, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(brand, 10, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`OFFICIAL ${r.receipt_type.toUpperCase()} RECEIPT`, 10, 21);
    doc.text(`#${r.receipt_number || r.id}`, 115, 13);

    doc.setTextColor(39, 39, 42);
    doc.setFontSize(9);
    let y = 42;
    const row = (label, val) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 10, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(val || "N/A"), 55, y);
      y += 8;
    };

    row("Receipt No:", r.receipt_number || `RCP-${r.id}`);
    row("Date:", r.receipt_date);
    row("Received From:", r.customer_name);
    if (r.customer_phone) row("Phone:", r.customer_phone);
    if (r.vehicle_info) row("Vehicle:", r.vehicle_info);
    if (r.booking_id) row("Booking Ref:", `#RMS-${r.booking_id}`);
    row("Payment Method:", r.payment_method);
    if (r.reference_no) row("Cheque / Ref #:", r.reference_no);
    if (r.notes) row("Notes:", r.notes);

    y += 4;
    doc.setFillColor(240, 253, 250);
    doc.rect(10, y, 128, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(13, 148, 136);
    doc.text("AMOUNT RECEIVED:", 14, y + 10);
    doc.text(`PKR ${Number(r.amount).toLocaleString()}`, 88, y + 10);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.line(10, 175, 55, 175);
    doc.text("Authorized Signature", 12, 180);
    doc.line(90, 175, 138, 175);
    doc.text("Customer Signature", 95, 180);
    doc.text(`${brand} ${phone ? `| ${phone}` : ""}`, 10, 195);

    doc.save(`Receipt_${r.receipt_number || r.id}.pdf`);
  };

  const sendWhatsApp = (r) => {
    const clean = (r.customer_phone || "").replace(/[^0-9]/g, "");
    if (!clean) return alert("No customer phone number on receipt.");
    const num = clean.startsWith("0") ? "92" + clean.substring(1) : clean;
    const brand = branding?.name || "Rent A Car Management System";
    const text =
      `*OFFICIAL PAYMENT RECEIPT #${r.receipt_number || r.id}*\n` +
      `${brand}\n` +
      `Type: ${r.receipt_type}\n` +
      `Customer: ${r.customer_name}\n` +
      (r.vehicle_info ? `Vehicle: ${r.vehicle_info}\n` : "") +
      `*Amount Received: PKR ${Number(r.amount).toLocaleString()}*\n` +
      `Method: ${r.payment_method}${r.reference_no ? ` (${r.reference_no})` : ""}\n` +
      `Date: ${r.receipt_date}\n` +
      `Thank you for your business!`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const printReceipt = () => {
    const el = document.getElementById("receipt-print-sheet");
    if (!el) return;
    const win = window.open("", "_blank", "width=420,height=650");
    win.document.write(`<html><head><title>Receipt</title><style>body{font-family:monospace;padding:20px;color:#111} .row{display:flex;justify-content:space-between;margin:6px 0;font-size:12px} h2,p{text-align:center;margin:4px 0}</style></head><body>${el.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const filtered = receipts.filter(r => {
    const mSearch =
      r.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
      (r.vehicle_info || "").toLowerCase().includes(search.toLowerCase());
    const mType = typeFilter === "All" || r.receipt_type === typeFilter;
    return mSearch && mType;
  });

  const totalCollected = filtered.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Receipt Generation Center</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Generate, print, download PDF, and WhatsApp official payment & deposit receipts.</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setShowModal(true); }}
          className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 min-h-[44px]"
        >
          <Plus className="h-4 w-4" /> Generate New Receipt
        </button>
      </div>

      {/* Filters & Summary */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search receipts by receipt #, customer or vehicle..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full app-input rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="app-input rounded-xl px-4 py-3 text-sm focus:outline-none"
        >
          <option value="All">All Receipt Types</option>
          <option value="Booking Payment">Booking Payment</option>
          <option value="Security Deposit">Security Deposit</option>
          <option value="Deposit Refund">Deposit Refund</option>
          <option value="Other Income">Other Income</option>
        </select>
        <div className="glass-panel px-4 py-2.5 rounded-xl border border-[var(--border-color)] text-right">
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Filtered Total</span>
          <span className="text-sm font-extrabold text-teal-500">PKR {totalCollected.toLocaleString()}</span>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[var(--tr-hover)] text-[var(--text-muted)] border-b border-[var(--border-color)] uppercase font-semibold">
                <th className="p-4">Receipt #</th>
                <th className="p-4">Type & Date</th>
                <th className="p-4">Customer & Vehicle</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Method & Ref</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-[var(--text-muted)] italic">
                    No receipts generated yet. Click "Generate New Receipt" to issue one.
                  </td>
                </tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-[var(--tr-hover)]/30">
                  <td className="p-4 font-mono font-bold text-[var(--accent-color)]">{r.receipt_number || `RCP-${r.id}`}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-500 font-bold text-[10px] uppercase">{r.receipt_type}</span>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1">{r.receipt_date}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-sm text-[var(--text-main)]">{r.customer_name}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{r.vehicle_info || (r.booking_id ? `Booking #RMS-${r.booking_id}` : "General Receipt")}</div>
                  </td>
                  <td className="p-4 font-extrabold text-sm text-emerald-500">PKR {Number(r.amount).toLocaleString()}</td>
                  <td className="p-4">
                    <div className="font-semibold">{r.payment_method}</div>
                    {r.reference_no && <div className="text-[10px] font-mono text-[var(--text-muted)]">Ref: {r.reference_no}</div>}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => setPreviewReceipt(r)}
                        className="py-1.5 px-2.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-teal-500 font-bold text-[11px] flex items-center gap-1"
                      >
                        <Printer className="h-3 w-3" /> Print
                      </button>
                      <button
                        onClick={() => downloadReceiptPDF(r)}
                        className="py-1.5 px-2.5 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/20 hover:bg-teal-500/20 font-bold text-[11px] flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" /> PDF
                      </button>
                      <button
                        onClick={() => sendWhatsApp(r)}
                        className="py-1.5 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 font-bold text-[11px] flex items-center gap-1"
                      >
                        <Send className="h-3 w-3" /> WhatsApp
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
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

      {/* Create Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold">Generate Official Receipt</h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Receipt Type *</label>
                  <select value={form.receipt_type} onChange={e => setForm({ ...form, receipt_type: e.target.value })} className="w-full app-input rounded-lg p-2.5">
                    <option value="Booking Payment">Booking Payment</option>
                    <option value="Security Deposit">Security Deposit</option>
                    <option value="Deposit Refund">Deposit Refund</option>
                    <option value="Other Income">Other Income</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Link Booking (Optional)</label>
                  <select value={form.booking_id} onChange={e => handleBookingPick(e.target.value)} className="w-full app-input rounded-lg p-2.5">
                    <option value="">-- Standalone Receipt --</option>
                    {bookings.map(b => (
                      <option key={b.id} value={b.id}>#RMS-{b.id} · {b.customer?.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Customer Name *</label>
                  <input type="text" required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Customer Phone</label>
                  <input type="text" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Vehicle Details</label>
                <input type="text" value={form.vehicle_info} onChange={e => setForm({ ...form, vehicle_info: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="e.g. Honda Civic (LEF-24-8891)" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Amount (PKR) *</label>
                  <input type="number" required min="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Payment Method</label>
                  <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="w-full app-input rounded-lg p-2.5">
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="EasyPaisa/JazzCash">EasyPaisa / JazzCash</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Date *</label>
                  <input type="date" required value={form.receipt_date} onChange={e => setForm({ ...form, receipt_date: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Cheque No / Transaction Reference</label>
                <input type="text" value={form.reference_no} onChange={e => setForm({ ...form, reference_no: e.target.value })} className="w-full app-input rounded-lg p-2.5" placeholder="e.g. CHQ-88412 or IBFT Ref" />
              </div>
              <div>
                <label className="block font-semibold text-[var(--text-muted)] mb-1">Notes</label>
                <input type="text" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full app-input rounded-lg p-2.5" />
              </div>
              <button type="submit" className="w-full btn-accent text-white font-semibold py-3 rounded-xl">
                Issue Official Receipt
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Printable Preview Modal */}
      {previewReceipt && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 border border-[var(--border-color)]">
            <div className="flex justify-between items-center pb-2 border-b border-[var(--border-color)]">
              <h3 className="text-base font-bold">Receipt Preview</h3>
              <button onClick={() => setPreviewReceipt(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div id="receipt-print-sheet" className="bg-slate-950 text-slate-200 p-5 rounded-xl border border-slate-800 font-mono text-xs space-y-3">
              <div className="text-center border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-white">{(branding?.name || "Rent A Car Management System").toUpperCase()}</h2>
                <p className="text-[10px] text-teal-400 font-bold uppercase mt-1">{previewReceipt.receipt_type} RECEIPT</p>
              </div>
              <div className="space-y-1.5">
                <div className="row flex justify-between"><span className="text-slate-400">Receipt #:</span><span className="font-bold text-white">{previewReceipt.receipt_number}</span></div>
                <div className="row flex justify-between"><span className="text-slate-400">Date:</span><span>{previewReceipt.receipt_date}</span></div>
                <div className="row flex justify-between"><span className="text-slate-400">Customer:</span><span className="font-bold">{previewReceipt.customer_name}</span></div>
                {previewReceipt.vehicle_info && <div className="row flex justify-between"><span className="text-slate-400">Vehicle:</span><span>{previewReceipt.vehicle_info}</span></div>}
                <div className="row flex justify-between"><span className="text-slate-400">Method:</span><span>{previewReceipt.payment_method}</span></div>
                {previewReceipt.reference_no && <div className="row flex justify-between"><span className="text-slate-400">Ref/Cheque:</span><span>{previewReceipt.reference_no}</span></div>}
              </div>
              <div className="border-t border-slate-800 pt-3 flex justify-between text-sm font-bold text-teal-400">
                <span>AMOUNT RECEIVED:</span>
                <span>PKR {Number(previewReceipt.amount).toLocaleString()}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button onClick={printReceipt} className="py-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)] font-bold flex items-center justify-center gap-1">
                <Printer className="h-3.5 w-3.5" /> Print
              </button>
              <button onClick={() => downloadReceiptPDF(previewReceipt)} className="py-2.5 rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20 font-bold flex items-center justify-center gap-1">
                <Download className="h-3.5 w-3.5" /> PDF
              </button>
              <button onClick={() => sendWhatsApp(previewReceipt)} className="py-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-bold flex items-center justify-center gap-1">
                <Send className="h-3.5 w-3.5" /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
