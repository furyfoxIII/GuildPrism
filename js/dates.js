// ---------- date helpers (local time, no UTC shifting) ----------
window.App = window.App || {};

(function(){
  function toISODate(d){
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function parseISO(s){
    const [y,m,d] = s.split('-').map(Number);
    return new Date(y, (m||1)-1, d||1);
  }
  function getMonday(d){
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }
  function weekKeyOf(dateStr){ return toISODate(getMonday(parseISO(dateStr))); }
  function weekLabel(weekStartStr){
    const d = parseISO(weekStartStr);
    return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  }

  window.App.Dates = { toISODate, parseISO, getMonday, weekKeyOf, weekLabel };
})();
