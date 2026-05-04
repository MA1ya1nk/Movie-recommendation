import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { AuthProvider } from '@/context/AuthContext'
import { AdminPage } from '@/pages/Admin'
import { DiscoverChatPage } from '@/pages/DiscoverChat'
import { HomePage } from '@/pages/Home'
import { LoginPage } from '@/pages/Login'
import { MovieDetailPage } from '@/pages/MovieDetail'
import { ProfilePage } from '@/pages/Profile'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[radial-gradient(ellipse_120%_80%_at_50%_-20%,rgba(225,29,72,0.18),transparent_55%),radial-gradient(ellipse_100%_60%_at_50%_120%,rgba(56,189,248,0.14),transparent_50%),radial-gradient(ellipse_at_100%_0%,rgba(139,92,246,0.08),transparent_40%),#050816]">
      <Navbar />
      <main className="safe-pb">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/movie/:slug" element={<MovieDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/discover" element={<DiscoverChatPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </BrowserRouter>
    </AuthProvider>
  )
}
