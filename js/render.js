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
    sampleBtn: document.getElementById('sampleBtn'),
    clearBtn: document.getElementById('clearBtn'),
    toolbarStatus: document.getElementById('toolbarStatus'),
    statTotal: document.getElementById('statTotal'),
    statWeek: document.getElementById('statWeek'),
    statMembers: document.getElementById('statMembers'),
    statWeeks: document.getElementById('statWeeks'),
    chartFloor: document.getElementById('chartFloor'),
    leaderboardWrap: document.getElementById('leaderboardWrap'),
    sortTabs: document.querySelectorAll('.sort-tab'),
    entryForm: document.getElementById('entryForm'),
    playerInput: document.getElementById('playerInput'),
    dateInput: document.getElementById('dateInput'),
    totalInput: document.getElementById('totalInput'),
    entryPreview: document.getElementById('entryPreview'),
    playerList: document.getElementById('playerList'),
    historyWrap: document.getElementById('historyWrap'),
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
    renderLeaderboard(d.players);
    renderPlayerList(d.players);
    renderHistory(d.entriesWithDelta);
  }

  function renderStats(d){
    els.statTotal.textContent = fmt(d.guildTotal);
    els.statWeek.textContent = fmtSigned(d.guildThisWeek);
    els.statMembers.textContent = d.players.length;
    els.statWeeks.textContent = d.weeksTracked;
  }

  function renderChart(series){
    if (!series.length){
      els.chartFloor.innerHTML = '<div class="chart-empty">Import or add data to see the weekly trend.</div>';
      return;
    }
    let max = BN.zero();
    series.forEach(s => { if (BN.cmp(s.total, max) > 0) max = s.total; });
    if (BN.isZero(max)) max = BN.fromNumber(1);
    els.chartFloor.innerHTML = series.map(s => {
      const ratio = BN.cmp(s.total, BN.zero()) <= 0 ? 0 : BN.ratio(s.total, max);
      const h = ratio <= 0 ? 3 : Math.max(4, Math.round(ratio * 150));
      return `<div class="bar-wrap" title="Week of ${weekLabel(s.weekStart)}: ${fmtSigned(s.total)} prism">
        <div class="bar" style="height:${h}px;"></div>
        <div class="wk">${weekLabel(s.weekStart)}</div>
      </div>`;
    }).join('');
    els.chartFloor.scrollLeft = els.chartFloor.scrollWidth;
  }

  function renderLeaderboard(players){
    if (!players.length){
      els.leaderboardWrap.innerHTML = '<div class="empty-state">No members yet — import a spreadsheet or add someone below.</div>';
      return;
    }
    const sorted = players.slice().sort((a,b) => BN.cmp(b[State.sortMode], a[State.sortMode]));
    const head = `<div class="lb-row head">
        <div></div><div>Member</div><div>Total</div><div>This wk</div><div>Last wk</div>
      </div>`;
    const rows = sorted.map((p, i) => {
      const cls = v => BN.isZero(v) ? 'zero' : BN.isNeg(v) ? 'neg' : 'pos';
      return `<div class="lb-row">
        <div class="rank">${i+1}</div>
        <div class="pname">${escapeHtml(p.name)}<span class="since">updated ${p.lastUpdated}</span></div>
        <div class="num">${fmt(p.total)}</div>
        <div class="num delta ${cls(p.thisWeek)}">${fmtSigned(p.thisWeek)}</div>
        <div class="num delta ${cls(p.lastWeek)}">${fmtSigned(p.lastWeek)}</div>
      </div>`;
    }).join('');
    els.leaderboardWrap.innerHTML = head + rows;
  }

  function renderPlayerList(players){
    els.playerList.innerHTML = players.map(p => `<option value="${escapeHtml(p.name)}">`).join('');
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
