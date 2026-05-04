import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import * as api from '@/api/client'
import { AttributionBar } from '@/components/AttributionBar'
import { StarRating } from '@/components/StarRating'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import type { ExplainResponse, Movie } from '@/types/api'

export function MovieDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const location = useLocation()
  const { token } = useAuth()
  const [movie, setMovie] = useState<(Movie & { cast?: string[] }) | null>(null)
  const [explain, setExplain] = useState<ExplainResponse | null>(null)
  const [stars, setStars] = useState(0)
  const [busy, setBusy] = useState(false)

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
      }
    })()
    return () => {
      c = true
    }
  }, [slug, token])

  async function saveRating(v: number) {
    if (!slug || !token) return
    setBusy(true)
    setStars(v)
    try {
      await api.submitRating(slug, v)
      const ex = await api.fetchMovieExplain(slug)
      setExplain(ex)
    } finally {
      setBusy(false)
    }
  }

  if (!movie) {
    return <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground">Loading…</div>
  }

  const bg = movie.backdrop_path || movie.poster_path
  const attribution = explain?.algorithm_attribution

  return (
    <div>
      <div className="relative h-[42vh] min-h-[280px] w-full overflow-hidden md:h-[55vh]">
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-black/40" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-6 md:-mt-24 md:pt-0">
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <img
            src={movie.poster_path}
            alt={movie.title}
            className="mx-auto w-full max-w-[220px] rounded-xl shadow-2xl ring-1 ring-white/10 md:mx-0"
          />
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold md:text-5xl">{movie.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Directed by {movie.director}
                {movie.release_date ? ` · ${movie.release_date}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {movie.genres.map((g) => (
                  <span key={g} className="rounded-full bg-white/10 px-3 py-1 text-xs ring-1 ring-white/10">
                    {g}
                  </span>
                ))}
              </div>
            </div>

            <p className="max-w-3xl leading-relaxed text-muted-foreground">{movie.summary}</p>

            {movie.cast && movie.cast.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Cast</h3>
                <p className="mt-2 text-sm">{movie.cast.join(', ')}</p>
              </div>
            )}

            <div className="glass max-w-xl rounded-xl p-6">
              <h3 className="font-semibold">Your rating</h3>
              <p className="mt-1 text-sm text-muted-foreground">Cold-start users: add 3 ratings to unlock full hybrid blending.</p>
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

            {explain && (
              <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
                <CardHeader>
                  <CardTitle>Why recommended</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="leading-relaxed text-muted-foreground">{explain.why_recommended}</p>
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
