// Local-time date helpers.
//
// The backend stores naive LOCAL dates/datetimes, but Date.toISOString() is
// UTC. In Pakistan (UTC+5) using toISOString() for "today" or "now" produced
// yesterday's date between midnight and 5am, and converting a stored booking
// time through toISOString() shifted it -5 hours on every edit round-trip.
// Always format with these helpers instead.
const pad = (n) => String(n).padStart(2, "0");

export function localTodayStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localDateTimeStr(d = new Date()) {
  return `${localTodayStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
