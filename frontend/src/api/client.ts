import axios from 'axios'
import type {
  ExplainResponse,
  FavoriteRow,
  FeedResponse,
  Movie,
  MovieEngagementState,
  NotInterestedRow,
  Paginated,
  ProfileResponse,
  RatingRow,
} from '@/types/api'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Token ${token}`
    localStorage.setItem('token', token)
  } else {
    delete api.defaults.headers.common.Authorization
    localStorage.removeItem('token')
  }
}

export function loadStoredToken() {
  const t = localStorage.getItem('token')
  if (t) setAuthToken(t)
}

export async function register(email: string, password: string) {
  const { data } = await api.post<{ token: string; email: string }>('/auth/register/', { email, password })
  setAuthToken(data.token)
  return data
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ token: string }>('/auth/login/', { username: email, password })
  setAuthToken(data.token)
  return data
}

export async function fetchFeed() {
  const { data } = await api.get<FeedResponse>('/feed/', { timeout: 180_000 })
  return data
}

export async function fetchMovie(slug: string) {
  const { data } = await api.get<Movie & { cast: string[] }>(`/catalog/movies/${slug}/`)
  return data
}

export async function fetchMovieExplain(slug: string) {
  const { data } = await api.get<ExplainResponse>(`/movies/${slug}/explain/`)
  return data
}

export async function submitRating(movieSlug: string, stars: number) {
  const { data } = await api.post('/engagement/ratings/', { movie_slug: movieSlug, stars })
  return data
}

export async function fetchMovieEngagementState(slug: string) {
  const { data } = await api.get<MovieEngagementState>(`/engagement/state/${encodeURIComponent(slug)}/`)
  return data
}

export async function addFavorite(movieSlug: string) {
  await api.post('/engagement/favorites/', { movie_slug: movieSlug })
}

export async function removeFavorite(movieSlug: string) {
  await api.delete(`/engagement/favorites/${encodeURIComponent(movieSlug)}/`)
}

export async function addNotInterested(movieSlug: string) {
  await api.post('/engagement/not-interested/', { movie_slug: movieSlug })
}

export async function removeNotInterested(movieSlug: string) {
  await api.delete(`/engagement/not-interested/${encodeURIComponent(movieSlug)}/`)
}

export async function fetchFavoritesPage(page = 1) {
  const { data } = await api.get<Paginated<FavoriteRow>>(`/engagement/favorites/?page=${page}`)
  return data
}

export async function fetchNotInterestedPage(page = 1) {
  const { data } = await api.get<Paginated<NotInterestedRow>>(`/engagement/not-interested/?page=${page}`)
  return data
}

export async function fetchRatingsPage(page = 1, stars?: number) {
  const params = new URLSearchParams({ page: String(page) })
  if (stars != null) params.set('stars', String(stars))
  const { data } = await api.get<Paginated<RatingRow>>(`/engagement/ratings/?${params.toString()}`)
  return data
}

export async function trackInteraction(movieId: number, event_type: 'impression' | 'click') {
  await api.post('/engagement/interactions/', { movie: movieId, event_type })
}

export async function fetchProfile() {
  const { data } = await api.get<ProfileResponse>('/profile/me/')
  return data
}

export async function fetchAbMetrics() {
  const { data } = await api.get<{
    variants: {
      variant: string
      impressions: number
      clicks: number
      ctr_percent: number
      engagement_score: number
    }[]
  }>('/admin/ab-metrics/')
  return data
}

export async function nlPreferences(text: string) {
  const { data } = await api.post('/preferences/nl/', { text })
  return data as { preferences: Record<string, unknown> }
}

export type DiscoveryChatResponse = {
  done?: boolean
  message?: string
  summary?: string
  suggested_genres?: string[]
  avoid?: string[]
  suggestions?: Movie[]
}

export async function discoveryChat(messages: { role: string; content: string }[]) {
  const { data } = await api.post<DiscoveryChatResponse>('/chat/discovery/', {
    messages,
  })
  return data
}

export async function listMovies(page = 1) {
  const { data } = await api.get<{ results?: Movie[] }>(`/catalog/movies/?page=${page}`, { timeout: 60_000 })
  return Array.isArray(data.results) ? data.results : []
}
