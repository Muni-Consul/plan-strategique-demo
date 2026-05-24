/* ================================================================
   CONFIGURATION SHAREPOINT — Lecture / Écriture
   Liste "Configuration" : un seul item Title="dashboard_config"
   ================================================================ */
let _spConfigItemId = null;  // ID SharePoint de l'item de config

async function loadSpConfig() {
  if (!isLiveData || !graphToken || !spSiteId) return;
  try {
    // Pas de $filter (Title non indexé) — on charge tous les items et on filtre côté client
    const res = await graphFetch(
      `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items?expand=fields($select=Title,Valeur)&$top=50`,
      'GET', null, { 'Prefer': 'HonorNonIndexedQueriesWarningMayFailRandomly' }
    );
    const items = (res.value || []).filter(i => i.fields?.Title === 'dashboard_config');
    if (items.length > 0) {
      _spConfigItemId = items[0].id;
      const valeur = items[0].fields?.Valeur;
      if (valeur) {
        try {
          const cfgSp = JSON.parse(valeur);

          // Lire le localStorage
          let cfgLocal = null;
          try { cfgLocal = JSON.parse(localStorage.getItem('plan_strategique_config') || 'null'); } catch(_) {}

          // SharePoint est la source de vérité — localStorage sert uniquement de fallback hors ligne
          if (cfgSp.responsables?.length) APP.responsables = cfgSp.responsables;
          if (cfgSp.statuts?.length)      APP.statuts      = cfgSp.statuts;
          if (cfgSp.priorites?.length)    APP.priorites    = cfgSp.priorites;
          if (cfgSp.autoCalcAxes !== undefined) APP.autoCalcAxes = cfgSp.autoCalcAxes;
          if (cfgSp.theme)                APP.theme        = cfgSp.theme;

          // Restaurer couleurs et descriptions des axes depuis SP
          const axesMeta = cfgSp.axesMeta || [];
          axesMeta.forEach(meta => {
            // Chercher l'axe par spId (le plus fiable), puis id, puis nom
            const axe = (APP.axes || []).find(a =>
              (meta.spId && a.spId && String(a.spId) === String(meta.spId)) ||
              (meta.id && a.id && a.id === meta.id) ||
              (meta.nom && a.nom && a.nom.trim() === meta.nom.trim())
            );
            if (axe) {
              if (meta.color) axe.color = meta.color;
              if (meta.light) axe.light = meta.light;
              if (meta.desc !== undefined) axe.desc = meta.desc;
            }
          });

          // Mettre localStorage à jour (cache hors ligne)
          localStorage.setItem('plan_strategique_config', JSON.stringify({ ...cfgSp, savedAt: new Date().toISOString() }));
        } catch(e) { console.warn('Config SP parse error', e); }
      }
    }
  } catch(e) { console.warn('loadSpConfig error:', e.message); }
}

async function persistSpConfig() {
  if (!isLiveData || !graphToken || !spSiteId) return;
  // Sauvegarder aussi couleurs et descriptions des axes (absent de SP)
  const axesMeta = (APP.axes || []).map(a => ({
    id: a.id, nom: a.nom, spId: a.spId, color: a.color, light: a.light, desc: a.desc
  }));
  const valeur = JSON.stringify({
    responsables: APP.responsables || [],
    statuts:      APP.statuts      || [],
    priorites:    APP.priorites    || [],
    autoCalcAxes: APP.autoCalcAxes || false,
    axesMeta,
    savedAt:      new Date().toISOString()
  });
  try {
    // Si l'ID n'est pas connu, chercher l'item existant avant d'en créer un nouveau
    if (!_spConfigItemId) {
      const existing = await graphFetch(
        `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items?expand=fields($select=Title)&$top=50`,
        'GET', null, { 'Prefer': 'HonorNonIndexedQueriesWarningMayFailRandomly' }
      );
      const items = (existing.value || []).filter(i => i.fields?.Title === 'dashboard_config');
      if (items.length > 0) {
        _spConfigItemId = items[0].id;
        // Supprimer les doublons éventuels (items 2, 3, …)
        for (let i = 1; i < items.length; i++) {
          try {
            await graphFetch(
              `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items/${items[i].id}`,
              'DELETE'
            );
          } catch(e2) { console.warn('Doublon config non supprimé:', e2.message); }
        }
      }
    }

    if (_spConfigItemId) {
      try {
        await graphFetch(
          `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items/${_spConfigItemId}/fields`,
          'PATCH', { Valeur: valeur }
        );
      } catch(e404) {
        // L'item a été supprimé/recréé — réinitialiser l'ID et créer un nouvel item
        if (e404.message && e404.message.includes('404')) {
          _spConfigItemId = null;
          const res = await graphFetch(
            `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items`,
            'POST', { fields: { Title: 'dashboard_config', Valeur: valeur } }
          );
          _spConfigItemId = res.id;
        } else {
          throw e404;
        }
      }
    } else {
      const res = await graphFetch(
        `/sites/${spSiteId}/lists/${SP_CONFIG.lists.config}/items`,
        'POST', { fields: { Title: 'dashboard_config', Valeur: valeur } }
      );
      _spConfigItemId = res.id;
    }
    return true; // succès
  } catch(e) {
    console.error('persistSpConfig error:', e.message);
    if (typeof showToast === 'function') {
      showToast('⚠️ Paramètres non sauvegardés sur SharePoint : ' + e.message, 'error');
    }
    return false;
  }
}

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
    id:          fields._spId          || fields.ID || fields.id,
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
  // Statut_Jalon est le vrai nom interne dans cette liste SP
  const statut = fields.Statut_Jalon || fields.Statut || fields.statut || fields.Status || "à faire";
  // Date — nom interne "Date" (affichée "Date du jalon")
  const _dateRaw = fields.Date_Jalon || fields.Date || fields.DateJalon || fields.Date_du_jalon || "";
  const date = _dateRaw ? (() => { try { return new Date(_dateRaw).toISOString().split('T')[0]; } catch { return _dateRaw; } })() : "";
  return {
    id:       fields._spId           || fields.id || '',
    date:     date,
    titre:    fields.Title           || fields.Titre,
    desc:     fields.Description     || fields.Description0 || "",
    actionId: fields.ActionId        || "",
    statut:   statut.toLowerCase(),
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
    setLoadingStep("Chargement de la configuration…");

    // SharePoint est la source de vérité
    const spAxes = rawAxes.map(mapAxe);

    // loadSettings peut restaurer les axes depuis localStorage — on le laisse faire
    // pour les responsables/statuts/priorités, puis on réimpose les axes SP
    loadSettings();
    APP.axes = spAxes;
    invalidateAxeMap();

    // Appliquer couleurs et config depuis la liste Configuration SP
    await loadSpConfig();
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
      setLoadingStep("⚠️ Connexion SharePoint échouée");
      // Afficher un message visible pendant 4 secondes
      const stepEl = document.getElementById('loading-step');
      if (stepEl) {
        stepEl.style.color = '#E24B4A';
        stepEl.innerHTML =
          `<strong>Accès SharePoint refusé</strong><br>
           <span style="font-size:.8rem;">${err.message}</span><br>
           <span style="font-size:.75rem;opacity:.7;">Chargement des données locales…</span>`;
      }
      setTimeout(() => loadDemoData(), 3000);
    }
  }
}

function loadDemoData() {
  /* ================================================================
     DONNÉES DE DÉMONSTRATION — Tableau de bord plan stratégique
     Municipalité fictive · À remplacer par vos données SharePoint
     ================================================================ */
  loadSettings();

  APP.responsables = [
    { id: 'dgm',    nom: 'Directrice générale',          couleur: '#534AB7' },
    { id: 'treso',  nom: 'Trésorier municipal',          couleur: '#378ADD' },
    { id: 'infra',  nom: 'Responsable infrastructure',   couleur: '#639922' },
    { id: 'comm',   nom: 'Responsable communications',   couleur: '#EF9F27' },
    { id: 'loisir', nom: 'Responsable loisirs',          couleur: '#E24B4A' },
  ];

  APP.axes = [
    { id:'A1', nom:'Gouvernance et administration',         pct:42, color:'#534AB7', light:'#EEEDFE', desc:'Moderniser les pratiques de gestion municipale et renforcer la transparence.' },
    { id:'A2', nom:'Infrastructure et mobilité',            pct:28, color:'#378ADD', light:'#E8F2FC', desc:'Maintenir et développer les infrastructures routières et les services publics.' },
    { id:'A3', nom:'Environnement et développement durable',pct:15, color:'#639922', light:'#EEF5E6', desc:'Réduire l\'empreinte environnementale et promouvoir les pratiques durables.' },
    { id:'A4', nom:'Vie communautaire et loisirs',          pct:60, color:'#EF9F27', light:'#FDF3E3', desc:'Améliorer la qualité de vie des citoyens par des activités et espaces de qualité.' },
    { id:'A5', nom:'Développement économique local',        pct:8,  color:'#E24B4A', light:'#FDEAEA', desc:'Soutenir les entreprises locales et attirer de nouveaux investissements.' },
  ];
  invalidateAxeMap();

  APP.actions = [
    // A1 — Gouvernance
    { id:1,  titre:'Révision de la politique de gestion documentaire',      axe:'A1', resp:'dgm',    prio:'haute',   echeance:'2025-06-30', dateDebut:'2025-01-15', pct:100, statut:'terminée',   desc:'Mise à jour complète des procédures de classement et d\'archivage.', budget:'8 000 $',   commentaire:'Complété en avance sur l\'échéancier.' },
    { id:2,  titre:'Implantation d\'un système de gestion des plaintes',     axe:'A1', resp:'dgm',    prio:'haute',   echeance:'2025-12-31', dateDebut:'2025-03-01', pct:65,  statut:'en cours',   desc:'Portail citoyen pour dépôt et suivi des plaintes en ligne.', budget:'15 000 $',  commentaire:'Développement du portail en cours.' },
    { id:3,  titre:'Formation des élus sur la gouvernance municipale',       axe:'A1', resp:'dgm',    prio:'moyenne', echeance:'2025-09-30', dateDebut:'2025-04-01', pct:50,  statut:'en cours',   desc:'Deux sessions de formation prévues pour les membres du conseil.', budget:'5 000 $',   commentaire:'Première session complétée.' },
    { id:4,  titre:'Révision du règlement de zonage',                        axe:'A1', resp:'treso',  prio:'haute',   echeance:'2026-03-31', dateDebut:'2025-06-01', pct:20,  statut:'en cours',   desc:'Mise à jour pour refléter les nouvelles réalités du territoire.', budget:'25 000 $',  commentaire:'Consultation publique prévue à l\'automne.' },
    { id:5,  titre:'Rapport annuel de performance publié en ligne',          axe:'A1', resp:'comm',   prio:'moyenne', echeance:'2025-04-30', dateDebut:'2025-02-01', pct:100, statut:'terminée',   desc:'Rapport accessible sur le site municipal.', budget:'2 000 $',   commentaire:'Publié le 28 avril 2025.' },
    { id:6,  titre:'Mise en place d\'un comité consultatif citoyen',         axe:'A1', resp:'dgm',    prio:'basse',   echeance:'2026-06-30', dateDebut:'2026-01-01', pct:0,   statut:'à faire',    desc:'Comité de 10 citoyens représentatifs des secteurs de la municipalité.', budget:'3 000 $', commentaire:'' },

    // A2 — Infrastructure
    { id:7,  titre:'Réfection du chemin des Érables (2,4 km)',               axe:'A2', resp:'infra',  prio:'haute',   echeance:'2025-10-31', dateDebut:'2025-05-01', pct:75,  statut:'en cours',   desc:'Travaux de resurfaçage et correction du drainage.', budget:'480 000 $', commentaire:'Travaux bien avancés, fin prévue en octobre.' },
    { id:8,  titre:'Remplacement de 12 ponceaux déficients',                 axe:'A2', resp:'infra',  prio:'haute',   echeance:'2025-11-30', dateDebut:'2025-04-15', pct:58,  statut:'en cours',   desc:'Inspection et remplacement prioritaire selon évaluation de 2024.', budget:'95 000 $',  commentaire:'7 ponceaux remplacés sur 12.' },
    { id:9,  titre:'Étude sur la gestion des eaux pluviales',                axe:'A2', resp:'infra',  prio:'moyenne', echeance:'2025-12-31', dateDebut:'2025-03-01', pct:40,  statut:'en cours',   desc:'Cartographie et plan de gestion des bassins versants.', budget:'30 000 $',  commentaire:'Données collectées, analyse en cours.' },
    { id:10, titre:'Rénovation du garage municipal',                          axe:'A2', resp:'infra',  prio:'moyenne', echeance:'2026-08-31', dateDebut:'2026-02-01', pct:0,   statut:'à faire',    desc:'Agrandissement et mise aux normes du bâtiment.', budget:'120 000 $', commentaire:'' },
    { id:11, titre:'Plan de gestion des actifs municipaux',                  axe:'A2', resp:'treso',  prio:'haute',   echeance:'2025-08-31', dateDebut:'2025-01-01', pct:90,  statut:'en cours',   desc:'Inventaire complet et évaluation de l\'état de tous les actifs.', budget:'18 000 $',  commentaire:'Document final en révision.' },
    { id:12, titre:'Signalisation des rues — mise à jour complète',          axe:'A2', resp:'infra',  prio:'basse',   echeance:'2025-11-30', dateDebut:'2025-07-01', pct:0,   statut:'en retard',  desc:'Remplacement des panneaux désuets selon la nouvelle norme MTQ.', budget:'12 000 $',  commentaire:'Appel d\'offres retardé.' },

    // A3 — Environnement
    { id:13, titre:'Plantation de 200 arbres en milieu urbain',              axe:'A3', resp:'loisir', prio:'moyenne', echeance:'2025-11-15', dateDebut:'2025-04-01', pct:45,  statut:'en cours',   desc:'Programme de verdissement des rues et parcs.', budget:'22 000 $',  commentaire:'90 arbres plantés au printemps.' },
    { id:14, titre:'Programme de compostage municipal',                      axe:'A3', resp:'infra',  prio:'haute',   echeance:'2025-09-30', dateDebut:'2025-02-01', pct:30,  statut:'en attente', desc:'Collecte aux deux semaines, bacs distribués aux résidents.', budget:'45 000 $',  commentaire:'En attente d\'approbation du budget révisé.' },
    { id:15, titre:'Audit énergétique des bâtiments municipaux',             axe:'A3', resp:'infra',  prio:'moyenne', echeance:'2025-12-31', dateDebut:'2025-06-01', pct:10,  statut:'en cours',   desc:'Analyse de la consommation d\'énergie de 5 bâtiments.', budget:'14 000 $',  commentaire:'Mandat octroyé à une firme spécialisée.' },
    { id:16, titre:'Politique de développement durable adoptée',             axe:'A3', resp:'dgm',    prio:'haute',   echeance:'2026-03-31', dateDebut:'2025-09-01', pct:0,   statut:'à faire',    desc:'Encadrement des pratiques municipales selon les principes de développement durable.', budget:'5 000 $', commentaire:'' },

    // A4 — Vie communautaire
    { id:17, titre:'Rénovation du parc des Pionniers',                       axe:'A4', resp:'loisir', prio:'haute',   echeance:'2025-08-31', dateDebut:'2025-03-01', pct:100, statut:'terminée',   desc:'Nouvelle aire de jeux, mobilier urbain et éclairage LED.', budget:'85 000 $',  commentaire:'Inauguré le 15 août 2025!' },
    { id:18, titre:'Programme d\'activités pour les aînés',                  axe:'A4', resp:'loisir', prio:'moyenne', echeance:'2025-12-31', dateDebut:'2025-01-01', pct:70,  statut:'en cours',   desc:'12 activités hebdomadaires offertes au centre communautaire.', budget:'18 000 $',  commentaire:'Excellente participation — 45 inscrits réguliers.' },
    { id:19, titre:'Festival estival annuel',                                 axe:'A4', resp:'comm',   prio:'moyenne', echeance:'2025-07-31', dateDebut:'2025-02-01', pct:100, statut:'terminée',   desc:'2 jours d\'activités culturelles et sportives pour toute la famille.', budget:'30 000 $', commentaire:'Grande réussite : 1 200 visiteurs.' },
    { id:20, titre:'Bibliothèque — heures d\'ouverture élargies',            axe:'A4', resp:'loisir', prio:'basse',   echeance:'2026-01-31', dateDebut:'2025-10-01', pct:0,   statut:'à faire',    desc:'Ouverture le samedi matin et deux soirs supplémentaires par semaine.', budget:'9 000 $', commentaire:'' },
    { id:21, titre:'Terrain de pickleball — 4 terrains extérieurs',          axe:'A4', resp:'loisir', prio:'moyenne', echeance:'2026-05-31', dateDebut:'2025-11-01', pct:5,   statut:'en cours',   desc:'Construction de 4 terrains avec clôture et éclairage.', budget:'65 000 $',  commentaire:'Plans approuvés, appel d\'offres en cours.' },

    // A5 — Développement économique
    { id:22, titre:'Répertoire des entreprises locales en ligne',            axe:'A5', resp:'comm',   prio:'moyenne', echeance:'2025-10-31', dateDebut:'2025-04-01', pct:20,  statut:'en cours',   desc:'Plateforme web de visibilité pour les commerces et artisans locaux.', budget:'8 000 $',  commentaire:'Maquettes approuvées, développement débuté.' },
    { id:23, titre:'Journée des entrepreneurs locaux',                       axe:'A5', resp:'comm',   prio:'basse',   echeance:'2025-11-30', dateDebut:'2025-07-01', pct:10,  statut:'en attente', desc:'Événement annuel de réseautage et valorisation des PME du territoire.', budget:'6 000 $', commentaire:'En attente de confirmation des partenaires.' },
    { id:24, titre:'Étude sur les besoins en main-d\'œuvre locale',          axe:'A5', resp:'dgm',    prio:'haute',   echeance:'2026-06-30', dateDebut:'2026-01-01', pct:0,   statut:'à faire',    desc:'Sondage auprès des entreprises pour identifier les besoins en recrutement.', budget:'12 000 $', commentaire:'' },
  ];

  APP.jalons = [
    { id:'j1',  actionId:2,  titre:'Appel d\'offres publié',              date:'2025-04-15', statut:'terminée', desc:'Appel d\'offres pour le développement du portail.' },
    { id:'j2',  actionId:2,  titre:'Fournisseur sélectionné',             date:'2025-05-30', statut:'terminée', desc:'Contrat signé avec le prestataire.' },
    { id:'j3',  actionId:2,  titre:'Version bêta du portail livrée',      date:'2025-09-30', statut:'en cours', desc:'Tests internes en cours.' },
    { id:'j4',  actionId:2,  titre:'Lancement public du portail',         date:'2025-12-31', statut:'à faire',  desc:'Communication et formation des employés.' },
    { id:'j5',  actionId:7,  titre:'Mobilisation du chantier',            date:'2025-05-15', statut:'terminée', desc:'Mise en place de la signalisation temporaire.' },
    { id:'j6',  actionId:7,  titre:'Travaux de terrassement complétés',   date:'2025-07-31', statut:'terminée', desc:'Drainage et fondation de gravier.' },
    { id:'j7',  actionId:7,  titre:'Asphaltage réalisé',                  date:'2025-09-30', statut:'en cours', desc:'75% du tronçon asphalté.' },
    { id:'j8',  actionId:7,  titre:'Réception des travaux',               date:'2025-10-31', statut:'à faire',  desc:'Inspection finale et signature du certificat.' },
    { id:'j9',  actionId:11, titre:'Inventaire des actifs complété',      date:'2025-04-30', statut:'terminée', desc:'3 200 actifs recensés.' },
    { id:'j10', actionId:11, titre:'Évaluation de l\'état réalisée',      date:'2025-06-30', statut:'terminée', desc:'Cote attribuée à chaque actif.' },
    { id:'j11', actionId:11, titre:'Plan de maintenance préventive',      date:'2025-08-31', statut:'en cours', desc:'Priorisation des interventions sur 10 ans.' },
    { id:'j12', actionId:13, titre:'Acquisition des arbres',              date:'2025-04-15', statut:'terminée', desc:'200 arbres commandés auprès d\'une pépinière régionale.' },
    { id:'j13', actionId:13, titre:'Plantation — secteur centre',         date:'2025-05-31', statut:'terminée', desc:'90 arbres plantés dans le secteur du centre-village.' },
    { id:'j14', actionId:13, titre:'Plantation — secteur nord',           date:'2025-10-15', statut:'à faire',  desc:'110 arbres restants à planter à l\'automne.' },
    { id:'j15', actionId:21, titre:'Plans et devis approuvés',            date:'2025-12-31', statut:'en cours', desc:'Soumis au conseil pour approbation.' },
    { id:'j16', actionId:21, titre:'Appel d\'offres lancé',               date:'2026-02-28', statut:'à faire',  desc:'' },
    { id:'j17', actionId:21, titre:'Travaux de construction',             date:'2026-04-30', statut:'à faire',  desc:'' },
    { id:'j18', actionId:21, titre:'Inauguration des terrains',           date:'2026-05-31', statut:'à faire',  desc:'' },
  ];

  isLiveData = false;
  showApp();
}
