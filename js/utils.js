/* ================================================================
   0. UTILITAIRES SÉCURITÉ
   ================================================================ */
/** Échappe les caractères HTML dangereux dans une valeur avant insertion dans innerHTML */
function h(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
/** Valide un email avant usage dans href="mailto:" ; retourne null si invalide */
function safeEmail(email) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return null;
  return String(email).replace(/[<>"'&]/g, '');
}


/* ================================================================
   12. UTILITAIRES
   ================================================================ */

function formatDelai(dateStr) {
  if (!dateStr) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const due = parseLocalDate(dateStr);
  if (!due) return '';
  const diff = Math.round((due - today) / 86400000);
  if (diff === 0) return '<span style="color:#A32D2D;font-size:11px;font-weight:500;">Aujourd\'hui</span>';
  if (diff < 0)  return `<span style="color:#A32D2D;font-size:11px;font-weight:500;">Retard ${Math.abs(diff)}j</span>`;
  if (diff <= 7) return `<span style="color:#854F0B;font-size:11px;font-weight:500;">Dans ${diff}j</span>`;
  return `<span style="font-size:11px;color:var(--c-text-3);">Dans ${diff}j</span>`;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = parseLocalDate(d);
  if (!dt) return d;
  return dt.toLocaleDateString('fr-CA', { year:'numeric', month:'short', day:'numeric' });
}

/**
 * Calcule l'avancement attendu (cible) à la date d'aujourd'hui selon une
 * progression linéaire entre dateDebut et écheance, et l'écart avec le réel.
 * @param {object} action
 * @returns {{cible:number, gap:number}|null}  null si dates manquantes
 */
function calcCible(action) {
  if (!action.dateDebut || !action.echeance) return null;
  const debut = parseLocalDate(action.dateDebut);
  const fin   = parseLocalDate(action.echeance);
  if (!debut || !fin || fin <= debut) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const raw   = (today - debut) / (fin - debut) * 100;
  const cible = Math.round(Math.min(100, Math.max(0, raw)));
  const reel  = parseInt(action.pct) || 0;
  return { cible, gap: reel - cible };
}

function exportCSV() {
  /** Échappe une valeur pour CSV : guillemets internes doublés, préfixe formule retiré */
  const csvCell = v => {
    const s = v == null ? '' : String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  const headers = ['ID','Titre','Axe','Responsable','Priorité','Échéance','Avancement (%)','Statut','Réalisation'];
  const rows = APP.actions.map(a => [
    csvCell(a.id), csvCell(a.titre), csvCell(a.axe), csvCell(a.resp),
    csvCell(a.prio), csvCell(a.echeance), csvCell(a.pct), csvCell(a.statut), csvCell(a.desc)
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'plan_action_strategique.csv'; link.click();
  URL.revokeObjectURL(url);
}

function openSharePoint() {
  window.open(`https://${SP_CONFIG.tenantDomain}${SP_CONFIG.siteRelativeUrl}`, '_blank');
}

async function refreshData() {
  if (!isLiveData) { alert("Mode démo actif. Configurez SharePoint pour actualiser les données réelles."); return; }
  document.querySelector('.nav-item[onclick*="refreshData"]').style.opacity = '0.5';
  try {
    await loadSharePointData();
  } finally {
    document.querySelector('.nav-item[onclick*="refreshData"]').style.opacity = '1';
  }
}
