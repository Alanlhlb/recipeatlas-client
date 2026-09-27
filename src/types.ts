/**
 * Shared data contracts for the RecipeAtlas client.
 *
 * These interfaces mirror the JSON representations produced by the backend API
 * so that responses can be consumed without casting.
 */

/** Role assigned to an account by the backend. */
export type UserRole = 'user' | 'admin';

/** An authenticated account as returned by the API. */
export interface User {
  /** Surrogate key of the account. */
  id: number;
  /** Display name shown in the site header. */
  name: string;
  /** Unique email address used to log in. */
  email: string;
  /** Determines which areas of the application are available. */
  role: UserRole;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp of the last account update. */
  updatedAt: string;
}

/** A single measured item belonging to a recipe. */
export interface Ingredient {
  /** Surrogate key; absent for ingredients that have not been persisted yet. */
  id?: number;
  /** Identifier of the owning recipe; absent before the recipe is saved. */
  recipeId?: number;
  /** Display name of the ingredient. */
  name: string;
  /** Free-text amount, for example `200 g`. */
  quantity: string | null;
}

/** A single hypermedia control returned by the API. */
export interface HypermediaLink {
  /** URI of the related resource or operation. */
  href: string;
  /** HTTP method a client should use to follow the link. */
  method: string;
  /** Short description of what following the link does. */
  title: string;
}

/**
 * HATEOAS links attached to a resource.
 *
 * The backend only advertises links the current caller is allowed to use, so the
 * set of keys differs between anonymous visitors, users and administrators.
 */
export type HypermediaLinks = Record<string, HypermediaLink>;

/** A stored recipe together with its ingredient collection. */
export interface Recipe {
  /** Surrogate key of the recipe. */
  id: number;
  /** Recipe name. */
  title: string;
  /** Step-by-step preparation method. */
  instructions: string;
  /** Course or meal type. */
  category: string | null;
  /** Absolute URL of a representative photograph. */
  imageUrl: string | null;
  /** Total preparation time in minutes. */
  cookingTime: number | null;
  /** Number of portions the recipe yields. */
  servings: number | null;
  /** Relative effort required. */
  difficulty: 'easy' | 'medium' | 'hard' | null;
  /** Ordered ingredient collection. */
  ingredients: Ingredient[];
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 timestamp of the last update. */
  updatedAt: string;
  /** Discoverable actions for the current caller, when the API supplied them. */
  _links?: HypermediaLinks;
}

/** The payload accepted when creating or replacing a recipe. */
export interface RecipeInput {
  /** Recipe name; required. */
  title: string;
  /** Preparation method; required. */
  instructions: string;
  /** Course or meal type. */
  category?: string;
  /** Absolute URL of a photograph. */
  imageUrl?: string;
  /** Total preparation time in minutes. */
  cookingTime?: number;
  /** Number of portions. */
  servings?: number;
  /** Relative effort required. */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Ingredient lines; each entry needs at least a name. */
  ingredients: Array<{ name: string; quantity?: string }>;
}

/** Query string options accepted by the public recipe catalogue endpoint. */
export interface RecipeQuery {
  /** Case-insensitive partial match against the title. */
  q?: string;
  /** Exact, case-insensitive category match. */
  category?: string;
  /** One of `easy`, `medium` or `hard`. */
  difficulty?: string;
  /** Upper bound in minutes; omitted when the field is left blank. */
  maxTime?: string;
  /** Field to order by. */
  sort?: string;
  /** Either `asc` or `desc`. */
  order?: string;
}

/** A read-only recipe returned by the external TheMealDB integration. */
export interface ExternalRecipe {
  /** Name of the upstream provider. */
  source: 'TheMealDB';
  /** Provider identifier, used as a stable React key. */
  sourceId: string;
  /** Recipe name. */
  title: string;
  /** Course or meal type reported by the provider. */
  category: string | null;
  /** Absolute URL of a photograph. */
  imageUrl: string | null;
  /** Preparation method. */
  instructions: string;
  /** Ingredient collection. */
  ingredients: Ingredient[];
}

/** A message sent by a user to the platform administrators. */
export interface ContactMessage {
  /** Surrogate key of the message. */
  id: number;
  /** Author of the message. */
  userId: number;
  /** Recipe the message refers to. */
  recipeId: number;
  /** Short subject line. */
  subject: string;
  /** Full message text. */
  body: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** Author display name; only present on the administrator inbox. */
  userName?: string;
  /** Author email address; only present on the administrator inbox. */
  userEmail?: string;
  /** Title of the related recipe; only present on the administrator inbox. */
  recipeTitle?: string;
}
