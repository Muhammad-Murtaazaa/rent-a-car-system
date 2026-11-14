import React, { useState, useEffect, useRef } from "react";
import { 
  Car, Users, Calendar, ShieldAlert, Wrench, Wallet, Plus, 
  Search, Trash2, Edit2, AlertTriangle, CheckCircle, Check, MessageSquare, FileText, Send, X, Clock, PenTool, TrendingUp, DollarSign, Sun, Moon, Briefcase, Menu, Eye, BarChart3, Download, Printer, PieChart, LineChart, UserPlus, Receipt, BadgeCheck, ClipboardList, ScrollText, Settings as SettingsIcon, Wifi, WifiOff, RefreshCw, Smartphone, Handshake, Sparkles, Lock
} from "lucide-react";
import TenantPasswordGate from "./TenantPasswordGate";
import QuickEventBookingModal from "./QuickEventBookingModal";
import CarHistoryModal from "./CarHistoryModal";
import SuperAdminDashboard from "./SuperAdminDashboard";
import EmployeesView from "./EmployeesView";
import LeadsView from "./LeadsView";
import QuotationsView from "./QuotationsView";
import ReceiptsView from "./ReceiptsView";
import InvoicesLettersView from "./InvoicesLettersView";
import SettingsView from "./SettingsView";
import SuppliersView from "./SuppliersView";
import { syncOfflineQueue, getPendingSyncCount, warmExtraUrls } from "./offlineSync";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Button, Badge, Input, GlowButton, GradientCard, ShimmerButton, AnimatedGradientText, MagicCard, BorderBeam, Progress, Separator } from "./shadcn";
import { jsPDF } from "jspdf";
import {
  sumCashIn,
  sumOutstanding,
  sumMaintenanceOut,
  sumPayoutsOut,
  operatingNet,
  netEarnings,
  monthlyCashflow,
  cashCollectedByCar,
  dailyCashSummary,
  filterFinancialsByRange,
  filterMaintenanceByRange,
  filterPayoutsByRange,
  flattenInvestorPayouts,
  flattenShareholderPayouts,
  buildCashflowLedger,
  formatMoneyDate,
  formatCompactPKR,
  chartAxisTicks,
  sumPaidForBooking,
  estimatedBookingCharge,
  investorPortfolioTotals,
  shareholderPortfolioTotals,
} from "./financeUtils";

export default function App() {
  const [theme, setTheme] = useState("dark");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDedicatedTenantHost = typeof window !== "undefined" &&
    window.location.hostname !== "racms.omnysync.com" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    !window.location.hostname.startsWith("13.140.");

  const activeTenantId = (typeof window !== "undefined" && localStorage.getItem("active_tenant_id")) || "default";
  const isTenantWorkspace = isDedicatedTenantHost || activeTenantId !== "default";

  const [tenantToken, setTenantToken] = useState(() => (typeof window !== "undefined" && localStorage.getItem("tenant_token")) || "");
  const [tenantUser, setTenantUser] = useState(() => {
    try {
      const u = typeof window !== "undefined" && localStorage.getItem("tenant_user");
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  const [userRole, setUserRole] = useState(() => {
    const isDedicatedHost = typeof window !== "undefined" &&
      window.location.hostname !== "racms.omnysync.com" &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1" &&
      !window.location.hostname.startsWith("13.140.");

    if (!isDedicatedHost && typeof window !== "undefined" && (window.location.hash === "#admin" || window.location.pathname === "/admin")) {
      return "super_admin";
    }
    try {
      const stored = localStorage.getItem("tenant_user");
      if (stored) {
        const u = JSON.parse(stored);
        if (u.role) return u.role;
      }
    } catch {}
    return "tenant_admin";
  });
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyCarId, setHistoryCarId] = useState(null);
  const [showQuickEventBookingModal, setShowQuickEventBookingModal] = useState(false);

  // Tenant Authentication & Multi-Tenant Scope State
  const [showTenantLoginModal, setShowTenantLoginModal] = useState(false);
  const [tenantLoginForm, setTenantLoginForm] = useState(() => ({
    tenant_id: (typeof window !== "undefined" && localStorage.getItem("active_tenant_id")) || "default",
    username: "",
    password: ""
  }));
  const [tenantLoginError, setTenantLoginError] = useState("");
  const [tenantLoggingIn, setTenantLoggingIn] = useState(false);

  const handleTenantLoginSubmit = async (e) => {
    e.preventDefault();
    setTenantLoggingIn(true);
    setTenantLoginError("");
    try {
      const targetTenantId = (isDedicatedTenantHost ? activeTenantId : tenantLoginForm.tenant_id).trim().toLowerCase();
      const res = await fetch("/api/auth/tenant-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: targetTenantId,
          username: tenantLoginForm.username.trim(),
          password: tenantLoginForm.password.trim()
        })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("active_tenant_id", data.tenant.id);
        localStorage.setItem("tenant_token", data.access_token);
        localStorage.setItem("tenant_user", JSON.stringify(data.user));
        setShowTenantLoginModal(false);
        window.location.reload();
      } else {
        const err = await res.json();
        setTenantLoginError(err.detail || "Invalid login credentials.");
      }
    } catch {
      setTenantLoginError("Network connection error.");
    } finally {
      setTenantLoggingIn(false);
    }
  };

  const handleTenantLogout = () => {
    localStorage.removeItem("tenant_token");
    localStorage.removeItem("tenant_user");
    setTenantToken("");
    setTenantUser(null);
    if (!isDedicatedTenantHost) {
      localStorage.setItem("active_tenant_id", "default");
    }
    window.location.reload();
  };
  
  const [branding, setBranding] = useState({
    name: "Rent A Car Management System",
    logo_url: "",
    primary_theme_color: "#0d9488",
    feature_flags: ["dashboard", "fleet", "customers", "bookings", "maintenance", "blacklist", "whatsapp_api", "advanced_analytics", "chauffeur_module"]
  });

  const [cars, setCars] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [financials, setFinancials] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [shareholders, setShareholders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [leads, setLeads] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [vehicleInvoices, setVehicleInvoices] = useState([]);
  const [officialLetters, setOfficialLetters] = useState([]);
  const [supplierDeals, setSupplierDeals] = useState([]);
  const [prefillQuote, setPrefillQuote] = useState(null);
  const [prefillCustomer, setPrefillCustomer] = useState(null);

  // PWA Online / Offline Sync & Install Prompt State
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncingNow, setSyncingNow] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [offlineReady, setOfflineReady] = useState(false);

  // Business Tool State (Profit Report Date)
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));

  // Advance Receipt Modal state
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [receiptBooking, setReceiptBooking] = useState(null);

  // Filters & Searches
  const [carSearch, setCarSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("All");

  // Modals & Active Selections
  const [showCarModal, setShowCarModal] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [bookingForm, setBookingForm] = useState({
    car_id: "", customer_id: "", start_datetime: "", expected_end_datetime: "",
    daily_rate: 3000, is_chauffeur_driven: false, chauffeur_daily_wage: 1500,
    security_deposit_amount: 10000, security_deposit_type: "Cash", security_deposit_status: "Held",
    booking_type: "Individual", company_name: "", booked_cars: [],
    driver_type: "Company Driver", driver_name: "", driver_phone: "", driver_cnic: "",
    billable_days: "", specific_days_notes: ""
  });

  // Signature states
  const signatureCanvasRef = useRef(null);
  const advanceSignatureCanvasRef = useRef(null);
  const [signatureImage, setSignatureImage] = useState("");
  const [advanceSignatureImage, setAdvanceSignatureImage] = useState("");

  // Sync theme with body class
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  // Lock page scroll when mobile drawer is open
  useEffect(() => {
    document.body.classList.toggle("menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [mobileMenuOpen]);

  // Load Tenant Branding configuration dynamically
  useEffect(() => {
    fetch("/api/tenant/branding")
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setBranding(data);
        if (data.primary_theme_color) {
          document.documentElement.style.setProperty('--accent-color', data.primary_theme_color);
          document.documentElement.style.setProperty('--accent-hover', data.primary_theme_color + "dd");
          let hex = data.primary_theme_color;
          if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
            let c = hex.substring(1).split('');
            if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            c = '0x' + c.join('');
            const rgba = `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')},0.2)`;
            document.documentElement.style.setProperty('--accent-shadow', rgba);
          }
        }
      })
      .catch(() => {});
  }, []);

  // High-speed parallel fetch (reduces VPS latency and renders immediately)
  const fetchData = async () => {
    try {
      const q = "limit=10000";
      const [
        carsRes, custRes, bookingsRes, maintRes, blRes,
        alertsRes, finRes, invRes, shRes, empRes, leadsRes, quotesRes, rcptRes, vInvRes, ltrRes, suppDealsRes
      ] = await Promise.all([
        fetch(`/api/cars?${q}`),
        fetch(`/api/customers?${q}`),
        fetch(`/api/bookings?${q}`),
        fetch(`/api/maintenance?${q}`),
        fetch(`/api/blacklist?${q}`),
        fetch("/api/alerts"),
        fetch(`/api/financials?${q}`),
        fetch(`/api/investors?${q}`),
        fetch(`/api/shareholders?${q}`),
        fetch(`/api/employees?limit=1000`),
        fetch(`/api/leads?limit=1000`),
        fetch(`/api/quotations?limit=1000`),
        fetch(`/api/receipts?limit=1000`),
        fetch(`/api/vehicle-invoices?limit=1000`),
        fetch(`/api/letters?limit=1000`),
        fetch(`/api/supplier-deals?limit=1000`),
      ]);

      if (carsRes.ok) {
        const loadedCars = await carsRes.json();
        setCars(loadedCars);
        const imgUrls = loadedCars.map(c => c.image_url).filter(Boolean);
        if (branding?.logo_url) imgUrls.push(branding.logo_url);
        warmExtraUrls(imgUrls);
      }
      if (custRes.ok) setCustomers(await custRes.json());
      if (bookingsRes.ok) setBookings(await bookingsRes.json());
      if (maintRes.ok) setMaintenance(await maintRes.json());
      if (blRes.ok) setBlacklist(await blRes.json());
      if (alertsRes.ok) setAlerts(await alertsRes.json());
      if (finRes.ok) setFinancials(await finRes.json());
      if (invRes.ok) setInvestors(await invRes.json());
      if (shRes.ok) setShareholders(await shRes.json());
      if (empRes.ok) setEmployees(await empRes.json());
      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (quotesRes.ok) setQuotations(await quotesRes.json());
      if (rcptRes.ok) setReceipts(await rcptRes.json());
      if (vInvRes.ok) setVehicleInvoices(await vInvRes.json());
      if (ltrRes.ok) setOfficialLetters(await ltrRes.json());
      if (suppDealsRes.ok) setSupplierDeals(await suppDealsRes.json());
    } catch (err) {
      console.error("Error loading API data:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Gentle 30s background sync to keep VPS CPU/RAM minimal
  useEffect(() => {
    const liveTabs = ["dashboard", "reports", "analytics", "investors", "shareholders", "bookings", "maintenance", "leads", "quotations", "receipts", "employees"];
    if (!liveTabs.includes(activeTab)) return;
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [activeTab]);

  useEffect(() => {
    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    getPendingSyncCount().then(setPendingSyncCount);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    const onQueueChange = (e) => {
      if (e?.detail?.count !== undefined) setPendingSyncCount(e.detail.count);
      else getPendingSyncCount().then(setPendingSyncCount);
    };
    const onSyncComplete = () => {
      getPendingSyncCount().then(setPendingSyncCount);
      fetchData();
    };
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("racms-offline-change", onQueueChange);
    window.addEventListener("racms-sync-complete", onSyncComplete);
    const onOfflineReady = () => setOfflineReady(true);
    window.addEventListener("racms-offline-ready", onOfflineReady);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("racms-offline-change", onQueueChange);
      window.removeEventListener("racms-sync-complete", onSyncComplete);
      window.removeEventListener("racms-offline-ready", onOfflineReady);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || syncingNow) return;
    setSyncingNow(true);
    try {
      await syncOfflineQueue();
      await fetchData();
    } finally {
      setSyncingNow(false);
      getPendingSyncCount().then(setPendingSyncCount);
    }
  };

  const handleInstallPWA = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === "accepted") {
        setInstallPrompt(null);
      }
    } else {
      alert("To install this app on your device:\n\n• On Chrome/Edge (Desktop): Click the Install icon on the right side of the URL address bar, or click Menu (⋮) → 'Install App'.\n• On Android (Chrome): Tap Menu (⋮) → 'Add to Home screen' or 'Install App'.\n• On iPhone/iPad (Safari): Tap the Share button → 'Add to Home Screen'.");
    }
  };

  // --- Blacklist validation check ---
  const checkCnicBlacklist = async (cnic, setBlacklistState) => {
    const cleanCnic = String(cnic || "").replace(/-/g, "").trim();
    if (cleanCnic.length !== 13) {
      setBlacklistState("");
      return "";
    }
    try {
      const res = await fetch(`/api/blacklist/lookup/${cleanCnic}`);
      if (res.ok) {
        const data = await res.json();
        const reason = data.reason_flag || "Blacklisted";
        setBlacklistState(reason);
        return reason;
      }
      setBlacklistState("");
      return "";
    } catch {
      setBlacklistState("");
      return "";
    }
  };

  // --- Signature Canvas handlers ---
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Return Signature
  const startDrawing = (e) => {
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0d9488"; // Teal signature ink
    const rect = canvas.getBoundingClientRect();
    
    // Support touch devices
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };
  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    
    // Support touch devices
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };
  const stopDrawing = () => {
    setIsDrawing(false);
    if (signatureCanvasRef.current) {
      setSignatureImage(signatureCanvasRef.current.toDataURL());
    }
  };
  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureImage("");
    }
  };

  // Advance Receipt Signature
  const startAdvanceDrawing = (e) => {
    e.preventDefault();
    const canvas = advanceSignatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#0d9488";
    const rect = canvas.getBoundingClientRect();
    
    // Support touch devices
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };
  const drawAdvance = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = advanceSignatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    
    // Support touch devices
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };
  const stopAdvanceDrawing = () => {
    setIsDrawing(false);
    if (advanceSignatureCanvasRef.current) {
      setAdvanceSignatureImage(advanceSignatureCanvasRef.current.toDataURL());
    }
  };
  const clearAdvanceSignature = () => {
    const canvas = advanceSignatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setAdvanceSignatureImage("");
    }
  };

  // Print Advance Receipt
  const triggerAdvancePrint = () => {
    const printContent = document.getElementById("advance-printable-area").innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = printContent;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  // WhatsApp Advance Receipt
  const sendAdvanceWhatsApp = () => {
    if (!receiptBooking) return;
    const name = receiptBooking.customer.full_name;
    const plate = receiptBooking.booked_cars && receiptBooking.booked_cars.length > 0
      ? receiptBooking.booked_cars.map(bc => bc.car?.plate_number || bc.plate_number).filter(Boolean).join(", ")
      : receiptBooking.car?.plate_number || "N/A";
    const amt = receiptBooking.security_deposit_amount;
    const type = receiptBooking.security_deposit_type;
    const text = `Dear ${name}, this is an official acknowledgment of receipt of your Security Deposit Advance for vehicle(s) ${plate}:\n` +
                 `- Deposit Amount: PKR ${amt} (${type})\n` +
                 `- Deposit Status: Held\n` +
                 `- Booking Date: ${new Date(receiptBooking.start_datetime).toLocaleDateString()}\n` +
                 `Thank you for choosing Rent A Car Management System!`;
    const phone = receiptBooking.customer.phone_primary.replace(/[^0-9]/g, "");
    const cleanPhone = phone.startsWith("0") ? "92" + phone.substring(1) : phone;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  if (userRole === "super_admin") {
    return (
      <SuperAdminDashboard
        userRole={userRole}
        setUserRole={setUserRole}
        onLoginAsTenant={(tId) => {
          localStorage.setItem("active_tenant_id", tId);
          setUserRole("tenant_admin");
          if (typeof window !== "undefined") {
            window.location.hash = "";
            window.location.reload();
          }
        }}
      />
    );
  }

  if (branding.is_active === false || branding.subscription_status === "expired" || branding.subscription_status === "suspended") {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] flex items-center justify-center p-6">
        <div className="glass-panel max-w-md w-full p-8 rounded-2xl border border-rose-500/30 text-center space-y-4">
          <ShieldAlert className="h-14 w-14 text-rose-500 mx-auto" />
          <h1 className="text-2xl font-bold">{branding.subscription_status === "expired" ? "7-Day Free Trial Ended" : "Account Suspended"}</h1>
          <p className="text-xs text-[var(--text-muted)]">
            {branding.subscription_status === "expired"
              ? `Your 7-day free trial for ${branding.name} ended on ${branding.trial_ends_at}. Contact Omnysync support to activate your plan.`
              : `Your workspace for ${branding.name} is currently paused. Contact Omnysync support.`}
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href={`https://wa.me/${(branding.branding_settings?.support_phone || "923001234567").replace(/[^0-9]/g, "")}`}
              target="_blank" rel="noreferrer"
              className="btn-accent py-2.5 px-4 rounded-xl text-xs font-bold text-white"
            >
              Contact Support to Activate
            </a>
            {!isDedicatedTenantHost && (
              <button onClick={() => setUserRole("super_admin")} className="text-[11px] text-[var(--text-muted)] hover:underline pt-2">
                SaaS Operator Login
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Tenant Workspace Password Protection Gate:
  // When accessing a dedicated tenant subdomain (such as azeem-rent-a-car.omnysync.com) or active tenant workspace,
  // require password authentication before displaying any part of the system!
  if (isTenantWorkspace && !tenantToken) {
    return (
      <TenantPasswordGate
        branding={branding}
        tenantId={activeTenantId}
        onLoginSuccess={(token, user) => {
          setTenantToken(token);
          setTenantUser(user);
          if (user?.role) setUserRole(user.role);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen min-h-[100dvh] bg-[var(--bg-app)] text-[var(--text-main)] overflow-x-hidden">
      
      {/* Mobile Header Bar */}
      <header className="flex md:hidden items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-[var(--border-color)] bg-[var(--bg-panel)] z-40 sticky top-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {branding.logo_url ? (
            <img 
              src={branding.logo_url} 
              alt={branding.name || "Rent A Car Management System"} 
              className="h-8 max-w-[140px] object-contain object-left filter dark:brightness-110" 
            />
          ) : (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
                <Car className="h-4 w-4 text-[var(--accent-color)]" />
              </div>
              <span className="font-semibold tracking-tight text-sm text-[var(--text-main)] truncate">
                {branding.name || "Rent A Car Management System"}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            type="button"
            onClick={() => { setActiveTab("settings"); setMobileMenuOpen(false); }}
            className={`p-2.5 min-h-[44px] min-w-[44px] rounded-lg border border-[var(--border-color)] transition-colors ${
              activeTab === "settings"
                ? "bg-teal-500/20 text-teal-400 border-teal-500/40"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--tr-hover)]"
            }`}
            aria-label="Agency Settings & Letterhead"
            title="Agency Settings & Letterhead"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
            className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--tr-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {isTenantWorkspace && (
            <button 
              type="button"
              onClick={handleTenantLogout} 
              className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors"
              aria-label="Lock / Sign Out"
              title="Lock / Sign Out"
            >
              <Lock className="h-4 w-4" />
            </button>
          )}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--tr-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 modal-overlay z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`w-[min(18rem,88vw)] md:w-64 border-r border-[var(--border-color)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] flex flex-col justify-between fixed md:sticky inset-y-0 left-0 z-50 transform md:transform-none transition-transform duration-200 ease-out bg-[var(--bg-panel)]/95 backdrop-blur-md ${
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}>
        <div className="min-h-0 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-3 mb-6 md:mb-8 pt-[env(safe-area-inset-top)] md:pt-0">
            <div className="flex items-center gap-3 min-w-0">
              {branding.logo_url ? (
                <div className="flex flex-col items-start gap-1">
                  <img 
                    src={branding.logo_url} 
                    alt={branding.name || "Rent A Car Management System"} 
                    className="h-10 max-w-[160px] object-contain object-left filter dark:brightness-110" 
                  />
                  <span className="text-[10px] text-[var(--text-muted)] font-medium tracking-wide">{branding.branding_settings?.hub_label || "Lahore hub"}</span>
                </div>
              ) : (
                <>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
                    <Car className="h-5 w-5 text-[var(--accent-color)]" />
                  </div>
                  <div className="min-w-0 text-left">
                    <AnimatedGradientText className="text-sm font-semibold tracking-tight block truncate">
                      {branding.name || "Rent A Car Management System"}
                    </AnimatedGradientText>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium tracking-wide">{branding.branding_settings?.hub_label || "Lahore hub"}</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => { setActiveTab("settings"); setMobileMenuOpen(false); }}
                className={`hidden md:inline-flex p-2 rounded-lg border border-[var(--border-color)] transition-colors ${
                  activeTab === "settings"
                    ? "bg-teal-500/20 text-teal-400 border-teal-500/40"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--tr-hover)]"
                }`}
                aria-label="Agency Settings & Letterhead"
                title="Agency Settings & Letterhead"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
                className="hidden md:inline-flex p-2 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--tr-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              {isTenantWorkspace && (
                <button 
                  type="button"
                  onClick={handleTenantLogout} 
                  className="hidden md:inline-flex p-2 rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                  aria-label="Lock / Sign Out"
                  title="Lock / Sign Out"
                >
                  <Lock className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="md:hidden p-2 min-h-[44px] min-w-[44px] rounded-lg border border-[var(--border-color)] text-[var(--text-muted)]"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <nav className="space-y-0.5 overflow-y-auto pr-1 flex-1 overscroll-contain">
            {[
              { id: "dashboard", label: "Dashboard", icon: ShieldAlert },
              { id: "fleet", label: "Fleet", icon: Car },
              { id: "customers", label: "Customers", icon: Users },
              { id: "leads", label: "Leads CRM", icon: UserPlus },
              { id: "quotations", label: "Quotations", icon: ClipboardList },
              { id: "bookings", label: "Bookings", icon: Calendar },
              { id: "suppliers", label: "Suppliers / Sublet", icon: Handshake },
              { id: "invoices-letters", label: "Invoices & Letters", icon: ScrollText },
              { id: "receipts", label: "Receipts", icon: Receipt },
              { id: "employees", label: "Employees", icon: BadgeCheck },
              { id: "maintenance", label: "Maintenance", icon: Wrench },
              { id: "document-vault", label: "Documents", icon: FileText },
              { id: "reports", label: "Reports", icon: BarChart3 },
              { id: "analytics", label: "Analytics", icon: PieChart },
              { id: "blacklist", label: "Blacklist", icon: AlertTriangle },
              { id: "investors", label: "Investors", icon: Briefcase },
              { id: "shareholders", label: "Shareholders", icon: Wallet },
              { id: "settings", label: "Settings & Letterhead", icon: SettingsIcon }
            ].filter(tab => {
              const toggleable = ["dashboard", "fleet", "customers", "leads", "quotations", "bookings", "suppliers", "receipts", "employees", "maintenance", "blacklist"];
              if (toggleable.includes(tab.id) && branding.feature_flags?.length) {
                return branding.feature_flags.includes(tab.id);
              }
              return true;
            }).map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false);
                }}
                className={`nav-item ${activeTab === tab.id ? "nav-item-active" : ""}`}
              >
                <tab.icon className="h-4 w-4 shrink-0 opacity-80" />
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-3 mt-3 border-t border-[var(--border-color)] space-y-2.5">
          {/* Pinned Quick Access to Settings & Letterhead */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("settings");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
              activeTab === "settings"
                ? "bg-teal-500/20 text-teal-300 border-teal-500/40 shadow-sm"
                : "border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-main)] hover:border-teal-500/40 hover:bg-[var(--tr-hover)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-teal-400 shrink-0" />
              <span>Settings & Letterhead</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-400 font-bold border border-teal-500/25">Setup</span>
          </button>

          {/* Operator / Platform Demo View (only visible on racms.omnysync.com root default workspace) */}
          {!isTenantWorkspace && (
            <>
              <div className="text-left">
                <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5">Role</label>
                <select
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  className="w-full app-input rounded-lg px-2.5 py-2 text-xs font-medium focus:outline-none"
                >
                  <option value="tenant_admin">Tenant Admin</option>
                  <option value="desk_staff">Desk Staff</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <div className="p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-left space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Tenant Scope</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 font-bold border border-teal-500/20">
                    {activeTenantId}
                  </span>
                </div>
                <div className="font-bold text-xs truncate text-[var(--text-main)]">
                  {branding.name || "Agency Workspace"}
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTenantLoginForm({
                        tenant_id: activeTenantId,
                        username: "",
                        password: ""
                      });
                      setShowTenantLoginModal(true);
                    }}
                    className="w-full py-1 px-2 rounded-lg bg-[var(--tr-hover)] hover:bg-teal-500/10 hover:text-teal-400 border border-[var(--border-color)] text-[10px] font-bold text-center transition-colors"
                  >
                    🔑 Login / Switch Tenant
                  </button>
                  {localStorage.getItem("tenant_token") && (
                    <button
                      type="button"
                      onClick={handleTenantLogout}
                      title="Log out of this tenant"
                      className="py-1 px-2 rounded-lg border border-rose-500/20 text-rose-500 hover:bg-rose-500/10 text-[10px] font-bold shrink-0"
                    >
                      Exit
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* PWA Offline & Sync Indicator */}
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-app)] text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              {isOnline ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-amber-500 shrink-0 animate-pulse" />
              )}
              <span className={`font-semibold truncate ${isOnline ? "text-emerald-500" : "text-amber-500"}`}>
                {isOnline ? (pendingSyncCount > 0 ? `${pendingSyncCount} Pending` : (offlineReady ? "Online · Offline-Ready" : "Online · Synced")) : "Offline Mode"}
              </span>
            </div>
            {isOnline && pendingSyncCount > 0 && (
              <button
                type="button"
                onClick={handleManualSync}
                disabled={syncingNow}
                className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-500 text-white flex items-center gap-1 shrink-0"
              >
                <RefreshCw className={`h-2.5 w-2.5 ${syncingNow ? "animate-spin" : ""}`} /> Sync
              </button>
            )}
          </div>

          {/* Download App (PWA) button */}
          <button
            type="button"
            onClick={handleInstallPWA}
            className="w-full py-2 px-3 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <Download className="h-3.5 w-3.5 shrink-0" /> Download App (PWA)
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 w-full p-3 sm:p-4 md:p-8 lg:p-10 overflow-x-hidden overflow-y-auto page-enter">
        
        {/* OFFLINE / PENDING SYNC BANNER */}
        {(!isOnline || pendingSyncCount > 0) && (
          <div className={`mb-4 px-4 py-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
            !isOnline
              ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
              : "border-teal-500/30 bg-teal-500/10 text-teal-500"
          }`}>
            <div className="flex items-center gap-2 font-semibold">
              {!isOnline ? <WifiOff className="h-4 w-4 shrink-0" /> : <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />}
              <span>
                {!isOnline
                  ? `You are working Offline — All cached data is available & ${pendingSyncCount} new change(s) are queued to auto-sync when internet returns.`
                  : `Connection restored — ${pendingSyncCount} offline change(s) ready to sync to server.`}
              </span>
            </div>
            {isOnline && (
              <button
                type="button"
                onClick={handleManualSync}
                className="px-3 py-1 rounded-lg bg-teal-500 text-white font-bold text-[11px]"
              >
                Sync Now
              </button>
            )}
          </div>
        )}

        {/* 7-DAY FREE TRIAL BANNER */}
        {branding.subscription_status === "trialing" && (
          <div className="mb-5 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300 font-semibold">
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                7-Day Free Trial Active — {branding.trial_days_left !== null ? `${Math.max(0, branding.trial_days_left)} day(s) remaining` : "Active"} (Ends {branding.trial_ends_at})
              </span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Omnysync Trial Plan</span>
          </div>
        )}

        {/* TOP ALERT TOAST */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 flex items-center justify-between gap-3 text-rose-700 dark:text-rose-200 shadow-sm">
            <div className="flex items-center gap-3 min-w-0 text-left">
              <AlertTriangle className="h-5 w-5 text-rose-700 dark:text-rose-400 shrink-0" />
              <span className="text-sm">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage("")}
              className="p-2 rounded-lg text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* TAB CONTENTS */}
        {activeTab === "dashboard" && (
          <DashboardView 
            alerts={alerts} 
            cars={cars} 
            bookings={bookings} 
            financials={financials} 
            maintenance={maintenance}
            investors={investors}
            shareholders={shareholders}
            reportDate={reportDate}
            setReportDate={setReportDate}
            setReceiptBooking={setReceiptBooking}
            setShowAdvanceModal={setShowAdvanceModal}
            clearAdvanceSignature={clearAdvanceSignature}
            onOpenQuickBooking={() => setShowQuickEventBookingModal(true)}
          />
        )}
        {activeTab === "fleet" && (
          <FleetView 
            cars={cars} 
            search={carSearch} 
            setSearch={setCarSearch} 
            fetchData={fetchData} 
            showModal={showCarModal} 
            setShowModal={setShowCarModal} 
            editingCar={editingCar} 
            setEditingCar={setEditingCar}
            setHistoryCarId={setHistoryCarId}
            setShowHistoryModal={setShowHistoryModal}
            investors={investors}
            shareholders={shareholders}
          />
        )}
        {activeTab === "customers" && (
          <CustomersView 
            customers={customers} 
            search={customerSearch} 
            setSearch={setCustomerSearch} 
            fetchData={fetchData} 
            showModal={showCustomerModal} 
            setShowModal={setShowCustomerModal} 
            editingCustomer={editingCustomer} 
            setEditingCustomer={setEditingCustomer}
            checkCnicBlacklist={checkCnicBlacklist}
            setErrorMessage={setErrorMessage}
            prefillCustomer={prefillCustomer}
            setPrefillCustomer={setPrefillCustomer}
          />
        )}
        {activeTab === "leads" && (
          <LeadsView
            leads={leads}
            cars={cars}
            branding={branding}
            fetchData={fetchData}
            onCreateQuoteFromLead={(lead) => {
              setPrefillQuote({
                customer_name: lead.full_name,
                customer_phone: lead.phone,
                customer_email: lead.email || "",
                car_id: lead.car_id || "",
                vehicle_description: lead.interested_vehicle || "",
                days: lead.duration_days || 1,
                start_date: lead.pickup_date || new Date().toISOString().slice(0, 10),
                end_date: lead.pickup_date || new Date().toISOString().slice(0, 10),
                daily_rate: lead.quoted_amount && lead.duration_days ? Math.round(lead.quoted_amount / lead.duration_days) : 5000
              });
              setActiveTab("quotations");
            }}
            onConvertLeadToCustomer={(lead) => {
              setPrefillCustomer({
                full_name: lead.full_name,
                phone_primary: lead.phone
              });
              setActiveTab("customers");
            }}
          />
        )}
        {activeTab === "quotations" && (
          <QuotationsView
            quotations={quotations}
            cars={cars}
            branding={branding}
            fetchData={fetchData}
            prefillQuote={prefillQuote}
            setPrefillQuote={setPrefillQuote}
            onConvertQuoteToBooking={(q) => {
              setBookingForm(prev => ({
                ...prev,
                car_id: q.car_id || "",
                daily_rate: q.daily_rate || 3000,
                is_chauffeur_driven: !!q.chauffeur_included,
                chauffeur_daily_wage: q.chauffeur_daily_rate || 1500,
                booking_type: q.company_name ? "Company" : "Individual",
                company_name: q.company_name || ""
              }));
              setActiveTab("bookings");
              setShowBookingModal(true);
            }}
          />
        )}
        {activeTab === "invoices-letters" && (
          <InvoicesLettersView
            vehicleInvoices={vehicleInvoices}
            officialLetters={officialLetters}
            cars={cars}
            branding={branding}
            setBranding={setBranding}
            fetchData={fetchData}
          />
        )}
        {activeTab === "receipts" && (
          <ReceiptsView
            receipts={receipts}
            bookings={bookings}
            branding={branding}
            fetchData={fetchData}
          />
        )}
        {activeTab === "employees" && (
          <EmployeesView
            employees={employees}
            fetchData={fetchData}
          />
        )}
        {activeTab === "bookings" && (
          <BookingsView 
            bookings={bookings} 
            cars={cars} 
            customers={customers} 
            search={bookingSearch} 
            setSearch={setBookingSearch} 
            statusFilter={bookingStatusFilter}
            setStatusFilter={setBookingStatusFilter}
            fetchData={fetchData} 
            showModal={showBookingModal} 
            setShowModal={setShowBookingModal} 
            showReturnModal={showReturnModal}
            setShowReturnModal={setShowReturnModal}
            selectedBooking={selectedBooking}
            setSelectedBooking={setSelectedBooking}
            checkCnicBlacklist={checkCnicBlacklist}
            setErrorMessage={setErrorMessage}
            signatureCanvasRef={signatureCanvasRef}
            signatureImage={signatureImage}
            startDrawing={startDrawing}
            draw={draw}
            stopDrawing={stopDrawing}
            clearSignature={clearSignature}
            theme={theme}
            form={bookingForm}
            setForm={setBookingForm}
            branding={branding}
            financials={financials}
          />
        )}
        {activeTab === "suppliers" && (
          <SuppliersView
            supplierDeals={supplierDeals}
            fetchData={fetchData}
            branding={branding}
          />
        )}
        {activeTab === "maintenance" && (
          <MaintenanceView 
            maintenance={maintenance} 
            cars={cars} 
            fetchData={fetchData} 
            showModal={showMaintenanceModal} 
            setShowModal={setShowMaintenanceModal}
          />
        )}
        {activeTab === "blacklist" && (
          <BlacklistView 
            blacklist={blacklist} 
            fetchData={fetchData} 
            showModal={showBlacklistModal} 
            setShowModal={setShowBlacklistModal}
          />
        )}
        {activeTab === "investors" && (
          <InvestorsView 
            investors={investors} 
            cars={cars}
            financials={financials}
            bookings={bookings}
            maintenance={maintenance}
            fetchData={fetchData} 
          />
        )}
        {activeTab === "shareholders" && (
          <ShareholdersView 
            shareholders={shareholders} 
            cars={cars}
            financials={financials}
            bookings={bookings}
            maintenance={maintenance}
            fetchData={fetchData} 
          />
        )}
        {activeTab === "reports" && (
          <ReportsView 
            cars={cars}
            bookings={bookings}
            customers={customers}
            financials={financials}
            maintenance={maintenance}
            investors={investors}
          />
        )}
        {activeTab === "analytics" && (
          <DataVisualizationsView 
            cars={cars}
            bookings={bookings}
            customers={customers}
            financials={financials}
            maintenance={maintenance}
            investors={investors}
          />
        )}
        {activeTab === "document-vault" && (
          <DocumentVaultView 
            customers={customers} 
            cars={cars} 
            investors={investors}
            fetchData={fetchData}
          />
        )}
        {activeTab === "settings" && (
          <SettingsView branding={branding} setBranding={setBranding} />
        )}

        {/* Dynamic Security Advance Receipt Printable Modal */}
        {showAdvanceModal && receiptBooking && (
          <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="glass-panel modal-sheet w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-6 text-xs border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
                <h3 className="text-base font-bold text-[var(--text-main)]">Generate Advance Deposit Receipt</h3>
                <button onClick={() => { setReceiptBooking(null); setShowAdvanceModal(false); clearAdvanceSignature(); }} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Acknowledgment & Signature */}
                <div className="space-y-4">
                  <h4 className="font-bold text-teal-700 dark:text-teal-400 border-b border-[var(--border-color)] pb-2">Deposit Verification</h4>
                  <p className="text-[var(--text-main)] leading-relaxed">
                    Verify that the security deposit of <strong>PKR {receiptBooking.security_deposit_amount?.toLocaleString()}</strong> has been successfully received via <strong>{receiptBooking.security_deposit_type}</strong>.
                  </p>
                  
                  {/* Canvas Signature */}
                  <div className="border border-[var(--border-color)] p-2 rounded-lg bg-[var(--bg-app)]">
                    <label className="block text-[10px] text-[var(--text-muted)] mb-1 flex items-center gap-1">
                      <PenTool className="h-3 w-3" /> Client Verification Signature
                    </label>
                    <canvas 
                      ref={advanceSignatureCanvasRef}
                      onMouseDown={startAdvanceDrawing}
                      onMouseMove={drawAdvance}
                      onMouseUp={stopAdvanceDrawing}
                      onMouseLeave={stopAdvanceDrawing}
                      onTouchStart={startAdvanceDrawing}
                      onTouchMove={drawAdvance}
                      onTouchEnd={stopAdvanceDrawing}
                      className="sig-canvas w-full bg-white border border-slate-300 rounded-lg cursor-crosshair"
                      width={300}
                      height={90}
                    />
                    <div className="flex justify-between mt-1 text-[9px]">
                      <span className="text-[var(--text-muted)]">Sign with finger or stylus.</span>
                      <button type="button" onClick={clearAdvanceSignature} className="text-teal-700 dark:text-teal-400 hover:underline">Clear Canvas</button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={triggerAdvancePrint}
                      className="flex-1 btn-accent text-white font-bold py-2.5 rounded-lg text-center"
                    >
                      Print Receipt
                    </button>
                    {branding.feature_flags?.includes("whatsapp_api") && (
                      <button 
                        onClick={sendAdvanceWhatsApp}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-lg flex items-center gap-1"
                      >
                        <Send className="h-4 w-4" /> Send WhatsApp
                      </button>
                    )}
                  </div>
                </div>

                {/* Receipt Preview Area */}
                <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-4 text-slate-300 font-mono text-[10px]" id="advance-printable-area">
                  <div className="text-center border-b border-slate-850 pb-3">
                    <h2 className="text-sm font-bold text-white">{(branding.name || "Rent A Car Management System").toUpperCase()}</h2>
                    <p className="text-[9px] text-slate-500">Ferozepur Road, Lahore, Pakistan</p>
                    <p className="text-[9px] text-slate-500">Date: {new Date().toLocaleDateString()}</p>
                    <p className="text-[10px] text-teal-700 dark:text-teal-400 font-bold mt-1">SECURITY DEPOSIT ADVANCE RECEIPT</p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Booking Reference ID:</span>
                      <span className="text-white font-bold">#RMS-{receiptBooking.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Client Name:</span>
                      <span className="text-white">{receiptBooking.customer?.full_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">CNIC Number:</span>
                      <span className="text-white">{receiptBooking.customer?.cnic_number}</span>
                    </div>
                    {receiptBooking.booked_cars && receiptBooking.booked_cars.length > 0 ? (
                      <>
                        <div className="flex justify-between items-start">
                          <span className="text-slate-500">Vehicles:</span>
                          <span className="text-white text-right">
                            {receiptBooking.booked_cars.map(bc => bc.car?.make_model || bc.make_model || "Car").join(", ")}
                          </span>
                        </div>
                        <div className="flex justify-between items-start">
                          <span className="text-slate-500">Plate Numbers:</span>
                          <span className="text-white font-bold text-right">
                            {receiptBooking.booked_cars.map(bc => bc.car?.plate_number || bc.plate_number || "").join(", ")}
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Vehicle:</span>
                          <span className="text-white">{receiptBooking.car?.make_model}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Plate Number:</span>
                          <span className="text-white font-bold">{receiptBooking.car?.plate_number}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="border-t border-slate-850 pt-2.5 space-y-1">
                    <div className="flex justify-between text-white font-bold">
                      <span>Deposit Amount Paid:</span>
                      <span>PKR {receiptBooking.security_deposit_amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Deposit Method:</span>
                      <span>{receiptBooking.security_deposit_type}</span>
                    </div>
                    <div className="flex justify-between text-teal-700 dark:text-teal-400">
                      <span>Deposit Status:</span>
                      <span>HELD (Refundable on return)</span>
                    </div>
                  </div>

                  {advanceSignatureImage && (
                    <div className="border-t border-slate-900 pt-2 text-right">
                      <span className="text-[8px] text-slate-500 block mb-1">Acknowledged Signature:</span>
                      <img src={advanceSignatureImage} alt="signature" className="h-8 ml-auto border border-dashed border-slate-800 rounded bg-white" />
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        <QuickEventBookingModal
          isOpen={showQuickEventBookingModal}
          onClose={() => setShowQuickEventBookingModal(false)}
          cars={cars}
          checkCnicBlacklist={checkCnicBlacklist}
          onBookingCreated={() => {
            fetchData();
          }}
          branding={branding}
        />

        <CarHistoryModal 
          isOpen={showHistoryModal} 
          onClose={() => setShowHistoryModal(false)} 
          carId={historyCarId} 
          userRole={userRole} 
        />

        {/* TENANT LOGIN / SCOPE SWITCH MODAL */}
        {showTenantLoginModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 border border-[var(--border-color)] animate-scale-up">
              <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
                <div>
                  <h3 className="font-bold text-lg text-[var(--text-main)]">
                    {isDedicatedTenantHost ? (branding.name || "Staff Login") : "Agency Workspace Login"}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    {isDedicatedTenantHost ? "Sign in with your staff or administrator account" : "Sign in with your tenant subdomain and credentials"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTenantLoginModal(false)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-main)] min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleTenantLoginSubmit} className="space-y-4 text-xs">
                {isDedicatedTenantHost ? (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-[var(--text-main)]">
                    <span className="text-base">🏢</span>
                    <div className="min-w-0">
                      <div className="font-bold truncate">{branding.name || "Agency Workspace"}</div>
                      <div className="text-[10px] text-teal-400 font-mono truncate">{activeTenantId}.omnysync.com</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-[var(--text-muted)] mb-1">Tenant Subdomain / ID *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. azeem or default"
                      value={tenantLoginForm.tenant_id}
                      onChange={(e) => setTenantLoginForm({ ...tenantLoginForm, tenant_id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                      className="w-full app-input rounded-xl p-2.5 font-mono text-sm focus:outline-none"
                    />
                    <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
                      URL: {tenantLoginForm.tenant_id || "agency"}.racms.omnysync.com
                    </span>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Username / Email *</label>
                  <input
                    type="text"
                    required
                    placeholder="admin@agency.com"
                    value={tenantLoginForm.username}
                    onChange={(e) => setTenantLoginForm({ ...tenantLoginForm, username: e.target.value })}
                    className="w-full app-input rounded-xl p-2.5 text-sm focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-muted)] mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter password"
                    value={tenantLoginForm.password}
                    onChange={(e) => setTenantLoginForm({ ...tenantLoginForm, password: e.target.value })}
                    className="w-full app-input rounded-xl p-2.5 text-sm focus:outline-none font-mono"
                  />
                </div>

                {tenantLoginError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold">
                    {tenantLoginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={tenantLoggingIn}
                  className="w-full btn-accent text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  {tenantLoggingIn ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
                  {tenantLoggingIn ? "Logging in..." : "Log In to Workspace"}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ==========================================
// 1. DASHBOARD COMPONENT
// ==========================================
function DashboardView({ 
  alerts, cars, bookings, financials, maintenance, investors = [], shareholders = [],
  reportDate, setReportDate, setReceiptBooking, setShowAdvanceModal, clearAdvanceSignature,
  onOpenQuickBooking
}) {
  const activeAlerts = alerts;
  const totalVehicles = cars.length;
  const rentedVehicles = cars.filter(c => c.status === "Rented").length;
  const activeRentals = bookings.filter(b => b.status === "Active").length;
  const maintenanceCount = cars.filter(c => c.status === "Maintenance").length;

  const investorPayouts = flattenInvestorPayouts(investors);
  const shareholderPayouts = flattenShareholderPayouts(shareholders);
  const payouts = [...investorPayouts, ...shareholderPayouts];

  const portfolio = investorPortfolioTotals(investors);
  const shPortfolio = shareholderPortfolioTotals(shareholders);

  const totalRevenue = sumCashIn(financials);
  const totalBalanceDue = sumOutstanding(financials);
  const totalMaintCost = sumMaintenanceOut(maintenance);
  const totalPayouts = sumPayoutsOut(payouts);
  const opNet = operatingNet(financials, maintenance);
  const net = netEarnings(financials, maintenance, payouts);
  const daily = dailyCashSummary(financials, maintenance, bookings, reportDate, payouts);
  const monthSeries = monthlyCashflow(financials, maintenance, 6, payouts);

  const heldDepositsBookings = bookings.filter(b => b.security_deposit_status === "Held" && (b.status === "Active" || b.status === "Reserved"));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Dashboard</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1.5 max-w-xl">
            Live fleet, payments, maintenance, and investor payout cashflow — one synced ledger.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenQuickBooking}
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 flex items-center gap-2 transition-all transform active:scale-95 shrink-0"
        >
          <Sparkles className="h-4 w-4" />
          <span>+ Quick Event Booking</span>
        </button>
      </div>

      {/* Quick Action Hero Banner */}
      <div className="p-4 sm:p-5 rounded-2xl border border-teal-500/30 bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 shrink-0 shadow-sm">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-[var(--text-main)]">
              Fast Event & Multi-Car Booking
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Add client details, CNIC ID, destination, pickup, road plan, fuel package, rent & advance payment in one step.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenQuickBooking}
          className="w-full md:w-auto py-2.5 px-5 rounded-xl bg-teal-500 hover:bg-teal-400 text-white text-xs font-bold shadow-md shadow-teal-500/20 flex items-center justify-center gap-2 transition-all shrink-0"
        >
          <Sparkles className="h-4 w-4" />
          <span>Open Booking Form</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Fleet size", value: totalVehicles, icon: Car, color: "text-teal-700 dark:text-teal-400", badge: "Total" },
          { label: "Active Rentals", value: activeRentals, icon: Calendar, color: "text-emerald-700 dark:text-emerald-400", badge: "Live" },
          { label: "Rented Cars", value: rentedVehicles, icon: FileText, color: "text-blue-700 dark:text-blue-400", badge: "On Road" },
          { label: "In Workshop", value: maintenanceCount, icon: Wrench, color: "text-amber-700 dark:text-amber-400", badge: "Service" }
        ].map((card, i) => (
          <MagicCard key={i} beam className="p-0 hover:border-[var(--accent-color)]/35 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5 border-0">
              <span className="text-xs font-medium text-[var(--text-muted)]">{card.label}</span>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[9px] normal-case tracking-normal font-medium">{card.badge}</Badge>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="text-3xl font-semibold tracking-tight text-[var(--text-main)] tabular-nums">{card.value}</div>
            </CardContent>
          </MagicCard>
        ))}
      </div>

      {/* Financial Analytics Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        {[
          { label: "Gross Receipts", value: `PKR ${totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-emerald-700 dark:text-emerald-400" },
          { label: "Outstanding Dues", value: `PKR ${totalBalanceDue.toLocaleString()}`, icon: TrendingUp, color: "text-rose-700 dark:text-rose-400" },
          { label: "Maintenance Outflow", value: `PKR ${totalMaintCost.toLocaleString()}`, icon: Wrench, color: "text-amber-700 dark:text-amber-400" },
          { label: "Partner Payouts", value: `PKR ${totalPayouts.toLocaleString()}`, icon: Briefcase, color: "text-blue-700 dark:text-blue-400" },
          { label: "Net Cash Retained", value: `PKR ${net.toLocaleString()}`, icon: CheckCircle, color: "text-teal-700 dark:text-teal-400" }
        ].map((card, i) => (
          <Card key={i} className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-[var(--tr-hover)] border border-[var(--border-color)]">
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <CardDescription className="text-[10px] uppercase font-bold tracking-wider">{card.label}</CardDescription>
                <CardTitle className="text-base sm:text-lg font-bold font-mono mt-0.5 break-words">{card.value}</CardTitle>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Partner bridge strips */}
      {(portfolio.count > 0 || shPortfolio.count > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {portfolio.count > 0 && (
            <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-blue-500" /> Investor Portfolio Summary
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Capital Pool</span>
                  <span className="font-mono font-bold text-[var(--text-main)]">PKR {portfolio.capital.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Share Earned</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400">PKR {portfolio.earnings.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Payouts Received</span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-400">PKR {portfolio.payouts.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Payouts Due</span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-450">PKR {portfolio.due.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
          
          {shPortfolio.count > 0 && (
            <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)] flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-amber-500" /> Shareholder Portfolio Summary
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Capital Pool</span>
                  <span className="font-mono font-bold text-[var(--text-main)]">PKR {shPortfolio.capital.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Share Earned</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400">PKR {shPortfolio.earnings.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Platform Fee Retained</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-450">PKR {shPortfolio.platform_fee.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] block">Payouts Due</span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-455">PKR {shPortfolio.due.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visual Charts & Dashboard Insights Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Fleet Utilization Progress & Breakdown Chart */}
        <div className="uiverse-gradient-card p-6 space-y-4 border-beam-host">
          <BorderBeam duration={14} size={120} />
          <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
            <h3 className="font-semibold text-base tracking-tight flex items-center gap-2 text-[var(--text-main)]">
              <Car className="h-4 w-4 text-[var(--accent-color)]" /> Fleet utilization
            </h3>
            <Badge variant="default">
              {totalVehicles ? Math.round((rentedVehicles / totalVehicles) * 100) : 0}% rented
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-[var(--text-muted)]">
              <span>Capacity in use</span>
              <span className="tabular-nums">{rentedVehicles} / {totalVehicles}</span>
            </div>
            <Progress value={totalVehicles ? (rentedVehicles / totalVehicles) * 100 : 0} />
          </div>

          <Separator />

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <span className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-400 block">Rented</span>
              <span className="text-lg font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">{rentedVehicles}</span>
            </div>
            <div className="p-3 rounded-xl bg-[var(--accent-muted)] border border-[var(--accent-color)]/20 text-center">
              <span className="text-[10px] uppercase font-semibold text-[var(--accent-color)] block">Available</span>
              <span className="text-lg font-semibold text-[var(--accent-color)] tabular-nums">{Math.max(0, totalVehicles - rentedVehicles - maintenanceCount)}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <span className="text-[10px] uppercase font-semibold text-amber-700 dark:text-amber-400 block">Service</span>
              <span className="text-lg font-semibold text-amber-700 dark:text-amber-400 tabular-nums">{maintenanceCount}</span>
            </div>
          </div>
        </div>

        {/* Financial Distribution Bar Chart */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
            <h3 className="font-bold text-base flex items-center gap-2 text-[var(--text-main)]">
              <TrendingUp className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> Financial Distribution Overview
            </h3>
            <span className="text-xs text-[var(--text-muted)] font-mono">Live Ledger</span>
          </div>

          {/* Visual Bar Comparison */}
          <div className="space-y-3 pt-1">
            {[
              { 
                label: "Gross Receipts", 
                amount: totalRevenue, 
                color: "bg-emerald-500", 
                textColor: "text-emerald-700 dark:text-emerald-400",
                max: Math.max(totalRevenue, totalBalanceDue, totalMaintCost, totalPayouts, 1)
              },
              { 
                label: "Maintenance Outflow", 
                amount: totalMaintCost, 
                color: "bg-amber-500", 
                textColor: "text-amber-700 dark:text-amber-400",
                max: Math.max(totalRevenue, totalBalanceDue, totalMaintCost, totalPayouts, 1)
              },
              { 
                label: "Investor Payouts", 
                amount: totalPayouts, 
                color: "bg-blue-500", 
                textColor: "text-blue-700 dark:text-blue-400",
                max: Math.max(totalRevenue, totalBalanceDue, totalMaintCost, totalPayouts, 1)
              },
              { 
                label: "Outstanding Receivables", 
                amount: totalBalanceDue, 
                color: "bg-rose-500", 
                textColor: "text-rose-700 dark:text-rose-400",
                max: Math.max(totalRevenue, totalBalanceDue, totalMaintCost, totalPayouts, 1)
              }
            ].map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-[var(--text-muted)]">{item.label}</span>
                  <span className={`font-mono font-bold ${item.textColor}`}>PKR {item.amount.toLocaleString()}</span>
                </div>
                <div className="w-full bg-[var(--tr-hover)] h-2.5 rounded-full overflow-hidden border border-[var(--border-color)]">
                  <div 
                    className={`h-full ${item.color} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.min(100, Math.round((item.amount / item.max) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Sales & Revenue Graph Chart */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-3 pb-3 border-b border-[var(--border-color)]">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2 text-[var(--text-main)]">
              <TrendingUp className="h-5 w-5 text-emerald-700 dark:text-emerald-400" /> Monthly Sales & Rental Revenue Trend
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Cash collected from rental payments — last 6 months.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sales Revenue
            </span>
          </div>
        </div>

        {(() => {
          const maxVal = Math.max(...monthSeries.map((m) => m.revenue), 0);
          const { top, ticks } = chartAxisTicks(maxVal, 4);
          const peak = monthSeries.reduce((a, b) => (b.revenue > a.revenue ? b : a), monthSeries[0]);
          return (
            <div className="space-y-3">
              <div className="flex items-end gap-3">
                <div className="w-16 sm:w-20 shrink-0 h-52 flex flex-col justify-between text-right pr-1">
                  {ticks.map((t, i) => (
                    <span key={i} className="text-[10px] font-mono font-semibold text-[var(--text-muted)] leading-none">
                      {formatCompactPKR(t).replace("PKR ", "")}
                    </span>
                  ))}
                </div>

                <div className="relative flex-1 h-52 min-w-0">
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {ticks.map((_, i) => (
                      <div key={i} className="w-full border-t border-[var(--border-color)]/70 border-dashed" />
                    ))}
                  </div>

                  <div className="absolute inset-0 flex items-end justify-between gap-2 sm:gap-3 px-1">
                    {monthSeries.map((m) => {
                      const pct = top > 0 ? (m.revenue / top) * 100 : 0;
                      const isPeak = m.revenue > 0 && m.key === peak.key;
                      return (
                        <div key={m.key} className="flex-1 flex flex-col items-center justify-end h-full min-w-0 group">
                          <span
                            className={`mb-1.5 text-[10px] sm:text-[11px] font-mono font-bold tabular-nums text-center leading-tight px-0.5 ${
                              m.revenue > 0
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-[var(--text-muted)]/50"
                            }`}
                            title={`PKR ${m.revenue.toLocaleString()}`}
                          >
                            {formatCompactPKR(m.revenue)}
                          </span>
                          <div className="w-full max-w-[56px] h-full flex items-end">
                            <div
                              className={`w-full rounded-t-md transition-all duration-500 ${
                                m.revenue > 0
                                  ? isPeak
                                    ? "bg-gradient-to-t from-emerald-700 to-teal-400 shadow-md shadow-emerald-500/20"
                                    : "bg-gradient-to-t from-emerald-600/90 to-teal-400/90"
                                  : "bg-transparent"
                              } group-hover:brightness-110`}
                              style={{ height: m.revenue > 0 ? `${Math.max(pct, 2)}%` : "0%" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-16 sm:w-20 shrink-0" />
                <div className="flex-1 flex justify-between gap-2 sm:gap-3 px-1 border-t border-[var(--border-color)] pt-2">
                  {monthSeries.map((m) => (
                    <div key={m.key} className="flex-1 text-center min-w-0">
                      <span className="text-[11px] sm:text-xs font-bold text-[var(--text-main)] block truncate">
                        {m.key.split(" ")[0]}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {m.key.split(" ")[1]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-[var(--text-muted)] font-mono">
                Scale max {formatCompactPKR(top)}
                {peak?.revenue > 0 ? ` · Peak ${peak.key}: ${formatCompactPKR(peak.revenue)}` : ""}
              </p>
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Daily Profit Report Module */}
        <div className="glass-panel p-6 rounded-2xl">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)] mb-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-teal-700 dark:text-teal-400" /> Daily Net Profit Statement
            </h3>
            <input 
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="app-input rounded-lg p-1.5 text-xs focus:outline-none"
            />
          </div>
          
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between py-1 border-b border-[var(--border-color)]/45">
              <span className="text-[var(--text-muted)]">Daily Collections Recd:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold">PKR {daily.dailyIncome.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-color)]/45">
              <span className="text-[var(--text-muted)]">Chauffeur Daily Outflows:</span>
              <span className="text-rose-700 dark:text-rose-400 font-bold">- PKR {daily.dailyDriverExpense.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-color)]/45">
              <span className="text-[var(--text-muted)]">Workshop Repairs Outflow:</span>
              <span className="text-rose-700 dark:text-rose-400 font-bold">- PKR {daily.dailyMaintExpense.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-[var(--border-color)]/45">
              <span className="text-[var(--text-muted)]">Investor Payouts Outflow:</span>
              <span className="text-blue-700 dark:text-blue-400 font-bold">- PKR {(daily.dailyPayoutExpense || 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-3 text-sm font-bold border-t border-[var(--border-color)]">
              <span>Estimated Net Earnings:</span>
              <span className={daily.netDaily >= 0 ? "text-emerald-700 dark:text-emerald-400 font-bold" : "text-rose-700 dark:text-rose-400 font-bold"}>
                PKR {daily.netDaily.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Security Deposits Active Ledger */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2 pb-3 border-b border-[var(--border-color)] mb-3 text-teal-700 dark:text-teal-400">
              <Wallet className="h-4 w-4 text-teal-700 dark:text-teal-400" /> Active Security Advances Held
            </h3>

            <div className="space-y-2 overflow-y-auto max-h-48 pr-1">
              {heldDepositsBookings.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] italic text-center py-8">No security advances currently held.</p>
              ) : (
                heldDepositsBookings.map(b => (
                  <div key={b.id} className="flex justify-between items-center bg-[var(--tr-hover)] p-2.5 rounded-lg border border-[var(--border-color)] text-xs">
                    <div>
                      <span className="font-bold text-[var(--text-main)] block">{b.customer?.full_name}</span>
                      <span className="text-[9px] text-[var(--text-muted)] block">Car: {b.car?.make_model} ({b.car?.plate_number})</span>
                    </div>
                    <div className="text-right space-y-1">
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold block">PKR {b.security_deposit_amount?.toLocaleString()}</span>
                      <button 
                        onClick={() => { setReceiptBooking(b); setShowAdvanceModal(true); clearAdvanceSignature(); }}
                        className="bg-teal-600/10 hover:bg-teal-600 text-teal-700 dark:text-teal-400 hover:text-white border border-teal-500/20 px-2.5 py-1 rounded-lg text-[9px] font-semibold transition-all"
                      >
                        Advance Receipt
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Local Risks Alerts Section */}
      <div className="glass-panel p-6 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-3">
            <div className="bg-red-500/10 p-2 rounded-lg">
              <ShieldAlert className="h-5 w-5 text-red-700 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[var(--text-main)]">Active System Notifications</h3>
              <p className="text-xs text-[var(--text-muted)]">Late returns, document expiries, oil & tax alerts.</p>
            </div>
          </div>
          <span className="bg-[var(--tr-hover)] text-xs text-[var(--text-main)] border border-[var(--border-color)] font-mono px-3 py-1 rounded-full">{activeAlerts.length} issues</span>
        </div>

        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <CheckCircle className="h-12 w-12 text-teal-700 dark:text-teal-400/40 mb-3" />
            <p className="text-sm font-medium">All vehicle systems are verified and compliant.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeAlerts.map((alert, i) => (
              <div 
                key={i} 
                className={`p-4 rounded-xl border flex items-start gap-4 ${
                  alert.severity === "red" 
                    ? "bg-red-500/5 border-red-500/30 text-red-800 dark:text-red-200 animate-flash-red" 
                    : "bg-amber-500/5 border-amber-500/20 text-amber-800 dark:text-amber-200"
                }`}
              >
                <AlertTriangle className={`h-5 w-5 mt-0.5 ${alert.severity === "red" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`} />
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-[var(--text-main)]">{alert.title}</h4>
                  <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{alert.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 2. FLEET COMPONENT
// ==========================================
function FleetView({ 
  cars, search, setSearch, fetchData, showModal, setShowModal, 
  editingCar, setEditingCar, setHistoryCarId, setShowHistoryModal,
  investors = [], shareholders = [] 
}) {
  const emptyCarForm = {
    plate_number: "", chassis_number: "", make_model: "", model_year: 2026, color: "", 
    engine_cc: 1300, current_odometer: 0, transmission_type: "Auto", 
    status: "Available", last_oil_change_odometer: 0, image_url: "",
    registration_doc_url: "", fitness_cert_url: "", token_tax_doc_url: "",
    fitness_expiry_date: "", token_tax_expiry_date: "", registration_expiry_date: "",
    ownership_type: "Company", investor_id: "", investor_profit_share: "",
    shareholder_id: "", shareholder_profit_share: ""
  };
  const [form, setForm] = useState(emptyCarForm);

  useEffect(() => {
    if (editingCar) {
      let ownership_type = "Company";
      if (editingCar.investor_id) ownership_type = "Investor";
      else if (editingCar.shareholder_id) ownership_type = "Shareholder";

      setForm({
        ...editingCar,
        chassis_number: editingCar.chassis_number || "",
        image_url: editingCar.image_url || "",
        registration_doc_url: editingCar.registration_doc_url || "",
        fitness_cert_url: editingCar.fitness_cert_url || "",
        token_tax_doc_url: editingCar.token_tax_doc_url || "",
        fitness_expiry_date: editingCar.fitness_expiry_date ? String(editingCar.fitness_expiry_date).slice(0, 10) : "",
        token_tax_expiry_date: editingCar.token_tax_expiry_date ? String(editingCar.token_tax_expiry_date).slice(0, 10) : "",
        registration_expiry_date: editingCar.registration_expiry_date ? String(editingCar.registration_expiry_date).slice(0, 10) : "",
        ownership_type,
        investor_id: editingCar.investor_id || "",
        investor_profit_share: editingCar.investor_profit_share || "",
        shareholder_id: editingCar.shareholder_id || "",
        shareholder_profit_share: editingCar.shareholder_profit_share || ""
      });
    } else {
      setForm({ ...emptyCarForm });
    }
  }, [editingCar, showModal]);

  const handleFileUpload = async (e, field = "image_url") => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/cars/upload", {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setForm(prev => ({ ...prev, [field]: data.image_url }));
      } else {
        alert("Failed to upload file.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Error uploading file.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingCar ? "PUT" : "POST";
    const endpoint = editingCar ? `/api/cars/${editingCar.id}` : "/api/cars";

    const payload = {
      ...form,
      fitness_expiry_date: form.fitness_expiry_date || null,
      token_tax_expiry_date: form.token_tax_expiry_date || null,
      registration_expiry_date: form.registration_expiry_date || null,
      investor_id: form.ownership_type === "Investor" ? (parseInt(form.investor_id, 10) || null) : null,
      investor_profit_share: form.ownership_type === "Investor" ? (parseFloat(form.investor_profit_share) || null) : null,
      shareholder_id: form.ownership_type === "Shareholder" ? (parseInt(form.shareholder_id, 10) || null) : null,
      shareholder_profit_share: form.ownership_type === "Shareholder" ? (parseFloat(form.shareholder_profit_share) || null) : null,
    };
    delete payload.ownership_type;

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setShowModal(false);
      setEditingCar(null);
      fetchData();
    } else {
      const data = await res.json();
      alert(data.detail || "Error saving vehicle information.");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure you want to delete this car?")) {
      const res = await fetch(`/api/cars/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    }
  };

  const filtered = cars.filter(c => 
    c.plate_number.toLowerCase().includes(search.toLowerCase()) || 
    c.make_model.toLowerCase().includes(search.toLowerCase()) ||
    (c.chassis_number || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Luxury Fleet</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Add, update, and manage vehicle states.</p>
        </div>
        <ShimmerButton 
          onClick={() => { setEditingCar(null); setShowModal(true); }}
          className="page-cta"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Add Vehicle</span>
        </ShimmerButton>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
        <input 
          type="text" 
          placeholder="Search by Plate, Chassis No or Make/Model..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full app-input rounded-xl py-3 pl-10 pr-4 text-sm text-[var(--text-main)] focus:outline-none"
        />
      </div>

      {/* Grid Cards of Luxury Fleet */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(car => {
          const diff = car.current_odometer - car.last_oil_change_odometer;
          const remaining = 5000 - diff;
          
          return (
            <div key={car.id} className="glass-card rounded-2xl overflow-hidden shadow-lg border border-[var(--border-color)] flex flex-col justify-between group">
              <div>
                {/* Car Image Header */}
                <div className="relative h-44 w-full bg-slate-900/50 overflow-hidden">
                  {car.image_url ? (
                    <img 
                      src={car.image_url} 
                      alt={car.make_model} 
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=600&q=80";
                      }}
                    />
                  ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center text-[var(--text-muted)] bg-[var(--bg-app)]">
                      <Car className="h-12 w-12 mb-2 opacity-30" />
                      <span className="text-[10px] uppercase tracking-wider font-semibold">No Image Available</span>
                    </div>
                  )}
                  {/* Status Overlay Badge */}
                  <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-md backdrop-blur-md ${
                    car.status === "Available" ? "bg-emerald-500/80 text-white border border-emerald-400/50" :
                    car.status === "Rented" ? "bg-amber-500/80 text-white border border-amber-400/50" :
                    car.status === "Maintenance" ? "bg-rose-500/80 text-white border border-rose-400/50 animate-flash-red" :
                    "bg-slate-500/80 text-white border border-slate-400/50"
                  }`}>
                    {car.status}
                  </span>
                  
                  {/* Model Year floating label */}
                  <span className="absolute bottom-4 left-4 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-xs">
                    Year: {car.model_year}
                  </span>
                </div>

                {/* Car Metadata details */}
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--text-main)] group-hover:text-[var(--accent-color)] transition-colors line-clamp-1">{car.make_model}</h3>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono mt-0.5">{car.color} • {car.engine_cc}cc • {car.transmission_type}</p>
                      {car.chassis_number && <p className="text-[10px] text-teal-500 font-mono mt-0.5">Chassis: {car.chassis_number}</p>}
                    </div>
                  </div>

                  {/* Dummy Pakistani Styled Plate Badge */}
                  <div className="flex items-center">
                    <div className="bg-emerald-900/10 dark:bg-emerald-950/20 border-2 border-emerald-600 rounded px-2.5 py-1 text-center font-mono inline-flex items-center gap-1.5 shadow-xs">
                      <div className="w-1 h-6 bg-amber-500 rounded-xs"></div>
                      <div>
                        <div className="text-[7px] text-emerald-700 dark:text-emerald-400 font-bold uppercase leading-none tracking-wider">Punjab - LHR</div>
                        <div className="text-xs text-emerald-800 dark:text-emerald-200 font-extrabold tracking-widest leading-none mt-0.5">{car.plate_number}</div>
                      </div>
                    </div>
                  </div>

                  {/* Oil Meter Status */}
                  <div className="space-y-1.5 pt-2 border-t border-[var(--border-color)]">
                    <div className="flex justify-between text-[10px] font-semibold">
                      <span className="text-[var(--text-muted)]">Current Odometer:</span>
                      <span className="text-[var(--text-main)] font-mono">{car.current_odometer.toLocaleString()} km</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-semibold">
                      <span className="text-[var(--text-muted)]">Next Oil Change:</span>
                      <span className={`font-mono font-bold ${
                        remaining <= 0 ? "text-rose-700 dark:text-rose-400 animate-pulse" :
                        remaining <= 500 ? "text-amber-700 dark:text-amber-400" :
                        "text-emerald-700 dark:text-emerald-400"
                      }`}>
                        {remaining <= 0 ? "EXPIRED" : `${remaining.toLocaleString()} km left`}
                      </span>
                    </div>
                    
                    {/* Status Progress Bar */}
                    <div className="w-full bg-[var(--bg-app)] rounded-full h-1.5 overflow-hidden border border-[var(--border-color)]">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          remaining <= 0 ? "bg-rose-600" :
                          remaining <= 500 ? "bg-amber-500" :
                          "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, (remaining / 5000) * 100))}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-5 pt-0 flex gap-2 border-t border-[var(--border-color)] mt-4 pt-4">
                <button 
                  onClick={() => { setEditingCar(car); setShowModal(true); }}
                  className="flex-1 py-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-[var(--accent-color)] hover:text-[var(--accent-color)] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Edit Info
                </button>
                <button 
                  onClick={() => { setHistoryCarId(car.id); setShowHistoryModal(true); }}
                  className="py-2 px-3 rounded-xl bg-teal-500/10 hover:bg-teal-500 hover:text-white text-teal-700 dark:text-teal-400 border border-teal-500/15 text-xs font-semibold flex items-center justify-center transition-colors min-h-[44px]"
                  title="View Rental & Maintenance History"
                >
                  <Clock className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => handleDelete(car.id)}
                  className="py-2 px-3 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/15 hover:bg-rose-500/20 text-xs font-semibold flex items-center justify-center transition-colors min-h-[44px]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
              <h3 className="text-xl font-bold text-[var(--text-main)]">{editingCar ? "Edit Vehicle" : "Add Vehicle"}</h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Make / Model *</label>
                  <input 
                    type="text" required
                    value={form.make_model}
                    onChange={(e) => setForm({...form, make_model: e.target.value})}
                    placeholder="Honda Civic"
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Plate Number *</label>
                  <input 
                    type="text" required
                    value={form.plate_number}
                    onChange={(e) => setForm({...form, plate_number: e.target.value})}
                    placeholder="LEA-5555"
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Chassis Number (VIN)</label>
                <input 
                  type="text"
                  value={form.chassis_number || ""}
                  onChange={(e) => setForm({...form, chassis_number: e.target.value})}
                  placeholder="e.g. NZE161-7089234"
                  className="w-full app-input rounded-lg p-2.5 font-mono focus:outline-none"
                />
              </div>

              <div className="space-y-3">
                {form.image_url ? (
                  <div className="flex items-center gap-4 bg-[var(--bg-app)] border border-[var(--border-color)] p-3 rounded-lg">
                    <img src={form.image_url} alt="Preview" className="h-12 w-20 object-cover rounded-lg border border-[var(--border-color)]" />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-[var(--text-muted)] block">Selected Image:</span>
                      <span className="text-xs text-[var(--text-main)] truncate block font-mono">{form.image_url}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setForm(prev => ({ ...prev, image_url: "" }))}
                      className="text-xs text-rose-700 dark:text-rose-400 hover:underline font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Vehicle Image (Upload File)</label>
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, "image_url")}
                        className="w-full app-input rounded-lg p-2 focus:outline-none text-[11px] text-[var(--text-main)]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Or Paste Image URL</label>
                      <input 
                        type="text"
                        value={form.image_url}
                        onChange={(e) => setForm({...form, image_url: e.target.value})}
                        placeholder="https://example.com/car-image.jpg"
                        className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--border-color)] pt-4 space-y-3">
                <p className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Vehicle Documents</p>
                {[
                  { field: "registration_doc_url", label: "Registration Papers" },
                  { field: "fitness_cert_url", label: "Fitness Certificate" },
                  { field: "token_tax_doc_url", label: "Token Tax Receipt" }
                ].map(doc => (
                  <div key={doc.field} className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[var(--text-muted)]">{doc.label}</label>
                    {form[doc.field] ? (
                      <div className="flex items-center gap-3 bg-[var(--bg-app)] border border-[var(--border-color)] p-2.5 rounded-lg">
                        <FileText className="h-4 w-4 text-[var(--accent-color)] shrink-0" />
                        <a href={form[doc.field]} target="_blank" rel="noreferrer" className="flex-1 min-w-0 text-xs text-[var(--accent-color)] truncate underline">
                          {form[doc.field]}
                        </a>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, [doc.field]: "" }))}
                          className="text-xs text-rose-700 dark:text-rose-400 hover:underline font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileUpload(e, doc.field)}
                        className="w-full app-input rounded-lg p-2 focus:outline-none text-[11px] text-[var(--text-main)]"
                      />
                    )}
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Registration Expiry</label>
                    <input type="date" value={form.registration_expiry_date || ""} onChange={(e) => setForm({...form, registration_expiry_date: e.target.value})} className="w-full app-input rounded-lg p-2 focus:outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Fitness Expiry</label>
                    <input type="date" value={form.fitness_expiry_date || ""} onChange={(e) => setForm({...form, fitness_expiry_date: e.target.value})} className="w-full app-input rounded-lg p-2 focus:outline-none text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Token Tax Expiry</label>
                    <input type="date" value={form.token_tax_expiry_date || ""} onChange={(e) => setForm({...form, token_tax_expiry_date: e.target.value})} className="w-full app-input rounded-lg p-2 focus:outline-none text-xs" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Model Year *</label>
                  <input 
                    type="number" required
                    value={form.model_year}
                    onChange={(e) => setForm({...form, model_year: parseInt(e.target.value) || 2026})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Color *</label>
                  <input 
                    type="text" required
                    value={form.color}
                    onChange={(e) => setForm({...form, color: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Engine CC *</label>
                  <input 
                    type="number" required
                    value={form.engine_cc}
                    onChange={(e) => setForm({...form, engine_cc: parseInt(e.target.value) || 1500})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Current Odometer (km) *</label>
                  <input 
                    type="number" required
                    value={form.current_odometer}
                    onChange={(e) => setForm({...form, current_odometer: parseInt(e.target.value) || 0})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Last Oil Change Odo (km)</label>
                  <input 
                    type="number" 
                    value={form.last_oil_change_odometer}
                    onChange={(e) => setForm({...form, last_oil_change_odometer: parseInt(e.target.value) || 0})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Transmission Type *</label>
                  <select 
                    value={form.transmission_type}
                    onChange={(e) => setForm({...form, transmission_type: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  >
                    <option value="Auto">Auto</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Status *</label>
                  <select 
                    value={form.status}
                    onChange={(e) => setForm({...form, status: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  >
                    <option value="Available">Available</option>
                    <option value="Rented">Rented</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Reserved">Reserved</option>
                  </select>
                </div>
              </div>

              {/* Partner Ownership Details */}
              <div className="border-t border-[var(--border-color)] pt-4 space-y-3">
                <p className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Partner Ownership</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Ownership Type</label>
                    <select 
                      value={form.ownership_type}
                      onChange={(e) => setForm({...form, ownership_type: e.target.value})}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                    >
                      <option value="Company">Company Owned</option>
                      <option value="Investor">Investor Owned</option>
                      <option value="Shareholder">Shareholder Owned</option>
                    </select>
                  </div>
                  
                  {form.ownership_type === "Investor" && (
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Select Investor *</label>
                      <select 
                        required
                        value={form.investor_id}
                        onChange={(e) => {
                          const selectedId = parseInt(e.target.value, 10);
                          const inv = investors.find(i => (i.investor_id || i.id) === selectedId);
                          setForm({
                            ...form,
                            investor_id: selectedId,
                            investor_profit_share: inv ? inv.profit_share_percentage : 70.0
                          });
                        }}
                        className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                      >
                        <option value="">-- Choose Investor --</option>
                        {investors.map(inv => (
                          <option key={inv.investor_id || inv.id} value={inv.investor_id || inv.id}>{inv.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {form.ownership_type === "Shareholder" && (
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Select Shareholder *</label>
                      <select 
                        required
                        value={form.shareholder_id}
                        onChange={(e) => {
                          const selectedId = parseInt(e.target.value, 10);
                          const sh = shareholders.find(s => (s.shareholder_id || s.id) === selectedId);
                          setForm({
                            ...form,
                            shareholder_id: selectedId,
                            shareholder_profit_share: sh ? sh.share_percentage : 50.0
                          });
                        }}
                        className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                      >
                        <option value="">-- Choose Shareholder --</option>
                        {shareholders.map(sh => (
                          <option key={sh.shareholder_id || sh.id} value={sh.shareholder_id || sh.id}>{sh.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {form.ownership_type === "Investor" && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Investor Profit Share (%) *</label>
                    <input 
                      type="number" step="0.1" min="0" max="100" required
                      value={form.investor_profit_share}
                      onChange={(e) => setForm({...form, investor_profit_share: parseFloat(e.target.value) || 0})}
                      className="w-full app-input rounded-lg p-2.5"
                    />
                  </div>
                )}

                {form.ownership_type === "Shareholder" && (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Shareholder Cut / Share (%) *</label>
                    <input 
                      type="number" step="0.1" min="0" max="100" required
                      value={form.shareholder_profit_share}
                      onChange={(e) => setForm({...form, shareholder_profit_share: parseFloat(e.target.value) || 0})}
                      className="w-full app-input rounded-lg p-2.5"
                    />
                  </div>
                )}
              </div>

              <button 
                type="submit"
                className="w-full btn-accent text-white font-semibold py-3 rounded-lg mt-4 transition-all"
              >
                Save Vehicle
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. CUSTOMERS COMPONENT
// ==========================================
function CustomersView({ customers, search, setSearch, fetchData, showModal, setShowModal, editingCustomer, setEditingCustomer, checkCnicBlacklist, setErrorMessage, prefillCustomer, setPrefillCustomer }) {
  const emptyCustForm = {
    full_name: "", phone_primary: "", phone_secondary: "", home_address: "",
    cnic_number: "", license_number: "", license_expiry_date: "",
    cheque_number: "", passport_number: "",
    guarantor_name: "", guarantor_phone: "", guarantor_cnic: "", guarantor_address: "",
    guarantor2_name: "", guarantor2_phone: "", guarantor2_cnic: "", guarantor2_address: "",
    guarantee_details: ""
  };
  const [form, setForm] = useState(emptyCustForm);
  const [cnicFrontFile, setCnicFrontFile] = useState(null);
  const [cnicBackFile, setCnicBackFile] = useState(null);
  const [licenseFrontFile, setLicenseFrontFile] = useState(null);

  // Extra documents & Guarantor PDFs state
  const [extraDocsList, setExtraDocsList] = useState([]);
  const [newDocPreset, setNewDocPreset] = useState("Guarantor 1 CNIC / Document");
  const [docUploadLoading, setDocUploadLoading] = useState(false);

  const [blacklistWarning, setBlacklistWarning] = useState("");

  const sendCustomerWhatsApp = (cust) => {
    const raw = cust.phone_primary || "";
    const clean = raw.replace(/[^0-9]/g, "");
    if (!clean) return alert("Customer has no phone number.");
    const num = clean.startsWith("0") ? "92" + clean.substring(1) : clean;
    const brand = "Rent A Car Management System";
    const msg = `*${brand}* - Client Services\nDear ${cust.full_name},\n\nWe are reaching out regarding your account and vehicle rental reservations. Please let us know if you need any assistance!`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleAttachExtraDoc = async (file, title) => {
    if (!file) return;
    setDocUploadLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title || "Guarantor Document");
      const res = await fetch("/api/customers/upload-document", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setExtraDocsList(prev => [...prev, {
          title: data.title,
          file_path: data.file_path,
          filename: data.filename || file.name,
          size: file.size
        }]);
      } else {
        alert("Failed to upload document.");
      }
    } catch (err) {
      alert("Upload error: " + err.message);
    } finally {
      setDocUploadLoading(false);
    }
  };

  const removeExtraDoc = (idx) => {
    setExtraDocsList(prev => prev.filter((_, i) => i !== idx));
  };

  useEffect(() => {
    if (prefillCustomer) {
      setEditingCustomer(null);
      setForm({ ...emptyCustForm, ...prefillCustomer });
      setShowModal(true);
      if (setPrefillCustomer) setPrefillCustomer(null);
      return;
    }
    if (editingCustomer) {
      setForm({
        full_name: editingCustomer.full_name || "",
        phone_primary: editingCustomer.phone_primary || "",
        phone_secondary: editingCustomer.phone_secondary || "",
        home_address: editingCustomer.home_address || "",
        cnic_number: editingCustomer.cnic_number || "",
        license_number: editingCustomer.license_number || "",
        license_expiry_date: editingCustomer.license_expiry_date
          ? String(editingCustomer.license_expiry_date).slice(0, 10)
          : "",
        cheque_number: editingCustomer.cheque_number || "",
        passport_number: editingCustomer.passport_number || "",
        guarantor_name: editingCustomer.guarantor_name || "",
        guarantor_phone: editingCustomer.guarantor_phone || "",
        guarantor_cnic: editingCustomer.guarantor_cnic || "",
        guarantor_address: editingCustomer.guarantor_address || "",
        guarantor2_name: editingCustomer.guarantor2_name || "",
        guarantor2_phone: editingCustomer.guarantor2_phone || "",
        guarantor2_cnic: editingCustomer.guarantor2_cnic || "",
        guarantor2_address: editingCustomer.guarantor2_address || "",
        guarantee_details: editingCustomer.guarantee_details || ""
      });
      setExtraDocsList(Array.isArray(editingCustomer.extra_documents) ? editingCustomer.extra_documents : []);
    } else {
      setForm(emptyCustForm);
      setExtraDocsList([]);
    }
    setCnicFrontFile(null);
    setCnicBackFile(null);
    setLicenseFrontFile(null);
    setBlacklistWarning("");
  }, [editingCustomer, showModal, prefillCustomer]);

  const handleCnicChange = (e) => {
    const val = e.target.value;
    setForm({...form, cnic_number: val});
    if (val.replace("-", "").length === 13) {
      checkCnicBlacklist(val, setBlacklistWarning);
    } else {
      setBlacklistWarning("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (blacklistWarning) {
      setErrorMessage(`CANNOT SUBMIT: customer is blacklisted. Reason: ${blacklistWarning}`);
      return;
    }

    const formData = new FormData();
    formData.append("full_name", form.full_name);
    formData.append("phone_primary", form.phone_primary);
    formData.append("phone_secondary", form.phone_secondary || "");
    formData.append("home_address", form.home_address);
    formData.append("cnic_number", form.cnic_number);
    formData.append("license_number", form.license_number);
    if (form.license_expiry_date) formData.append("license_expiry_date", form.license_expiry_date);
    formData.append("cheque_number", form.cheque_number || "");
    formData.append("passport_number", form.passport_number || "");
    formData.append("guarantor_name", form.guarantor_name || "");
    formData.append("guarantor_phone", form.guarantor_phone || "");
    formData.append("guarantor_cnic", form.guarantor_cnic || "");
    formData.append("guarantor_address", form.guarantor_address || "");
    formData.append("guarantor2_name", form.guarantor2_name || "");
    formData.append("guarantor2_phone", form.guarantor2_phone || "");
    formData.append("guarantor2_cnic", form.guarantor2_cnic || "");
    formData.append("guarantor2_address", form.guarantor2_address || "");
    formData.append("guarantee_details", form.guarantee_details || "");
    formData.append("extra_documents", JSON.stringify(extraDocsList || []));
    
    if (cnicFrontFile) formData.append("cnic_front", cnicFrontFile);
    if (cnicBackFile) formData.append("cnic_back", cnicBackFile);
    if (licenseFrontFile) formData.append("license_front", licenseFrontFile);

    const endpoint = editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers";
    const method = editingCustomer ? "PUT" : "POST";

    const res = await fetch(endpoint, { method, body: formData });

    if (res.ok) {
      setShowModal(false);
      setEditingCustomer(null);
      fetchData();
    } else {
      const data = await res.json();
      alert(data.detail || "Error saving customer.");
    }
  };

  const handleDelete = async (id) => {
    if (confirm("Delete customer database record?")) {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    }
  };

  const openEdit = (cust) => {
    setEditingCustomer(cust);
    setShowModal(true);
  };

  const filtered = customers.filter(c => 
    c.full_name.toLowerCase().includes(search.toLowerCase()) || 
    c.cnic_number.includes(search) ||
    (c.phone_primary || "").includes(search) ||
    (c.passport_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.cheque_number || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.guarantor_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.guarantor2_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.guarantor_cnic || "").includes(search) ||
    (c.guarantor2_cnic || "").includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Client Hub</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage database records and compliance documents.</p>
        </div>
        <ShimmerButton 
          onClick={() => { setEditingCustomer(null); setShowModal(true); }}
          className="page-cta"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Add Customer</span>
        </ShimmerButton>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
        <input 
          type="text" 
          placeholder="Search by Name, CNIC, Phone, Passport or Cheque No..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full app-input rounded-xl py-3 pl-10 pr-4 text-sm text-[var(--text-main)] focus:outline-none"
        />
      </div>

      <div className="hidden md:block glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/20 border-b border-[var(--border-color)] text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
              <th className="p-4">Full Name</th>
              <th className="p-4">CNIC / Passport</th>
              <th className="p-4">Contact & Address</th>
              <th className="p-4">Cheque / Guarantee</th>
              <th className="p-4">License Expiry</th>
              <th className="p-4">Documents</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 text-sm">
            {filtered.map(cust => (
              <tr key={cust.id} className="hover:bg-[var(--tr-hover)] transition-colors">
                <td className="p-4 font-bold text-[var(--text-main)]">
                  <div>{cust.full_name}</div>
                  <div className="text-[10px] font-normal text-[var(--text-muted)]">Lic: {cust.license_number}</div>
                </td>
                <td className="p-4 font-mono text-xs">
                  <div>{cust.cnic_number}</div>
                  {cust.passport_number && <div className="text-[10px] text-teal-500">PP: {cust.passport_number}</div>}
                </td>
                <td className="p-4 text-xs">
                  <div className="font-semibold">{cust.phone_primary}</div>
                  <div className="text-[10px] text-[var(--text-muted)] max-w-[180px] truncate">{cust.home_address}</div>
                </td>
                <td className="p-4 text-xs">
                  {cust.cheque_number && <div className="font-mono text-amber-500 font-bold">Chq: {cust.cheque_number}</div>}
                  {cust.guarantor_name && <div className="text-[10px] text-[var(--text-muted)]">G1: {cust.guarantor_name}{cust.guarantor_phone ? ` (${cust.guarantor_phone})` : ""}</div>}
                  {cust.guarantor2_name && <div className="text-[10px] text-[var(--text-muted)]">G2: {cust.guarantor2_name}{cust.guarantor2_phone ? ` (${cust.guarantor2_phone})` : ""}</div>}
                  {!cust.cheque_number && !cust.guarantor_name && !cust.guarantor2_name && <span className="text-[var(--text-muted)] italic text-[11px]">None</span>}
                </td>
                <td className="p-4 text-xs font-mono">
                  {cust.license_expiry_date ? String(cust.license_expiry_date).slice(0, 10) : <span className="italic text-[var(--text-muted)]">Not set</span>}
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {cust.cnic_front_path ? (
                      <a href={cust.cnic_front_path} target="_blank" rel="noreferrer" className="text-xs font-semibold px-2 py-1 rounded bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">CNIC F</a>
                    ) : <span className="text-slate-600 text-xs italic">No Front</span>}
                    {cust.cnic_back_path ? (
                      <a href={cust.cnic_back_path} target="_blank" rel="noreferrer" className="text-xs font-semibold px-2 py-1 rounded bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">CNIC B</a>
                    ) : null}
                    {cust.license_front_path ? (
                      <a href={cust.license_front_path} target="_blank" rel="noreferrer" className="text-xs font-semibold px-2 py-1 rounded bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20">Lic</a>
                    ) : null}
                    {Array.isArray(cust.extra_documents) && cust.extra_documents.map((doc, dIdx) => (
                      <a 
                        key={dIdx}
                        href={doc.file_path} 
                        target="_blank" 
                        rel="noreferrer" 
                        title={`${doc.title || "Document"}: ${doc.filename || "file"}`}
                        className="text-xs font-bold px-2 py-1 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1 hover:bg-indigo-500/20"
                      >
                        <FileText className="h-3 w-3" />
                        <span className="max-w-[70px] truncate">{doc.title ? doc.title.replace("Guarantor ", "G ") : "PDF"}</span>
                      </a>
                    ))}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button 
                      onClick={() => sendCustomerWhatsApp(cust)}
                      className="p-2 min-h-[44px] min-w-[44px] rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 flex items-center justify-center transition-colors"
                      title="Open WhatsApp chat with customer"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => openEdit(cust)}
                      className="p-2 min-h-[44px] min-w-[44px] rounded bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--accent-color)] hover:border-[var(--accent-color)] flex items-center justify-center"
                      title="Edit customer"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(cust.id)}
                      className="p-2 min-h-[44px] min-w-[44px] rounded bg-[var(--bg-app)] border border-[var(--border-color)] text-red-700 dark:text-red-400 hover:bg-red-500/10 flex items-center justify-center"
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

      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filtered.map(cust => (
          <div key={cust.id} className="glass-panel p-4 rounded-xl border border-[var(--border-color)] space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm text-[var(--text-main)]">{cust.full_name}</h4>
                <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{cust.cnic_number}</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => sendCustomerWhatsApp(cust)}
                  className="p-2 min-h-[44px] min-w-[44px] rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 flex items-center justify-center"
                  title="WhatsApp"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={() => openEdit(cust)}
                  className="p-2 min-h-[44px] min-w-[44px] rounded bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--accent-color)] flex items-center justify-center"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={() => handleDelete(cust.id)}
                  className="p-2 min-h-[44px] min-w-[44px] rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 flex items-center justify-center"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="text-xs space-y-1 font-semibold text-[var(--text-muted)]">
              <p><span className="text-[var(--text-muted)]">Contact:</span> <span className="text-[var(--text-main)]">{cust.phone_primary}</span></p>
              <p><span className="text-[var(--text-muted)]">License:</span> <span className="text-[var(--text-main)]">{cust.license_number}</span></p>
              <p><span className="text-[var(--text-muted)]">License Expiry:</span> <span className="text-[var(--text-main)]">{cust.license_expiry_date ? String(cust.license_expiry_date).slice(0, 10) : "Not set"}</span></p>
              {cust.guarantor_name && <p><span className="text-[var(--text-muted)]">Guarantor 1:</span> <span className="text-[var(--text-main)]">{cust.guarantor_name}{cust.guarantor_phone ? ` (${cust.guarantor_phone})` : ""}</span></p>}
              {cust.guarantor2_name && <p><span className="text-[var(--text-muted)]">Guarantor 2:</span> <span className="text-[var(--text-main)]">{cust.guarantor2_name}{cust.guarantor2_phone ? ` (${cust.guarantor2_phone})` : ""}</span></p>}
            </div>
            <div className="pt-2.5 border-t border-[var(--border-color)] flex flex-wrap gap-2">
              {cust.cnic_front_path && (
                <a href={cust.cnic_front_path} target="_blank" rel="noreferrer" className="text-xs text-teal-700 dark:text-teal-400 font-bold bg-teal-500/10 border border-teal-500/20 px-2.5 py-2 rounded min-h-[44px] flex items-center">CNIC F</a>
              )}
              {cust.cnic_back_path && (
                <a href={cust.cnic_back_path} target="_blank" rel="noreferrer" className="text-xs text-teal-655 font-bold bg-teal-500/10 border border-teal-500/20 px-2.5 py-2 rounded min-h-[44px] flex items-center">CNIC B</a>
              )}
              {cust.license_front_path && (
                <a href={cust.license_front_path} target="_blank" rel="noreferrer" className="text-xs text-teal-655 font-bold bg-teal-500/10 border border-teal-500/20 px-2.5 py-2 rounded min-h-[44px] flex items-center">License</a>
              )}
              {Array.isArray(cust.extra_documents) && cust.extra_documents.map((doc, dIdx) => (
                <a 
                  key={dIdx} 
                  href={doc.file_path} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-xs text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-2 rounded min-h-[44px] flex items-center gap-1"
                >
                  <FileText className="h-3 w-3" />
                  <span className="max-w-[80px] truncate">{doc.title ? doc.title.replace("Guarantor ", "G ") : "PDF"}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
              <h3 className="text-xl font-bold text-[var(--text-main)]">{editingCustomer ? "Edit Customer" : "Register Customer"}</h3>
              <button onClick={() => { setShowModal(false); setEditingCustomer(null); }} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {blacklistWarning && (
              <div className="p-4 rounded-xl border border-red-500 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200 animate-pulse flex items-start gap-3 pulse-border-red">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-900 dark:text-red-100">CRITICAL WARNING: Blacklisted Customer</h4>
                  <p className="text-xs mt-1 text-red-700 dark:text-red-300 font-semibold">CNIC is flagged for: {blacklistWarning}. Form input is locked.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Full Name *</label>
                <input 
                  type="text" required
                  disabled={!!blacklistWarning}
                  value={form.full_name}
                  onChange={(e) => setForm({...form, full_name: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">CNIC Number * (13 Digits)</label>
                  <input 
                    type="text" required
                    placeholder="3520112345678"
                    value={form.cnic_number}
                    onChange={handleCnicChange}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">License Number *</label>
                  <input 
                    type="text" required
                    value={form.license_number}
                    onChange={(e) => setForm({...form, license_number: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">License Expiry Date</label>
                <input 
                  type="date"
                  value={form.license_expiry_date}
                  onChange={(e) => setForm({...form, license_expiry_date: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Phone Primary *</label>
                  <input 
                    type="text" required
                    value={form.phone_primary}
                    onChange={(e) => setForm({...form, phone_primary: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Phone Secondary</label>
                  <input 
                    type="text"
                    value={form.phone_secondary}
                    onChange={(e) => setForm({...form, phone_secondary: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Home Address *</label>
                <textarea required
                  disabled={!!blacklistWarning}
                  value={form.home_address}
                  onChange={(e) => setForm({...form, home_address: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5 focus:outline-none h-16 disabled:opacity-50"
                />
              </div>

              {/* Cheque, Passport & Guarantee Section */}
              <div className="border-t border-[var(--border-color)] pt-3 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-teal-500">Cheque, Passport & Guarantee Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Security Cheque No</label>
                    <input type="text" placeholder="e.g. CHQ-009281" value={form.cheque_number} onChange={(e) => setForm({...form, cheque_number: e.target.value})} className="w-full app-input rounded-lg p-2 font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Passport Number</label>
                    <input type="text" placeholder="e.g. AB1234567" value={form.passport_number} onChange={(e) => setForm({...form, passport_number: e.target.value})} className="w-full app-input rounded-lg p-2 font-mono" />
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]/50 space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Guarantor 1</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Guarantor 1 Name</label>
                      <input type="text" placeholder="Full Name" value={form.guarantor_name} onChange={(e) => setForm({...form, guarantor_name: e.target.value})} className="w-full app-input rounded-lg p-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Guarantor 1 Phone</label>
                      <input type="text" placeholder="03001234567" value={form.guarantor_phone} onChange={(e) => setForm({...form, guarantor_phone: e.target.value})} className="w-full app-input rounded-lg p-2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Guarantor 1 CNIC</label>
                      <input type="text" placeholder="35201xxxxxxx" value={form.guarantor_cnic} onChange={(e) => setForm({...form, guarantor_cnic: e.target.value})} className="w-full app-input rounded-lg p-2 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Guarantor 1 Address</label>
                      <input type="text" placeholder="Address" value={form.guarantor_address} onChange={(e) => setForm({...form, guarantor_address: e.target.value})} className="w-full app-input rounded-lg p-2" />
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]/50 space-y-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Guarantor 2</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Guarantor 2 Name</label>
                      <input type="text" placeholder="Full Name" value={form.guarantor2_name} onChange={(e) => setForm({...form, guarantor2_name: e.target.value})} className="w-full app-input rounded-lg p-2" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Guarantor 2 Phone</label>
                      <input type="text" placeholder="03001234567" value={form.guarantor2_phone} onChange={(e) => setForm({...form, guarantor2_phone: e.target.value})} className="w-full app-input rounded-lg p-2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Guarantor 2 CNIC</label>
                      <input type="text" placeholder="35201xxxxxxx" value={form.guarantor2_cnic} onChange={(e) => setForm({...form, guarantor2_cnic: e.target.value})} className="w-full app-input rounded-lg p-2 font-mono" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Guarantor 2 Address</label>
                      <input type="text" placeholder="Address" value={form.guarantor2_address} onChange={(e) => setForm({...form, guarantor2_address: e.target.value})} className="w-full app-input rounded-lg p-2" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Guarantee Details / Collateral Notes</label>
                  <input type="text" placeholder="e.g. Blank Signed Cheque + Original Passport Held" value={form.guarantee_details} onChange={(e) => setForm({...form, guarantee_details: e.target.value})} className="w-full app-input rounded-lg p-2" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[var(--text-muted)]">Document Uploads {editingCustomer ? "(leave empty to keep existing)" : ""}</label>
                {editingCustomer && (
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {editingCustomer.cnic_front_path && <a href={editingCustomer.cnic_front_path} target="_blank" rel="noreferrer" className="text-[var(--accent-color)] underline">Current CNIC Front</a>}
                    {editingCustomer.cnic_back_path && <a href={editingCustomer.cnic_back_path} target="_blank" rel="noreferrer" className="text-[var(--accent-color)] underline">Current CNIC Back</a>}
                    {editingCustomer.license_front_path && <a href={editingCustomer.license_front_path} target="_blank" rel="noreferrer" className="text-[var(--accent-color)] underline">Current License</a>}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[var(--bg-app)] border border-[var(--border-color)] p-2 rounded-lg text-center">
                    <span className="text-[10px] text-[var(--text-muted)] block mb-1">CNIC Front</span>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setCnicFrontFile(e.target.files[0])} className="w-full text-xs text-[var(--text-main)]" />
                  </div>
                  <div className="bg-[var(--bg-app)] border border-[var(--border-color)] p-2 rounded-lg text-center">
                    <span className="text-[10px] text-[var(--text-muted)] block mb-1">CNIC Back</span>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setCnicBackFile(e.target.files[0])} className="w-full text-xs text-[var(--text-main)]" />
                  </div>
                  <div className="bg-[var(--bg-app)] border border-[var(--border-color)] p-2 rounded-lg text-center">
                    <span className="text-[10px] text-[var(--text-muted)] block mb-1">License Front</span>
                    <input type="file" accept="image/*,.pdf" onChange={(e) => setLicenseFrontFile(e.target.files[0])} className="w-full text-xs text-[var(--text-main)]" />
                  </div>
                </div>
              </div>

              {/* Extra Documents & Guarantor PDFs with Progress Bar Pill */}
              <div className="border-t border-[var(--border-color)] pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
                      Multi-PDF & Document Vault (Guarantors, Deeds, Cheques)
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Upload multiple PDF documents with verification status for guarantor CNICs, affidavits or stamp papers.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                    {extraDocsList.length} Attached
                  </span>
                </div>

                <div className="bg-[var(--bg-app)]/70 p-3 rounded-xl border border-[var(--border-color)] space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Document Preset / Type</label>
                      <select 
                        value={newDocPreset}
                        onChange={(e) => setNewDocPreset(e.target.value)}
                        className="w-full app-input rounded-lg p-2 text-xs"
                      >
                        <option value="Guarantor 1 CNIC / Document">Guarantor 1 CNIC / Document</option>
                        <option value="Guarantor 2 CNIC / Document">Guarantor 2 CNIC / Document</option>
                        <option value="Guarantor Affidavit / Undertaking">Guarantor Affidavit / Undertaking</option>
                        <option value="Stamp Paper / Lease Agreement">Stamp Paper / Lease Agreement</option>
                        <option value="Security Cheque Photo / Slip">Security Cheque Photo / Slip</option>
                        <option value="Utility Bill / Address Verification">Utility Bill / Address Verification</option>
                        <option value="Business Card / Employment Letter">Business Card / Employment Letter</option>
                        <option value="Additional KYC Document">Additional KYC Document</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Select File (PDF / Image)</label>
                      <input 
                        type="file" 
                        accept=".pdf,image/*" 
                        disabled={docUploadLoading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            handleAttachExtraDoc(f, newDocPreset);
                            e.target.value = "";
                          }
                        }}
                        className="w-full text-xs text-[var(--text-main)] file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {docUploadLoading && (
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-400">
                      <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                      <span>Uploading & verifying document checksum...</span>
                    </div>
                  )}

                  {/* List of attached extra documents with Progress/Verification bar */}
                  <div className="space-y-2 max-h-48 overflow-y-auto pt-1">
                    {extraDocsList.length === 0 ? (
                      <p className="text-[11px] italic text-[var(--text-muted)] text-center py-2">
                        No extra guarantor documents attached yet. Choose a preset above to attach.
                      </p>
                    ) : (
                      extraDocsList.map((doc, idx) => (
                        <div key={idx} className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl p-2.5 space-y-1.5 shadow-sm">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="p-1 rounded bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                                <FileText className="h-3.5 w-3.5 shrink-0" />
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-[var(--text-main)] block truncate">{doc.title}</span>
                                <span className="text-[10px] text-[var(--text-muted)] font-mono block truncate">{doc.filename || "file"}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <a 
                                href={doc.file_path} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:underline px-2 py-1 rounded bg-teal-500/10 border border-teal-500/20"
                              >
                                View
                              </a>
                              <button 
                                type="button" 
                                onClick={() => removeExtraDoc(idx)}
                                className="text-rose-500 hover:text-rose-400 p-1"
                                title="Remove document"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Progress bar pill for each extra PDF / Document */}
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[9px] font-bold">
                              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <Check className="h-2.5 w-2.5" /> Document Attached & Ready
                              </span>
                              <span className="font-mono text-emerald-700 dark:text-emerald-400">100% Verified</span>
                            </div>
                            <div className="w-full bg-slate-900/30 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full w-full" />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={!!blacklistWarning}
                className="w-full btn-accent text-white font-semibold py-3 rounded-lg mt-4 transition-all"
              >
                {editingCustomer ? "Save Changes" : "Create Account"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 4. BOOKINGS & TIMELINE COMPONENT
// ==========================================
function estimateBookingCharges(b) {
  if (!b) return { days: 0, rent: 0, chauffeur: 0, latePenalty: 0, carWash: 0, extraFuel: 0, damages: 0, total: 0 };
  const start = new Date(b.start_datetime);
  const end = new Date(b.expected_end_datetime);
  const rawDays = Math.max(1, Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)));
  const days = (b.billable_days !== null && b.billable_days !== undefined && Number(b.billable_days) > 0)
    ? Number(b.billable_days)
    : rawDays;
  const rent = days * (b.daily_rate || 0);
  const chauffeur = b.is_chauffeur_driven ? days * (b.chauffeur_daily_wage || 0) : 0;
  const latePenalty = b.late_penalty_charge || 0;
  const carWash = b.car_wash_charge || 0;
  const extraFuel = (b.booked_cars || []).reduce((s, c) => s + (c.extra_fuel_charge || 0), 0);
  const damages = (b.booked_cars || []).reduce((s, c) => s + (c.structural_damage_charge || 0), 0);
  const total = rent + chauffeur + latePenalty + carWash + extraFuel + damages;
  return { days, rent, chauffeur, latePenalty, carWash, extraFuel, damages, total, rawDays };
}

function generateRentalContract(booking, brandingName = "Rent A Car Management System") {
  if (!booking) return;
  const charges = estimateBookingCharges(booking);
  const doc = new jsPDF();
  const brand = brandingName || "Rent A Car Management System";

  doc.setFillColor(13, 148, 136);
  doc.rect(0, 0, 210, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(brand.toUpperCase(), 15, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("VEHICLE RENTAL AGREEMENT / LEASE CONTRACT", 15, 26);
  doc.text(`Contract #RMS-${booking.id}`, 150, 26);

  doc.setTextColor(30, 30, 30);
  let y = 48;
  const ensureSpace = (needed = 12) => {
    if (y + needed > 282) {
      doc.addPage();
      y = 20;
    }
  };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("1. PARTIES", 15, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Lessor: ${brand} (Lahore Hub)`, 15, y); y += 6;
  doc.text(`Lessee: ${booking.customer?.full_name || "N/A"}`, 15, y); y += 6;
  doc.text(`CNIC: ${booking.customer?.cnic_number || "N/A"}`, 15, y); y += 6;
  doc.text(`Phone: ${booking.customer?.phone_primary || "N/A"}`, 15, y); y += 6;
  doc.text(`Address: ${booking.customer?.home_address || "N/A"}`, 15, y); y += 6;
  doc.text(`License #: ${booking.customer?.license_number || "N/A"}`, 15, y); y += 6;
  if (booking.customer?.guarantor_name || booking.customer?.guarantor_cnic || booking.customer?.guarantor_phone) {
    ensureSpace(12);
    doc.text(
      `Guarantor 1: ${booking.customer?.guarantor_name || "N/A"}  |  CNIC: ${booking.customer?.guarantor_cnic || "N/A"}  |  Phone: ${booking.customer?.guarantor_phone || "N/A"}`,
      15, y, { maxWidth: 180 }
    );
    y += 6;
    if (booking.customer?.guarantor_address) {
      doc.text(`Guarantor 1 Address: ${booking.customer.guarantor_address}`, 15, y, { maxWidth: 180 });
      y += 6;
    }
  }
  if (booking.customer?.guarantor2_name || booking.customer?.guarantor2_cnic || booking.customer?.guarantor2_phone) {
    ensureSpace(12);
    doc.text(
      `Guarantor 2: ${booking.customer?.guarantor2_name || "N/A"}  |  CNIC: ${booking.customer?.guarantor2_cnic || "N/A"}  |  Phone: ${booking.customer?.guarantor2_phone || "N/A"}`,
      15, y, { maxWidth: 180 }
    );
    y += 6;
    if (booking.customer?.guarantor2_address) {
      doc.text(`Guarantor 2 Address: ${booking.customer.guarantor2_address}`, 15, y, { maxWidth: 180 });
      y += 6;
    }
  }
  y += 4;
  ensureSpace(24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("2. VEHICLE(S)", 15, y); y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (booking.booked_cars && booking.booked_cars.length > 0) {
    booking.booked_cars.forEach(bc => {
      ensureSpace(8);
      doc.text(`Make/Model: ${bc.car?.make_model || bc.make_model || "N/A"}  |  Plate: ${bc.car?.plate_number || bc.plate_number || "N/A"}  |  Color: ${bc.car?.color || "N/A"}`, 15, y);
      y += 6;
    });
    y += 4;
  } else {
    doc.text(`Make/Model: ${booking.car?.make_model || "N/A"}`, 15, y); y += 6;
    doc.text(`Plate: ${booking.car?.plate_number || "N/A"}  |  Color: ${booking.car?.color || "N/A"}  |  Year: ${booking.car?.model_year || "N/A"}`, 15, y); y += 10;
  }

  ensureSpace(24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("3. RENTAL PERIOD & CHARGES", 15, y); y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Start: ${new Date(booking.start_datetime).toLocaleString()}`, 15, y); y += 6;
  doc.text(`Expected Return: ${new Date(booking.expected_end_datetime).toLocaleString()}`, 15, y); y += 6;
  
  if (booking.booked_cars && booking.booked_cars.length > 0) {
    booking.booked_cars.forEach(bc => {
      ensureSpace(8);
      doc.text(`Rate [${bc.car?.make_model || bc.make_model} (${bc.car?.plate_number || bc.plate_number})]: PKR ${Number(bc.daily_rate || 0).toLocaleString()}/day`, 15, y);
      y += 6;
    });
    doc.text(`Total Daily Rate: PKR ${Number(booking.daily_rate || 0).toLocaleString()}  |  Days: ${charges.days}`, 15, y); y += 6;
  } else {
    doc.text(`Daily Rate: PKR ${Number(booking.daily_rate || 0).toLocaleString()}  |  Days: ${charges.days}`, 15, y); y += 6;
  }
  
  ensureSpace(24);
  doc.text(`Estimated Rent: PKR ${charges.rent.toLocaleString()}`, 15, y); y += 6;
  if (booking.is_chauffeur_driven) {
    doc.text(`Chauffeur Wage: PKR ${charges.chauffeur.toLocaleString()} (${booking.chauffeur_daily_wage}/day)`, 15, y); y += 6;
  }
  doc.text(`Estimated Total: PKR ${charges.total.toLocaleString()}`, 15, y); y += 6;
  doc.text(`Security Deposit: PKR ${Number(booking.security_deposit_amount || 0).toLocaleString()} (${booking.security_deposit_type}) — ${booking.security_deposit_status}`, 15, y); y += 10;

  ensureSpace(24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("4. TERMS & CONDITIONS", 15, y); y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const terms = [
    "Lessee shall return the vehicle in the same condition, subject to normal wear.",
    "Fuel must be returned at the agreed level; shortfall is chargeable.",
    "Late return beyond grace may incur overtime at 1.5x hourly rate.",
    "Lessee is liable for traffic challans, damage, and illegal use during the rental.",
    "Security deposit may be withheld against unpaid dues or damage.",
    "Vehicle shall not be used for racing, subletting, or illegal activity.",
    "This agreement is governed by applicable laws of Pakistan."
  ];
  terms.forEach((t, i) => {
    ensureSpace(8);
    doc.text(`${i + 1}. ${t}`, 15, y, { maxWidth: 180 });
    y += 7;
  });
  y += 8;

  ensureSpace(58);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("5. SIGNATURES", 15, y); y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.line(15, y, 90, y);
  doc.line(120, y, 195, y);
  y += 5;
  doc.text("Lessor / Company Stamp", 15, y);
  doc.text("Lessee Signature", 120, y);
  y += 16;
  doc.line(15, y, 90, y);
  doc.line(120, y, 195, y);
  y += 5;
  doc.text("Guarantor 1 Signature", 15, y);
  doc.text("Guarantor 2 Signature", 120, y);
  y += 8;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated ${new Date().toLocaleString()} — Status: ${booking.status}`, 15, y);

  doc.save(`Rental_Contract_PCS_${booking.id}.pdf`);
}

function BookingsView({ 
  bookings, cars, customers, search, setSearch, statusFilter, setStatusFilter, fetchData, 
  showModal, setShowModal, showReturnModal, setShowReturnModal, 
  selectedBooking, setSelectedBooking, checkCnicBlacklist, setErrorMessage,
  signatureCanvasRef, signatureImage, startDrawing, draw, stopDrawing, clearSignature, theme,
  setForm, form, branding = {}, financials = []
}) {
  if (!form) {
    console.error("BookingsView error: 'form' prop is missing or undefined");
    return (
      <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-500 rounded-xl text-red-800 dark:text-red-200 text-sm">
        <strong>Error:</strong> The booking form state is not initialized. Please refresh the page or contact support.
      </div>
    );
  }

  const [editingBookingId, setEditingBookingId] = useState(null);

  const openEditBooking = (b) => {
    setEditingBookingId(b.id);
    const startDt = b.start_datetime ? new Date(b.start_datetime).toISOString().slice(0, 16) : "";
    const endDt = b.expected_end_datetime ? new Date(b.expected_end_datetime).toISOString().slice(0, 16) : "";
    const bookedCars = (b.booked_cars && b.booked_cars.length > 0)
      ? b.booked_cars.map(bc => ({
          car_id: bc.car_id,
          make_model: bc.car?.make_model || bc.make_model || "Car",
          plate_number: bc.car?.plate_number || bc.plate_number || "",
          daily_rate: bc.daily_rate || 3000
        }))
      : [{
          car_id: b.car_id,
          make_model: b.car?.make_model || "Car",
          plate_number: b.car?.plate_number || "",
          daily_rate: b.daily_rate || 3000
        }];
    setForm({
      car_id: b.car_id,
      customer_id: b.customer_id,
      start_datetime: startDt,
      expected_end_datetime: endDt,
      daily_rate: b.daily_rate || 3000,
      is_chauffeur_driven: !!b.is_chauffeur_driven,
      chauffeur_daily_wage: b.chauffeur_daily_wage || 1500,
      security_deposit_amount: b.security_deposit_amount || 0,
      security_deposit_type: b.security_deposit_type || "Cash",
      security_deposit_status: b.security_deposit_status || "Held",
      booking_type: b.booking_type || "Individual",
      company_name: b.company_name || "",
      booked_cars: bookedCars,
      driver_type: b.driver_type || "Company Driver",
      driver_name: b.driver_name || "",
      driver_phone: b.driver_phone || "",
      driver_cnic: b.driver_cnic || "",
      billable_days: b.billable_days !== null && b.billable_days !== undefined ? b.billable_days : "",
      specific_days_notes: b.specific_days_notes || ""
    });
    setShowModal(true);
  };

  const [returnForm, setReturnForm] = useState({
    actual_return_datetime: "", return_odometer: 0, fuel_level: "Full",
    extra_fuel_charge: 0, structural_damage_charge: 0, notes: "",
    custom_late_penalty: "", late_penalty_waived: false, car_wash_charge: 0
  });

  const [customerLookupCnic, setCustomerLookupCnic] = useState("");
  const [customerFound, setCustomerFound] = useState(null);
  const [blacklistWarning, setBlacklistWarning] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [carQuery, setCarQuery] = useState("");
  const [companyCarQuery, setCompanyCarQuery] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showCarDropdown, setShowCarDropdown] = useState(false);
  const [showCompanyCarDropdown, setShowCompanyCarDropdown] = useState(false);

  useEffect(() => {
    if (showModal) {
      if (form.customer_id) {
        const cust = customers.find(c => c.id === parseInt(form.customer_id, 10));
        if (cust) {
          setCustomerFound(cust);
          setCustomerQuery(cust.full_name);
        }
      } else {
        setCustomerFound(null);
        setCustomerQuery("");
        setBlacklistWarning("");
      }

      if (form.car_id) {
        const car = cars.find(c => c.id === parseInt(form.car_id, 10));
        if (car) {
          setCarQuery(`${car.make_model} (${car.plate_number})`);
        }
      } else {
        setCarQuery("");
      }
    }
  }, [showModal, form.customer_id, form.car_id, customers, cars]);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [dayListBookings, setDayListBookings] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [ledgerPayments, setLedgerPayments] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: "",
    payment_method: "Cash",
    payment_datetime: new Date().toISOString().slice(0, 16)
  });

  const openPaymentLedger = async (booking) => {
    setSelectedBooking(booking);
    setShowPaymentModal(true);
    setPaymentForm({
      amount_paid: "",
      payment_method: "Cash",
      payment_datetime: new Date().toISOString().slice(0, 16)
    });
    try {
      const res = await fetch(`/api/bookings/${booking.id}/financials`);
      if (res.ok) {
        setLedgerPayments(await res.json());
      } else {
        setLedgerPayments((financials || []).filter(f => f.booking_id === booking.id));
      }
    } catch {
      setLedgerPayments((financials || []).filter(f => f.booking_id === booking.id));
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return;
    const amount = parseFloat(paymentForm.amount_paid);
    if (!amount || amount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }
    const charges = estimateBookingCharges(selectedBooking);
    const paidSoFar = ledgerPayments.reduce((s, f) => s + (f.amount_paid || 0), 0);
    const balanceDue = Math.max(0, charges.total - paidSoFar - amount);

    const res = await fetch("/api/financials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_id: selectedBooking.id,
        amount_paid: amount,
        payment_datetime: new Date(paymentForm.payment_datetime).toISOString(),
        payment_method: paymentForm.payment_method,
        balance_due: balanceDue
      })
    });

    if (res.ok) {
      const created = await res.json();
      setLedgerPayments(prev => [...prev, created]);
      setPaymentForm({
        amount_paid: "",
        payment_method: "Cash",
        payment_datetime: new Date().toISOString().slice(0, 16)
      });
      fetchData();
    } else {
      const data = await res.json();
      alert(data.detail || "Failed to record payment.");
    }
  };

  useEffect(() => {
    // Form state resets are now managed explicitly on trigger handlers, not via side-effect hooks.
  }, [showModal]);

  useEffect(() => {
    if (showReturnModal && selectedBooking) {
      const expectedEnd = new Date(selectedBooking.expected_end_datetime);
      const now = new Date();
      const autoHours = now > expectedEnd ? Math.round(((now - expectedEnd) / (1000 * 60 * 60)) * 10) / 10 : 0;
      const hourlyRate = (selectedBooking.daily_rate || 3000) / 24;
      const initialOvertimeFee = autoHours > 0 ? Math.round(autoHours * hourlyRate * 1.5) : 0;

      const initCars = (selectedBooking.booked_cars && selectedBooking.booked_cars.length > 0)
        ? selectedBooking.booked_cars.map(bc => ({
            car_id: bc.car_id,
            make_model: bc.car?.make_model || "Car",
            plate_number: bc.car?.plate_number || "",
            current_odometer: bc.car?.current_odometer || 0,
            return_odometer: bc.return_odometer || bc.car?.current_odometer || 0,
            fuel_level: bc.fuel_level_on_return || "Full",
            extra_fuel_charge: bc.extra_fuel_charge || 0,
            structural_damage_charge: bc.structural_damage_charge || 0,
            daily_rate: bc.daily_rate || 0,
            was_given_washed: bc.was_given_washed ?? true,
            is_returned_unwashed: false,
            car_wash_charge: 0
          }))
        : [{
            car_id: selectedBooking.car_id,
            make_model: selectedBooking.car?.make_model || "Car",
            plate_number: selectedBooking.car?.plate_number || "",
            current_odometer: selectedBooking.car?.current_odometer || 0,
            return_odometer: selectedBooking.car?.current_odometer || 0,
            fuel_level: "Full",
            extra_fuel_charge: 0,
            structural_damage_charge: 0,
            daily_rate: selectedBooking.daily_rate || 0,
            was_given_washed: true,
            is_returned_unwashed: false,
            car_wash_charge: 0
          }];

      setReturnForm({
        actual_return_datetime: new Date().toISOString().slice(0, 16),
        notes: "",
        custom_late_penalty: initialOvertimeFee > 0 ? String(initialOvertimeFee) : "",
        late_penalty_waived: false,
        car_wash_charge: 0,
        booked_cars: initCars
      });
    }
  }, [showReturnModal, selectedBooking]);

  const handleCnicLookup = async () => {
    const clean = customerLookupCnic.replace("-", "").trim();
    if (clean.length !== 13) {
      alert("Please enter exactly 13 digits CNIC");
      return;
    }
    
    // Check blacklist first (use return value — state may still be stale after await)
    const reason = await checkCnicBlacklist(clean, setBlacklistWarning);
    if (reason) return;

    try {
      const res = await fetch(`/api/customers/lookup/${clean}`);
      if (res.ok) {
        const cust = await res.json();
        setCustomerFound(cust);
        setForm({ ...form, customer_id: cust.id });
      } else {
        alert("No customer found with this CNIC. Please register them in Customers first.");
      }
    } catch {
      alert("Error looking up customer CNIC.");
    }
  };

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (blacklistWarning) {
      setErrorMessage(`CANNOT SUBMIT: customer is blacklisted. Reason: ${blacklistWarning}`);
      return;
    }
    if (!form.customer_id) {
      alert("Please select a customer first.");
      return;
    }

    if (!form.booked_cars || form.booked_cars.length === 0) {
      alert("Please select at least one car.");
      return;
    }
    if (form.booking_type === "Company" && !form.company_name) {
      alert("Please enter company name.");
      return;
    }

    const bookedCarsPayload = form.booked_cars.map(c => ({
      car_id: parseInt(c.car_id, 10),
      daily_rate: parseFloat(c.daily_rate) || 0
    }));

    const billableDaysVal = form.billable_days !== "" && form.billable_days !== null && form.billable_days !== undefined
      ? parseInt(form.billable_days, 10)
      : null;

    const payload = {
      ...form,
      car_id: bookedCarsPayload[0].car_id,
      customer_id: parseInt(form.customer_id, 10),
      daily_rate: bookedCarsPayload.reduce((s, c) => s + c.daily_rate, 0),
      security_deposit_amount: parseFloat(form.security_deposit_amount) || 0,
      chauffeur_daily_wage: parseFloat(form.chauffeur_daily_wage) || 0,
      booking_type: form.booking_type || "Individual",
      company_name: form.booking_type === "Company" ? form.company_name : null,
      booked_cars: bookedCarsPayload,
      driver_type: form.driver_type || "Company Driver",
      driver_name: form.driver_type === "Freelance Driver" ? form.driver_name : null,
      driver_phone: form.driver_type === "Freelance Driver" ? form.driver_phone : null,
      driver_cnic: form.driver_type === "Freelance Driver" ? form.driver_cnic : null,
      billable_days: billableDaysVal,
      specific_days_notes: form.specific_days_notes || ""
    };

    const endpoint = editingBookingId ? `/api/bookings/${editingBookingId}` : "/api/bookings";
    const method = editingBookingId ? "PUT" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      setShowModal(false);
      setEditingBookingId(null);
      fetchData();
    } else {
      const data = await res.json();
      setErrorMessage(data.detail || "Booking save failed.");
    }
  };

  const changeBookingStatus = async (id, newStatus) => {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      fetchData();
    } else {
      alert("Error changing booking status.");
    }
  };

  const calculateInvoice = () => {
    if (!selectedBooking) {
      return {
        baseDays: 0, baseFare: 0, driverWage: 0, lateHours: 0, autoLatePenalty: 0, latePenalty: 0,
        extraFuel: 0, damages: 0, carWashFee: 0, totalBill: 0, paidSoFar: 0, deposit: 0,
        remainingAfterPayments: 0, cashToCollect: 0, depositApplied: 0, balanceDue: 0,
      };
    }

    const start = new Date(selectedBooking.start_datetime);
    const expectedEnd = new Date(selectedBooking.expected_end_datetime);
    const actualEnd = new Date(returnForm.actual_return_datetime || new Date());

    const baseDiffTime = Math.abs(expectedEnd - start);
    const rawDays = Math.max(1, Math.ceil(baseDiffTime / (1000 * 60 * 60 * 24)));
    const baseDays = (selectedBooking.billable_days !== null && selectedBooking.billable_days !== undefined && Number(selectedBooking.billable_days) > 0)
      ? Number(selectedBooking.billable_days)
      : rawDays;
    const baseFare = baseDays * selectedBooking.daily_rate;

    let driverWage = 0;
    if (selectedBooking.is_chauffeur_driven) {
      driverWage = baseDays * selectedBooking.chauffeur_daily_wage;
    }

    let lateHours = 0;
    let autoLatePenalty = 0;
    if (actualEnd > expectedEnd) {
      const lateDiffTime = actualEnd - expectedEnd;
      lateHours = Math.round((lateDiffTime / (1000 * 60 * 60)) * 10) / 10; 
      const hourlyRate = selectedBooking.daily_rate / 24;
      autoLatePenalty = Math.round(lateHours * hourlyRate * 1.5);
    }

    let latePenalty = autoLatePenalty;
    if (returnForm.late_penalty_waived) {
      latePenalty = 0;
    } else if (returnForm.custom_late_penalty !== undefined && returnForm.custom_late_penalty !== "") {
      latePenalty = parseFloat(returnForm.custom_late_penalty) || 0;
    }

    const extraFuel = returnForm.booked_cars 
      ? returnForm.booked_cars.reduce((s, c) => s + (parseFloat(c.extra_fuel_charge) || 0), 0)
      : (parseFloat(returnForm.extra_fuel_charge) || 0);

    const damages = returnForm.booked_cars
      ? returnForm.booked_cars.reduce((s, c) => s + (parseFloat(c.structural_damage_charge) || 0), 0)
      : (parseFloat(returnForm.structural_damage_charge) || 0);

    const carWashFee = returnForm.booked_cars
      ? returnForm.booked_cars.reduce((s, c) => s + (parseFloat(c.car_wash_charge) || 0), 0)
      : (parseFloat(returnForm.car_wash_charge) || 0);

    const totalBill = baseFare + driverWage + latePenalty + extraFuel + damages + carWashFee;
    const deposit = selectedBooking.security_deposit_amount || 0;
    const paidSoFar = (financials || [])
      .filter(f => f.booking_id === selectedBooking.id)
      .reduce((s, f) => s + (f.amount_paid || 0), 0);
    const remainingAfterPayments = Math.max(0, totalBill - paidSoFar);
    const depositApplied = Math.min(deposit, remainingAfterPayments);
    const cashToCollect = Math.max(0, remainingAfterPayments - depositApplied);

    return {
      baseDays,
      baseFare,
      driverWage,
      lateHours,
      autoLatePenalty,
      latePenalty,
      carWashFee,
      extraFuel,
      damages,
      totalBill,
      paidSoFar,
      deposit,
      remainingAfterPayments,
      depositApplied,
      cashToCollect,
      // UI "balance due now" = cash still to collect at counter
      balanceDue: cashToCollect,
    };
  };

  const invoice = calculateInvoice();

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return;

    // Fresh ledger — avoid double-charge if a payment was just recorded
    let paidSoFar = 0;
    try {
      const ledgerRes = await fetch(`/api/bookings/${selectedBooking.id}/financials`);
      if (ledgerRes.ok) {
        const rows = await ledgerRes.json();
        paidSoFar = rows.reduce((s, f) => s + (Number(f.amount_paid) || 0), 0);
      } else {
        paidSoFar = invoice.paidSoFar;
      }
    } catch {
      paidSoFar = invoice.paidSoFar;
    }

    const totalBill = invoice.totalBill;
    const deposit = invoice.deposit;
    const remainingAfterPayments = Math.max(0, totalBill - paidSoFar);
    const depositApplied = Math.min(deposit, remainingAfterPayments);
    const cashToCollect = Math.max(0, remainingAfterPayments - depositApplied);
    const depositStatus = depositApplied > 0 ? "Withheld" : "Refunded";

    const res = await fetch(`/api/bookings/${selectedBooking.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "Completed",
        actual_return_datetime: returnForm.actual_return_datetime,
        security_deposit_status: depositStatus,
        late_penalty_charge: invoice.latePenalty,
        car_wash_charge: invoice.carWashFee,
        booked_cars: returnForm.booked_cars.map(c => ({
          car_id: c.car_id,
          daily_rate: c.daily_rate || 0, // maintain the actual daily rate
          start_odometer: c.current_odometer, // maintain
          return_odometer: parseInt(c.return_odometer, 10) || c.current_odometer || 0,
          fuel_level_on_start: "Full", // maintain
          fuel_level_on_return: c.fuel_level,
          extra_fuel_charge: parseFloat(c.extra_fuel_charge) || 0,
          structural_damage_charge: parseFloat(c.structural_damage_charge) || 0,
          car_wash_charge: parseFloat(c.car_wash_charge) || 0,
          overtime_charge: invoice.latePenalty,
          was_given_washed: c.was_given_washed ?? true,
          is_returned_unwashed: !!c.is_returned_unwashed
        }))
      })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.detail || "Error completing booking.");
      return;
    }

    for (const c of returnForm.booked_cars) {
      const odoRes = await fetch(`/api/cars/${c.car_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_odometer: parseInt(c.return_odometer, 10) || c.current_odometer || 0,
        })
      });
      if (!odoRes.ok) {
        alert(`Booking completed but odometer update failed for car ID ${c.car_id}.`);
      }
    }

    const postPayment = async (amount, method) => {
      if (amount <= 0) return true;
      const finRes = await fetch("/api/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: selectedBooking.id,
          amount_paid: amount,
          payment_datetime: new Date().toISOString(),
          payment_method: method,
          balance_due: 0
        })
      });
      if (!finRes.ok) {
        const data = await finRes.json().catch(() => ({}));
        alert(data.detail || `Booking completed but ${method} payment record failed.`);
        return false;
      }
      return true;
    };

    // Record cash collected + deposit applied so Gross Receipts / investor revenue stay accurate
    await postPayment(cashToCollect, "Cash");
    await postPayment(depositApplied, "Security Deposit Applied");

    setShowReturnModal(false);
    setSelectedBooking(null);
    fetchData();
  };

  const downloadPDFInvoice = () => {
    if (!selectedBooking) return;
    const doc = new jsPDF();
    
    // Theme Colors (Gold/Dark Gray)
    const primaryColor = [197, 155, 39]; // #c59b27
    const secondaryColor = [39, 39, 42]; // Zinc-800
    
    // Header Branding
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text((branding.name || "Rent A Car Management System").toUpperCase(), 15, 25);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("LAHORE HUB | EXECUTIVE LEASE AUDIT STATEMENT", 15, 32);
    
    // Bill To Customer Details
    doc.setTextColor(...secondaryColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("CUSTOMER LEASE DETAILS", 15, 55);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Customer Name: ${selectedBooking.customer?.full_name || "N/A"}`, 15, 63);
    doc.text(`CNIC Number: ${selectedBooking.customer?.cnic_number || "N/A"}`, 15, 69);
    doc.text(`Phone Primary: ${selectedBooking.customer?.phone_primary || "N/A"}`, 15, 75);
    
    // Booking / Vehicle Details
    doc.setFont("helvetica", "bold");
    doc.text("VEHICLE & RESERVATION", 120, 55);
    doc.setFont("helvetica", "normal");
    if (selectedBooking.booked_cars && selectedBooking.booked_cars.length > 0) {
      let carY = 63;
      selectedBooking.booked_cars.forEach((bc, idx) => {
        if (idx < 3) {
          doc.text(`${bc.car?.make_model || bc.make_model || "Car"} [${bc.car?.plate_number || bc.plate_number || ""}]`, 120, carY);
          carY += 6;
        }
      });
    } else {
      doc.text(`Model: ${selectedBooking.car?.make_model || "N/A"}`, 120, 63);
      doc.text(`Plate No: ${selectedBooking.car?.plate_number || "N/A"}`, 120, 69);
      doc.text(`Odometer: ${selectedBooking.car?.current_odometer || 0} km`, 120, 75);
    }
    
    // Divider
    doc.setDrawColor(228, 228, 231);
    doc.line(15, 82, 195, 82);
    
    // Table Header
    doc.setFillColor(244, 244, 245);
    doc.rect(15, 88, 180, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BILLABLE CHARGES / LEASE TRANSACTION", 18, 93);
    doc.text("COST (PKR)", 170, 93, { align: "right" });
    
    // Items
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    let y = 104;
    const items = [];
    if (selectedBooking.booked_cars && selectedBooking.booked_cars.length > 0) {
      selectedBooking.booked_cars.forEach(bc => {
        items.push({
          name: `Rental: ${bc.car?.make_model || bc.make_model || "Car"} (${bc.car?.plate_number || bc.plate_number || ""}) - ${invoice.baseDays} Days`,
          cost: (bc.daily_rate || 0) * invoice.baseDays
        });
      });
    } else {
      items.push({ name: `Base Rental Fare (${invoice.baseDays} Days)`, cost: invoice.baseFare });
    }
    
    items.push(
      { name: "Chauffeur Wages / Driver Allowances", cost: invoice.driverWage },
      { name: `Overtime Extra Money (${invoice.lateHours > 0 ? invoice.lateHours + ' Hours' : 'Overtime'})`, cost: invoice.latePenalty },
      { name: "Refueling / Fuel Shortage Surcharge", cost: invoice.extraFuel },
      { name: "Car Wash / Unwashed Vehicle Cleaning Charge", cost: invoice.carWashFee },
      { name: "Accident / Structural Damage Surcharges", cost: invoice.damages }
    );
    
    items.forEach((item, index) => {
      doc.text(item.name, 18, y);
      doc.text(`PKR ${item.cost.toLocaleString()}`, 170, y, { align: "right" });
      y += 8;
    });
    
    // Divider
    doc.line(15, y + 2, 195, y + 2);
    y += 10;
    
    // Total / Summary
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL ESTIMATED BILL", 18, y);
    doc.text(`PKR ${invoice.totalBill.toLocaleString()}`, 170, y, { align: "right" });
    
    y += 8;
    doc.text("SECURITY DEPOSIT APPLIED (CREDIT)", 18, y);
    doc.text(`- PKR ${selectedBooking.security_deposit_amount?.toLocaleString() || 0}`, 170, y, { align: "right" });
    
    y += 8;
    doc.setFillColor(...primaryColor);
    doc.rect(15, y - 5, 180, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.text("NET BALANCE OUTSTANDING", 18, y);
    doc.text(`PKR ${invoice.balanceDue.toLocaleString()}`, 170, y, { align: "right" });
    
    // Footer message / Disclaimer
    doc.setTextColor(...secondaryColor);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("This is a computer generated invoice statement issued on behalf of Omnysync Lahore.", 15, 280);
    
    doc.save(`Invoice_PCS_${selectedBooking.id}.pdf`);
  };

  const printReceipt = () => {
    downloadPDFInvoice();
  };

  const sendWhatsApp = () => {
    const name = selectedBooking?.customer?.full_name || "Customer";
    const plate = selectedBooking?.booked_cars && selectedBooking?.booked_cars.length > 0
      ? selectedBooking.booked_cars.map(bc => bc.car?.plate_number || bc.plate_number).filter(Boolean).join(", ")
      : selectedBooking?.car?.plate_number || "N/A";
    const phoneRaw = selectedBooking?.customer?.phone_primary || "";
    const text = `Dear ${name}, here are your rental details for vehicle(s) ${plate}:\n` +
                 `- Total Days: ${invoice.baseDays}\n` +
                 `- Base Rent: PKR ${invoice.baseFare}\n` +
                 (invoice.latePenalty > 0 ? `- Overtime Extra Charge (${invoice.lateHours > 0 ? invoice.lateHours + 'h' : 'Late'}): PKR ${invoice.latePenalty}\n` : "") +
                 (invoice.carWashFee > 0 ? `- Car Wash / Cleaning Charge: PKR ${invoice.carWashFee}\n` : "") +
                 (invoice.extraFuel > 0 ? `- Fuel Refill Surcharge: PKR ${invoice.extraFuel}\n` : "") +
                 (invoice.damages > 0 ? `- Damage Penalty: PKR ${invoice.damages}\n` : "") +
                 `- Total Bill: PKR ${invoice.totalBill}\n` +
                 `- Balance Due: PKR ${invoice.balanceDue}\n` +
                 `Thank you for choosing Rent A Car Management System!`;
    const phone = phoneRaw.replace(/[^0-9]/g, "");
    if (!phone) {
      alert("Customer has no phone number on file.");
      return;
    }
    const cleanPhone = phone.startsWith("0") ? "92" + phone.substring(1) : phone;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const filteredBookings = (bookings || []).filter(b => {
    const custName = b.customer?.full_name || "";
    const carPlate = b.car?.plate_number || "";
    const matchesSearch = custName.toLowerCase().includes((search || "").toLowerCase()) ||
                          carPlate.toLowerCase().includes((search || "").toLowerCase());
    const matchesStatus = statusFilter === "All" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Bookings & Scheduler</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Timeline visualizer and invoice generator.</p>
        </div>
        <ShimmerButton 
          onClick={() => {
            setEditingBookingId(null);
            setForm({
              car_id: "",
              customer_id: "",
              start_datetime: "",
              expected_end_datetime: "",
              daily_rate: 3000,
              is_chauffeur_driven: false,
              chauffeur_daily_wage: 1500,
              security_deposit_amount: 10000,
              security_deposit_type: "Cash",
              security_deposit_status: "Held",
              booking_type: "Individual",
              company_name: "",
              booked_cars: [],
              driver_type: "Company Driver",
              driver_name: "",
              driver_phone: "",
              driver_cnic: "",
              billable_days: "",
              specific_days_notes: ""
            });
            setShowModal(true);
          }}
          className="page-cta"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Create Reservation</span>
        </ShimmerButton>
      </div>

      {/* Bookings Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
          <input 
            type="text" 
            placeholder="Filter bookings by Customer Name or Plate..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full app-input rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {["All", "Active", "Reserved", "Completed", "Cancelled"].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all min-h-[44px] ${
                statusFilter === st 
                  ? "btn-accent text-white font-bold" 
                  : "bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List Table */}
      <div className="hidden md:block glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/20 border-b border-[var(--border-color)] text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
              <th className="p-4">Customer</th>
              <th className="p-4">Car (Plate)</th>
              <th className="p-4">Booking Period</th>
              <th className="p-4">Daily Rate & Driver</th>
              <th className="p-4">Payment Ledger / Dues</th>
              <th className="p-4">Deposit</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions / Check-in</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 text-sm">
            {filteredBookings.map(b => (
              <tr key={b.id} className="hover:bg-[var(--tr-hover)] transition-colors">
                <td className="p-4 font-bold text-[var(--text-main)]">
                  <div>{b.customer?.full_name}</div>
                  {b.booking_type === "Company" && (
                    <span className="text-[10px] text-indigo-500 font-bold block">Corp: {b.company_name}</span>
                  )}
                </td>
                <td className="p-4">
                  <span className="font-bold text-[var(--text-main)] block">{b.car?.make_model}</span>
                  <span className="text-xs text-teal-700 dark:text-teal-400 font-mono">{b.car?.plate_number}</span>
                </td>
                <td className="p-4">
                  <div className="text-xs">
                    <span>S: {new Date(b.start_datetime).toLocaleDateString()}</span>
                    <span className="block text-[var(--text-muted)]">E: {new Date(b.expected_end_datetime).toLocaleDateString()}</span>
                    {b.billable_days ? (
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold block mt-0.5">
                        {b.billable_days} billable days {b.specific_days_notes ? `(${b.specific_days_notes})` : ""}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="p-4 text-xs">
                  <div className="font-bold text-[var(--text-main)]">PKR {b.daily_rate.toLocaleString()}/d</div>
                  {b.is_chauffeur_driven ? (
                    <div className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold mt-0.5">
                      {b.driver_type === "Freelance Driver" 
                        ? `Freelance: ${b.driver_name || "Driver"} (PKR ${b.chauffeur_daily_wage}/d)`
                        : `Staff Driver (PKR ${b.chauffeur_daily_wage}/d)`}
                    </div>
                  ) : (
                    <span className="text-[10px] text-[var(--text-muted)] italic">Self Driven</span>
                  )}
                </td>
                <td className="p-4">
                  {(() => {
                    const charges = estimateBookingCharges(b);
                    const paid = (financials || []).filter(f => f.booking_id === b.id).reduce((s, f) => s + (f.amount_paid || 0), 0);
                    const remaining = Math.max(0, charges.total - paid);
                    return (
                      <div className="text-xs space-y-0.5 min-w-[130px]">
                        <div className="flex justify-between gap-1 text-[11px]">
                          <span className="text-[var(--text-muted)]">Total:</span>
                          <span className="font-mono font-bold text-[var(--text-main)]">PKR {charges.total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-1 text-[11px]">
                          <span className="text-[var(--text-muted)]">Advance:</span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">PKR {paid.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between gap-1 text-[11px] pt-0.5 border-t border-[var(--border-color)]">
                          <span className="text-[var(--text-muted)] font-semibold">Remaining:</span>
                          <span className={`font-mono font-bold ${remaining > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                            PKR {remaining.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </td>
                <td className="p-4">
                  <span className="block text-xs font-mono">PKR {b.security_deposit_amount}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">({b.security_deposit_type})</span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    b.status === "Active" ? "bg-teal-500/10 text-teal-700 dark:text-teal-400" : 
                    b.status === "Reserved" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                    b.status === "Completed" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                    "bg-red-500/10 text-red-700 dark:text-red-400"
                  }`}>
                    {b.status}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => openEditBooking(b)}
                    className="bg-[var(--bg-app)] hover:border-[var(--accent-color)] text-[var(--accent-color)] px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-color)] min-h-[44px] inline-flex items-center justify-center"
                    title="Edit Reservation"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => generateRentalContract(b, branding?.name)}
                    className="bg-[var(--bg-app)] hover:border-[var(--accent-color)] text-[var(--text-main)] px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-color)] min-h-[44px]"
                    title="Rental contract PDF"
                  >
                    <FileText className="h-3.5 w-3.5 inline" />
                  </button>
                  <button
                    onClick={() => openPaymentLedger(b)}
                    className="bg-[var(--bg-app)] hover:border-[var(--accent-color)] text-[var(--text-main)] px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-color)] min-h-[44px]"
                    title="Payment ledger"
                  >
                    <Wallet className="h-3.5 w-3.5 inline" />
                  </button>
                  {b.status === "Active" && (
                    <button 
                      onClick={() => { setSelectedBooking(b); setShowReturnModal(true); }}
                      className="bg-teal-600/15 hover:bg-teal-600 hover:text-white text-teal-700 dark:text-teal-400 px-3 py-1.5 rounded-lg text-xs font-semibold border border-teal-500/20 min-h-[44px]"
                    >
                      Receive Return
                    </button>
                  )}
                  {b.status === "Completed" && (
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setSelectedBooking(b);
                        setTimeout(() => {
                          const doc = new jsPDF();
                          doc.setFillColor(197, 155, 39);
                          doc.rect(0, 0, 210, 40, "F");
                          doc.setTextColor(255, 255, 255);
                          doc.setFont("helvetica", "bold");
                          doc.setFontSize(20);
                          doc.text((branding.name || "Rent A Car Management System").toUpperCase(), 15, 22);
                          doc.setFontSize(9);
                          doc.setFont("helvetica", "normal");
                          doc.text(`INVOICE STATEMENT #RMS-${b.id} | COMPLETED AUDIT`, 15, 30);
                          doc.setTextColor(39, 39, 42);
                          doc.setFont("helvetica", "bold");
                          doc.text("CUSTOMER LEASE DETAILS", 15, 55);
                          doc.setFont("helvetica", "normal");
                          doc.text(`Customer Name: ${b.customer?.full_name || "N/A"}`, 15, 63);
                          doc.text(`CNIC Number: ${b.customer?.cnic_number || "N/A"}`, 15, 69);
                          doc.text(`Phone Primary: ${b.customer?.phone_primary || "N/A"}`, 15, 75);
                          doc.setFont("helvetica", "bold");
                          doc.text("VEHICLE & RESERVATION", 120, 55);
                          doc.setFont("helvetica", "normal");
                          if (b.booked_cars && b.booked_cars.length > 0) {
                            let carY = 63;
                            b.booked_cars.forEach((bc, idx) => {
                              if (idx < 3) {
                                doc.text(`${bc.car?.make_model || bc.make_model || "Car"} [${bc.car?.plate_number || bc.plate_number || ""}]`, 120, carY);
                                carY += 6;
                              }
                            });
                          } else {
                            doc.text(`Model: ${b.car?.make_model || "N/A"}`, 120, 63);
                            doc.text(`Plate No: ${b.car?.plate_number || "N/A"}`, 120, 69);
                            doc.text(`Daily Rate: PKR ${b.daily_rate.toLocaleString()}`, 120, 75);
                          }
                          doc.setDrawColor(228, 228, 231);
                          doc.line(15, 82, 195, 82);
                          doc.setFillColor(244, 244, 245);
                          doc.rect(15, 88, 180, 8, "F");
                          doc.setFont("helvetica", "bold");
                          doc.text("LEASE PERIOD DETAILS", 18, 93);
                          doc.text("SCHEDULE", 170, 93, { align: "right" });
                          doc.setFont("helvetica", "normal");
                          doc.text(`Start Datetime: ${new Date(b.start_datetime).toLocaleString()}`, 18, 103);
                          doc.text(`Return Datetime: ${new Date(b.actual_return_datetime || b.expected_end_datetime).toLocaleString()}`, 18, 109);
                          doc.setFont("helvetica", "bold");
                          doc.text(`Total Bill Settled: PKR ${sumPaidForBooking(financials, b.id).toLocaleString()}`, 18, 125);
                          doc.text("PAYMENT RECEIVED", 170, 125, { align: "right" });
                          doc.setTextColor(197, 155, 39);
                          doc.setFont("helvetica", "italic");
                          doc.setFontSize(8);
                          doc.text("This transaction has been successfully closed and paid in full.", 15, 280);
                          doc.save(`Invoice_PCS_${b.id}.pdf`);
                        }, 100);
                      }}
                      className="min-h-[44px]"
                    >
                      <Download className="h-3 w-3 mr-1" /> PDF Invoice
                    </Button>
                  )}
                  {(b.status === "Active" || b.status === "Reserved") && (
                    <select 
                      onChange={(e) => changeBookingStatus(b.id, e.target.value)}
                      value={b.status}
                      className="bg-[var(--bg-app)] border border-[var(--border-color)] text-xs rounded p-1 text-[var(--text-muted)] min-h-[44px]"
                    >
                      <option value="Reserved">Reserved</option>
                      <option value="Active">Active</option>
                      <option value="Cancelled">Cancel</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bookings Mobile Card Layout */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredBookings.map(b => (
          <div key={b.id} className="glass-panel p-4 rounded-xl border border-[var(--border-color)] space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-[var(--text-main)] truncate">{b.customer?.full_name}</h4>
                <p className="text-xs font-bold text-teal-700 dark:text-teal-400 truncate">{b.car?.make_model} ({b.car?.plate_number})</p>
                {b.booking_type === "Company" && (
                  <span className="text-[10px] text-indigo-500 font-bold block">Corp: {b.company_name}</span>
                )}
              </div>
              <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                b.status === "Active" ? "bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20" : 
                b.status === "Reserved" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" :
                b.status === "Completed" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" :
                "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
              }`}>
                {b.status}
              </span>
            </div>

            <div className="text-xs space-y-1 text-[var(--text-muted)]">
              <p>Period: <span className="text-[var(--text-main)] font-semibold">{new Date(b.start_datetime).toLocaleDateString()} to {new Date(b.expected_end_datetime).toLocaleDateString()}</span></p>
              {b.billable_days ? (
                <p className="text-teal-600 dark:text-teal-400 font-bold text-[11px]">
                  Billable Days: {b.billable_days} {b.specific_days_notes ? `(${b.specific_days_notes})` : ""}
                </p>
              ) : null}
              <p>Daily Rate: <span className="text-[var(--text-main)] font-semibold">PKR {b.daily_rate.toLocaleString()}</span></p>
              <p>Driver: <span className="text-[var(--text-main)] font-semibold">
                {b.is_chauffeur_driven 
                  ? (b.driver_type === "Freelance Driver" ? `Freelance: ${b.driver_name || "Driver"} (PKR ${b.chauffeur_daily_wage}/d)` : `Company Staff (PKR ${b.chauffeur_daily_wage}/d)`)
                  : "Self Driven"}
              </span></p>
              <p>Deposit: <span className="text-[var(--text-main)] font-semibold">PKR {b.security_deposit_amount} ({b.security_deposit_type})</span></p>
            </div>

            {/* Outside Payment Ledger Display */}
            {(() => {
              const charges = estimateBookingCharges(b);
              const paid = (financials || []).filter(f => f.booking_id === b.id).reduce((s, f) => s + (f.amount_paid || 0), 0);
              const remaining = Math.max(0, charges.total - paid);
              return (
                <div className="p-2.5 rounded-lg bg-[var(--bg-app)] border border-[var(--border-color)] text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)] text-[11px]">Est. Total Rent:</span>
                    <span className="font-mono font-bold text-[var(--text-main)]">PKR {charges.total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)] text-[11px]">Advance / Paid:</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">PKR {paid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-[var(--border-color)]">
                    <span className="text-[var(--text-muted)] text-[11px] font-bold">Remaining Balance:</span>
                    <span className={`font-mono font-bold ${remaining > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                      PKR {remaining.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="pt-3 border-t border-[var(--border-color)] flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setSelectedBooking(b); setShowDetailModal(true); }}
                className="flex-1 min-w-[30%] bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] font-semibold py-2 rounded-lg text-xs min-h-[44px]"
              >
                Details
              </button>
              <button
                type="button"
                onClick={() => openEditBooking(b)}
                className="min-h-[44px] min-w-[44px] px-3 bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--accent-color)] rounded-lg flex items-center justify-center"
                title="Edit Booking"
              >
                <Edit2 className="h-4 w-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => generateRentalContract(b, branding?.name)}
                className="min-h-[44px] min-w-[44px] px-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg"
                title="Contract PDF"
              >
                <FileText className="h-4 w-4 mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => openPaymentLedger(b)}
                className="min-h-[44px] min-w-[44px] px-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg"
                title="Payments"
              >
                <Wallet className="h-4 w-4 mx-auto" />
              </button>
              {(b.status === "Active" || b.status === "Reserved") && (
                <>
                  {b.status === "Active" && (
                    <button 
                      onClick={() => { setSelectedBooking(b); setShowReturnModal(true); }}
                      className="flex-1 min-w-[45%] bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 rounded-lg text-xs min-h-[44px]"
                    >
                      Receive Return
                    </button>
                  )}
                  <select 
                    onChange={(e) => changeBookingStatus(b.id, e.target.value)}
                    value={b.status}
                    className="flex-1 min-w-[40%] bg-[var(--bg-app)] border border-[var(--border-color)] text-xs rounded-lg px-2 text-[var(--text-muted)] min-h-[44px]"
                  >
                    <option value="Reserved">Reserved</option>
                    <option value="Active">Active</option>
                    <option value="Cancelled">Cancel</option>
                  </select>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Month Grid Calendar View (Moved Below) */}
      <CalendarGridSection 
        bookings={bookings} 
        cars={cars}
        customers={customers}
        setShowModal={setShowModal} 
        setForm={setForm}
        onBookingClick={(b) => {
          setSelectedBooking(b);
          setShowDetailModal(true);
        }}
        onDayOverflow={(list) => setDayListBookings(list)}
      />

      {/* Visual Timeline scheduler representation (Moved Below) */}
      <Card className="shadow-lg border-[var(--border-color)]">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[var(--border-color)] p-4 sm:p-6">
          <div className="min-w-0">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-[var(--text-main)]">
              <Calendar className="h-5 w-5 text-[var(--accent-color)] shrink-0" /> Active Fleet Allocations & Timeline
            </CardTitle>
            <CardDescription className="text-xs text-[var(--text-muted)] mt-0.5">Real-time calendar visualizer for active passenger allocations.</CardDescription>
          </div>
          <Badge variant="outline" className="self-start text-[10px] py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-bold">
            Live Scheduler Status
          </Badge>
        </CardHeader>
        
        <CardContent className="p-3 sm:p-6 space-y-4">
          {cars.map(car => {
            const carBookings = bookings
              .filter(b => b.car_id === car.id && (b.status === "Active" || b.status === "Reserved"))
              .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
            const activeBooking = carBookings.find(b => b.status === "Active") || carBookings[0];
            
            return (
              <div key={car.id} className="grid grid-cols-1 lg:grid-cols-12 items-center gap-4 bg-[var(--tr-hover)] hover:bg-[var(--border-color)]/25 p-4 rounded-2xl border border-[var(--border-color)] transition-all duration-300">
                
                {/* Vehicle Details */}
                <div className="lg:col-span-3 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-color)] shadow-inner">
                    <Car className="h-5 w-5 text-[var(--accent-color)]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-main)] leading-tight">{car.make_model}</p>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase mt-0.5 block">{car.plate_number}</span>
                  </div>
                </div>
                
                {/* Timeline Bar representation */}
                <div className="lg:col-span-7 h-10 bg-slate-950/20 border border-[var(--border-color)] rounded-xl relative overflow-hidden flex items-center px-4">
                  {activeBooking ? (
                    (() => {
                      const start = new Date(activeBooking.start_datetime);
                      const expectedEnd = new Date(activeBooking.expected_end_datetime);
                      const now = new Date();
                      
                      const totalDur = Math.max(1, expectedEnd - start);
                      const elapsed = Math.max(0, Math.min(totalDur, now - start));
                      const progressPct = Math.min(100, Math.round((elapsed / totalDur) * 100));

                      return (
                        <div className="w-full h-full flex items-center justify-between relative z-10 text-xs">
                          {/* Progress Line Bar overlay */}
                          <div 
                            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-600/20 to-emerald-500/10 border-r border-emerald-500/30 transition-all duration-500" 
                            style={{ width: `${progressPct}%` }}
                          />
                          <div className="flex items-center gap-2 z-10 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                            <span className="font-extrabold text-[var(--text-main)] truncate max-w-[90px] sm:max-w-[150px]">
                              {activeBooking.customer?.full_name || "Active Client"}
                            </span>
                          </div>
                          <span className="font-mono text-[9px] sm:text-[10px] text-emerald-700 dark:text-emerald-400 font-bold z-10 bg-emerald-500/10 border border-emerald-500/20 px-1.5 sm:px-2 py-0.5 rounded shrink-0">
                            {expectedEnd.toLocaleDateString()}
                          </span>
                        </div>
                      );
                    })()
                  ) : (
                    <span className="text-xs text-[var(--text-muted)] italic font-medium flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> No active allocation (Idle)
                    </span>
                  )}
                </div>

                {/* Status Badges */}
                <div className="lg:col-span-2 flex justify-end">
                  <Badge 
                    variant={car.status === "Available" ? "success" : car.status === "Maintenance" ? "warning" : "default"}
                    className="font-bold py-1 px-3 text-[10px]"
                  >
                    {car.status}
                  </Badge>
                </div>

              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Day overflow list (+N More) */}
      {dayListBookings && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50">
          <div className="glass-panel modal-sheet w-full max-w-sm rounded-2xl p-5 shadow-2xl border border-[var(--border-color)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-[var(--text-main)]">Bookings this day</h3>
              <button onClick={() => setDayListBookings(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {dayListBookings.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setDayListBookings(null);
                    setSelectedBooking(b);
                    setShowDetailModal(true);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] hover:border-[var(--accent-color)] transition-colors"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-sm font-bold text-[var(--text-main)]">{b.customer?.full_name || "Client"}</p>
                      <p className="text-xs text-[var(--text-muted)]">{b.car?.make_model} ({b.car?.plate_number})</p>
                    </div>
                    <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      b.status === "Reserved" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    }`}>{b.status}</span>
                  </div>
                </button>
              ))}
            </div>
           </div>
        </div>
      )}

      {/* Booking detail (from calendar chip click) */}
      {showDetailModal && selectedBooking && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 border border-[var(--border-color)]">
            <div className="flex justify-between items-start pb-4 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-main)]">Booking #{selectedBooking.id}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                    selectedBooking.status === "Active" ? "bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20" :
                    selectedBooking.status === "Reserved" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" :
                    selectedBooking.status === "Completed" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" :
                    "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                  }`}>
                    {selectedBooking.status}
                  </span>
                  {selectedBooking.booking_type === "Company" && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                      Company: {selectedBooking.company_name}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setShowDetailModal(false); setSelectedBooking(null); }}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Customer</p>
                  <p className="font-bold text-[var(--text-main)]">{selectedBooking.customer?.full_name || "—"}</p>
                  <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">{selectedBooking.customer?.cnic_number}</p>
                  <p className="text-xs text-[var(--text-muted)]">{selectedBooking.customer?.phone_primary}</p>
                  {selectedBooking.customer?.guarantor_name && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">G1: {selectedBooking.customer.guarantor_name}{selectedBooking.customer.guarantor_phone ? ` (${selectedBooking.customer.guarantor_phone})` : ""}</p>
                  )}
                  {selectedBooking.customer?.guarantor2_name && (
                    <p className="text-[10px] text-[var(--text-muted)]">G2: {selectedBooking.customer.guarantor2_name}{selectedBooking.customer.guarantor2_phone ? ` (${selectedBooking.customer.guarantor2_phone})` : ""}</p>
                  )}
                </div>
                <div className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl p-3">
                  <p className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">
                    {selectedBooking.booking_type === "Company" ? "Corporate Fleet" : "Vehicle"}
                  </p>
                  {selectedBooking.booked_cars && selectedBooking.booked_cars.length > 0 ? (
                    <div className="space-y-1.5 max-h-24 overflow-y-auto">
                      {selectedBooking.booked_cars.map(bc => (
                        <div key={bc.id || bc.car_id} className="text-xs border-b border-[var(--border-color)] pb-1 last:border-b-0 last:pb-0">
                          <p className="font-bold text-[var(--text-main)]">{bc.car?.make_model || "Car"}</p>
                          <p className="text-[10px] text-teal-700 dark:text-teal-400 font-mono">{bc.car?.plate_number} · PKR {bc.daily_rate?.toLocaleString()}/d</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <p className="font-bold text-[var(--text-main)]">{selectedBooking.car?.make_model || "—"}</p>
                      <p className="text-xs text-teal-700 dark:text-teal-400 font-mono mt-0.5">{selectedBooking.car?.plate_number}</p>
                      <p className="text-xs text-[var(--text-muted)]">{selectedBooking.car?.status}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Start</span>
                  <span className="font-semibold text-[var(--text-main)]">{new Date(selectedBooking.start_datetime).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Expected return</span>
                  <span className="font-semibold text-[var(--text-main)]">{new Date(selectedBooking.expected_end_datetime).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Daily rate</span>
                  <span className="font-semibold text-[var(--text-main)]">PKR {selectedBooking.daily_rate?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Driver / Chauffeur</span>
                  <span className="font-semibold text-[var(--text-main)]">
                    {selectedBooking.is_chauffeur_driven 
                      ? (selectedBooking.driver_type === "Freelance Driver"
                          ? `Freelance: ${selectedBooking.driver_name || "Driver"}${selectedBooking.driver_phone ? ` (${selectedBooking.driver_phone})` : ""} · PKR ${selectedBooking.chauffeur_daily_wage}/d`
                          : `Staff Driver (PKR ${selectedBooking.chauffeur_daily_wage}/d)`)
                      : "Self Driven"}
                  </span>
                </div>
                {selectedBooking.billable_days ? (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Billable Schedule</span>
                    <span className="font-semibold text-teal-600 dark:text-teal-400">
                      {selectedBooking.billable_days} Billable Days {selectedBooking.specific_days_notes ? `(${selectedBooking.specific_days_notes})` : ""}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Deposit</span>
                  <span className="font-semibold text-[var(--text-main)]">
                    PKR {selectedBooking.security_deposit_amount?.toLocaleString()} ({selectedBooking.security_deposit_type}) — {selectedBooking.security_deposit_status}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-color)]">
              <button
                onClick={() => {
                  const b = selectedBooking;
                  setShowDetailModal(false);
                  openEditBooking(b);
                }}
                className="flex-1 bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-[var(--accent-color)] text-[var(--accent-color)] font-semibold py-2 rounded-lg text-xs min-h-[44px] flex items-center justify-center gap-1"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit Booking
              </button>
              <button
                onClick={() => generateRentalContract(selectedBooking, branding?.name)}
                className="flex-1 bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-[var(--accent-color)] text-[var(--text-main)] font-semibold py-2 rounded-lg text-xs min-h-[44px] flex items-center justify-center gap-1"
              >
                <FileText className="h-3.5 w-3.5" /> Contract PDF
              </button>
              <button
                onClick={() => { setShowDetailModal(false); openPaymentLedger(selectedBooking); }}
                className="flex-1 bg-[var(--bg-app)] border border-[var(--border-color)] hover:border-[var(--accent-color)] text-[var(--text-main)] font-semibold py-2 rounded-lg text-xs min-h-[44px] flex items-center justify-center gap-1"
              >
                <Wallet className="h-3.5 w-3.5" /> Payments
              </button>
              {(selectedBooking.status === "Active" || selectedBooking.status === "Reserved") && (
                <select
                  onChange={async (e) => {
                    await changeBookingStatus(selectedBooking.id, e.target.value);
                    setShowDetailModal(false);
                    setSelectedBooking(null);
                  }}
                  value={selectedBooking.status}
                  className="flex-1 bg-[var(--bg-app)] border border-[var(--border-color)] text-xs rounded-lg px-2 text-[var(--text-muted)] min-h-[44px]"
                >
                  <option value="Reserved">Reserved</option>
                  <option value="Active">Active</option>
                  <option value="Cancelled">Cancel</option>
                </select>
              )}
              {selectedBooking.status === "Active" && (
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowReturnModal(true);
                  }}
                  className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 rounded-lg text-xs min-h-[44px]"
                >
                  Receive Return
                </button>
              )}
              <button
                onClick={() => { setShowDetailModal(false); setSelectedBooking(null); }}
                className="flex-1 bg-[var(--bg-app)] border border-[var(--border-color)] text-[var(--text-main)] font-semibold py-2 rounded-lg text-xs min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment ledger modal */}
      {showPaymentModal && selectedBooking && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-main)]">Payment Ledger</h3>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Booking #{selectedBooking.id} — {selectedBooking.customer?.full_name} / {selectedBooking.car?.plate_number}
                </p>
              </div>
              <button onClick={() => { setShowPaymentModal(false); }} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {(() => {
              const charges = estimateBookingCharges(selectedBooking);
              const paid = ledgerPayments.reduce((s, f) => s + (f.amount_paid || 0), 0);
              const remaining = Math.max(0, charges.total - paid);
              return (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl p-3">
                    <p className="text-[var(--text-muted)] font-bold uppercase text-[9px]">Est. Total</p>
                    <p className="font-mono font-bold text-[var(--text-main)] mt-1">PKR {charges.total.toLocaleString()}</p>
                    <p className="text-[9px] text-[var(--text-muted)] mt-0.5">{charges.days}d rent{charges.chauffeur ? " + driver" : ""}</p>
                  </div>
                  <div className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl p-3">
                    <p className="text-[var(--text-muted)] font-bold uppercase text-[9px]">Paid</p>
                    <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-1">PKR {paid.toLocaleString()}</p>
                  </div>
                  <div className="bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl p-3">
                    <p className="text-[var(--text-muted)] font-bold uppercase text-[9px]">Balance Due</p>
                    <p className={`font-mono font-bold mt-1 ${remaining > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>PKR {remaining.toLocaleString()}</p>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-2 max-h-48 overflow-y-auto">
              <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Receipt History</p>
              {ledgerPayments.length === 0 ? (
                <p className="text-xs italic text-[var(--text-muted)] text-center py-6">No payments recorded yet.</p>
              ) : (
                ledgerPayments.map(f => (
                  <div key={f.id} className="flex justify-between items-center bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-3 text-xs">
                    <div>
                      <p className="font-bold text-[var(--text-main)]">PKR {Number(f.amount_paid).toLocaleString()}</p>
                      <p className="text-[var(--text-muted)]">{f.payment_method} · {new Date(f.payment_datetime).toLocaleString()}</p>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">bal {Number(f.balance_due).toLocaleString()}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddPayment} className="space-y-3 border-t border-[var(--border-color)] pt-4">
              <p className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Record Payment / Advance</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Amount (PKR)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="1"
                    value={paymentForm.amount_paid}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                    className="w-full app-input rounded-lg p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                    className="w-full app-input rounded-lg p-2.5 text-xs"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="EasyPaisa/JazzCash">EasyPaisa/JazzCash</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">When</label>
                  <input
                    type="datetime-local"
                    required
                    value={paymentForm.payment_datetime}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_datetime: e.target.value })}
                    className="w-full app-input rounded-lg p-2.5 text-xs"
                  />
                </div>
              </div>
              <button type="submit" className="w-full btn-accent text-white font-semibold py-3 rounded-lg text-sm">
                Add Payment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {showModal && form && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-6 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
              <h3 className="text-xl font-bold text-[var(--text-main)]">{editingBookingId ? `Edit Booking #${editingBookingId}` : "Create Booking"}</h3>
              <button onClick={() => { setShowModal(false); setEditingBookingId(null); }} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Booking Type Selector */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Booking Type *</label>
                <select
                  value={form.booking_type || "Individual"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm(prev => ({
                      ...prev,
                      booking_type: val,
                      company_name: val === "Individual" ? "" : (prev.company_name || "")
                    }));
                  }}
                  className="w-full app-input rounded-lg p-2.5 focus:outline-none font-semibold"
                >
                  <option value="Individual">Individual Rental</option>
                  <option value="Company">Corporate / Company Rental</option>
                </select>
              </div>
              
              {form.booking_type === "Company" && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Google Pakistan"
                    value={form.company_name || ""}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none font-semibold"
                  />
                </div>
              )}
            </div>

            {/* Customer Searchable Autocomplete Selector */}
            <div className="space-y-2 text-xs relative">
              <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Search Customer (by Name or CNIC) *</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Type name or CNIC to search..."
                  value={customerQuery}
                  onChange={(e) => {
                    setCustomerQuery(e.target.value);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  className="w-full app-input rounded-lg p-2.5 focus:outline-none pr-8 font-semibold"
                />
                {form.customer_id && (
                  <button 
                    type="button" 
                    onClick={() => {
                      setForm(prev => ({ ...prev, customer_id: "" }));
                      setCustomerFound(null);
                      setBlacklistWarning("");
                      setCustomerQuery("");
                    }}
                    className="absolute right-2 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {showCustomerDropdown && (
                <div 
                  onMouseLeave={() => setShowCustomerDropdown(false)}
                  className="absolute z-50 w-full max-h-48 overflow-y-auto bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg shadow-lg mt-1 divide-y divide-[var(--border-color)]"
                >
                  {(() => {
                    const filtered = customers.filter(c => 
                      c.full_name.toLowerCase().includes(customerQuery.toLowerCase()) ||
                      c.cnic_number.includes(customerQuery.replace("-", "").trim())
                    );
                    if (filtered.length === 0) {
                      return <div className="p-2.5 text-xs text-[var(--text-muted)] italic">No customers found</div>;
                    }
                    return filtered.map(cust => (
                      <button
                        key={cust.id}
                        type="button"
                        onClick={async () => {
                          setCustomerFound(cust);
                          setForm(prev => ({ ...prev, customer_id: cust.id }));
                          setCustomerQuery(cust.full_name);
                          setShowCustomerDropdown(false);
                          await checkCnicBlacklist(cust.cnic_number, setBlacklistWarning);
                        }}
                        className="w-full text-left p-2.5 hover:bg-[var(--tr-hover)] text-xs text-[var(--text-main)] block font-semibold transition-colors"
                      >
                        {cust.full_name} ({cust.cnic_number})
                      </button>
                    ));
                  })()}
                </div>
              )}

              {blacklistWarning && (
                <div className="p-3 rounded-lg border border-red-500 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200 animate-pulse">
                  CRITICAL: CUSTOMER BLACKLISTED! Reason: {blacklistWarning}. Booking blocks automatically.
                </div>
              )}

              {customerFound && !blacklistWarning && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 rounded-lg">
                  Selected customer: <strong>{customerFound.full_name}</strong> ({customerFound.phone_primary})
                </div>
              )}
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-4 text-xs">
              <div className="space-y-3 border-t border-[var(--border-color)] pt-3 relative">
                <p className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">Multi-Car Selection & Rates</p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Search & Add Car *</label>
                    <input 
                      type="text" 
                      placeholder="Type Model or Plate..."
                      value={companyCarQuery}
                      onChange={(e) => {
                        setCompanyCarQuery(e.target.value);
                        setShowCompanyCarDropdown(true);
                      }}
                      onFocus={() => setShowCompanyCarDropdown(true)}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none pr-8 font-semibold"
                    />
                    
                    {showCompanyCarDropdown && (
                      <div 
                        onMouseLeave={() => setShowCompanyCarDropdown(false)}
                        className="absolute z-50 w-full max-h-48 overflow-y-auto bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg shadow-lg mt-1 divide-y divide-[var(--border-color)]"
                      >
                        {(() => {
                          const filtered = cars.filter(car => 
                            car.make_model.toLowerCase().includes(companyCarQuery.toLowerCase()) ||
                            car.plate_number.toLowerCase().includes(companyCarQuery.toLowerCase())
                          );
                          if (filtered.length === 0) {
                            return <div className="p-2.5 text-xs text-[var(--text-muted)] italic">No cars found</div>;
                          }
                          return filtered.map(car => {
                            const alreadyAdded = (form.booked_cars || []).some(c => c.car_id === car.id);
                            return (
                              <button
                                key={car.id}
                                type="button"
                                disabled={alreadyAdded}
                                onClick={() => {
                                  setForm(prev => ({
                                    ...prev,
                                    booked_cars: [
                                      ...(prev.booked_cars || []),
                                      {
                                        car_id: car.id,
                                        make_model: car.make_model,
                                        plate_number: car.plate_number,
                                        daily_rate: 3000
                                      }
                                    ]
                                  }));
                                  setCompanyCarQuery("");
                                  setShowCompanyCarDropdown(false);
                                }}
                                className={`w-full text-left p-2.5 hover:bg-[var(--tr-hover)] text-xs text-[var(--text-main)] block font-semibold transition-colors ${
                                  alreadyAdded ? "opacity-40 cursor-not-allowed" : ""
                                }`}
                              >
                                {car.make_model} ({car.plate_number}) {alreadyAdded ? "(Added)" : ""}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Total Agreed Flat Rate Override (PKR/day)</label>
                    <input 
                      type="number" 
                      placeholder="Distribute rate equally..."
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (val > 0 && form.booked_cars?.length > 0) {
                          const divided = Math.round((val / form.booked_cars.length) * 100) / 100;
                          setForm(prev => ({
                            ...prev,
                            booked_cars: prev.booked_cars.map(c => ({ ...c, daily_rate: divided }))
                          }));
                        }
                      }}
                      className="w-full app-input rounded-lg p-2.5"
                    />
                  </div>
                </div>

                {/* Selected Cars List */}
                <div className="space-y-2 max-h-36 overflow-y-auto border border-[var(--border-color)] rounded-xl p-3 bg-[var(--tr-hover)]">
                  {!form.booked_cars || form.booked_cars.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic text-center py-4">No cars added to this booking yet.</p>
                  ) : (
                    form.booked_cars.map((item) => (
                      <div key={item.car_id} className="flex items-center justify-between gap-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-lg p-2">
                        <div className="flex-1">
                          <span className="font-bold text-[var(--text-main)]">{item.make_model}</span>
                          <span className="text-[10px] text-[var(--text-muted)] block font-mono">{item.plate_number}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-[9px] uppercase font-bold text-[var(--text-muted)]">Rate:</label>
                          <input 
                            type="number"
                            required
                            value={item.daily_rate}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setForm(prev => ({
                                ...prev,
                                booked_cars: prev.booked_cars.map(c => c.car_id === item.car_id ? { ...c, daily_rate: val } : c)
                              }));
                            }}
                            className="w-20 app-input text-right rounded p-1 text-xs focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setForm(prev => ({
                                ...prev,
                                booked_cars: prev.booked_cars.filter(c => c.car_id !== item.car_id)
                              }));
                            }}
                            className="text-rose-500 hover:text-rose-400 p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {form.booked_cars?.length > 0 && (
                  <div className="flex justify-between items-center text-xs font-bold text-[var(--text-main)] px-1">
                    <span>Total Cars selected: {form.booked_cars.length}</span>
                    <span>Total Daily Rate: PKR {form.booked_cars.reduce((s, c) => s + c.daily_rate, 0).toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Start Datetime *</label>
                  <input 
                    type="datetime-local" required
                    value={form.start_datetime}
                    onChange={(e) => setForm({...form, start_datetime: e.target.value})}
                    onKeyDown={(e) => e.preventDefault()}
                    onClick={(e) => e.target.showPicker()}
                    onFocus={(e) => e.target.showPicker()}
                    className="w-full app-input rounded-lg p-2.5 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Expected Return Datetime *</label>
                  <input 
                    type="datetime-local" required
                    value={form.expected_end_datetime}
                    onChange={(e) => setForm({...form, expected_end_datetime: e.target.value})}
                    onKeyDown={(e) => e.preventDefault()}
                    onClick={(e) => e.target.showPicker()}
                    onFocus={(e) => e.target.showPicker()}
                    className="w-full app-input rounded-lg p-2.5 cursor-pointer"
                  />
                </div>
              </div>

              {/* Specific Billable Days Option */}
              <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]/50 space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-main)] block">Specific Days Billing / Exclude Days</label>
                    <span className="text-[10px] text-[var(--text-muted)]">Optionally set exact billable days (e.g. exclude Sundays or non-working days)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.billable_days !== "" && form.billable_days !== null && form.billable_days !== undefined}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const start = new Date(form.start_datetime || new Date());
                        const end = new Date(form.expected_end_datetime || new Date());
                        const days = Math.max(1, Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)));
                        setForm({ ...form, billable_days: days, specific_days_notes: "Excluding Sundays" });
                      } else {
                        setForm({ ...form, billable_days: "", specific_days_notes: "" });
                      }
                    }}
                    className="h-4 w-4 rounded bg-transparent text-teal-650"
                  />
                </div>

                {form.billable_days !== "" && form.billable_days !== null && form.billable_days !== undefined && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-color)]">
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Custom Billable Days *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={form.billable_days}
                        onChange={(e) => setForm({ ...form, billable_days: e.target.value })}
                        className="w-full app-input rounded-lg p-2 text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Schedule Notes</label>
                      <input
                        type="text"
                        placeholder="e.g. Excludes 2 Sundays"
                        value={form.specific_days_notes || ""}
                        onChange={(e) => setForm({ ...form, specific_days_notes: e.target.value })}
                        className="w-full app-input rounded-lg p-2 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {branding.feature_flags?.includes("chauffeur_module") && (
                <div className="border-t border-[var(--border-color)] pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-[var(--text-main)]">Driver Driven Rental?</label>
                    <input 
                      type="checkbox"
                      checked={form.is_chauffeur_driven}
                      onChange={(e) => setForm({...form, is_chauffeur_driven: e.target.checked})}
                      className="h-4 w-4 rounded bg-transparent text-teal-650"
                    />
                  </div>
                  
                  {form.is_chauffeur_driven && (
                    <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)]/50 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Driver Option</label>
                        <select
                          value={form.driver_type || "Company Driver"}
                          onChange={(e) => setForm({ ...form, driver_type: e.target.value })}
                          className="w-full app-input rounded-lg p-2 text-xs font-semibold"
                        >
                          <option value="Company Driver">Company Driver (Own Staff)</option>
                          <option value="Freelance Driver">Freelance / External Driver</option>
                        </select>
                      </div>

                      {form.driver_type === "Freelance Driver" && (
                        <div className="space-y-2 border-t border-[var(--border-color)] pt-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">Freelance Driver Particulars</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Freelance Driver Name *</label>
                              <input
                                type="text"
                                placeholder="Full Name"
                                value={form.driver_name || ""}
                                onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
                                className="w-full app-input rounded-lg p-2 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Freelance Driver Phone</label>
                              <input
                                type="text"
                                placeholder="03001234567"
                                value={form.driver_phone || ""}
                                onChange={(e) => setForm({ ...form, driver_phone: e.target.value })}
                                className="w-full app-input rounded-lg p-2 text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Freelance Driver CNIC</label>
                            <input
                              type="text"
                              placeholder="35201xxxxxxx"
                              value={form.driver_cnic || ""}
                              onChange={(e) => setForm({ ...form, driver_cnic: e.target.value })}
                              className="w-full app-input rounded-lg p-2 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
                          {form.driver_type === "Freelance Driver" ? "Freelance Daily Wage / Rate (PKR)" : "Driver Daily Wage / Allowance (PKR)"}
                        </label>
                        <input 
                          type="number"
                          value={form.chauffeur_daily_wage}
                          onChange={(e) => setForm({...form, chauffeur_daily_wage: parseFloat(e.target.value) || 0})}
                          className="w-full app-input rounded-lg p-2.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 border-t border-[var(--border-color)] pt-4">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Deposit Amt (PKR)</label>
                  <input 
                    type="number"
                    value={form.security_deposit_amount}
                    onChange={(e) => setForm({...form, security_deposit_amount: parseFloat(e.target.value) || 0})}
                    className="w-full app-input rounded-lg p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Deposit Type</label>
                  <select 
                    value={form.security_deposit_type}
                    onChange={(e) => setForm({...form, security_deposit_type: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 text-xs focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Token/Item">Token/Item</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1">Deposit Status</label>
                  <select 
                    value={form.security_deposit_status}
                    onChange={(e) => setForm({...form, security_deposit_status: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 text-xs focus:outline-none"
                  >
                    <option value="Held">Held</option>
                    <option value="Refunded">Refunded</option>
                    <option value="Withheld">Withheld</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit"
                disabled={!!blacklistWarning}
                className="w-full btn-accent text-white font-semibold py-3 rounded-lg mt-4 transition-all"
              >
                {editingBookingId ? "Save Booking Changes" : "Book Rental Package"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Return Checkout & Print Modal */}
      {showReturnModal && selectedBooking && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-6 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
              <h3 className="text-xl font-bold text-[var(--text-main)]">Car Return Checkout & Billing</h3>
              <button onClick={() => { setSelectedBooking(null); setShowReturnModal(false); }} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Return Form Details */}
              <form onSubmit={handleReturnSubmit} className="space-y-4 text-xs">
                <h4 className="font-bold text-teal-700 dark:text-teal-400 border-b border-[var(--border-color)] pb-2">Return Particulars</h4>
                
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Actual Return Datetime</label>
                  <input 
                    type="datetime-local" required
                    value={returnForm.actual_return_datetime}
                    onChange={(e) => setReturnForm({...returnForm, actual_return_datetime: e.target.value})}
                    onKeyDown={(e) => e.preventDefault()}
                    onClick={(e) => e.target.showPicker()}
                    onFocus={(e) => e.target.showPicker()}
                    className="w-full app-input rounded-lg p-2.5 cursor-pointer"
                  />
                </div>

                {/* Overtime / Late Return Extra Money Card */}
                <div className={`p-3 rounded-xl border transition-all ${invoice.lateHours > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-[var(--bg-app)] border-[var(--border-color)]'} space-y-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold text-xs text-[var(--text-main)]">Overtime / Late Return Extra Money</span>
                    </div>
                    {invoice.lateHours > 0 ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                        {invoice.lateHours}h Overdue
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        On Time
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-muted)]">PKR</span>
                        <input 
                          type="number"
                          placeholder={invoice.autoLatePenalty > 0 ? `Auto: ${invoice.autoLatePenalty}` : "0"}
                          value={returnForm.late_penalty_waived ? "0" : (returnForm.custom_late_penalty ?? "")}
                          onChange={(e) => {
                            setReturnForm(prev => ({
                              ...prev,
                              custom_late_penalty: e.target.value,
                              late_penalty_waived: false
                            }));
                          }}
                          disabled={returnForm.late_penalty_waived}
                          className="w-full app-input rounded pl-10 pr-2 py-1.5 text-xs font-semibold"
                        />
                      </div>
                    </div>
                    {invoice.autoLatePenalty > 0 && (
                      <button 
                        type="button"
                        onClick={() => {
                          setReturnForm(prev => ({
                            ...prev,
                            custom_late_penalty: String(invoice.autoLatePenalty),
                            late_penalty_waived: false
                          }));
                        }}
                        className="px-2.5 py-1.5 text-[10px] font-semibold rounded bg-amber-600 hover:bg-amber-500 text-white transition-all whitespace-nowrap"
                        title="Reset to standard 1.5x formula"
                      >
                        Auto (1.5x)
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => {
                        setReturnForm(prev => ({
                          ...prev,
                          late_penalty_waived: !prev.late_penalty_waived,
                          custom_late_penalty: !prev.late_penalty_waived ? "0" : ""
                        }));
                      }}
                      className={`px-2.5 py-1.5 text-[10px] font-semibold rounded transition-all whitespace-nowrap ${returnForm.late_penalty_waived ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-[var(--text-muted)] hover:text-[var(--text-main)]'}`}
                    >
                      {returnForm.late_penalty_waived ? "Waived" : "Waive (0)"}
                    </button>
                  </div>
                  {invoice.lateHours > 0 && !returnForm.late_penalty_waived && (
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Suggested standard fee: {invoice.lateHours}h × ({selectedBooking.daily_rate}/24) × 1.5 = PKR {invoice.autoLatePenalty.toLocaleString()}.
                    </p>
                  )}
                </div>

                <div className="space-y-4 max-h-[350px] overflow-y-auto border border-[var(--border-color)] rounded-xl p-3 bg-[var(--tr-hover)]">
                  {returnForm.booked_cars && returnForm.booked_cars.map((c, index) => (
                    <div key={c.car_id} className="p-3 bg-[var(--bg-app)] border border-[var(--border-color)] rounded-xl space-y-3">
                      <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-1.5">
                        <span className="font-bold text-[var(--text-main)] text-xs">{c.make_model}</span>
                        <span className="text-[10px] font-mono text-teal-700 dark:text-teal-400">{c.plate_number}</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <label className="block font-semibold text-[var(--text-muted)] mb-1">Return Odometer (km)</label>
                          <input 
                            type="number" required
                            value={c.return_odometer}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setReturnForm(prev => ({
                                ...prev,
                                booked_cars: prev.booked_cars.map((x, idx) => idx === index ? { ...x, return_odometer: val } : x)
                              }));
                            }}
                            className="w-full app-input rounded p-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[var(--text-muted)] mb-1">Fuel Level Check</label>
                          <select 
                            value={c.fuel_level}
                            onChange={(e) => {
                              const val = e.target.value;
                              setReturnForm(prev => ({
                                ...prev,
                                booked_cars: prev.booked_cars.map((x, idx) => idx === index ? { ...x, fuel_level: val } : x)
                              }));
                            }}
                            className="w-full app-input rounded p-1.5 focus:outline-none text-xs"
                          >
                            <option value="Full">Full</option>
                            <option value="Half">Half</option>
                            <option value="Quarter">Quarter</option>
                            <option value="Empty">Empty</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div>
                          <label className="block font-semibold text-[var(--text-muted)] mb-1">Extra Fuel Surcharge (PKR)</label>
                          <input 
                            type="number"
                            value={c.extra_fuel_charge}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setReturnForm(prev => ({
                                ...prev,
                                booked_cars: prev.booked_cars.map((x, idx) => idx === index ? { ...x, extra_fuel_charge: val } : x)
                              }));
                            }}
                            className="w-full app-input rounded p-1.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-[var(--text-muted)] mb-1">Damage Penalty (PKR)</label>
                          <input 
                            type="number"
                            value={c.structural_damage_charge}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setReturnForm(prev => ({
                                ...prev,
                                booked_cars: prev.booked_cars.map((x, idx) => idx === index ? { ...x, structural_damage_charge: val } : x)
                              }));
                            }}
                            className="w-full app-input rounded p-1.5 text-xs"
                          />
                        </div>
                      </div>

                      {/* Car Wash / Unwashed Condition Section */}
                      <div className="pt-2 border-t border-[var(--border-color)] space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-semibold text-[var(--text-main)]">
                            <input 
                              type="checkbox"
                              checked={!!c.is_returned_unwashed}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setReturnForm(prev => ({
                                  ...prev,
                                  booked_cars: prev.booked_cars.map((x, idx) => 
                                    idx === index ? { 
                                      ...x, 
                                      is_returned_unwashed: checked,
                                      car_wash_charge: checked ? (x.car_wash_charge > 0 ? x.car_wash_charge : 1000) : 0 
                                    } : x
                                  )
                                }));
                              }}
                              className="rounded border-[var(--border-color)] text-teal-600 focus:ring-teal-500 h-3.5 w-3.5"
                            />
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-3.5 w-3.5 text-cyan-500" />
                              Returned Unwashed / Dirty
                            </span>
                          </label>
                          <label className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={c.was_given_washed ?? true}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setReturnForm(prev => ({
                                  ...prev,
                                  booked_cars: prev.booked_cars.map((x, idx) => 
                                    idx === index ? { ...x, was_given_washed: val } : x
                                  )
                                }));
                              }}
                              className="rounded border-[var(--border-color)] text-teal-600 h-3 w-3"
                            />
                            Given Washed
                          </label>
                        </div>

                        {c.is_returned_unwashed && (
                          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold text-[var(--text-muted)]">Wash / Cleaning Penalty:</span>
                              <div className="relative flex-1 max-w-[130px]">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-[var(--text-muted)]">PKR</span>
                                <input 
                                  type="number"
                                  value={c.car_wash_charge || 0}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setReturnForm(prev => ({
                                      ...prev,
                                      booked_cars: prev.booked_cars.map((x, idx) => idx === index ? { ...x, car_wash_charge: val } : x)
                                    }));
                                  }}
                                  className="w-full app-input rounded pl-8 pr-2 py-1 text-xs text-right font-bold"
                                />
                              </div>
                            </div>
                            <div className="flex gap-1.5 flex-wrap items-center">
                              <span className="text-[9px] text-[var(--text-muted)]">Presets:</span>
                              <button 
                                type="button"
                                onClick={() => {
                                  setReturnForm(prev => ({
                                    ...prev,
                                    booked_cars: prev.booked_cars.map((x, idx) => idx === index ? { ...x, car_wash_charge: 800 } : x)
                                  }));
                                }}
                                className="px-2 py-0.5 text-[9px] font-semibold rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                              >
                                Basic (800)
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  setReturnForm(prev => ({
                                    ...prev,
                                    booked_cars: prev.booked_cars.map((x, idx) => idx === index ? { ...x, car_wash_charge: 1500 } : x)
                                  }));
                                }}
                                className="px-2 py-0.5 text-[9px] font-semibold rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                              >
                                Full Wash (1,500)
                              </button>
                              <button 
                                type="button"
                                onClick={() => {
                                  setReturnForm(prev => ({
                                    ...prev,
                                    booked_cars: prev.booked_cars.map((x, idx) => idx === index ? { ...x, car_wash_charge: 2500 } : x)
                                  }));
                                }}
                                className="px-2 py-0.5 text-[9px] font-semibold rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                              >
                                Mud / Detail (2,500)
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* E-Signature HTML5 Canvas */}
                <div className="border-t border-[var(--border-color)] pt-3">
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1 flex items-center gap-1">
                    <PenTool className="h-3 w-3" /> Customer Lease Signature
                  </label>
                  <canvas 
                    ref={signatureCanvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="sig-canvas w-full bg-white border border-slate-350 rounded-lg cursor-crosshair"
                    width={400}
                    height={100}
                  />
                  <div className="flex justify-between mt-1 text-[10px]">
                    <span className="text-[var(--text-muted)]">Sign with finger or stylus.</span>
                    <button type="button" onClick={clearSignature} className="text-teal-700 dark:text-teal-400 hover:underline">Clear Signature</button>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg mt-4 transition-all"
                >
                  Record Return & Complete Invoice
                </button>
              </form>

              {/* Invoice Viewer and Printable Area */}
              <div className="return-invoice-pane flex flex-col justify-between md:border-l border-[var(--border-color)] md:pl-6 space-y-4">
                <h4 className="font-bold text-teal-700 dark:text-teal-400 border-b border-[var(--border-color)] pb-2 flex justify-between items-center gap-2">
                  <span className="truncate">Billing Statement Preview</span>
                  <div className="space-x-1">
                    <button onClick={printReceipt} className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded text-white" title="Print">
                      <FileText className="h-4 w-4" />
                    </button>
                    <button onClick={sendWhatsApp} className="bg-emerald-600 hover:bg-emerald-550 p-1.5 rounded text-white" title="Send WhatsApp">
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </h4>

                {/* PRINT TEMPLATE WRAPPER */}
                <div id="invoice-printable-area" className="bg-slate-950 p-4 border border-slate-800 rounded-xl space-y-4 text-slate-300 font-mono text-xs">
                  <div className="text-center border-b border-slate-800 pb-3">
                    <h2 className="text-lg font-bold text-white">{(branding.name || "Rent A Car Management System").toUpperCase()}</h2>
                    <p className="text-[10px] text-slate-500 font-mono">Ferozepur Road, Lahore, Pakistan</p>
                    <p className="text-[10px] text-slate-500 font-mono">Invoice Date: {new Date().toLocaleDateString()}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-slate-500 block">Customer:</span>
                      <strong className="text-white">{selectedBooking.customer.full_name}</strong>
                      <span className="block">{selectedBooking.customer.cnic_number}</span>
                      <span className="block">{selectedBooking.customer.phone_primary}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Vehicle(s):</span>
                      {selectedBooking.booked_cars && selectedBooking.booked_cars.length > 0 ? (
                        selectedBooking.booked_cars.map(bc => (
                          <div key={bc.id || bc.car_id} className="mt-1">
                            <strong className="text-white">{bc.car?.make_model || bc.make_model || "Car"}</strong>
                            <span className="block font-bold">Plate: {bc.car?.plate_number || bc.plate_number}</span>
                          </div>
                        ))
                      ) : (
                        <>
                          <strong className="text-white">{selectedBooking.car?.make_model || "N/A"}</strong>
                          <span className="block font-bold">Plate: {selectedBooking.car?.plate_number || "N/A"}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    {selectedBooking.booked_cars && selectedBooking.booked_cars.length > 0 ? (
                      selectedBooking.booked_cars.map(bc => (
                        <div key={bc.id || bc.car_id} className="flex justify-between">
                          <span>Rental: {bc.car?.make_model || bc.make_model} ({bc.car?.plate_number || bc.plate_number}) - {invoice.baseDays} days @ {bc.daily_rate}/day:</span>
                          <span>PKR {((bc.daily_rate || 0) * invoice.baseDays).toLocaleString()}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between">
                        <span>Base Rental ({invoice.baseDays} days @ {selectedBooking.daily_rate}/day):</span>
                        <span>PKR {invoice.baseFare?.toLocaleString()}</span>
                      </div>
                    )}
                    {selectedBooking.is_chauffeur_driven && (
                      <div className="flex justify-between">
                        <span>Driver Wage ({invoice.baseDays} days @ {selectedBooking.chauffeur_daily_wage}/day):</span>
                        <span>PKR {invoice.driverWage?.toLocaleString()}</span>
                      </div>
                    )}
                    {invoice.latePenalty > 0 && (
                      <div className="flex justify-between text-amber-500">
                        <span>Overtime Extra Money ({invoice.lateHours > 0 ? `${invoice.lateHours}h` : 'Manual'}):</span>
                        <span>PKR {invoice.latePenalty?.toLocaleString()}</span>
                      </div>
                    )}
                    {invoice.carWashFee > 0 && (
                      <div className="flex justify-between text-cyan-400">
                        <span>Car Wash / Unwashed Vehicle Cleaning:</span>
                        <span>PKR {invoice.carWashFee?.toLocaleString()}</span>
                      </div>
                    )}
                    {invoice.extraFuel > 0 && (
                      <div className="flex justify-between text-amber-700 dark:text-amber-400">
                        <span>Fuel Refill Cost:</span>
                        <span>PKR {invoice.extraFuel?.toLocaleString()}</span>
                      </div>
                    )}
                    {invoice.damages > 0 && (
                      <div className="flex justify-between text-red-405">
                        <span>Structural Repairs Penalty:</span>
                        <span>PKR {invoice.damages?.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-400">
                      <span>Payments already received:</span>
                      <span>- PKR {(invoice.paidSoFar || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Deposit applied to bill:</span>
                      <span>- PKR {(invoice.depositApplied || 0).toLocaleString()}</span>
                    </div>
                    {(invoice.deposit || 0) - (invoice.depositApplied || 0) > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Deposit to refund:</span>
                        <span>PKR {((invoice.deposit || 0) - (invoice.depositApplied || 0)).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-800 pt-3 space-y-1">
                    <div className="flex justify-between text-sm font-bold text-white">
                      <span>Total Invoice:</span>
                      <span>PKR {invoice.totalBill?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold text-teal-700 dark:text-teal-400">
                      <span>Cash to collect now:</span>
                      <span>PKR {invoice.cashToCollect?.toLocaleString()}</span>
                    </div>
                  </div>

                  {signatureImage && (
                    <div className="border-t border-slate-850 pt-2 text-right">
                      <span className="text-[9px] text-slate-500 block mb-1">Acknowledged Signature:</span>
                      <img src={signatureImage} alt="signature" className="h-10 ml-auto border border-dashed border-slate-800 rounded bg-white" />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 text-xs">
                  <span className="text-slate-500 font-mono">Receipt generated inside local application wrapper.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. MAINTENANCE COMPONENT
// ==========================================
function MaintenanceView({ maintenance, cars, fetchData, showModal, setShowModal }) {
  const [form, setForm] = useState({
    car_id: "", log_type: "Oil Change", cost: 0, execution_date: new Date().toISOString().slice(0, 10),
    next_due_date_or_odometer: "", notes: ""
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    if (res.ok) {
      setShowModal(false);
      fetchData();
    } else {
      alert("Error logging maintenance.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Maintenance Ledger</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Track vehicle health and certificate compliance.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="btn-accent text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-lg"
        >
          <Plus className="h-4 w-4" /> Log Service
        </button>
      </div>

      {/* Grid Table / Mobile Cards */}
      <div className="hidden md:block glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/20 border-b border-[var(--border-color)] text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
              <th className="p-4">Vehicle</th>
              <th className="p-4">Service Type</th>
              <th className="p-4">Amount Charged</th>
              <th className="p-4">Execution Date</th>
              <th className="p-4">Next Due Date / Odometer</th>
              <th className="p-4">Notes / Remarks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-855 text-sm">
            {maintenance.map(log => (
              <tr key={log.id} className="hover:bg-[var(--tr-hover)] transition-colors">
                <td className="p-4 font-bold text-[var(--text-main)]">
                  {log.car?.make_model} <span className="text-xs text-teal-655 block font-mono">{log.car?.plate_number}</span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    log.log_type === "Oil Change" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                    log.log_type === "Repair" ? "bg-sky-500/10 text-sky-600" :
                    "bg-teal-500/10 text-teal-700 dark:text-teal-400"
                  }`}>
                    {log.log_type}
                  </span>
                </td>
                <td className="p-4 font-semibold text-[var(--text-main)] font-mono">PKR {log.cost.toLocaleString()}</td>
                <td className="p-4">{new Date(log.execution_date).toLocaleDateString()}</td>
                <td className="p-4 font-mono text-xs text-slate-400">{log.next_due_date_or_odometer || "--"}</td>
                <td className="p-4 text-[var(--text-muted)] text-xs">{log.notes || "--"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {maintenance.map(log => (
          <div key={log.id} className="glass-panel p-4 rounded-xl border border-[var(--border-color)] space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-bold text-sm text-[var(--text-main)]">{log.car?.make_model}</h4>
                <p className="text-[10px] text-teal-655 font-mono mt-0.5">{log.car?.plate_number}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                log.log_type === "Oil Change" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                log.log_type === "Repair" ? "bg-sky-500/10 text-sky-600" :
                "bg-teal-500/10 text-teal-700 dark:text-teal-400"
              }`}>
                {log.log_type}
              </span>
            </div>
            <div className="text-xs space-y-1 font-semibold text-[var(--text-muted)]">
              <p>Cost: <span className="text-[var(--text-main)] font-mono">PKR {log.cost.toLocaleString()}</span></p>
              <p>Executed: <span className="text-[var(--text-main)]">{new Date(log.execution_date).toLocaleDateString()}</span></p>
              <p>Next Due: <span className="text-[var(--text-main)] font-mono">{log.next_due_date_or_odometer || "--"}</span></p>
              <p>Remarks: <span className="text-[var(--text-main)]">{log.notes || "--"}</span></p>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-6 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
              <h3 className="text-xl font-bold text-[var(--text-main)]">Log Maintenance Action</h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Select Vehicle *</label>
                <select 
                  required
                  value={form.car_id}
                  onChange={(e) => setForm({...form, car_id: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5"
                >
                  <option value="">-- Choose Car --</option>
                  {cars.map(car => (
                    <option key={car.id} value={car.id}>{car.make_model} ({car.plate_number})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Log Type *</label>
                  <select 
                    value={form.log_type}
                    onChange={(e) => setForm({...form, log_type: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5"
                  >
                    <option value="Oil Change">Oil Change</option>
                    <option value="Repair">Repair</option>
                    <option value="Tuning">Tuning</option>
                    <option value="Token Tax">Token Tax</option>
                    <option value="Vehicle Fitness">Vehicle Fitness</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Charged Cost (PKR) *</label>
                  <input 
                    type="number" required
                    value={form.cost}
                    onChange={(e) => setForm({...form, cost: parseFloat(e.target.value) || 0})}
                    className="w-full app-input rounded-lg p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Execution Date *</label>
                  <input 
                    type="date" required
                    value={form.execution_date}
                    onChange={(e) => setForm({...form, execution_date: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Next Due (Odo or Date)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 25000 or 2026-12-31"
                    value={form.next_due_date_or_odometer}
                    onChange={(e) => setForm({...form, next_due_date_or_odometer: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Notes / Remarks</label>
                <textarea 
                  value={form.notes}
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5 h-20"
                />
              </div>

              <button 
                type="submit"
                className="w-full btn-accent text-white font-semibold py-3 rounded-lg mt-4 transition-all"
              >
                Log Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. BLACKLIST COMPONENT
// ==========================================
function BlacklistView({ blacklist, fetchData, showModal, setShowModal }) {
  const [form, setForm] = useState({ cnic_number: "", reason_flag: "" });
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResult, setLookupResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        logged_date: new Date().toISOString().slice(0, 10)
      })
    });

    if (res.ok) {
      setShowModal(false);
      setForm({ cnic_number: "", reason_flag: "" });
      fetchData();
    } else {
      const data = await res.json();
      alert(data.detail || "Error blacklisting CNIC.");
    }
  };

  const handleRemove = async (cnic) => {
    if (confirm("Remove this CNIC from the blacklist?")) {
      const res = await fetch(`/api/blacklist/${cnic}`, { method: "DELETE" });
      if (res.ok) fetchData();
    }
  };

  const handleShieldSearch = async () => {
    const clean = lookupQuery.replace("-", "").trim();
    if (clean.length !== 13) {
      alert("Please input a valid 13-digit CNIC");
      return;
    }
    const res = await fetch(`/api/blacklist/lookup/${clean}`);
    if (res.ok) {
      const data = await res.json();
      setLookupResult(data);
    } else {
      setLookupResult({ notFound: true });
    }
  };

  return (
    <div className="space-y-6">
      <div className="page-toolbar">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Blacklist Risk Shield</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Lahore-wide auto fraud prevention lookup register.</p>
        </div>
        <button 
          type="button"
          onClick={() => setShowModal(true)}
          className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-4 rounded-xl inline-flex items-center justify-center gap-2 transition-all shadow-lg page-cta"
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          <span>Flag CNIC</span>
        </button>
      </div>

      {/* Blacklist Shield CNIC lookup widget */}
      <div className="glass-panel p-5 rounded-2xl border border-red-500/20 bg-slate-900/10 space-y-4">
        <h3 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" /> Instant Database Blacklist Shield Check
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Input 13-digit CNIC (e.g. 3520199999999)..."
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
            className="flex-1 app-input rounded-lg p-2.5 text-sm focus:outline-none"
          />
          <button
            onClick={handleShieldSearch}
            className="bg-red-50 dark:bg-red-950/40 hover:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-500/30 px-5 py-2.5 rounded-lg text-sm font-semibold"
          >
            Check Status
          </button>
        </div>

        {lookupResult && (
          <div className="p-3.5 rounded-xl border border-[var(--border-color)] text-xs">
            {lookupResult.notFound ? (
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4" /> CNIC Clean: Record does not exist in blacklist database.
              </span>
            ) : (
              <div className="text-red-700 dark:text-red-400 space-y-1">
                <p className="font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> FLAGGED RECORD DETECTED:
                </p>
                <p className="pl-6 text-[var(--text-main)] font-semibold">Reason: {lookupResult.reason_flag}</p>
                <p className="pl-6 text-[var(--text-muted)] font-mono">Logged Date: {new Date(lookupResult.logged_date).toLocaleDateString()}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Grid Table / Mobile Cards */}
      <div className="hidden md:block glass-panel rounded-2xl border border-[var(--border-color)] overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/20 border-b border-[var(--border-color)] text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
              <th className="p-4">CNIC Number</th>
              <th className="p-4">Reason / Hazard Details</th>
              <th className="p-4">Logged Date</th>
              <th className="p-4 text-right">Protection Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 text-sm">
            {blacklist.map(bl => (
              <tr key={bl.id} className="hover:bg-[var(--tr-hover)] transition-colors">
                <td className="p-4 font-mono font-bold text-red-700 dark:text-red-400">{bl.cnic_number}</td>
                <td className="p-4 text-red-700 dark:text-red-400 font-semibold">{bl.reason_flag}</td>
                <td className="p-4 text-[var(--text-muted)]">{new Date(bl.logged_date).toLocaleDateString()}</td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => handleRemove(bl.cnic_number)}
                    className="bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-400 text-xs px-3 py-1 rounded border border-emerald-500/20 min-h-[44px]"
                  >
                    Clear Flag
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {blacklist.map(bl => (
          <div key={bl.id} className="glass-panel p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-mono font-bold text-sm text-red-700 dark:text-red-400">{bl.cnic_number}</h4>
                <p className="text-[10px] text-[var(--text-muted)] font-semibold mt-0.5">Logged: {new Date(bl.logged_date).toLocaleDateString()}</p>
              </div>
              <button 
                onClick={() => handleRemove(bl.cnic_number)}
                className="bg-emerald-500/10 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-400 text-xs px-3 py-1.5 rounded border border-emerald-500/25 min-h-[44px]"
              >
                Clear Flag
              </button>
            </div>
            <div className="text-xs text-red-700 dark:text-red-400 font-semibold leading-relaxed">
              Reason: {bl.reason_flag}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-6 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
              <h3 className="text-xl font-bold text-red-700 dark:text-red-400">Flag CNIC on Blacklist</h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">CNIC Number * (13 Digits)</label>
                <input 
                  type="text" required
                  placeholder="3520112345678"
                  value={form.cnic_number}
                  onChange={(e) => setForm({...form, cnic_number: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Reason for Blacklisting *</label>
                <textarea required
                  placeholder="e.g., Defaulted on payment, vehicle damage default..."
                  value={form.reason_flag}
                  onChange={(e) => setForm({...form, reason_flag: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5 h-24"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg mt-4 transition-all"
              >
                Log Blacklist Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 7. INVESTOR TRACING & MANAGEMENT COMPONENT
// ==========================================
function InvestorsView({ investors, cars, financials = [], bookings = [], maintenance = [], fetchData }) {
  const [search, setSearch] = useState("");
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [showInvestorModal, setShowInvestorModal] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState(null);

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutTarget, setPayoutTarget] = useState(null);
  const [payoutForm, setPayoutForm] = useState({
    amount: "",
    payout_date: new Date().toISOString().slice(0, 10),
    payment_method: "Bank Transfer",
    notes: ""
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    cnic_number: "",
    investment_amount: 0,
    payout_type: "percentage",
    profit_share_percentage: 70,
    fixed_amount: 0,
    joined_date: new Date().toISOString().slice(0, 10),
    notes: "",
    assigned_car_ids: []
  });

  // Keep detail modal in sync with live /api/investors refresh
  useEffect(() => {
    if (!selectedInvestor) return;
    const fresh = investors.find(
      (i) => (i.investor_id || i.id) === (selectedInvestor.investor_id || selectedInvestor.id)
    );
    if (fresh) setSelectedInvestor(fresh);
  }, [investors]);

  useEffect(() => {
    if (editingInvestor) {
      setForm({
        full_name: editingInvestor.full_name || "",
        phone: editingInvestor.phone || "",
        email: editingInvestor.email || "",
        cnic_number: editingInvestor.cnic_number || "",
        investment_amount: editingInvestor.investment_amount || 0,
        payout_type: editingInvestor.payout_type || "percentage",
        profit_share_percentage: editingInvestor.profit_share_percentage || 70,
        fixed_amount: editingInvestor.fixed_amount || 0,
        joined_date: editingInvestor.joined_date || new Date().toISOString().slice(0, 10),
        notes: editingInvestor.notes || "",
        assigned_car_ids: editingInvestor.cars ? editingInvestor.cars.map(c => c.id) : []
      });
    } else {
      setForm({
        full_name: "",
        phone: "",
        email: "",
        cnic_number: "",
        investment_amount: 0,
        payout_type: "percentage",
        profit_share_percentage: 70,
        fixed_amount: 0,
        joined_date: new Date().toISOString().slice(0, 10),
        notes: "",
        assigned_car_ids: []
      });
    }
  }, [editingInvestor, showInvestorModal]);

  const portfolio = investorPortfolioTotals(investors);
  const allPayouts = flattenInvestorPayouts(investors);
  // Portfolio chart: cash collected on investor cars vs maint on those cars vs all payouts
  const investorCarIds = new Set(
    (investors || []).flatMap((inv) => (inv.cars || []).map((c) => c.id))
  );
  const invBookings = (bookings || []).filter((b) => investorCarIds.has(b.car_id));
  const invBookingIds = new Set(invBookings.map((b) => b.id));
  const invFinancials = (financials || []).filter((f) => invBookingIds.has(f.booking_id));
  const invMaint = (maintenance || []).filter((m) => investorCarIds.has(m.car_id));
  const monthSeries = monthlyCashflow(invFinancials, invMaint, 6, allPayouts);
  const chartMax = Math.max(...monthSeries.map((m) => Math.max(m.revenue, m.expenses)), 1);

  const filteredInvestors = investors.filter(inv => 
    inv.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.phone?.includes(search) ||
    inv.cnic_number?.includes(search) ||
    inv.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleInvestorSubmit = async (e) => {
    e.preventDefault();
    const method = editingInvestor ? "PUT" : "POST";
    const endpoint = editingInvestor ? `/api/investors/${editingInvestor.investor_id || editingInvestor.id}` : "/api/investors/";

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setShowInvestorModal(false);
        setEditingInvestor(null);
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.detail || "Failed to save investor profile.");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting investor profile.");
    }
  };

  const handleDeleteInvestor = async (id) => {
    if (!window.confirm("Are you sure you want to remove this investor? Assigned cars will be unlinked.")) return;
    try {
      const res = await fetch(`/api/investors/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedInvestor && selectedInvestor.investor_id === id) {
          setSelectedInvestor(null);
        }
        fetchData();
      } else {
        alert("Failed to delete investor.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting investor.");
    }
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutTarget) return;

    try {
      const res = await fetch(`/api/investors/${payoutTarget.investor_id || payoutTarget.id}/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payoutForm.amount),
          payout_date: payoutForm.payout_date,
          payment_method: payoutForm.payment_method,
          notes: payoutForm.notes
        })
      });

      if (res.ok) {
        setShowPayoutModal(false);
        setPayoutTarget(null);
        setPayoutForm({
          amount: "",
          payout_date: new Date().toISOString().slice(0, 10),
          payment_method: "Bank Transfer",
          notes: ""
        });
        fetchData();
        // Refresh selected investor view if open
        if (selectedInvestor) {
          const freshRes = await fetch(`/api/investors/${selectedInvestor.investor_id}`);
          if (freshRes.ok) {
            setSelectedInvestor(await freshRes.json());
          }
        }
      } else {
        const errData = await res.json();
        alert(errData.detail || "Error recording payout.");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting payout.");
    }
  };

  const toggleCarAssignment = (carId) => {
    setForm(prev => {
      const current = prev.assigned_car_ids || [];
      if (current.includes(carId)) {
        return { ...prev, assigned_car_ids: current.filter(id => id !== carId) };
      } else {
        return { ...prev, assigned_car_ids: [...current, carId] };
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Investor Tracing & Capital Dashboard</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">Track investor profiles, capital contributions, vehicle earnings share, and payouts ledger.</p>
        </div>

        <button 
          type="button"
          onClick={() => { setEditingInvestor(null); setShowInvestorModal(true); }}
          className="btn-accent text-white font-bold px-4 py-2.5 rounded-xl inline-flex items-center justify-center gap-2 shadow-lg"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Add New Investor</span>
        </button>
      </div>

      {/* KPI Cards — same portfolio totals as Dashboard / Reports / Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Total Invested Capital</span>
          <span className="text-xl font-extrabold text-[var(--text-main)] mt-2 block font-mono">PKR {portfolio.capital.toLocaleString()}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Fleet Generated Revenue</span>
          <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-2 block font-mono">PKR {portfolio.revenue.toLocaleString()}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Net Investor Profit Share</span>
          <span className="text-xl font-extrabold text-teal-700 dark:text-teal-400 mt-2 block font-mono">PKR {portfolio.earnings.toLocaleString()}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Total Paid Out</span>
          <span className="text-xl font-extrabold text-blue-700 dark:text-blue-400 mt-2 block font-mono">PKR {portfolio.payouts.toLocaleString()}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Pending Payout Dues</span>
          <span className={`text-xl font-extrabold mt-2 block font-mono ${
            portfolio.due > 0
              ? "text-rose-700 dark:text-rose-400"
              : portfolio.due < 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-[var(--text-muted)]"
          }`}>
            {portfolio.due < 0
              ? `-PKR ${Math.abs(portfolio.due).toLocaleString()}`
              : `PKR ${portfolio.due.toLocaleString()}`}
          </span>
          {portfolio.due < 0 && (
            <span className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-semibold mt-1 block">Net overpaid</span>
          )}
        </div>
      </div>

      {/* Shared cashflow trend — investor cars receipts vs maint + payouts */}
      <div className="glass-panel p-6 rounded-2xl border border-[var(--border-color)] space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-[var(--border-color)]">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2 text-[var(--text-main)]">
              <LineChart className="h-5 w-5 text-[var(--accent-color)]" /> Investor Fleet Cashflow (6 Months)
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Cash collected on investor cars vs workshop costs + disbursements — synced with Dashboard ledger.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold font-mono">
            <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Receipts</span>
            <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Maint+Payouts</span>
          </div>
        </div>
        <div className="flex items-end justify-between gap-3 h-40 pt-4 px-1 border-b border-[var(--border-color)]">
          {monthSeries.map((m, i) => {
            const inH = Math.max(6, Math.round((m.revenue / chartMax) * 100));
            const outH = Math.max(6, Math.round((m.expenses / chartMax) * 100));
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                <span className="text-[9px] font-mono opacity-70 group-hover:opacity-100">
                  {(m.revenue / 1000).toFixed(0)}k/{(m.expenses / 1000).toFixed(0)}k
                </span>
                <div className="w-full flex items-end justify-center gap-0.5 h-full max-w-[40px]">
                  <div className="flex-1 bg-[var(--tr-hover)] rounded-t overflow-hidden h-full flex items-end">
                    <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${inH}%` }} />
                  </div>
                  <div className="flex-1 bg-[var(--tr-hover)] rounded-t overflow-hidden h-full flex items-end">
                    <div className="w-full bg-rose-500 rounded-t" style={{ height: `${outH}%` }} />
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[var(--text-muted)]">{m.key}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text"
            placeholder="Search investors by name, phone, CNIC or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full app-input rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Investor Directory — desktop table */}
      <div className="hidden md:block glass-panel rounded-2xl overflow-hidden shadow-xl border border-[var(--border-color)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--tr-hover)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-color)]">
              <tr>
                <th className="p-4">Investor Profile</th>
                <th className="p-4">Capital Invested</th>
                <th className="p-4">Cars Owned</th>
                <th className="p-4">Profit Share</th>
                <th className="p-4">Revenue Generated</th>
                <th className="p-4">Investor Earnings</th>
                <th className="p-4">Disbursed Payouts</th>
                <th className="p-4">Remaining Due</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredInvestors.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-12 text-[var(--text-muted)] italic">
                    No investor profiles recorded yet. Click "Add New Investor" to create one.
                  </td>
                </tr>
              ) : (
                filteredInvestors.map((inv) => {
                  const due = Number(inv.payout_balance_due) || 0;
                  const dueClass = due > 0
                    ? "text-rose-700 dark:text-rose-400"
                    : due < 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-[var(--text-muted)]";
                  const dueLabel = due < 0
                    ? `-PKR ${Math.abs(due).toLocaleString()}`
                    : `PKR ${due.toLocaleString()}`;
                  return (
                  <tr key={inv.investor_id} className="hover:bg-[var(--tr-hover)] transition-colors">
                    <td className="p-4 align-middle font-semibold text-[var(--text-main)]">
                      <div>
                        <div className="font-bold text-sm text-[var(--accent-color)]">{inv.full_name}</div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">{inv.phone} · {inv.cnic_number || "No CNIC"}</div>
                      </div>
                    </td>
                    <td className="p-4 align-middle font-mono font-bold text-[var(--text-main)] whitespace-nowrap">
                      PKR {inv.investment_amount?.toLocaleString()}
                    </td>
                    <td className="p-4 align-middle">
                      <span className="inline-flex items-center whitespace-nowrap bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold">
                        {inv.total_cars_owned} {inv.total_cars_owned === 1 ? "car" : "cars"}
                      </span>
                    </td>
                    <td className="p-4 align-middle font-mono font-semibold text-[var(--text-main)]">
                      {inv.payout_type === "fixed" ? `Fixed PKR ${(inv.fixed_amount || 0).toLocaleString()}` : `${inv.profit_share_percentage}%`}
                    </td>
                    <td className="p-4 align-middle font-mono text-emerald-700 dark:text-emerald-400 font-bold whitespace-nowrap">
                      PKR {inv.total_revenue_generated?.toLocaleString()}
                    </td>
                    <td className="p-4 align-middle font-mono text-teal-700 dark:text-teal-400 font-bold whitespace-nowrap">
                      PKR {inv.total_investor_earnings?.toLocaleString()}
                    </td>
                    <td className="p-4 align-middle font-mono text-blue-700 dark:text-blue-400 font-bold whitespace-nowrap">
                      PKR {inv.total_payouts_received?.toLocaleString()}
                    </td>
                    <td className={`p-4 align-middle font-mono font-bold whitespace-nowrap ${dueClass}`}>
                      {dueLabel}
                      {due < 0 && <span className="block text-[9px] font-sans font-semibold text-amber-600/80 dark:text-amber-400/80 mt-0.5">Overpaid</span>}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <div className="inline-flex flex-nowrap items-center justify-end gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setSelectedInvestor(inv)}
                          title="View Complete Investor Tracing & Vehicle Performance"
                          className="inline-flex items-center justify-center h-8 w-8 bg-teal-600/10 hover:bg-teal-600 text-teal-700 dark:text-teal-400 hover:text-white border border-teal-500/20 rounded-lg transition-all"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setPayoutTarget(inv); setShowPayoutModal(true); }}
                          title="Disburse Profit Payout"
                          className="inline-flex items-center justify-center h-8 w-8 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-400 hover:text-white border border-emerald-500/20 rounded-lg transition-all"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setEditingInvestor(inv); setShowInvestorModal(true); }}
                          title="Edit Profile"
                          className="inline-flex items-center justify-center h-8 w-8 bg-amber-600/10 hover:bg-amber-600 text-amber-700 dark:text-amber-400 hover:text-white border border-amber-500/20 rounded-lg transition-all"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteInvestor(inv.investor_id)}
                          title="Delete Investor"
                          className="inline-flex items-center justify-center h-8 w-8 bg-rose-600/10 hover:bg-rose-600 text-rose-700 dark:text-rose-400 hover:text-white border border-rose-500/20 rounded-lg transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investor Directory — mobile cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredInvestors.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl text-center text-[var(--text-muted)] italic text-sm">
            No investor profiles yet. Tap Add New Investor to create one.
          </div>
        ) : (
          filteredInvestors.map((inv) => (
            <div key={inv.investor_id} className="glass-panel p-4 rounded-2xl border border-[var(--border-color)] space-y-3">
              <div>
                <h4 className="font-bold text-[var(--accent-color)]">{inv.full_name}</h4>
                <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{inv.phone} · {inv.cnic_number || "No CNIC"}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs keep-cols-2">
                <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-[var(--border-color)]">
                  <span className="text-[9px] uppercase text-[var(--text-muted)] block">Capital</span>
                  <span className="font-mono font-bold text-[var(--text-main)]">PKR {inv.investment_amount?.toLocaleString()}</span>
                </div>
                <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-[var(--border-color)]">
                  <span className="text-[9px] uppercase text-[var(--text-muted)] block">Due</span>
                  <span className={`font-mono font-bold ${inv.payout_balance_due > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    PKR {inv.payout_balance_due?.toLocaleString()}
                  </span>
                </div>
                <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-[var(--border-color)]">
                  <span className="text-[9px] uppercase text-[var(--text-muted)] block">Share / Cars</span>
                  <span className="font-mono font-bold text-[var(--text-main)]">{inv.payout_type === "fixed" ? `Fixed PKR ${(inv.fixed_amount || 0).toLocaleString()}` : `${inv.profit_share_percentage}%`} · {inv.total_cars_owned} car(s)</span>
                </div>
                <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-[var(--border-color)]">
                  <span className="text-[9px] uppercase text-[var(--text-muted)] block">Earnings</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400">PKR {inv.total_investor_earnings?.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--border-color)]">
                <button onClick={() => setSelectedInvestor(inv)} className="flex-1 min-h-[44px] bg-teal-600/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 rounded-lg text-xs font-bold">View</button>
                <button onClick={() => { setPayoutTarget(inv); setShowPayoutModal(true); }} className="flex-1 min-h-[44px] bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold">Payout</button>
                <button onClick={() => { setEditingInvestor(inv); setShowInvestorModal(true); }} className="min-h-[44px] min-w-[44px] bg-amber-600/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-lg flex items-center justify-center"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDeleteInvestor(inv.investor_id)} className="min-h-[44px] min-w-[44px] bg-rose-600/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 rounded-lg flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: DETAILED INVESTOR TRACING & FINANCIAL PERFORMANCE */}
      {selectedInvestor && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-6 text-xs border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-xl font-bold text-[var(--accent-color)]">{selectedInvestor.full_name}</h3>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  Phone: {selectedInvestor.phone} | CNIC: {selectedInvestor.cnic_number || "N/A"} | Joined: {selectedInvestor.joined_date}
                </p>
              </div>
              <button onClick={() => setSelectedInvestor(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Investor Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[var(--tr-hover)] p-4 rounded-xl border border-[var(--border-color)] font-mono">
              <div>
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Invested Capital</span>
                <span className="text-sm font-bold text-[var(--text-main)]">PKR {selectedInvestor.investment_amount?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Revenue Generated</span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">PKR {selectedInvestor.total_revenue_generated?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Net Investor Share ({selectedInvestor.profit_share_percentage}%)</span>
                <span className="text-sm font-bold text-teal-700 dark:text-teal-400">PKR {selectedInvestor.total_investor_earnings?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Balance Payable</span>
                <span className={`text-sm font-bold ${selectedInvestor.payout_balance_due > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                  PKR {selectedInvestor.payout_balance_due?.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Vehicle Performance Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                  <Car className="h-4 w-4 text-teal-700 dark:text-teal-400" /> Owned Vehicles & Financial Performance Breakdown
                </h4>
                <span className="text-[10px] text-[var(--text-muted)]">{selectedInvestor.car_performance?.length || 0} Vehicles Assigned</span>
              </div>

              <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[var(--tr-hover)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-color)]">
                    <tr>
                      <th className="p-3">Plate #</th>
                      <th className="p-3">Vehicle Model</th>
                      <th className="p-3">Bookings</th>
                      <th className="p-3">Total Revenue</th>
                      <th className="p-3">Maintenance Outflow</th>
                      <th className="p-3">Net Vehicle Profit</th>
                      <th className="p-3 text-right">Investor Cut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {selectedInvestor.car_performance?.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-6 text-[var(--text-muted)] italic">
                          No vehicles currently assigned to this investor.
                        </td>
                      </tr>
                    ) : (
                      selectedInvestor.car_performance?.map(car => (
                        <tr key={car.car_id} className="hover:bg-[var(--tr-hover)]">
                          <td className="p-3 font-mono font-bold text-[var(--accent-color)]">{car.plate_number}</td>
                          <td className="p-3 font-semibold text-[var(--text-main)]">{car.make_model}</td>
                          <td className="p-3 font-mono">{car.bookings_count}</td>
                          <td className="p-3 font-mono text-emerald-700 dark:text-emerald-400 font-bold">PKR {car.total_revenue_generated?.toLocaleString()}</td>
                          <td className="p-3 font-mono text-rose-700 dark:text-rose-400">PKR {car.total_maintenance_cost?.toLocaleString()}</td>
                          <td className="p-3 font-mono text-[var(--text-main)] font-bold">PKR {car.net_profit?.toLocaleString()}</td>
                          <td className="p-3 font-mono text-teal-700 dark:text-teal-400 font-bold text-right">PKR {car.investor_earnings?.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payout History Ledger Section */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-700 dark:text-emerald-400" /> Disbursement Payouts Ledger
                </h4>
                <button 
                  onClick={() => { setPayoutTarget(selectedInvestor); setShowPayoutModal(true); }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Record Payout
                </button>
              </div>

              <div className="border border-[var(--border-color)] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[var(--tr-hover)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-color)]">
                    <tr>
                      <th className="p-3">Payout Date</th>
                      <th className="p-3">Disbursed Amount</th>
                      <th className="p-3">Payment Method</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)] font-mono">
                    {selectedInvestor.payouts?.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-6 text-[var(--text-muted)] italic">
                          No payout transactions disbursed yet.
                        </td>
                      </tr>
                    ) : (
                      selectedInvestor.payouts?.map(p => (
                        <tr key={p.id} className="hover:bg-[var(--tr-hover)]">
                          <td className="p-3 text-[var(--text-muted)]">{p.payout_date}</td>
                          <td className="p-3 text-emerald-700 dark:text-emerald-400 font-bold">PKR {p.amount?.toLocaleString()}</td>
                          <td className="p-3 text-[var(--text-main)]">{p.payment_method}</td>
                          <td className="p-3 text-[var(--text-muted)] text-[10px]">{p.notes || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT INVESTOR PROFILE */}
      {showInvestorModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-xl rounded-2xl p-6 shadow-2xl space-y-6 text-xs border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
              <h3 className="text-base font-bold text-[var(--text-main)]">
                {editingInvestor ? "Edit Investor Profile" : "Add New Investor Profile"}
              </h3>
              <button onClick={() => setShowInvestorModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInvestorSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Full Name / Group *</label>
                  <input 
                    type="text" required
                    placeholder="e.g. Sheikh Farooq Ahmed"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    className="w-full app-input rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Phone Number *</label>
                  <input 
                    type="text" required
                    placeholder="0300-1234567"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full app-input rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">CNIC Number</label>
                  <input 
                    type="text"
                    placeholder="35201-1234567-9"
                    value={form.cnic_number}
                    onChange={(e) => setForm({ ...form, cnic_number: e.target.value })}
                    className="w-full app-input rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Email Address</label>
                  <input 
                    type="email"
                    placeholder="investor@domain.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full app-input rounded-xl p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Invested Capital (PKR) *</label>
                  <input 
                    type="number" required min="0" step="1000"
                    value={form.investment_amount}
                    onChange={(e) => setForm({ ...form, investment_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full app-input rounded-xl p-2.5 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Payout Agreement Type</label>
                  <select
                    value={form.payout_type || "percentage"}
                    onChange={(e) => setForm({ ...form, payout_type: e.target.value })}
                    className="w-full app-input rounded-xl p-2.5"
                  >
                    <option value="percentage">Percentage Share (%)</option>
                    <option value="fixed">Fixed Agreed Amount (PKR)</option>
                  </select>
                </div>

                {form.payout_type === "fixed" ? (
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-amber-500 mb-1">Fixed Amount To Pay (PKR) *</label>
                    <input 
                      type="number" required min="0" step="500"
                      value={form.fixed_amount}
                      onChange={(e) => setForm({ ...form, fixed_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full app-input rounded-xl p-2.5 font-mono border-amber-500/40"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Profit Share Rate (%) *</label>
                    <input 
                      type="number" required min="0" max="100" step="0.5"
                      value={form.profit_share_percentage}
                      onChange={(e) => setForm({ ...form, profit_share_percentage: parseFloat(e.target.value) || 0 })}
                      className="w-full app-input rounded-xl p-2.5 font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Onboarding Date *</label>
                  <input 
                    type="date" required
                    value={form.joined_date}
                    onChange={(e) => setForm({ ...form, joined_date: e.target.value })}
                    className="w-full app-input rounded-xl p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Assign Fleet Vehicles to Investor</label>
                <div className="border border-[var(--border-color)] rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5 bg-[var(--tr-hover)]">
                  {cars.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic">No cars available in fleet.</p>
                  ) : (
                    cars.map(car => (
                      <label key={car.id} className="flex items-center gap-2 cursor-pointer text-xs p-1 hover:bg-black/10 rounded">
                        <input 
                          type="checkbox"
                          checked={(form.assigned_car_ids || []).includes(car.id)}
                          onChange={() => toggleCarAssignment(car.id)}
                          className="rounded border-[var(--border-color)] text-teal-700 dark:text-teal-400 focus:ring-0"
                        />
                        <span className="font-bold font-mono text-[var(--accent-color)]">{car.plate_number}</span>
                        <span className="text-[var(--text-main)]">- {car.make_model} ({car.model_year})</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Notes / Terms</label>
                <textarea 
                  placeholder="Special agreement terms, contract details..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full app-input rounded-xl p-2.5 h-16"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowInvestorModal(false)}
                  className="flex-1 border border-[var(--border-color)] hover:bg-[var(--tr-hover)] py-2.5 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 btn-accent text-white font-bold py-2.5 rounded-xl shadow-lg"
                >
                  Save Investor Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD INVESTOR PAYOUT */}
      {showPayoutModal && payoutTarget && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-6 text-xs border border-[var(--border-color)]">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-base font-bold text-[var(--text-main)]">Record Investor Profit Payout</h3>
                <p className="text-[10px] text-teal-700 dark:text-teal-400 font-bold mt-0.5">{payoutTarget.full_name}</p>
              </div>
              <button onClick={() => setShowPayoutModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePayoutSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Disbursement Amount (PKR) *</label>
                <input 
                  type="number" required min="1" step="100"
                  placeholder="e.g. 50000"
                  value={payoutForm.amount}
                  onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
                  className="w-full app-input rounded-xl p-2.5 font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Payment Method *</label>
                <select
                  value={payoutForm.payment_method}
                  onChange={(e) => setPayoutForm({ ...payoutForm, payment_method: e.target.value })}
                  className="w-full app-input rounded-xl p-2.5 font-semibold"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="EasyPaisa/JazzCash">EasyPaisa / JazzCash</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Payout Date *</label>
                <input 
                  type="date" required
                  value={payoutForm.payout_date}
                  onChange={(e) => setPayoutForm({ ...payoutForm, payout_date: e.target.value })}
                  className="w-full app-input rounded-xl p-2.5"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Transaction Notes</label>
                <textarea 
                  placeholder="Reference no, cheque number, or notes..."
                  value={payoutForm.notes}
                  onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                  className="w-full app-input rounded-xl p-2.5 h-16"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowPayoutModal(false)}
                  className="flex-1 border border-[var(--border-color)] hover:bg-[var(--tr-hover)] py-2.5 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg"
                >
                  Confirm Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareholdersView({ shareholders, cars, financials = [], bookings = [], maintenance = [], fetchData }) {
  const [search, setSearch] = useState("");
  const [selectedShareholder, setSelectedShareholder] = useState(null);
  const [showShareholderModal, setShowShareholderModal] = useState(false);
  const [editingShareholder, setEditingShareholder] = useState(null);

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutTarget, setPayoutTarget] = useState(null);
  const [payoutForm, setPayoutForm] = useState({
    amount: "",
    payout_date: new Date().toISOString().slice(0, 10),
    payment_method: "Bank Transfer",
    notes: ""
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    cnic_number: "",
    investment_amount: 0,
    payout_type: "percentage",
    share_percentage: 50,
    fixed_amount: 0,
    joined_date: new Date().toISOString().slice(0, 10),
    notes: "",
    assigned_car_ids: []
  });

  // Keep detail modal in sync with live /api/shareholders refresh
  useEffect(() => {
    if (!selectedShareholder) return;
    const fresh = shareholders.find(
      (s) => (s.shareholder_id || s.id) === (selectedShareholder.shareholder_id || selectedShareholder.id)
    );
    if (fresh) setSelectedShareholder(fresh);
  }, [shareholders]);

  useEffect(() => {
    if (editingShareholder) {
      setForm({
        full_name: editingShareholder.full_name || "",
        phone: editingShareholder.phone || "",
        email: editingShareholder.email || "",
        cnic_number: editingShareholder.cnic_number || "",
        investment_amount: editingShareholder.investment_amount || 0,
        payout_type: editingShareholder.payout_type || "percentage",
        share_percentage: editingShareholder.share_percentage || 50,
        fixed_amount: editingShareholder.fixed_amount || 0,
        joined_date: editingShareholder.joined_date || new Date().toISOString().slice(0, 10),
        notes: editingShareholder.notes || "",
        assigned_car_ids: editingShareholder.cars ? editingShareholder.cars.map(c => c.id) : []
      });
    } else {
      setForm({
        full_name: "",
        phone: "",
        email: "",
        cnic_number: "",
        investment_amount: 0,
        payout_type: "percentage",
        share_percentage: 50,
        fixed_amount: 0,
        joined_date: new Date().toISOString().slice(0, 10),
        notes: "",
        assigned_car_ids: []
      });
    }
  }, [editingShareholder, showShareholderModal]);

  const portfolio = shareholderPortfolioTotals(shareholders);
  const allPayouts = flattenShareholderPayouts(shareholders);
  const shareholderCarIds = new Set(
    (shareholders || []).flatMap((sh) => (sh.cars || []).map((c) => c.id))
  );
  const shBookings = (bookings || []).filter((b) => shareholderCarIds.has(b.car_id));
  const shBookingIds = new Set(shBookings.map((b) => b.id));
  const shFinancials = (financials || []).filter((f) => shBookingIds.has(f.booking_id));
  const shMaint = (maintenance || []).filter((m) => shareholderCarIds.has(m.car_id));
  const monthSeries = monthlyCashflow(shFinancials, shMaint, 6, allPayouts);
  const chartMax = Math.max(...monthSeries.map((m) => Math.max(m.revenue, m.expenses)), 1);

  const filteredShareholders = shareholders.filter(sh => 
    sh.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    sh.phone?.includes(search) ||
    sh.cnic_number?.includes(search) ||
    sh.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleShareholderSubmit = async (e) => {
    e.preventDefault();
    const method = editingShareholder ? "PUT" : "POST";
    const endpoint = editingShareholder ? `/api/shareholders/${editingShareholder.shareholder_id || editingShareholder.id}` : "/api/shareholders/";

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        setShowShareholderModal(false);
        setEditingShareholder(null);
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.detail || "Failed to save shareholder profile.");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting shareholder profile.");
    }
  };

  const handleDeleteShareholder = async (id) => {
    if (!window.confirm("Are you sure you want to remove this shareholder? Assigned cars will be unlinked.")) return;
    try {
      const res = await fetch(`/api/shareholders/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (selectedShareholder && (selectedShareholder.shareholder_id === id || selectedShareholder.id === id)) {
          setSelectedShareholder(null);
        }
        fetchData();
      } else {
        alert("Failed to delete shareholder.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting shareholder.");
    }
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutTarget) return;

    try {
      const res = await fetch(`/api/shareholders/${payoutTarget.shareholder_id || payoutTarget.id}/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(payoutForm.amount),
          payout_date: payoutForm.payout_date,
          payment_method: payoutForm.payment_method,
          notes: payoutForm.notes
        })
      });

      if (res.ok) {
        setShowPayoutModal(false);
        setPayoutTarget(null);
        setPayoutForm({
          amount: "",
          payout_date: new Date().toISOString().slice(0, 10),
          payment_method: "Bank Transfer",
          notes: ""
        });
        fetchData();
        if (selectedShareholder) {
          const freshRes = await fetch(`/api/shareholders/${selectedShareholder.shareholder_id || selectedShareholder.id}`);
          if (freshRes.ok) {
            setSelectedShareholder(await freshRes.json());
          }
        }
      } else {
        const errData = await res.json();
        alert(errData.detail || "Error recording payout.");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting payout.");
    }
  };

  const toggleCarAssignment = (carId) => {
    setForm(prev => {
      const current = prev.assigned_car_ids || [];
      if (current.includes(carId)) {
        return { ...prev, assigned_car_ids: current.filter(id => id !== carId) };
      } else {
        return { ...prev, assigned_car_ids: [...current, carId] };
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Shareholder Portfolio & Earnings Dashboard</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">Track shareholder profiles, capital pool, gross earnings minus 15% platform fees, and payouts.</p>
        </div>

        <button 
          type="button"
          onClick={() => { setEditingShareholder(null); setShowShareholderModal(true); }}
          className="btn-accent text-white font-bold px-4 py-2.5 rounded-xl inline-flex items-center justify-center gap-2 shadow-lg"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>Add New Shareholder</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Total Invested Capital</span>
          <span className="text-xl font-extrabold text-[var(--text-main)] mt-2 block font-mono">PKR {portfolio.capital.toLocaleString()}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Fleet Generated Revenue</span>
          <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-2 block font-mono">PKR {portfolio.revenue.toLocaleString()}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Platform Fee Retained</span>
          <span className="text-xl font-extrabold text-rose-755 mt-2 block font-mono">PKR {portfolio.platform_fee.toLocaleString()}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Net Shareholder Earnings</span>
          <span className="text-xl font-extrabold text-teal-700 dark:text-teal-400 mt-2 block font-mono">PKR {portfolio.earnings.toLocaleString()}</span>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block">Pending Payout Dues</span>
          <span className={`text-xl font-extrabold mt-2 block font-mono ${
            portfolio.due > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
          }`}>
            {portfolio.due < 0
              ? `-PKR ${Math.abs(portfolio.due).toLocaleString()}`
              : `PKR ${portfolio.due.toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* Cashflow trends chart */}
      <div className="glass-panel p-6 rounded-2xl border border-[var(--border-color)] space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-2 pb-3 border-b border-[var(--border-color)]">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2 text-[var(--text-main)]">
              <LineChart className="h-5 w-5 text-[var(--accent-color)]" /> Shareholder Fleet Cashflow (6 Months)
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Cash collected on shareholder cars vs disbursements — synced with Dashboard.
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold font-mono">
            <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Receipts</span>
            <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> Disbursements</span>
          </div>
        </div>
        <div className="flex items-end justify-between gap-3 h-40 pt-4 px-1 border-b border-[var(--border-color)]">
          {monthSeries.map((m, i) => {
            const inH = Math.max(6, Math.round((m.revenue / chartMax) * 100));
            const outH = Math.max(6, Math.round((m.expenses / chartMax) * 100));
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                <span className="text-[9px] font-mono opacity-70 group-hover:opacity-100">
                  {(m.revenue / 1000).toFixed(0)}k/{(m.expenses / 1000).toFixed(0)}k
                </span>
                <div className="w-full flex items-end justify-center gap-0.5 h-full max-w-[40px]">
                  <div className="flex-1 bg-[var(--tr-hover)] rounded-t overflow-hidden h-full flex items-end">
                    <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${inH}%` }} />
                  </div>
                  <div className="flex-1 bg-[var(--tr-hover)] rounded-t overflow-hidden h-full flex items-end">
                    <div className="w-full bg-rose-500 rounded-t" style={{ height: `${outH}%` }} />
                  </div>
                </div>
                <span className="text-[10px] font-bold text-[var(--text-muted)]">{m.key}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input 
            type="text"
            placeholder="Search shareholders by name, phone, CNIC or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full app-input rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block glass-panel rounded-2xl overflow-hidden shadow-xl border border-[var(--border-color)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--tr-hover)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-color)]">
              <tr>
                <th className="p-4">Shareholder Profile</th>
                <th className="p-4">Capital Invested</th>
                <th className="p-4">Cars Owned</th>
                <th className="p-4">Share %</th>
                <th className="p-4">Revenue Generated</th>
                <th className="p-4">Platform Fee (15%)</th>
                <th className="p-4">Shareholder Earnings</th>
                <th className="p-4">Disbursed Payouts</th>
                <th className="p-4">Remaining Due</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {filteredShareholders.length === 0 ? (
                <tr>
                  <td colSpan="10" className="text-center py-12 text-[var(--text-muted)] italic">
                    No shareholder profiles recorded yet. Click "Add New Shareholder" to create one.
                  </td>
                </tr>
              ) : (
                filteredShareholders.map((sh) => {
                  const due = Number(sh.payout_balance_due) || 0;
                  const dueClass = due > 0 ? "text-rose-705 font-bold" : "text-[var(--text-muted)]";
                  return (
                    <tr key={sh.shareholder_id || sh.id} className="hover:bg-[var(--tr-hover)] transition-colors">
                      <td className="p-4 align-middle font-semibold text-[var(--text-main)]">
                        <div>
                          <div className="font-bold text-sm text-[var(--accent-color)]">{sh.full_name}</div>
                          <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">{sh.phone} · {sh.cnic_number || "No CNIC"}</div>
                        </div>
                      </td>
                      <td className="p-4 align-middle font-mono font-bold text-[var(--text-main)] whitespace-nowrap">
                        PKR {sh.investment_amount?.toLocaleString()}
                      </td>
                      <td className="p-4 align-middle">
                        <span className="inline-flex items-center whitespace-nowrap bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 px-2.5 py-1 rounded-full text-[10px] font-bold">
                          {sh.total_cars_owned} {sh.total_cars_owned === 1 ? "car" : "cars"}
                        </span>
                      </td>
                      <td className="p-4 align-middle font-mono font-semibold text-[var(--text-main)]">
                        {sh.payout_type === "fixed" ? `Fixed PKR ${(sh.fixed_amount || 0).toLocaleString()}` : `${sh.share_percentage}%`}
                      </td>
                      <td className="p-4 align-middle font-mono text-emerald-700 dark:text-emerald-400 font-bold whitespace-nowrap">
                        PKR {sh.total_revenue_generated?.toLocaleString()}
                      </td>
                      <td className="p-4 align-middle font-mono text-rose-700 dark:text-rose-455 whitespace-nowrap">
                        PKR {sh.total_platform_fee?.toLocaleString()}
                      </td>
                      <td className="p-4 align-middle font-mono text-teal-700 dark:text-teal-400 font-bold whitespace-nowrap">
                        PKR {sh.total_shareholder_earnings?.toLocaleString()}
                      </td>
                      <td className="p-4 align-middle font-mono text-blue-700 dark:text-blue-400 font-bold whitespace-nowrap">
                        PKR {sh.total_payouts_received?.toLocaleString()}
                      </td>
                      <td className={`p-4 align-middle font-mono font-bold whitespace-nowrap ${dueClass}`}>
                        PKR {due.toLocaleString()}
                      </td>
                      <td className="p-4 align-middle text-right">
                        <div className="inline-flex flex-nowrap items-center justify-end gap-1.5">
                          <button 
                            type="button"
                            onClick={() => setSelectedShareholder(sh)}
                            className="inline-flex items-center justify-center h-8 w-8 bg-teal-600/10 hover:bg-teal-600 text-teal-700 dark:text-teal-400 hover:text-white border border-teal-500/20 rounded-lg transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => { setPayoutTarget(sh); setShowPayoutModal(true); }}
                            className="inline-flex items-center justify-center h-8 w-8 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-700 dark:text-emerald-400 hover:text-white border border-emerald-500/20 rounded-lg transition-all"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => { setEditingShareholder(sh); setShowShareholderModal(true); }}
                            className="inline-flex items-center justify-center h-8 w-8 bg-amber-600/10 hover:bg-amber-600 text-amber-700 dark:text-amber-400 hover:text-white border border-amber-500/20 rounded-lg transition-all"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteShareholder(sh.shareholder_id || sh.id)}
                            className="inline-flex items-center justify-center h-8 w-8 bg-rose-600/10 hover:bg-rose-600 text-rose-700 dark:text-rose-400 hover:text-white border border-rose-500/20 rounded-lg transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filteredShareholders.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl text-center text-[var(--text-muted)] italic text-sm">
            No shareholder profiles yet. Tap Add New Shareholder to create one.
          </div>
        ) : (
          filteredShareholders.map((sh) => (
            <div key={sh.shareholder_id || sh.id} className="glass-panel p-4 rounded-2xl border border-[var(--border-color)] space-y-3">
              <div>
                <h4 className="font-bold text-[var(--accent-color)]">{sh.full_name}</h4>
                <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{sh.phone} · {sh.cnic_number || "No CNIC"}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs keep-cols-2">
                <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-[var(--border-color)]">
                  <span className="text-[9px] uppercase text-[var(--text-muted)] block">Capital</span>
                  <span className="font-mono font-bold text-[var(--text-main)]">PKR {sh.investment_amount?.toLocaleString()}</span>
                </div>
                <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-[var(--border-color)]">
                  <span className="text-[9px] uppercase text-[var(--text-muted)] block">Due</span>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
                    PKR {sh.payout_balance_due?.toLocaleString()}
                  </span>
                </div>
                <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-[var(--border-color)]">
                  <span className="text-[9px] uppercase text-[var(--text-muted)] block">Share / Cars</span>
                  <span className="font-mono font-bold text-[var(--text-main)]">{sh.payout_type === "fixed" ? `Fixed PKR ${(sh.fixed_amount || 0).toLocaleString()}` : `${sh.share_percentage}%`} · {sh.total_cars_owned} car(s)</span>
                </div>
                <div className="bg-[var(--bg-app)] rounded-lg p-2 border border-[var(--border-color)]">
                  <span className="text-[9px] uppercase text-[var(--text-muted)] block">Earnings</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-400">PKR {sh.total_shareholder_earnings?.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--border-color)]">
                <button onClick={() => setSelectedShareholder(sh)} className="flex-1 min-h-[44px] bg-teal-600/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 rounded-lg text-xs font-bold font-sans">View</button>
                <button onClick={() => { setPayoutTarget(sh); setShowPayoutModal(true); }} className="flex-1 min-h-[44px] bg-emerald-600/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold font-sans">Payout</button>
                <button onClick={() => { setEditingShareholder(sh); setShowShareholderModal(true); }} className="min-h-[44px] min-w-[44px] bg-amber-600/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-lg flex items-center justify-center"><Edit2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDeleteShareholder(sh.shareholder_id || sh.id)} className="min-h-[44px] min-w-[44px] bg-rose-600/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 rounded-lg flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: DETAILED VIEW */}
      {selectedShareholder && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-4xl rounded-2xl p-6 shadow-2xl space-y-6 text-xs border border-[var(--border-color)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b border-[var(--border-color)]">
              <div>
                <h3 className="text-xl font-bold text-[var(--accent-color)]">{selectedShareholder.full_name}</h3>
                <p className="text-[var(--text-muted)] text-xs mt-0.5">
                  Phone: {selectedShareholder.phone} | CNIC: {selectedShareholder.cnic_number || "N/A"} | Joined: {selectedShareholder.joined_date}
                </p>
              </div>
              <button onClick={() => setSelectedShareholder(null)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-[var(--tr-hover)] p-4 rounded-xl border border-[var(--border-color)] font-mono">
              <div>
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Invested Capital</span>
                <span className="text-xs font-bold text-[var(--text-main)]">PKR {selectedShareholder.investment_amount?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Revenue Generated</span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">PKR {selectedShareholder.total_revenue_generated?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Platform Fee (15%)</span>
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400">PKR {selectedShareholder.total_platform_fee?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Net Shareholder Cut ({selectedShareholder.share_percentage}%)</span>
                <span className="text-xs font-bold text-teal-700 dark:text-teal-400">PKR {selectedShareholder.total_shareholder_earnings?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[9px] uppercase text-[var(--text-muted)] block">Remaining Payable</span>
                <span className={`text-xs font-bold ${selectedShareholder.payout_balance_due > 0 ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                  PKR {selectedShareholder.payout_balance_due?.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Vehicle Performance Breakdown */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                  <Car className="h-4 w-4 text-teal-700 dark:text-teal-400" /> Owned Vehicles & Financial Performance Breakdown
                </h4>
                <span className="text-[10px] text-[var(--text-muted)]">{selectedShareholder.car_performance?.length || 0} Vehicles Assigned</span>
              </div>

              <div className="border border-[var(--border-color)] rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[var(--tr-hover)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-color)]">
                    <tr>
                      <th className="p-3">Plate #</th>
                      <th className="p-3">Vehicle Model</th>
                      <th className="p-3">Bookings</th>
                      <th className="p-3">Total Revenue</th>
                      <th className="p-3">Platform Fee (15%)</th>
                      <th className="p-3">Shareholder Earnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {!selectedShareholder.car_performance || selectedShareholder.car_performance.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center py-6 text-[var(--text-muted)] italic">
                          No active vehicles linked to this shareholder.
                        </td>
                      </tr>
                    ) : (
                      selectedShareholder.car_performance.map((car, index) => (
                        <tr key={index} className="hover:bg-[var(--tr-hover)] transition-colors">
                          <td className="p-3 font-mono font-bold text-[var(--accent-color)]">{car.plate_number}</td>
                          <td className="p-3 font-semibold text-[var(--text-main)]">{car.make_model}</td>
                          <td className="p-3 font-mono">{car.bookings_count}</td>
                          <td className="p-3 font-mono text-emerald-700 dark:text-emerald-400 font-semibold">PKR {car.total_revenue?.toLocaleString()}</td>
                          <td className="p-3 font-mono text-rose-700 dark:text-rose-455">PKR {car.platform_fee?.toLocaleString()}</td>
                          <td className="p-3 font-mono text-teal-700 dark:text-teal-400 font-bold">PKR {car.partner_earnings?.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payout Transaction History */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-[var(--text-main)] flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-700 dark:text-blue-400" /> Payout Transaction History & Receipts
              </h4>

              <div className="border border-[var(--border-color)] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-[var(--tr-hover)] text-[var(--text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--border-color)]">
                    <tr>
                      <th className="p-3">Reference ID</th>
                      <th className="p-3">Disbursement Date</th>
                      <th className="p-3">Payment Method</th>
                      <th className="p-3">Paid Amount</th>
                      <th className="p-3">Memo / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {!selectedShareholder.payouts || selectedShareholder.payouts.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-6 text-[var(--text-muted)] italic">
                          No payout transactions disbursed yet.
                        </td>
                      </tr>
                    ) : (
                      selectedShareholder.payouts.map((p) => (
                        <tr key={p.id} className="hover:bg-[var(--tr-hover)] transition-colors">
                          <td className="p-3 font-mono font-bold text-[var(--text-muted)]">PAY-SH-{p.id}</td>
                          <td className="p-3 font-mono">{formatMoneyDate(p.payout_date)}</td>
                          <td className="p-3">{p.payment_method}</td>
                          <td className="p-3 font-mono text-blue-700 dark:text-blue-400 font-extrabold">PKR {p.amount?.toLocaleString()}</td>
                          <td className="p-3 text-[var(--text-muted)] italic">{p.notes || "None"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Close footer */}
            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setSelectedShareholder(null)}
                className="bg-[var(--tr-hover)] hover:bg-[var(--border-color)] text-[var(--text-main)] font-semibold px-5 py-2 rounded-xl transition-all"
              >
                Close Trace Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT SHAREHOLDER */}
      {showShareholderModal && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 text-xs border border-[var(--border-color)]">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold text-[var(--text-main)]">
                {editingShareholder ? "Edit Shareholder Profile" : "Register New Shareholder"}
              </h3>
              <button 
                onClick={() => { setShowShareholderModal(false); setEditingShareholder(null); }}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleShareholderSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Full Name *</label>
                  <input 
                    type="text" required
                    value={form.full_name}
                    onChange={(e) => setForm({...form, full_name: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">CNIC / ID Number *</label>
                  <input 
                    type="text" required placeholder="xxxxx-xxxxxxx-x"
                    value={form.cnic_number}
                    onChange={(e) => setForm({...form, cnic_number: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Phone Number *</label>
                  <input 
                    type="text" required
                    value={form.phone}
                    onChange={(e) => setForm({...form, phone: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Email Address</label>
                  <input 
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({...form, email: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Invested Capital (PKR) *</label>
                  <input 
                    type="number" required
                    value={form.investment_amount}
                    onChange={(e) => setForm({...form, investment_amount: parseFloat(e.target.value) || 0})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Payout Type</label>
                  <select
                    value={form.payout_type || "percentage"}
                    onChange={(e) => setForm({...form, payout_type: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (PKR)</option>
                  </select>
                </div>
                {form.payout_type === "fixed" ? (
                  <div>
                    <label className="block text-xs font-semibold text-amber-500 mb-1">Fixed Amount (PKR) *</label>
                    <input 
                      type="number" step="500" min="0" required
                      value={form.fixed_amount}
                      onChange={(e) => setForm({...form, fixed_amount: parseFloat(e.target.value) || 0})}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Share Cut % *</label>
                    <input 
                      type="number" step="0.1" min="0" max="100" required
                      value={form.share_percentage}
                      onChange={(e) => setForm({...form, share_percentage: parseFloat(e.target.value) || 50})}
                      className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Joined Date *</label>
                  <input 
                    type="date" required
                    value={form.joined_date}
                    onChange={(e) => setForm({...form, joined_date: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Remarks / Notes</label>
                  <input 
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm({...form, notes: e.target.value})}
                    className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                  />
                </div>
              </div>

              {/* Vehicle Assignments */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-[var(--text-muted)]">Assign Fleet Vehicles</label>
                <div className="border border-[var(--border-color)] rounded-lg p-3 max-h-36 overflow-y-auto space-y-1.5">
                  {cars.map((car) => {
                    const isAssigned = (form.assigned_car_ids || []).includes(car.id);
                    return (
                      <label key={car.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-[var(--tr-hover)] rounded">
                        <input 
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => toggleCarAssignment(car.id)}
                          className="rounded text-[var(--accent-color)]"
                        />
                        <span className="text-[11px] text-[var(--text-main)] font-medium">
                          {car.make_model} ({car.plate_number}) - <span className="text-[10px] text-[var(--text-muted)] uppercase">{car.status}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => { setShowShareholderModal(false); setEditingShareholder(null); }}
                  className="bg-[var(--tr-hover)] hover:bg-[var(--border-color)] text-[var(--text-main)] font-semibold px-4 py-2 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-accent text-white font-bold px-5 py-2 rounded-xl transition-all shadow-md"
                >
                  {editingShareholder ? "Update Profile" : "Create Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DISBURSE PAYOUT */}
      {showPayoutModal && payoutTarget && (
        <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-panel modal-sheet w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-5 text-xs border border-[var(--border-color)]">
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-bold text-[var(--text-main)]">Log Shareholder Payout</h3>
              <button 
                onClick={() => { setShowPayoutModal(false); setPayoutTarget(null); }}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePayoutSubmit} className="space-y-4">
              <div>
                <span className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Paying to</span>
                <span className="font-bold text-[var(--text-main)] text-sm">{payoutTarget.full_name}</span>
                <span className="block text-[10px] text-rose-700 dark:text-rose-400 font-mono mt-0.5">Due Balance: PKR {payoutTarget.payout_balance_due?.toLocaleString()}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Disbursement Amount (PKR) *</label>
                <input 
                  type="number" required min="1"
                  value={payoutForm.amount}
                  onChange={(e) => setPayoutForm({...payoutForm, amount: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Disbursement Date *</label>
                <input 
                  type="date" required
                  value={payoutForm.payout_date}
                  onChange={(e) => setPayoutForm({...payoutForm, payout_date: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Payment Method *</label>
                <select 
                  value={payoutForm.payment_method}
                  onChange={(e) => setPayoutForm({...payoutForm, payment_method: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5"
                >
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Mobile Wallet">Mobile Wallet</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Remarks / Memo</label>
                <input 
                  type="text"
                  placeholder="e.g. Month July Share"
                  value={payoutForm.notes}
                  onChange={(e) => setPayoutForm({...payoutForm, notes: e.target.value})}
                  className="w-full app-input rounded-lg p-2.5 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => { setShowPayoutModal(false); setPayoutTarget(null); }}
                  className="bg-[var(--tr-hover)] hover:bg-[var(--border-color)] text-[var(--text-main)] font-semibold px-4 py-2 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-lg transition-all"
                >
                  Confirm Payout
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsView({ cars, bookings, customers, financials, maintenance, investors }) {
  const [reportCategory, setReportCategory] = useState("financials");
  const [dateRange, setDateRange] = useState("this_month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [carFilter, setCarFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const getFilteredDates = () => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (dateRange === "today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dateRange === "this_week") {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.getFullYear(), now.getMonth(), diff);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      end.setHours(23, 59, 59, 999);
    } else if (dateRange === "this_month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (dateRange === "this_year") {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else if (dateRange === "custom") {
      start = startDate ? new Date(startDate) : new Date(2000, 0, 1);
      end = endDate ? new Date(endDate + "T23:59:59") : new Date(2099, 11, 31);
    } else {
      start = new Date(2000, 0, 1);
      end = new Date(2099, 11, 31);
    }

    return { start, end };
  };

  const { start, end } = getFilteredDates();

  const isWithinDateRange = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    return d >= start && d <= end;
  };

  const filteredFinancials = filterFinancialsByRange(financials, start, end);
  const filteredMaintenance = filterMaintenanceByRange(maintenance, start, end).filter((m) =>
    carFilter === "all" || String(m.car_id) === String(carFilter)
  );
  const allPayouts = flattenInvestorPayouts(investors);
  const filteredPayouts = filterPayoutsByRange(allPayouts, start, end);

  const filteredBookings = bookings.filter((b) => {
    const inDate = isWithinDateRange(b.start_datetime);
    const matchesCar = carFilter === "all" || String(b.car_id) === String(carFilter);
    const matchesStatus = statusFilter === "all" || b.status === statusFilter;
    return inDate && matchesCar && matchesStatus;
  });

  const filteredCars = cars.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  // Cash in = payments; cash out = maintenance + investor payouts (same math as dashboard)
  const rangeFinancialsForCar = carFilter === "all"
    ? filteredFinancials
    : filteredFinancials.filter((f) => {
        const b = bookings.find((x) => x.id === f.booking_id);
        return b && String(b.car_id) === String(carFilter);
      });

  const totalRevenue = sumCashIn(rangeFinancialsForCar);
  const totalMaint = sumMaintenanceOut(filteredMaintenance);
  const totalPayouts = carFilter === "all" ? sumPayoutsOut(filteredPayouts) : 0;
  const totalExpenses = totalMaint + totalPayouts;
  const netProfit = totalRevenue - totalExpenses;
  const portfolio = investorPortfolioTotals(investors);
  const cashflowLedger = buildCashflowLedger(
    rangeFinancialsForCar,
    filteredMaintenance,
    bookings,
    carFilter === "all" ? filteredPayouts : []
  ).filter((row) => {
    if (carFilter === "all") return true;
    if (row.category === "Investor Payout") return false;
    if (row.type === "Cash Out") return String(row.car_id) === String(carFilter);
    const b = bookings.find((x) => x.id === row.booking_id);
    return b && String(b.car_id) === String(carFilter);
  });

  const exportCSV = () => {
    let csvRows = [];
    let filename = `Report_${reportCategory}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (reportCategory === "financials") {
      csvRows.push(["Ref", "Date", "Description", "Flow", "Category", "Amount (PKR)"]);
      cashflowLedger.forEach((f) => {
        csvRows.push([
          f.id,
          formatMoneyDate(f.date),
          `"${(f.description || "").replace(/"/g, '""')}"`,
          f.type,
          f.category || "",
          f.amount,
        ]);
      });
    } else if (reportCategory === "investors") {
      csvRows.push(["Investor", "Capital", "Revenue", "Maint", "Earnings", "Paid Out", "Due", "Share %"]);
      investors.forEach((inv) => {
        csvRows.push([
          `"${(inv.full_name || "").replace(/"/g, '""')}"`,
          inv.investment_amount || 0,
          inv.total_revenue_generated || 0,
          inv.total_maintenance_cost || 0,
          inv.total_investor_earnings || 0,
          inv.total_payouts_received || 0,
          inv.payout_balance_due || 0,
          inv.profit_share_percentage || 0,
        ]);
      });
    } else if (reportCategory === "cars") {
      csvRows.push(["ID", "Make & Model", "Plate Number", "Daily Rate (PKR)", "Status", "Cash Collected (PKR)"]);
      const carCash = cashCollectedByCar(financials, bookings);
      filteredCars.forEach((c) => {
        csvRows.push([
          c.id,
          `"${(c.make_model || "").replace(/"/g, '""')}"`,
          c.plate_number || "",
          c.daily_rate || 0,
          c.status || "Available",
          carCash[c.id] || 0,
        ]);
      });
    } else if (reportCategory === "bookings") {
      csvRows.push(["Booking ID", "Customer Name", "Vehicle", "Start Date", "End Date", "Est. Charge (PKR)", "Cash Collected (PKR)", "Status"]);
      filteredBookings.forEach((b) => {
        csvRows.push([
          b.id,
          `"${(b.customer?.full_name || "").replace(/"/g, '""')}"`,
          `"${(b.car?.make_model || "").replace(/"/g, '""')}"`,
          b.start_datetime || "",
          b.expected_end_datetime || "",
          estimatedBookingCharge(b),
          sumPaidForBooking(financials, b.id),
          b.status || "",
        ]);
      });
    } else if (reportCategory === "maintenance") {
      csvRows.push(["Maintenance ID", "Vehicle Plate", "Type", "Execution Date", "Cost (PKR)"]);
      filteredMaintenance.forEach((m) => {
        csvRows.push([
          m.id,
          m.car?.plate_number || "",
          `"${(m.log_type || "").replace(/"/g, '""')}"`,
          m.execution_date || "",
          m.cost || 0,
        ]);
      });
    } else if (reportCategory === "customers") {
      csvRows.push(["Customer ID", "Full Name", "CNIC", "Phone", "Total Bookings"]);
      customers.forEach((cust) => {
        const custBookings = bookings.filter((b) => b.customer_id === cust.id).length;
        csvRows.push([
          cust.id,
          `"${(cust.full_name || "").replace(/"/g, '""')}"`,
          cust.cnic_number || "",
          cust.phone_primary || "",
          custBookings,
        ]);
      });
    }

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerPrintReport = () => {
    const printContent = document.getElementById("report-printable-area").innerHTML;
    const originalContent = document.body.innerHTML;
    document.body.innerHTML = `
      <html>
        <head>
          <title>Report Statement - Omnysync</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #000; background: #fff; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #f2f2f2; }
            h1, h2, h3 { margin: 0 0 10px 0; }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `;
    window.print();
    document.body.innerHTML = originalContent;
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-[var(--border-color)]">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--text-main)]">
            <BarChart3 className="h-6 w-6 text-[var(--accent-color)]" />
            Instant Business Reports & Analytics
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Generate, filter, and export automated financial, fleet, customer, and booking statements in seconds.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportCSV} 
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg transition-all"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button 
            onClick={triggerPrintReport} 
            className="flex items-center gap-2 btn-accent text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-lg transition-all"
          >
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)] space-y-4">
        
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[var(--border-color)] pb-4">
          {[
            { id: "financials", label: "Financials & Profit", icon: DollarSign },
            { id: "investors", label: "Investors & Payouts", icon: Briefcase },
            { id: "cars", label: "Fleet & Vehicles", icon: Car },
            { id: "bookings", label: "Bookings & Revenue", icon: Calendar },
            { id: "maintenance", label: "Maintenance Costs", icon: Wrench },
            { id: "customers", label: "Customer Intelligence", icon: Users }
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setReportCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                reportCategory === cat.id
                  ? "bg-[var(--accent-color)] text-white shadow-md"
                  : "bg-[var(--tr-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              <cat.icon className="h-3.5 w-3.5" />
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          
          {/* Date Range Select */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Time Horizon</label>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full app-input rounded-xl p-2.5 font-medium"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Pickers */}
          {dateRange === "custom" && (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">From Date</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full app-input rounded-xl p-2.5 font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">To Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full app-input rounded-xl p-2.5 font-medium"
                />
              </div>
            </>
          )}

          {/* Car Vehicle Filter */}
          {(reportCategory === "bookings" || reportCategory === "maintenance") && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Vehicle Fleet Filter</label>
              <select 
                value={carFilter} 
                onChange={(e) => setCarFilter(e.target.value)}
                className="w-full app-input rounded-xl p-2.5 font-medium"
              >
                <option value="all">All Vehicles</option>
                {cars.map(c => (
                  <option key={c.id} value={c.id}>{c.make_model} ({c.plate_number})</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          {(reportCategory === "bookings" || reportCategory === "cars") && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-[var(--text-muted)] mb-1">Status Filter</label>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full app-input rounded-xl p-2.5 font-medium"
              >
                <option value="all">All Statuses</option>
                {reportCategory === "bookings" ? (
                  <>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Cancelled">Cancelled</option>
                  </>
                ) : (
                  <>
                    <option value="Available">Available</option>
                    <option value="Rented">Rented</option>
                    <option value="Maintenance">Maintenance</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Cash Inflow (Receipts)</span>
          <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono mt-1">
            PKR {totalRevenue.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Booking payments in selected range</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Maintenance Outflow</span>
          <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 font-mono mt-1">
            PKR {totalMaint.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Workshop costs in range</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Investor Payouts</span>
          <div className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 font-mono mt-1">
            PKR {totalPayouts.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">Disbursements in range</span>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-[var(--border-color)]">
          <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">Net Cash Position</span>
          <div className={`text-2xl font-extrabold font-mono mt-1 ${netProfit >= 0 ? 'text-[var(--accent-color)]' : 'text-red-700 dark:text-red-400'}`}>
            PKR {netProfit.toLocaleString()}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">In − maint − payouts</span>
        </div>
      </div>

      {/* Report Printable & Live Preview Table Container */}
      <div className="glass-panel p-6 rounded-2xl border border-[var(--border-color)] space-y-4" id="report-printable-area">
        
        {/* Printable Header */}
        <div className="border-b border-[var(--border-color)] pb-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-main)] uppercase tracking-wider">
              {reportCategory.toUpperCase()} REPORT STATEMENT
            </h3>
            <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
              Generated: {new Date().toLocaleDateString()} | Filter: {dateRange.toUpperCase().replace("_", " ")}
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="font-extrabold text-[var(--accent-color)] block">OMNYSYNC RENTAL MANAGEMENT</span>
            <span className="text-[var(--text-muted)] text-[10px]">Official Audit Record</span>
          </div>
        </div>

        {/* Dynamic Table View */}
        <div className="overflow-x-auto">
          {reportCategory === "financials" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase font-bold text-[10px]">
                  <th className="p-3">Ref ID</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Flow</th>
                  <th className="p-3 text-right">Amount (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] font-mono">
                {cashflowLedger.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-6 text-center text-[var(--text-muted)] italic font-sans">
                      No cash movements found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  cashflowLedger.map((f, i) => (
                    <tr key={`${f.id}-${i}`} className="hover:bg-[var(--tr-hover)]">
                      <td className="p-3 font-bold text-[var(--accent-color)]">#{f.id}</td>
                      <td className="p-3">{formatMoneyDate(f.date)}</td>
                      <td className="p-3 font-sans font-medium">{f.description}</td>
                      <td className="p-3 font-sans text-[var(--text-muted)]">{f.category || "—"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          f.type === "Cash Out"
                            ? "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {f.type}
                        </span>
                      </td>
                      <td className={`p-3 text-right font-bold ${
                        f.type === "Cash Out" ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                      }`}>
                        PKR {Math.abs(f.amount).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {reportCategory === "investors" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase font-bold text-[10px]">
                  <th className="p-3">Investor</th>
                  <th className="p-3 text-right">Capital</th>
                  <th className="p-3 text-right">Fleet Revenue</th>
                  <th className="p-3 text-right">Maint Cost</th>
                  <th className="p-3 text-right">Share Earned</th>
                  <th className="p-3 text-right">Paid Out</th>
                  <th className="p-3 text-right">Still Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] font-mono">
                {(investors || []).length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-[var(--text-muted)] italic font-sans">
                      No investors on record. Add them under the Investors tab.
                    </td>
                  </tr>
                ) : (
                  <>
                    {investors.map((inv) => (
                      <tr key={inv.investor_id} className="hover:bg-[var(--tr-hover)]">
                        <td className="p-3 font-sans font-bold text-[var(--text-main)]">
                          {inv.full_name}
                          <span className="block text-[10px] text-[var(--text-muted)] font-mono">{inv.payout_type === "fixed" ? `Fixed PKR ${(inv.fixed_amount || 0).toLocaleString()}` : `${inv.profit_share_percentage}%`} share · {inv.total_cars_owned} cars</span>
                        </td>
                        <td className="p-3 text-right">PKR {(inv.investment_amount || 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-emerald-700 dark:text-emerald-400">PKR {(inv.total_revenue_generated || 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-amber-700 dark:text-amber-400">PKR {(inv.total_maintenance_cost || 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-teal-700 dark:text-teal-400">PKR {(inv.total_investor_earnings || 0).toLocaleString()}</td>
                        <td className="p-3 text-right text-blue-700 dark:text-blue-400">PKR {(inv.total_payouts_received || 0).toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-rose-700 dark:text-rose-400">PKR {(inv.payout_balance_due || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr className="bg-[var(--tr-hover)] font-bold">
                      <td className="p-3 font-sans">Portfolio Total</td>
                      <td className="p-3 text-right">PKR {portfolio.capital.toLocaleString()}</td>
                      <td className="p-3 text-right">PKR {portfolio.revenue.toLocaleString()}</td>
                      <td className="p-3 text-right">PKR {portfolio.maintenance.toLocaleString()}</td>
                      <td className="p-3 text-right">PKR {portfolio.earnings.toLocaleString()}</td>
                      <td className="p-3 text-right">PKR {portfolio.payouts.toLocaleString()}</td>
                      <td className="p-3 text-right">PKR {portfolio.due.toLocaleString()}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}

          {reportCategory === "cars" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase font-bold text-[10px]">
                  <th className="p-3">ID</th>
                  <th className="p-3">Make & Model</th>
                  <th className="p-3">Plate Number</th>
                  <th className="p-3">Daily Rate</th>
                  <th className="p-3">Bookings</th>
                  <th className="p-3 text-right">Cash Collected</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {(() => {
                  const carCash = cashCollectedByCar(financials, bookings);
                  return filteredCars.map((c) => {
                    const cBookings = bookings.filter((b) => b.car_id === c.id).length;
                    return (
                      <tr key={c.id} className="hover:bg-[var(--tr-hover)]">
                        <td className="p-3 font-mono font-bold text-[var(--accent-color)]">#{c.id}</td>
                        <td className="p-3 font-bold">{c.make_model}</td>
                        <td className="p-3 font-mono">{c.plate_number}</td>
                        <td className="p-3 font-mono">PKR {parseFloat(c.daily_rate || 0).toLocaleString()}</td>
                        <td className="p-3 font-mono font-bold">{cBookings}</td>
                        <td className="p-3 font-mono font-bold text-right text-emerald-700 dark:text-emerald-400">
                          PKR {(carCash[c.id] || 0).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.status === "Rented" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          }`}>
                            {c.status || "Available"}
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          )}

          {reportCategory === "bookings" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase font-bold text-[10px]">
                  <th className="p-3">Booking Ref</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Schedule</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Est. Charge</th>
                  <th className="p-3 text-right">Cash Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] font-mono">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-6 text-center text-[var(--text-muted)] italic font-sans">
                      No bookings match specified date or status filters.
                    </td>
                  </tr>
                ) : (
                  filteredBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-[var(--tr-hover)]">
                      <td className="p-3 font-bold text-[var(--accent-color)]">#RMS-{b.id}</td>
                      <td className="p-3 font-sans font-medium">{b.customer?.full_name || "N/A"}</td>
                      <td className="p-3 font-sans">{b.car?.make_model || "N/A"}</td>
                      <td className="p-3 text-[10px]">
                        {b.start_datetime ? new Date(b.start_datetime).toLocaleDateString() : ""} - {b.expected_end_datetime ? new Date(b.expected_end_datetime).toLocaleDateString() : ""}
                      </td>
                      <td className="p-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                          {b.status || "Active"}
                        </span>
                      </td>
                      <td className="p-3 text-right text-[var(--text-muted)]">
                        PKR {estimatedBookingCharge(b).toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                        PKR {sumPaidForBooking(financials, b.id).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {reportCategory === "maintenance" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase font-bold text-[10px]">
                  <th className="p-3">ID</th>
                  <th className="p-3">Vehicle</th>
                  <th className="p-3">Service Type</th>
                  <th className="p-3">Execution Date</th>
                  <th className="p-3 text-right">Cost (PKR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] font-mono">
                {filteredMaintenance.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-6 text-center text-[var(--text-muted)] italic font-sans">
                      No maintenance events logged for selected filter parameters.
                    </td>
                  </tr>
                ) : (
                  filteredMaintenance.map((m) => (
                    <tr key={m.id} className="hover:bg-[var(--tr-hover)]">
                      <td className="p-3 font-bold text-[var(--accent-color)]">#MNT-{m.id}</td>
                      <td className="p-3 font-sans">{m.car?.make_model || m.car?.plate_number || "N/A"}</td>
                      <td className="p-3 font-sans">{m.log_type || "Service"}{m.notes ? ` — ${m.notes}` : ""}</td>
                      <td className="p-3 text-[10px]">{m.execution_date || "N/A"}</td>
                      <td className="p-3 text-right font-bold text-red-700 dark:text-red-400">
                        PKR {parseFloat(m.cost || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {reportCategory === "customers" && (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase font-bold text-[10px]">
                  <th className="p-3">Cust ID</th>
                  <th className="p-3">Full Name</th>
                  <th className="p-3">CNIC Number</th>
                  <th className="p-3">Contact Phone</th>
                  <th className="p-3">Total Reservations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] font-mono">
                {customers.map((cust) => {
                  const custBookings = bookings.filter(b => b.customer_id === cust.id).length;
                  return (
                    <tr key={cust.id} className="hover:bg-[var(--tr-hover)]">
                      <td className="p-3 font-bold text-[var(--accent-color)]">#CUST-{cust.id}</td>
                      <td className="p-3 font-sans font-bold">{cust.full_name}</td>
                      <td className="p-3">{cust.cnic_number}</td>
                      <td className="p-3">{cust.phone_primary}</td>
                      <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400">{custBookings} Bookings</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function DataVisualizationsView({ cars, bookings, customers, financials, maintenance, investors = [] }) {
  const payouts = flattenInvestorPayouts(investors);
  const portfolio = investorPortfolioTotals(investors);
  const lineMonths = monthlyCashflow(financials, maintenance, 6, payouts);
  const maxTrendVal = Math.max(...lineMonths.map((m) => Math.max(m.revenue, m.expenses)), 1);

  // Fleet status pie
  const rentedCount = cars.filter((c) => c.status === "Rented").length;
  const maintenanceCount = cars.filter((c) => c.status === "Maintenance").length;
  const availableCount = Math.max(0, cars.length - rentedCount - maintenanceCount);

  const totalCars = cars.length || 1;
  const rentedPct = Math.round((rentedCount / totalCars) * 100);
  const maintPct = Math.round((maintenanceCount / totalCars) * 100);
  const availPct = Math.max(0, 100 - rentedPct - maintPct);

  const p1 = rentedPct;
  const p2 = p1 + availPct;
  const pieGradient = `conic-gradient(#10b981 0% ${p1}%, #3b82f6 ${p1}% ${p2}%, #f59e0b ${p2}% 100%)`;

  // Top cars by actual cash collected (payments)
  const carRevenueMap = cashCollectedByCar(financials, bookings);
  const topCarsList = cars
    .map((c) => ({ ...c, totalRev: carRevenueMap[c.id] || 0 }))
    .sort((a, b) => b.totalRev - a.totalRev)
    .slice(0, 5);
  const topCarMax = Math.max(...topCarsList.map((c) => c.totalRev), 1);

  const highestRevCar = topCarsList[0];
  const fleetUtilizationRate = Math.round((rentedCount / totalCars) * 100);
  const totalRevSum = sumCashIn(financials);
  const totalExpSum = sumMaintenanceOut(maintenance) + sumPayoutsOut(payouts);
  const allTimeNet = netEarnings(financials, maintenance, payouts);
  const marginPct = totalRevSum > 0 ? Math.round((allTimeNet / totalRevSum) * 100) : 0;
  const expensePct = totalRevSum > 0 ? Math.round((totalExpSum / totalRevSum) * 100) : 0;

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-[var(--border-color)]">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--text-main)]">
            <PieChart className="h-6 w-6 text-[var(--accent-color)]" />
            Executive Data Visualizations & Business Intelligence
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Live graphs synced to payments, maintenance, and investor payouts — same ledger as Dashboard & Reports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-[var(--accent-color)]/10 text-[var(--accent-color)] border border-[var(--accent-color)]/20 px-3 py-1.5 rounded-xl">
            Live Cashflow Sync
          </span>
        </div>
      </div>

      {portfolio.count > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-panel p-4 rounded-xl border border-[var(--border-color)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Investor Capital</span>
            <div className="font-mono font-bold text-[var(--text-main)] mt-1">PKR {portfolio.capital.toLocaleString()}</div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-[var(--border-color)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Share Earned</span>
            <div className="font-mono font-bold text-teal-700 dark:text-teal-400 mt-1">PKR {portfolio.earnings.toLocaleString()}</div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-[var(--border-color)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Paid Out</span>
            <div className="font-mono font-bold text-blue-700 dark:text-blue-400 mt-1">PKR {portfolio.payouts.toLocaleString()}</div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-[var(--border-color)]">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Still Due</span>
            <div className="font-mono font-bold text-rose-700 dark:text-rose-400 mt-1">PKR {portfolio.due.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Actionable Executive Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" /> Key Growth Insight
          </span>
          <h4 className="text-sm font-bold text-[var(--text-main)]">
            Fleet Utilization is at <span className="text-emerald-700 dark:text-emerald-400 font-mono font-extrabold">{fleetUtilizationRate}%</span>
          </h4>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            {fleetUtilizationRate >= 50 
              ? "High vehicle demand detected. Consider expanding high-performing luxury models."
              : "Fleet availability is optimal. Recommended to run promotional weekday discount campaigns."}
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1">
            <Car className="h-3.5 w-3.5" /> Top Revenue Vehicle
          </span>
          <h4 className="text-sm font-bold text-[var(--text-main)]">
            {highestRevCar ? `${highestRevCar.make_model} (${highestRevCar.plate_number})` : "N/A"}
          </h4>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Collected <strong className="text-blue-700 dark:text-blue-400 font-mono">PKR {(highestRevCar?.totalRev || 0).toLocaleString()}</strong> in actual payments.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" /> Profit Margin Ratio
          </span>
          <h4 className="text-sm font-bold text-[var(--text-main)]">
            {marginPct}% Net Margin
          </h4>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Maintenance + investor payouts are {expensePct}% of gross receipts (PKR {allTimeNet.toLocaleString()} net retained).
          </p>
        </div>

      </div>

      {/* Main Charts Grid: Line Chart & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Line Chart: Revenue vs Expense Trend (2 Cols) */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2 text-[var(--text-main)]">
                <LineChart className="h-5 w-5 text-teal-700 dark:text-teal-400" /> Cash In vs Total Cash Out (6-Month Trend)
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Receipts vs maintenance + investor payouts — same ledger as Dashboard & Reports.</p>
            </div>
            
            <div className="flex items-center gap-3 text-xs font-bold font-mono">
              <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Cash In
              </span>
              <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Cash Out
              </span>
            </div>
          </div>

          {/* Line Chart Visual SVG Grid */}
          <div className="pt-4 space-y-4">
            <div className="relative h-60 w-full flex items-end pt-8 pb-4">
              
              <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                <line x1="0" y1="20%" x2="100%" y2="20%" stroke="var(--border-color)" strokeDasharray="3 3" opacity="0.4" />
                <line x1="0" y1="50%" x2="100%" y2="50%" stroke="var(--border-color)" strokeDasharray="3 3" opacity="0.4" />
                <line x1="0" y1="80%" x2="100%" y2="80%" stroke="var(--border-color)" strokeDasharray="3 3" opacity="0.4" />

                {(() => {
                  const points = lineMonths.map((m, idx) => {
                    const x = (idx / Math.max(lineMonths.length - 1, 1)) * 94 + 3;
                    const y = 90 - (m.revenue / maxTrendVal) * 75;
                    return `${x}%,${y}%`;
                  }).join(" ");
                  return (
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3.5"
                      points={points}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })()}

                {(() => {
                  const points = lineMonths.map((m, idx) => {
                    const x = (idx / Math.max(lineMonths.length - 1, 1)) * 94 + 3;
                    const y = 90 - (m.expenses / maxTrendVal) * 75;
                    return `${x}%,${y}%`;
                  }).join(" ");
                  return (
                    <polyline
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="3"
                      strokeDasharray="4 2"
                      points={points}
                      strokeLinecap="round"
                    />
                  );
                })()}
              </svg>

              <div className="w-full flex justify-between items-end relative z-10 px-2 h-full">
                {lineMonths.map((m, idx) => (
                  <div key={idx} className="flex flex-col items-center group h-full justify-end">
                    <div className="flex flex-col items-center text-[9px] font-mono font-bold space-y-0.5 opacity-80 group-hover:opacity-100 transition-opacity mb-2">
                      <span className="text-emerald-700 dark:text-emerald-400">In: {(m.revenue / 1000).toFixed(0)}k</span>
                      <span className="text-rose-700 dark:text-rose-400">Out: {(m.expenses / 1000).toFixed(0)}k</span>
                    </div>
                    <div className="relative flex items-center justify-center my-1">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-[var(--bg-app)] shadow-md group-hover:scale-125 transition-transform" />
                    </div>
                    <span className="text-[11px] font-bold text-[var(--text-muted)] group-hover:text-[var(--text-main)] transition-colors mt-2">
                      {m.key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pie / Donut Chart: Fleet Distribution (1 Col) */}
        <div className="glass-panel p-6 rounded-2xl space-y-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
              <h3 className="font-bold text-base flex items-center gap-2 text-[var(--text-main)]">
                <PieChart className="h-5 w-5 text-amber-700 dark:text-amber-400" /> Fleet Status Pie Breakdown
              </h3>
              <span className="text-xs font-mono font-bold text-[var(--text-muted)]">{cars.length} Cars</span>
            </div>

            <div className="flex justify-center items-center py-6">
              <div 
                className="w-44 h-44 rounded-full relative flex items-center justify-center shadow-2xl border-4 border-[var(--border-color)]"
                style={{ background: pieGradient }}
              >
                <div className="w-28 h-28 rounded-full bg-[var(--bg-app)] flex flex-col items-center justify-center shadow-inner text-center">
                  <span className="text-2xl font-extrabold text-[var(--text-main)] font-mono">{rentedPct}%</span>
                  <span className="text-[9px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Fleet Active</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-[var(--border-color)] pt-4 text-xs">
            <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="font-bold text-[var(--text-main)]">Rented Vehicles</span>
              </div>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{rentedCount} ({rentedPct}%)</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="font-bold text-[var(--text-main)]">Available Fleet</span>
              </div>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-400">{availableCount} ({availPct}%)</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="font-bold text-[var(--text-main)]">In Workshop Maintenance</span>
              </div>
              <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{maintenanceCount} ({maintPct}%)</span>
            </div>
          </div>
        </div>

      </div>

      {/* Top Performing Vehicles Ranking Bar Chart */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex justify-between items-center pb-3 border-b border-[var(--border-color)]">
          <h3 className="font-bold text-base flex items-center gap-2 text-[var(--text-main)]">
            <Car className="h-5 w-5 text-[var(--accent-color)]" /> Top 5 Revenue Generating Vehicles
          </h3>
          <span className="text-xs text-[var(--text-muted)] font-mono">Ranked by cash collected</span>
        </div>

        <div className="space-y-4 pt-2">
          {topCarsList.every((c) => c.totalRev === 0) ? (
            <p className="text-xs text-[var(--text-muted)] italic text-center py-4">No payment receipts recorded yet.</p>
          ) : (
            topCarsList.map((car, idx) => {
              const widthPct = Math.max(5, Math.round((car.totalRev / topCarMax) * 100));
              return (
                <div key={car.id} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[var(--accent-color)]/20 text-[var(--accent-color)] text-[10px] font-extrabold flex items-center justify-center font-mono">
                        #{idx + 1}
                      </span>
                      <span className="text-[var(--text-main)]">{car.make_model} <span className="text-[var(--text-muted)] font-mono">({car.plate_number})</span></span>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">PKR {car.totalRev.toLocaleString()}</span>
                  </div>

                  <div className="w-full bg-[var(--tr-hover)] h-3 rounded-full overflow-hidden border border-[var(--border-color)]">
                    <div 
                      className="bg-gradient-to-r from-teal-500 to-[var(--accent-color)] h-full rounded-full transition-all duration-700 shadow-md"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}

function CalendarGridSection({ bookings, cars, customers, setShowModal, setForm, onBookingClick, onDayOverflow }) {
  const safeBookings = bookings || [];
  const safeCars = cars || [];
  const safeCustomers = customers || [];
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Align to Monday
    return { offset, totalDays };
  };

  const { offset, totalDays } = getDaysInMonth(currentDate);
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Card className="shadow-lg border-[var(--border-color)] mb-6 overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[var(--border-color)] p-4 sm:p-6">
        <div className="min-w-0">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-[var(--text-main)]">
            <Calendar className="h-5 w-5 text-[var(--accent-color)] shrink-0" /> Monthly Reservation Calendar
          </CardTitle>
          <CardDescription className="text-xs text-[var(--text-muted)] mt-0.5">Tap a booking chip for details, or an empty date to create a reservation.</CardDescription>
        </div>
        <div className="cal-nav flex items-center gap-2 sm:gap-3">
          <Button variant="outline" size="sm" className="min-h-[40px] px-3" onClick={prevMonth}>&larr;</Button>
          <span className="text-sm font-bold font-mono text-[var(--text-main)] flex-1 sm:min-w-[140px] text-center truncate">
            {currentDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </span>
          <Button variant="outline" size="sm" className="min-h-[40px] px-3" onClick={nextMonth}>&rarr;</Button>
        </div>
      </CardHeader>

      <CardContent className="p-3 sm:p-6">
        <div className="cal-weekdays grid grid-cols-7 gap-2 text-center text-xs font-bold text-[var(--text-muted)] border-b border-[var(--border-color)] pb-2 mb-2">
          {weekDays.map(d => <div key={d} className="cal-weekday">{d.slice(0, 1)}<span className="hidden sm:inline">{d.slice(1)}</span></div>)}
        </div>

        <div className="cal-grid grid grid-cols-7 gap-2">
          {Array.from({ length: offset }).map((_, idx) => (
            <div key={`offset-${idx}`} className="h-16 sm:h-24 bg-slate-900/5 dark:bg-zinc-900/10 border border-transparent rounded-xl" />
          ))}

          {daysArray.map(day => {
            const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateStr = dateObj.toDateString();

            const dayBookings = safeBookings.filter(b => {
              if (!b.start_datetime || !b.expected_end_datetime) return false;
              if (b.status !== "Active" && b.status !== "Reserved") return false;
              const start = new Date(b.start_datetime);
              const end = new Date(b.expected_end_datetime);
              if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
              start.setHours(0,0,0,0);
              end.setHours(23,59,59,999);
              return dateObj >= start && dateObj <= end;
            });

            return (
              <div 
                key={day}
                onClick={() => {
                  const localDateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}T10:00`;
                  const tomorrowObj = new Date(dateObj.getTime() + 86400000);
                  const localTomorrowStr = `${tomorrowObj.getFullYear()}-${String(tomorrowObj.getMonth() + 1).padStart(2, '0')}-${String(tomorrowObj.getDate()).padStart(2, '0')}T10:00`;
                  
                  setForm({
                    car_id: "",
                    customer_id: "",
                    start_datetime: localDateStr,
                    expected_end_datetime: localTomorrowStr,
                    daily_rate: 3000,
                    is_chauffeur_driven: false,
                    chauffeur_daily_wage: 1500,
                    security_deposit_amount: 10000,
                    security_deposit_type: "Cash",
                    security_deposit_status: "Held"
                  });
                  setShowModal(true);
                }}
                className="cal-day-cell h-16 sm:h-24 bg-[var(--tr-hover)] hover:bg-[var(--border-color)]/30 border border-[var(--border-color)] rounded-xl p-1 sm:p-2 flex flex-col justify-between transition-all duration-200 cursor-pointer group active:scale-[0.98]"
              >
                <span className="text-[10px] sm:text-xs font-bold text-[var(--text-muted)] group-hover:text-[var(--accent-color)] font-mono">{day}</span>
                
                <div className="space-y-0.5 sm:space-y-1 overflow-hidden h-10 sm:h-14 flex flex-col justify-end">
                  {dayBookings.slice(0, 2).map((b, idx) => {
                    const car = b.car || safeCars.find(c => c.id === b.car_id);
                    const customer = b.customer || safeCustomers.find(c => c.id === b.customer_id);
                    const carName = car?.make_model?.split(" ")[0] || "Car";
                    const custName = customer?.full_name?.split(" ")[0] || "Client";
                    return (
                      <div 
                        key={b.id || idx}
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onBookingClick) {
                            onBookingClick({ ...b, car, customer });
                          }
                        }}
                        className={`cal-chip text-[8px] sm:text-[9px] font-bold px-0.5 sm:px-1 py-0.5 rounded truncate cursor-pointer hover:brightness-125 ${
                          b.status === "Reserved"
                            ? "bg-amber-500/15 border border-amber-500/20 text-amber-700 dark:text-amber-400"
                            : "bg-emerald-500/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        }`}
                        title={`${customer?.full_name || "Client"} - ${car?.make_model || "Car"} (${b.status}) — click to view`}
                      >
                        <span className="sm:hidden">{carName.slice(0, 4)}</span>
                        <span className="hidden sm:inline">{carName} ({custName})</span>
                      </div>
                    );
                  })}
                  {dayBookings.length > 2 && (
                    <div
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDayOverflow) {
                          onDayOverflow(dayBookings.map(b => ({
                            ...b,
                            car: b.car || safeCars.find(c => c.id === b.car_id),
                            customer: b.customer || safeCustomers.find(c => c.id === b.customer_id)
                          })));
                        }
                      }}
                      className="text-[8px] text-teal-700 dark:text-teal-400 font-bold text-center cursor-pointer hover:underline"
                      title="View all bookings this day"
                    >
                      +{dayBookings.length - 2}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentVaultView({ customers, cars, investors, fetchData }) {
  const [activeSubTab, setActiveSubTab] = useState("customers");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">Document Vault</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">Centralized vault for vehicle registration papers, driver CNIC scans, and investor records.</p>
        </div>
      </div>

      {/* Sub tabs selector */}
      <div className="mobile-h-scroll border-b border-[var(--border-color)] pb-3">
        {["customers", "cars", "investors"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeSubTab === tab 
                ? "bg-[var(--accent-color)] text-white" 
                : "text-[var(--text-muted)] hover:bg-[var(--tr-hover)]"
            }`}
          >
            {tab} Documents
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeSubTab === "customers" && customers.map(cust => (
          <Card key={cust.id} className="overflow-hidden hover:border-[var(--accent-color)] transition-all">
            <CardHeader className="pb-3 border-b border-[var(--border-color)]">
              <CardTitle className="text-sm font-bold text-[var(--text-main)]">{cust.full_name}</CardTitle>
              <CardDescription className="text-[10px] font-mono uppercase">{cust.cnic_number}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <p className="text-[10px] text-[var(--text-muted)]">
                License expiry: <span className="font-mono text-[var(--text-main)] font-semibold">{cust.license_expiry_date ? String(cust.license_expiry_date).slice(0, 10) : "Not set"}</span>
              </p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="border border-[var(--border-color)] p-2 rounded-xl bg-[var(--bg-app)]">
                  <span className="block text-[10px] text-[var(--text-muted)] font-bold mb-1">CNIC Front</span>
                  {cust.cnic_front_path ? (
                    <img src={cust.cnic_front_path} alt="Front CNIC" className="h-16 w-full object-cover rounded" />
                  ) : <span className="text-[10px] italic text-[var(--text-muted)]">No scan</span>}
                </div>
                <div className="border border-[var(--border-color)] p-2 rounded-xl bg-[var(--bg-app)]">
                  <span className="block text-[10px] text-[var(--text-muted)] font-bold mb-1">CNIC Back</span>
                  {cust.cnic_back_path ? (
                    <img src={cust.cnic_back_path} alt="Back CNIC" className="h-16 w-full object-cover rounded" />
                  ) : <span className="text-[10px] italic text-[var(--text-muted)]">No scan</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {activeSubTab === "cars" && cars.map(car => (
          <Card key={car.id} className="overflow-hidden hover:border-[var(--accent-color)] transition-all">
            <CardHeader className="pb-3 border-b border-[var(--border-color)]">
              <CardTitle className="text-sm font-bold text-[var(--text-main)]">{car.make_model}</CardTitle>
              <CardDescription className="text-[10px] font-mono uppercase">{car.plate_number}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-1 text-[9px] text-center mb-1">
                <div className="border border-[var(--border-color)] rounded-lg p-1.5">
                  <span className="block text-[var(--text-muted)] font-bold">Reg Exp</span>
                  <span className="font-mono text-[var(--text-main)]">{car.registration_expiry_date ? String(car.registration_expiry_date).slice(0,10) : "—"}</span>
                </div>
                <div className="border border-[var(--border-color)] rounded-lg p-1.5">
                  <span className="block text-[var(--text-muted)] font-bold">Fitness</span>
                  <span className="font-mono text-[var(--text-main)]">{car.fitness_expiry_date ? String(car.fitness_expiry_date).slice(0,10) : "—"}</span>
                </div>
                <div className="border border-[var(--border-color)] rounded-lg p-1.5">
                  <span className="block text-[var(--text-muted)] font-bold">Token Tax</span>
                  <span className="font-mono text-[var(--text-main)]">{car.token_tax_expiry_date ? String(car.token_tax_expiry_date).slice(0,10) : "—"}</span>
                </div>
              </div>
              {[
                { label: "Registration Papers", url: car.registration_doc_url },
                { label: "Fitness Certificate", url: car.fitness_cert_url },
                { label: "Token Tax Receipt", url: car.token_tax_doc_url },
                { label: "Vehicle Photo", url: car.image_url }
              ].map(doc => (
                <div key={doc.label} className="border border-[var(--border-color)] p-3 rounded-xl bg-[var(--bg-app)] text-center">
                  <span className="block text-[10px] text-[var(--text-muted)] font-bold mb-1">{doc.label}</span>
                  {doc.url ? (
                    /\.(pdf)(\?|$)/i.test(doc.url) ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-[11px] text-[var(--accent-color)] font-semibold underline inline-flex items-center gap-1 justify-center">
                        <FileText className="h-3.5 w-3.5" /> Open PDF
                      </a>
                    ) : (
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        <img src={doc.url} alt={doc.label} className="h-20 w-full object-cover rounded" />
                      </a>
                    )
                  ) : (
                    <span className="text-[10px] italic text-[var(--text-muted)]">Not uploaded — add via Fleet → Edit</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {activeSubTab === "investors" && investors.map(inv => (
          <Card key={inv.investor_id || inv.id} className="overflow-hidden hover:border-[var(--accent-color)] transition-all">
            <CardHeader className="pb-3 border-b border-[var(--border-color)]">
              <CardTitle className="text-sm font-bold text-[var(--text-main)]">{inv.full_name}</CardTitle>
              <CardDescription className="text-[10px] font-mono uppercase">{inv.cnic_number || "No CNIC logged"}</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="text-[11px] text-[var(--text-muted)] space-y-1">
                <p>Profit Share: <span className="text-[var(--text-main)] font-semibold">{inv.payout_type === "fixed" ? `Fixed PKR ${(inv.fixed_amount || 0).toLocaleString()}` : `${inv.profit_share_percentage}%`}</span></p>
                <p>Capital: <span className="text-[var(--text-main)] font-semibold">PKR {inv.investment_amount?.toLocaleString()}</span></p>
                <p>Fleet Revenue: <span className="text-emerald-700 dark:text-emerald-400 font-semibold">PKR {(inv.total_revenue_generated || 0).toLocaleString()}</span></p>
                <p>Paid Out / Due: <span className="text-blue-700 dark:text-blue-400 font-semibold">PKR {(inv.total_payouts_received || 0).toLocaleString()}</span>
                  {" / "}
                  <span className="text-rose-700 dark:text-rose-400 font-semibold">PKR {(inv.payout_balance_due || 0).toLocaleString()}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}



