export type Drama = {
  id: number;
  title: string;
  original_title: string | null;
  media_type: string;
  year: number | null;
  num_episodes: number | null;
  rating: number | null;
  description: string | null;
  image_url: string | null;
  link: string | null;
  genres: string[];
  tags: string[];
  main_actors: string[];
  umap_x: number | null;
  umap_y: number | null;
  created_at?: string;
  updated_at?: string;
};

/** User's ranked dramas for a catalog (e.g. asian). */
export type UserRankedDrama = {
  id: string;
  user_id: string;
  catalog: string;
  drama_id: number;
  rank: number;
  notes: string | null;
  drama?: Drama;
};

export type Profile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};
