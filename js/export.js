/* ================================================================
   EXPORT PDF
   ================================================================ */
function exportPDF() {
  const style = `
    <style>
      body { font-family: sans-serif; color: #1A1917; margin: 0; padding: 20px; }
      h1 { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
      .subtitle { font-size: 12px; color: #888; margin-bottom: 20px; }
      .kpis { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
      .kpi { background: #F7F6F3; border-radius: 8px; padding: 12px 16px; min-width: 100px; }
      .kpi-label { font-size: 11px; color: #888; margin-bottom: 4px; }
      .kpi-val { font-size: 24px; font-weight: 300; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 20px; }
      th { text-align: left; padding: 7px 8px; background: #F7F6F3; border-bottom: 1px solid #ddd; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
      td { padding: 7px 8px; border-bottom: 0.5px solid #eee; vertical-align: top; }
      td.realisation { font-size: 11px; color: #444; max-width: 260px; }
      .pill { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 500; }
      .footer { margin-top: 30px; font-size: 10px; color: #aaa; text-align: center; border-top: 0.5px solid #eee; padding-top: 10px; }
      @media print { body { padding: 10px; } @page { size: landscape; margin: 1.5cm; } }
  
    .action-btns { display:flex; gap:4px; justify-content:flex-end; }
    .btn-action { border:none; background:none; cursor:pointer; padding:5px 7px; border-radius:6px; line-height:1; transition:background 0.15s; }
    .btn-action svg { width:13px; height:13px; display:block; }
    .btn-edit { color:var(--c-blue); }
    .btn-edit:hover { background:var(--c-blue-l); }
    .btn-del { color:var(--c-danger); }
    .btn-del:hover { background:var(--c-danger-l); }

  </style>`;

  const total  = APP.actions.length;
  const done   = APP.actions.filter(a => a.statut === 'terminée').length;
  const late   = APP.actions.filter(a => {
    if (!a.echeance || a.statut === 'terminée') return false;
    const _d = parseLocalDate(a.echeance); return _d && _d < new Date();
  }).length;
  const global = APP.axes.length ? Math.round(APP.axes.reduce((s,a) => s+a.pct,0)/APP.axes.length) : 0;

  const rows = APP.actions.map(a => {
    const sm = STATUS_MAP[a.statut] || STATUS_MAP['à faire'];
    const bg = sm.dot + '22';
    return `<tr>
      <td>${h(a.titre)}</td>
      <td>${h(a.axe)}</td>
      <td>${h(a.resp || '—')}</td>
      <td>${h(a.prio || '—')}</td>
      <td style="white-space:nowrap;">${fmtDate(a.echeance)}</td>
      <td style="white-space:nowrap;">${h(a.pct)}%</td>
      <td><span class="pill" style="background:${h(bg)};color:${h(sm.dot)};">${h(a.statut)}</span></td>
      <td class="realisation">${h(a.desc || '—')}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Plan stratégique — Rapport</title>${style}</head><body>
    <h1>Plan d'action stratégique</h1>
    <div class="subtitle">Rapport généré le ${new Date().toLocaleDateString('fr-CA', {year:'numeric',month:'long',day:'numeric'})} — Muni-Consul</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Avancement global</div><div class="kpi-val">${global}%</div></div>
      <div class="kpi"><div class="kpi-label">Actions totales</div><div class="kpi-val">${total}</div></div>
      <div class="kpi"><div class="kpi-label">Terminées</div><div class="kpi-val">${done}</div></div>
      <div class="kpi"><div class="kpi-label">En retard</div><div class="kpi-val">${late}</div></div>
    </div>
    <table>
      <thead><tr><th>Action</th><th>Axe</th><th>Responsable</th><th>Priorité</th><th>Échéance</th><th>%</th><th>Statut</th><th>Réalisation</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">© ${new Date().getFullYear()} Muni-Consul™ — Solutions municipales intelligentes — Tous droits réservés</div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Les fenêtres pop-up sont bloquées. Autorisez-les pour ce site afin d\'exporter en PDF.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

/* ================================================================
   RAPPORT PDF PAR AXE STRATÉGIQUE
   ================================================================ */
function exportAxePDF(axeId) {
  const axeMap  = getAxeMap();
  const axe     = axeMap[axeId];
  if (!axe) return;

  const actions = APP.actions.filter(a => a.axe === axeId);
  const jalons  = APP.jalons.filter(j => j.axe === axeId);
  const done    = actions.filter(a => a.statut === 'terminée').length;
  const late    = actions.filter(a => a.statut === 'en retard').length;
  const inprog  = actions.filter(a => a.statut === 'en cours').length;
  const waiting = actions.filter(a => a.statut === 'en attente').length;
  const avgPct  = actions.length ? Math.round(actions.reduce((s,a)=>s+(parseInt(a.pct)||0),0)/actions.length) : 0;

  const STATUT_DOT = {
    'terminée':'#639922','en cours':'#378ADD','en retard':'#E24B4A',
    'en attente':'#EF9F27','à faire':'#9E9C96'
  };
  const PRIO_LBL  = { haute:'⬆ Haute', moyenne:'➡ Moyenne', basse:'⬇ Basse' };
  const dateStr   = new Date().toLocaleDateString('fr-CA', {year:'numeric',month:'long',day:'numeric'});

  // Trier : en retard d'abord, puis en cours, puis autres, puis terminées
  const SORT_ST = {'en retard':0,'en cours':1,'en attente':2,'à faire':3,'terminée':4};
  const sorted  = [...actions].sort((a,b) => {
    const d = (SORT_ST[a.statut]??99) - (SORT_ST[b.statut]??99);
    return d !== 0 ? d : (a.echeance||'').localeCompare(b.echeance||'');
  });

  const rows = sorted.map(a => {
    const dot = STATUT_DOT[a.statut] || '#9E9C96';
    const bg  = dot + '22';
    const delai = (() => {
      if (!a.echeance || a.statut === 'terminée') return '';
      const diff = Math.round((new Date(a.echeance) - new Date()) / 86400000);
      if (diff < 0) return `<span style="color:#E24B4A;font-size:9px;">&nbsp;${Math.abs(diff)}j dépassé</span>`;
      if (diff <= 14) return `<span style="color:#EF9F27;font-size:9px;">&nbsp;${diff}j restants</span>`;
      return '';
    })();
    return `<tr>
      <td style="max-width:210px;">${h(a.titre)}</td>
      <td style="white-space:nowrap;">${h(a.resp||'—')}</td>
      <td style="font-size:10px;">${PRIO_LBL[a.prio]||'—'}</td>
      <td style="white-space:nowrap;font-size:10px;">${fmtDate(a.echeance)||'—'}${delai}</td>
      <td style="text-align:right;">${a.pct}%
        <div style="background:#eee;border-radius:3px;height:4px;margin-top:3px;">
          <div style="background:${dot};width:${Math.min(100,a.pct)}%;height:4px;border-radius:3px;"></div>
        </div>
      </td>
      <td><span style="background:${bg};color:${dot};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;white-space:nowrap;">${h(a.statut)}</span></td>
      <td style="color:#666;max-width:180px;font-size:10px;">${h(a.desc||'')}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" style="text-align:center;color:#999;padding:16px;">Aucune action pour cet axe.</td></tr>`;

  const jalonRows = jalons.length ? jalons
    .sort((a,b) => (a.date||'').localeCompare(b.date||''))
    .map(j => {
      const dot = STATUT_DOT[j.statut] || '#9E9C96';
      return `<tr>
        <td style="white-space:nowrap;">${fmtDate(j.date)||'—'}</td>
        <td>${h(j.titre)}</td>
        <td><span style="background:${dot+'22'};color:${dot};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:500;">${h(j.statut)}</span></td>
      </tr>`;
    }).join('') : '';

  const style = `<style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1A1917; margin:0; padding:0; font-size:11px; line-height:1.5; }
    .page-header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:2px solid ${h(axe.color)}; padding-bottom:10px; margin-bottom:18px; }
    .brand { font-size:16px; font-weight:700; color:${h(axe.color)}; letter-spacing:-.2px; }
    .brand-sub { font-size:10px; color:#888; }
    .report-date { font-size:10px; color:#888; text-align:right; }
    .axe-hero { display:flex; align-items:baseline; gap:12px; margin-bottom:6px; }
    .axe-nom { font-size:18px; font-weight:600; color:#1A1917; border-left:5px solid ${h(axe.color)}; padding-left:10px; }
    .axe-pct-big { font-size:26px; font-weight:300; color:${h(axe.color)}; margin-left:auto; }
    .prog-track { height:8px; background:#eee; border-radius:4px; margin-bottom:${axe.desc?'10px':'16px'}; }
    .prog-fill  { height:8px; background:${h(axe.color)}; border-radius:4px; width:${axe.pct}%; }
    .axe-desc { font-size:11px; color:#666; font-style:italic; border-left:3px solid ${h(axe.color)}; padding-left:9px; margin-bottom:16px; line-height:1.6; }
    .kpis { display:flex; gap:8px; margin-bottom:18px; }
    .kpi { flex:1; background:#F7F6F3; border-radius:7px; padding:10px 12px; text-align:center; }
    .kpi-lbl { font-size:10px; color:#888; margin-bottom:3px; }
    .kpi-val { font-size:22px; font-weight:400; }
    .kpi-late .kpi-val { color:#E24B4A; }
    .kpi-done .kpi-val { color:#639922; }
    .kpi-avg  .kpi-val { color:${h(axe.color)}; }
    h2 { font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:#888; border-bottom:1px solid #e5e4e1; padding-bottom:5px; margin:0 0 10px; }
    table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:20px; }
    th { text-align:left; padding:6px 7px; background:#F7F6F3; border-bottom:1px solid #ddd; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; }
    td { padding:6px 7px; border-bottom:.5px solid #eeece8; vertical-align:top; }
    tr:last-child td { border-bottom:none; }
    .footer { margin-top:24px; font-size:9px; color:#bbb; text-align:center; border-top:.5px solid #eee; padding-top:8px; }
    @media print {
      @page { size: 14in 11in; margin: 1cm 1.5cm; }
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    }
  </style>`;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
    <title>${h(axe.nom)} — Rapport stratégique — Muni-Consul</title>${style}</head><body>

    <div class="page-header">
      <div>
        <div class="brand">Muni-Consul</div>
        <div class="brand-sub">Plan d'action stratégique — Rapport par axe</div>
      </div>
      <div class="report-date">Rapport généré le ${dateStr}</div>
    </div>

    <div class="axe-hero">
      <div class="axe-nom">${h(axe.nom)}</div>
      <div class="axe-pct-big">${axe.pct}%</div>
    </div>
    <div class="prog-track"><div class="prog-fill"></div></div>
    ${axe.desc ? `<div class="axe-desc">${h(axe.desc)}</div>` : ''}

    <div class="kpis">
      <div class="kpi"><div class="kpi-lbl">Actions totales</div><div class="kpi-val">${actions.length}</div></div>
      <div class="kpi kpi-done"><div class="kpi-lbl">Terminées</div><div class="kpi-val">${done}</div></div>
      <div class="kpi"><div class="kpi-lbl">En cours</div><div class="kpi-val">${inprog}</div></div>
      ${waiting ? `<div class="kpi"><div class="kpi-lbl">En attente</div><div class="kpi-val">${waiting}</div></div>` : ''}
      <div class="kpi kpi-late"><div class="kpi-lbl">En retard</div><div class="kpi-val">${late}</div></div>
      <div class="kpi kpi-avg"><div class="kpi-lbl">Avancement moyen</div><div class="kpi-val">${avgPct}%</div></div>
    </div>

    <h2>Actions (${actions.length})</h2>
    <table>
      <thead><tr><th>Action</th><th>Responsable</th><th>Priorité</th><th>Échéance</th><th style="text-align:right;">%</th><th>Statut</th><th>Notes</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>

    ${jalons.length ? `
    <h2>Jalons (${jalons.length})</h2>
    <table>
      <thead><tr><th>Date</th><th>Jalon</th><th>Statut</th></tr></thead>
      <tbody>${jalonRows}</tbody>
    </table>` : ''}

    <div class="footer">
      © ${new Date().getFullYear()} Muni-Consul™ — Solutions municipales intelligentes — Tous droits réservés<br>
      Ce document est confidentiel et destiné à un usage interne.
    </div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) { alert('Les fenêtres pop-up sont bloquées. Autorisez-les pour ce site afin d\'exporter en PDF.'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

/* ================================================================
   EXPORT CSV
   ================================================================ */
function exportCSV() {
  const BOM = '\uFEFF'; // UTF-8 BOM pour Excel
  const sep = ';';
  const headers = ['Titre','Axe','Responsable','Priorité','Échéance','Avancement (%)','Statut','Description'];
  const rows = APP.actions.map(a => [
    a.titre      || '',
    a.axe        || '',
    a.resp       || '',
    a.prio       || '',
    a.echeance   || '',
    a.pct        != null ? a.pct : '',
    a.statut     || '',
    (a.desc      || '').replace(/[\r\n]+/g, ' ')
  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(sep));

  const csv = BOM + [headers.map(h => `"${h}"`).join(sep), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `plan-strategique-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
