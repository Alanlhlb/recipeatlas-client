# RecipeAtlas Client

RecipeAtlas Client is the React TypeScript single-page application for the 6003CEM RecipeAtlas coursework. It consumes the separate RecipeAtlas REST API repository.

## Features

- Public local recipe browsing, title search, and recipe detail pages
- Catalogue filtering by category, difficulty and maximum cooking time, with sorting in either direction
- Conditional requests: the client replays the API's `ETag` as `If-None-Match` and serves `304 Not Modified` responses from memory
- TheMealDB external recipe search
- User registration, login, persistent JWT session, and logout
- Personal recipe favourites: save, view, and remove
- Authenticated recipe-related contact message form
- Administrator-only recipe create, update, and delete workflows
- Administrator message inbox
- Responsive layout, loading states, empty states, form validation, and API error feedback

## Technology

- React
- TypeScript
- Vite
- React Router
- Browser Fetch API

## Setup

### Prerequisites

- Node.js 22 or newer
- The RecipeAtlas backend running locally

### Install dependencies

```bash
npm install
```

### Configure the API URL

Copy `.env.example` to `.env`.

```bash
cp .env.example .env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Default configuration:

```env
VITE_API_BASE_URL=http://localhost:3000
```

The backend `.env` should allow this Vite origin:

```env
FRONTEND_ORIGIN=http://localhost:5173
```

### Start the frontend

```bash
npm run dev
```

Open the URL printed by Vite, normally:

```text
http://localhost:5173
```

### Production build

```bash
npm run build
npm run preview
```

## User journeys

### Public visitor

1. Browse the recipe catalogue.
2. Search local recipe titles.
3. Open a recipe detail page.
4. Search read-only external results from TheMealDB.

### Registered user

1. Register or log in.
2. Save a local recipe to favorites.
3. View and remove recipes from the Favorites page.
4. Send a message about a specific recipe to the administrators.

### Administrator

1. Log in using the administrator account seeded in the backend.
2. Open the Admin page.
3. Create, edit, or delete local recipes.
4. Review user messages in the administrator inbox.

## Backend integration

The frontend calls these main backend endpoint groups:

```text
/api/auth
/api/recipes
/api/external-recipes
/api/favorites
/api/messages
/api/admin/recipes
```

JWTs are stored in browser local storage and sent as a Bearer token only for protected requests. The UI uses the current user endpoint to restore a session after refresh.

### Catalogue query string

`src/api.ts` builds the query string for `GET /api/recipes` from the controls in the catalogue. Blank controls are omitted so the backend applies its own defaults.

```text
q          partial, case-insensitive title search
category   exact, case-insensitive category match
difficulty easy | medium | hard
maxTime    upper bound on cooking time, in minutes
sort       title | category | cookingTime | servings | difficulty | createdAt | updatedAt
order      asc | desc
```

### Conditional requests

`src/api.ts` keeps the entity tag the API returns with every GET response and replays it as `If-None-Match` on the next identical call. When the API answers `304 Not Modified` the previously stored body is returned, so an unchanged catalogue costs no bandwidth. Any successful write clears the cache, because it may have invalidated a cached read. Entries are keyed by both URL and caller, so an administrator's response is never reused for an anonymous visitor.

### Hypermedia links

Recipe and catalogue responses include a `_links` object describing the actions available to the current caller. The backend omits links the caller is not entitled to use, so the set of relations differs between anonymous visitors, registered users and administrators. The shared types in `src/types.ts` describe this structure.

## Code documentation

Every component, hook, helper function and shared type carries JSDoc comments describing its purpose, parameters, return value and the API endpoints it touches. The comments follow the standard JSDoc tag convention (`@param`, `@returns`), so editors surface them on hover and a documentation generator such as TypeDoc can consume them directly:

```bash
npx typedoc --entryPointStrategy expand src
```

## Coursework repository requirement

This is the **frontend** repository. The backend API is intentionally maintained separately to meet the coursework requirement for two GitHub repositories.

Backend repository:

```text
https://github.com/Alanlhlb/recipeatlas-api
```
