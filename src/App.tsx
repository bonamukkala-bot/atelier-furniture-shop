import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/AdminDashboard'
import StorefrontPage from './pages/StorefrontPage'
import ProductDetailPage from './pages/ProductDetailPage'
import OrderTrackingPage from './pages/OrderTrackingPage'
import PartnerLoginPage from './pages/PartnerLoginPage'
import PartnerDashboardPage from './pages/PartnerDashboardPage'
import ProtectedRoute from './components/ProtectedRoute'
import PartnerProtectedRoute from './components/PartnerProtectedRoute'
import { ToastProvider } from './context/ToastContext'

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<StorefrontPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/track/:tracking_token" element={<OrderTrackingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        {/* Delivery Partner Portal Routes */}
        <Route path="/partner-login" element={<PartnerLoginPage />} />
        <Route path="/partner/login" element={<Navigate to="/partner-login" replace />} />
        <Route
          path="/partner/dashboard"
          element={
            <PartnerProtectedRoute>
              <PartnerDashboardPage />
            </PartnerProtectedRoute>
          }
        />
        <Route
          path="/partner"
          element={<Navigate to="/partner/dashboard" replace />}
        />
      </Routes>
    </ToastProvider>
  )
}

export default App
