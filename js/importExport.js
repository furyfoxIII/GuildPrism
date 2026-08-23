// ---------- spreadsheet import / export (uses the SheetJS/xlsx library) ----------
//
// Backward-compatibility note for future edits:
// If you rename/restructure the exported columns or the big-number storage
// format (BN.toStorageValue), keep OLD header names/candidates in findKey's
// lists rather than replacing them, and keep normalizeRow able to parse
// values written by older versions. That's what lets spreadsheets exported
// by an older build of the app still import cleanly after an update.
// FORMAT_VERSION is stamped into a hidden "Meta" sheet on every export so a
// future version can at least detect ("this file is from a newer/older
// format") — bump it whenever you make a change that isn't compatible with
// what earlier normalizeRow versions expect.
window.App = window.App || {};

(function(){
  const BN = window.App.BN;
  const { toISODate } = window.App.Dates;
  const State = window.App.State;
  const els = window.App.els;
  const { setStatus, renderAll } = window.App;

  const FORMAT_VERSION = 1;

  function findKey(row, candidates){
    const keys = Object.keys(row);
    for (const c of candidates){
      const hit = keys.find(k => k.trim().toLowerCase() === c);
      if (hit) return hit;
    }
    return null;
  }

  function normalizeRow(row){
    const dateKey = findKey(row, ['date', 'week', 'week of', 'logged']);
    const playerKey = findKey(row, ['player', 'name', 'username', 'member']);
    const totalKey = findKey(row, ['total', 'prism', 'amount', 'total prism']);
    if (!dateKey || !playerKey || !totalKey) return null;

    let rawDate = row[dateKey];
    let dateStr;
    if (rawDate instanceof Date && !isNaN(rawDate)){
      dateStr = toISODate(rawDate);
    } else if (typeof rawDate === 'number'){
      // Excel serial date fallback
      const parsed = XLSX.SSF.parse_date_code(rawDate);
      if (!parsed) return null;
      dateStr = `${parsed.y}-${String(parsed.m).padStart(2,'0')}-${String(parsed.d).padStart(2,'0')}`;
    } else if (typeof rawDate === 'string' && rawDate.trim()){
      const d = new Date(rawDate);
      if (isNaN(d)) return null;
      dateStr = toISODate(d);
    } else {
      return null;
    }

    const player = String(row[playerKey] || '').trim();
    const total = BN.parse(row[totalKey]);
    if (!player || !total) return null;

    return { id: window.App.uid(), date: dateStr, player, total };
  }

  // Reads the hidden "Meta" sheet (if present) to find which format version
  // wrote this file. Older exports (before this existed) have no Meta sheet
  // at all — that's treated as version 1, not an error.
  function readFormatVersion(wb){
    const ws = wb.Sheets['Meta'];
    if (!ws) return 1;
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const row = rows.find(r => {
      const k = findKey(r, ['key']);
      return k && String(r[k]).trim().toLowerCase() === 'format version';
    });
    if (!row) return 1;
    const valKey = findKey(row, ['value']);
    const v = valKey ? parseInt(row[valKey], 10) : NaN;
    return isNaN(v) ? 1 : v;
  }

  function initImportExport(){
    els.importBtn.addEventListener('click', () => els.importFile.click());

    els.importFile.addEventListener('change', async (ev) => {
      const file = ev.target.files[0];
      if (!file) return;
      try{
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array', cellDates: true });
        const fileVersion = readFormatVersion(wb);
        const sheetName = wb.SheetNames.find(n => n !== 'Meta') || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const parsed = rows.map(normalizeRow).filter(Boolean);
        if (!parsed.length){
          throw new Error('No valid rows found. Expected columns: Date, Player, Total.');
        }
        const skipped = rows.length - parsed.length;
        if (State.history.length && !confirm(`Import ${parsed.length} entries${skipped ? ` (${skipped} rows skipped)` : ''}? This replaces all current data.`)) {
          return;
        }
        State.history = parsed;
        renderAll();
        const versionNote = fileVersion > FORMAT_VERSION
          ? ' Note: this file was exported by a newer version of the app — some data may not have loaded correctly.'
          : '';
        setStatus(`Imported ${parsed.length} entries from ${file.name}${skipped ? ` (${skipped} skipped)` : ''}.${versionNote}`, versionNote ? 'err' : 'ok');
      }catch(err){
        setStatus('Import failed: ' + err.message, 'err');
      }finally{
        els.importFile.value = '';
      }
    });

    els.exportBtn.addEventListener('click', () => {
      if (!State.history.length){ setStatus('Nothing to export yet.', 'err'); return; }
      const rows = State.history.slice()
        .sort((a,b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
        .map(e => ({ Date: e.date, Player: e.player, Total: BN.toStorageValue(e.total) }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const metaWs = XLSX.utils.json_to_sheet([
        { Key: 'Format version', Value: FORMAT_VERSION },
        { Key: 'Exported', Value: toISODate(new Date()) },
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'History');
      XLSX.utils.book_append_sheet(wb, metaWs, 'Meta');
      const filename = `guild-prism-history-${toISODate(new Date())}.xlsx`;
      XLSX.writeFile(wb, filename);
      setStatus(`Exported ${rows.length} entries to ${filename}.`, 'ok');
    });
  }

  window.App.initImportExport = initImportExport;
})();
