import { Heart, ThumbsDown } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import * as api from '@/api/client'
import { AttributionBar } from '@/components/AttributionBar'
import { StarRating } from '@/components/StarRating'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import type { ExplainResponse, Movie, MovieEngagementState } from '@/types/api'

export function MovieDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const { token } = useAuth()
  const [movie, setMovie] = useState<(Movie & { cast?: string[] }) | null>(null)
  const [explain, setExplain] = useState<ExplainResponse | null>(null)
  const [stars, setStars] = useState(0)
  const [busy, setBusy] = useState(false)
  const [eng, setEng] = useState<MovieEngagementState | null>(null)
  const [engBusy, setEngBusy] = useState(false)

  const loadEngagement = useCallback(async () => {
    if (!slug || !token) {
      setEng(null)
      return
    }
    try {
      const e = await api.fetchMovieEngagementState(slug)
      setEng(e)
      if (e.stars != null) setStars(e.stars)
    } catch {
      setEng(null)
    }
  }, [slug, token])

  useEffect(() => {
    if (!slug) return
    let c = false
    ;(async () => {
      const m = await api.fetchMovie(slug)
      if (!c) setMovie(m)
      if (token) {
        try {
          const ex = await api.fetchMovieExplain(slug)
          if (!c) setExplain(ex)
        } catch {
          if (!c) setExplain(null)
        }
        await loadEngagement()
      } else {
        if (!c) {
          setExplain(null)
          setEng(null)
        }
      }
    })()
    return () => {
      c = true
    }
  }, [slug, token, loadEngagement])

  async function saveRating(v: number) {
    if (!slug || !token) return
    setBusy(true)
    setStars(v)
    try {
      await api.submitRating(slug, v)
      const ex = await api.fetchMovieExplain(slug)
      setExplain(ex)
      await loadEngagement()
    } finally {
      setBusy(false)
    }
  }

  async function toggleFavorite() {
    if (!slug || !token || engBusy) return
    setEngBusy(true)
    try {
      if (eng?.favorited) await api.removeFavorite(slug)
      else await api.addFavorite(slug)
      await loadEngagement()
    } finally {
      setEngBusy(false)
    }
  }

  async function toggleNotInterested() {
    if (!slug || !token || engBusy) return
    setEngBusy(true)
    try {
      if (eng?.not_interested) await api.removeNotInterested(slug)
      else await api.addNotInterested(slug)
      await loadEngagement()
    } finally {
      setEngBusy(false)
    }
  }

  if (!movie) {
    return (
      <div className="page-gutter mx-auto flex min-h-[40vh] max-w-7xl flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <div className="h-8 w-8 animate-pulse rounded-full border-2 border-primary border-t-transparent" aria-hidden />
        <p className="mt-4 text-sm">Loading…</p>
      </div>
    )
  }

  const bg = movie.backdrop_path || movie.poster_path
  const attribution = explain?.algorithm_attribution

  return (
    <div>
      <div className="relative h-[38vh] min-h-[240px] w-full overflow-hidden sm:h-[42vh] sm:min-h-[280px] md:h-[55vh]">
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover object-[center_20%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-black/45" />
      </div>

      <div className="page-gutter relative z-10 mx-auto max-w-7xl pb-28 pt-5 sm:pb-24 sm:pt-6 md:-mt-20 md:pt-0 lg:-mt-24">
        <div className="grid gap-6 sm:gap-8 md:grid-cols-[minmax(0,220px)_1fr] md:gap-10">
          <img
            src={movie.poster_path}
            alt={movie.title}
            className="mx-auto w-full max-w-[200px] rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10 sm:max-w-[220px] md:mx-0 md:max-w-none"
          />
          <div className="min-w-0 space-y-5 sm:space-y-6">
            <div>
              <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl md:text-5xl">{movie.title}</h1>
              <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                Directed by {movie.director}
                {movie.release_date ? ` · ${movie.release_date}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {movie.genres.map((g) => (
                  <span key={g} className="rounded-full bg-white/10 px-3 py-1 text-[11px] ring-1 ring-white/10 sm:text-xs">
                    {g}
                  </span>
                ))}
              </div>
            </div>

            <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{movie.summary}</p>

            {movie.cast && movie.cast.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cast</h3>
                <p className="mt-2 text-sm">{movie.cast.join(', ')}</p>
              </div>
            )}

            <div className="glass max-w-xl space-y-5 rounded-2xl p-4 shadow-lg sm:p-6">
              <div>
                <h3 className="text-base font-semibold sm:text-lg">Your rating</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Stars, favorites, and &quot;not interested&quot; update your profile immediately for the next feed
                  load.
                </p>
                <div className="mt-4">
                  {token ? (
                    <StarRating value={stars} onChange={saveRating} disabled={busy} />
                  ) : (
                    <Button asChild variant="secondary">
                      <Link to="/login" state={{ from: location.pathname }}>
                        Sign in to rate
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
              {token && (
                <div className="border-t border-white/10 pt-4">
                  <h3 className="text-sm font-semibold sm:text-base">Taste signals</h3>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Favorite boosts similarity seeds; not interested removes the title from recommendations and
                    discovery picks.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={eng?.favorited ? 'default' : 'secondary'}
                      size="sm"
                      className="gap-2"
                      disabled={engBusy}
                      onClick={() => void toggleFavorite()}
                    >
                      <Heart className={`h-4 w-4 ${eng?.favorited ? 'fill-current' : ''}`} aria-hidden />
                      {eng?.favorited ? 'Favorited' : 'Add to favorites'}
                    </Button>
                    <Button
                      type="button"
                      variant={eng?.not_interested ? 'outline' : 'secondary'}
                      size="sm"
                      className={`gap-2 ${eng?.not_interested ? 'border-red-500/50 text-red-200 hover:bg-red-950/40' : ''}`}
                      disabled={engBusy}
                      onClick={() => void toggleNotInterested()}
                    >
                      <ThumbsDown className="h-4 w-4" aria-hidden />
                      {eng?.not_interested ? 'Not interested (undo)' : 'Not interested'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {explain && (
              <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent shadow-xl ring-1 ring-primary/20">
                <CardHeader className="p-4 sm:p-6 sm:pb-2">
                  <CardTitle className="text-base sm:text-lg">Why recommended</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
                  <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{explain.why_recommended}</p>
                  {attribution && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Algorithm mix</p>
                      <AttributionBar
                        content={attribution.content_pct}
                        collab={attribution.collab_pct}
                        pop={attribution.pop_pct}
                        mistral={attribution.mistral_pct}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
