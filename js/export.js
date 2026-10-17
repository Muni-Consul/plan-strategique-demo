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
    <h1>Plan stratégique</h1>
    <div class="subtitle">Rapport généré le ${new Date().toLocaleDateString('fr-CA', {year:'numeric',month:'long',day:'numeric'})} — Stukely-Sud</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Avancement global</div><div class="kpi-val">${global}%</div></div>
      <div class="kpi"><div class="kpi-label">Objectifs totaux</div><div class="kpi-val">${total}</div></div>
      <div class="kpi"><div class="kpi-label">Terminées</div><div class="kpi-val">${done}</div></div>
      <div class="kpi"><div class="kpi-label">En retard</div><div class="kpi-val">${late}</div></div>
    </div>
    <table>
      <thead><tr><th>Objectif</th><th>Axe</th><th>Responsable</th><th>Priorité</th><th>Échéance</th><th>%</th><th>Statut</th><th>Réalisation</th></tr></thead>
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
   RAPPORT PDF PAR AXE STRATÉGIQUE — jsPDF 14×11 po paysage
   ================================================================ */
function exportAxePDF(axeId) {
  if (!window.jspdf) { alert('La librairie jsPDF n\'est pas chargée. Vérifiez votre connexion internet.'); return; }

  const axeMap = getAxeMap();
  const axe    = axeMap[axeId];
  if (!axe) return;

  // ── Données ───────────────────────────────────────────────
  const actions = APP.actions.filter(a => a.axe === axeId);
  const jalons  = APP.jalons.filter(j => {
    const act = APP.actions.find(a => String(a.id) === String(j.actionId));
    return act && act.axe === axeId;
  });
  const done    = actions.filter(a => a.statut === 'terminée').length;
  const late    = actions.filter(a => a.statut === 'en retard').length;
  const inprog  = actions.filter(a => a.statut === 'en cours').length;
  const waiting = actions.filter(a => a.statut === 'en attente').length;
  const avgPct  = actions.length ? Math.round(actions.reduce((s,a)=>s+(parseInt(a.pct)||0),0)/actions.length) : 0;

  const SORT_ST  = {'en retard':0,'en cours':1,'en attente':2,'à faire':3,'terminée':4};
  const sorted   = [...actions].sort((a,b) => {
    const d = (SORT_ST[a.statut]??99) - (SORT_ST[b.statut]??99);
    return d !== 0 ? d : (a.echeance||'').localeCompare(b.echeance||'');
  });

  const STATUT_RGB = {
    'terminée':[99,153,34],'en cours':[55,138,221],'en retard':[226,75,74],
    'en attente':[239,159,39],'à faire':[158,156,150]
  };
  const PRIO_LBL = { haute:'Haute', moyenne:'Moyenne', basse:'Basse' };

  // ── Convertir couleur hex en tableau RGB ──────────────────
  function hr(hex) {
    const c = hex.replace('#','');
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  }
  const axeRGB = hr(axe.color);

  // ── Créer le document légal paysage 14×8½ po ─────────────
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'legal', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();   // 14 po = 1008 pt
  const H = doc.internal.pageSize.getHeight();  // 8.5 po = 612 pt
  const ML = 48, MR = 48, MT = 48;
  const CW = W - ML - MR;
  doc.setProperties({ title: `${axe.nom} — Rapport stratégique — Stukely-Sud` });

  let y = MT;

  // ── Bandeau couleur en haut ───────────────────────────────
  doc.setFillColor(...axeRGB);
  doc.rect(0, 0, W, 5, 'F');

  // ── En-tête ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...axeRGB);
  doc.text('Stukely-Sud', ML, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text('Plan stratégique — Rapport par axe', ML, y + 24);

  const dateStr = new Date().toLocaleDateString('fr-CA', {year:'numeric',month:'long',day:'numeric'});
  doc.text(`Rapport du ${dateStr}`, W - MR, y + 12, { align: 'right' });

  y += 36;
  doc.setDrawColor(...axeRGB);
  doc.setLineWidth(1);
  doc.line(ML, y, W - MR, y);
  y += 14;

  // ── Nom de l'axe + pourcentage ────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(26, 25, 23);
  doc.text(axe.nom, ML + 10, y + 13);

  doc.setFontSize(22);
  doc.setTextColor(...axeRGB);
  doc.text(`${axe.pct}%`, W - MR, y + 13, { align: 'right' });
  y += 22;

  // Barre de progression
  doc.setFillColor(225, 224, 220);
  doc.roundedRect(ML, y, CW, 7, 3, 3, 'F');
  if (axe.pct > 0) {
    doc.setFillColor(...axeRGB);
    doc.roundedRect(ML, y, CW * (axe.pct / 100), 7, 3, 3, 'F');
  }
  y += 16;

  // Description de l'axe
  if (axe.desc) {
    doc.setFillColor(...axeRGB);
    doc.rect(ML, y, 3, 16, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 100, 100);
    const descLines = doc.splitTextToSize(axe.desc, CW - 14);
    doc.text(descLines, ML + 10, y + 10);
    y += Math.max(20, descLines.length * 12 + 6);
  }
  y += 8;

  // ── KPIs ──────────────────────────────────────────────────
  const kpis = [
    { label:'Objectifs totaux', val: String(actions.length), color:[26,25,23] },
    { label:'Terminées',       val: String(done),   color:[99,153,34] },
    { label:'En cours',        val: String(inprog), color:[55,138,221] },
    ...(waiting ? [{ label:'En attente', val: String(waiting), color:[239,159,39] }] : []),
    { label:'En retard',       val: String(late),   color:[226,75,74] },
    { label:'Avancement moy.', val: avgPct+'%',     color: axeRGB },
  ];
  const kpiW = (CW - (kpis.length - 1) * 7) / kpis.length;
  const kpiH = 46;
  kpis.forEach((k, i) => {
    const kx = ML + i * (kpiW + 7);
    doc.setFillColor(247, 246, 243);
    doc.roundedRect(kx, y, kpiW, kpiH, 4, 4, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(k.label, kx + kpiW / 2, y + 13, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...k.color);
    doc.text(k.val, kx + kpiW / 2, y + 36, { align: 'center' });
  });
  y += kpiH + 14;

  // ── Tableau des actions ───────────────────────────────────
  doc.autoTable({
    startY: y,
    margin: { left: ML, right: MR },
    head: [['Objectif', 'Responsable', 'Priorité', 'Échéance', '%', 'Statut', 'Notes']],
    body: sorted.map(a => {
      const diff = a.echeance && a.statut !== 'terminée'
        ? Math.round((new Date(a.echeance) - new Date()) / 86400000) : null;
      const delai = diff !== null && diff < 0 ? ` (${Math.abs(diff)}j dépassé)` :
                    diff !== null && diff <= 14 ? ` (${diff}j)` : '';
      return [
        a.titre || '',
        a.resp  || '—',
        PRIO_LBL[a.prio] || '—',
        (fmtDate(a.echeance) || '—') + delai,
        `${a.pct}%`,
        a.statut || '',
        a.desc   || ''
      ];
    }),
    headStyles: {
      fillColor:[247,246,243], textColor:[100,100,100],
      fontStyle:'bold', fontSize:8, cellPadding:5,
    },
    bodyStyles: { fontSize:9, cellPadding:4 },
    columnStyles: {
      0: { cellWidth: 190 },
      1: { cellWidth: 110 },
      2: { cellWidth:  65 },
      3: { cellWidth:  90 },
      4: { cellWidth:  38, halign:'center' },
      5: { cellWidth:  80 },
      6: { cellWidth: 'auto' },
    },
    didParseCell(data) {
      if (data.column.index === 5 && data.section === 'body') {
        const rgb = STATUT_RGB[sorted[data.row.index]?.statut];
        if (rgb) { data.cell.styles.textColor = rgb; data.cell.styles.fontStyle = 'bold'; }
      }
      if (data.column.index === 3 && data.section === 'body') {
        const a = sorted[data.row.index];
        if (a && a.echeance && a.statut !== 'terminée') {
          const diff = Math.round((new Date(a.echeance) - new Date()) / 86400000);
          if (diff < 0) data.cell.styles.textColor = [226,75,74];
          else if (diff <= 14) data.cell.styles.textColor = [239,159,39];
        }
      }
    },
    alternateRowStyles: { fillColor:[252,251,249] },
    theme: 'plain',
    tableLineColor:[230,228,224], tableLineWidth:0.3,
  });

  y = doc.lastAutoTable.finalY + 14;

  // ── Jalons ────────────────────────────────────────────────
  if (jalons.length > 0) {
    if (y + 70 > H - MT) { doc.addPage(); y = MT; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text(`JALONS (${jalons.length})`, ML, y);
    y += 6;
    const sortedJ = [...jalons].sort((a,b) => (a.date||'').localeCompare(b.date||''));
    doc.autoTable({
      startY: y,
      margin: { left: ML, right: MR },
      head: [['Date', 'Jalon', 'Statut']],
      body: sortedJ.map(j => [fmtDate(j.date)||'—', j.titre||'', j.statut||'']),
      headStyles: { fillColor:[247,246,243], textColor:[100,100,100], fontStyle:'bold', fontSize:8, cellPadding:4 },
      bodyStyles: { fontSize:9, cellPadding:4 },
      columnStyles: { 0:{ cellWidth:90 }, 1:{ cellWidth:'auto' }, 2:{ cellWidth:90 } },
      didParseCell(data) {
        if (data.column.index === 2 && data.section === 'body') {
          const rgb = STATUT_RGB[sortedJ[data.row.index]?.statut];
          if (rgb) { data.cell.styles.textColor = rgb; data.cell.styles.fontStyle = 'bold'; }
        }
      },
      theme:'plain', tableLineColor:[230,228,224], tableLineWidth:0.3,
    });
  }

  // ── Pied de page (toutes les pages) ──────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(220, 218, 214);
    doc.setLineWidth(0.5);
    doc.line(ML, H - 32, W - MR, H - 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 180, 180);
    doc.text(`© ${new Date().getFullYear()} Muni-Consul™ — Solutions municipales intelligentes — Document confidentiel`, ML, H - 22);
    doc.text(`Page ${p} / ${pageCount}`, W - MR, H - 22, { align: 'right' });
    doc.setFillColor(...axeRGB);
    doc.rect(0, H - 4, W, 4, 'F');
  }

  // ── Télécharger ───────────────────────────────────────────
  const safeName = axe.nom.replace(/[\\/:*?"<>|]/g, '').trim();
  doc.save(`${safeName} — Rapport stratégique.pdf`);
}

/* ================================================================
   TABLEAU DE BORD IMPRIMABLE — Séance du conseil
   Format : lettre paysage 11×8.5 po — une page épurée
   ================================================================ */
function exportDashboardPDF() {
  if (!window.jspdf) { alert('La librairie jsPDF n\'est pas chargée.'); return; }
  const { jsPDF } = window.jspdf;

  // ── Dimensions : légal paysage 14×8.5 po ─────────────────
  // 'legal' = 8.5×14 po, orientation 'landscape' → 14×8.5 po
  const doc = new jsPDF({ unit: 'pt', format: 'legal', orientation: 'landscape' });
  const W  = doc.internal.pageSize.getWidth();   // ~1008 pt
  const H  = doc.internal.pageSize.getHeight();  //  ~612 pt
  const ML = 40, MR = 40, MT = 36;
  const CW = W - ML - MR;
  doc.setProperties({ title: 'Tableau de bord stratégique — Séance du conseil' });

  function hr(hex) {
    const c = (hex||'#888888').replace('#','');
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  }

  const PURPLE = [83, 74, 183];
  const now    = new Date();
  const dateStr = now.toLocaleDateString('fr-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  let y = 0;

  // ── Bandeau supérieur ─────────────────────────────────────
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, W, 38, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('Tableau de bord stratégique', ML, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(200, 197, 240);
  doc.text(`Séance du conseil  ·  ${dateStr}`, ML, 34);

  if (window.isLiveData) {
    doc.text('Données en direct', W - MR, 24, { align: 'right' });
  }

  y = 52;

  // ── KPIs ──────────────────────────────────────────────────
  const total   = APP.actions.length;
  const done    = APP.actions.filter(a => a.statut === 'terminée').length;
  const late    = APP.actions.filter(a => a.statut === 'en retard').length;
  const inprog  = APP.actions.filter(a => a.statut === 'en cours').length;
  const waiting = APP.actions.filter(a => a.statut === 'en attente').length;
  const global  = APP.axes.length ? Math.round(APP.axes.reduce((s,a) => s + a.pct, 0) / APP.axes.length) : 0;
  const totalBudget = APP.actions.reduce((s, a) => s + (budgetNum(a.budget) || 0), 0);
  const budgetStr = totalBudget > 0
    ? totalBudget.toLocaleString('fr-CA', { minimumFractionDigits:0, maximumFractionDigits:0 }) + ' $'
    : '—';

  const kpis = [
    { label:'Avancement global', val:`${global}%`, color: PURPLE },
    { label:'Objectifs totaux',  val:total,        color:[26,25,23] },
    { label:'Terminés',          val:done,         color:[99,153,34] },
    { label:'En retard',         val:late,         color:[226,75,74] },
    { label:'En cours',          val:inprog,       color:[55,138,221] },
    { label:'En attente',        val:waiting,      color:[239,159,39] },
    { label:'Budget prévu',      val:budgetStr,    color:[26,25,23], small:true },
  ];
  const kW = (CW - (kpis.length - 1) * 8) / kpis.length;
  const kH = 52;
  kpis.forEach((k, i) => {
    const kx = ML + i * (kW + 8);
    doc.setFillColor(247, 246, 243);
    doc.roundedRect(kx, y, kW, kH, 4, 4, 'F');
    // Barre couleur en haut de la carte KPI
    doc.setFillColor(...k.color);
    doc.roundedRect(kx, y, kW, 4, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text(k.label, kx + kW / 2, y + 16, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(k.small ? 11 : (i === 0 ? 20 : 18));
    doc.setTextColor(...k.color);
    doc.text(String(k.val), kx + kW / 2, y + 38, { align: 'center' });
  });

  y += kH + 14;

  // ── Séparateur + titre sections ───────────────────────────
  doc.setDrawColor(220, 218, 214);
  doc.setLineWidth(0.4);
  doc.line(ML, y, W - MR, y);
  y += 10;

  // ── En-têtes colonnes ─────────────────────────────────────
  const colLeft  = ML;
  const colRight = ML + Math.round(CW * 0.55) + 12;
  const colLeftW = Math.round(CW * 0.55);
  const colRightW = CW - colLeftW - 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text('AXES STRATÉGIQUES', colLeft, y);
  doc.text('PROCHAINS JALONS', colRight, y);
  y += 10;

  const axeMap = getAxeMap();
  const STATUT_RGB = {
    'terminée':[99,153,34],'en cours':[55,138,221],'en retard':[226,75,74],
    'en attente':[239,159,39],'à faire':[158,156,150]
  };

  // ── Pour chaque axe : info gauche + jalons droite ─────────
  APP.axes.forEach((axe, axeIdx) => {
    const rgb      = hr(axe.color);
    const actsAxe  = APP.actions.filter(a => a.axe === axe.id);
    const nbObj    = actsAxe.length;
    const nbDone   = actsAxe.filter(a => a.statut === 'terminée').length;
    const nbLate   = actsAxe.filter(a => a.statut === 'en retard').length;
    const axeBudget = actsAxe.reduce((s, a) => s + (budgetNum(a.budget) || 0), 0);
    const axeBudgetStr = axeBudget > 0
      ? axeBudget.toLocaleString('fr-CA', { minimumFractionDigits:0, maximumFractionDigits:0 }) + ' $'
      : '';

    // Jalons de cet axe (à venir, triés par date)
    const jalonsAxe = [...APP.jalons]
      .filter(j => {
        const act = APP.actions.find(a => String(a.id) === String(j.actionId));
        return act && act.axe === axe.id && j.statut !== 'terminée';
      })
      .sort((a, b) => (a.date||'').localeCompare(b.date||''))
      .slice(0, 4);

    // Calculer la hauteur nécessaire côté jalons
    let jalonH = 0;
    jalonsAxe.forEach(j => {
      const lines = doc.splitTextToSize(j.titre || '', colRightW - 14);
      jalonH += 10 + lines.length * 10 + 4;
    });

    const rowH = Math.max(42, jalonH + 6);

    // Ligne séparatrice entre axes (sauf le premier)
    if (axeIdx > 0) {
      doc.setDrawColor(230, 228, 224);
      doc.setLineWidth(0.3);
      doc.line(ML, y - 2, W - MR, y - 2);
    }

    let yAxe = y;
    let yJal = y;

    // ── Colonne gauche : axe ──────────────────────────────
    doc.setFillColor(...rgb);
    doc.circle(colLeft + 5, yAxe + 5, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(26, 25, 23);
    const nomTrunc = doc.splitTextToSize(axe.nom, colLeftW - 90)[0];
    doc.text(nomTrunc, colLeft + 14, yAxe + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...rgb);
    doc.text(`${axe.pct}%`, colLeft + colLeftW, yAxe + 8, { align: 'right' });
    if (axeBudgetStr) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(160, 160, 160);
      // Budget affiché sous la barre de progression, aligné à gauche pour éviter la troncature
      doc.text(axeBudgetStr, colLeft + 14, yAxe + 26);
    }

    const barY = yAxe + 12;
    const barW = colLeftW - 36;
    doc.setFillColor(225, 224, 220);
    doc.roundedRect(colLeft + 14, barY, barW, 5, 2, 2, 'F');
    if (axe.pct > 0) {
      doc.setFillColor(...rgb);
      doc.roundedRect(colLeft + 14, barY, barW * (axe.pct / 100), 5, 2, 2, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const greyPart = `${nbObj} objectif${nbObj > 1 ? 's' : ''}` +
                     (nbDone > 0 ? `  ·  ${nbDone} terminé${nbDone > 1 ? 's' : ''}` : '');
    doc.setTextColor(160, 160, 160);
    doc.text(greyPart, colLeft + 14, barY + 14);
    if (nbLate > 0) {
      const approxGW = greyPart.length * 3.85;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(226, 75, 74);
      doc.text(`  ·  ${nbLate} en retard`, colLeft + 14 + approxGW, barY + 14);
    }

    // ── Colonne droite : jalons de cet axe ───────────────
    jalonsAxe.forEach(j => {
      const act  = APP.actions.find(a => String(a.id) === String(j.actionId));
      const sRgb = STATUT_RGB[j.statut] || [158,156,150];
      const dStr = fmtDate(j.date) || (j.continu ? '∞ En continu' : '');

      doc.setFillColor(...sRgb);
      doc.circle(colRight + 5, yJal + 5, 3.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(26, 25, 23);
      const titLines = doc.splitTextToSize(j.titre || '', colRightW - 14);
      doc.text(titLines, colRight + 13, yJal + 7);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...rgb);
      const numStr = act?.numero ? `${act.numero}  ·  ` : '';
      doc.text(`${numStr}${dStr}`, colRight + 13, yJal + 7 + titLines.length * 10);

      yJal += 10 + titLines.length * 10 + 4;
    });

    if (jalonsAxe.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(180, 180, 180);
      doc.text('Aucun jalon à venir', colRight + 13, yJal + 7);
    }

    y += rowH;
  });

  // ── Pied de page ──────────────────────────────────────────
  doc.setDrawColor(220, 218, 214);
  doc.setLineWidth(0.4);
  doc.line(ML, H - 26, W - MR, H - 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 180, 180);
  doc.text(`© ${now.getFullYear()} Muni-Consul™ — Solutions municipales intelligentes — Document confidentiel`, ML, H - 16);
  doc.text('1 / 1', W - MR, H - 16, { align: 'right' });
  doc.setFillColor(...PURPLE);
  doc.rect(0, H - 4, W, 4, 'F');

  doc.save(`Tableau de bord — Conseil — ${now.toISOString().slice(0,10)}.pdf`);
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

/* ================================================================
   RAPPORT DÉTAILLÉ PAR AXE — une page par axe avec tous les détails
   ================================================================ */
function exportRapportDetaille() {
  if (!window.jspdf) { alert('La librairie jsPDF n\'est pas chargée.'); return; }
  const { jsPDF } = window.jspdf;

  const doc = new jsPDF({ unit: 'pt', format: 'legal', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ML = 40, MR = 40, MT = 36;
  const CW = W - ML - MR;
  doc.setProperties({ title: 'Rapport détaillé — Plan stratégique — Stukely-Sud' });

  const PURPLE = [83, 74, 183];
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-CA', { year:'numeric', month:'long', day:'numeric' });

  function hr(hex) {
    const c = (hex||'#888888').replace('#','');
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  }

  const STATUT_RGB = {
    'terminée':[99,153,34],'en cours':[55,138,221],'en retard':[226,75,74],
    'en attente':[239,159,39],'en suspend':[123,104,238],'à faire':[158,156,150]
  };
  const PRIO_LBL = { haute:'Haute', moyenne:'Moyenne', basse:'Basse' };

  function drawPageHeader(doc, axe, axeRGB, pageNum) {
    // Bandeau supérieur
    doc.setFillColor(...PURPLE);
    doc.rect(0, 0, W, 32, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text('Rapport détaillé — Plan stratégique', ML, 21);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 197, 240);
    doc.text(`Stukely-Sud  ·  ${dateStr}`, W - MR, 21, { align: 'right' });

    // Bandeau axe
    doc.setFillColor(...axeRGB);
    doc.rect(0, 32, W, 28, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    const nomTronc = doc.splitTextToSize(axe.nom, CW - 80)[0];
    doc.text(nomTronc, ML, 51);
    doc.setFontSize(14);
    doc.text(`${axe.pct}%`, W - MR, 51, { align: 'right' });
  }

  function drawPageFooter(doc, axeRGB, p, total) {
    doc.setDrawColor(220, 218, 214);
    doc.setLineWidth(0.4);
    doc.line(ML, H - 26, W - MR, H - 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 180, 180);
    doc.text(`© ${now.getFullYear()} Muni-Consul™ — Solutions municipales intelligentes — Document confidentiel`, ML, H - 16);
    doc.text(`Page ${p} / ${total}`, W - MR, H - 16, { align: 'right' });
    doc.setFillColor(...axeRGB);
    doc.rect(0, H - 4, W, 4, 'F');
  }

  let isFirstPage = true;

  APP.axes.forEach((axe, axeIdx) => {
    const axeRGB = hr(axe.color);
    const actions = APP.actions.filter(a => a.axe === axe.id);
    if (!actions.length) return;

    // Nouvelle page pour chaque axe (sauf le premier)
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;

    drawPageHeader(doc, axe, axeRGB, axeIdx + 1);

    let y = 72;

    // Description de l'axe
    if (axe.desc) {
      doc.setFillColor(...axeRGB);
      doc.rect(ML, y, 3, 14, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      const descLines = doc.splitTextToSize(axe.desc, CW - 12);
      doc.text(descLines, ML + 8, y + 9);
      y += Math.max(18, descLines.length * 11 + 6);
    }

    // Barre de progression de l'axe
    doc.setFillColor(225, 224, 220);
    doc.roundedRect(ML, y, CW, 6, 2, 2, 'F');
    if (axe.pct > 0) {
      doc.setFillColor(...axeRGB);
      doc.roundedRect(ML, y, CW * (axe.pct / 100), 6, 2, 2, 'F');
    }
    y += 14;

    // KPIs de l'axe
    const done    = actions.filter(a => a.statut === 'terminée').length;
    const late    = actions.filter(a => a.statut === 'en retard').length;
    const inprog  = actions.filter(a => a.statut === 'en cours').length;
    const todo    = actions.filter(a => a.statut === 'à faire').length;
    const budget  = actions.reduce((s, a) => s + (budgetNum(a.budget) || 0), 0);
    const budgetStr = budget > 0 ? budget.toLocaleString('fr-CA') + ' $' : '—';

    const kpis = [
      { label:'Objectifs', val:String(actions.length), color:[26,25,23] },
      { label:'Terminés',  val:String(done),   color:[99,153,34] },
      { label:'En cours',  val:String(inprog), color:[55,138,221] },
      { label:'À faire',   val:String(todo),   color:[158,156,150] },
      { label:'En retard', val:String(late),   color:[226,75,74] },
      { label:'Budget',    val:budgetStr,      color:axeRGB, small:true },
    ];
    const kW = (CW - (kpis.length - 1) * 6) / kpis.length;
    const kH = 40;
    kpis.forEach((k, i) => {
      const kx = ML + i * (kW + 6);
      doc.setFillColor(247, 246, 243);
      doc.roundedRect(kx, y, kW, kH, 3, 3, 'F');
      doc.setFillColor(...k.color);
      doc.roundedRect(kx, y, kW, 3, 1, 1, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 140);
      doc.text(k.label, kx + kW/2, y + 13, { align:'center' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(k.small ? 9 : 16);
      doc.setTextColor(...k.color);
      doc.text(k.val, kx + kW/2, y + 32, { align:'center' });
    });
    y += kH + 10;

    // Titre section objectifs
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text('OBJECTIFS', ML, y);
    y += 8;

    // Tri : en retard → en cours → en attente → à faire → terminés
    const SORT_ST = {'en retard':0,'en cours':1,'en attente':2,'à faire':3,'terminée':4,'en suspend':5};
    const sorted = [...actions].sort((a,b) => {
      const d = (SORT_ST[a.statut]??99) - (SORT_ST[b.statut]??99);
      return d !== 0 ? d : (a.numero||'').localeCompare(b.numero||'', 'fr', {numeric:true});
    });

    // Tableau des objectifs avec jalons
    doc.autoTable({
      startY: y,
      margin: { left: ML, right: MR },
      head: [['N°', 'Objectif', 'Responsable', 'Priorité', 'Début', 'Échéance', '%', 'Statut']],
      body: sorted.map(a => {
        const jp = getJalonProgress ? getJalonProgress(a.id) : null;
        const pct = jp ? `${jp.pct}% (${jp.done}/${jp.total} jalons)` : `${a.pct||0}%`;
        return [
          a.numero || '—',
          a.titre || '',
          a.resp || '—',
          PRIO_LBL[a.prio] || '—',
          fmtDate(a.dateDebut) || '—',
          fmtDate(a.echeance) || '—',
          pct,
          a.statut || '',
        ];
      }),
      headStyles: {
        fillColor:[247,246,243], textColor:[100,100,100],
        fontStyle:'bold', fontSize:8, cellPadding:4,
      },
      bodyStyles: { fontSize:8.5, cellPadding:4 },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 220 },
        2: { cellWidth: 100 },
        3: { cellWidth: 60 },
        4: { cellWidth: 72 },
        5: { cellWidth: 72 },
        6: { cellWidth: 90 },
        7: { cellWidth: 'auto' },
      },
      didParseCell(data) {
        if (data.column.index === 7 && data.section === 'body') {
          const rgb = STATUT_RGB[sorted[data.row.index]?.statut];
          if (rgb) { data.cell.styles.textColor = rgb; data.cell.styles.fontStyle = 'bold'; }
        }
        if (data.column.index === 5 && data.section === 'body') {
          const a = sorted[data.row.index];
          if (a?.echeance && a.statut !== 'terminée') {
            const diff = Math.round((new Date(a.echeance) - new Date()) / 86400000);
            if (diff < 0) data.cell.styles.textColor = [226,75,74];
            else if (diff <= 14) data.cell.styles.textColor = [239,159,39];
          }
        }
      },
      alternateRowStyles: { fillColor:[252,251,249] },
      theme: 'plain',
      tableLineColor:[230,228,224], tableLineWidth:0.3,
      didDrawCell(data) {
        // Mettre le numéro en gras avec couleur de l'axe
        if (data.column.index === 0 && data.section === 'body') {
          doc.setTextColor(...axeRGB);
        }
      },
    });

    y = doc.lastAutoTable.finalY + 10;

    // Jalons de cet axe
    const jalonsAxe = APP.jalons.filter(j => {
      const act = APP.actions.find(a => String(a.id) === String(j.actionId));
      return act && act.axe === axe.id;
    }).sort((a,b) => (a.date||'zzz').localeCompare(b.date||'zzz'));

    if (jalonsAxe.length > 0 && y + 50 < H - 40) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`JALONS (${jalonsAxe.length})`, ML, y);
      y += 6;

      doc.autoTable({
        startY: y,
        margin: { left: ML, right: MR },
        head: [['N° Obj.', 'Jalon', 'Récurrence', 'Date', 'Statut']],
        body: jalonsAxe.map(j => {
          const act = APP.actions.find(a => String(a.id) === String(j.actionId));
          return [
            act?.numero || '—',
            j.titre || '',
            j.recurrence && j.recurrence !== 'Aucune' ? `🔄 ${j.recurrence}` : (j.continu ? '∞ En continu' : '—'),
            j.continu ? '∞ En continu' : (fmtDate(j.date) || '—'),
            j.statut || '',
          ];
        }),
        headStyles: { fillColor:[247,246,243], textColor:[100,100,100], fontStyle:'bold', fontSize:7.5, cellPadding:3 },
        bodyStyles: { fontSize:8, cellPadding:3 },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 90 },
          3: { cellWidth: 85 },
          4: { cellWidth: 80 },
        },
        didParseCell(data) {
          if (data.column.index === 4 && data.section === 'body') {
            const rgb = STATUT_RGB[jalonsAxe[data.row.index]?.statut];
            if (rgb) { data.cell.styles.textColor = rgb; data.cell.styles.fontStyle = 'bold'; }
          }
        },
        alternateRowStyles: { fillColor:[252,251,249] },
        theme: 'plain',
        tableLineColor:[230,228,224], tableLineWidth:0.3,
      });
    }
  });

  // Pied de page sur toutes les pages
  const pageCount = doc.internal.getNumberOfPages();
  // Retrouver la couleur de l'axe par page (approximation)
  let axeIdx = 0;
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    const axe = APP.axes[Math.min(axeIdx, APP.axes.length-1)];
    const axeRGB = axe ? hr(axe.color) : PURPLE;
    drawPageFooter(doc, axeRGB, p, pageCount);
  }

  doc.save(`Rapport-détaillé-${now.toISOString().slice(0,10)}.pdf`);
}

/* ================================================================
   RAPPORT D'UN OBJECTIF — axe + objectif + jalons détaillés
   ================================================================ */
function openRapportObjectifModal() {
  const sel = document.getElementById('rapport-obj-select');
  if (!sel) return;
  const axeMap = getAxeMap();
  // Grouper par axe
  const parAxe = {};
  APP.actions.forEach(a => {
    if (!parAxe[a.axe]) parAxe[a.axe] = [];
    parAxe[a.axe].push(a);
  });
  let html = '<option value="">— Choisir un objectif —</option>';
  Object.keys(parAxe).sort((x,y) => x.localeCompare(y,'fr',{numeric:true})).forEach(axeId => {
    const axe = axeMap[axeId];
    const nomAxe = axe ? `${axeId} — ${axe.nom}` : axeId;
    html += `<optgroup label="${h(nomAxe)}">`;
    parAxe[axeId]
      .sort((x,y) => (x.numero||'').localeCompare(y.numero||'','fr',{numeric:true}))
      .forEach(a => {
        const lbl = `${a.numero ? a.numero + ' — ' : ''}${a.titre}`;
        html += `<option value="${h(String(a.id))}">${h(lbl)}</option>`;
      });
    html += '</optgroup>';
  });
  sel.innerHTML = html;
  const bg = document.getElementById('rapport-obj-modal-bg');
  if (bg) { bg.style.display = 'flex'; bg.classList.add('open'); }
}

function closeRapportObjectifModal() {
  const bg = document.getElementById('rapport-obj-modal-bg');
  if (bg) { bg.style.display = 'none'; bg.classList.remove('open'); }
}

function genererRapportObjectif() {
  const sel = document.getElementById('rapport-obj-select');
  const actionId = sel?.value;
  if (!actionId) { alert('Veuillez sélectionner un objectif.'); return; }
  closeRapportObjectifModal();
  exportObjectifPDF(actionId);
}

function exportObjectifPDF(actionId) {
  if (!window.jspdf) { alert("La librairie jsPDF n'est pas chargée."); return; }
  const { jsPDF } = window.jspdf;

  const action = APP.actions.find(a => String(a.id) === String(actionId));
  if (!action) { alert('Objectif introuvable.'); return; }
  const axe = getAxeMap()[action.axe] || {};
  const jalons = APP.jalons
    .filter(j => String(j.actionId) === String(action.id))
    .sort((a,b) => (a.date||'zzzz').localeCompare(b.date||'zzzz'));

  const doc = new jsPDF({ unit:'pt', format:'letter', orientation:'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ML = 48, MR = 48;
  const CW = W - ML - MR;
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-CA', { year:'numeric', month:'long', day:'numeric' });

  function hr(hex) {
    const c = (hex||'#534AB7').replace('#','');
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  }
  const RGB = hr(axe.color);
  const STATUT_RGB = {
    'terminée':[99,153,34],'en cours':[55,138,221],'en retard':[226,75,74],
    'en attente':[239,159,39],'en suspend':[123,104,238],'à faire':[158,156,150]
  };
  const PRIO_LBL = { haute:'Haute', moyenne:'Moyenne', basse:'Basse' };

  doc.setProperties({ title:`Rapport — ${action.numero||''} ${action.titre}` });

  let y = 0;

  function checkPage(need) {
    if (y + need > H - 60) { doc.addPage(); y = 54; return true; }
    return false;
  }

  // ── EN-TÊTE ────────────────────────────────────────────────
  doc.setFillColor(...RGB);
  doc.rect(0, 0, W, 76, 'F');
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.setTextColor(255,255,255);
  doc.text('RAPPORT D\u2019OBJECTIF', ML, 24);
  doc.setFont('helvetica','bold');
  doc.setFontSize(13);
  const titreLines = doc.splitTextToSize(`${action.numero ? action.numero + ' — ' : ''}${action.titre}`, CW);
  doc.text(titreLines.slice(0,2), ML, 44);
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.setTextColor(255,255,255);
  doc.text(`Stukely-Sud  ·  ${dateStr}`, W - MR, 24, { align:'right' });

  y = 96;

  // ── AXE STRATÉGIQUE ────────────────────────────────────────
  doc.setFont('helvetica','bold');
  doc.setFontSize(8);
  doc.setTextColor(140,140,140);
  doc.text('AXE STRATÉGIQUE', ML, y);
  y += 12;

  doc.setFillColor(248,247,245);
  const axeNomLines = doc.splitTextToSize(axe.nom || action.axe, CW - 70);
  const axeDescLines = axe.desc ? doc.splitTextToSize(axe.desc, CW - 24) : [];
  const axeBoxH = 26 + axeNomLines.length*12 + (axeDescLines.length ? axeDescLines.length*10 + 6 : 0);
  doc.roundedRect(ML, y, CW, axeBoxH, 4, 4, 'F');
  doc.setFillColor(...RGB);
  doc.rect(ML, y, 4, axeBoxH, 'F');

  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.setTextColor(26,25,23);
  doc.text(axeNomLines, ML + 14, y + 16);
  doc.setFont('helvetica','bold');
  doc.setFontSize(12);
  doc.setTextColor(...RGB);
  doc.text(`${axe.pct||0}%`, W - MR - 12, y + 18, { align:'right' });

  if (axeDescLines.length) {
    doc.setFont('helvetica','italic');
    doc.setFontSize(8);
    doc.setTextColor(120,120,120);
    doc.text(axeDescLines, ML + 14, y + 18 + axeNomLines.length*12);
  }
  y += axeBoxH + 18;

  // ── INFORMATIONS DE L'OBJECTIF ─────────────────────────────
  doc.setFont('helvetica','bold');
  doc.setFontSize(8);
  doc.setTextColor(140,140,140);
  doc.text('INFORMATIONS DE L\u2019OBJECTIF', ML, y);
  y += 10;

  const jp = (typeof getJalonProgress === 'function') ? getJalonProgress(action.id) : null;
  const pctReel = jp ? Math.max(jp.pct, parseInt(action.pct)||0) : (parseInt(action.pct)||0);
  const budgetStr = action.budget ? Number(action.budget).toLocaleString('fr-CA') + ' $' : '—';

  const respObj = (APP.responsables || []).find(r => r.nom === action.resp);
  const infos = [
    ['Numéro', action.numero || '—'],
    ['Responsable', action.resp ? (respObj?.titre ? `${action.resp} — ${respObj.titre}` : action.resp) : '—'],
    ['Courriel', action.courriel || respObj?.courriel || '—'],
    ['Priorité', PRIO_LBL[action.prio] || '—'],
    ['Date de début', fmtDate(action.dateDebut) || '—'],
    ['Échéance', fmtDate(action.echeance) || '—'],
    ['Avancement', `${pctReel}%` + (jp ? `  (${jp.done}/${jp.total} jalons terminés)` : '')],
    ['Statut', action.statut || '—'],
    ['Budget prévu', budgetStr],
  ];

  doc.autoTable({
    startY: y,
    margin: { left: ML, right: MR },
    body: infos,
    bodyStyles: { fontSize:9, cellPadding:5 },
    columnStyles: {
      0: { cellWidth:130, fontStyle:'bold', textColor:[110,110,110] },
      1: { cellWidth:'auto', textColor:[26,25,23] },
    },
    alternateRowStyles: { fillColor:[250,249,247] },
    theme: 'plain',
    tableLineColor:[232,230,226], tableLineWidth:0.3,
    didParseCell(d) {
      if (d.column.index === 1 && d.row.index === 7) {
        const rgb = STATUT_RGB[action.statut];
        if (rgb) { d.cell.styles.textColor = rgb; d.cell.styles.fontStyle = 'bold'; }
      }
    },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Barre de progression
  doc.setFillColor(228,226,222);
  doc.roundedRect(ML, y, CW, 8, 3, 3, 'F');
  if (pctReel > 0) {
    doc.setFillColor(...RGB);
    doc.roundedRect(ML, y, CW * (pctReel/100), 8, 3, 3, 'F');
  }
  y += 22;

  // ── DESCRIPTION / INDICATEURS ──────────────────────────────
  if (action.desc) {
    checkPage(60);
    doc.setFont('helvetica','bold');
    doc.setFontSize(8);
    doc.setTextColor(140,140,140);
    doc.text('DESCRIPTION / INDICATEURS', ML, y);
    y += 12;
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(60,60,60);
    const dLines = doc.splitTextToSize(action.desc.replace(/\t/g,' '), CW - 14);
    doc.setFillColor(250,249,247);
    doc.roundedRect(ML, y - 8, CW, dLines.length*11 + 14, 3, 3, 'F');
    doc.text(dLines, ML + 8, y + 2);
    y += dLines.length*11 + 18;
  }

  // ── COMMENTAIRE DE SUIVI ───────────────────────────────────
  if (action.commentaire) {
    checkPage(50);
    doc.setFont('helvetica','bold');
    doc.setFontSize(8);
    doc.setTextColor(140,140,140);
    doc.text('COMMENTAIRE DE SUIVI', ML, y);
    y += 12;
    doc.setFont('helvetica','italic');
    doc.setFontSize(9);
    doc.setTextColor(80,80,80);
    const cLines = doc.splitTextToSize(action.commentaire, CW - 14);
    doc.text(cLines, ML + 8, y);
    y += cLines.length*11 + 14;
  }

  // ── JALONS ─────────────────────────────────────────────────
  checkPage(60);
  doc.setFont('helvetica','bold');
  doc.setFontSize(8);
  doc.setTextColor(140,140,140);
  doc.text(`JALONS (${jalons.length})`, ML, y);
  y += 14;

  if (!jalons.length) {
    doc.setFont('helvetica','italic');
    doc.setFontSize(9);
    doc.setTextColor(160,160,160);
    doc.text('Aucun jalon défini pour cet objectif.', ML, y);
    y += 16;
  }

  jalons.forEach((j, idx) => {
    const sRgb = STATUT_RGB[j.statut] || [158,156,150];
    const txtW = CW - 56;  // texte démarre à ML+40, marge intérieure droite de 16
    // IMPORTANT : définir la police AVANT splitTextToSize (sinon mauvais calcul de largeur)
    doc.setFont('helvetica','bold'); doc.setFontSize(9.5);
    const titLines = doc.splitTextToSize(j.titre || '', txtW);
    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    const descLines = j.desc ? doc.splitTextToSize(j.desc.replace(/\t/g,' '), txtW) : [];
    const actLines  = j.actionsRealisees ? doc.splitTextToSize(j.actionsRealisees.replace(/\t/g,' '), txtW) : [];
    const blockH = 30 + titLines.length*11
                 + (descLines.length ? descLines.length*10 + 14 : 0)
                 + (actLines.length  ? actLines.length*10 + 14 : 0);

    checkPage(blockH + 10);

    // Cadre
    doc.setFillColor(251,250,248);
    doc.roundedRect(ML, y, CW, blockH, 4, 4, 'F');
    doc.setFillColor(...sRgb);
    doc.rect(ML, y, 3, blockH, 'F');

    let yi = y + 15;

    // Badge J + titre
    doc.setFillColor(...sRgb);
    doc.roundedRect(ML + 12, yi - 9, 22, 12, 3, 3, 'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255,255,255);
    doc.text(`J${idx+1}`, ML + 23, yi - 1, { align:'center' });

    doc.setFont('helvetica','bold');
    doc.setFontSize(9.5);
    doc.setTextColor(26,25,23);
    doc.text(titLines, ML + 40, yi);
    yi += titLines.length*11 + 2;

    // Ligne meta : date · récurrence · statut
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(130,130,130);
    const dStr = j.continu ? '∞ En continu' : (fmtDate(j.date) || '—');
    const recStr = (j.recurrence && j.recurrence !== 'Aucune') ? `  ·  ↻ ${j.recurrence}` : '';
    doc.text(doc.splitTextToSize(`${dStr}${recStr}`, txtW - 80)[0], ML + 40, yi);
    doc.setFont('helvetica','bold');
    doc.setTextColor(...sRgb);
    doc.text(String(j.statut||''), W - MR - 14, yi, { align:'right' });
    yi += 14;

    // Indicateurs
    if (descLines.length) {
      doc.setFont('helvetica','bold');
      doc.setFontSize(7);
      doc.setTextColor(150,150,150);
      doc.text('INDICATEURS', ML + 40, yi);
      yi += 9;
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.setTextColor(80,80,80);
      doc.text(descLines, ML + 40, yi);
      yi += descLines.length*10 + 5;
    }

    // Actions réalisées
    if (actLines.length) {
      doc.setFont('helvetica','bold');
      doc.setFontSize(7);
      doc.setTextColor(99,153,34);
      doc.text('ACTIONS RÉALISÉES', ML + 40, yi);
      yi += 9;
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      doc.setTextColor(80,80,80);
      doc.text(actLines, ML + 40, yi);
    }

    y += blockH + 8;
  });

  // ── PIEDS DE PAGE ──────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(224,222,218);
    doc.setLineWidth(0.4);
    doc.line(ML, H - 34, W - MR, H - 34);
    doc.setFont('helvetica','normal');
    doc.setFontSize(7.5);
    doc.setTextColor(175,175,175);
    doc.text(`© ${now.getFullYear()} Muni-Consul™ — Solutions municipales intelligentes`, ML, H - 22);
    doc.text(`Page ${p} / ${pageCount}`, W - MR, H - 22, { align:'right' });
    doc.setFillColor(...RGB);
    doc.rect(0, H - 4, W, 4, 'F');
  }

  const safeName = (action.numero || action.titre).replace(/[^\w\-.]/g,'_').substring(0,40);
  doc.save(`Rapport-objectif-${safeName}-${now.toISOString().slice(0,10)}.pdf`);
}

/* ================================================================
   RAPPORT D'UN AXE — axe + tous ses objectifs + tous leurs jalons
   ================================================================ */
function openRapportAxeModal() {
  const sel = document.getElementById('rapport-axe-select');
  if (!sel) return;
  let html = '<option value="">— Choisir un axe —</option>';
  [...APP.axes]
    .sort((a,b) => (a.id||'').localeCompare(b.id||'','fr',{numeric:true}))
    .forEach(ax => {
      const nb = APP.actions.filter(a => a.axe === ax.id).length;
      html += `<option value="${h(String(ax.id))}">${h(ax.id)} — ${h(ax.nom)}  (${nb} objectif${nb>1?'s':''})</option>`;
    });
  sel.innerHTML = html;
  const bg = document.getElementById('rapport-axe-modal-bg');
  if (bg) { bg.style.display = 'flex'; bg.classList.add('open'); }
}

function closeRapportAxeModal() {
  const bg = document.getElementById('rapport-axe-modal-bg');
  if (bg) { bg.style.display = 'none'; bg.classList.remove('open'); }
}

function genererRapportAxe() {
  const sel = document.getElementById('rapport-axe-select');
  const axeId = sel?.value;
  if (!axeId) { alert('Veuillez sélectionner un axe.'); return; }
  closeRapportAxeModal();
  exportAxeCompletPDF(axeId);
}

function exportAxeCompletPDF(axeId) {
  if (!window.jspdf) { alert("La librairie jsPDF n'est pas chargée."); return; }
  const { jsPDF } = window.jspdf;

  const axe = getAxeMap()[axeId];
  if (!axe) { alert('Axe introuvable.'); return; }

  const actions = APP.actions
    .filter(a => a.axe === axeId)
    .sort((a,b) => (a.numero||'zzz').localeCompare(b.numero||'zzz','fr',{numeric:true}));

  const doc = new jsPDF({ unit:'pt', format:'letter', orientation:'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ML = 48, MR = 48;
  const CW = W - ML - MR;
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-CA', { year:'numeric', month:'long', day:'numeric' });

  function hr(hex) {
    const c = (hex||'#534AB7').replace('#','');
    return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
  }
  const RGB = hr(axe.color);
  const STATUT_RGB = {
    'terminée':[99,153,34],'en cours':[55,138,221],'en retard':[226,75,74],
    'en attente':[239,159,39],'en suspend':[123,104,238],'à faire':[158,156,150]
  };
  const PRIO_LBL = { haute:'Haute', moyenne:'Moyenne', basse:'Basse' };

  doc.setProperties({ title:`Rapport d'axe — ${axe.id} ${axe.nom}` });

  let y = 0;
  function checkPage(need) {
    if (y + need > H - 60) { doc.addPage(); y = 54; return true; }
    return false;
  }

  // ── EN-TÊTE ────────────────────────────────────────────────
  doc.setFillColor(...RGB);
  doc.rect(0, 0, W, 82, 'F');
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.setTextColor(255,255,255);
  doc.text('RAPPORT D\u2019AXE STRAT\u00c9GIQUE', ML, 24);
  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  const nomLines = doc.splitTextToSize(`${axe.id} — ${axe.nom}`, CW - 70);
  doc.text(nomLines.slice(0,2), ML, 46);
  doc.setFontSize(22);
  doc.text(`${axe.pct||0}%`, W - MR, 52, { align:'right' });
  doc.setFont('helvetica','normal');
  doc.setFontSize(8);
  doc.text(`Stukely-Sud  ·  ${dateStr}`, ML, 72);

  y = 102;

  // ── DESCRIPTION DE L'AXE ───────────────────────────────────
  if (axe.desc) {
    doc.setFont('helvetica','italic');
    doc.setFontSize(9);
    doc.setTextColor(100,100,100);
    const dLines = doc.splitTextToSize(axe.desc, CW - 20);
    doc.setFillColor(250,249,247);
    doc.roundedRect(ML, y - 10, CW, dLines.length*11 + 16, 4, 4, 'F');
    doc.setFillColor(...RGB);
    doc.rect(ML, y - 10, 3, dLines.length*11 + 16, 'F');
    doc.text(dLines, ML + 12, y + 2);
    y += dLines.length*11 + 20;
  }

  // ── STATISTIQUES DE L'AXE ──────────────────────────────────
  const done   = actions.filter(a => a.statut === 'terminée').length;
  const inprog = actions.filter(a => a.statut === 'en cours').length;
  const late   = actions.filter(a => a.statut === 'en retard').length;
  const todo   = actions.filter(a => a.statut === 'à faire').length;
  const budget = actions.reduce((s,a) => s + (budgetNum(a.budget)||0), 0);
  const allJalons = APP.jalons.filter(j => actions.some(a => String(a.id) === String(j.actionId)));
  const jalonsDone = allJalons.filter(j => j.statut === 'terminée').length;

  const kpis = [
    { label:'Objectifs',  val:String(actions.length), color:[26,25,23] },
    { label:'Terminés',   val:String(done),   color:[99,153,34] },
    { label:'En cours',   val:String(inprog), color:[55,138,221] },
    { label:'À faire',    val:String(todo),   color:[158,156,150] },
    { label:'En retard',  val:String(late),   color:[226,75,74] },
    { label:'Jalons',     val:`${jalonsDone}/${allJalons.length}`, color:RGB },
  ];
  const kW = (CW - (kpis.length-1)*6) / kpis.length;
  kpis.forEach((k,i) => {
    const kx = ML + i*(kW+6);
    doc.setFillColor(248,247,245);
    doc.roundedRect(kx, y, kW, 44, 4, 4, 'F');
    doc.setFillColor(...k.color);
    doc.roundedRect(kx, y, kW, 3, 1, 1, 'F');
    doc.setFont('helvetica','normal');
    doc.setFontSize(7);
    doc.setTextColor(140,140,140);
    doc.text(k.label, kx + kW/2, y + 15, { align:'center' });
    doc.setFont('helvetica','bold');
    doc.setFontSize(15);
    doc.setTextColor(...k.color);
    doc.text(k.val, kx + kW/2, y + 35, { align:'center' });
  });
  y += 54;

  // Budget total
  if (budget > 0) {
    doc.setFont('helvetica','normal');
    doc.setFontSize(9);
    doc.setTextColor(120,120,120);
    doc.text('Budget prévu total :', ML, y);
    doc.setFont('helvetica','bold');
    doc.setTextColor(...RGB);
    doc.text(budget.toLocaleString('fr-CA') + ' $', ML + 110, y);
    y += 18;
  }

  // Barre de progression
  doc.setFillColor(228,226,222);
  doc.roundedRect(ML, y, CW, 9, 3, 3, 'F');
  if (axe.pct > 0) {
    doc.setFillColor(...RGB);
    doc.roundedRect(ML, y, CW * (axe.pct/100), 9, 3, 3, 'F');
  }
  y += 28;

  // ── OBJECTIFS — vue d'ensemble ─────────────────────────────
  checkPage(80);
  doc.setFont('helvetica','bold');
  doc.setFontSize(8);
  doc.setTextColor(140,140,140);
  doc.text('VUE D\u2019ENSEMBLE DES OBJECTIFS', ML, y);
  y += 8;

  doc.autoTable({
    startY: y,
    margin: { left: ML, right: MR },
    head: [['N°','Objectif','Responsable','Échéance','%','Statut']],
    body: actions.map(a => {
      const jp = (typeof getJalonProgress === 'function') ? getJalonProgress(a.id) : null;
      const pct = jp ? Math.max(jp.pct, parseInt(a.pct)||0) : (parseInt(a.pct)||0);
      return [
        a.numero || '—',
        a.titre || '',
        a.resp || '—',
        fmtDate(a.echeance) || '—',
        `${pct}%`,
        a.statut || '',
      ];
    }),
    headStyles: { fillColor:[247,246,243], textColor:[100,100,100], fontStyle:'bold', fontSize:8, cellPadding:4 },
    bodyStyles: { fontSize:8, cellPadding:4 },
    columnStyles: {
      0:{cellWidth:40}, 1:{cellWidth:'auto'}, 2:{cellWidth:90},
      3:{cellWidth:66}, 4:{cellWidth:36, halign:'right'}, 5:{cellWidth:60},
    },
    didParseCell(d) {
      if (d.column.index === 5 && d.section === 'body') {
        const rgb = STATUT_RGB[actions[d.row.index]?.statut];
        if (rgb) { d.cell.styles.textColor = rgb; d.cell.styles.fontStyle = 'bold'; }
      }
    },
    alternateRowStyles: { fillColor:[251,250,248] },
    theme:'plain', tableLineColor:[232,230,226], tableLineWidth:0.3,
  });
  y = doc.lastAutoTable.finalY + 24;

  // ── DÉTAIL DE CHAQUE OBJECTIF ──────────────────────────────
  actions.forEach((action, aIdx) => {
    const jalons = APP.jalons
      .filter(j => String(j.actionId) === String(action.id))
      .sort((a,b) => (a.date||'zzzz').localeCompare(b.date||'zzzz'));

    checkPage(120);

    // Bandeau objectif
    doc.setFillColor(...RGB);
    doc.roundedRect(ML, y, CW, 24, 3, 3, 'F');
    doc.setFont('helvetica','bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255,255,255);
    const oTit = doc.splitTextToSize(`${action.numero ? action.numero + ' — ' : ''}${action.titre}`, CW - 70)[0];
    doc.text(oTit, ML + 10, y + 16);
    const jp = (typeof getJalonProgress === 'function') ? getJalonProgress(action.id) : null;
    const pctReel = jp ? Math.max(jp.pct, parseInt(action.pct)||0) : (parseInt(action.pct)||0);
    doc.setFontSize(11);
    doc.text(`${pctReel}%`, W - MR - 10, y + 16, { align:'right' });
    y += 32;

    // Infos clés sur une ligne
    const respObj = (APP.responsables||[]).find(r => r.nom === action.resp);
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(120,120,120);
    const meta = [
      action.resp ? `👤 ${action.resp}` : null,
      action.prio ? `⚑ ${PRIO_LBL[action.prio]||action.prio}` : null,
      action.dateDebut ? `▶ ${fmtDate(action.dateDebut)}` : null,
      action.echeance ? `⏱ ${fmtDate(action.echeance)}` : null,
      action.budget ? `$ ${Number(action.budget).toLocaleString('fr-CA')}` : null,
    ].filter(Boolean).join('     ');
    doc.text(doc.splitTextToSize(meta, CW)[0], ML + 4, y);
    if (respObj?.courriel || action.courriel) {
      doc.setTextColor(150,150,150);
      doc.text(action.courriel || respObj.courriel, W - MR, y, { align:'right' });
    }
    y += 14;

    // Description de l'objectif
    if (action.desc) {
      doc.setFont('helvetica','normal');
      doc.setFontSize(8);
      const dl = doc.splitTextToSize(action.desc.replace(/\t/g,' '), CW - 16);
      checkPage(dl.length*10 + 16);
      doc.setFillColor(250,249,247);
      doc.roundedRect(ML, y - 8, CW, dl.length*10 + 12, 3, 3, 'F');
      doc.setTextColor(90,90,90);
      doc.text(dl, ML + 8, y + 1);
      y += dl.length*10 + 16;
    }

    // Jalons de cet objectif
    if (jalons.length) {
      checkPage(30);
      doc.setFont('helvetica','bold');
      doc.setFontSize(7.5);
      doc.setTextColor(150,150,150);
      doc.text(`JALONS (${jalons.length})`, ML + 4, y);
      y += 10;

      jalons.forEach((j, idx) => {
        const sRgb = STATUT_RGB[j.statut] || [158,156,150];
        const txtW = CW - 56;
        doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
        const titLines = doc.splitTextToSize(j.titre || '', txtW);
        doc.setFont('helvetica','normal'); doc.setFontSize(7.5);
        const descLines = j.desc ? doc.splitTextToSize(j.desc.replace(/\t/g,' '), txtW) : [];
        const actLines  = j.actionsRealisees ? doc.splitTextToSize(j.actionsRealisees.replace(/\t/g,' '), txtW) : [];
        const blockH = 26 + titLines.length*10
                     + (descLines.length ? descLines.length*9 + 12 : 0)
                     + (actLines.length  ? actLines.length*9 + 12 : 0);

        checkPage(blockH + 8);

        doc.setFillColor(252,251,249);
        doc.roundedRect(ML, y, CW, blockH, 3, 3, 'F');
        doc.setFillColor(...sRgb);
        doc.rect(ML, y, 3, blockH, 'F');

        let yi = y + 13;
        doc.setFillColor(...sRgb);
        doc.roundedRect(ML + 10, yi - 8, 20, 11, 3, 3, 'F');
        doc.setFont('helvetica','bold');
        doc.setFontSize(7);
        doc.setTextColor(255,255,255);
        doc.text(`J${idx+1}`, ML + 20, yi - 1, { align:'center' });

        doc.setFont('helvetica','bold');
        doc.setFontSize(8.5);
        doc.setTextColor(26,25,23);
        doc.text(titLines, ML + 36, yi);
        yi += titLines.length*10 + 2;

        doc.setFont('helvetica','normal');
        doc.setFontSize(7.5);
        doc.setTextColor(135,135,135);
        const dStr = j.continu ? '∞ En continu' : (fmtDate(j.date) || '—');
        const recStr = (j.recurrence && j.recurrence !== 'Aucune') ? `  ·  ↻ ${j.recurrence}` : '';
        doc.text(`${dStr}${recStr}`, ML + 36, yi);
        doc.setFont('helvetica','bold');
        doc.setTextColor(...sRgb);
        doc.text(String(j.statut||''), W - MR - 14, yi, { align:'right' });
        yi += 12;

        if (descLines.length) {
          doc.setFont('helvetica','bold');
          doc.setFontSize(6.5);
          doc.setTextColor(160,160,160);
          doc.text('INDICATEURS', ML + 36, yi);
          yi += 8;
          doc.setFont('helvetica','normal');
          doc.setFontSize(7.5);
          doc.setTextColor(85,85,85);
          doc.text(descLines, ML + 36, yi);
          yi += descLines.length*9 + 4;
        }

        if (actLines.length) {
          doc.setFont('helvetica','bold');
          doc.setFontSize(6.5);
          doc.setTextColor(99,153,34);
          doc.text('ACTIONS RÉALISÉES', ML + 36, yi);
          yi += 8;
          doc.setFont('helvetica','normal');
          doc.setFontSize(7.5);
          doc.setTextColor(85,85,85);
          doc.text(actLines, ML + 36, yi);
        }

        y += blockH + 6;
      });
    }

    y += 14;
  });

  // ── PIEDS DE PAGE ──────────────────────────────────────────
  const pageCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setDrawColor(224,222,218);
    doc.setLineWidth(0.4);
    doc.line(ML, H - 34, W - MR, H - 34);
    doc.setFont('helvetica','normal');
    doc.setFontSize(7.5);
    doc.setTextColor(175,175,175);
    doc.text(`© ${now.getFullYear()} Muni-Consul™ — Solutions municipales intelligentes`, ML, H - 22);
    doc.text(`Page ${p} / ${pageCount}`, W - MR, H - 22, { align:'right' });
    doc.setFillColor(...RGB);
    doc.rect(0, H - 4, W, 4, 'F');
  }

  const safeName = String(axe.id).replace(/[^\w\-.]/g,'_');
  doc.save(`Rapport-axe-${safeName}-${now.toISOString().slice(0,10)}.pdf`);
}
