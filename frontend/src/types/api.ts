export type MovieEngagementState = {
  stars: number | null
  favorited: boolean
  not_interested: boolean
}

export type Movie = {
  id: number
  title: string
  slug: string
  director: string
  summary: string
  backdrop_path: string
  poster_path: string
  release_date: string | null
  popularity_score: number
  genres: string[]
  created_at?: string
  cast?: string[]
  tmdb_id?: number | null
}

export type ScoredMovie = {
  movie: Movie
  final_score: number
  content_score: number
  collab_score: number
  popularity_score: number
  mistral_score: number
}

export type FeedResponse = {
  mode: string
  cold_start: boolean
  /** Total ratings for this user; drives cold vs personalized UX. */
  rating_count: number
  for_you: ScoredMovie[]
  because_you_liked: ScoredMovie[]
  users_like_you: ScoredMovie[]
  hidden_gems: ScoredMovie[]
  expand_your_horizons: ScoredMovie[]
}

export type ExplainResponse = {
  movie: Movie & { cast: string[] }
  why_recommended: string
  algorithm_attribution: {
    content_pct: number
    collab_pct: number
    pop_pct: number
    mistral_pct: number
  }
}

export type ProfileResponse = {
  email: string
  rating_count: number
  genre_map: Record<string, number>
  taste_evolution: { at: string; summary: string; genre_scores: Record<string, number> }[]
  nl_preferences: Record<string, unknown>
}
