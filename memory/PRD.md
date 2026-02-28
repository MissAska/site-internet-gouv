# GTA RP - Portail Fiscal Eyefind

## Problem Statement
Site web fonctionnel pour GTA RP avec système de login JWT, caisses enregistreuses, gestion d'entreprises créables par admin gouvernement, comptabilité (CA, dépenses, salaires), et génération automatique d'avis d'impôts hebdomadaires le dimanche à 23h59.

## Architecture
- **Backend**: FastAPI + MongoDB
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Auth**: JWT avec bcrypt
- **Style**: Thème sombre Eyefind GTA

## User Personas & Roles
1. **Admin Gouvernement** - Crée entreprises, génère avis d'impôts, configure tranches fiscales
2. **Patron** - Gère son entreprise, employés, transactions, voit comptabilité
3. **Employé** - Accès caisse enregistreuse uniquement

## Core Requirements (Static)
- [x] Authentification JWT
- [x] Hiérarchie de rôles (Admin > Patron > Employé)
- [x] Création d'entreprises avec compte patron automatique
- [x] Caisse enregistreuse (revenus, dépenses, salaires)
- [x] Comptabilité avec graphiques
- [x] Génération avis d'impôts
- [x] Tranches d'imposition configurables
- [x] Minimum 5000$ d'impôts même en cas de bénéfice négatif

## What's Been Implemented (28/02/2026)
- Système complet d'authentification JWT
- Dashboard Admin avec statistiques globales
- CRUD Entreprises avec création automatique compte patron
- CRUD Employés par entreprise
- Caisse enregistreuse fonctionnelle
- Page comptabilité avec graphiques Recharts
- Génération et historique des avis d'impôts
- Configuration des tranches fiscales
- Thème Eyefind GTA (sombre, cyber-corporate)
- Interface entièrement en français

## Backlog
### P0 - Critical
- (Complété)

### P1 - High Priority
- Génération automatique dimanche 23h59 (scheduler)
- Export PDF des avis d'impôts

### P2 - Medium
- Historique des modifications comptables
- Notifications par email

## Next Tasks
1. Implémenter APScheduler pour génération auto dimanche 23h59
2. Ajouter export PDF des avis d'impôts
3. Dashboard patron amélioré avec plus de KPIs
