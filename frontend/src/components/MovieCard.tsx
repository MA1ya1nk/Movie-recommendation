import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { Movie } from '@/types/api'
import { cn } from '@/lib/utils'

type Props = {
  movie: Movie
  score?: number
  subtitle?: string
  className?: string
  onNavigate?: () => void
}

export function MovieCard({ movie, score, subtitle, className, onNavigate }: Props) {
  return (
    <Link
      to={`/movie/${movie.slug}`}
      onClick={onNavigate}
      onDragStart={(e) => e.preventDefault()}
      className={cn(
        'group relative block w-[min(200px,78vw)] shrink-0 overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition duration-300 hover:ring-primary/50 active:scale-[0.98] sm:w-[min(220px,46vw)] md:w-[min(220px,28vw)] lg:w-[220px]',
        className,
      )}
    >
      <div className="aspect-[2/3] w-full overflow-hidden">
        <img
          src={movie.poster_path || movie.backdrop_path}
          alt={movie.title}
          draggable={false}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-90" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 space-y-1 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-8">
        <p className="line-clamp-2 text-xs font-semibold leading-snug sm:text-sm">{movie.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{movie.genres.slice(0, 2).join(' · ')}</p>
        {(score !== undefined || subtitle) && (
          <div className="flex items-center gap-2 text-xs text-amber-300/90">
            {score !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {score.toFixed(2)}
              </span>
            )}
            {subtitle && <span className="text-muted-foreground">{subtitle}</span>}
          </div>
        )}
      </div>
    </Link>
  )
}
