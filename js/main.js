// ---------- main: wires up UI events and boots the app ----------
(function(){
  const BN = window.App.BN;
  const { weekKeyOf } = window.App.Dates;
  const State = window.App.State;
  const els = window.App.els;
  const { setStatus, renderAll, fmt, fmtSigned } = window.App;
  const uid = window.App.uid;

  // ---------- sort tabs ----------
  els.sortTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      State.sortMode = tab.dataset.sort;
      els.sortTabs.forEach(t => t.classList.toggle('active', t === tab));
      renderAll();
    });
  });

  // ---------- chart view toggle (weekly trend vs. this-week pie) ----------
  els.viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const isPie = tab.dataset.view === 'pie';
      els.viewTabs.forEach(t => t.classList.toggle('active', t === tab));
      els.chartBodyView.hidden = isPie;
      els.pieView.hidden = !isPie;
      if (!isPie) renderAll(); // bar chart needs a fresh px measurement now that it's visible again
    });
  });

  // ---------- top-level tabs (overview / manage) ----------
  function showTab(name){
    const isOverview = name === 'overview';
    els.tabOverview.hidden = !isOverview;
    els.tabManage.hidden = isOverview;
    els.tabBtnOverview.classList.toggle('active', isOverview);
    els.tabBtnManage.classList.toggle('active', !isOverview);
  }
  els.tabBtnOverview.addEventListener('click', () => { showTab('overview'); renderAll(); });
  els.tabBtnManage.addEventListener('click', () => showTab('manage'));

  // Chart bar/gridline heights are measured in px at render time, so redraw
  // it (only) when the viewport is resized.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!els.tabOverview.hidden) renderAll();
    }, 150);
  });

  // ---------- add player ----------
  els.addPlayerForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = els.newPlayerInput.value.trim();
    const startRaw = els.newPlayerStartInput.value.trim();
    const startTotal = startRaw ? BN.parse(startRaw) : BN.zero();
    if (startRaw && !startTotal){ setStatus('Enter a valid starting total (e.g. 1500, 1.5k, 4.2qd).', 'err'); return; }
    if (startTotal && BN.isNeg(startTotal)){ setStatus("Starting total can't be negative.", 'err'); return; }
    const result = window.App.addPlayer(name, startTotal);
    if (!result.ok){ setStatus(result.error, 'err'); return; }
    renderAll();
    setStatus(`Added ${result.name} to the leaderboard.`, 'ok');
    els.newPlayerInput.value = '';
    els.newPlayerStartInput.value = '';
  });

  // ---------- remove player ----------
  els.removePlayerForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = els.removePlayerSelect.value;
    if (!name) return;
    if (!confirm(`Remove ${name} and all of their logged history? Their donated total moves into the guild treasury and can't be undone.`)) return;
    const result = window.App.removePlayer(name);
    if (!result.ok){ setStatus(result.error, 'err'); return; }
    renderAll();
    setStatus(`Removed ${result.name} — their ${fmt(result.movedToTreasury)} prism moved to the treasury.`, 'ok');
  });

  els.resetTreasuryBtn.addEventListener('click', () => {
    if (BN.isZero(State.treasury)) return;
    if (!confirm(`Reset the treasury (currently ${fmt(State.treasury)}) back to 0? This can't be undone.`)) return;
    State.treasury = BN.zero();
    renderAll();
    setStatus('Treasury reset to 0.', 'ok');
  });

  els.treasuryAdjustForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const raw = els.treasuryAdjustInput.value.trim();
    const amount = BN.parse(raw);
    if (!raw || !amount || BN.isZero(amount)){ setStatus('Enter a valid amount to add (e.g. 1500, 1.5k, 4.2qd).', 'err'); return; }
    State.treasury = BN.add(State.treasury, amount);
    els.treasuryAdjustInput.value = '';
    renderAll();
    setStatus(`Added ${fmt(amount)} to the treasury.`, 'ok');
  });

  // ---------- click-a-player entry modal ----------
  // Saving collapses to one entry per player per week: if a total was
  // already logged for the selected week, that entry gets replaced instead
  // of stacking a new row, so "this week" always reflects a single latest
  // total rather than every intermediate click.
  //
  // The player's very first-ever entry (their baseline — from "Starting
  // total" or their first-ever log) is never touched by this collapse, even
  // if it happens to fall in the same week as a later save. That entry is
  // the floor everything else's weekly delta is measured against; deleting
  // it (e.g. when a player is added and logged for the first time in the
  // same week) would leave the new entry as the *only* entry, making it
  // look like a baseline itself (delta 0) instead of a real weekly gain.
  let modalPlayer = null;

  function stableSortByDate(entries){
    return entries.slice().sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  }
  // Everything the modal needs to know about a player's state for a given
  // week: their permanent origin entry, whichever same-week entry (if any)
  // is about to be overwritten, and the baseline the new total should be
  // diffed against.
  function weekCollapseInfo(name, weekKey){
    const playerEntries = stableSortByDate(State.history.filter(e => e.player.toLowerCase() === name.toLowerCase()));
    const originEntry = playerEntries[0] || null;
    const toRemove = playerEntries.filter(e => weekKeyOf(e.date) === weekKey && (!originEntry || e.id !== originEntry.id));
    const remaining = playerEntries.filter(e => !toRemove.includes(e));
    return {
      originEntry,
      toRemoveIds: toRemove.map(e => e.id),
      existing: toRemove.length ? toRemove[toRemove.length - 1] : null,
      baseline: remaining.length ? remaining[remaining.length - 1] : null,
    };
  }

  function updateModalPreview(){
    const newTotal = BN.parse(els.modalTotalInput.value);
    const dateVal = els.modalDateInput.value;
    if (!newTotal || !dateVal || !modalPlayer){ els.modalEntryPreview.innerHTML = ''; return; }
    const weekKey = weekKeyOf(dateVal);
    const { existing, baseline } = weekCollapseInfo(modalPlayer, weekKey);

    let html = '';
    if (existing){
      html += `Replaces this week's logged total of ${fmt(existing.total)} (from ${existing.date}). `;
    }
    if (baseline){
      const delta = BN.sub(newTotal, baseline.total);
      const cls = BN.isZero(delta) ? '' : BN.isNeg(delta) ? 'pv-neg' : 'pv-pos';
      html += `Previous total: ${fmt(baseline.total)} (logged ${baseline.date}) → <span class="${cls}">${fmtSigned(delta)}</span> this week.`;
    } else {
      html += `First entry for ${window.App.escapeHtml(modalPlayer)} — counted as a baseline (no gain this week).`;
    }
    els.modalEntryPreview.innerHTML = html;
  }
  els.modalTotalInput.addEventListener('input', updateModalPreview);
  els.modalDateInput.addEventListener('input', updateModalPreview);
  els.modalDateInput.addEventListener('change', updateModalPreview);

  function openEntryModal(name){
    const canonical = window.App.findPlayerName(name) || name;
    modalPlayer = canonical;
    els.entryModalPlayerName.textContent = canonical;
    els.modalDateInput.valueAsDate = new Date();
    els.modalTotalInput.value = '';
    els.modalEntryPreview.innerHTML = '';
    els.entryModalBackdrop.hidden = false;
    els.modalTotalInput.focus();
  }

  function closeEntryModal(){
    els.entryModalBackdrop.hidden = true;
    modalPlayer = null;
  }

  els.entryModalClose.addEventListener('click', closeEntryModal);
  els.modalCancelBtn.addEventListener('click', closeEntryModal);
  els.entryModalBackdrop.addEventListener('click', (ev) => {
    if (ev.target === els.entryModalBackdrop) closeEntryModal();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !els.entryModalBackdrop.hidden) closeEntryModal();
  });

  els.modalEntryForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!modalPlayer) return;
    const date = els.modalDateInput.value;
    const total = BN.parse(els.modalTotalInput.value);
    if (!date){ setStatus('Pick a date.', 'err'); return; }
    if (!total){ setStatus('Enter a valid total (e.g. 1500, 1.5k, 4.2qd, 1.2e45).', 'err'); return; }
    if (BN.isNeg(total)){ setStatus('Enter a valid total.', 'err'); return; }

    const weekKey = weekKeyOf(date);
    const { baseline, toRemoveIds } = weekCollapseInfo(modalPlayer, weekKey);
    if (baseline && BN.cmp(total, baseline.total) < 0){
      const ok = confirm(`New total (${fmt(total)}) is lower than the last logged total (${fmt(baseline.total)}) for ${modalPlayer}. This will record a negative amount for that week. Continue anyway?`);
      if (!ok) return;
    }

    // Collapse whatever else is already logged for this player this week
    // into the new entry — but never the player's origin/baseline entry
    // (see weekCollapseInfo), so a first-week gain still shows up as one.
    State.history = State.history.filter(e => !toRemoveIds.includes(e.id));
    State.history.push({ id: uid(), date, player: modalPlayer, total });
    const loggedFor = modalPlayer;
    closeEntryModal();
    renderAll();
    setStatus(`Logged ${fmt(total)} for ${loggedFor} on ${date}.`, 'ok');
  });

  window.App.openEntryModal = openEntryModal;

  // ---------- import / export ----------
  window.App.initImportExport();

  // ---------- Google Sheet sync ----------
  window.App.initGoogleSheets();

  // ---------- clear ----------
  els.clearBtn.addEventListener('click', () => {
    if (!State.history.length && BN.isZero(State.treasury)) return;
    if (!confirm('Clear all data (including the treasury)? Export first if you want to keep it.')) return;
    State.history = [];
    State.treasury = BN.zero();
    renderAll();
    setStatus('Cleared all data.', 'ok');
  });

  renderAll();
})();
