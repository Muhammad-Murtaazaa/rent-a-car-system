/**
 * Minimal self-check for finance math. Run: node financeUtils.check.js
 * Fails loudly if cash in/out / outstanding / monthly sync / payouts break.
 */
import {
  sumCashIn,
  sumOutstanding,
  sumMaintenanceOut,
  sumPayoutsOut,
  operatingNet,
  netEarnings,
  monthlyCashflow,
  cashCollectedByCar,
  filterFinancialsByRange,
  filterMaintenanceByRange,
  filterPayoutsByRange,
  flattenInvestorPayouts,
  buildCashflowLedger,
  investorPortfolioTotals,
  formatCompactPKR,
  chartAxisTicks,
} from "./financeUtils.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const financials = [
  { id: 1, booking_id: 10, amount_paid: 5000, balance_due: 2000, payment_datetime: "2026-06-15T10:00:00" },
  { id: 2, booking_id: 10, amount_paid: 2000, balance_due: 0, payment_datetime: "2026-07-01T10:00:00" },
  { id: 3, booking_id: 11, amount_paid: 8000, balance_due: 1000, payment_datetime: "2026-08-01T12:00:00" },
];
const maintenance = [
  { id: 1, car_id: 1, cost: 1500, execution_date: "2026-07-20", log_type: "Oil Change" },
  { id: 2, car_id: 2, cost: 500, execution_date: "2026-08-01", log_type: "Repair" },
];
const bookings = [
  { id: 10, car_id: 1 },
  { id: 11, car_id: 2 },
];
const investors = [
  {
    investor_id: 1,
    full_name: "Ali",
    investment_amount: 100000,
    total_revenue_generated: 15000,
    total_maintenance_cost: 2000,
    total_investor_earnings: 9100,
    total_payouts_received: 3000,
    payout_balance_due: 6100,
    payouts: [
      { id: 9, amount: 3000, payout_date: "2026-08-02", payment_method: "Bank Transfer", investor_id: 1 },
    ],
  },
];

const payouts = flattenInvestorPayouts(investors);
assert(payouts.length === 1 && payouts[0].investor_name === "Ali", "flatten payouts");

assert(sumCashIn(financials) === 15000, "cash in should be 15000");
assert(sumOutstanding(financials) === 1000, "outstanding should use latest balance only (1000)");
assert(sumMaintenanceOut(maintenance) === 2000, "maint out should be 2000");
assert(sumPayoutsOut(payouts) === 3000, "payouts out should be 3000");
assert(operatingNet(financials, maintenance) === 13000, "operating net 13000");
assert(netEarnings(financials, maintenance, payouts) === 10000, "net after payouts 10000");

const byCar = cashCollectedByCar(financials, bookings);
assert(byCar[1] === 7000, "car 1 cash should be 7000");
assert(byCar[2] === 8000, "car 2 cash should be 8000");

const start = new Date("2026-07-01");
const end = new Date("2026-07-31T23:59:59");
assert(filterFinancialsByRange(financials, start, end).length === 1, "july payments filter");
assert(filterMaintenanceByRange(maintenance, start, end).length === 1, "july maint filter");
assert(filterPayoutsByRange(payouts, new Date("2026-08-01"), new Date("2026-08-31")).length === 1, "aug payouts");

const series = monthlyCashflow(financials, maintenance, 6, payouts);
assert(series.length === 6, "6 month series");
const aug = series.find((m) => m.key.startsWith("Aug"));
assert(aug && aug.payouts === 3000 && aug.expenses >= 3500, "aug includes payout in expenses");

assert(formatCompactPKR(0) === "PKR 0", "compact zero");
assert(formatCompactPKR(1059000).includes("M"), "compact millions");
assert(chartAxisTicks(1059000).top >= 1059000, "axis top covers max");

const ledger = buildCashflowLedger(financials, maintenance, bookings, payouts);
assert(ledger.filter((r) => r.type === "Cash In").length === 3, "3 cash in rows");
assert(ledger.filter((r) => r.category === "Maintenance").length === 2, "2 maint rows");
assert(ledger.filter((r) => r.category === "Investor Payout").length === 1, "1 payout row");

const port = investorPortfolioTotals(investors);
assert(port.capital === 100000 && port.payouts === 3000 && port.due === 6100, "portfolio totals");

console.log("financeUtils.check.js: OK");
