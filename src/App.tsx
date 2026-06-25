import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { useAuth } from './hooks/useAuth'
import DashboardLayout from './components/layout/DashboardLayout'
import LoadingSpinner from './components/ui/LoadingSpinner'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const UmsaetzePage = lazy(() => import('./pages/UmsaetzePage'))
const ArtikelPage = lazy(() => import('./pages/ArtikelPage'))
const WarengruppenPage = lazy(() => import('./pages/WarengruppenPage'))
const MitarbeiterPage = lazy(() => import('./pages/MitarbeiterPage'))
const ZahlungsartenPage = lazy(() => import('./pages/ZahlungsartenPage'))
const ZeitanalysePage = lazy(() => import('./pages/ZeitanalysePage'))
const KIAnalysePage = lazy(() => import('./pages/KIAnalysePage'))
const KIChatPage = lazy(() => import('./pages/KIChatPage'))
const BerichtePage = lazy(() => import('./pages/BerichtePage'))
const UploadPage = lazy(() => import('./pages/UploadPage'))
const EinstellungenPage = lazy(() => import('./pages/EinstellungenPage'))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
        <Routes>
          <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
          <Route element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/umsaetze" element={<UmsaetzePage />} />
            <Route path="/artikel" element={<ArtikelPage />} />
            <Route path="/warengruppen" element={<WarengruppenPage />} />
            <Route path="/mitarbeiter" element={<MitarbeiterPage />} />
            <Route path="/zahlungsarten" element={<ZahlungsartenPage />} />
            <Route path="/zeitanalyse" element={<ZeitanalysePage />} />
            <Route path="/ki-analyse" element={<KIAnalysePage />} />
            <Route path="/ki-chat" element={<KIChatPage />} />
            <Route path="/berichte" element={<BerichtePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/einstellungen" element={<EinstellungenPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
