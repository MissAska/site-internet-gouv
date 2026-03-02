# PRD - Eyefind Portail Fiscal

## Problème original
Site web pour serveur GTA RP : gestion d'entreprise, comptabilité, impôts et commandes de véhicules.

## Rôles
- **Gouvernement (Admin)** : Crée entreprises/comptes, voit tout, gère impôts
- **Patron** : Gère son entreprise, employés, catalogue véhicules, comptabilité (semaine en cours)
- **Employé** : Accès selon permissions (caisse, commandes, transactions, etc.)

## Fonctionnalités implémentées

### Auth & Rôles
- JWT avec 3 rôles, format email `nom@eyefinds.nomentreprise.info`, thème sombre Eyefind

### Entreprises & Employés
- CRUD entreprises (admin), CRUD employés (patron), permissions granulaires (7 types)

### Comptabilité
- Caisse enregistreuse (revenus, dépenses avec justif, salaires)
- Comptabilité hebdomadaire : entreprises voient semaine en cours, gouvernement voit tout
- Historique comptable : snapshots hebdomadaires (auto dimanche 23h59 + manuel)
- Snapshot manuel remet les compteurs à zéro

### Système fiscal
- Avis d'impôts (génération manuelle + auto dimanche 23h59)
- Statut payé/non payé toggleable par le gouvernement
- Export PDF, barème configurable, minimum 5000$

### Véhicules (NOUVEAU)
- **Catalogue** : 79 véhicules en 4 catégories (Commercial, Compacts, Coupes, Drift), CRUD par patron
- **Commandes** : Formulaire complet (client, tél, entreprise, modèle, réduction max 30%, prix final calculé)
- **Suivi DNA** : Statuts En attente → Fabrication → Réceptionné → Livré, commentaire DNA
- **Vue concessionnaire** : Tableau type spreadsheet avec tous les champs
- **Vue DNA** : Dashboard avec stats et mise à jour des statuts

### Gestion comptes
- Admin crée/modifie/supprime comptes, changement mot de passe

## Stack
- Backend: FastAPI + MongoDB + JWT
- Frontend: React + Tailwind + shadcn/ui
- PDF: reportlab

## Collections MongoDB
users, businesses, transactions, tax_notices, tax_brackets, accounting_snapshots, vehicle_catalog, vehicle_orders, settings

## Credentials
- Admin: l.bennett@eyefinds.gouvernement.info / password
- Patron: patron.test@lsc.rp / password
