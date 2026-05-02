/* ================================================================
   3. MAPPING DES CHAMPS SHAREPOINT → MODÈLE INTERNE
   NOTE : Adaptez les noms de champs selon votre liste SharePoint
   ================================================================ */
function mapAxe(fields) {
  return {
    id:     fields.Identifiant       || fields.Title,
    nom:    fields.Nom               || fields.Title,
    pct:    parseInt(fields.Avancement || fields.Pourcentage || 0),
    color:  fields.Couleur           || "#534AB7",
    light:  fields.CouleurClaire     || "#EEEDFE",
    desc:   fields.Description_Axe   || fields.Description || "",
    spId:   fields._spId             || null,   // ID SharePoint pour les mises à jour
  };
}

function mapAction(fields) {
  // Extraire le code axe (ex: "A1 - Gouvernance" -> "A1")
  const axeRaw = fields.Axe_Strategique || fields.Axe || fields.AxeId || "";
  const axeCode = axeRaw.match(/^(A\d+)/)?.[1] || axeRaw;

  // Parser les dates correctement
  const parseDate = (d) => {
    if (!d) return "";
    try { return new Date(d).toISOString().split('T')[0]; }
    catch { return ""; }
  };

  return {
    id:          fields.ID              || fields.id,
    titre:       fields.Title           || fields.Titre || "",
    axe:         axeCode,
    resp:        fields.Responsable_Nom ||
                 fields.Responsable_Texte ||
                 ((typeof fields.Responsable === 'object' && fields.Responsable !== null)
                   ? (fields.Responsable.LookupValue || fields.Responsable.DisplayName || "")
                   : (fields.Responsable || "")),
    courriel:    fields.Responsable_Courriel || "",
    prio:        (fields.Priorite       || fields.Priority || "moyenne").toLowerCase(),
    echeance:    parseDate(fields.Date_Echeance || fields.Echeance || fields.DateEcheance),
    dateDebut:   parseDate(fields.Date_Debut    || fields.DateDebut),
    pct:         parseInt(fields.Avancement || 0),
    statut:      (fields.Statut         || "à faire").toLowerCase(),
    desc:        fields.Description     || fields.Notes || "",
    budget:      fields.Budget_Prevu    || "",
    commentaire: fields.Commentaire_Suivi || fields.Commentaire || "",
  };
}

function mapJalon(fields) {
  return {
    date:    fields.Date             || fields.DateJalon,
    titre:   fields.Title            || fields.Titre,
    axe:     fields.Axe              || "",
    statut:  (fields.Statut          || "à faire").toLowerCase(),
  };
}


/* ================================================================
   4. CHARGEMENT DES DONNÉES — SHAREPOINT OU DÉMO
   ================================================================ */
async function loadSharePointData() {
  setLoadingStep("Récupération de l'ID du site…");
  try {
    spSiteId = await getSiteId();
    setLoadingStep("Chargement des axes stratégiques…");
    const rawAxes    = await getListItems(SP_CONFIG.lists.axes);
    setLoadingStep("Chargement des actions…");
    const rawActions = await getListItems(SP_CONFIG.lists.actions);
    setLoadingStep("Chargement des jalons…");
    const rawJalons  = await getListItems(SP_CONFIG.lists.jalons);

    // Charger les axes SharePoint
    const spAxes = rawAxes.map(mapAxe);
    
    // Charger les paramètres sauvegardés (axes perso, responsables, etc.)
    loadSettings();
    
    // Fusionner : garder les axes du localStorage, compléter avec ceux de SharePoint
    const savedAxeIds = (APP.axes || []).map(a => a.id);
    const newSpAxes = spAxes.filter(a => !savedAxeIds.includes(a.id));
    APP.axes = [...(APP.axes || []), ...newSpAxes];

    invalidateAxeMap();

    APP.actions = rawActions.map(mapAction);
    APP.jalons  = rawJalons.map(mapJalon);
    isLiveData  = true;

    // Sauvegarder pour usage hors ligne
    persistData();

    setLoadingStep("Rendu du tableau de bord…");
    showApp();
  } catch (err) {
    console.error("SharePoint load error:", err);

    // Tenter de restaurer les données du cache local (mode hors ligne)
    const savedAt = restoreData();
    if (savedAt) {
      const date = new Date(savedAt).toLocaleDateString('fr-CA', { day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' });
      console.info(`Mode hors ligne — données du ${date}`);
      isLiveData = false;
      setLoadingStep("Chargement des données en cache…");
      showApp();
      setTimeout(() => {
        const dot = document.getElementById('sp-dot');
        const lbl = document.getElementById('sp-label');
        if (dot) dot.className = 'sp-dot sp-offline';
        if (lbl) lbl.textContent = `Hors ligne · ${date}`;
      }, 500);
    } else {
      // Afficher l'erreur réelle sur l'écran de chargement avant de basculer
      console.warn("Aucun cache disponible, mode démonstration:", err.message);
      setLoadingStep("⚠️ Connexion SharePoint échouée — mode démo");
      // Afficher un message visible pendant 4 secondes
      const stepEl = document.getElementById('loading-step');
      if (stepEl) {
        stepEl.style.color = '#E24B4A';
        stepEl.innerHTML =
          `<strong>Accès SharePoint refusé</strong><br>
           <span style="font-size:.8rem;">${err.message}</span><br>
           <span style="font-size:.75rem;opacity:.7;">Chargement en mode démo…</span>`;
      }
      setTimeout(() => loadDemoData(), 3000);
    }
  }
}

function loadDemoData() {
  /* ---- DONNÉES DE DÉMONSTRATION ----
     Remplacées automatiquement par les données SharePoint en production */

  // Charger d'abord les paramètres sauvegardés
  loadSettings();

  // Définir les axes par défaut seulement si aucun n'est sauvegardé
  if (!APP.axes || APP.axes.length === 0) {
  APP.axes = [
    { id:'A1', nom:'Gouvernance et administration', color:'#534AB7', light:'#EEEDFE', pct:78 },
    { id:'A2', nom:'Services aux citoyens',          color:'#0F6E56', light:'#E1F5EE', pct:65 },
    { id:'A3', nom:'Développement durable',           color:'#185FA5', light:'#E6F1FB', pct:52 },
    { id:'A4', nom:'Infrastructure et travaux',  color:'#BA7517', light:'#FAEEDA', pct:61 },
    { id:'A5', nom:'Innovation & R&D',           color:'#993C1D', light:'#FAECE7', pct:42 },
  ];
  } // fin if axes vides
  invalidateAxeMap();

  APP.actions = [
    { id:'1', titre:'Déploiement intranet SharePoint',    axe:'A1', resp:'M. Tremblay', prio:'haute',   echeance:'2026-03-31', pct:90,  statut:'en cours',   desc:'Migration complète vers SharePoint Online. Formation terminée.' },
    { id:'2', titre:'Automatisation des processus RH',   axe:'A1', resp:'S. Gagné',    prio:'haute',   echeance:'2026-06-30', pct:45,  statut:'en cours',   desc:'Power Automate pour les flux d\'approbation RH.' },
    { id:'3', titre:'Tableau de bord BI direction',      axe:'A1', resp:'J. Côté',     prio:'moyenne', echeance:'2026-02-28', pct:100, statut:'terminée',   desc:'Power BI déployé. Utilisateurs formés.' },
    { id:'4', titre:'Formation cybersécurité',           axe:'A1', resp:'L. Bouchard', prio:'haute',   echeance:'2025-12-31', pct:30,  statut:'en retard',  desc:'Retard dû à la refonte du contenu pédagogique.' },
    { id:'5', titre:'Refonte du portail client',         axe:'A2', resp:'A. Roy',      prio:'haute',   echeance:'2026-06-30', pct:65,  statut:'en cours',   desc:'Nouveau portail en développement. Tests UX prévus en avril.' },
    { id:'6', titre:'Programme fidélisation',            axe:'A2', resp:'P. Lavoie',   prio:'moyenne', echeance:'2026-09-30', pct:20,  statut:'en cours',   desc:'Étude de marché complétée. Conception en cours.' },
    { id:'7', titre:'Sondage satisfaction annuel',       axe:'A2', resp:'C. Martin',   prio:'basse',   echeance:'2026-04-15', pct:100, statut:'terminée',   desc:'Rapport final remis. Score NPS : 62.' },
    { id:'8', titre:'Centre de service amélioré',        axe:'A2', resp:'D. Fortin',   prio:'haute',   echeance:'2025-11-30', pct:15,  statut:'en retard',  desc:'Implémentation du CRM retardée.' },
    { id:'9', titre:'Plan de relève cadres',             axe:'A3', resp:'N. Bergeron', prio:'haute',   echeance:'2026-05-31', pct:55,  statut:'en cours',   desc:'Identification des postes clés complétée.' },
    { id:'10',titre:'Programme mentorat interne',        axe:'A3', resp:'F. Dubois',   prio:'moyenne', echeance:'2026-07-31', pct:0,   statut:'à faire',    desc:'Lancement prévu en juin 2026.' },
    { id:'11',titre:'Révision politique télétravail',    axe:'A3', resp:'M. Tremblay', prio:'moyenne', echeance:'2026-03-15', pct:100, statut:'terminée',   desc:'Politique adoptée par le CA.' },
    { id:'12',titre:'Formation leadership',              axe:'A3', resp:'S. Gagné',    prio:'haute',   echeance:'2025-10-31', pct:40,  statut:'en retard',  desc:'Fournisseur externe non disponible, report Q2 2026.' },
    { id:'13',titre:'Révision processus achats',         axe:'A4', resp:'H. Leblanc',  prio:'haute',   echeance:'2026-04-30', pct:70,  statut:'en cours',   desc:'Cartographie terminée. Procédures en révision.' },
    { id:'14',titre:'Certification ISO 9001',            axe:'A4', resp:'R. Pelletier',prio:'haute',   echeance:'2026-12-31', pct:35,  statut:'en cours',   desc:'Audit interne prévu en mai. GAP analysis complétée.' },
    { id:'15',titre:'Réduction coûts opérationnels',     axe:'A4', resp:'J. Côté',     prio:'haute',   echeance:'2026-06-30', pct:100, statut:'terminée',   desc:'Économies de 280 000$ réalisées. Objectif dépassé.' },
    { id:'16',titre:'Laboratoire d\'innovation',         axe:'A5', resp:'V. Simard',   prio:'moyenne', echeance:'2026-09-30', pct:25,  statut:'en cours',   desc:'Espace identifié. Budget approuvé.' },
    { id:'17',titre:'Partenariat universités',           axe:'A5', resp:'E. Girard',   prio:'moyenne', echeance:'2026-12-31', pct:10,  statut:'en attente', desc:'En attente d\'approbation du CA.' },
    { id:'18',titre:'Projet pilote IA générative',       axe:'A5', resp:'A. Roy',      prio:'haute',   echeance:'2026-06-30', pct:50,  statut:'en cours',   desc:'Phase 1 complétée. Résultats positifs.' },
  ];
  APP.jalons = [
    { date:'2026-01-15', titre:'Lancement phase 2 transformation numérique', axe:'A1', statut:'terminée' },
    { date:'2026-02-28', titre:'Tableau de bord BI direction — livraison',    axe:'A1', statut:'terminée' },
    { date:'2026-03-15', titre:'Politique télétravail — adoption CA',         axe:'A3', statut:'terminée' },
    { date:'2026-04-15', titre:'Rapport sondage satisfaction client',          axe:'A2', statut:'en cours' },
    { date:'2026-04-30', titre:'Révision processus achats — décision',        axe:'A4', statut:'en cours' },
    { date:'2026-05-31', titre:'Plan de relève — présentation direction',     axe:'A3', statut:'à faire'  },
    { date:'2026-06-30', titre:'Revue mi-parcours plan stratégique',          axe:'A1', statut:'à faire'  },
    { date:'2026-09-30', titre:'Bilan annuel axes 1–3',                       axe:'A2', statut:'à faire'  },
    { date:'2026-12-31', titre:'Rapport annuel de suivi',                     axe:'A4', statut:'à faire'  },
  ];
  isLiveData = false;
  showApp();
}
