export type Photo = {
  data: string;
}

export class Recipe {
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

  constructor(data: RecipeData) {
    Object.assign(this, data);
    this.uid = data.uid;
    this.name = data.name;
  }

  /** Create a Recipe from a plain object (e.g. JSON.parse output). */
  static from(data: RecipeData): Recipe {
    return new Recipe(data);
  }
}

/** Plain object shape accepted by the Recipe constructor and static factories. */
export type RecipeData = Omit<Recipe, 'from'>;
