import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import './styles.css';

/**
 * Client entry point for RecipeAtlas.
 *
 * Mounts the React application into the `#root` element, wrapping it in
 * `StrictMode`, `BrowserRouter` for client-side routing and {@link AuthProvider}
 * so every route can read the current session.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
