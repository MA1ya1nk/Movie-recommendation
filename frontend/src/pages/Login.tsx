import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { safeInternalPath } from '@/lib/utils'

export function LoginPage() {
  const { token, login, register } = useAuth()
  const location = useLocation()
  const redirectTo = safeInternalPath((location.state as { from?: string } | null)?.from) ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)

  if (token) return <Navigate to={redirectTo} replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
    } catch {
      setError('Authentication failed — check email/password.')
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-16">
      <Card className="border-white/10 bg-black/40">
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Welcome back' : 'Create account'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground" htmlFor="email">
                Email
              </label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button type="submit" className="w-full">
              {mode === 'login' ? 'Sign in' : 'Register'}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-muted-foreground underline"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? 'Need an account?' : 'Already registered?'}
          </button>
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Token auth — email is your username. Set <code className="rounded bg-white/10 px-1">MISTRAL_API_KEY</code> for LLM features.
      </p>
      <p className="text-center text-sm">
        <Link to="/" className="text-accent underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  )
}
