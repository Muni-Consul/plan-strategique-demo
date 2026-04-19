/* ================================================================
   11. NAVIGATION
   ================================================================ */
function switchPane(id, btn) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('pane-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
}


/* ================================================================
   13. GESTION DES ÉCRANS
   ================================================================ */
function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app').style.display = 'none';
}

function showLoadingScreen() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function setLoadingStep(msg) {
  document.getElementById('loading-step').textContent = msg;
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  const db = document.getElementById('demo-banner'); if(db) db.style.display = 'flex';

  // Infos utilisateur
  if (currentAccount) {
    const name = currentAccount.name || currentAccount.username;
    const initials = name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
    const uiEl = document.getElementById('user-initials'); if (uiEl) uiEl.textContent = initials;
    const unEl = document.getElementById('user-name'); if (unEl) unEl.textContent = name.split(' ')[0];
  } else {
    const diEl = document.getElementById('user-initials'); if (diEl) diEl.textContent = 'DÉ';
    const dnEl = document.getElementById('user-name'); if (dnEl) dnEl.textContent = 'Mode démo';
  }

  // Indicateur live / démo
  if (isLiveData) {
    const dotEl = document.getElementById('sp-dot');
    const lblEl = document.getElementById('sp-label');
    if (dotEl) dotEl.className = 'sp-dot sp-live';
    if (lblEl) lblEl.textContent = 'Données SharePoint';
  }

  // Topbar
  const tmEl = document.getElementById('topbar-meta'); if (tmEl) tmEl.textContent =
    `Mise à jour le ${new Date().toLocaleDateString('fr-CA', {year:'numeric',month:'long',day:'numeric'})}` +
    (isLiveData ? ' · SharePoint Live' : ' · Mode démo');

  calcAvancementAxes();
  renderApercu();
  renderActions();
  renderAxes();
  renderTimeline();
  renderMaVue();
  renderGantt();
  checkAlertes();
}

function showAuthError(msg) {
  document.getElementById('auth-error').innerHTML = `<div class="error-card">${h(msg)}</div>`;
}


/* ================================================================
   14. DÉMARRAGE
   ================================================================ */
const fyEl = document.getElementById('footer-year'); if (fyEl) fyEl.textContent = new Date().getFullYear();
document.querySelectorAll('.footer-year-side').forEach(el => el.textContent = new Date().getFullYear());
// Initialisation sécurisée — attendre que MSAL soit chargé
let msalLoadAttempts = 0;
function startApp() {
  msalLoadAttempts++;
  if (typeof msal === 'undefined' || !msal.PublicClientApplication) {
    if (msalLoadAttempts > 20) {
      console.warn('MSAL non disponible après 6s, mode démo');
      loadDemoData();
      return;
    }
    setTimeout(startApp, 300);
    return;
  }
  initMSAL().catch(err => {
    console.warn('MSAL init failed, loading demo:', err);
    loadDemoData();
  });
}

// Démarrer après chargement complet
window.addEventListener('load', function() {
  setTimeout(startApp, 200);
});
