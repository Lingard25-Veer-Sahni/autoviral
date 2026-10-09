import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { Background } from '@/components/Background'
import { ProtectedRoute, AdminRoute, OnboardingGate } from '@/components/RouteGuards'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'
import Terms from '@/pages/Terms'
import Onboarding from '@/pages/onboarding/Onboarding'
import DashboardLayout from '@/pages/DashboardLayout'
import Overview from '@/pages/Overview'
import Autopilot from '@/pages/Autopilot'
import CreateVideo from '@/pages/CreateVideo'
import VideoManager from '@/pages/VideoManager'
import Accounts from '@/pages/Accounts'
import Billing from '@/pages/Billing'
import AdminPanel from '@/pages/admin/AdminPanel'
import NotFound from '@/pages/NotFound'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Background />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/terms" element={<Terms />} />

          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <OnboardingGate>
                  <DashboardLayout />
                </OnboardingGate>
              </ProtectedRoute>
            }
          >
            <Route index element={<Overview />} />
            <Route path="autopilot" element={<Autopilot />} />
            <Route path="create" element={<CreateVideo />} />
            <Route path="videos" element={<VideoManager />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="billing" element={<Billing />} />
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminPanel />
                </AdminRoute>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
