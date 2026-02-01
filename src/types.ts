export type Photo = {
  data: string;
}

export type Recipe = {
  uid: string;
  name: string;
  ingredients?: string;
  directions?: string;
  description?: string;
  notes?: string;
  nutritional_info?: string;
  prep_time?: string;
  cook_time?: string;
  total_time?: string;
  servings?: string;
  difficulty?: string;
  rating?: number;
  categories?: string[];
  source?: string;
  source_url?: string;
  image_url?: string;
  photo?: string;
  created?: string;
  hash?: string;
  photo_hash?: string;
  photo_large?: string | null;
  photo_data?: string;
  photos?: Photo[];
}

export type RecipesListResponse = {
  recipes: Recipe[];
  count: number;
};