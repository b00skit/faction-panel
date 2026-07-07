# Project Gemini Context: Antelope (Faction Panel)

Antelope is high-performance management suite for factions and organizations. Replace spreadsheets with unified relational data system.

## Project Overview

- **Purpose:** Management suite for GTA:W roleplay communities (generic enough for any org).
- **Backend:** Laravel 13 (PHP 8.3+), PostgreSQL (Prod) / SQLite (Dev), Sanctum Auth.
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4.0.
- **Architecture:** 
    - RESTful API (Laravel) + SPA (React).
    - Resource-based permissions (RBAC) at faction and individual module levels.
    - Extensive JSON-based dynamic data (Roster columns, layouts).
    - GTA:W OAuth and API integration for roster sync.

## Commands

### Backend (`/backend`)

```bash
# Setup
composer run setup

# Dev server + queue + logs + vite
composer run dev

# Tests (Pest)
php artisan test

# Code Style (Pint)
vendor/bin/pint

# Migrations
php artisan migrate
```

### Frontend (`/frontend`)

```bash
# Dev server (:3000)
npm run dev

# Production build
npm run build

# Type check
npm run lint

# Clean dist
npm run clean
```

### Windows Local Dev

```bat
batch\start.bat # Start backend and frontend in separate windows
```

## Development Conventions

- **Type Safety:** Mandatory. `npm run lint` must pass in frontend.
- **Testing:** Mandatory. `php artisan test` must pass in backend.
- **Backend Style:** Thin controllers, logic in models or services (`app/Services`).
- **Frontend Style:** Component-per-page/feature in `src/components`. Prop-drilling for faction context. No heavy global state (Context API/TanStack Query preferred).
- **Auditing:** Models should use `Auditable` trait for automatic activity logging.
- **API:** Use `api.ts` (Axios) for all requests. Token stored in `localStorage` as `access_token`.
- **Loading State Indicator:** React pages must use the standard `<Loading />` component (`frontend/src/components/Loading.tsx`) to show loading states instead of custom spinners, keeping UI loading progress bars consistent across the app. Pass `fullScreen={false}` if rendering inline within a container rather than filling the entire layout.

## Key Files & Directories

- `backend/app/Models/`: Eloquent models (Auditable, SoftDeletes).
- `backend/app/Http/Controllers/`: API endpoints logic.
- `backend/routes/api.php`: API route definitions.
- `frontend/src/App.tsx`: Router and global auth/faction state.
- `frontend/src/api.ts`: API client configuration.
- `frontend/src/types.ts`: Shared TypeScript interfaces.
- `frontend/src/components/`: UI components and feature pages.
- `CLAUDE.md`: Tool-specific guidance and command references.
- `BLUEPRINT.md`: Initial architectural plan.
