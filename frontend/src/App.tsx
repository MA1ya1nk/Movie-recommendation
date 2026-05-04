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
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(225,29,72,0.15),transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(56,189,248,0.12),transparent_45%),#050816]">
      <Navbar />
      <main>{children}</main>
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
