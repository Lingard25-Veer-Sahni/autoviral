import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Loader2 } from 'lucide-react'

function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-yolk-500" />
    </div>
  )
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (profile?.role !== 'admin') return <Navigate to="/app" replace />
  return <>{children}</>
}

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return <FullScreenLoader />
  if (profile && !profile.onboarding_complete) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}
