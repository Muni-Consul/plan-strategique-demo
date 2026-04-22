/* ================================================================
   10. MODAL DÉTAIL ACTION
   ================================================================ */
function openModal(id) {
  const a = APP.actions.find(x => String(x.id) === String(id));
  if (!a) return;
  const axeMap = getAxeMap();
  const axe = axeMap[a.axe] || { color:'#888', nom:a.axe };
  const sm  = STATUS_MAP[a.statut] || STATUS_MAP['à faire'];

  const _modalEmail = (() => { const r = (APP.responsables||[]).find(x=>x.nom===a.resp); const e = safeEmail(r && r.courriel); return e ? `<br><a href="mailto:${e}" style="font-size:12px;color:var(--c-blue);">${h(e)}</a>` : ''; })();
  document.getElementById('modal-box').innerHTML = `
    <div class="modal-head">
      <div id="modal-action-title" style="font-size:15px;font-weight:600;color:var(--c-text);line-height:1.4;">${h(a.titre)}</div>
      <button class="modal-close" onclick="closeModal()" aria-label="Fermer">×</button>
    </div>
    <div class="field-row"><span class="field-label">Axe</span><span class="field-value" style="color:${h(axe.color)};font-weight:500;">${h(axe.nom)}</span></div>
    <div class="field-row"><span class="field-label">Responsable</span><span class="field-value">${h(a.resp)}${_modalEmail}</span></div>
    <div class="field-row"><span class="field-label">Priorité</span><span class="field-value"><span class="prio-badge ${PRIO_MAP[a.prio]||'pr-m'}" style="display:inline-block;margin-right:5px;"></span>${h(a.prio)}</span></div>
    <div class="field-row"><span class="field-label">Échéance</span><span class="field-value">${fmtDate(a.echeance)}</span></div>
    <div class="field-row"><span class="field-label">Statut</span><span class="field-value"><span class="pill ${sm.pill}">${h(a.statut)}</span></span></div>
    <div class="field-row"><span class="field-label">Avancement</span><span class="field-value">${h(a.pct)}%</span></div>
    <div style="margin-bottom:12px;">
      <div class="progress-wrap" style="height:8px;">
        <div class="progress-fill" style="width:${h(a.pct)}%;background:${h(sm.dot)}"></div>
      </div>
    </div>
    ${a.desc ? `<div class="field-row"><span class="field-label">Réalisation</span></div><div class="modal-desc">${h(a.desc)}</div>` : ''}
    ${isLiveData ? `<a href="https://${SP_CONFIG.tenantDomain}${SP_CONFIG.siteRelativeUrl}/Lists/${SP_CONFIG.lists.actions}/DispForm.aspx?ID=${a.id}" target="_blank" class="btn" style="margin-top:14px;text-decoration:none;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      Ouvrir dans SharePoint
    </a>` : ''}
  `;
  _openModal(document.getElementById('modal-bg'));
}

/* ----------------------------------------------------------------
   ACCESSIBILITÉ — gestion du focus et touche Échap
   ---------------------------------------------------------------- */
let _lastFocusedEl = null;

function _openModal(modalEl) {
  _lastFocusedEl = document.activeElement;
  modalEl.classList.add('open');
  // Mettre le focus sur le premier bouton Fermer dans la modale
  const firstFocusable = modalEl.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (firstFocusable) requestAnimationFrame(() => firstFocusable.focus());
}

function _closeModal(modalEl) {
  modalEl.classList.remove('open');
  // Remettre le focus sur l'élément qui avait déclenché l'ouverture
  if (_lastFocusedEl) { _lastFocusedEl.focus(); _lastFocusedEl = null; }
}

// Fermer la modale active avec Échap
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Escape') return;
  if (document.getElementById('settings-modal-bg').classList.contains('open')) { closeSettingsModal(); return; }
  if (document.getElementById('form-modal-bg').classList.contains('open'))     { closeFormModal();     return; }
  if (document.getElementById('modal-bg').classList.contains('open'))          { closeModal();         return; }
});

function closeModal() {
  _closeModal(document.getElementById('modal-bg'));
}


/* ================================================================
   FORMULAIRE — SAISIE ET MODIFICATION
   ================================================================ */
let formEditId = null;

function openFormModal(actionId) {
  formEditId = actionId != null ? String(actionId) : null;
  const bg = document.getElementById('form-modal-bg');
  const title = document.getElementById('form-modal-title');
  const btnDelete = document.getElementById('form-btn-delete');

  // Reset form
  document.getElementById('form-error').classList.remove('show');
  document.getElementById('form-success').classList.remove('show');
  document.getElementById('form-saving').classList.remove('show');

  initDefaultSettings();

  // Axe dropdown
  const axeSelect = document.getElementById('f-axe');
  axeSelect.innerHTML = '<option value="">-- Choisir --</option>';
  APP.axes.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.id + ' – ' + a.nom;
    axeSelect.appendChild(opt);
  });

  // Responsable dropdown
  loadSettings();
  const respSelect = document.getElementById('f-responsable');
  if (respSelect && respSelect.tagName === 'SELECT') {
    respSelect.innerHTML = '<option value="">-- Choisir --</option>';
    (APP.responsables || []).forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.nom;
      opt.textContent = r.nom + (r.titre ? ' — ' + r.titre : '') + (r.courriel ? ' (' + r.courriel + ')' : '');
      respSelect.appendChild(opt);
    });
  }

  // Priorité dropdown
  const prioSelect = document.getElementById('f-priorite');
  prioSelect.innerHTML = '<option value="">-- Choisir --</option>';
  (APP.priorites || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    prioSelect.appendChild(opt);
  });

  // Statut dropdown
  const statutSelect = document.getElementById('f-statut');
  statutSelect.innerHTML = '<option value="">-- Choisir --</option>';
  (APP.statuts || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.label;
    statutSelect.appendChild(opt);
  });

  if (actionId) {
    // Mode édition
    title.textContent = 'Modifier l\'action';
    btnDelete.style.display = 'inline-flex';
    const a = APP.actions.find(x => String(x.id) === String(actionId));
    if (!a) {
      // Action introuvable (supprimée entre-temps) — ne pas ouvrir le formulaire
      formEditId = null;
      return;
    }
    document.getElementById('f-titre').value       = a.titre || '';
    document.getElementById('f-axe').value         = a.axe || '';
    document.getElementById('f-responsable').value = a.resp || '';
    document.getElementById('f-priorite').value    = a.prio || 'moyenne';
    document.getElementById('f-statut').value      = a.statut || 'à faire';
    document.getElementById('f-echeance').value    = a.echeance || '';
    document.getElementById('f-avancement').value  = a.pct || 0;
    document.getElementById('f-avancement-val').textContent = (a.pct || 0) + '%';
    document.getElementById('f-description').value = a.desc || '';
    document.getElementById('f-budget').value      = a.budget || '';
    document.getElementById('f-commentaire').value = a.commentaire || '';
  } else {
    // Mode création
    title.textContent = 'Nouvelle action';
    btnDelete.style.display = 'none';
    document.getElementById('f-titre').value       = '';
    document.getElementById('f-axe').value         = '';
    document.getElementById('f-responsable').value = '';
    document.getElementById('f-priorite').value    = 'moyenne';
    document.getElementById('f-statut').value      = 'à faire';
    document.getElementById('f-echeance').value    = '';
    document.getElementById('f-avancement').value  = 0;
    document.getElementById('f-avancement-val').textContent = '0%';
    document.getElementById('f-description').value  = '';
    document.getElementById('f-budget').value      = '';
    document.getElementById('f-commentaire').value = '';

    // Default date = today + 30 days
    const d = new Date();
    d.setDate(d.getDate() + 30);
    document.getElementById('f-echeance').value = d.toISOString().split('T')[0];
  }

  _lastFocusedEl = document.activeElement;
  bg.classList.add('open');
  requestAnimationFrame(() => document.getElementById('f-titre').focus());
}


function confirmDelete(id, event) {
  event.stopPropagation();
  const a = APP.actions.find(x => String(x.id) === String(id));
  if (!a) return;
  if (!confirm('Supprimer « ' + a.titre + ' » ?\nCette action est irréversible.')) return;
  formEditId = id != null ? String(id) : null;
  deleteAction(true); // confirmation déjà obtenue ci-dessus
}

function closeFormModal() {
  _closeModal(document.getElementById('form-modal-bg'));
  formEditId = null;
}

function showFormError(msg) {
  const el = document.getElementById('form-error');
  el.textContent = msg;
  el.classList.add('show');
}

function showFormSuccess(msg) {
  const el = document.getElementById('form-success');
  el.textContent = msg;
  el.classList.add('show');
}

async function saveAction() {
  // Validation
  const titre     = document.getElementById('f-titre').value.trim();
  const axe       = document.getElementById('f-axe').value;
  const echeance  = document.getElementById('f-echeance').value;
  const priorite  = document.getElementById('f-priorite').value;
  const statut    = document.getElementById('f-statut').value;
  const pct       = parseInt(document.getElementById('f-avancement').value);
  const resp      = document.getElementById('f-responsable').value.trim();
  const desc      = document.getElementById('f-description').value.trim();
  const budget    = document.getElementById('f-budget').value;
  const comment   = document.getElementById('f-commentaire').value.trim();
  const dateDebut = document.getElementById('f-date-debut').value;

  document.getElementById('form-error').classList.remove('show');
  document.getElementById('form-success').classList.remove('show');

  if (!titre)    { showFormError('Le nom de l\'action est obligatoire.'); return; }
  if (!axe)      { showFormError('Veuillez choisir un axe stratégique.'); return; }
  if (!echeance) { showFormError('La date d\'échéance est obligatoire.'); return; }

  // Show saving indicator
  document.getElementById('form-saving').classList.add('show');
  document.querySelectorAll('.form-btn-save, .form-btn-cancel, .form-btn-delete').forEach(b => b.disabled = true);

  const newAction = {
    id:          formEditId || ('local-' + Date.now()),
    titre:       titre,
    axe:         axe,
    resp:        resp,
    prio:        priorite,
    echeance:    echeance,
    pct:         pct,
    statut:      statut,
    desc:        desc,
    budget:      budget,
    commentaire: comment
  };

  try {
    if (isLiveData && graphToken) {
      // Sauvegarder dans SharePoint via Graph API
      const axeMap = getAxeMap();
      const axeObj = axeMap[axe];
      const axeLabel = axeObj ? axe + ' – ' + axeObj.nom : axe;

      const spFields = {
        Title:            titre,
        Axe_Strategique:  axeLabel,
        Priorite:         priorite.charAt(0).toUpperCase() + priorite.slice(1),
        Date_Echeance:    echeance ? new Date(echeance).toISOString() : null,
        Avancement:       pct,
        Statut:           statut.charAt(0).toUpperCase() + statut.slice(1),
        Description:      desc,
        Commentaire_Suivi: comment
      };

      // Sauvegarder le responsable et son courriel
      if (resp) {
        spFields['Responsable_Nom'] = resp;
        // Chercher le courriel du responsable dans les paramètres
        const respObj = (APP.responsables || []).find(r => r.nom === resp);
        if (respObj && respObj.courriel) {
          spFields['Responsable_Courriel'] = respObj.courriel;
        }
      }

      if (dateDebut) spFields['Date_Debut'] = new Date(dateDebut).toISOString();
      if (budget)    spFields['Budget_Prevu'] = parseFloat(budget);

      if (formEditId && !formEditId.startsWith('local-')) {
        // Mise à jour
        await graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.actions}/items/${formEditId}/fields`,
          'PATCH', spFields
        );
        // Mettre à jour dans APP.actions
        const idx = APP.actions.findIndex(x => String(x.id) === formEditId);
        if (idx !== -1) APP.actions[idx] = { ...APP.actions[idx], ...newAction };
        showFormSuccess('Action mise à jour avec succès dans SharePoint !');
      } else {
        // Création
        const result = await graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.actions}/items`,
          'POST', { fields: spFields }
        );
        newAction.id = result.id;
        APP.actions.push(newAction);
        showFormSuccess('Action créée avec succès dans SharePoint !');
      }
    } else {
      // Mode démo — mise à jour locale uniquement
      if (formEditId) {
        const idx = APP.actions.findIndex(x => String(x.id) === formEditId);
        if (idx !== -1) APP.actions[idx] = { ...APP.actions[idx], ...newAction };
        showFormSuccess('Action mise à jour (mode démo — non sauvegardé dans SharePoint)');
      } else {
        APP.actions.push(newAction);
        showFormSuccess('Action ajoutée (mode démo — non sauvegardé dans SharePoint)');
      }
    }

    // Rafraîchir les vues
    renderApercu();
    renderActions();
    renderAxes();

    // Fermer après délai
    setTimeout(() => { closeFormModal(); }, 1500);

  } catch (err) {
    showFormError('Erreur : ' + err.message);
  } finally {
    document.getElementById('form-saving').classList.remove('show');
    document.querySelectorAll('.form-btn-save, .form-btn-cancel, .form-btn-delete').forEach(b => b.disabled = false);
  }
}

async function deleteAction(skipConfirm = false) {
  if (!formEditId) return;
  if (!skipConfirm && !confirm('Supprimer cette action ? Cette opération est irréversible.')) return;

  document.getElementById('form-saving').classList.add('show');
  document.querySelectorAll('.form-btn-save, .form-btn-cancel, .form-btn-delete').forEach(b => b.disabled = true);

  try {
    if (isLiveData && graphToken && !formEditId.startsWith('local-')) {
      await graphFetch(
        `/sites/${spSiteId}/lists/${SP_CONFIG.lists.actions}/items/${formEditId}`,
        'DELETE'
      );
    }
    APP.actions = APP.actions.filter(x => String(x.id) !== formEditId);
    renderApercu();
    renderActions();
    renderAxes();
    closeFormModal();
  } catch (err) {
    showFormError('Erreur suppression : ' + err.message);
    document.getElementById('form-saving').classList.remove('show');
    document.querySelectorAll('.form-btn-save, .form-btn-cancel, .form-btn-delete').forEach(b => b.disabled = false);
  }
}

