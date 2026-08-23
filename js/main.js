// ---------- main: wires up UI events and boots the app ----------
(function(){
  const BN = window.App.BN;
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

  // ---------- top-level tabs (overview / manage) ----------
  function showTab(name){
    const isOverview = name === 'overview';
    els.tabOverview.hidden = !isOverview;
    els.tabManage.hidden = isOverview;
    els.tabBtnOverview.classList.toggle('active', isOverview);
    els.tabBtnManage.classList.toggle('active', !isOverview);
  }
  els.tabBtnOverview.addEventListener('click', () => showTab('overview'));
  els.tabBtnManage.addEventListener('click', () => showTab('manage'));

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
    if (!confirm(`Remove ${name} and all of their logged history? This can't be undone.`)) return;
    const result = window.App.removePlayer(name);
    if (!result.ok){ setStatus(result.error, 'err'); return; }
    renderAll();
    setStatus(`Removed ${result.name} from the leaderboard.`, 'ok');
  });

  // ---------- click-a-player entry modal ----------
  let modalPlayer = null;

  function latestEntryFor(name){
    const entries = State.history.filter(e => e.player.toLowerCase() === name.toLowerCase());
    if (!entries.length) return null;
    return entries.slice().sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0).slice(-1)[0];
  }

  function updateModalPreview(){
    const newTotal = BN.parse(els.modalTotalInput.value);
    const latest = latestEntryFor(modalPlayer);
    if (!newTotal || !latest){ els.modalEntryPreview.innerHTML = ''; return; }
    const delta = BN.sub(newTotal, latest.total);
    const cls = BN.isZero(delta) ? '' : BN.isNeg(delta) ? 'pv-neg' : 'pv-pos';
    els.modalEntryPreview.innerHTML = `Previous total: ${fmt(latest.total)} (logged ${latest.date}) → <span class="${cls}">${fmtSigned(delta)}</span> this update.`;
  }
  els.modalTotalInput.addEventListener('input', updateModalPreview);

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

    const latest = latestEntryFor(modalPlayer);
    if (latest && BN.cmp(total, latest.total) < 0){
      const ok = confirm(`New total (${fmt(total)}) is lower than the last logged total (${fmt(latest.total)}) for ${modalPlayer}. This will record a negative amount for that week. Continue anyway?`);
      if (!ok) return;
    }

    State.history.push({ id: uid(), date, player: modalPlayer, total });
    const loggedFor = modalPlayer;
    closeEntryModal();
    renderAll();
    setStatus(`Logged ${fmt(total)} for ${loggedFor} on ${date}.`, 'ok');
  });

  window.App.openEntryModal = openEntryModal;

  // ---------- import / export ----------
  window.App.initImportExport();

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
