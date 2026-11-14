import React, { useState, useEffect } from "react";
import { 
  X, Calendar, Clock, MapPin, Fuel, Car, Users, DollarSign, 
  CheckCircle, AlertTriangle, Send, Printer, ShieldAlert, Sparkles, Navigation, FileText, Check
} from "lucide-react";

export default function QuickEventBookingModal({ 
  isOpen, 
  onClose, 
  cars = [], 
  checkCnicBlacklist, 
  onBookingCreated,
  branding = {}
}) {
  const [formData, setFormData] = useState({
    client_name: "",
    phone: "",
    cnic: "",
    event_date: new Date().toISOString().split("T")[0],
    start_time: "09:00",
    end_date: new Date().toISOString().split("T")[0],
    end_time: "21:00",
    event_timing: "Full Day (9:00 AM - 9:00 PM)",
    pickup_location: "",
    destination: "",
    road_plan: "",
    cars_qty: 1,
    selected_car_ids: [],
    car_models_note: "",
    fuel_package: "Without Fuel", // "With Fuel" or "Without Fuel"
    is_chauffeur_driven: true,
    total_rent: "",
    advance_paid: "",
    payment_method: "Cash",
    security_deposit_amount: "",
    security_deposit_type: "Cash"
  });

  const [blacklistAlert, setBlacklistAlert] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successBooking, setSuccessBooking] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setBlacklistAlert("");
      setError("");
      setSuccessBooking(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Real-time CNIC blacklist check
  const handleCnicChange = async (val) => {
    setFormData(prev => ({ ...prev, cnic: val }));
    const clean = val.replace(/[^0-9]/g, "");
    if (clean.length === 13 && checkCnicBlacklist) {
      const reason = await checkCnicBlacklist(val, setBlacklistAlert);
      if (reason) setBlacklistAlert(reason);
    } else {
      setBlacklistAlert("");
    }
  };

  // Auto calculate balance due
  const totalRentNum = parseFloat(formData.total_rent) || 0;
  const advanceNum = parseFloat(formData.advance_paid) || 0;
  const remainingBalance = Math.max(0, totalRentNum - advanceNum);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.client_name.trim() || !formData.phone.trim() || !formData.cnic.trim()) {
      setError("Please fill in Client Name, Phone Number, and CNIC ID.");
      return;
    }
    if (totalRentNum <= 0) {
      setError("Please enter the total rent decided.");
      return;
    }
    if (blacklistAlert) {
      setError("Cannot book for a blacklisted customer: " + blacklistAlert);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const startDateTimeStr = `${formData.event_date}T${formData.start_time}:00`;
      const endDateTimeStr = `${formData.end_date}T${formData.end_time}:00`;

      const payload = {
        client_name: formData.client_name.trim(),
        phone: formData.phone.trim(),
        cnic: formData.cnic.trim(),
        event_date: formData.event_date,
        start_datetime: startDateTimeStr,
        expected_end_datetime: endDateTimeStr,
        event_timing: formData.event_timing.trim() || `${formData.start_time} to ${formData.end_time}`,
        pickup_location: formData.pickup_location.trim(),
        destination: formData.destination.trim(),
        road_plan: formData.road_plan.trim(),
        cars_qty: parseInt(formData.cars_qty) || 1,
        car_ids: formData.selected_car_ids.length > 0 ? formData.selected_car_ids : undefined,
        car_models_note: formData.car_models_note.trim(),
        fuel_package: formData.fuel_package,
        is_chauffeur_driven: formData.is_chauffeur_driven,
        total_rent: totalRentNum,
        advance_paid: advanceNum,
        payment_method: formData.payment_method,
        security_deposit_amount: parseFloat(formData.security_deposit_amount) || 0.0,
        security_deposit_type: formData.security_deposit_type
      };

      const res = await fetch("/api/bookings/quick-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessBooking(data.booking);
        if (onBookingCreated) onBookingCreated();
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || "Failed to create event booking.");
      }
    } catch {
      setError("Network communication error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sendWhatsAppConfirmation = () => {
    if (!successBooking) return;
    const cleanPhone = (successBooking.customer_phone || "").replace(/[^0-9]/g, "");
    const intlPhone = cleanPhone.startsWith("0") ? "92" + cleanPhone.substring(1) : cleanPhone;
    
    const agencyName = branding?.name || "Rent A Car";
    const msg = `*${agencyName} - Booking Confirmation* 🚗✨\n\n` +
      `Dear *${successBooking.customer_name}*,\n` +
      `Your event booking has been confirmed!\n\n` +
      `📍 *Pickup:* ${successBooking.pickup_location || "As arranged"}\n` +
      `🏁 *Destination:* ${successBooking.destination || "As arranged"}\n` +
      `📅 *Date & Timing:* ${successBooking.event_timing}\n` +
      `🛣️ *Road Plan:* ${successBooking.road_plan || "Standard route"}\n` +
      `🚘 *Cars Qty:* ${successBooking.cars_qty} Vehicle(s)\n` +
      `⛽ *Fuel Package:* ${successBooking.fuel_package}\n\n` +
      `💰 *Total Rent Decided:* PKR ${successBooking.total_rent?.toLocaleString()}\n` +
      `✅ *Advance Received:* PKR ${successBooking.advance_paid?.toLocaleString()}\n` +
      `🔴 *Remaining Balance Due:* PKR ${successBooking.balance_due?.toLocaleString()}\n\n` +
      `Thank you for choosing ${agencyName}! For queries, contact us.`;

    const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="glass-panel w-full max-w-3xl rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl overflow-hidden my-auto animate-scale-up text-left">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-app)]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                Quick Event & Booking Form
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  Fast-Track
                </span>
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Instant booking for wedding events, tours, delegations, & multi-car rentals
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--tr-hover)] flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        {successBooking ? (
          /* SUCCESS SCREEN */
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--text-main)]">Booking Successfully Confirmed!</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Booking #{successBooking.id} has been registered and advance payment recorded in the ledger.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] text-left max-w-md mx-auto space-y-3 text-xs">
              <div className="flex justify-between pb-2 border-b border-[var(--border-color)] font-semibold">
                <span className="text-[var(--text-muted)]">Client:</span>
                <span className="text-[var(--text-main)]">{successBooking.customer_name} ({successBooking.customer_phone})</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-[var(--text-muted)]">Destination:</span>
                <span className="text-[var(--text-main)]">{successBooking.destination || "Local"}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-[var(--text-muted)]">Fuel Package:</span>
                <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-400 font-bold">{successBooking.fuel_package}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-[var(--border-color)] font-bold">
                <span>Total Rent:</span>
                <span className="font-mono">PKR {successBooking.total_rent?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-emerald-500">
                <span>Advance Paid:</span>
                <span className="font-mono">PKR {successBooking.advance_paid?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-rose-500">
                <span>Remaining Balance:</span>
                <span className="font-mono">PKR {successBooking.balance_due?.toLocaleString()}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={sendWhatsAppConfirmation}
                className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all"
              >
                <Send className="h-4 w-4" /> Share on WhatsApp
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="py-2.5 px-4 rounded-xl border border-[var(--border-color)] hover:bg-[var(--tr-hover)] text-xs font-bold text-[var(--text-main)] flex items-center gap-2 transition-all"
              >
                <Printer className="h-4 w-4" /> Print Slip
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl bg-[var(--accent-color)] text-white text-xs font-bold shadow-md hover:opacity-90 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* BOOKING FORM */
          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {blacklistAlert && (
              <div className="p-3.5 rounded-xl bg-rose-600/15 border border-rose-500/40 text-rose-400 text-xs flex items-start gap-2.5 animate-pulse">
                <ShieldAlert className="h-5 w-5 shrink-0 text-rose-500" />
                <div>
                  <div className="font-bold text-rose-300">WARNING: Customer is Blacklisted!</div>
                  <div className="text-[11px] mt-0.5">{blacklistAlert}</div>
                </div>
              </div>
            )}

            {/* Section 1: Client Information */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-teal-400" /> 1. Client Information
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Client Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ch. Faisal Nadeem"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Phone / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="0300-1234567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">CNIC / ID Card *</label>
                  <input
                    type="text"
                    required
                    placeholder="35202-xxxxxxx-x"
                    value={formData.cnic}
                    onChange={(e) => handleCnicChange(e.target.value)}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Event, Locations & Road Plan */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-400" /> 2. Event, Destination & Road Plan
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Event Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value, end_date: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Pickup Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. DHA Phase 5 / Agency Hub"
                    value={formData.pickup_location}
                    onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Destination / Venue *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Royal Palm / PC Bhurban"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Event Timing & Hours</label>
                  <input
                    type="text"
                    placeholder="e.g. 10:00 AM Departure, 11:00 PM Return (Baraat)"
                    value={formData.event_timing}
                    onChange={(e) => setFormData({ ...formData, event_timing: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    {["Full Day (12h)", "Baraat Event", "Out-Station Tour"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setFormData({ ...formData, event_timing: tag })}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--tr-hover)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-teal-400"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Road Plan / Route Stops</label>
                  <input
                    type="text"
                    placeholder="e.g. Ring Road -> Motorway M2 -> Murree Express"
                    value={formData.road_plan}
                    onChange={(e) => setFormData({ ...formData, road_plan: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Fleet, Cars Qty & Fuel Choice */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Car className="h-3.5 w-3.5 text-emerald-400" /> 3. Fleet Selection & Fuel Package
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Quantity of Cars</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.cars_qty}
                      onChange={(e) => setFormData({ ...formData, cars_qty: e.target.value })}
                      className="w-full app-input rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                    />
                    <div className="flex gap-1 shrink-0">
                      {[1, 2, 3, 5].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setFormData({ ...formData, cars_qty: q })}
                          className={`px-2 py-1 rounded-lg border text-xs font-bold ${
                            parseInt(formData.cars_qty) === q 
                              ? "bg-teal-500 text-white border-teal-500" 
                              : "border-[var(--border-color)] text-[var(--text-muted)]"
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Fuel Package Toggle */}
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Fuel Arrangement *</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)]">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, fuel_package: "With Fuel" })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                        formData.fuel_package === "With Fuel"
                          ? "bg-emerald-500 text-white shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      }`}
                    >
                      <Fuel className="h-3 w-3" /> With Fuel
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, fuel_package: "Without Fuel" })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                        formData.fuel_package === "Without Fuel"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      }`}
                    >
                      Without Fuel
                    </button>
                  </div>
                </div>

                {/* Chauffeur Toggle */}
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Chauffeur / Driver</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)]">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_chauffeur_driven: true })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                        formData.is_chauffeur_driven
                          ? "bg-teal-500 text-white shadow-sm"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      With Driver
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, is_chauffeur_driven: false })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                        !formData.is_chauffeur_driven
                          ? "bg-teal-500 text-white shadow-sm"
                          : "text-[var(--text-muted)]"
                      }`}
                    >
                      Self Drive
                    </button>
                  </div>
                </div>
              </div>

              {/* Specific Models / Available Fleet selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Select Fleet Car(s)</label>
                  <select
                    multiple
                    value={formData.selected_car_ids.map(String)}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, opt => parseInt(opt.value));
                      setFormData({ 
                        ...formData, 
                        selected_car_ids: selected,
                        cars_qty: selected.length || formData.cars_qty
                      });
                    }}
                    className="w-full app-input rounded-xl p-2 text-xs focus:outline-none min-h-[72px]"
                  >
                    {cars.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.make_model} ({c.plate_number}) - {c.status}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-[var(--text-muted)] mt-1 block">Hold Ctrl (Windows) or Cmd (Mac) to select multiple cars.</span>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Custom Car Notes / Model Specifics</label>
                  <textarea
                    rows="3"
                    placeholder="e.g. 1x Black Prado for Groom, 2x White Yaris for Family"
                    value={formData.car_models_note}
                    onChange={(e) => setFormData({ ...formData, car_models_note: e.target.value })}
                    className="w-full app-input rounded-xl p-2.5 text-xs focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Rent Decided, Advance Paid & Balance Due */}
            <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-app)] space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-teal-400">
                  <DollarSign className="h-4 w-4" /> 4. Rent Agreement & Financial Settlement
                </span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">Live Auto-Calculated</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Total Rent Decided (PKR) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 50000"
                    value={formData.total_rent}
                    onChange={(e) => setFormData({ ...formData, total_rent: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2.5 text-sm font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-main)]">Advance Amount Given (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 20000"
                    value={formData.advance_paid}
                    onChange={(e) => setFormData({ ...formData, advance_paid: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-emerald-400 focus:outline-none"
                  />
                </div>

                {/* Remaining Balance Display */}
                <div className="p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Remaining Balance Due</span>
                  <div className="text-lg font-mono font-extrabold text-rose-500 mt-0.5">
                    PKR {remainingBalance.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-muted)]">Advance Payment Mode</label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="EasyPaisa / JazzCash">EasyPaisa / JazzCash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-muted)]">Security Deposit (Refundable)</label>
                  <input
                    type="number"
                    placeholder="PKR 0"
                    value={formData.security_deposit_amount}
                    onChange={(e) => setFormData({ ...formData, security_deposit_amount: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-[var(--text-muted)]">Deposit Type</label>
                  <select
                    value={formData.security_deposit_type}
                    onChange={(e) => setFormData({ ...formData, security_deposit_type: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Original ID / Passport">Original ID / Passport</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Token">Token Item</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--tr-hover)] text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="py-2.5 px-6 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <span>Registering Booking...</span>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Confirm & Book Event</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
