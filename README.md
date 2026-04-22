# 📊 Tableau de bord stratégique — Muni-Consul

Application web de suivi du plan d'action stratégique municipal, connectée à SharePoint Online via Microsoft Graph API. Hébergée sur GitHub Pages avec authentification Azure AD (MSAL).

🔗 **Démo en ligne** : [muni-consul.github.io/plan-strategique-demo](https://muni-consul.github.io/plan-strategique-demo/)

---

## 🗂 Structure des fichiers

```
├── index.html                  Page principale de l'application
├── setup-sharepoint.html       Utilitaire : création des listes SharePoint
├── init-sharepoint.html        Utilitaire : création de Historique_Actions
├── sw.js                       Service Worker (mode hors ligne)
├── css/
│   └── style.css               Tous les styles (thèmes, responsive, composants)
└── js/
    ├── auth.js                 Authentification MSAL / Azure AD
    ├── config.js               Configuration SharePoint et Azure (à modifier)
    ├── state.js                État global de l'app (APP, STATUS_MAP, cache hors ligne)
    ├── data.js                 Chargement données SharePoint + données démo
    ├── sharepoint.js           Fonctions Graph API (graphFetch, getListItems…)
    ├── render.js               Rendu des vues (Aperçu, Actions, Axes, Gantt…)
    ├── modal.js                Formulaire d'édition / suppression d'actions
    ├── navigation.js           Navigation, écrans (auth, loading, app)
    ├── settings.js             Paramètres (axes, responsables, statuts, thèmes)
    ├── alerts.js               Alertes visuelles (retards, échéances proches)
    ├── export.js               Export PDF et CSV
    └── utils.js                Fonctions utilitaires (formatage dates, sanitisation)
```

---

## ⚙️ Configuration

### 1. Azure AD — App Registration

Dans le [portail Azure](https://portal.azure.com) → **Azure Active Directory → App registrations** :

| Paramètre | Valeur |
|---|---|
| Client ID | `d77e2842-aa80-489c-a13c-120357e6fb07` |
| Tenant | `municonsul485.onmicrosoft.com` |
| Redirect URI | `https://muni-consul.github.io/plan-strategique-demo/` |
| Permissions API | `Sites.Read.All`, `User.Read` |

### 2. Fichier `js/config.js`

```javascript
const SP_CONFIG = {
  tenantDomain:    "municonsul485.sharepoint.com",
  siteRelativeUrl: "/sites/Planstrategique-Demo",
  lists: {
    axes:       "Axes_Strategiques",
    actions:    "Actions_Plan",
    jalons:     "Jalons",
    historique: "Historique_Actions"
  },
  msalClientId:  "d77e2842-aa80-489c-a13c-120357e6fb07",
  msalAuthority: "https://login.microsoftonline.com/municonsul485.onmicrosoft.com",
  redirectUri:   "https://muni-consul.github.io/plan-strategique-demo/"
};
```

### 3. Listes SharePoint

Ouvrez **`setup-sharepoint.html`** depuis le site GitHub Pages pour créer automatiquement les 4 listes avec toutes leurs colonnes :

| Liste | Colonnes principales |
|---|---|
| `Axes_Strategiques` | Identifiant, Nom, Avancement, Couleur, CouleurClaire |
| `Actions_Plan` | Axe_Strategique, Responsable_Nom, Priorite, Statut, Date_Echeance, Avancement… |
| `Jalons` | DateJalon, Axe, Statut |
| `Historique_Actions` | ActionId, Utilisateur, TypeModification, Details |

---

## 🚀 Déploiement

Le site est hébergé sur **GitHub Pages** (branche `main`) :

```bash
# Modifier les fichiers localement, puis pousser
git add .
git commit -m "Description des changements"
git push origin master:main
```

GitHub Pages se met à jour automatiquement en ~2 minutes.

---

## 🖥 Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| **Aperçu** | KPIs globaux, graphique donut et barres par axe |
| **Actions** | Tableau filtrable, pagination 15/page, édition/suppression |
| **Axes** | Cartes par axe stratégique avec avancement |
| **Jalons** | Ligne de temps des jalons |
| **Ma vue** | Filtrage par responsable avec KPIs personnels |
| **Gantt** | Diagramme de Gantt annuel |
| **Export** | PDF (impression) et CSV (Excel) |
| **Alertes** | Bandeau rouge + badge menu pour les retards |
| **Paramètres** | Axes, responsables, statuts, priorités, thème |
| **Mode hors ligne** | Service Worker + cache localStorage |
| **Historique** | Suivi des modifications dans SharePoint |

---

## 🎨 Thèmes

Trois thèmes disponibles dans les paramètres :
- **Gris foncé** (défaut)
- **Blanc**
- **Sombre**

---

## 🔒 Mode démo

Si l'application est ouverte sur `localhost` ou si SharePoint est inaccessible, elle bascule automatiquement en **mode démo** avec des données fictives. Aucune configuration requise pour tester.

---

## 📋 Prérequis techniques

- Compte **Microsoft 365 / Azure AD**
- Site **SharePoint Online**
- Dépôt **GitHub** avec GitHub Pages activé
- Navigateur moderne (Chrome, Edge, Firefox)

---

*© 2026 Muni-Consul™ — Solutions municipales intelligentes*
