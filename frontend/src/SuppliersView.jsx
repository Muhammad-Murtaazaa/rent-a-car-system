import React, { useState, useEffect } from "react";
import { 
  Building2, Plus, Search, Trash2, Edit2, X, Send, 
  DollarSign, TrendingUp, Car, Phone, Calendar, ArrowRightLeft,
  CheckCircle, Clock, AlertCircle, FileSpreadsheet, User, Shield, 
  Sparkles, Fuel, MapPin, Briefcase, Navigation, Check, ChevronRight
} from "lucide-react";

export default function SuppliersView({ supplierDeals = [], fetchData, branding = {} }) {
  const [activeSubTab, setActiveSubTab] = useState("partners"); // "partners" | "drivers" | "deals"
  const [search, setSearch] = useState("");

  // --- Partner Agencies State ---
  const [partnerAgencies, setPartnerAgencies] = useState([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [partnerForm, setPartnerForm] = useState({
    agency_name: "",
    contact_person: "",
    phone: "",
    whatsapp: "",
    city: "Lahore",
    address: "",
    commission_terms: "",
    notes: "",
    cars_list: [{ model: "", count: 1, daily_rate: "" }]
  });

  // --- Drivers State ---
  const [drivers, setDrivers] = useState([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [driverForm, setDriverForm] = useState({
    name: "",
    phone: "",
    cnic: "",
    license_number: "",
    license_expiry: "",
    daily_wage: "",
    status: "Available",
    driver_type: "Freelance",
    agency_affiliation: "",
    experience_years: 3,
    specialties: "City & Motorway",
    notes: ""
  });

  // --- Sublet Deals State (Existing) ---
  const [deals, setDeals] = useState(supplierDeals);
  const [dealStatusFilter, setDealStatusFilter] = useState("All");
  const [showDealModal, setShowDealModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);

  const emptyDealForm = {
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
  const [dealForm, setDealForm] = useState(emptyDealForm);

  // Load Partner Agencies & Drivers from Backend
  const loadPartnerAgencies = async () => {
    setLoadingPartners(true);
    try {
      const res = await fetch("/api/partner-agencies");
      if (res.ok) {
        const data = await res.json();
        setPartnerAgencies(data);
      }
    } catch (e) {
      console.error("Failed to load partner agencies", e);
    } finally {
      setLoadingPartners(false);
    }
  };

  const loadDrivers = async () => {
    setLoadingDrivers(true);
    try {
      const res = await fetch("/api/drivers");
      if (res.ok) {
        const data = await res.json();
        setDrivers(data);
      }
    } catch (e) {
      console.error("Failed to load drivers", e);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const loadDeals = async () => {
    try {
      const res = await fetch("/api/supplier-deals");
      if (res.ok) {
        const data = await res.json();
        setDeals(data);
      }
    } catch (e) {
      console.error("Failed to load deals", e);
    }
  };

  useEffect(() => {
    loadPartnerAgencies();
    loadDrivers();
    loadDeals();
  }, []);

  // --- Partner Agency Handlers ---
  const openAddPartner = () => {
    setEditingPartner(null);
    setPartnerForm({
      agency_name: "",
      contact_person: "",
      phone: "",
      whatsapp: "",
      city: "Lahore",
      address: "",
      commission_terms: "15% or PKR 1,000/day",
      notes: "",
      cars_list: [{ model: "Toyota Fortuner", count: 2, daily_rate: 18000 }]
    });
    setShowPartnerModal(true);
  };

  const openEditPartner = (p) => {
    setEditingPartner(p);
    let parsedCars = [{ model: "", count: 1, daily_rate: "" }];
    try {
      parsedCars = JSON.parse(p.available_cars_json || "[]");
      if (!parsedCars.length) parsedCars = [{ model: "", count: 1, daily_rate: "" }];
    } catch {}
    setPartnerForm({
      agency_name: p.agency_name || "",
      contact_person: p.contact_person || "",
      phone: p.phone || "",
      whatsapp: p.whatsapp || p.phone || "",
      city: p.city || "Lahore",
      address: p.address || "",
      commission_terms: p.commission_terms || "",
      notes: p.notes || "",
      cars_list: parsedCars
    });
    setShowPartnerModal(true);
  };

  const addCarRowToPartner = () => {
    setPartnerForm(prev => ({
      ...prev,
      cars_list: [...prev.cars_list, { model: "", count: 1, daily_rate: "" }]
    }));
  };

  const removeCarRowFromPartner = (index) => {
    setPartnerForm(prev => ({
      ...prev,
      cars_list: prev.cars_list.filter((_, i) => i !== index)
    }));
  };

  const handlePartnerSubmit = async (e) => {
    e.preventDefault();
    const validCars = partnerForm.cars_list.filter(c => c.model.trim());
    const totalCount = validCars.reduce((acc, curr) => acc + (parseInt(curr.count) || 1), 0);

    const payload = {
      agency_name: partnerForm.agency_name.trim(),
      contact_person: partnerForm.contact_person.trim(),
      phone: partnerForm.phone.trim(),
      whatsapp: partnerForm.whatsapp.trim() || partnerForm.phone.trim(),
      city: partnerForm.city.trim(),
      address: partnerForm.address.trim(),
      total_cars_count: totalCount,
      available_cars_json: JSON.stringify(validCars),
      commission_terms: partnerForm.commission_terms.trim(),
      notes: partnerForm.notes.trim()
    };

    try {
      const url = editingPartner ? `/api/partner-agencies/${editingPartner.id}` : "/api/partner-agencies";
      const method = editingPartner ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowPartnerModal(false);
        loadPartnerAgencies();
      }
    } catch (e) {
      alert("Failed to save partner agency.");
    }
  };

  const handleDeletePartner = async (id) => {
    if (!window.confirm("Are you sure you want to delete this partner agency?")) return;
    try {
      const res = await fetch(`/api/partner-agencies/${id}`, { method: "DELETE" });
      if (res.ok) loadPartnerAgencies();
    } catch (e) {
      alert("Failed to delete partner agency.");
    }
  };

  // --- Driver Handlers ---
  const openAddDriver = () => {
    setEditingDriver(null);
    setDriverForm({
      name: "",
      phone: "",
      cnic: "",
      license_number: "",
      license_expiry: "",
      daily_wage: 2000,
      status: "Available",
      driver_type: "Freelance",
      agency_affiliation: "",
      experience_years: 5,
      specialties: "City & Motorway",
      notes: ""
    });
    setShowDriverModal(true);
  };

  const openEditDriver = (d) => {
    setEditingDriver(d);
    setDriverForm({
      name: d.name || "",
      phone: d.phone || "",
      cnic: d.cnic || "",
      license_number: d.license_number || "",
      license_expiry: d.license_expiry || "",
      daily_wage: d.daily_wage || 0,
      status: d.status || "Available",
      driver_type: d.driver_type || "Freelance",
      agency_affiliation: d.agency_affiliation || "",
      experience_years: d.experience_years || 0,
      specialties: d.specialties || "",
      notes: d.notes || ""
    });
    setShowDriverModal(true);
  };

  const handleDriverSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: driverForm.name.trim(),
      phone: driverForm.phone.trim(),
      cnic: driverForm.cnic.trim(),
      license_number: driverForm.license_number.trim(),
      license_expiry: driverForm.license_expiry.trim(),
      daily_wage: parseFloat(driverForm.daily_wage) || 0.0,
      status: driverForm.status,
      driver_type: driverForm.driver_type,
      agency_affiliation: driverForm.agency_affiliation.trim(),
      experience_years: parseInt(driverForm.experience_years) || 0,
      specialties: driverForm.specialties.trim(),
      notes: driverForm.notes.trim()
    };

    try {
      const url = editingDriver ? `/api/drivers/${editingDriver.id}` : "/api/drivers";
      const method = editingDriver ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowDriverModal(false);
        loadDrivers();
      }
    } catch (e) {
      alert("Failed to save driver.");
    }
  };

  const handleDeleteDriver = async (id) => {
    if (!window.confirm("Are you sure you want to delete this driver?")) return;
    try {
      const res = await fetch(`/api/drivers/${id}`, { method: "DELETE" });
      if (res.ok) loadDrivers();
    } catch (e) {
      alert("Failed to delete driver.");
    }
  };

  // --- Calculations for Partner Fleet ---
  const totalPartnerAgencies = partnerAgencies.length;
  const totalNetworkCars = partnerAgencies.reduce((acc, curr) => acc + (curr.total_cars_count || 0), 0);
  const totalDrivers = drivers.length;
  const availableDrivers = drivers.filter(d => d.status === "Available").length;

  // Search filtering
  const filteredPartners = partnerAgencies.filter(p => {
    const q = search.toLowerCase();
    const matchesAgency = p.agency_name.toLowerCase().includes(q) ||
      (p.contact_person && p.contact_person.toLowerCase().includes(q)) ||
      (p.city && p.city.toLowerCase().includes(q)) ||
      p.phone.includes(q);
    const matchesCars = (p.available_cars_json || "").toLowerCase().includes(q);
    return matchesAgency || matchesCars;
  });

  const filteredDrivers = drivers.filter(d => {
    const q = search.toLowerCase();
    return d.name.toLowerCase().includes(q) ||
      d.phone.includes(q) ||
      (d.specialties && d.specialties.toLowerCase().includes(q)) ||
      (d.agency_affiliation && d.agency_affiliation.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6 text-left">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-main)] flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-teal-400" />
            Partner Rent A Cars & Drivers Network
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Directory of external rental agencies, their available cars count & fleet, and chauffeur contact profiles.
          </p>
        </div>

        {/* Action Button */}
        {activeSubTab === "partners" && (
          <button
            onClick={openAddPartner}
            className="py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-xs shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all transform active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Partner Rent-A-Car</span>
          </button>
        )}
        {activeSubTab === "drivers" && (
          <button
            onClick={openAddDriver}
            className="py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-xs shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all transform active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Chauffeur / Driver</span>
          </button>
        )}
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Partner Agencies</span>
            <Building2 className="h-4 w-4 text-teal-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-[var(--text-main)] mt-2">
            {totalPartnerAgencies}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Verified external rental hubs</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>External Fleet Available</span>
            <Car className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-emerald-400 mt-2">
            {totalNetworkCars} Vehicles
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Across partner fleets</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Registered Drivers</span>
            <User className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-blue-400 mt-2">
            {totalDrivers}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">In-house & freelance</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-[var(--border-color)]">
          <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>Available Drivers</span>
            <CheckCircle className="h-4 w-4 text-teal-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-teal-300 mt-2">
            {availableDrivers} Free
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">Ready for dispatch</div>
        </div>
      </div>

      {/* Sub-Tabs Selector & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Tab pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => setActiveSubTab("partners")}
            className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "partners"
                ? "bg-teal-500 text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Other Rent A Cars ({totalPartnerAgencies})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("drivers")}
            className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "drivers"
                ? "bg-teal-500 text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <User className="h-3.5 w-3.5" />
            <span>Chauffeurs & Drivers ({totalDrivers})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("deals")}
            className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeSubTab === "deals"
                ? "bg-teal-500 text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>Sublet Deals ({deals.length})</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder={
              activeSubTab === "partners"
                ? "Search agency or car (e.g. Prado, Civic)..."
                : "Search driver name, phone, routes..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl app-input text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PARTNER RENT A CARS (AGENCIES & THEIR FLEET) */}
      {/* ======================================================== */}
      {activeSubTab === "partners" && (
        <div className="space-y-4">
          {filteredPartners.length === 0 ? (
            <div className="glass-panel p-10 rounded-2xl border border-[var(--border-color)] text-center space-y-3">
              <Building2 className="h-10 w-10 text-[var(--text-muted)] mx-auto opacity-50" />
              <div className="font-bold text-sm text-[var(--text-main)]">No Partner Agencies Found</div>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Add other rent a car agencies to keep track of their fleet size, car models, sublet rates, and contact numbers.
              </p>
              <button
                onClick={openAddPartner}
                className="btn-accent py-2 px-4 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Add First Partner Rent-A-Car
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPartners.map(p => {
                let carsList = [];
                try {
                  carsList = JSON.parse(p.available_cars_json || "[]");
                } catch {}

                const cleanPhone = (p.whatsapp || p.phone || "").replace(/[^0-9]/g, "");
                const waPhone = cleanPhone.startsWith("0") ? "92" + cleanPhone.substring(1) : cleanPhone;

                return (
                  <div 
                    key={p.id}
                    className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] hover:border-teal-500/40 transition-all flex flex-col justify-between space-y-4 shadow-sm group"
                  >
                    <div>
                      {/* Agency Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-base text-[var(--text-main)] truncate capitalize group-hover:text-teal-400 transition-colors">
                            {p.agency_name}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--text-muted)]">
                            <MapPin className="h-3 w-3 text-teal-400 shrink-0" />
                            <span className="truncate">{p.city} {p.address ? `· ${p.address}` : ""}</span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 font-mono font-bold text-xs shrink-0">
                          {p.total_cars_count || carsList.length} Cars
                        </span>
                      </div>

                      {/* Contact Info */}
                      <div className="mt-3 p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)] flex items-center justify-between text-xs">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Contact Person</div>
                          <div className="font-semibold text-[var(--text-main)] truncate">{p.contact_person || "Manager"}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${p.phone}`}
                            className="p-1.5 rounded-lg border border-[var(--border-color)] hover:bg-teal-500/10 hover:text-teal-400 transition-colors"
                            title="Call Phone"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                          <a
                            href={`https://wa.me/${waPhone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <Send className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>

                      {/* Available Fleet Models & Rates */}
                      <div className="mt-3.5 space-y-1.5">
                        <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider flex items-center justify-between">
                          <span>Fleet Breakdown ({carsList.length} Models)</span>
                          {p.commission_terms && (
                            <span className="text-teal-400 normal-case">{p.commission_terms}</span>
                          )}
                        </div>

                        {carsList.length === 0 ? (
                          <div className="text-[11px] text-[var(--text-muted)] italic">No specific car breakdown entered.</div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {carsList.map((c, idx) => (
                              <div 
                                key={idx}
                                className="px-2 py-1 rounded-lg bg-[var(--tr-hover)] border border-[var(--border-color)] text-[11px] flex items-center gap-1.5"
                              >
                                <Car className="h-3 w-3 text-teal-400" />
                                <span className="font-semibold text-[var(--text-main)]">{c.model}</span>
                                <span className="font-bold text-teal-400 font-mono">({c.count}x)</span>
                                {c.daily_rate && (
                                  <span className="text-[10px] text-[var(--text-muted)] font-mono">· PKR {parseInt(c.daily_rate).toLocaleString()}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {p.notes && (
                        <p className="mt-2 text-[11px] text-[var(--text-muted)] italic line-clamp-2">
                          "{p.notes}"
                        </p>
                      )}
                    </div>

                    {/* Bottom Actions */}
                    <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        ID #{p.id}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditPartner(p)}
                          className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-teal-400 hover:bg-teal-500/10 transition-colors"
                          title="Edit Partner Agency"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePartner(p.id)}
                          className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Delete Partner Agency"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CHAUFFEURS & DRIVERS DIRECTORY */}
      {/* ======================================================== */}
      {activeSubTab === "drivers" && (
        <div className="space-y-4">
          {filteredDrivers.length === 0 ? (
            <div className="glass-panel p-10 rounded-2xl border border-[var(--border-color)] text-center space-y-3">
              <User className="h-10 w-10 text-[var(--text-muted)] mx-auto opacity-50" />
              <div className="font-bold text-sm text-[var(--text-main)]">No Drivers Found</div>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Maintain a master list of all in-house, freelance, and partner agency chauffeurs.
              </p>
              <button
                onClick={openAddDriver}
                className="btn-accent py-2 px-4 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Add First Chauffeur / Driver
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDrivers.map(d => {
                const cleanPhone = (d.phone || "").replace(/[^0-9]/g, "");
                const waPhone = cleanPhone.startsWith("0") ? "92" + cleanPhone.substring(1) : cleanPhone;

                const statusColor = d.status === "Available" 
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : d.status === "On Duty" 
                  ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/30";

                return (
                  <div
                    key={d.id}
                    className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] hover:border-teal-500/40 transition-all flex flex-col justify-between space-y-4 shadow-sm"
                  >
                    <div>
                      {/* Driver Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 text-teal-400 font-bold flex items-center justify-center text-sm shrink-0">
                            {d.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-base text-[var(--text-main)] truncate capitalize">
                              {d.name}
                            </h3>
                            <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                              <span>{d.driver_type}</span>
                              {d.agency_affiliation && (
                                <span>· {d.agency_affiliation}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${statusColor} shrink-0`}>
                          {d.status}
                        </span>
                      </div>

                      {/* Contact & Rate Strip */}
                      <div className="mt-3.5 p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)] space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--text-muted)]">Daily Wage:</span>
                          <span className="font-mono font-bold text-teal-400">PKR {d.daily_wage?.toLocaleString()}/day</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[var(--text-muted)]">Phone / WhatsApp:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{d.phone}</span>
                            <a
                              href={`https://wa.me/${waPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:text-emerald-300"
                              title="Chat on WhatsApp"
                            >
                              <Send className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                        {d.cnic && (
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">CNIC Number:</span>
                            <span className="font-mono">{d.cnic}</span>
                          </div>
                        )}
                        {d.license_number && (
                          <div className="flex items-center justify-between">
                            <span className="text-[var(--text-muted)]">License No:</span>
                            <span className="font-mono">{d.license_number}</span>
                          </div>
                        )}
                      </div>

                      {/* Specialties & Experience */}
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] uppercase font-bold tracking-wider">
                          <span>Specialties</span>
                          <span>{d.experience_years ? `${d.experience_years} yrs exp` : ""}</span>
                        </div>
                        <div className="text-xs font-semibold text-[var(--text-main)]">
                          {d.specialties || "General Chauffeur"}
                        </div>
                      </div>

                      {d.notes && (
                        <p className="mt-2 text-[11px] text-[var(--text-muted)] italic line-clamp-2">
                          "{d.notes}"
                        </p>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        Driver #{d.id}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditDriver(d)}
                          className="p-1.5 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-teal-400 hover:bg-teal-500/10 transition-colors"
                          title="Edit Driver"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDriver(d.id)}
                          className="p-1.5 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Delete Driver"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: SUBLET DEALS (EXISTING) */}
      {/* ======================================================== */}
      {activeSubTab === "deals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-[var(--text-muted)]">
              Active sublet car assignments borrowed from third-party rental companies.
            </div>
            <button
              onClick={() => {
                setEditingDeal(null);
                setDealForm(emptyDealForm);
                setShowDealModal(true);
              }}
              className="py-2 px-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> New Sublet Deal
            </button>
          </div>

          {deals.length === 0 ? (
            <div className="glass-panel p-10 rounded-2xl border border-[var(--border-color)] text-center space-y-2">
              <ArrowRightLeft className="h-8 w-8 text-[var(--text-muted)] mx-auto opacity-40" />
              <div className="font-bold text-sm text-[var(--text-main)]">No Active Sublet Deals</div>
              <p className="text-xs text-[var(--text-muted)]">Track when you borrow cars from partners and re-rent them to your customers.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deals.map(deal => (
                <div key={deal.id} className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-main)]">{deal.car_make_model}</h4>
                      <span className="text-[11px] font-mono text-teal-400 font-bold">{deal.car_plate_number}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      {deal.status}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)] text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Partner Agency:</span>
                      <span className="font-semibold">{deal.supplier_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Customer:</span>
                      <span className="font-semibold">{deal.customer_name}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-[var(--border-color)] font-bold text-emerald-400">
                      <span>Net Profit Margin:</span>
                      <span className="font-mono">PKR {deal.net_cash_profit?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT PARTNER RENT A CAR */}
      {/* ======================================================== */}
      {showPartnerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl p-6 space-y-5 my-auto animate-scale-up text-left">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">
                  {editingPartner ? "Edit Partner Agency" : "Add Other Rent A Car"}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">Register partner rental agency & how many cars they have available</p>
              </div>
              <button onClick={() => setShowPartnerModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePartnerSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Agency Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Al-Madina Rent A Car"
                    value={partnerForm.agency_name}
                    onChange={(e) => setPartnerForm({ ...partnerForm, agency_name: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Owner / Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Haji Rafiq / Manager"
                    value={partnerForm.contact_person}
                    onChange={(e) => setPartnerForm({ ...partnerForm, contact_person: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="0300-1234567"
                    value={partnerForm.phone}
                    onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">WhatsApp</label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={partnerForm.whatsapp}
                    onChange={(e) => setPartnerForm({ ...partnerForm, whatsapp: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Lahore"
                    value={partnerForm.city}
                    onChange={(e) => setPartnerForm({ ...partnerForm, city: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Hub Address / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Main Market, Gulberg, Lahore"
                  value={partnerForm.address}
                  onChange={(e) => setPartnerForm({ ...partnerForm, address: e.target.value })}
                  className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              {/* Dynamic Fleet List: What cars do they have? */}
              <div className="p-3.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-color)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                    <Car className="h-4 w-4 text-teal-400" />
                    <span>Their Fleet & Cars Available</span>
                  </div>
                  <button
                    type="button"
                    onClick={addCarRowToPartner}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25 font-bold flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add Car Model
                  </button>
                </div>

                <div className="space-y-2">
                  {partnerForm.cars_list.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Model (e.g. Toyota Prado, Civic, Yaris)"
                        value={c.model}
                        onChange={(e) => {
                          const updated = [...partnerForm.cars_list];
                          updated[idx].model = e.target.value;
                          setPartnerForm({ ...partnerForm, cars_list: updated });
                        }}
                        className="flex-1 app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                      />
                      <div className="w-24">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty (e.g. 3)"
                          value={c.count}
                          onChange={(e) => {
                            const updated = [...partnerForm.cars_list];
                            updated[idx].count = e.target.value;
                            setPartnerForm({ ...partnerForm, cars_list: updated });
                          }}
                          className="w-full app-input rounded-xl px-2.5 py-2 text-xs font-mono text-center focus:outline-none"
                        />
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          placeholder="Rate (PKR/day)"
                          value={c.daily_rate}
                          onChange={(e) => {
                            const updated = [...partnerForm.cars_list];
                            updated[idx].daily_rate = e.target.value;
                            setPartnerForm({ ...partnerForm, cars_list: updated });
                          }}
                          className="w-full app-input rounded-xl px-2.5 py-2 text-xs font-mono focus:outline-none"
                        />
                      </div>
                      {partnerForm.cars_list.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCarRowFromPartner(idx)}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Commission Terms / Sublet Deal</label>
                  <input
                    type="text"
                    placeholder="e.g. 15% discount on daily rates"
                    value={partnerForm.commission_terms}
                    onChange={(e) => setPartnerForm({ ...partnerForm, commission_terms: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Notes / Preferences</label>
                  <input
                    type="text"
                    placeholder="e.g. Reliable for northern area 4x4 vehicles"
                    value={partnerForm.notes}
                    onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowPartnerModal(false)}
                  className="py-2 px-4 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-400 shadow-md"
                >
                  Save Partner Rent A Car
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD / EDIT CHAUFFEUR / DRIVER */}
      {/* ======================================================== */}
      {showDriverModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="glass-panel w-full max-w-xl rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl p-6 space-y-5 my-auto animate-scale-up text-left">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">
                  {editingDriver ? "Edit Chauffeur Driver" : "Register Chauffeur / Driver"}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">Maintain chauffeur profile, license, and daily wage info</p>
              </div>
              <button onClick={() => setShowDriverModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleDriverSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Driver Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Muhammad Aslam"
                    value={driverForm.name}
                    onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="0300-1234567"
                    value={driverForm.phone}
                    onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">CNIC Number</label>
                  <input
                    type="text"
                    placeholder="35202-xxxxxxx-x"
                    value={driverForm.cnic}
                    onChange={(e) => setDriverForm({ ...driverForm, cnic: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">License Number</label>
                  <input
                    type="text"
                    placeholder="LHR-12345"
                    value={driverForm.license_number}
                    onChange={(e) => setDriverForm({ ...driverForm, license_number: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Daily Wage (PKR)</label>
                  <input
                    type="number"
                    placeholder="e.g. 2000"
                    value={driverForm.daily_wage}
                    onChange={(e) => setDriverForm({ ...driverForm, daily_wage: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Driver Type</label>
                  <select
                    value={driverForm.driver_type}
                    onChange={(e) => setDriverForm({ ...driverForm, driver_type: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="Freelance">Freelance Driver</option>
                    <option value="In-House">In-House Staff</option>
                    <option value="Partner Agency">Partner Agency Driver</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Current Status</label>
                  <select
                    value={driverForm.status}
                    onChange={(e) => setDriverForm({ ...driverForm, status: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  >
                    <option value="Available">Available</option>
                    <option value="On Duty">On Duty</option>
                    <option value="Leave">On Leave</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Affiliation / Agency</label>
                  <input
                    type="text"
                    placeholder="e.g. Self or Al-Madina"
                    value={driverForm.agency_affiliation}
                    onChange={(e) => setDriverForm({ ...driverForm, agency_affiliation: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Specialties & Route Expertise</label>
                  <input
                    type="text"
                    placeholder="e.g. Northern Areas, Motorway, Wedding VIP"
                    value={driverForm.specialties}
                    onChange={(e) => setDriverForm({ ...driverForm, specialties: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. Non-smoker, fluent in Urdu & English"
                    value={driverForm.notes}
                    onChange={(e) => setDriverForm({ ...driverForm, notes: e.target.value })}
                    className="w-full app-input rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowDriverModal(false)}
                  className="py-2 px-4 rounded-xl border border-[var(--border-color)] text-[var(--text-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2 px-5 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-400 shadow-md"
                >
                  Save Chauffeur Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
