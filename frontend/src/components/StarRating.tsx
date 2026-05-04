import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  value: number
  onChange?: (v: number) => void
  disabled?: boolean
}

export function StarRating({ value, onChange, disabled }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(s)}
          className={cn(
            '-m-0.5 min-h-[44px] min-w-[44px] touch-manipulation rounded-lg p-2 transition active:scale-95 disabled:cursor-default sm:min-h-0 sm:min-w-0 sm:p-1 sm:hover:scale-110',
            s <= value ? 'text-amber-400' : 'text-zinc-600',
          )}
          aria-label={`Rate ${s} stars`}
        >
          <Star className={cn('h-9 w-9 sm:h-8 sm:w-8', s <= value && 'fill-current')} />
        </button>
      ))}
    </div>
  )
}
