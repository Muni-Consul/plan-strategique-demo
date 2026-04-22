/* ================================================================
   6. RENDU — APERÇU
   ================================================================ */
function calcAvancementAxes() {
  if (!APP.autoCalcAxes) return; // Calcul auto désactivé
  // Calculer automatiquement l'avancement de chaque axe
  // basé sur la moyenne des actions associées
  APP.axes.forEach(axe => {
    const actionsAxe = APP.actions.filter(a => a.axe === axe.id);
    if (actionsAxe.length > 0) {
      const total = actionsAxe.reduce((sum, a) => sum + (parseInt(a.pct) || 0), 0);
      axe.pct = Math.round(total / actionsAxe.length);
    }
  });
}

function renderApercu() {
  // KPIs
  const total    = APP.actions.length;
  const done     = APP.actions.filter(a => a.statut === 'terminée').length;
  const late     = APP.actions.filter(a => a.statut === 'en retard').length;
  const inprog   = APP.actions.filter(a => a.statut === 'en cours').length;
  const global   = APP.axes.length ? Math.round(APP.axes.reduce((s,a) => s+a.pct,0) / APP.axes.length) : 0;

  document.getElementById('kpi-grid').innerHTML = [
    { label:'Avancement global', value:`${global}<sup>%</sup>`, delta:'↑ +8% ce trimestre', cls:'kpi-up' },
    { label:'Actions totales',   value:total,  delta:`Sur ${APP.axes.length} axes`, cls:'kpi-neutral' },
    { label:'Terminées',         value:done,   delta:`${Math.round(done/total*100)}% du total`, cls:'kpi-up' },
    { label:'En retard',         value:late,   delta:`${Math.round(late/total*100)}% du total`, cls:'kpi-down' },
    { label:'En cours',          value:inprog, delta:`${Math.round(inprog/total*100)}% du total`, cls:'kpi-neutral' },
  ].map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-delta ${k.cls}">${k.delta}</div>
    </div>
  `).join('');

  // Barres axes
  document.getElementById('axes-bars').innerHTML = APP.axes.map(a => `
    <div class="axe-row">
      <span class="axe-dot" style="background:${h(a.color)}"></span>
      <span class="axe-name">${h(a.nom)}</span>
      <div class="axe-bar">
        <div class="progress-wrap">
          <div class="progress-fill" style="width:${h(a.pct)}%;background:${h(a.color)}"></div>
        </div>
      </div>
      <span class="axe-pct">${h(a.pct)}%</span>
    </div>
  `).join('');

  // Donut
  const counts = {};
  APP.actions.forEach(a => { counts[a.statut] = (counts[a.statut]||0)+1; });
  const labs = Object.keys(counts);
  const vals = labs.map(l => counts[l]);
  const cols = labs.map(l => STATUS_MAP[l]?.dot || '#999');

  if (APP.donutChart) {
    APP.donutChart.data.labels = labs;
    APP.donutChart.data.datasets[0].data = vals;
    APP.donutChart.data.datasets[0].backgroundColor = cols;
    APP.donutChart.update('none'); // 'none' désactive l'animation pour les mises à jour
  } else {
    APP.donutChart = new Chart(document.getElementById('chart-donut'), {
      type: 'doughnut',
      data: { labels: labs, datasets: [{ data: vals, backgroundColor: cols, borderWidth: 0, hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label} : ${c.parsed}` } } } }
    });
  }

  document.getElementById('donut-leg').innerHTML = labs.map((l,i) =>
    `<span style="display:flex;align-items:center;gap:4px;">
       <span style="width:9px;height:9px;border-radius:2px;background:${h(cols[i])}"></span>${h(l)} (${vals[i]})
     </span>`
  ).join('');

  // Courbe trimestrielle
  const qLabels = ['T1 2024','T2','T3','T4','T1 2025','T2','T3','T4','T1 2026'];
  const qData   = [12,18,24,31,38,45,51,57,62];
  if (!APP.lineChart) APP.lineChart = new Chart(document.getElementById('chart-line'), {
    type: 'line',
    data: { labels: qLabels, datasets: [{
      label: '%', data: qData,
      borderColor: '#534AB7', backgroundColor: 'rgba(83,74,183,0.07)',
      tension: 0.4, fill: true, pointBackgroundColor: '#534AB7', pointRadius: 4, borderWidth: 2
    }]},
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min:0, max:100, ticks: { callback: v => v+'%', font:{size:11} }, grid:{ color:'rgba(128,128,128,0.08)' } },
        x: { ticks: { font:{size:11} }, grid:{ display:false } }
      }
    }
  });
}


/* ================================================================
   7. RENDU — ACTIONS
   ================================================================ */
const ACTIONS_PER_PAGE = 15;

function renderActions(filter, page) {
  if (filter !== undefined) APP.activeFilter = filter;
  if (page   !== undefined) APP.actionsPage  = page;
  if (!APP.actionsPage) APP.actionsPage = 1;
  const f = APP.activeFilter;

  // Filtres
  const statuts = ['tous', ...new Set(APP.actions.map(a => a.statut))];
  document.getElementById('filter-bar').innerHTML = statuts.map(s =>
    `<button class="filter-chip ${s===f?'on':''}" onclick="renderActions('${h(s)}',1)">${s==='tous'?'Tous':h(s)}</button>`
  ).join('');

  const list = f === 'tous' ? APP.actions : APP.actions.filter(a => a.statut === f);
  const totalPages = Math.max(1, Math.ceil(list.length / ACTIONS_PER_PAGE));
  if (APP.actionsPage > totalPages) APP.actionsPage = totalPages;
  const pageList = list.slice((APP.actionsPage - 1) * ACTIONS_PER_PAGE, APP.actionsPage * ACTIONS_PER_PAGE);
  const axeMap = getAxeMap();

  document.getElementById('actions-tbody').innerHTML = pageList.map(a => {
    const axe = axeMap[a.axe] || { color:'#888', light:'#eee', nom:a.axe };
    const sm  = STATUS_MAP[a.statut] || STATUS_MAP['à faire'];
    return `
      <tr>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${h(a.titre)}</td>
        <td><span style="font-size:11px;padding:2px 8px;border-radius:99px;background:${h(axe.light)};color:${h(axe.color)};font-weight:500;">${h(a.axe)}</span></td>
        <td style="white-space:nowrap;">${h(a.resp)}</td>
        <td><span class="prio-badge ${PRIO_MAP[a.prio]||'pr-m'}"></span></td>
        <td style="white-space:nowrap;font-size:12px;">${fmtDate(a.echeance)} ${a.statut !== 'terminée' ? formatDelai(a.echeance) : ''}</td>
        <td>
          <div class="mini-bar-wrap">
            <div class="mini-bar"><div class="mini-fill" style="width:${h(a.pct)}%;background:${h(sm.dot)}"></div></div>
            <span class="mini-pct">${h(a.pct)}%</span>
          </div>
        </td>
        <td><span class="pill ${sm.pill}">${h(a.statut)}</span></td>
        <td style="white-space:nowrap;">
          <button onclick="openFormModal('${h(a.id)}')" title="Modifier" style="border:none;background:none;cursor:pointer;padding:5px 6px;border-radius:6px;color:#185FA5;" onmouseover="this.style.background='#E6F1FB'" onmouseout="this.style.background='none'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onclick="confirmDelete('${h(a.id)}', event)" title="Supprimer" style="border:none;background:none;cursor:pointer;padding:5px 6px;border-radius:6px;color:#A32D2D;" onmouseover="this.style.background='#FCEBEB'" onmouseout="this.style.background='none'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </td>
      </tr>`;
  }).join('');

  // Pagination
  const pgEl = document.getElementById('actions-pagination');
  if (pgEl) {
    if (totalPages <= 1) {
      pgEl.innerHTML = '';
    } else {
      const p = APP.actionsPage;
      pgEl.innerHTML = `
        <div class="pagination">
          <button class="pg-btn" onclick="renderActions(undefined,${p-1})" ${p<=1?'disabled':''}>‹ Préc.</button>
          <span class="pg-info">Page ${p} / ${totalPages} &nbsp;(${list.length} actions)</span>
          <button class="pg-btn" onclick="renderActions(undefined,${p+1})" ${p>=totalPages?'disabled':''}>Suiv. ›</button>
        </div>`;
    }
  }
}


/* ================================================================
   8. RENDU — AXES
   ================================================================ */
function renderAxes() {
  const axeMap = getAxeMap();

  document.getElementById('axes-cards').innerHTML = APP.axes.map(axe => {
    const actions = APP.actions.filter(a => a.axe === axe.id);
    const done    = actions.filter(a => a.statut === 'terminée').length;
    const late    = actions.filter(a => a.statut === 'en retard').length;
    return `
      <div class="axe-card">
        <div class="axe-card-header">
          <span class="axe-card-dot" style="background:${h(axe.color)}"></span>
          <span class="axe-card-name">${h(axe.nom)}</span>
          <span class="axe-card-pct" style="color:${h(axe.color)}">${h(axe.pct)}%</span>
        </div>
        <div class="progress-wrap" style="height:8px;">
          <div class="progress-fill" style="width:${axe.pct}%;background:${axe.color}"></div>
        </div>
        <div style="display:flex;gap:14px;margin-top:10px;font-size:12px;color:var(--c-text-3);">
          <span>${actions.length} actions</span>
          <span style="color:var(--c-ok);">${done} terminées</span>
          ${late>0?`<span style="color:var(--c-danger);">${late} en retard</span>`:''}
        </div>
        <div class="tag-list">
          ${actions.slice(0,5).map(ac=>`<span class="tag">${h(ac.titre.slice(0,28))}${ac.titre.length>28?'…':''}</span>`).join('')}
          ${actions.length>5?`<span class="tag">+${actions.length-5} autres</span>`:''}
        </div>
      </div>`;
  }).join('');
}


/* ================================================================
   9. RENDU — TIMELINE
   ================================================================ */
function renderTimeline() {
  const axeMap = getAxeMap();

  const sorted = [...APP.jalons].sort((a,b) => new Date(a.date) - new Date(b.date));
  document.getElementById('timeline-list').innerHTML = sorted.map((item, i) => {
    const axe = axeMap[item.axe];
    const sm  = STATUS_MAP[item.statut] || STATUS_MAP['à faire'];
    const isLast = i === sorted.length - 1;
    return `
      <div class="tl-item">
        <div class="tl-left">
          <div class="tl-dot" style="background:${sm.dot}"></div>
          ${!isLast ? '<div class="tl-line"></div>' : ''}
        </div>
        <div class="tl-body">
          <div class="tl-title">${h(item.titre)}</div>
          <div class="tl-meta">
            <span>${fmtDate(item.date)}</span>
            ${axe ? `<span style="color:${h(axe.color)}">${h(axe.nom)}</span>` : ''}
            <span class="pill ${sm.pill}">${h(item.statut)}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}


/* ================================================================
   MA VUE — PAR RESPONSABLE
   ================================================================ */
function renderMaVue() {
  initDefaultSettings();
  const select = document.getElementById('mavue-resp-select');
  // Populate select
  if (select.options.length <= 1) {
    const resps = [...new Set(APP.actions.map(a => a.resp).filter(Boolean))];
    resps.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      select.appendChild(opt);
    });
    // Also from settings
    (APP.responsables||[]).forEach(r => {
      if (!Array.from(select.options).find(o => o.value === r.nom)) {
        const opt = document.createElement('option');
        opt.value = r.nom; opt.textContent = r.nom;
        select.appendChild(opt);
      }
    });
  }
  const resp = select.value;
  const filtered = resp ? APP.actions.filter(a => a.resp === resp) : [];
  const axeMap = getAxeMap();

  // KPIs
  const kpisEl = document.getElementById('mavue-kpis');
  if (filtered.length > 0) {
    const done = filtered.filter(a => a.statut === 'terminée').length;
    const late = filtered.filter(a => {
      if (!a.echeance || a.statut === 'terminée') return false;
      const _d = parseLocalDate(a.echeance); return _d && _d < new Date();
    }).length;
    const avgPct = Math.round(filtered.reduce((s,a) => s+a.pct, 0) / filtered.length);
    kpisEl.innerHTML = [
      { label:'Actions assignées', val:filtered.length, cls:'' },
      { label:'Terminées', val:done, cls:'color:#3B6D11' },
      { label:'En retard', val:late, cls:'color:#A32D2D' },
      { label:'Avancement moyen', val:avgPct+'%', cls:'color:#534AB7' },
    ].map(k => `<div style="background:var(--c-surface-2);border-radius:var(--radius-md);padding:10px 12px;">
      <div style="font-size:11px;color:var(--c-text-2);margin-bottom:4px;">${k.label}</div>
      <div style="font-size:22px;font-weight:500;font-family:var(--font-mono);${k.cls}">${k.val}</div>
    </div>`).join('');
  } else {
    kpisEl.innerHTML = '';
  }

  // Table
  document.getElementById('mavue-tbody').innerHTML = filtered.map(a => {
    const axe = axeMap[a.axe] || { color:'#888', light:'#eee' };
    const sm = STATUS_MAP[a.statut] || STATUS_MAP['à faire'];
    return `<tr onclick="openFormModal('${h(a.id)}')" style="cursor:pointer;">
      <td style="font-weight:500;">${h(a.titre)}</td>
      <td><span style="font-size:11px;padding:2px 8px;border-radius:99px;background:${h(axe.light)};color:${h(axe.color)};font-weight:500;">${h(a.axe)}</span></td>
      <td style="white-space:nowrap;font-size:12px;">${fmtDate(a.echeance)} ${a.statut!=='terminée'?formatDelai(a.echeance):''}</td>
      <td><div class="mini-bar-wrap"><div class="mini-bar"><div class="mini-fill" style="width:${h(a.pct)}%;background:${h(sm.dot)}"></div></div><span class="mini-pct">${h(a.pct)}%</span></div></td>
      <td><span class="pill ${sm.pill}">${h(a.statut)}</span></td>
    </tr>`;
  }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--c-text-3);padding:2rem;">Sélectionnez un responsable</td></tr>';
}


/* ================================================================
   GANTT
   ================================================================ */
function renderGantt() {
  const container = document.getElementById('gantt-container');
  if (!container) return;
  const now = new Date();
  const year = now.getFullYear();
  const gyEl = document.getElementById('gantt-year-label'); if (gyEl) gyEl.textContent = year;

  const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const startYear = new Date(year, 0, 1);
  const endYear   = new Date(year, 11, 31);
  const totalDays = Math.round((endYear - startYear) / 86400000) + 1;

  const allGanttActions = APP.actions.filter(a => {
    if (!a.echeance) return false;
    const d = parseLocalDate(a.echeance);
    return (d && d.getFullYear() === year) || (a.dateDebut && parseLocalDate(a.dateDebut)?.getFullYear() === year);
  });
  const ganttTruncated = allGanttActions.length > 20;
  const actions = allGanttActions.slice(0, 20);

  const axeMap = getAxeMap();

  let html = `<div style="font-size:11px;">`;

  // Header mois
  html += `<div style="display:flex;margin-left:180px;margin-bottom:4px;">`;
  months.forEach((m, i) => {
    const w = new Date(year, i+1, 0).getDate() / totalDays * 100;
    html += `<div style="flex:0 0 ${w}%;font-size:10px;color:var(--c-text-3);text-align:center;border-left:0.5px solid var(--c-border);">${m}</div>`;
  });
  html += `</div>`;

  // Ligne aujourd'hui
  const todayPct = Math.round((now - startYear) / 86400000) / totalDays * 100;

  // Lignes actions
  actions.forEach(a => {
    const axe = axeMap[a.axe] || { color:'#888' };
    const echeance = parseLocalDate(a.echeance) || new Date(year, 11, 31);
    const debut = parseLocalDate(a.dateDebut) || new Date(year, 0, 1);
    const startPct = Math.max(0, Math.round((debut - startYear) / 86400000) / totalDays * 100);
    const endPct   = Math.min(100, Math.round((echeance - startYear) / 86400000) / totalDays * 100);
    if (endPct <= startPct) return; // dates incohérentes — ignorer cette barre
    const width = endPct - startPct;
    const sm = STATUS_MAP[a.statut] || STATUS_MAP['à faire'];

    html += `<div style="display:flex;align-items:center;margin-bottom:5px;height:28px;">
      <div style="width:180px;flex-shrink:0;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8px;color:var(--c-text);" title="${h(a.titre)}">${h(a.titre)}</div>
      <div style="flex:1;position:relative;height:100%;border-left:0.5px solid var(--c-border);">
        <div style="position:absolute;left:${todayPct}%;top:0;bottom:0;width:1px;background:rgba(227,75,74,0.4);z-index:1;"></div>
        <div style="position:absolute;left:${startPct}%;width:${width}%;top:4px;height:20px;background:${h(axe.color)};opacity:0.75;border-radius:4px;display:flex;align-items:center;padding:0 6px;overflow:hidden;" title="${h(a.titre)} — ${fmtDate(a.echeance)}">
          <span style="font-size:10px;color:white;white-space:nowrap;font-weight:500;">${h(a.pct)}%</span>
        </div>
      </div>
    </div>`;
  });

  if (actions.length === 0) {
    html += `<div style="text-align:center;color:var(--c-text-3);padding:2rem;font-size:13px;">Aucune action avec échéance en ${year}</div>`;
  }
  if (ganttTruncated) {
    html += `<div style="margin-top:8px;padding:6px 12px;background:var(--c-surface-2);border-radius:var(--radius-sm);font-size:11px;color:var(--c-text-3);text-align:center;">
      ${allGanttActions.length - 20} action${allGanttActions.length - 20 > 1 ? 's' : ''} supplémentaire${allGanttActions.length - 20 > 1 ? 's' : ''} non affichée${allGanttActions.length - 20 > 1 ? 's' : ''} — affinez le filtre pour les voir
    </div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}


/* ================================================================
   MODE PRÉSENTATION
   ================================================================ */
let presentationActive = false;
function togglePresentationMode() {
  presentationActive = !presentationActive;
  document.querySelector('.app').classList.toggle('presentation-mode', presentationActive);
  const btn = document.getElementById('btn-presentation');
  btn.style.background = presentationActive ? '#534AB7' : '';
  btn.style.color      = presentationActive ? '#fff' : '';
  btn.style.borderColor= presentationActive ? '#534AB7' : '';
  if (presentationActive) {
    switchPane('apercu', document.querySelector('.nav-item'));
  }
}


/* ================================================================
   HISTORIQUE PAR ACTION — ajout dans modal
   ================================================================ */

// Fermer en cliquant sur le fond
document.getElementById('form-modal-bg').addEventListener('click', function(e) {
  if (e.target === this) closeFormModal();
});

