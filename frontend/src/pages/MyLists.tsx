import { useCallback, useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import * as api from '@/api/client'
import { MovieCard } from '@/components/MovieCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import type { Movie, Paginated } from '@/types/api'

type ListKind = 'favorites' | 'five_star' | 'not_interested'

const TAB_OPTIONS: { value: ListKind; label: string; description: string }[] = [
  {
    value: 'favorites',
    label: 'Favorites',
    description: 'Titles you marked with the heart — used as positive signals for recommendations.',
  },
  {
    value: 'five_star',
    label: '5★ ratings',
    description: 'Every film you rated five stars, newest first.',
  },
  {
    value: 'not_interested',
    label: 'Not interested',
    description: 'Hidden from your feed and discovery until you remove them here or on the movie page.',
  },
]

async function collectAllMovies(
  fetchPage: (page: number) => Promise<Paginated<{ movie: Movie }>>,
): Promise<Movie[]> {
  const out: Movie[] = []
  let page = 1
  for (;;) {
    const data = await fetchPage(page)
    for (const row of data.results) {
      if (row.movie) out.push(row.movie)
    }
    if (!data.next || data.results.length === 0) break
    page += 1
  }
  return out
}

export function MyListsPage() {
  const { token, ready } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab') as ListKind | null
  const tab: ListKind =
    tabParam === 'five_star' || tabParam === 'not_interested' ? tabParam : 'favorites'

  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setErr(null)
    try {
      if (tab === 'favorites') {
        setMovies(await collectAllMovies((p) => api.fetchFavoritesPage(p)))
      } else if (tab === 'not_interested') {
        setMovies(await collectAllMovies((p) => api.fetchNotInterestedPage(p)))
      } else {
        setMovies(
          await collectAllMovies((p) =>
            api.fetchRatingsPage(p, 5).then((d) => ({
              ...d,
              results: d.results.map((r) => ({ movie: r.movie })),
            })),
          ),
        )
      }
    } catch (e: unknown) {
      setMovies([])
      setErr(e instanceof Error ? e.message : 'Could not load your list')
    } finally {
      setLoading(false)
    }
  }, [token, tab])

  useEffect(() => {
    if (!token) return
    void load()
  }, [token, load])

  const meta = TAB_OPTIONS.find((o) => o.value === tab) ?? TAB_OPTIONS[0]

  if (!ready) return null
  if (!token) return <Navigate to="/login" replace state={{ from: '/my-lists' }} />

  return (
    <div className="page-gutter mx-auto max-w-7xl space-y-8 py-6 sm:space-y-10 sm:py-8">
      <div>
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">My lists</h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Browse everything you&apos;ve favorited, rated five stars, or marked not interested — same signals that
          shape your recommendations.
        </p>
      </div>

      <Card className="overflow-hidden shadow-lg ring-1 ring-white/5">
        <CardHeader className="space-y-1 p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Choose a list</CardTitle>
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">{meta.description}</p>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground" htmlFor="list-tab">
            List type
          </label>
          <select
            id="list-tab"
            className="min-h-11 w-full max-w-md rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm text-white shadow-inner ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-primary/45 sm:min-h-10"
            value={tab}
            onChange={(e) => {
              const v = e.target.value as ListKind
              setSearchParams(v === 'favorites' ? {} : { tab: v })
            }}
          >
            {TAB_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-900 text-white">
                {o.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {err && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 sm:px-4">{err}</p>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight sm:text-xl">{meta.label}</h2>
        {loading ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-muted-foreground">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
            <p className="text-sm">Loading your titles…</p>
          </div>
        ) : movies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-14 text-center sm:px-8">
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              Nothing in this list yet. Use the movie page to add favorites, rate 5★, or mark not interested.
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
            {movies.map((m) => (
              <MovieCard
                key={m.id}
                movie={m}
                subtitle={tab === 'five_star' ? '5★' : tab === 'favorites' ? 'Favorite' : 'Hidden'}
              />
            ))}
          </div>
        )}
        {!loading && movies.length > 0 && (
          <p className="mt-6 text-center text-xs text-muted-foreground sm:text-sm">{movies.length} title(s)</p>
        )}
      </section>
    </div>
  )
}
