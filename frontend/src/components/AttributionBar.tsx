type Props = {
  content: number
  collab: number
  pop: number
  mistral?: number
}

export function AttributionBar({ content, collab, pop, mistral }: Props) {
  const ai = mistral ?? Math.max(0, 100 - content - collab - pop)
  const segments: { label: string; pct: number; className: string }[] = [
    { label: 'Content', pct: content, className: 'bg-sky-500' },
    { label: 'Collab', pct: collab, className: 'bg-violet-500' },
    { label: 'Pop', pct: pop, className: 'bg-emerald-500' },
    { label: 'Mistral', pct: ai, className: 'bg-amber-500' },
  ]

  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
        {segments.map((s) =>
          s.pct > 0 ? (
            <div
              key={s.label}
              className={s.className}
              style={{ width: `${s.pct}%` }}
              title={`${s.label}: ${s.pct}%`}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {segments.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${s.className}`} />
            {s.label} {s.pct}%
          </span>
        ))}
      </div>
    </div>
  )
}
