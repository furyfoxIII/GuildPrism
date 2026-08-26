// ---------- Google Sheet sync (via a user-deployed Apps Script Web App) ----------
//
// GuildPrism can't write to an arbitrary Google Sheets link directly — the
// Sheets API requires an authorized credential on every write, even against
// a sheet shared as "anyone can edit". Instead we talk to a small Apps
// Script the sheet owner deploys once as a "Web App" (Execute as: Me, Who
// has access: Anyone). That script runs with the owner's permission, so
// this page can just fetch() its URL with no sign-in flow of its own.
// See the README for the exact Apps Script snippet to paste in.
//
// The wire format matches js/importExport.js exactly (same FORMAT_VERSION,
// same Date/Player/Total row shape, same normalizeRow parsing rules, and
// the same treasury value carried alongside it) so a sheet round-trips
// identically whether it was touched by file export or by this sync path.
window.App = window.App || {};

(function(){
  const State = window.App.State;
  const els = window.App.els;
  const { setStatus, renderAll } = window.App;
  const BN = window.App.BN;
  const { FORMAT_VERSION, normalizeRow, historyToRows, parseTreasuryValue } = window.App.SheetFormat;

  const STORAGE_KEY = 'guildPrismSheetSettings';

  function loadSettings(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { url: '', secret: '' };
    }catch(err){
      return { url: '', secret: '' };
    }
  }

  function saveSettings(settings){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }
    catch(err){ /* private-browsing or storage disabled — sync still works this session */ }
  }

  function currentSettings(){
    return {
      url: els.sheetUrlInput.value.trim(),
      secret: els.sheetSecretInput.value,
    };
  }

  // Apps Script Web Apps don't handle CORS preflight (OPTIONS) requests, so
  // POST bodies are sent as text/plain (a "simple request" that skips
  // preflight) even though the payload itself is JSON. The Apps Script side
  // parses e.postData.contents as JSON regardless of the declared type.
  async function pushToSheet(){
    const { url, secret } = currentSettings();
    if (!url){ setStatus('Enter your Apps Script Web App URL first.', 'err'); return; }
    if (!State.history.length && BN.isZero(State.treasury)){
      const ok = confirm("You don't have any local data (no history and an empty treasury). Pushing now will overwrite the connected Google Sheet with empty data. Continue anyway?");
      if (!ok){ setStatus('Push cancelled — nothing was sent.', 'err'); return; }
    }

    const body = JSON.stringify({
      secret,
      formatVersion: FORMAT_VERSION,
      treasury: BN.toStorageValue(State.treasury),
      rows: historyToRows(State.history),
    });

    els.sheetPushBtn.disabled = true;
    try{
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'The Apps Script rejected the request.');
      setStatus(`Pushed ${data.count ?? historyToRows(State.history).length} entries to the sheet.`, 'ok');
    }catch(err){
      setStatus('Push failed: ' + err.message, 'err');
    }finally{
      els.sheetPushBtn.disabled = false;
    }
  }

  async function pullFromSheet(){
    const { url, secret } = currentSettings();
    if (!url){ setStatus('Enter your Apps Script Web App URL first.', 'err'); return; }

    els.sheetPullBtn.disabled = true;
    try{
      const fetchUrl = new URL(url);
      fetchUrl.searchParams.set('action', 'pull');
      if (secret) fetchUrl.searchParams.set('secret', secret);
      const res = await fetch(fetchUrl.toString());
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'The Apps Script rejected the request.');

      const rows = Array.isArray(data.rows) ? data.rows : [];
      const parsed = rows.map(normalizeRow).filter(Boolean);
      if (!parsed.length){
        throw new Error('No valid rows found in the sheet. Expected columns: Date, Player, Total.');
      }
      const skipped = rows.length - parsed.length;
      if (State.history.length && !confirm(`Pull ${parsed.length} entries${skipped ? ` (${skipped} rows skipped)` : ''}? This replaces all current data.`)){
        return;
      }

      State.history = parsed;
      State.treasury = parseTreasuryValue(data.treasury);
      renderAll();
      const versionNote = data.formatVersion > FORMAT_VERSION
        ? ' Note: this sheet was written by a newer version of the app — some data may not have loaded correctly.'
        : '';
      setStatus(`Pulled ${parsed.length} entries from the sheet.${skipped ? ` (${skipped} skipped)` : ''}${versionNote}`, versionNote ? 'err' : 'ok');
    }catch(err){
      setStatus('Pull failed: ' + err.message, 'err');
    }finally{
      els.sheetPullBtn.disabled = false;
    }
  }

  function initGoogleSheets(){
    const saved = loadSettings();
    els.sheetUrlInput.value = saved.url || '';
    els.sheetSecretInput.value = saved.secret || '';

    function openModal(){ els.sheetModalBackdrop.hidden = false; els.sheetUrlInput.focus(); }
    function closeModal(){ els.sheetModalBackdrop.hidden = true; }

    els.sheetBtn.addEventListener('click', openModal);
    els.sheetModalClose.addEventListener('click', closeModal);
    els.sheetModalBackdrop.addEventListener('click', (ev) => {
      if (ev.target === els.sheetModalBackdrop) closeModal();
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !els.sheetModalBackdrop.hidden) closeModal();
    });

    els.sheetSettingsForm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      saveSettings(currentSettings());
      setStatus('Google Sheet connection saved in this browser.', 'ok');
      closeModal();
    });

    els.sheetPullBtn.addEventListener('click', () => { pullFromSheet(); });
    els.sheetPushBtn.addEventListener('click', () => { pushToSheet(); });
  }

  window.App.initGoogleSheets = initGoogleSheets;
})();
