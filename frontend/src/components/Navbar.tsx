import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Bookmark, Film, Home, LineChart, Menu, Sparkles, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const linkClassDesktop = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
    isActive
      ? 'bg-white/10 text-white shadow-inner ring-1 ring-white/15'
      : 'text-muted-foreground hover:bg-white/5 hover:text-white',
  )

const mobileMenuItem = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-colors active:bg-white/10',
    isActive ? 'bg-white/10 text-white ring-1 ring-white/15' : 'text-muted-foreground hover:bg-white/5 hover:text-white',
  )

export function Navbar() {
  const { token, logout } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const [navHeight, setNavHeight] = useState(64)

  useLayoutEffect(() => {
    const el = headerRef.current
    if (!el) return
    const measure = () => setNavHeight(el.offsetHeight)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [menuOpen])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!menuOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const authControl = token ? (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => logout()}
      className="h-10 shrink-0 touch-manipulation px-3 text-muted-foreground hover:text-white sm:h-9"
    >
      Sign out
    </Button>
  ) : (
    <Button asChild size="sm" className="h-10 shrink-0 touch-manipulation px-4 sm:h-9">
      <Link to="/login" state={{ from: `${location.pathname}${location.search}` }}>
        Sign in
      </Link>
    </Button>
  )

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 safe-pt border-b border-white/10 bg-black/65 backdrop-blur-xl supports-[backdrop-filter]:bg-black/45"
    >
      <div className="page-gutter mx-auto max-w-7xl py-3 md:flex md:items-center md:justify-between md:gap-4 md:py-3">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between gap-3 md:hidden">
          <Link
            to="/"
            className="flex min-w-0 flex-1 items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-90"
            onClick={() => setMenuOpen(false)}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/35 ring-1 ring-white/10 sm:h-9 sm:w-9">
              <Film className="h-5 w-5 text-white" />
            </span>
            <span className="truncate text-sm">
              <span className="inline sm:hidden">Nexus</span>
              <span className="hidden sm:inline">Nexus Cinema</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {authControl}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 touch-manipulation border-white/20"
              aria-expanded={menuOpen}
              aria-controls="mobile-primary-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Desktop bar */}
        <div className="hidden md:contents">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-90"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-600 shadow-lg shadow-primary/35 ring-1 ring-white/10">
              <Film className="h-5 w-5 text-white" />
            </span>
            <span className="truncate text-base">Nexus Cinema</span>
          </Link>

          <nav className="flex flex-1 items-center justify-center gap-2 lg:gap-6" aria-label="Main">
            <NavLink to="/" className={linkClassDesktop} end>
              Home
            </NavLink>
            <NavLink to="/profile" className={linkClassDesktop}>
              <User className="h-4 w-4 shrink-0" /> Profile
            </NavLink>
            <NavLink to="/my-lists" className={linkClassDesktop}>
              <Bookmark className="h-4 w-4 shrink-0" /> My lists
            </NavLink>
            <NavLink to="/discover" className={linkClassDesktop}>
              <Sparkles className="h-4 w-4 shrink-0" /> Discover
            </NavLink>
            <NavLink to="/admin" className={linkClassDesktop}>
              <LineChart className="h-4 w-4 shrink-0" /> Admin
            </NavLink>
          </nav>

          <div className="shrink-0">{authControl}</div>
        </div>
      </div>

      {/* Mobile menu: portaled so it sits above page imagery; solid layers (no see-through) */}
      {menuOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <button
              type="button"
              className="fixed inset-x-0 bottom-0 z-[120] bg-[#050816] md:hidden"
              style={{ top: navHeight }}
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            />
            <nav
              id="mobile-primary-nav"
              className="page-gutter fixed left-0 right-0 z-[130] border-b border-white/15 bg-[#0a0f1c] py-4 shadow-[0_12px_40px_rgba(0,0,0,0.85)] md:hidden"
              style={{ top: navHeight }}
              aria-label="Main"
            >
              <div className="mx-auto flex max-w-7xl flex-col gap-1.5">
                <NavLink to="/" className={mobileMenuItem} end onClick={() => setMenuOpen(false)}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/10">
                    <Home className="h-5 w-5 text-primary" />
                  </span>
                  Home
                </NavLink>
                <NavLink to="/profile" className={mobileMenuItem} onClick={() => setMenuOpen(false)}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/10">
                    <User className="h-5 w-5 text-sky-400" />
                  </span>
                  Profile
                </NavLink>
                <NavLink to="/my-lists" className={mobileMenuItem} onClick={() => setMenuOpen(false)}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/10">
                    <Bookmark className="h-5 w-5 text-rose-300" />
                  </span>
                  My lists
                </NavLink>
                <NavLink to="/discover" className={mobileMenuItem} onClick={() => setMenuOpen(false)}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/10">
                    <Sparkles className="h-5 w-5 text-amber-300" />
                  </span>
                  Discover
                </NavLink>
                <NavLink to="/admin" className={mobileMenuItem} onClick={() => setMenuOpen(false)}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/10">
                    <LineChart className="h-5 w-5 text-emerald-400" />
                  </span>
                  Admin
                </NavLink>
              </div>
            </nav>
          </>,
          document.body,
        )}
    </header>
  )
}
