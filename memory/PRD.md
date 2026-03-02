# PRD - Eyefind Portail Fiscal

## Problème original
Création d'un site web fonctionnel pour un serveur GTA RP avec un système de gestion d'entreprise, comptabilité et impôts.

## Rôles utilisateurs
- **Gouvernement (Admin)** : Crée les entreprises et comptes, voit tout, gère les impôts
- **Patron** : Gère son entreprise, ses employés et sa comptabilité (semaine en cours uniquement)
- **Employé** : Accède aux fonctionnalités autorisées par le patron (permissions granulaires)

## Fonctionnalités implémentées

### Authentification & Rôles
- JWT auth avec 3 rôles (gouvernement, patron, employé)
- Format email: `nom@eyefinds.nomentreprise.info`
- Thème sombre Eyefind, interface en français

### Gestion des entreprises
- CRUD complet (admin)
- Modification du nom d'entreprise

### Gestion des employés
- Création/modification/suppression par le patron
- Permissions granulaires: caisse, dépenses, salaires, voir transactions, comptabilité, impôts, gérer employés

### Comptabilité
- Caisse enregistreuse: revenus, dépenses (avec catégorie+justification), salaires
- Comptabilité globale visible par le gouvernement
- **Comptabilité hebdomadaire**: les entreprises ne voient que la semaine en cours (depuis dimanche 00:00 UTC)
- **Historique comptable**: snapshots hebdomadaires visibles uniquement par le gouvernement

### Système fiscal
- Génération d'avis d'impôts (manuelle + automatique chaque dimanche 23:59 UTC)
- Calcul basé sur bénéfice brut avec barème de pourcentages
- Minimum 5000$ même si bénéfice négatif
- **Statut payé/non payé** toggleable par le gouvernement
- Export PDF
- Snapshot comptable créé à chaque génération

### Gestion des comptes
- Admin peut créer/modifier/supprimer tous les comptes
- Changement de mot de passe admin

## Stack technique
- Backend: FastAPI + MongoDB (pymongo) + JWT
- Frontend: React + Tailwind CSS + shadcn/ui
- PDF: reportlab (backend)

## Architecture
```
/app/backend/server.py - API monolithique
/app/frontend/src/pages/admin/ - Pages gouvernement
/app/frontend/src/pages/business/ - Pages patron
/app/frontend/src/pages/employee/ - Pages employé
/app/frontend/src/pages/CashRegisterPage.jsx - Caisse partagée
```

## Collections MongoDB
- users, businesses, transactions, tax_notices, tax_brackets, accounting_snapshots

## Credentials de test
- Admin: l.bennett@eyefinds.gouvernement.info / password
- Patron: patron.test@lsc.rp / password
