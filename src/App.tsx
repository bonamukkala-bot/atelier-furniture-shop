import { Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/AdminDashboard'
import StorefrontPage from './pages/StorefrontPage'
import ProductDetailPage from './pages/ProductDetailPage'
import ProtectedRoute from './components/ProtectedRoute'
import { ToastProvider } from './context/ToastContext'

function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<StorefrontPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </ToastProvider>
  )
}

export default App
