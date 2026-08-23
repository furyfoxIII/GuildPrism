// ---------- date helpers (UTC only — never reads or sets local time) ----------
window.App = window.App || {};

(function(){
  const DAY_MS = 24 * 60 * 60 * 1000;

  function toISODate(d){
    const y = d.getUTCFullYear(), m = String(d.getUTCMonth()+1).padStart(2,'0'), day = String(d.getUTCDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function parseISO(s){
    const [y,m,d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, (m||1)-1, d||1));
  }
  // Pure epoch-ms shift — never touches local calendar fields, so it can't
  // drift a day depending on the machine's timezone or DST.
  function addDaysUTC(d, n){ return new Date(d.getTime() + n * DAY_MS); }
  function getMonday(d){
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    return addDaysUTC(d, diff);
  }
  function weekKeyOf(dateStr){ return toISODate(getMonday(parseISO(dateStr))); }
  function weekLabel(weekStartStr){
    const d = parseISO(weekStartStr);
    return d.toLocaleDateString(undefined, { month:'short', day:'numeric', timeZone:'UTC' });
  }

  window.App.Dates = { toISODate, parseISO, getMonday, weekKeyOf, weekLabel, addDaysUTC };
})();
