import useEmblaCarousel from 'embla-carousel-react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
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
}

export function MovieCarousel({ title, subtitle, items, scored = true, onPick }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', loop: false, dragFree: true })

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  if (!items.length) return null

  return (
    <section className="py-8">
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="hidden gap-2 sm:flex">
          <Button type="button" variant="outline" size="icon" onClick={scrollPrev} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={scrollNext} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="carousel-mask overflow-hidden">
        <div ref={emblaRef} className={cn('cursor-grab active:cursor-grabbing')}>
          <div className="flex gap-4 pb-2">
            {items.map((row, i) => {
              const movie = rowMovie(row)
              const score = 'final_score' in row ? row.final_score : undefined
              return (
                <MovieCard
                  key={`${movie.id}-${i}`}
                  movie={movie}
                  score={scored ? score : undefined}
                  onNavigate={() => onPick?.(movie)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
