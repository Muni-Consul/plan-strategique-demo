/* ================================================================
   NOTIFICATIONS — INTÉGRATION POWER AUTOMATE
   ================================================================
   Permet de déclencher un flux Power Automate via un webhook HTTP
   pour envoyer un courriel hebdomadaire aux responsables dont des
   objectifs sont en retard.
   ================================================================ */

const PA_WEBHOOK_KEY = 'plan_strategique_pa_webhook';

/** Charger l'URL sauvegardée dans le champ du panneau */
function loadPaWebhookUrl() {
  const url = localStorage.getItem(PA_WEBHOOK_KEY) || '';
  const el = document.getElementById('pa-webhook-url');
  if (el) el.value = url;
}

/** Sauvegarder l'URL du webhook */
function savePaWebhook() {
  const url = (document.getElementById('pa-webhook-url')?.value || '').trim();
  if (!url) { showToast('Veuillez entrer une URL de flux Power Automate.', 'error'); return; }
  if (!url.startsWith('https://')) { showToast('L\'URL doit commencer par https://', 'error'); return; }
  localStorage.setItem(PA_WEBHOOK_KEY, url);
  showToast('URL Power Automate sauvegardée.', 'success');
}

/** Construire le payload JSON à envoyer au flux */
function buildPaPayload() {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Grouper les objectifs en retard par responsable
  const grouped = {};
  APP.actions.filter(a => {
    if (a.statut === 'terminée') return false;
    const due = parseLocalDate(a.echeance);
    return due && due < today;
  }).forEach(a => {
    const key = a.resp || 'Sans responsable';
    if (!grouped[key]) {
      const respObj = (APP.responsables || []).find(r => r.nom === key);
      grouped[key] = {
        nom:       key,
        courriel:  respObj?.courriel || '',
        nbRetards: 0,
        objectifs: []
      };
    }
    const due    = parseLocalDate(a.echeance);
    const jours  = Math.round((today - due) / 86400000);
    const axeMap = getAxeMap();
    const axeNom = axeMap[a.axe]?.nom || a.axe || '';
    grouped[key].nbRetards++;
    grouped[key].objectifs.push({
      titre:       a.titre,
      axe:         axeNom,
      echeance:    a.echeance,
      retardJours: jours,
      avancement:  a.pct,
      statut:      a.statut
    });
  });

  return {
    dateEnvoi:     new Date().toISOString(),
    responsables:  Object.values(grouped),
    totalRetards:  APP.actions.filter(a => {
      if (a.statut === 'terminée') return false;
      const due = parseLocalDate(a.echeance);
      return due && due < today;
    }).length
  };
}

/** Déclencher le flux Power Automate (test manuel ou planifié) */
async function triggerPaWebhook() {
  const url = localStorage.getItem(PA_WEBHOOK_KEY)
           || (document.getElementById('pa-webhook-url')?.value || '').trim();

  const resultEl = document.getElementById('pa-result');

  if (!url) {
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--c-danger);">⚠ Aucune URL configurée.</span>';
    showToast('Veuillez configurer l\'URL du flux Power Automate.', 'error');
    return;
  }

  const payload = buildPaPayload();
  const nbResp  = payload.responsables.length;
  const nbLate  = payload.totalRetards;

  if (nbLate === 0) {
    if (resultEl) resultEl.innerHTML = '<span style="color:var(--c-ok);">✓ Aucun objectif en retard — aucun courriel envoyé.</span>';
    showToast('Aucun objectif en retard, flux non déclenché.', 'info');
    return;
  }

  if (resultEl) resultEl.innerHTML = '<span style="color:var(--c-text-2);">⏳ Envoi en cours…</span>';

  try {
    const resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });

    // Power Automate renvoie 200 ou 202 (Accepted)
    if (resp.ok || resp.status === 202) {
      const msg = `Flux déclenché — ${nbResp} responsable${nbResp > 1 ? 's' : ''}, ${nbLate} objectif${nbLate > 1 ? 's' : ''} en retard.`;
      if (resultEl) resultEl.innerHTML = `<span style="color:var(--c-ok);">✓ ${h(msg)}</span>`;
      showToast('Courriel hebdomadaire déclenché avec succès !', 'success');
    } else {
      throw new Error(`HTTP ${resp.status} — ${resp.statusText}`);
    }
  } catch (err) {
    const msg = err.message;
    if (resultEl) resultEl.innerHTML = `<span style="color:var(--c-danger);">✕ Erreur : ${h(msg)}</span>`;
    showToast('Erreur lors du déclenchement : ' + msg, 'error');
  }
}
