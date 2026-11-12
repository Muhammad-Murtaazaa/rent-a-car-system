/**
 * Single source of truth for rental cash in / cash out math.
 * Schema: Financial { amount_paid, payment_datetime, balance_due, booking_id, payment_method }
 *         MaintenanceLog { cost, execution_date, log_type, car_id }
 *         InvestorPayout { amount, payout_date, payment_method, investor_id, notes }
 */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseDate(value) {
  if (value == null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function monthKey(date) {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function lastNMonthKeys(n = 6) {
  const current = new Date();
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(current.getFullYear(), current.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

export function inRange(date, start, end) {
  if (!date) return false;
  return date >= start && date <= end;
}

/** Flatten payout rows from investor summaries (list API embeds payouts[]) */
export function flattenInvestorPayouts(investors) {
  const rows = [];
  for (const inv of investors || []) {
    const name = inv.full_name || "Investor";
    const iid = inv.investor_id ?? inv.id;
    for (const p of inv.payouts || []) {
      rows.push({
        ...p,
        investor_id: p.investor_id ?? iid,
        investor_name: name,
      });
    }
  }
  return rows;
}

/** Flatten payout rows from shareholder summaries (list API embeds payouts[]) */
export function flattenShareholderPayouts(shareholders) {
  const rows = [];
  for (const sh of shareholders || []) {
    const name = sh.full_name || "Shareholder";
    const sid = sh.shareholder_id ?? sh.id;
    for (const p of sh.payouts || []) {
      rows.push({
        ...p,
        shareholder_id: p.shareholder_id ?? sid,
        shareholder_name: name,
      });
    }
  }
  return rows;
}

/** Cash in: all rental payment receipts */
export function sumCashIn(financials) {
  return (financials || []).reduce((acc, f) => acc + (Number(f.amount_paid) || 0), 0);
}

/** Outstanding: latest balance_due per booking (by payment time) */
export function sumOutstanding(financials) {
  const latest = {};
  for (const f of financials || []) {
    const prev = latest[f.booking_id];
    const t = parseDate(f.payment_datetime)?.getTime() ?? 0;
    const prevT = prev ? (parseDate(prev.payment_datetime)?.getTime() ?? 0) : -1;
    if (!prev || t >= prevT) latest[f.booking_id] = f;
  }
  return Object.values(latest).reduce((acc, f) => acc + (Number(f.balance_due) || 0), 0);
}

/** Cash out: workshop / maintenance costs */
export function sumMaintenanceOut(maintenance) {
  return (maintenance || []).reduce((acc, m) => acc + (Number(m.cost) || 0), 0);
}

/** Cash out: investor profit disbursements */
export function sumPayoutsOut(payouts) {
  return (payouts || []).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
}

/** Operating net before investor disbursements */
export function operatingNet(financials, maintenance) {
  return sumCashIn(financials) - sumMaintenanceOut(maintenance);
}

/** Cash retained after maintenance + investor payouts */
export function netEarnings(financials, maintenance, payouts = []) {
  return sumCashIn(financials) - sumMaintenanceOut(maintenance) - sumPayoutsOut(payouts);
}

export function filterFinancialsByRange(financials, start, end) {
  return (financials || []).filter((f) => inRange(parseDate(f.payment_datetime), start, end));
}

export function filterMaintenanceByRange(maintenance, start, end) {
  return (maintenance || []).filter((m) => inRange(parseDate(m.execution_date), start, end));
}

export function filterPayoutsByRange(payouts, start, end) {
  return (payouts || []).filter((p) => inRange(parseDate(p.payout_date), start, end));
}

/**
 * 6-month cash-in vs cash-out series for charts.
 * expenses = maintenance + investor payouts
 */
export function monthlyCashflow(financials, maintenance, months = 6, payouts = []) {
  const keys = lastNMonthKeys(months);
  const series = keys.map((key) => ({ key, revenue: 0, expenses: 0, maint: 0, payouts: 0 }));
  const byKey = Object.fromEntries(series.map((m) => [m.key, m]));

  for (const f of financials || []) {
    const d = parseDate(f.payment_datetime);
    if (!d) continue;
    const row = byKey[monthKey(d)];
    if (row) row.revenue += Number(f.amount_paid) || 0;
  }

  for (const m of maintenance || []) {
    const d = parseDate(m.execution_date);
    if (!d) continue;
    const row = byKey[monthKey(d)];
    if (row) {
      const c = Number(m.cost) || 0;
      row.maint += c;
      row.expenses += c;
    }
  }

  for (const p of payouts || []) {
    const d = parseDate(p.payout_date);
    if (!d) continue;
    const row = byKey[monthKey(d)];
    if (row) {
      const a = Number(p.amount) || 0;
      row.payouts += a;
      row.expenses += a;
    }
  }

  return series;
}

/** Actual cash collected per car via booking → payment rows */
export function cashCollectedByCar(financials, bookings) {
  const bookingToCars = {};
  for (const b of bookings || []) {
    if (b.booked_cars && b.booked_cars.length > 0) {
      bookingToCars[b.id] = b.booked_cars.map(bc => ({
        car_id: bc.car_id,
        weight: bc.daily_rate / (b.daily_rate || 1)
      }));
    } else if (b.car_id != null) {
      bookingToCars[b.id] = [{ car_id: b.car_id, weight: 1 }];
    }
  }
  const map = {};
  for (const f of financials || []) {
    const cars = bookingToCars[f.booking_id];
    if (!cars) continue;
    for (const c of cars) {
      const share = (Number(f.amount_paid) || 0) * c.weight;
      map[c.car_id] = (map[c.car_id] || 0) + share;
    }
  }
  return map;
}

export function sumPaidForBooking(financials, bookingId) {
  return (financials || [])
    .filter((f) => f.booking_id === bookingId)
    .reduce((acc, f) => acc + (Number(f.amount_paid) || 0), 0);
}

/** Estimate booking charge from rate × days (no total_cost column on Booking) */
export function estimatedBookingCharge(booking) {
  const start = parseDate(booking.start_datetime);
  const end = parseDate(booking.actual_return_datetime || booking.expected_end_datetime);
  if (!start || !end) return 0;
  const ms = end.getTime() - start.getTime();
  const autoDays = Math.max(1, Math.ceil(ms / 86400000));
  const days = booking.billable_days && booking.billable_days > 0 ? booking.billable_days : autoDays;
  let total = days * (Number(booking.daily_rate) || 0);
  if (booking.is_chauffeur_driven) {
    total += days * (Number(booking.chauffeur_daily_wage) || 0);
  }
  if (booking.late_penalty_charge) total += Number(booking.late_penalty_charge) || 0;
  if (booking.car_wash_charge) total += Number(booking.car_wash_charge) || 0;
  if (Array.isArray(booking.booked_cars)) {
    for (const bc of booking.booked_cars) {
      if (bc.extra_fuel_charge) total += Number(bc.extra_fuel_charge) || 0;
      if (bc.structural_damage_charge) total += Number(bc.structural_damage_charge) || 0;
    }
  }
  return total;
}

export function chauffeurOutflowForDate(bookings, reportDate) {
  const target = parseDate(reportDate);
  if (!target) return 0;
  const day = new Date(target);
  day.setHours(12, 0, 0, 0);
  return (bookings || [])
    .filter((b) => b.status === "Active" && b.is_chauffeur_driven)
    .filter((b) => {
      const start = parseDate(b.start_datetime);
      const end = parseDate(b.expected_end_datetime);
      if (!start || !end) return false;
      return day >= start && day <= end;
    })
    .reduce((acc, b) => acc + (Number(b.chauffeur_daily_wage) || 0), 0);
}

export function dailyCashSummary(financials, maintenance, bookings, reportDate, payouts = []) {
  const target = parseDate(reportDate);
  const targetStr = target ? target.toDateString() : "";

  const dailyIncome = (financials || [])
    .filter((f) => parseDate(f.payment_datetime)?.toDateString() === targetStr)
    .reduce((acc, f) => acc + (Number(f.amount_paid) || 0), 0);

  const dailyMaintExpense = (maintenance || [])
    .filter((m) => parseDate(m.execution_date)?.toDateString() === targetStr)
    .reduce((acc, m) => acc + (Number(m.cost) || 0), 0);

  const dailyPayoutExpense = (payouts || [])
    .filter((p) => parseDate(p.payout_date)?.toDateString() === targetStr)
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const dailyDriverExpense = chauffeurOutflowForDate(bookings, reportDate);
  const netDaily = dailyIncome - dailyDriverExpense - dailyMaintExpense - dailyPayoutExpense;

  return {
    dailyIncome,
    dailyDriverExpense,
    dailyMaintExpense,
    dailyPayoutExpense,
    netDaily,
  };
}

/**
 * Unified ledger: payments (Cash In) + maintenance + investor payouts (Cash Out).
 * Sorted newest first.
 */
export function buildCashflowLedger(financials, maintenance, bookings = [], payouts = []) {
  const bookingMap = Object.fromEntries((bookings || []).map((b) => [b.id, b]));
  const rows = [];

  for (const f of financials || []) {
    const b = bookingMap[f.booking_id];
    const car = b?.car?.make_model || b?.car?.plate_number || "";
    const cust = b?.customer?.full_name || "";
    const label = [
      `Booking #${f.booking_id}`,
      cust,
      car,
      f.payment_method,
      Number(f.balance_due) > 0 ? `Bal due ${Number(f.balance_due).toLocaleString()}` : "Settled",
    ]
      .filter(Boolean)
      .join(" · ");

    rows.push({
      id: `FIN-${f.id}`,
      sortKey: parseDate(f.payment_datetime)?.getTime() ?? 0,
      date: f.payment_datetime,
      description: label || "Rental payment",
      type: "Cash In",
      category: "Rental Payment",
      amount: Number(f.amount_paid) || 0,
      booking_id: f.booking_id,
      payment_method: f.payment_method,
    });
  }

  for (const m of maintenance || []) {
    const plate = m.car?.plate_number || "";
    const model = m.car?.make_model || "";
    rows.push({
      id: `MNT-${m.id}`,
      sortKey: parseDate(m.execution_date)?.getTime() ?? 0,
      date: m.execution_date,
      description: [m.log_type, model, plate, m.notes].filter(Boolean).join(" · ") || "Maintenance",
      type: "Cash Out",
      category: "Maintenance",
      amount: Number(m.cost) || 0,
      car_id: m.car_id,
    });
  }

  for (const p of payouts || []) {
    const isShareholder = p.shareholder_id !== undefined;
    rows.push({
      id: isShareholder ? `PAY-SH-${p.id}` : `PAY-${p.id}`,
      sortKey: parseDate(p.payout_date)?.getTime() ?? 0,
      date: p.payout_date,
      description: [
        isShareholder ? `Shareholder payout` : `Investor payout`,
        isShareholder ? p.shareholder_name : p.investor_name,
        p.payment_method,
        p.notes,
      ]
        .filter(Boolean)
        .join(" · "),
      type: "Cash Out",
      category: isShareholder ? "Shareholder Payout" : "Investor Payout",
      amount: Number(p.amount) || 0,
      investor_id: p.investor_id,
      shareholder_id: p.shareholder_id,
    });
  }

  rows.sort((a, b) => b.sortKey - a.sortKey);
  return rows;
}

/** Aggregate investor KPIs from summary list (same fields backend computes) */
export function investorPortfolioTotals(investors) {
  const list = investors || [];
  return {
    capital: list.reduce((a, i) => a + (Number(i.investment_amount) || 0), 0),
    revenue: list.reduce((a, i) => a + (Number(i.total_revenue_generated) || 0), 0),
    maintenance: list.reduce((a, i) => a + (Number(i.total_maintenance_cost) || 0), 0),
    earnings: list.reduce((a, i) => a + (Number(i.total_investor_earnings) || 0), 0),
    payouts: list.reduce((a, i) => a + (Number(i.total_payouts_received) || 0), 0),
    due: list.reduce((a, i) => a + (Number(i.payout_balance_due) || 0), 0),
    count: list.length,
  };
}

export function shareholderPortfolioTotals(shareholders) {
  const list = shareholders || [];
  return {
    capital: list.reduce((a, i) => a + (Number(i.investment_amount) || 0), 0),
    revenue: list.reduce((a, i) => a + (Number(i.total_revenue_generated) || 0), 0),
    maintenance: list.reduce((a, i) => a + (Number(i.total_maintenance_cost) || 0), 0),
    platform_fee: list.reduce((a, i) => a + (Number(i.total_platform_fee) || 0), 0),
    earnings: list.reduce((a, i) => a + (Number(i.total_shareholder_earnings) || 0), 0),
    payouts: list.reduce((a, i) => a + (Number(i.total_payouts_received) || 0), 0),
    due: list.reduce((a, i) => a + (Number(i.payout_balance_due) || 0), 0),
    count: list.length,
  };
}

export function formatMoneyDate(value) {
  const d = parseDate(value);
  if (!d) return "N/A";
  return d.toLocaleString();
}

/** Compact PKR for chart labels — readable at a glance */
export function formatCompactPKR(n) {
  const v = Number(n) || 0;
  if (v === 0) return "PKR 0";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}PKR ${m >= 10 ? m.toFixed(1) : m.toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}PKR ${k >= 100 ? Math.round(k) : k.toFixed(k % 1 === 0 ? 0 : 1)}k`;
  }
  return `${sign}PKR ${abs.toLocaleString()}`;
}

/** Even Y-axis ticks for bar charts */
export function chartAxisTicks(maxValue, tickCount = 4) {
  const max = Math.max(Number(maxValue) || 0, 0);
  if (max === 0) {
    return { top: 1000, ticks: [1000, 750, 500, 250, 0] };
  }
  const rough = max / tickCount;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / mag;
  let stepNorm = 1;
  if (norm > 5) stepNorm = 10;
  else if (norm > 2) stepNorm = 5;
  else if (norm > 1) stepNorm = 2;
  const step = stepNorm * mag;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let i = tickCount; i >= 0; i--) {
    ticks.push((top / tickCount) * i);
  }
  return { top, ticks };
}
