# PRD - Eyefind Portail Fiscal

## Problème original
Site web pour serveur GTA RP : gestion d'entreprise, comptabilité, impôts et commandes de véhicules.

## Rôles
- **Gouvernement (Admin)** : Crée entreprises/comptes, voit tout, gère impôts
- **Patron** : Gère son entreprise, employés, comptabilité (semaine en cours)
- **Employé** : Accès selon permissions granulaires

## Types d'entreprise
- **Standard** : Comptabilité classique (caisse, transactions, impôts)
- **Concessionnaire** : + Catalogue véhicules, Commandes, Suivi DNA
- **DNA (DN Automotive)** : + Suivi fabrication (mise à jour des statuts d'avancement)

## Fonctionnalités implémentées

### Auth & Rôles
- JWT avec 3 rôles, format email `nom@eyefinds.nomentreprise.info`, thème sombre Eyefind

### Entreprises
- CRUD avec type d'entreprise (standard/concessionnaire/dna)
- Badge visuel du type dans la page admin

### Employés & Permissions
- CRUD par le patron, 7 permissions granulaires

### Comptabilité
- Caisse enregistreuse, comptabilité hebdomadaire, historique
- Snapshot auto dimanche 23h59 + snapshot manuel (remet compteurs à zéro)

### Système fiscal
- Avis d'impôts avec statut payé/non payé, export PDF, barème configurable

### Véhicules
- Catalogue : 79 véhicules, 4 catégories, CRUD par patron concessionnaire
- Commandes : Formulaire complet, réduction max 30%, prix calculé auto
- Suivi DNA : En attente → Fabrication → Réceptionné → Livré
- Accès conditionné par le type d'entreprise

## Collections MongoDB
users, businesses, transactions, tax_notices, tax_brackets, accounting_snapshots, vehicle_catalog, vehicle_orders, settings

## Credentials
- Admin: l.bennett@eyefinds.gouvernement.info / password
- Patron concessionnaire: patron.test@lsc.rp / password
- Patron standard: john@mechanic.rp / password
