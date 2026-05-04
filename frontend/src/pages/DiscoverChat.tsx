import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import * as api from '@/api/client'
import { MovieCard } from '@/components/MovieCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import type { Movie } from '@/types/api'

export function DiscoverChatPage() {
  const { token, ready } = useAuth()
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: 'What kind of night do you want — cozy, thrilling, or epic?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [moodPicks, setMoodPicks] = useState<Movie[]>([])

  if (!ready) return null
  if (!token) return <Navigate to="/login" replace />

  async function send() {
    if (!input.trim()) return
    setMoodPicks([])
    const next = [...messages, { role: 'user', content: input.trim() }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await api.discoveryChat(next)
      if (res.done && res.summary) {
        setMessages((m) => [...m, { role: 'assistant', content: `Here's what I gathered: ${res.summary}` }])
        setMoodPicks(Array.isArray(res.suggestions) ? res.suggestions : [])
      } else {
        const text = res.message ?? 'Tell me a bit more about what you want to feel.'
        setMessages((m) => [...m, { role: 'assistant', content: text }])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-gutter mx-auto flex max-w-3xl flex-col space-y-5 py-6 sm:space-y-6 sm:py-8">
      <div>
        <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">Conversational discovery</h1>
        <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          The assistant locks onto what you said you want, then suggests catalog titles that match those genres first (close neighbors like Thriller for Horror only if needed), then very high similarity if the catalog is thin.
        </p>
      </div>

      <Card className="border-white/10 shadow-xl ring-1 ring-white/5">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="max-h-[min(52vh,420px)] min-h-[200px] space-y-3 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/35 p-3 shadow-inner sm:max-h-[420px] sm:p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[min(92%,20rem)] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed sm:max-w-[85%] sm:text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-white/10 text-foreground ring-1 ring-white/10'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                Mistral is thinking…
              </p>
            )}
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer…"
              className="min-h-11 flex-1 text-base sm:min-h-10 sm:text-sm"
            />
            <Button
              type="submit"
              disabled={loading}
              aria-label="Send message"
              className="h-11 shrink-0 touch-manipulation gap-2 px-5 sm:h-10 sm:min-w-[3rem] sm:px-0"
            >
              <Send className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium sm:sr-only">Send</span>
            </Button>
          </form>
        </CardContent>
      </Card>

      {moodPicks.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Picks for your mood</h2>
          <p className="text-sm text-muted-foreground">Titles from your catalog, chosen for similarity to the summary above (already rated titles are skipped).</p>
          <div className="flex gap-4 overflow-x-auto pb-2 pt-1">
            {moodPicks.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
