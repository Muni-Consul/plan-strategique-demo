/* ================================================================
   ALERTES VISUELLES
   ================================================================ */
function checkAlertes() {
  const banner = document.getElementById('alert-banner');
  const txt = document.getElementById('alert-banner-text');
  if (!banner || !txt) return;

  const today = new Date(); today.setHours(0,0,0,0);

  const late = APP.actions.filter(a => {
    if (!a.echeance || a.statut === 'terminée') return false;
    const due = parseLocalDate(a.echeance);
    return due && due < today;
  });
  const soon = APP.actions.filter(a => {
    if (!a.echeance || a.statut === 'terminée') return false;
    const due = parseLocalDate(a.echeance);
    if (!due) return false;
    const diff = Math.round((due - today) / 86400000);
    return diff >= 0 && diff <= 7;
  });

  if (late.length > 0 || soon.length > 0) {
    let msg = '';
    if (late.length > 0) msg += `${late.length} action${late.length>1?'s':''} en retard. `;
    if (soon.length > 0) msg += `${soon.length} action${soon.length>1?'s':''} échéant dans 7 jours ou moins.`;
    txt.textContent = msg;
    banner.classList.add('show');
  } else {
    banner.classList.remove('show');
  }
}
