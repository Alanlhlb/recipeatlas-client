# RecipeAtlas Client

RecipeAtlas Client is the React TypeScript single-page application for the 6003CEM RecipeAtlas coursework. It consumes the separate RecipeAtlas REST API repository.

## Features

- Public local recipe browsing, title search, and recipe detail pages
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

## Coursework repository requirement

This is the **frontend** repository. The backend API is intentionally maintained separately to meet the coursework requirement for two GitHub repositories.

Backend repository:

```text
https://github.com/Alanlhlb/recipeatlas-api
```
