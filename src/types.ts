export type UserRole = 'user' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id?: number;
  recipeId?: number;
  name: string;
  quantity: string | null;
}

export interface Recipe {
  id: number;
  title: string;
  instructions: string;
  category: string | null;
  imageUrl: string | null;
  cookingTime: number | null;
  servings: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  ingredients: Ingredient[];
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  title: string;
  instructions: string;
  category?: string;
  imageUrl?: string;
  cookingTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  ingredients: Array<{ name: string; quantity?: string }>;
}

export interface ExternalRecipe {
  source: 'TheMealDB';
  sourceId: string;
  title: string;
  category: string | null;
  imageUrl: string | null;
  instructions: string;
  ingredients: Ingredient[];
}

export interface ContactMessage {
  id: number;
  userId: number;
  recipeId: number;
  subject: string;
  body: string;
  createdAt: string;
  userName?: string;
  userEmail?: string;
  recipeTitle?: string;
}
