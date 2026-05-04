import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import * as api from '@/api/client'
import { Hero } from '@/components/Hero'
import { MovieCarousel } from '@/components/MovieCarousel'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import type { FeedResponse, Movie } from '@/types/api'

export function HomePage() {
  const { token, ready } = useAuth()
  const location = useLocation()
  const [feed, setFeed] = useState<FeedResponse | null>(null)
  const [browse, setBrowse] = useState<Movie[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    ;(async () => {
      setErr(null)
      if (token) {
        if (!cancelled) setFeed(null)
        try {
          const rows = (await api.listMovies(1)).slice(0, 24)
          if (!cancelled) setBrowse(rows)
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Could not load catalog'
          if (!cancelled) {
            setBrowse([])
            setErr(msg)
          }
          return
        }
        try {
          const f = await api.fetchFeed()
          if (!cancelled) setFeed(f)
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Feed unavailable'
          if (!cancelled) {
            setFeed(null)
            setErr((prev) => (prev ? `${prev} · ${msg}` : msg))
          }
        }
      } else {
        try {
          setFeed(null)
          const m = await api.listMovies(1)
          if (!cancelled) setBrowse(m.slice(0, 24))
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to load'
          if (!cancelled) setErr(msg)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, ready])

  const heroMovie =
    (feed?.for_you?.[0]?.movie as Movie | undefined) ??
    browse[0] ??
    null

  const impression = (movie: Movie) => {
    if (!token) return
    void api.trackInteraction(movie.id, 'impression').catch(() => {})
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-4">
      {!token && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Sign in for your hybrid &quot;For You&quot; feed and AI explanations.</p>
            <p className="text-sm text-muted-foreground">3+ ratings unlock full personalization; until then, explore popular picks.</p>
          </div>
          <Button asChild>
            <Link to="/login" state={{ from: `${location.pathname}${location.search}` }}>
              Sign in
            </Link>
          </Button>
        </div>
      )}

      {err && <p className="mb-4 text-sm text-red-400">{err}</p>}

      <Hero movie={heroMovie} cold={feed?.cold_start} tagline={feed?.cold_start ? 'Rate a few films to unlock your unique blend of signals.' : undefined} />

      {token && feed && (
        <>
          <MovieCarousel
            title="For You"
            subtitle="Hybrid mix: 35% content · 30% collab · 15% popularity · 20% Mistral"
            items={feed.for_you}
            onPick={(m) => {
              impression(m)
              void api.trackInteraction(m.id, 'click')
            }}
          />
          <MovieCarousel
            title="Because you liked a recent favorite"
            items={feed.because_you_liked}
            onPick={(m) => void api.trackInteraction(m.id, 'click')}
          />
          <MovieCarousel
            title="Users like you enjoyed"
            items={feed.users_like_you}
            onPick={(m) => void api.trackInteraction(m.id, 'click')}
          />
          <MovieCarousel
            title="Hidden Gems"
            subtitle="Lower popularity, higher personalization potential"
            items={feed.hidden_gems}
            onPick={(m) => void api.trackInteraction(m.id, 'click')}
          />
          <MovieCarousel
            title="Expand your horizons"
            subtitle="Titles outside your usual genre clusters"
            items={feed.expand_your_horizons}
            onPick={(m) => void api.trackInteraction(m.id, 'click')}
          />
        </>
      )}

      {!token && browse.length > 0 && (
        <MovieCarousel title="Trending now" subtitle="Sign in to personalize" items={browse} scored={false} />
      )}

      {token &&
        browse.length > 0 &&
        (!feed || !feed.for_you?.length) && (
          <MovieCarousel
            title="Popular picks"
            subtitle="Trending catalog titles while your feed loads or if personalization is unavailable"
            items={browse}
            scored={false}
          />
        )}
    </div>
  )
}
