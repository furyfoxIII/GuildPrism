// ---------- state ----------
// history: [{ id, date: "YYYY-MM-DD", player: "Name", total: BN }]
window.App = window.App || {};

(function(){
  const BN = window.App.BN;
  const { toISODate, parseISO, weekKeyOf } = window.App.Dates;

  const State = {
    history: [],
    sortMode: 'total',
  };

  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

  // ---------- derive everything from history ----------
  function computeDerived(){
    const byPlayer = {};
    State.history.forEach(e => { (byPlayer[e.player] ||= []).push(e); });
    Object.values(byPlayer).forEach(arr => arr.sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const entriesWithDelta = [];
    Object.values(byPlayer).forEach(arr => {
      arr.forEach((e, i) => {
        const prev = i === 0 ? null : arr[i-1];
        e.delta = prev ? BN.sub(e.total, prev.total) : BN.zero();
        e.isBaseline = prev === null;
        entriesWithDelta.push(e);
      });
    });

    const weeklyMap = {};
    entriesWithDelta.forEach(e => {
      const wk = weekKeyOf(e.date);
      weeklyMap[wk] = BN.add(weeklyMap[wk] || BN.zero(), e.delta);
    });

    const todayKey = weekKeyOf(toISODate(new Date()));
    const lastWeekDate = new Date(); lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const lastWeekKey = weekKeyOf(toISODate(lastWeekDate));

    let series = [];
    const weekKeys = Object.keys(weeklyMap);
    if (weekKeys.length){
      let minWeek = weekKeys.reduce((a,b) => a < b ? a : b);
      let cur = parseISO(minWeek);
      const end = parseISO(todayKey);
      const maxSpanMs = 52 * 7 * 24 * 3600 * 1000;
      if (end - cur > maxSpanMs) cur = new Date(end.getTime() - maxSpanMs);
      while (cur <= end){
        const key = toISODate(cur);
        series.push({ weekStart: key, total: weeklyMap[key] || BN.zero() });
        cur.setDate(cur.getDate() + 7);
      }
    }

    const players = Object.entries(byPlayer).map(([name, arr]) => {
      const latest = arr[arr.length - 1];
      const thisWeek = arr.filter(e => weekKeyOf(e.date) === todayKey).reduce((s,e) => BN.add(s, e.delta), BN.zero());
      const lastWeek = arr.filter(e => weekKeyOf(e.date) === lastWeekKey).reduce((s,e) => BN.add(s, e.delta), BN.zero());
      return { name, total: latest.total, lastUpdated: latest.date, thisWeek, lastWeek };
    });

    const guildTotal = players.reduce((s,p) => BN.add(s, p.total), BN.zero());
    const guildThisWeek = weeklyMap[todayKey] || BN.zero();

    return { players, series, guildTotal, guildThisWeek, weeksTracked: weekKeys.length, entriesWithDelta };
  }

  window.App.State = State;
  window.App.uid = uid;
  window.App.computeDerived = computeDerived;
})();
