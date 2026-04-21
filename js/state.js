/* ================================================================
   5. ÉTAT GLOBAL DE L'APPLICATION
   ================================================================ */
const APP = {
  axes: [], actions: [], jalons: [],
  activeFilter: 'tous',
  donutChart: null, lineChart: null,
  _axeMap: null   // cache invalidé quand APP.axes change
};

/** Convertit "YYYY-MM-DD" en Date locale (minuit) ; retourne null si invalide */
function parseLocalDate(d) {
  if (!d) return null;
  const dt = new Date(d + 'T00:00:00');
  return isNaN(dt.getTime()) ? null : dt;
}

/** Génère la version claire d'une couleur hex (opacité ~13%) */
function hexLight(color) { return color + '22'; }

/** Retourne un objet {id → axe} mis en cache. Appeler invalidateAxeMap() après toute modification de APP.axes. */
function getAxeMap() {
  if (!APP._axeMap) {
    APP._axeMap = {};
    (APP.axes || []).forEach(a => { APP._axeMap[a.id] = a; });
  }
  return APP._axeMap;
}
function invalidateAxeMap() { APP._axeMap = null; }

/** persistSettings déboncé — évite les écritures localStorage répétées lors d'éditions en rafale */
let _persistTimer = null;
function debouncedPersist() {
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(persistSettings, 300);
}

const STATUS_MAP = {
  'terminée':   { pill:'p-done', dot:'#639922',  label:'Terminée' },
  'en cours':   { pill:'p-prog', dot:'#378ADD',  label:'En cours' },
  'en retard':  { pill:'p-late', dot:'#E24B4A',  label:'En retard' },
  'en attente': { pill:'p-hold', dot:'#EF9F27',  label:'En attente' },
  'à faire':    { pill:'p-todo', dot:'#9E9C96',  label:'À faire' },
};
const PRIO_MAP = { haute:'pr-h', moyenne:'pr-m', basse:'pr-l' };
