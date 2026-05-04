import { Link, NavLink, useLocation } from 'react-router-dom'
import { Film, LineChart, Sparkles, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn('text-sm font-medium transition-colors hover:text-white', isActive ? 'text-white' : 'text-muted-foreground')

export function Navbar() {
  const { token, logout } = useAuth()
  const location = useLocation()

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/30">
            <Film className="h-5 w-5 text-white" />
          </span>
          <span className="hidden sm:inline">Nexus Cinema</span>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-6">
          <NavLink to="/" className={linkClass} end>
            Home
          </NavLink>
          <NavLink to="/profile" className={linkClass}>
            <span className="hidden items-center gap-1 sm:inline-flex">
              <User className="h-4 w-4" /> Profile
            </span>
            <span className="sm:hidden">Me</span>
          </NavLink>
          <NavLink to="/discover" className={linkClass}>
            <span className="hidden items-center gap-1 sm:inline-flex">
              <Sparkles className="h-4 w-4" /> Discover
            </span>
            <span className="sm:hidden">AI</span>
          </NavLink>
          <NavLink to="/admin" className={linkClass}>
            <span className="hidden items-center gap-1 sm:inline-flex">
              <LineChart className="h-4 w-4" /> Admin
            </span>
            <span className="sm:hidden">AB</span>
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {token ? (
            <Button variant="ghost" size="sm" onClick={() => logout()} className="text-muted-foreground">
              Sign out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/login" state={{ from: `${location.pathname}${location.search}` }}>
                Sign in
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
