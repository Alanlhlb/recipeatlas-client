import type {
  ContactMessage,
  ExternalRecipe,
  Recipe,
  RecipeInput,
  RecipeQuery,
  User,
} from './types';

/** Base URL of the backend API, configurable through `VITE_API_BASE_URL`. */
const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/** Standard success envelope used by every endpoint. */
interface ApiEnvelope<T> {
  /** Always `success` for a 2xx response. */
  status: 'success';
  /** The resource payload. */
  data: T;
}

/**
 * An error carrying the HTTP status returned by the API.
 *
 * A status of `0` means the request never reached the server, which lets the UI
 * distinguish a network failure from a rejected request.
 */
export class ApiError extends Error {
  /**
   * @param message - Human-readable description shown to the user.
   * @param status - HTTP status code, or `0` for a network failure.
   */
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Cached representations keyed by caller and URL.
 *
 * Each entry stores the entity tag the API returned alongside the body, so a
 * later `304 Not Modified` can be answered from memory without re-downloading.
 */
interface CacheEntry {
  /** Entity tag supplied by the API for this representation. */
  etag: string;
  /** The parsed response body that the entity tag belongs to. */
  body: unknown;
}

const responseCache = new Map<string, CacheEntry>();

/**
 * Serialises catalogue query options into a URL query string.
 *
 * Blank values are omitted entirely so the backend falls back to its defaults.
 *
 * @param query - Filter and sorting options chosen in the interface.
 * @returns A query string beginning with `?`, or an empty string when nothing is set.
 */
function buildRecipeQuery(query: RecipeQuery): string {
  const parameters = new URLSearchParams();

  if (query.q) parameters.set('q', query.q);
  if (query.category) parameters.set('category', query.category);
  if (query.difficulty) parameters.set('difficulty', query.difficulty);
  if (query.maxTime) parameters.set('maxTime', query.maxTime);
  if (query.sort) parameters.set('sort', query.sort);
  if (query.order) parameters.set('order', query.order);

  const serialised = parameters.toString();

  return serialised ? `?${serialised}` : '';
}

/**
 * Performs an API request with authentication, timeout handling and conditional
 * request support.
 *
 * GET requests remember the entity tag returned by the API and replay it as
 * `If-None-Match` on the next identical call. When the API answers `304 Not
 * Modified` the cached body is returned, so unchanged data costs no bandwidth.
 * Any write request clears the cache because it may have invalidated a read.
 *
 * @typeParam T - Expected shape of the response envelope.
 * @param path - API path beginning with a slash, for example `/api/recipes`.
 * @param options - Standard fetch options; `method` defaults to `GET`.
 * @param token - Optional JWT sent as a Bearer token.
 * @returns The parsed response envelope.
 * @throws {ApiError} status 0 for a network failure, or the API's status and message.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isRead = method === 'GET';
  const url = `${baseUrl}${path}`;
  const cacheKey = `${token ?? 'anonymous'}:${url}`;

  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (isRead) {
    const cached = responseCache.get(cacheKey);

    if (cached) {
      headers.set('If-None-Match', cached.etag);
    }
  }

  let response: Response;

  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError('Unable to reach the API. Check that the backend is running.', 0);
  }

  if (response.status === 304) {
    const cached = responseCache.get(cacheKey);

    if (cached) {
      return cached.body as T;
    }

    throw new ApiError('The cached response is no longer available.', 304);
  }

  if (response.status === 204) {
    responseCache.delete(cacheKey);
    return undefined as T;
  }

  const body = await response.json().catch(() => null) as { message?: string } | null;

  if (!response.ok) {
    throw new ApiError(body?.message || 'The request could not be completed.', response.status);
  }

  if (isRead) {
    const entityTag = response.headers.get('ETag');

    if (entityTag) {
      responseCache.set(cacheKey, { etag: entityTag, body });
    }
  } else {
    // A successful write may have changed any previously cached read.
    responseCache.clear();
  }

  return body as T;
}

/**
 * Typed wrapper around the RecipeAtlas REST API.
 *
 * Every method returns the parsed response envelope, so callers read the payload
 * from `result.data`. Methods that change data take the JWT explicitly rather than
 * reading it from storage, which keeps the module free of React dependencies.
 */
export const api = {
  /**
   * Reads the public recipe catalogue.
   *
   * @param query - Optional title search, filters and sorting.
   * @returns The matching recipes plus the total count.
   */
  getRecipes: (query: RecipeQuery = {}) =>
    request<ApiEnvelope<{ count: number; recipes: Recipe[] }>>(`/api/recipes${buildRecipeQuery(query)}`),

  /**
   * Reads a single recipe with its ingredients.
   *
   * @param id - Identifier of the recipe.
   * @returns The requested recipe.
   */
  getRecipe: (id: number) => request<ApiEnvelope<{ recipe: Recipe }>>(`/api/recipes/${id}`),

  /**
   * Searches the external TheMealDB catalogue through the backend.
   *
   * @param query - Recipe title to search for.
   * @returns Read-only external recipes.
   */
  searchExternal: (query: string) =>
    request<ApiEnvelope<{ recipes: ExternalRecipe[] }>>(`/api/external-recipes?q=${encodeURIComponent(query)}`),

  /**
   * Creates a standard user account.
   *
   * @param input - Name, email and password for the new account.
   * @returns The created user.
   */
  register: (input: { name: string; email: string; password: string }) =>
    request<ApiEnvelope<{ user: User }>>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /**
   * Exchanges credentials for a JWT access token.
   *
   * @param input - Email and password.
   * @returns The access token and the authenticated user.
   */
  login: (input: { email: string; password: string }) =>
    request<ApiEnvelope<{ token: string; user: User }>>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /**
   * Validates a stored token and returns the account it belongs to.
   *
   * @param token - JWT previously issued by the login endpoint.
   * @returns The current user.
   */
  currentUser: (token: string) => request<ApiEnvelope<{ user: User }>>('/api/auth/me', {}, token),

  /**
   * Lists the recipes saved by the authenticated user.
   *
   * @param token - JWT of the signed-in user.
   * @returns The user's favourite recipes.
   */
  getFavorites: (token: string) => request<ApiEnvelope<{ recipes: Recipe[] }>>('/api/favorites', {}, token),

  /**
   * Saves a recipe to the authenticated user's collection.
   *
   * @param recipeId - Identifier of the recipe to save.
   * @param token - JWT of the signed-in user.
   * @throws {ApiError} 409 when the recipe is already saved.
   */
  addFavorite: (recipeId: number, token: string) =>
    request('/api/favorites/' + recipeId, { method: 'POST' }, token),

  /**
   * Removes a recipe from the authenticated user's collection.
   *
   * @param recipeId - Identifier of the recipe to remove.
   * @param token - JWT of the signed-in user.
   */
  removeFavorite: (recipeId: number, token: string) =>
    request('/api/favorites/' + recipeId, { method: 'DELETE' }, token),

  /**
   * Sends a question about a recipe to the platform administrators.
   *
   * @param input - Related recipe, subject and message body.
   * @param token - JWT of the signed-in user.
   * @returns The stored message.
   */
  createMessage: (input: { recipeId: number; subject: string; body: string }, token: string) =>
    request<ApiEnvelope<{ message: ContactMessage }>>('/api/messages', {
      method: 'POST',
      body: JSON.stringify(input),
    }, token),

  /**
   * Reads the administrator inbox.
   *
   * @param token - JWT of an administrator.
   * @returns Every message with its author and related recipe.
   */
  getMessages: (token: string) =>
    request<ApiEnvelope<{ messages: ContactMessage[] }>>('/api/messages', {}, token),

  /**
   * Creates a recipe.
   *
   * @param input - The recipe to store.
   * @param token - JWT of an administrator.
   * @returns The created recipe.
   */
  createRecipe: (input: RecipeInput, token: string) =>
    request<ApiEnvelope<{ recipe: Recipe }>>('/api/admin/recipes', {
      method: 'POST',
      body: JSON.stringify(input),
    }, token),

  /**
   * Replaces a recipe and its ingredients.
   *
   * @param id - Identifier of the recipe to replace.
   * @param input - The replacement values.
   * @param token - JWT of an administrator.
   * @returns The updated recipe.
   */
  updateRecipe: (id: number, input: RecipeInput, token: string) =>
    request<ApiEnvelope<{ recipe: Recipe }>>(`/api/admin/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }, token),

  /**
   * Deletes a recipe and its ingredients.
   *
   * @param id - Identifier of the recipe to delete.
   * @param token - JWT of an administrator.
   */
  deleteRecipe: (id: number, token: string) =>
    request(`/api/admin/recipes/${id}`, { method: 'DELETE' }, token),
};
