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
