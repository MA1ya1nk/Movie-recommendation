import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import * as api from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'

export function DiscoverChatPage() {
  const { token, ready } = useAuth()
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: 'assistant', content: 'What kind of night do you want — cozy, thrilling, or epic?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  if (!ready) return null
  if (!token) return <Navigate to="/login" replace />

  async function send() {
    if (!input.trim()) return
    const next = [...messages, { role: 'user', content: input.trim() }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await api.discoveryChat(next)
      if (res.done && res.summary) {
        setMessages((m) => [...m, { role: 'assistant', content: `Here's what I gathered: ${res.summary}` }])
      } else {
        const text = res.message ?? 'Tell me a bit more about what you want to feel.'
        setMessages((m) => [...m, { role: 'assistant', content: text }])
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-3xl font-bold">Conversational discovery</h1>
        <p className="mt-2 text-muted-foreground">Mistral asks a few clarifying questions before locking recommendations.</p>
      </div>

      <Card className="border-white/10">
        <CardHeader>
          <CardTitle>Chat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-white/10 text-foreground'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && <p className="text-xs text-muted-foreground">Mistral is thinking…</p>}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your answer…" />
            <Button type="submit" disabled={loading}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
