import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import * as api from '@/api/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

export function ProfilePage() {
  const { token, ready } = useAuth()
  const [prefsText, setPrefsText] = useState('')
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof api.fetchProfile>> | null>(null)
  const [extractBusy, setExtractBusy] = useState(false)
  const [extractMsg, setExtractMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!token) return
    void api.fetchProfile().then(setProfile)
  }, [token])

  const radarData = useMemo(() => {
    if (!profile) return []
    const entries = Object.entries(profile.genre_map).sort((a, b) => b[1] - a[1])
    const top = entries.slice(0, 8)
    const max = Math.max(...top.map(([, v]) => v), 1)
    return top.map(([genre, v]) => ({ genre, score: Math.round((v / max) * 100) }))
  }, [profile])

  const evolutionData = useMemo(() => {
    if (!profile) return []
    return profile.taste_evolution.map((s, i) => ({
      idx: i + 1,
      at: s.at.slice(0, 10),
      marker: s.summary.slice(0, 80),
    }))
  }, [profile])

  if (!ready) return null
  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="page-gutter mx-auto max-w-7xl space-y-8 py-6 sm:space-y-10 sm:py-8">
      <div>
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">Your taste studio</h1>
        <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Genre radar, Mistral taste snapshots every 5 ratings, and NL preference extraction.
        </p>
      </div>

      <Card className="overflow-hidden shadow-lg ring-1 ring-white/5">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Natural-language preferences</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-4 pt-0 sm:p-6 sm:pt-0">
          {extractMsg && (
            <p
              className={
                extractMsg.type === 'success'
                  ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200'
                  : 'rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200'
              }
              role="status"
            >
              {extractMsg.text}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Describe mood, characters, themes…"
            value={prefsText}
            onChange={(e) => {
              setPrefsText(e.target.value)
              if (extractMsg) setExtractMsg(null)
            }}
            className="min-h-11 flex-1 text-base sm:min-h-10 sm:text-sm"
          />
          <Button
            type="button"
            className="h-11 w-full shrink-0 touch-manipulation sm:h-10 sm:w-auto"
            disabled={extractBusy || !prefsText.trim()}
            onClick={async () => {
              const text = prefsText.trim()
              if (!text) return
              setExtractBusy(true)
              setExtractMsg(null)
              try {
                await api.nlPreferences(text)
                const p = await api.fetchProfile()
                setProfile(p)
                setExtractMsg({ type: 'success', text: 'Preferences extracted and saved.' })
              } catch {
                setExtractMsg({ type: 'error', text: 'Could not extract preferences. Please try again.' })
              } finally {
                setExtractBusy(false)
              }
            }}
          >
            {extractBusy ? 'Extracting…' : 'Extract'}
          </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">
        <Card className="min-h-[300px] overflow-hidden shadow-lg ring-1 ring-white/5 sm:min-h-[360px]">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Genre map</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] p-2 sm:h-[300px] sm:p-4 sm:pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.15)" />
                <PolarAngleAxis dataKey="genre" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                <Radar name="Affinity" dataKey="score" stroke="#e11d48" fill="#e11d48" fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-h-[300px] overflow-hidden shadow-lg ring-1 ring-white/5 sm:min-h-[360px]">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Taste evolution</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px] p-2 sm:h-[300px] sm:p-4 sm:pt-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolutionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="at" stroke="#64748b" fontSize={11} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)' }}
                  formatter={(_, __, p) => [(p?.payload as { marker?: string })?.marker, 'snapshot']}
                />
                <Line type="monotone" dataKey="idx" stroke="#38bdf8" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg ring-1 ring-white/5">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Snapshots</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0 sm:space-y-4 sm:p-6 sm:pt-0">
          {(profile?.taste_evolution.length ?? 0) === 0 && (
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Rate movies — every 5 ratings we ask Mistral to summarize how your taste is evolving.
            </p>
          )}
          {profile?.taste_evolution.map((s) => (
            <div key={s.at} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
              <p className="text-xs text-muted-foreground">{new Date(s.at).toLocaleString()}</p>
              <p className="mt-2 text-sm leading-relaxed sm:text-[15px]">{s.summary}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
