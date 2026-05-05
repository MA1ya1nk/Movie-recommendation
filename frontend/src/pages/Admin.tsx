import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import * as api from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'

export function AdminPage() {
  const { token, ready } = useAuth()
  const [rows, setRows] = useState<
    { variant: string; impressions: number; clicks: number; ctr_percent: number; engagement_score: number }[]
  >([])

  useEffect(() => {
    if (!token) return
    void api.fetchAbMetrics().then((d) => setRows(d.variants))
  }, [token])

  if (!ready) return null
  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="page-gutter mx-auto max-w-7xl space-y-6 py-6 sm:space-y-8 sm:py-8">
      <div>
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">A/B testing</h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Compare Content-Heavy vs Collab-Heavy hybrid weights using logged impressions and clicks from recommendation rows.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.variant} className="overflow-hidden shadow-lg ring-1 ring-white/5 transition hover:ring-white/10">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base capitalize sm:text-lg">{r.variant.replace('_', ' ')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 p-4 pt-0 text-sm sm:gap-4 sm:p-6 sm:pt-0">
              <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                <p className="text-xs text-muted-foreground sm:text-sm">Impressions</p>
                <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{r.impressions}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                <p className="text-xs text-muted-foreground sm:text-sm">Clicks</p>
                <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{r.clicks}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                <p className="text-xs text-muted-foreground sm:text-sm">CTR</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-400 sm:text-2xl">{r.ctr_percent}%</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3 ring-1 ring-white/5">
                <p className="text-xs text-muted-foreground sm:text-sm">Engagement score</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-sky-400 sm:text-2xl">{r.engagement_score}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-sm leading-relaxed text-muted-foreground sm:p-8">
            No interaction data yet — browse titles while signed in to populate metrics.
          </p>
        )}
      </div>
    </div>
  )
}
