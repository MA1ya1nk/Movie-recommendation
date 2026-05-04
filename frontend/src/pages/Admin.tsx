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
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">A/B testing</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Compare Content-Heavy vs Collab-Heavy hybrid weights using logged impressions and clicks from recommendation rows.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.variant}>
            <CardHeader>
              <CardTitle className="capitalize">{r.variant.replace('_', ' ')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Impressions</p>
                <p className="text-2xl font-semibold">{r.impressions}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Clicks</p>
                <p className="text-2xl font-semibold">{r.clicks}</p>
              </div>
              <div>
                <p className="text-muted-foreground">CTR</p>
                <p className="text-2xl font-semibold text-emerald-400">{r.ctr_percent}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Engagement score</p>
                <p className="text-2xl font-semibold text-sky-400">{r.engagement_score}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No interaction data yet — browse titles while signed in to populate metrics.</p>
        )}
      </div>
    </div>
  )
}
