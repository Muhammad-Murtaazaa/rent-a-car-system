import React from "react";
import {
  CalendarPlus, Car, UserPlus, Receipt, Briefcase, Calendar,
  CheckCircle, KeyRound, ListChecks, Wallet,
} from "lucide-react";
import { localTodayStr } from "./dateUtils";
import { sumCashIn } from "./financeUtils";

// Simple Mode dashboard: shown only to tenants whose feature_flags include
// "simple_mode" (set per-tenant from Super Admin). Big buttons, plain
// words, everything important one tap away. Other tenants never see this.
export default function SimpleDashboardView({
  branding,
  cars = [],
  bookings = [],
  financials = [],
  onNewBooking,
  onAddCar,
  onAddCustomer,
  onNewReceipt,
  onAddExpense,
  goTab,
}) {
  const today = localTodayStr();
  const todayLabel = new Date(`${today}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const carsFree = cars.filter((c) => c.status === "Available").length;
  const carsOut = cars.filter((c) => c.status === "Rented").length;
  const activeBookings = bookings.filter((b) => b.status === "Active");
  const moneyReceived = sumCashIn(financials);

  const carLabel = (b) => {
    if (b.booked_cars?.length) {
      return b.booked_cars.map((bc) => `${bc.car?.make_model || ""} (${bc.car?.plate_number || ""})`).join(", ");
    }
    return b.car ? `${b.car.make_model} (${b.car.plate_number})` : "Car";
  };

  const latestPayments = [...(financials || [])]
    .sort((a, b) => String(b.payment_datetime || "").localeCompare(String(a.payment_datetime || "")))
    .slice(0, 6);

  const actions = [
    { label: "New Booking", icon: CalendarPlus, onClick: onNewBooking, primary: true },
    { label: "Add Car", icon: Car, onClick: onAddCar },
    { label: "Add Customer", icon: UserPlus, onClick: onAddCustomer },
    { label: "New Receipt", icon: Receipt, onClick: onNewReceipt },
    { label: "Add Office Expense", icon: Briefcase, onClick: onAddExpense },
    { label: "See All Bookings", icon: Calendar, onClick: () => goTab("bookings") },
  ];

  const stats = [
    { label: "Cars Free Now", value: carsFree, icon: CheckCircle },
    { label: "Cars Out on Rent", value: carsOut, icon: KeyRound },
    { label: "Bookings Running", value: activeBookings.length, icon: ListChecks },
    { label: "Money Received", value: `PKR ${Number(moneyReceived || 0).toLocaleString()}`, icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[var(--text-main)]">
          Welcome to {branding?.name || "your rental office"}
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">Today is {todayLabel}. Tap any button below — everything is one tap away.</p>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {actions.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={
                a.primary
                  ? "btn-accent text-white rounded-2xl py-6 px-4 flex flex-col items-center gap-2.5 shadow-lg transition-all"
                  : "glass-panel border border-[var(--border-color)] rounded-2xl py-6 px-4 flex flex-col items-center gap-2.5 text-[var(--text-main)] hover:bg-[var(--tr-hover)] transition-all"
              }
            >
              <a.icon className="h-8 w-8" />
              <span className="text-base md:text-lg font-bold">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Simple numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass-panel rounded-2xl border border-[var(--border-color)] p-5 text-center">
            <s.icon className="h-6 w-6 mx-auto text-teal-600 dark:text-teal-400" />
            <p className="text-2xl md:text-3xl font-bold text-[var(--text-main)] mt-2">{s.value}</p>
            <p className="text-xs md:text-sm font-semibold text-[var(--text-muted)] mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cars out right now */}
        <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-5">
          <h3 className="text-base font-bold text-[var(--text-main)] mb-3">Cars Out Right Now</h3>
          {activeBookings.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No cars are out right now. Tap "New Booking" to rent one out.</p>
          ) : (
            <div className="divide-y divide-[var(--border-color)]">
              {activeBookings.slice(0, 6).map((b) => (
                <div key={b.id} className="py-3">
                  <p className="font-bold text-[var(--text-main)]">{b.customer?.full_name || "Customer"}</p>
                  <p className="text-sm text-[var(--text-muted)]">{carLabel(b)}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    Return date: <span className="font-semibold text-[var(--text-main)]">{b.end_date}</span>
                    {b.customer?.phone_primary ? <> · {b.customer.phone_primary}</> : null}
                  </p>
                </div>
              ))}
            </div>
          )}
          {activeBookings.length > 6 && (
            <button onClick={() => goTab("bookings")} className="mt-3 text-sm font-bold text-teal-700 dark:text-teal-400">
              See all {activeBookings.length} bookings →
            </button>
          )}
        </div>

        {/* Latest payments */}
        <div className="glass-panel rounded-2xl border border-[var(--border-color)] p-5">
          <h3 className="text-base font-bold text-[var(--text-main)] mb-3">Latest Payments Received</h3>
          {latestPayments.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No payments yet. Payments you record on bookings will show here.</p>
          ) : (
            <div className="divide-y divide-[var(--border-color)]">
              {latestPayments.map((f) => (
                <div key={f.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-[var(--text-main)]">PKR {Number(f.amount_paid || 0).toLocaleString()}</p>
                    <p className="text-sm text-[var(--text-muted)]">{String(f.payment_datetime || "").slice(0, 10)} · {f.payment_method || "Cash"}</p>
                  </div>
                  <button onClick={() => goTab("receipts")} className="text-sm font-bold text-teal-700 dark:text-teal-400 shrink-0">
                    Receipts →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
