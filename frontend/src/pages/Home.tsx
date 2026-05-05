import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [browseMore, setBrowseMore] = useState<Movie[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [feedFetchFinished, setFeedFetchFinished] = useState(false)
  const homeDataRequestId = useRef(0)

  const deeperCuts = useMemo(() => {
    const merged = [...browse, ...browseMore]
    const byId = new Map<number, Movie>()
    for (const m of merged) byId.set(m.id, m)
    return Array.from(byId.values())
      .sort((a, b) => (a.popularity_score ?? 0) - (b.popularity_score ?? 0))
      .slice(0, 24)
  }, [browse, browseMore])

  useEffect(() => {
    if (!ready) return
    const requestId = ++homeDataRequestId.current
    let cancelled = false
    const isCurrent = () => homeDataRequestId.current === requestId

    ;(async () => {
      setErr(null)
      if (token) {
        if (!cancelled && isCurrent()) {
          setFeedFetchFinished(false)
          setBrowseMore([])
        }
        try {
          const [catalogRes, feedRes] = await Promise.allSettled([api.listMovies(1), api.fetchFeed()])

          if (catalogRes.status === 'fulfilled') {
            if (!cancelled && isCurrent()) setBrowse((catalogRes.value ?? []).slice(0, 24))
          } else {
            const msg = catalogRes.reason instanceof Error ? catalogRes.reason.message : 'Could not load catalog'
            if (!cancelled && isCurrent()) {
              setBrowse([])
              setErr(msg)
            }
          }

          if (feedRes.status === 'fulfilled') {
            if (!cancelled && isCurrent()) setFeed(feedRes.value)
          } else {
            const msg = feedRes.reason instanceof Error ? feedRes.reason.message : 'Feed unavailable'
            if (!cancelled && isCurrent()) setErr((prev) => (prev ? `${prev} - ${msg}` : msg))
          }
        } finally {
          if (isCurrent()) setFeedFetchFinished(true)
        }
      } else {
        if (!cancelled && isCurrent()) setFeedFetchFinished(false)
        try {
          setFeed(null)
          const [p1, p2] = await Promise.all([api.listMovies(1), api.listMovies(2)])
          if (!cancelled && isCurrent()) {
            const first = Array.isArray(p1) ? p1 : []
            const second = Array.isArray(p2) ? p2 : []
            setBrowse(first.slice(0, 24))
            const ids = new Set(first.map((m) => m.id))
            setBrowseMore(second.filter((m) => !ids.has(m.id)))
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to load'
          if (!cancelled && isCurrent()) {
            setBrowse([])
            setBrowseMore([])
            setErr(msg)
          }
        }
        if (isCurrent()) setFeedFetchFinished(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, ready])

  const heroMovie = (feed?.for_you?.[0]?.movie as Movie | undefined) ?? browse[0] ?? null

  const impression = (movie: Movie) => {
    if (!token) return
    void api.trackInteraction(movie.id, 'impression').catch(() => {})
  }

  const showPersonalizedRails = Boolean(token && ready)
  const catalogMissing = Boolean(ready && feedFetchFinished && browse.length === 0)

  const forYouItems = feed?.for_you ?? []
  const becauseItems = feed?.because_you_liked ?? []
  const usersLikeYouItems = feed?.users_like_you ?? []
  const hiddenItems = feed?.hidden_gems ?? []
  const expandItems = feed?.expand_your_horizons ?? []

  const forYouSubtitle = feed?.cold_start
    ? 'Popular catalog picks until you have 3+ ratings; then the full hybrid blend applies.'
    : 'Hybrid mix: 35% content - 30% collab - 15% popularity - 20% Mistral'
  const hiddenSubtitle = feed?.cold_start
    ? 'A second slice from the catalog while we learn your taste.'
    : 'Lower popularity, higher personalization potential'
  const expandSubtitle = feed?.cold_start
    ? 'More variety from the catalog - expands with your genre profile after 3+ ratings.'
    : 'Titles outside your usual genre clusters'

  const showPopularFallback = Boolean(token) && browse.length > 0 && feedFetchFinished && (feed === null || !feed.for_you?.length)

  return (
    <div className="page-gutter mx-auto max-w-7xl pb-24 pt-4 sm:pb-20 sm:pt-5">
      {!token && (
        <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-4 shadow-lg shadow-black/20 ring-1 ring-white/5 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-5">
          <div className="min-w-0 space-y-1">
            <p className="text-pretty text-sm font-medium leading-snug sm:text-base">
              Sign in for your hybrid &quot;For You&quot; feed and AI explanations.
            </p>
            <p className="text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Browse trending and catalog rows below; 3+ ratings unlock full personalization when you sign in.
            </p>
          </div>
          <Button asChild className="h-11 w-full shrink-0 touch-manipulation sm:h-10 sm:w-auto">
            <Link to="/login" state={{ from: `${location.pathname}${location.search}` }}>
              Sign in
            </Link>
          </Button>
        </div>
      )}

      {err && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 sm:px-4">{err}</p>}

      {catalogMissing && (
        <div className="mb-6 rounded-2xl border border-amber-500/35 bg-amber-950/30 px-4 py-5 shadow-lg ring-1 ring-amber-500/20 sm:px-6">
          <p className="font-semibold text-amber-100">Backend API not reachable</p>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-amber-100/85">
            Vite forwards <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">/api</code> to{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">http://116.202.210.102:20358</code>. If you see{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">ECONNREFUSED</code> in the terminal, Django is not running.
            Start Django from the backend folder and refresh this page.
          </p>
        </div>
      )}

      <Hero
        movie={heroMovie}
        cold={feed?.cold_start}
        tagline={
          feed?.cold_start
            ? 'Rate a few films to unlock your unique blend of signals.'
            : !token
              ? 'Explore the catalog below - sign in to personalize.'
              : undefined
        }
      />

      {showPersonalizedRails && (
        <>
          {forYouItems.length > 0 && (
            <MovieCarousel
              title="For You"
              subtitle={forYouSubtitle}
              items={forYouItems}
              onPick={(m) => {
                impression(m)
                void api.trackInteraction(m.id, 'click')
              }}
            />
          )}
          {becauseItems.length > 0 && (
            <MovieCarousel
              title="Because you liked a recent favorite"
              items={becauseItems}
              onPick={(m) => void api.trackInteraction(m.id, 'click')}
            />
          )}
          {usersLikeYouItems.length > 0 && (
            <MovieCarousel
              title="Users like you enjoyed"
              items={usersLikeYouItems}
              onPick={(m) => void api.trackInteraction(m.id, 'click')}
            />
          )}
          {hiddenItems.length > 0 && (
            <MovieCarousel
              title="Hidden Gems"
              subtitle={hiddenSubtitle}
              items={hiddenItems}
              onPick={(m) => void api.trackInteraction(m.id, 'click')}
            />
          )}
          {expandItems.length > 0 && (
            <MovieCarousel
              title="Expand your horizons"
              subtitle={expandSubtitle}
              items={expandItems}
              onPick={(m) => void api.trackInteraction(m.id, 'click')}
            />
          )}
        </>
      )}

      {!token && browse.length > 0 && (
        <>
          <MovieCarousel title="Trending & popular" subtitle="Most popular catalog titles right now" items={browse} scored={false} />
          {browseMore.length > 0 && (
            <MovieCarousel
              title="More to explore"
              subtitle="The next page of the catalog - sign in to personalize"
              items={browseMore}
              scored={false}
            />
          )}
          {deeperCuts.length > 0 && (
            <MovieCarousel
              title="Deeper cuts"
              subtitle="Lower popularity scores - good for discovery before you sign in"
              items={deeperCuts}
              scored={false}
            />
          )}
        </>
      )}

      {showPopularFallback && (
        <MovieCarousel
          title="Popular picks"
          subtitle="Trending catalog titles when your feed is unavailable or has no For You row yet"
          items={browse}
          scored={false}
        />
      )}
    </div>
  )
}
