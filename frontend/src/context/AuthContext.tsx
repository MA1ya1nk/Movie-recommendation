import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as api from '@/api/client'

type AuthState = {
  token: string | null
  ready: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api.loadStoredToken()
    const t = localStorage.getItem('token')
    setToken(t)
    setReady(true)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password)
    setToken(localStorage.getItem('token'))
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    await api.register(email, password)
    setToken(localStorage.getItem('token'))
  }, [])

  const logout = useCallback(() => {
    api.setAuthToken(null)
    setToken(null)
  }, [])

  const value = useMemo(() => ({ token, ready, login, register, logout }), [token, ready, login, register, logout])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth requires AuthProvider')
  return v
}
