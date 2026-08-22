// ---------- main: wires up UI events and boots the app ----------
(function(){
  const BN = window.App.BN;
  const { toISODate } = window.App.Dates;
  const State = window.App.State;
  const els = window.App.els;
  const { setStatus, renderAll, fmt, fmtSigned } = window.App;
  const uid = window.App.uid;

  els.dateInput.valueAsDate = new Date();

  // ---------- sort tabs ----------
  els.sortTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      State.sortMode = tab.dataset.sort;
      els.sortTabs.forEach(t => t.classList.toggle('active', t === tab));
      renderAll();
    });
  });

  // ---------- entry form ----------
  function updatePreview(){
    const name = els.playerInput.value.trim();
    const newTotal = BN.parse(els.totalInput.value);
    if (!name || !newTotal){ els.entryPreview.innerHTML = ''; return; }
    const existing = State.history.filter(e => e.player.toLowerCase() === name.toLowerCase());
    if (!existing.length){
      els.entryPreview.innerHTML = `<span class="pv-new">New member</span> — this sets their baseline total (counted as +0 for this week).`;
      return;
    }
    const latest = existing.slice().sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).slice(-1)[0];
    const delta = BN.sub(newTotal, latest.total);
    const cls = BN.isZero(delta) ? '' : BN.isNeg(delta) ? 'pv-neg' : 'pv-pos';
    els.entryPreview.innerHTML = `Previous total: ${fmt(latest.total)} (logged ${latest.date}) → <span class="${cls}">${fmtSigned(delta)}</span> this update.`;
  }
  els.playerInput.addEventListener('input', updatePreview);
  els.totalInput.addEventListener('input', updatePreview);

  els.entryForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = els.playerInput.value.trim();
    const date = els.dateInput.value;
    const total = BN.parse(els.totalInput.value);
    if (!name){ setStatus('Enter a player name.', 'err'); return; }
    if (!date){ setStatus('Pick a date.', 'err'); return; }
    if (!total){ setStatus('Enter a valid total (e.g. 1500, 1.5k, 4.2qd, 1.2e45).', 'err'); return; }
    if (BN.isNeg(total)){ setStatus('Enter a valid total.', 'err'); return; }

    const existing = State.history.filter(e => e.player.toLowerCase() === name.toLowerCase());
    if (existing.length){
      const latest = existing.slice().sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).slice(-1)[0];
      if (BN.cmp(total, latest.total) < 0){
        const ok = confirm(`New total (${fmt(total)}) is lower than the last logged total (${fmt(latest.total)}) for ${latest.player}. This will record a negative amount for that week. Continue anyway?`);
        if (!ok) return;
      }
    }

    // normalize player name to however it was first entered, for consistency
    const canonicalName = existing.length ? existing[0].player : name;
    State.history.push({ id: uid(), date, player: canonicalName, total });
    renderAll();
    setStatus(`Logged ${fmt(total)} for ${canonicalName} on ${date}.`, 'ok');
    els.totalInput.value = '';
    els.entryPreview.innerHTML = '';
  });

  // ---------- import / export ----------
  window.App.initImportExport();

  // ---------- sample data ----------
  els.sampleBtn.addEventListener('click', () => {
    if (State.history.length && !confirm('Load sample data? This replaces all current data.')) return;
    const today = new Date();
    const names = ['Kaelrix', 'Novashade', 'Prizmatic', 'Voidreaper'];
    const baseTotals = [8200, 5400, 12100, 4200000000000000]; // Voidreaper starts at 4.2qd
    const weeklyGains = [
      [420, 300, 610, 150000000000000],
      [380, 0, 540, 90000000000000],
      [500, 260, 300, 220000000000000],
      [0, 410, 700, 0],
    ];
    State.history = [];
    names.forEach((name, ni) => {
      let total = BN.fromNumber(baseTotals[ni]);
      let d = new Date(today); d.setDate(d.getDate() - 28);
      State.history.push({ id: uid(), date: toISODate(d), player: name, total });
      weeklyGains.forEach(week => {
        d = new Date(d); d.setDate(d.getDate() + 7);
        total = BN.add(total, BN.fromNumber(week[ni]));
        State.history.push({ id: uid(), date: toISODate(d), player: name, total });
      });
    });
    renderAll();
    setStatus('Loaded sample data.', 'ok');
  });

  // ---------- clear ----------
  els.clearBtn.addEventListener('click', () => {
    if (!State.history.length) return;
    if (!confirm('Clear all data? Export first if you want to keep it.')) return;
    State.history = [];
    renderAll();
    setStatus('Cleared all data.', 'ok');
  });

  renderAll();
})();
