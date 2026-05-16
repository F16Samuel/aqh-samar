import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/store/AuthContext'

// Pages — stubs for now, fleshed out in Phase 8
import LoginPage from '@/pages/LoginPage'
import LoadingScreen from '@/components/LoadingScreen'

// Layouts (stubs)
import EmployeeLayout from '@/layouts/EmployeeLayout'
import ManagerLayout from '@/layouts/ManagerLayout'
import AdminLayout from '@/layouts/AdminLayout'

// Employee pages
import MyGoalsPage from '@/pages/employee/MyGoalsPage'

// Manager pages
import ManagerDashboardPage from '@/pages/manager/ManagerDashboardPage'

// Admin pages
import AdminPanelPage from '@/pages/admin/AdminPanelPage'

function PrivateRoute({
  children,
  roles,
}: {
  children: React.ReactNode
  roles?: string[]
}) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />
  return <>{children}</>
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate
                to={user.role === 'manager' ? '/manager' : user.role === 'admin' ? '/admin' : '/'}
                replace
              />
            ) : (
              <LoginPage />
            )
          }
        />
        <Route path="/unauthorized" element={<div style={{padding:'2rem'}}>403 — Access Denied</div>} />

        {/* Employee routes */}
        <Route
          path="/"
          element={
            <PrivateRoute roles={['employee']}>
              <EmployeeLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<MyGoalsPage />} />
        </Route>

        {/* Manager routes */}
        <Route
          path="/manager"
          element={
            <PrivateRoute roles={['manager']}>
              <ManagerLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<ManagerDashboardPage />} />
        </Route>

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <PrivateRoute roles={['admin']}>
              <AdminLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<AdminPanelPage />} />
        </Route>

        {/* Catch-all */}
        <Route
          path="*"
          element={
            user
              ? <Navigate to={user.role === 'manager' ? '/manager' : user.role === 'admin' ? '/admin' : '/'} replace />
              : <Navigate to="/login" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
