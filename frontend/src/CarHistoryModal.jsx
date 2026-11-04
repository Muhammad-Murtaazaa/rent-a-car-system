import React, { useState, useEffect } from "react";
import { X, Calendar, Wrench, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";

export default function CarHistoryModal({ isOpen, onClose, carId, userRole }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("rentals"); // "rentals" or "maintenance"

  useEffect(() => {
    if (isOpen && carId) {
      setLoading(true);
      fetch(`/api/cars/${carId}/history`, {
        headers: {
          "X-Test-Role": userRole
        }
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load history");
          return res.json();
        })
        .then((payload) => {
          setData(payload);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [isOpen, carId, userRole]);

  if (!isOpen) return null;

  const isDeskStaff = false; // Always show full history and metrics to everyone

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="glass-panel modal-sheet w-full max-w-3xl rounded-xl p-6 shadow-sm space-y-6 border border-[var(--border-color)] max-h-[90vh] overflow-y-auto page-enter">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-4 border-b border-[var(--border-color)]">
          <div>
            <h3 className="text-xl font-bold text-[var(--text-main)]">
              {loading ? "Loading History..." : `${data?.car?.make_model} History`}
            </h3>
            {!loading && data?.car && (
              <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                Plate Number: {data.car.plate_number} • Status: {data.car.status}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)] min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Financial metrics & mask validation */}
            {isDeskStaff ? (
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">Financial Metrics Restricted</h4>
                  <p className="text-xs mt-1 text-[var(--text-muted)] leading-relaxed">
                    Logistical data only. Detailed revenue, oil change costing, and profit breakdowns are restricted to managers.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[var(--tr-hover)] p-4 rounded-xl border border-[var(--border-color)] flex items-center gap-3">
                  <div className="bg-emerald-500/10 p-2 rounded-lg">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Total Earnings</span>
                    <span className="block text-base font-extrabold text-[var(--text-main)] mt-0.5">
                      PKR {data.total_earnings?.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="bg-[var(--tr-hover)] p-4 rounded-xl border border-[var(--border-color)] flex items-center gap-3">
                  <div className="bg-rose-500/10 p-2 rounded-lg">
                    <Wrench className="h-5 w-5 text-rose-500" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Maintenance Outlay</span>
                    <span className="block text-base font-extrabold text-[var(--text-main)] mt-0.5">
                      PKR {data.total_maintenance_cost?.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="bg-[var(--tr-hover)] p-4 rounded-xl border border-[var(--border-color)] flex items-center gap-3">
                  <div className="bg-teal-500/10 p-2 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-teal-605" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Net Earnings</span>
                    <span className="block text-base font-extrabold text-[var(--text-main)] mt-0.5">
                      PKR {data.net_profit?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Ownership & Partner Allocation Panel */}
            {data?.car && !isDeskStaff && (
              <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-app)] text-xs space-y-2">
                <div className="flex justify-between items-center border-b border-[var(--border-color)] pb-2 mb-2">
                  <span className="font-bold text-[var(--text-main)]">Ownership & Partner Allocation</span>
                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-wider ${
                    data.car.owner_type === "Company" ? "bg-slate-500/15 text-slate-600 dark:text-slate-400" :
                    data.car.owner_type === "Investor" ? "bg-blue-500/15 text-blue-600 dark:text-blue-400" :
                    "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  }`}>
                    {data.car.owner_type} Owned
                  </span>
                </div>
                {data.car.owner_type !== "Company" ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block font-semibold uppercase tracking-wider">Partner Name</span>
                      <span className="font-bold text-[var(--text-main)] text-sm">{data.car.owner_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block font-semibold uppercase tracking-wider">Partner Share %</span>
                      <span className="font-bold text-[var(--text-main)] text-sm">{data.car.partner_share}%</span>
                    </div>
                    {data.car.owner_type === "Shareholder" && (
                      <div>
                        <span className="text-[10px] text-[var(--text-muted)] block font-semibold uppercase tracking-wider">Platform Fee (15%)</span>
                        <span className="font-bold text-rose-600 dark:text-rose-450 text-sm">PKR {data.car.platform_fee?.toLocaleString()}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block font-semibold uppercase tracking-wider">Partner Earnings</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">PKR {data.car.partner_earnings?.toLocaleString()}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--text-muted)] italic">This vehicle is owned directly by the company fleet. 100% net earnings retained.</p>
                )}
              </div>
            )}

            {/* Toggle Tabs */}
            <div className="flex border-b border-[var(--border-color)]">
              <button
                onClick={() => setActiveTab("rentals")}
                className={`py-2.5 px-4 text-sm font-semibold transition-all border-b-2 min-h-[44px] ${
                  activeTab === "rentals"
                    ? "border-teal-500 text-teal-500 font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                Rental Logs ({data.bookings?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab("maintenance")}
                className={`py-2.5 px-4 text-sm font-semibold transition-all border-b-2 min-h-[44px] ${
                  activeTab === "maintenance"
                    ? "border-teal-500 text-teal-500 font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                Maintenance Ledger ({data.maintenance_logs?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab("transactions")}
                className={`py-2.5 px-4 text-sm font-semibold transition-all border-b-2 min-h-[44px] ${
                  activeTab === "transactions"
                    ? "border-teal-500 text-teal-500 font-bold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                Transaction Ledger ({data.financials?.length || 0})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="space-y-4">
              {activeTab === "rentals" && (
                <div className="space-y-3">
                  {data.bookings?.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic py-8 text-center">No past rental logs logged.</p>
                  ) : (
                    data.bookings.map((booking) => (
                      <div key={booking.id} className="bg-[var(--tr-hover)] p-4 rounded-xl border border-[var(--border-color)] space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-[var(--text-main)]">{booking.customer.full_name}</h4>
                            <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">CNIC: {booking.customer.cnic_number} • Phone: {booking.customer.phone_primary}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            booking.status === "Active" ? "bg-teal-500/10 text-teal-650" :
                            booking.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" :
                            "bg-red-500/10 text-red-500"
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-semibold flex justify-between pt-1 border-t border-[var(--border-color)]/50">
                          <span>Start: {new Date(booking.start_datetime).toLocaleString()}</span>
                          <span>End: {booking.actual_return_datetime ? new Date(booking.actual_return_datetime).toLocaleString() : new Date(booking.expected_end_datetime).toLocaleString()}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "maintenance" && (
                <div className="space-y-3">
                  {data.maintenance_logs?.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic py-8 text-center">No maintenance logs found.</p>
                  ) : (
                    data.maintenance_logs.map((log) => (
                      <div key={log.id} className="bg-[var(--tr-hover)] p-4 rounded-xl border border-[var(--border-color)] space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-[var(--text-main)]">{log.log_type}</h4>
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Executed: {new Date(log.execution_date).toLocaleDateString()}</p>
                          </div>
                          {!isDeskStaff && (
                            <span className="font-mono font-bold text-rose-500 text-xs">
                              PKR {log.cost?.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{log.notes || "No extra remarks logged."}</p>
                        {log.next_due_date_or_odometer && (
                          <div className="pt-1.5 border-t border-[var(--border-color)]/50 text-[10px] text-teal-655 font-semibold">
                            Next Due: {log.next_due_date_or_odometer}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "transactions" && (
                <div className="space-y-3">
                  {data.financials?.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic py-8 text-center">No transactions registered yet.</p>
                  ) : (
                    data.financials.map((tx) => (
                      <div key={tx.id} className="bg-[var(--tr-hover)] p-4 rounded-xl border border-[var(--border-color)] space-y-2 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-[var(--text-main)]">Payment Receipt #{tx.id}</h4>
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Logged: {new Date(tx.payment_datetime).toLocaleString()} • Method: {tx.payment_method}</p>
                          </div>
                          {!isDeskStaff && (
                            <div className="text-right">
                              <span className="font-mono font-bold text-emerald-500 text-xs block">
                                + PKR {tx.amount_paid?.toLocaleString()}
                              </span>
                              <span className="text-[9px] text-[var(--text-muted)] block mt-0.5">
                                Bal Due: PKR {tx.balance_due?.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
