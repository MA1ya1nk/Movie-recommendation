import { Play, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import type { Movie } from '@/types/api'

type Props = {
  movie: Movie | null
  tagline?: string
  cold?: boolean
}

export function Hero({ movie, tagline, cold }: Props) {
  if (!movie) {
    return (
      <div className="relative mb-10 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 to-black px-6 py-16 text-center">
        <h1 className="text-3xl font-bold md:text-5xl">Find your next obsession.</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">Hybrid AI recommendations — content, collaboration, and Mistral-powered taste.</p>
        <Button asChild className="mt-8">
          <Link to="/login">Start watching</Link>
        </Button>
      </div>
    )
  }

  const bg = movie.backdrop_path || movie.poster_path

  return (
    <div className="relative mb-10 overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60">
      <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />

      <div className="relative grid gap-8 px-6 py-12 md:grid-cols-[1.2fr_0.8fr] md:px-12 md:py-16">
        <div className="flex flex-col justify-end">
          <div className="mb-3 flex flex-wrap gap-2">
            {cold && (
              <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-200 ring-1 ring-amber-400/30">
                Cold start · popularity picks
              </span>
            )}
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-muted-foreground ring-1 ring-white/10">
              {movie.genres.slice(0, 3).join(' · ')}
            </span>
          </div>
          <h1 className="text-4xl font-black tracking-tight md:text-6xl">{movie.title}</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
            {tagline || movie.summary.slice(0, 220)}
            {movie.summary.length > 220 ? '…' : ''}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2 shadow-lg shadow-primary/30">
              <Link to={`/movie/${movie.slug}`}>
                <Play className="h-4 w-4 fill-current" /> Play details
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="gap-2">
              <Link to="/discover">
                <Sparkles className="h-4 w-4" /> Ask AI
              </Link>
            </Button>
          </div>
        </div>

        <div className="hidden md:flex md:items-end md:justify-end">
          <div className="glass w-full max-w-xs rounded-xl p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Tonight&apos;s signal</p>
            <p className="mt-2 leading-relaxed">
              Hybrid engine blends vector similarity, collaborative neighbors, popularity, and Mistral relevance scoring.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
