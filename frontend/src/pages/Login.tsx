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
    <div className="page-gutter mx-auto flex w-full max-w-lg flex-col gap-6 py-10 sm:py-16">
      <Card className="border-white/10 bg-black/50 shadow-2xl shadow-black/40 ring-1 ring-white/10 backdrop-blur-sm">
        <CardHeader className="space-y-1 p-5 sm:p-6">
          <CardTitle className="text-xl sm:text-2xl">{mode === 'login' ? 'Welcome back' : 'Create account'}</CardTitle>
        </CardHeader>
        <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
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
            <Button type="submit" className="h-11 w-full touch-manipulation text-base sm:h-10 sm:text-sm">
              {mode === 'login' ? 'Sign in' : 'Register'}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 min-h-11 w-full touch-manipulation rounded-lg py-2 text-center text-sm text-muted-foreground underline-offset-4 hover:text-white hover:underline"
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
