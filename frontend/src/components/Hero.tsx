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
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black px-6 py-12 text-center shadow-2xl shadow-black/40 ring-1 ring-white/5 sm:mb-10 sm:rounded-3xl sm:px-8 sm:py-16 md:px-10">
        <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-sky-500/15 blur-3xl" />
        <h1 className="relative text-balance text-2xl font-bold tracking-tight sm:text-4xl md:text-5xl">
          Find your next obsession.
        </h1>
        <p className="relative mx-auto mt-4 max-w-xl text-pretty text-sm text-muted-foreground sm:text-base">
          Hybrid AI recommendations — content, collaboration, and Mistral-powered taste.
        </p>
        <Button asChild className="relative mt-8 h-11 touch-manipulation px-8 shadow-lg shadow-primary/25">
          <Link to="/login">Start watching</Link>
        </Button>
      </div>
    )
  }

  const bg = movie.backdrop_path || movie.poster_path

  return (
    <div className="relative mb-8 min-h-[min(72vw,420px)] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60 ring-1 ring-white/5 sm:mb-10 sm:min-h-[380px] sm:rounded-3xl md:min-h-0">
      <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-black/25 sm:via-black/80" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/50" />

      <div className="relative grid min-h-[min(72vw,420px)] gap-6 px-6 pb-10 pt-24 sm:min-h-[380px] sm:gap-8 sm:px-8 sm:pb-12 sm:pt-28 md:min-h-0 md:grid-cols-[1.2fr_0.8fr] md:px-12 md:py-16 md:pt-16">
        <div className="flex flex-col justify-end">
          <div className="mb-3 flex flex-wrap gap-2">
            {cold && (
              <span className="rounded-full bg-amber-500/25 px-3 py-1.5 text-[11px] font-medium text-amber-100 ring-1 ring-amber-400/35 sm:text-xs">
                Cold start · popularity picks
              </span>
            )}
            <span className="max-w-full truncate rounded-full bg-white/10 px-3 py-1.5 text-[11px] text-muted-foreground ring-1 ring-white/10 sm:text-xs">
              {movie.genres.slice(0, 3).join(' · ')}
            </span>
          </div>
          <h1 className="text-balance text-3xl font-black leading-[1.1] tracking-tight sm:text-4xl md:text-6xl">{movie.title}</h1>
          <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground/95 sm:text-base">
            {tagline || movie.summary.slice(0, 220)}
            {movie.summary.length > 220 ? '…' : ''}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
            <Button asChild size="lg" className="h-12 w-full touch-manipulation gap-2 shadow-lg shadow-primary/30 sm:h-11 sm:w-auto">
              <Link to={`/movie/${movie.slug}`}>
                <Play className="h-4 w-4 shrink-0 fill-current" /> Play details
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="h-12 w-full touch-manipulation gap-2 sm:h-11 sm:w-auto">
              <Link to="/discover">
                <Sparkles className="h-4 w-4 shrink-0" /> Ask AI
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-2 md:mt-0 md:flex md:items-end md:justify-end">
          <div className="glass w-full max-w-none rounded-xl p-4 text-sm text-muted-foreground shadow-lg md:max-w-xs">
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
