import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  value: number
  onChange?: (v: number) => void
  disabled?: boolean
}

export function StarRating({ value, onChange, disabled }: Props) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(s)}
          className={cn(
            'rounded-md p-1 transition hover:scale-110 disabled:cursor-default',
            s <= value ? 'text-amber-400' : 'text-zinc-600',
          )}
          aria-label={`Rate ${s} stars`}
        >
          <Star className={cn('h-8 w-8', s <= value && 'fill-current')} />
        </button>
      ))}
    </div>
  )
}
