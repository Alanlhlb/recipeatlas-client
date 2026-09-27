import type { ContactMessage, ExternalRecipe, Recipe, RecipeInput, User } from './types';

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface ApiEnvelope<T> {
  status: 'success';
  data: T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;

  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Unable to reach the API. Check that the backend is running.', 0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json().catch(() => null) as { message?: string } | null;

  if (!response.ok) {
    throw new ApiError(body?.message || 'The request could not be completed.', response.status);
  }

  return body as T;
}

export const api = {
  getRecipes: (query = '') => request<ApiEnvelope<{ recipes: Recipe[] }>>(`/api/recipes${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  getRecipe: (id: number) => request<ApiEnvelope<{ recipe: Recipe }>>(`/api/recipes/${id}`),
  searchExternal: (query: string) => request<ApiEnvelope<{ recipes: ExternalRecipe[] }>>(`/api/external-recipes?q=${encodeURIComponent(query)}`),
  register: (input: { name: string; email: string; password: string }) => request<ApiEnvelope<{ user: User }>>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) => request<ApiEnvelope<{ token: string; user: User }>>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  currentUser: (token: string) => request<ApiEnvelope<{ user: User }>>('/api/auth/me', {}, token),
  getFavorites: (token: string) => request<ApiEnvelope<{ recipes: Recipe[] }>>('/api/favorites', {}, token),
  addFavorite: (recipeId: number, token: string) => request('/api/favorites/' + recipeId, { method: 'POST' }, token),
  removeFavorite: (recipeId: number, token: string) => request('/api/favorites/' + recipeId, { method: 'DELETE' }, token),
  createMessage: (input: { recipeId: number; subject: string; body: string }, token: string) => request<ApiEnvelope<{ message: ContactMessage }>>('/api/messages', { method: 'POST', body: JSON.stringify(input) }, token),
  getMessages: (token: string) => request<ApiEnvelope<{ messages: ContactMessage[] }>>('/api/messages', {}, token),
  createRecipe: (input: RecipeInput, token: string) => request<ApiEnvelope<{ recipe: Recipe }>>('/api/admin/recipes', { method: 'POST', body: JSON.stringify(input) }, token),
  updateRecipe: (id: number, input: RecipeInput, token: string) => request<ApiEnvelope<{ recipe: Recipe }>>(`/api/admin/recipes/${id}`, { method: 'PUT', body: JSON.stringify(input) }, token),
  deleteRecipe: (id: number, token: string) => request(`/api/admin/recipes/${id}`, { method: 'DELETE' }, token),
};
