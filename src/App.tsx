import { FormEvent, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { ApiError, api } from './api';
import { useAuth } from './auth';
import type { ContactMessage, ExternalRecipe, Recipe, RecipeInput, RecipeQuery } from './types';

/**
 * Normalises a caught value into a message that is safe to display.
 *
 * @param error - Value thrown by an API call, usually an {@link ApiError}.
 * @returns The API's message, or a generic fallback for unexpected errors.
 */
function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
}

/**
 * Formats an ISO-8601 timestamp for display in the en-GB locale.
 *
 * @param value - ISO-8601 date-time string supplied by the API.
 * @returns A medium date and short time string, for example `27 Sept 2026, 14:05`.
 */
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

/** Renders the shared `Loading…` placeholder shown while a request is in flight. */
function Loading() {
  return <p className="status">Loading…</p>;
}

/**
 * Renders an error or status message as an alert.
 *
 * @param props - Component props.
 * @param props.message - Text announced to assistive technology and shown to the user.
 */
function Notice({ message }: { message: string }) {
  return <p className="notice" role="alert">{message}</p>;
}

/**
 * Application shell that renders the site header, account controls and routed
 * page content.
 *
 * Owns the top-level route table, so every page in the application is nested
 * beneath it. Navigation is withheld until the stored session has finished
 * restoring.
 */
function AppLayout() {
  const { user, logout, ready } = useAuth();

  if (!ready) return <Loading />;

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/">RecipeAtlas</Link>
        <nav aria-label="Main navigation">
          <NavLink to="/">Recipes</NavLink>
          <NavLink to="/external">Explore external</NavLink>
          {user && <NavLink to="/favorites">My favorites</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        </nav>
        <div className="account-actions">
          {user ? (
            <>
              <span className="user-name">{user.name} ({user.role})</span>
              <button className="text-button" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link className="button small" to="/register">Create account</Link>
            </>
          )}
        </div>
      </header>
      <main className="page-content">
        <Routes>
          <Route path="/" element={<RecipeCatalogue />} />
          <Route path="/recipes/:id" element={<RecipeDetail />} />
          <Route path="/external" element={<ExternalSearch />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/favorites" element={<RequireUser><FavoritesPage /></RequireUser>} />
          <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
          <Route path="/admin/recipes/new" element={<RequireAdmin><RecipeEditor /></RequireAdmin>} />
          <Route path="/admin/recipes/:id/edit" element={<RequireAdmin><RecipeEditor /></RequireAdmin>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

/**
 * Route guard that renders its children only for a signed-in user.
 *
 * Redirects to `/login` when no user is authenticated.
 *
 * @param props - Component props.
 * @param props.children - The route element to protect.
 */
function RequireUser({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

/**
 * Route guard that renders its children only for an administrator.
 *
 * Redirects to the catalogue at `/` when the visitor is signed out or does not
 * hold the `admin` role.
 *
 * @param props - Component props.
 * @param props.children - The route element to protect.
 */
function RequireAdmin({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  return user?.role === 'admin' ? children : <Navigate to="/" replace />;
}

/**
 * Public recipe catalogue served at the `/` route.
 *
 * Loads recipes through `api.getRecipes` and lets a visitor search by title,
 * filter by category, difficulty and maximum cooking time, and sort the results.
 * Every change re-queries the API rather than filtering in the browser, and
 * repeat requests reuse the representation the API says is still current.
 */
function RecipeCatalogue() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [maxTime, setMaxTime] = useState('');
  const [sort, setSort] = useState('updatedAt');
  const [order, setOrder] = useState('desc');
  const [categories, setCategories] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activeQuery = useMemo<RecipeQuery>(() => ({
    q: searchTerm || undefined,
    category: category || undefined,
    difficulty: difficulty || undefined,
    maxTime: maxTime || undefined,
    sort,
    order,
  }), [searchTerm, category, difficulty, maxTime, sort, order]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = await api.getRecipes(activeQuery);
        if (cancelled) return;
        setRecipes(result.data.recipes);
        setCount(result.data.count);
        setCategories((current) => {
          const merged = new Set(current);
          result.data.recipes.forEach((recipe) => { if (recipe.category) merged.add(recipe.category); });
          return [...merged].sort((left, right) => left.localeCompare(right));
        });
      } catch (requestError) {
        if (!cancelled) setError(errorMessage(requestError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => { cancelled = true; };
  }, [activeQuery]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSearchTerm(query.trim());
  }

  function clearAll() {
    setQuery('');
    setSearchTerm('');
    setCategory('');
    setDifficulty('');
    setMaxTime('');
    setSort('updatedAt');
    setOrder('desc');
  }

  const narrowed = Boolean(searchTerm || category || difficulty || maxTime);

  return (
    <section>
      <div className="hero">
        <p className="eyebrow">Recipe discovery platform</p>
        <h1>Find a recipe for today</h1>
        <p>Browse the RecipeAtlas catalogue, search a title, or narrow the list with filters.</p>
        <form className="search-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="recipe-search">Search recipe titles</label>
          <input id="recipe-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try pasta, soup or curry" />
          <button type="submit">Search</button>
          {(narrowed || query) && <button className="secondary" type="button" onClick={clearAll}>Clear all</button>}
        </form>
        <div className="filter-bar">
          <label>Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>Difficulty
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
              <option value="">Any difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label>Max time (minutes)
            <input type="number" min="1" value={maxTime} onChange={(event) => setMaxTime(event.target.value)} placeholder="Any" />
          </label>
          <label>Sort by
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="updatedAt">Recently updated</option>
              <option value="createdAt">Date added</option>
              <option value="title">Title</option>
              <option value="cookingTime">Cooking time</option>
              <option value="servings">Servings</option>
              <option value="difficulty">Difficulty</option>
            </select>
          </label>
          <label>Order
            <select value={order} onChange={(event) => setOrder(event.target.value)}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </label>
        </div>
      </div>
      {error && <Notice message={error} />}
      {loading ? <Loading /> : recipes.length ? (
        <>
          <p className="result-count">{count} {count === 1 ? 'recipe' : 'recipes'} found</p>
          <RecipeGrid recipes={recipes} />
        </>
      ) : <EmptyState title="No recipes found" text="Try a different title, clear the filters, or ask an administrator to add a recipe." />}
    </section>
  );
}

/**
 * Renders a responsive grid of {@link RecipeCard} components.
 *
 * @param props - Component props.
 * @param props.recipes - Recipes returned by the catalogue query.
 */
function RecipeGrid({ recipes }: { recipes: Recipe[] }) {
  return <div className="recipe-grid">{recipes.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}</div>;
}

/**
 * Renders a single recipe summary that links to its detail page.
 *
 * @param props - Component props.
 * @param props.recipe - Recipe to summarise.
 */
function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <article className="recipe-card">
      {recipe.imageUrl ? <img src={recipe.imageUrl} alt="" /> : <div className="recipe-image-placeholder">Recipe</div>}
      <div className="card-body">
        <p className="eyebrow">{recipe.category || 'Recipe'} {recipe.difficulty && `· ${recipe.difficulty}`}</p>
        <h2><Link to={`/recipes/${recipe.id}`}>{recipe.title}</Link></h2>
        <p className="muted">{recipe.cookingTime ? `${recipe.cookingTime} min` : 'Time not specified'} · {recipe.servings ? `${recipe.servings} servings` : 'Servings not specified'}</p>
        <Link className="inline-link" to={`/recipes/${recipe.id}`}>View recipe →</Link>
      </div>
    </article>
  );
}

/**
 * Recipe detail page served at the `/recipes/:id` route.
 *
 * Reads the recipe with `api.getRecipe`. Signed-in users may save it through
 * `api.addFavorite` or send a question to the administrators with
 * `api.createMessage`.
 */
function RecipeDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getRecipe(Number(id))
      .then((result) => setRecipe(result.data.recipe))
      .catch((requestError) => setError(errorMessage(requestError)))
      .finally(() => setLoading(false));
  }, [id]);

  async function saveFavorite() {
    if (!recipe || !token) return;
    setError('');
    try {
      await api.addFavorite(recipe.id, token);
      setNotice('Recipe added to your favorites.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!recipe || !token) return;
    setError('');
    try {
      await api.createMessage({ recipeId: recipe.id, subject, body }, token);
      setSubject('');
      setBody('');
      setNotice('Your message has been sent to the administrators.');
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  if (loading) return <Loading />;
  if (error && !recipe) return <Notice message={error} />;
  if (!recipe) return <NotFound />;

  return (
    <section className="detail-layout">
      <div>
        <Link className="back-link" to="/">← Back to recipes</Link>
        <p className="eyebrow">{recipe.category || 'Recipe'} {recipe.difficulty && `· ${recipe.difficulty}`}</p>
        <h1>{recipe.title}</h1>
        <p className="muted">{recipe.cookingTime ? `${recipe.cookingTime} minutes` : 'Time not specified'} · {recipe.servings ? `${recipe.servings} servings` : 'Servings not specified'}</p>
        {recipe.imageUrl && <img className="detail-image" src={recipe.imageUrl} alt={recipe.title} />}
        {notice && <p className="success">{notice}</p>}
        {error && <Notice message={error} />}
        {user ? <button onClick={() => void saveFavorite()}>Save to favorites</button> : <p className="callout">Want to save this recipe? <Link to="/login">Log in</Link> or <Link to="/register">create an account</Link>.</p>}
        <h2>Ingredients</h2>
        {recipe.ingredients.length ? <ul className="ingredients">{recipe.ingredients.map((ingredient, index) => <li key={`${ingredient.name}-${index}`}>{ingredient.name}{ingredient.quantity ? ` — ${ingredient.quantity}` : ''}</li>)}</ul> : <p className="muted">No ingredients have been listed.</p>}
        <h2>Instructions</h2>
        <p className="instructions">{recipe.instructions}</p>
      </div>
      {user && (
        <aside className="panel contact-panel">
          <h2>Contact an administrator</h2>
          <p className="muted">Ask a question about this recipe.</p>
          <form onSubmit={sendMessage}>
            <label>Subject<input value={subject} minLength={3} required onChange={(event) => setSubject(event.target.value)} /></label>
            <label>Message<textarea value={body} minLength={10} required onChange={(event) => setBody(event.target.value)} rows={6} /></label>
            <button type="submit">Send message</button>
          </form>
        </aside>
      )}
    </section>
  );
}

/**
 * Read-only TheMealDB search page served at the `/external` route.
 *
 * Calls `api.searchExternal` on submit and lists the returned recipes without
 * offering any editing controls.
 */
function ExternalSearch() {
  const [query, setQuery] = useState('');
  const [recipes, setRecipes] = useState<ExternalRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.searchExternal(query);
      setRecipes(result.data.recipes);
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <p className="eyebrow">TheMealDB integration</p>
      <h1>Explore external recipes</h1>
      <p>External results are read-only. Administrators can manually create local recipes when appropriate.</p>
      <form className="search-form" onSubmit={submit}>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search TheMealDB" />
        <button type="submit">Search</button>
      </form>
      {error && <Notice message={error} />}
      {loading ? <Loading /> : recipes.length ? <div className="recipe-grid">{recipes.map((recipe) => <article className="recipe-card" key={recipe.sourceId}>{recipe.imageUrl ? <img src={recipe.imageUrl} alt="" /> : <div className="recipe-image-placeholder">External</div>}<div className="card-body"><p className="eyebrow">TheMealDB · {recipe.category || 'Recipe'}</p><h2>{recipe.title}</h2><p>{recipe.instructions.slice(0, 140)}{recipe.instructions.length > 140 ? '…' : ''}</p></div></article>)}</div> : query && <EmptyState title="No external recipes found" text="Try another recipe title." />}
    </section>
  );
}

/**
 * Combined login and registration form served at `/login` and `/register`.
 *
 * The `mode` prop selects which fields are collected. Submission delegates to
 * `login` or `register` from {@link useAuth} and redirects to the catalogue once
 * the session is established.
 *
 * @param props - Component props.
 * @param props.mode - Whether to render the login or the registration form.
 */
function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      navigate('/');
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-card panel">
      <p className="eyebrow">Account</p>
      <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <form onSubmit={submit}>
        {mode === 'register' && <label>Name<input value={name} minLength={2} required onChange={(event) => setName(event.target.value)} /></label>}
        <label>Email<input value={email} type="email" required onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input value={password} type="password" minLength={8} required onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <Notice message={error} />}
        <button disabled={submitting} type="submit">{submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}</button>
      </form>
      <p className="muted">{mode === 'login' ? <>Need an account? <Link to="/register">Register</Link>.</> : <>Already registered? <Link to="/login">Log in</Link>.</>}</p>
    </section>
  );
}

/**
 * Personal favourites page served at `/favorites` behind {@link RequireUser}.
 *
 * Loads the signed-in user's collection with `api.getFavorites` and removes
 * entries through `api.removeFavorite`.
 */
function FavoritesPage() {
  const { token } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    if (!token) return;
    setLoading(true);
    api.getFavorites(token).then((result) => setRecipes(result.data.recipes)).catch((requestError) => setError(errorMessage(requestError))).finally(() => setLoading(false));
  };

  useEffect(load, [token]);

  async function remove(recipeId: number) {
    if (!token) return;
    try {
      await api.removeFavorite(recipeId, token);
      setRecipes((current) => current.filter((recipe) => recipe.id !== recipeId));
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  return <section><p className="eyebrow">Personal collection</p><h1>My favorites</h1>{error && <Notice message={error} />}{loading ? <Loading /> : recipes.length ? <div className="favorite-list">{recipes.map((recipe) => <div className="favorite-row" key={recipe.id}><Link to={`/recipes/${recipe.id}`}>{recipe.title}</Link><button className="danger small" onClick={() => void remove(recipe.id)}>Remove</button></div>)}</div> : <EmptyState title="No favorites yet" text="Open a recipe and use Save to favorites." />}</section>;
}

/**
 * Administrator dashboard served at `/admin` behind {@link RequireAdmin}.
 *
 * Loads every recipe with `api.getRecipes` and the inbox with `api.getMessages`,
 * and deletes a recipe through `api.deleteRecipe` after a confirmation prompt.
 */
function AdminPage() {
  const { token } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function load() {
    if (!token) return;
    setLoading(true);
    Promise.all([api.getRecipes(), api.getMessages(token)])
      .then(([recipeResult, messageResult]) => { setRecipes(recipeResult.data.recipes); setMessages(messageResult.data.messages); })
      .catch((requestError) => setError(errorMessage(requestError)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [token]);

  async function removeRecipe(recipe: Recipe) {
    if (!token || !window.confirm(`Delete ${recipe.title}? This cannot be undone.`)) return;
    try {
      await api.deleteRecipe(recipe.id, token);
      setRecipes((current) => current.filter((item) => item.id !== recipe.id));
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  return <section><div className="page-heading"><div><p className="eyebrow">Administrator area</p><h1>Manage RecipeAtlas</h1></div><Link className="button" to="/admin/recipes/new">Add recipe</Link></div>{error && <Notice message={error} />}{loading ? <Loading /> : <><h2>Recipes</h2><div className="admin-table">{recipes.map((recipe) => <div className="admin-row" key={recipe.id}><span><strong>{recipe.title}</strong><small>{recipe.category || 'Uncategorised'}</small></span><span className="row-actions"><Link className="button small secondary" to={`/admin/recipes/${recipe.id}/edit`}>Edit</Link><button className="danger small" onClick={() => void removeRecipe(recipe)}>Delete</button></span></div>)}</div><h2>User messages</h2>{messages.length ? <div className="message-list">{messages.map((message) => <article className="message-card" key={message.id}><div><strong>{message.subject}</strong><p className="muted">From {message.userName} ({message.userEmail}) about {message.recipeTitle} · {formatDate(message.createdAt)}</p></div><p>{message.body}</p></article>)}</div> : <EmptyState title="No messages" text="Messages from users will appear here." />}</>}</section>;
}

/**
 * Create and edit form for recipes, served at `/admin/recipes/new` and
 * `/admin/recipes/:id/edit` behind {@link RequireAdmin}.
 *
 * The presence of an `:id` route parameter switches the component into edit
 * mode, loading the existing recipe with `api.getRecipe` and saving through
 * `api.createRecipe` or `api.updateRecipe`.
 */
function RecipeEditor() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cookingTime, setCookingTime] = useState('');
  const [servings, setServings] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [ingredients, setIngredients] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getRecipe(Number(id)).then((result) => {
      const recipe = result.data.recipe;
      setTitle(recipe.title); setInstructions(recipe.instructions); setCategory(recipe.category || ''); setImageUrl(recipe.imageUrl || ''); setCookingTime(recipe.cookingTime?.toString() || ''); setServings(recipe.servings?.toString() || ''); setDifficulty(recipe.difficulty || ''); setIngredients(recipe.ingredients.map((ingredient) => `${ingredient.name}|${ingredient.quantity || ''}`).join('\n'));
    }).catch((requestError) => setError(errorMessage(requestError))).finally(() => setLoading(false));
  }, [id]);

  const parsedIngredients = useMemo(() => ingredients.split('\n').map((line) => {
    const [name, ...quantityParts] = line.split('|');
    return { name: name.trim(), quantity: quantityParts.join('|').trim() };
  }).filter((ingredient) => ingredient.name), [ingredients]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError('');
    const input: RecipeInput = {
      title, instructions, category: category || undefined, imageUrl: imageUrl || undefined,
      cookingTime: cookingTime ? Number(cookingTime) : undefined,
      servings: servings ? Number(servings) : undefined,
      difficulty: difficulty ? difficulty as RecipeInput['difficulty'] : undefined,
      ingredients: parsedIngredients,
    };
    try {
      if (editing && id) await api.updateRecipe(Number(id), input, token);
      else await api.createRecipe(input, token);
      navigate('/admin');
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }

  if (loading) return <Loading />;
  return <section className="editor panel"><Link className="back-link" to="/admin">← Back to administration</Link><h1>{editing ? 'Edit recipe' : 'Add recipe'}</h1><form onSubmit={submit}><label>Title<input value={title} required onChange={(event) => setTitle(event.target.value)} /></label><label>Instructions<textarea rows={7} value={instructions} required onChange={(event) => setInstructions(event.target.value)} /></label><div className="form-grid"><label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} /></label><label>Image URL<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} /></label><label>Cooking time (minutes)<input type="number" min="1" value={cookingTime} onChange={(event) => setCookingTime(event.target.value)} /></label><label>Servings<input type="number" min="1" value={servings} onChange={(event) => setServings(event.target.value)} /></label><label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="">Not specified</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label></div><label>Ingredients<textarea rows={6} value={ingredients} placeholder={'One ingredient per line\nExample: Pasta|200 g'} onChange={(event) => setIngredients(event.target.value)} /></label><p className="muted">Use one ingredient per line. Add an optional quantity after a <code>|</code>.</p>{error && <Notice message={error} />}<button type="submit">{editing ? 'Update recipe' : 'Create recipe'}</button></form></section>;
}

/**
 * Placeholder shown when a list or search returns no results.
 *
 * @param props - Component props.
 * @param props.title - Short heading explaining the empty state.
 * @param props.text - Supporting sentence suggesting what to do next.
 */
function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><h2>{title}</h2><p>{text}</p></div>;
}

/** Fallback page for unmatched routes, rendered by the `*` route. */
function NotFound() {
  return <section className="empty-state"><h1>Page not found</h1><p>The page or recipe you requested does not exist.</p><Link className="button" to="/">Browse recipes</Link></section>;
}

/**
 * Application root component.
 *
 * Renders {@link AppLayout}, which supplies the header, navigation and the
 * route table.
 */
export default function App() {
  return <AppLayout />;
}
