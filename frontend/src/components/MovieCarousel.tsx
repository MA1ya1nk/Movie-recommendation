import { Film } from 'lucide-react'
import { MovieCard } from '@/components/MovieCard'
import type { Movie, ScoredMovie } from '@/types/api'
import { cn } from '@/lib/utils'

export type CarouselRow = ScoredMovie | Movie

function rowMovie(row: CarouselRow): Movie {
  return 'movie' in row ? row.movie : row
}

type Props = {
  title: string
  subtitle?: string
  items: CarouselRow[]
  scored?: boolean
  onPick?: (movie: Movie) => void
  /** Shown when `items` is empty so the shelf still takes space and explains why. */
  emptyHint?: string
}

const defaultEmpty = 'Nothing to show here yet — check back after you explore more titles.'

export function MovieCarousel({
  title,
  subtitle,
  items,
  scored = true,
  onPick,
  emptyHint = defaultEmpty,
}: Props) {
  const hasItems = items.length > 0

  return (
    <section className="py-6 sm:py-8">
      <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl md:text-2xl">{title}</h2>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">{subtitle}</p>
          )}
        </div>
        {hasItems && (
          <p className="text-[11px] text-muted-foreground/80 sm:hidden">Swipe sideways for more</p>
        )}
      </div>

      {hasItems ? (
        <div className="overflow-hidden">
          <div
            className={cn(
              'carousel-mask no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-2 scroll-smooth sm:gap-4',
              'touch-pan-x [-webkit-overflow-scrolling:touch]',
            )}
          >
            {items.map((row, i) => {
              const movie = rowMovie(row)
              const score = 'final_score' in row ? row.final_score : undefined
              return (
                <div key={`${movie.id}-${i}`} data-carousel-slide className="snap-start snap-always shrink-0">
                  <MovieCard movie={movie} score={scored ? score : undefined} onNavigate={() => onPick?.(movie)} />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[140px] items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-8 sm:min-h-[160px] sm:px-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-muted-foreground">
            <Film className="h-6 w-6" />
          </span>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">{emptyHint}</p>
        </div>
      )}
    </section>
  )
}
