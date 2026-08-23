// ---------- dom refs + render ----------
window.App = window.App || {};

(function(){
  const BN = window.App.BN;
  const { weekLabel } = window.App.Dates;
  const State = window.App.State;

  const els = {
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),
    exportBtn: document.getElementById('exportBtn'),
    clearBtn: document.getElementById('clearBtn'),
    toolbarStatus: document.getElementById('toolbarStatus'),
    statTotal: document.getElementById('statTotal'),
    statWeek: document.getElementById('statWeek'),
    statMembers: document.getElementById('statMembers'),
    statWeeks: document.getElementById('statWeeks'),
    chartFloor: document.getElementById('chartFloor'),
    chartAxis: document.getElementById('chartAxis'),
    chartBodyView: document.getElementById('chartBodyView'),
    pieView: document.getElementById('pieView'),
    viewTabs: document.querySelectorAll('.view-tab'),
    leaderboardWrap: document.getElementById('leaderboardWrap'),
    lbHint: document.getElementById('lbHint'),
    sortTabs: document.querySelectorAll('.sort-tab'),
    addPlayerForm: document.getElementById('addPlayerForm'),
    newPlayerInput: document.getElementById('newPlayerInput'),
    newPlayerStartInput: document.getElementById('newPlayerStartInput'),
    removePlayerForm: document.getElementById('removePlayerForm'),
    removePlayerSelect: document.getElementById('removePlayerSelect'),
    historyWrap: document.getElementById('historyWrap'),
    entryModalBackdrop: document.getElementById('entryModalBackdrop'),
    entryModal: document.getElementById('entryModal'),
    entryModalClose: document.getElementById('entryModalClose'),
    entryModalPlayerName: document.getElementById('entryModalPlayerName'),
    modalEntryForm: document.getElementById('modalEntryForm'),
    modalDateInput: document.getElementById('modalDateInput'),
    modalTotalInput: document.getElementById('modalTotalInput'),
    modalEntryPreview: document.getElementById('modalEntryPreview'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    tabBtnOverview: document.getElementById('tabBtnOverview'),
    tabBtnManage: document.getElementById('tabBtnManage'),
    tabOverview: document.getElementById('tabOverview'),
    tabManage: document.getElementById('tabManage'),
  };

  function fmt(n){ return BN.format(n); }
  function fmtSigned(n){
    if (BN.isZero(n)) return '0';
    const s = fmt(n);
    return BN.isNeg(n) ? s : '+' + s;
  }
  function escapeHtml(str){
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
  function setStatus(msg, kind){
    els.toolbarStatus.textContent = msg;
    els.toolbarStatus.className = 'toolbar-status' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '');
  }

  function renderAll(){
    const d = window.App.computeDerived();
    renderStats(d);
    renderChart(d.series);
    renderPieChart(d.players);
    renderLeaderboard(d.players);
    renderRemovePlayerSelect(d.players);
    renderHistory(d.entriesWithDelta);
  }

  function renderStats(d){
    els.statTotal.textContent = fmt(d.guildTotal);
    els.statWeek.textContent = fmtSigned(d.guildThisWeek);
    els.statMembers.textContent = d.players.length;
    els.statWeeks.textContent = d.weeksTracked;
  }

  // Builds a non-linear (log10) y-axis: gridlines/labels at "nice" decade
  // steps (..., 1k, 10k, 100k, 1M, ...; or 1sx, 10sx, 100sx, 1sp, ... once
  // values get into suffix territory), spaced by order of magnitude rather
  // than by value — so a chart with both small and astronomically large
  // weekly totals still shows useful structure instead of flat-lining.
  const WK_LABEL_RESERVE = 20; // px reserved at the bottom for the week label row

  function renderChart(series){
    if (!series.length){
      els.chartFloor.innerHTML = '<div class="chart-empty">Import or add data to see the weekly trend.</div>';
      els.chartAxis.innerHTML = '';
      return;
    }

    const logs = series
      .map(s => BN.log10(s.total))
      .filter(v => v !== null);

    // Total height (px) available to both the axis column and the bar
    // area — they're sibling flex items of equal stretched height, so
    // measuring one gives a shared coordinate space for gridlines/bars.
    const H = els.chartAxis.clientHeight || els.chartFloor.clientHeight || 160;
    const trackH = Math.max(30, H - WK_LABEL_RESERVE);

    if (!logs.length){
      // Every week is zero (or negative) — nothing to scale against.
      els.chartAxis.innerHTML = '';
      els.chartFloor.innerHTML = series.map(s => `<div class="bar-wrap" title="Week of ${weekLabel(s.weekStart)}: ${fmtSigned(s.total)} prism">
          <div class="bar" style="height:3px;"></div>
          <div class="wk">${weekLabel(s.weekStart)}</div>
        </div>`).join('');
      return;
    }

    let minLog = Math.min(...logs);
    let maxLog = Math.max(...logs);
    if (maxLog - minLog < 1){ // degenerate/near-flat range — pad so it isn't a single line
      const mid = (maxLog + minLog) / 2;
      minLog = mid - 0.5; maxLog = mid + 0.5;
    }
    const axisFloor = Math.floor(minLog);
    const axisCeil = Math.ceil(maxLog);
    const axisMax = axisCeil + 0.12; // headroom so the tallest bar doesn't touch the top
    const range = axisMax - axisFloor;
    const pxFor = (log) => WK_LABEL_RESERVE + Math.max(0, Math.min(1, (log - axisFloor) / range)) * trackH;

    // Thin decade ticks out if the range spans a lot of orders of magnitude.
    const decadeCount = axisCeil - axisFloor + 1;
    const step = decadeCount > 7 ? Math.ceil(decadeCount / 7) : 1;
    const ticks = [];
    for (let d = axisFloor; d < axisCeil; d += step) ticks.push(d);
    ticks.push(axisCeil);

    els.chartAxis.innerHTML = ticks.map(d => {
      const label = fmt({ m: 1, e: d });
      return `<div class="axis-tick" style="bottom:${pxFor(d)}px">${label}</div>`;
    }).join('');

    const gridLines = ticks.map(d => `<div class="chart-grid-line" style="bottom:${pxFor(d)}px"></div>`).join('');

    const bars = series.map(s => {
      const log = BN.log10(s.total);
      const barPx = log === null ? 3 : Math.max(3, pxFor(log) - WK_LABEL_RESERVE);
      return `<div class="bar-wrap" title="Week of ${weekLabel(s.weekStart)}: ${fmtSigned(s.total)} prism">
        <div class="bar" style="height:${barPx}px;"></div>
        <div class="wk">${weekLabel(s.weekStart)}</div>
      </div>`;
    }).join('');

    els.chartFloor.innerHTML = gridLines + bars;
    els.chartFloor.scrollLeft = els.chartFloor.scrollWidth;
  }

  const PIE_PALETTE = ['#8d7bff','#45e6d1','#ff8f6b','#ffcf6b','#6bb8ff','#ff6b9d','#a3ff6b','#c66bff','#ff9e4a','#5adbb5'];

  // angle is degrees clockwise from the top (12 o'clock), matching how the
  // slices are laid out below.
  function pointOnCircle(cx, cy, r, angleDeg){
    const rad = angleDeg * Math.PI / 180;
    return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
  }
  function pieSlicePath(cx, cy, r, startDeg, endDeg){
    const p1 = pointOnCircle(cx, cy, r, startDeg);
    const p2 = pointOnCircle(cx, cy, r, endDeg);
    const largeArc = (endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)} Z`;
  }

  function renderPieChart(players){
    const contributions = players
      .map(p => ({ name: p.name, amt: p.thisWeek }))
      .filter(p => BN.cmp(p.amt, BN.zero()) > 0)
      .sort((a, b) => BN.cmp(b.amt, a.amt));

    if (!contributions.length){
      els.pieView.innerHTML = '<div class="chart-empty">No donations logged this week yet.</div>';
      return;
    }

    const total = contributions.reduce((s, c) => BN.add(s, c.amt), BN.zero());
    const cx = 100, cy = 100, r = 92;
    let cum = 0;
    let slices = '';
    const legend = [];

    contributions.forEach((c, i) => {
      const frac = BN.ratio(c.amt, total);
      const color = PIE_PALETTE[i % PIE_PALETTE.length];
      const pct = (frac * 100).toFixed(frac < 0.01 ? 2 : 1);
      const tooltip = `${escapeHtml(c.name)}: ${fmt(c.amt)} (${pct}%)`;
      if (contributions.length === 1 || frac > 0.9995){
        slices += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"><title>${tooltip}</title></circle>`;
      } else {
        const startDeg = cum * 360;
        cum += frac;
        const endDeg = Math.min(cum, 1) * 360;
        slices += `<path d="${pieSlicePath(cx, cy, r, startDeg, endDeg)}" fill="${color}"><title>${tooltip}</title></path>`;
      }
      legend.push(`<div class="pie-legend-row">
          <span class="swatch" style="background:${color}"></span>
          <span class="pl-name">${escapeHtml(c.name)}</span>
          <span class="pl-amt">${fmt(c.amt)}</span>
          <span class="pl-pct">${pct}%</span>
        </div>`);
    });

    els.pieView.innerHTML = `
      <svg viewBox="0 0 200 200" class="pie-svg" role="img" aria-label="This week's contributions by member">${slices}</svg>
      <div class="pie-legend">${legend.join('')}</div>
    `;
  }

  function renderLeaderboard(players){
    if (!players.length){
      els.leaderboardWrap.innerHTML = '<div class="empty-state">No members yet — add someone below or import a spreadsheet.</div>';
      els.lbHint.hidden = true;
      return;
    }
    els.lbHint.hidden = false;
    const sorted = players.slice().sort((a,b) => BN.cmp(b[State.sortMode], a[State.sortMode]));
    const head = `<div class="lb-row head">
        <div></div><div>Member</div><div>Total</div><div>This wk</div><div>Last wk</div>
      </div>`;
    const rows = sorted.map((p, i) => {
      const cls = v => BN.isZero(v) ? 'zero' : BN.isNeg(v) ? 'neg' : 'pos';
      return `<div class="lb-row clickable" data-player="${escapeHtml(p.name)}" tabindex="0" role="button">
        <div class="rank">${i+1}</div>
        <div class="pname">${escapeHtml(p.name)}<span class="since">updated ${p.lastUpdated}</span></div>
        <div class="num">${fmt(p.total)}</div>
        <div class="num delta ${cls(p.thisWeek)}">${fmtSigned(p.thisWeek)}</div>
        <div class="num delta ${cls(p.lastWeek)}">${fmtSigned(p.lastWeek)}</div>
      </div>`;
    }).join('');
    els.leaderboardWrap.innerHTML = head + rows;
    els.leaderboardWrap.querySelectorAll('.lb-row.clickable').forEach(row => {
      const open = () => window.App.openEntryModal(row.dataset.player);
      row.addEventListener('click', open);
      row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); open(); } });
    });
  }

  function renderRemovePlayerSelect(players){
    if (!els.removePlayerSelect) return;
    const prev = els.removePlayerSelect.value;
    els.removePlayerSelect.innerHTML = players.length
      ? players.slice().sort((a,b) => a.name.localeCompare(b.name)).map(p => `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('')
      : '<option value="" disabled selected>No players yet</option>';
    if (players.some(p => p.name === prev)) els.removePlayerSelect.value = prev;
  }

  function renderHistory(entries){
    if (!entries.length){
      els.historyWrap.innerHTML = '<div class="empty-state" style="margin-top:12px;">No entries logged yet.</div>';
      return;
    }
    const sorted = entries.slice().sort((a,b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const rows = sorted.map(e => `<tr>
        <td>${e.date}</td>
        <td>${escapeHtml(e.player)}</td>
        <td class="num">${fmt(e.total)}</td>
        <td class="num">${e.isBaseline ? '—' : fmtSigned(e.delta)}</td>
        <td><button class="del-row-btn" data-id="${e.id}">Remove</button></td>
      </tr>`).join('');
    els.historyWrap.innerHTML = `<table class="hist-table">
      <thead><tr><th>Date</th><th>Player</th><th>Total</th><th>Δ</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
    els.historyWrap.querySelectorAll('.del-row-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        State.history = State.history.filter(e => e.id !== btn.dataset.id);
        renderAll();
      });
    });
  }

  window.App.els = els;
  window.App.fmt = fmt;
  window.App.fmtSigned = fmtSigned;
  window.App.escapeHtml = escapeHtml;
  window.App.setStatus = setStatus;
  window.App.renderAll = renderAll;
})();
