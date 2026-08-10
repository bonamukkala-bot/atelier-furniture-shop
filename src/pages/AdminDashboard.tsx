import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import ProductForm from '../components/ProductForm'
import ProductList from '../components/ProductList'
import OrderForm from '../components/OrderForm'
import OrderList from '../components/OrderList'
import Customers from '../components/Customers'
import Settings from '../components/Settings'
import { ToastProvider, useToast } from '../context/ToastContext'
import type { Product } from '../lib/types'

type ActiveView = 'dashboard' | 'products' | 'orders' | 'customers' | 'settings'
type DrawerMode = 'product-add' | 'product-edit' | 'order-add' | null

interface DashboardStats {
  totalProducts: number
  inStock: number
  totalOrders: number
  pendingReviews: number
  totalRevenue: number
  thisWeekSales: number
  bestSellingProduct: { name: string; unitsSold: number } | null
  lowStockProducts: { name: string; stockQty: number }[]
}

// ── Sidebar Icons ──────────────────────────────────────────────────────────────
const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
)

const IconProducts = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
)

const IconOrders = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
)

const IconCustomers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const IconSettings = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const IconLogout = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const IconMenu = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const IconClose = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// ── Stat Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: number | string
  loading: boolean
  icon: React.ReactNode
  accent?: string
}

function StatCard({ label, value, loading, icon, accent = '#B8874B' }: StatCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E4DDD1',
        borderRadius: 16,
        padding: '28px 24px 24px',
        boxShadow: '0 2px 12px rgba(74,55,40,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        flex: '1 1 180px',
        minWidth: 150,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ color: accent, opacity: 0.7 }}>{icon}</div>
      <div
        className="stat-card-value"
        style={{
          fontSize: 'clamp(1.25rem, 3.5vw, 2.5rem)',
          fontWeight: 700,
          lineHeight: 1.1,
          color: accent,
          fontFamily: 'Fraunces, serif',
          marginTop: 4,
          wordBreak: 'normal',
          overflowWrap: 'normal',
        }}
      >
        {loading ? (
          <span
            style={{
              display: 'inline-block',
              width: 48,
              height: 36,
              background: 'linear-gradient(90deg, #E4DDD1 25%, #FAF7F2 50%, #E4DDD1 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s infinite',
              borderRadius: 4,
            }}
          />
        ) : (
          value
        )}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#6B7259',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ── Slide-Over Drawer ─────────────────────────────────────────────────────────
interface DrawerProps {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

function SlideOverDrawer({ title, open, onClose, children }: DrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(43,36,32,0.4)',
              zIndex: 100,
            }}
          />

          {/* Panel */}
          <motion.div
            key="drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(440px, 100vw)',
              background: '#FAF7F2',
              zIndex: 101,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 40px rgba(43,36,32,0.14)',
              overflowY: 'auto',
            }}
          >
            {/* Drawer header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderBottom: '1px solid #E4DDD1',
                background: '#fff',
                flexShrink: 0,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#B8874B',
                    fontFamily: 'Inter, sans-serif',
                    marginBottom: 3,
                  }}
                >
                  Atelier Admin
                </div>
                <h2
                  style={{
                    fontFamily: 'Fraunces, serif',
                    fontSize: 20,
                    fontWeight: 400,
                    color: '#2B2420',
                    margin: 0,
                  }}
                >
                  {title}
                </h2>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: '1px solid #E4DDD1',
                  borderRadius: 2,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  color: '#6B7259',
                  display: 'flex',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#FAF7F2'
                  e.currentTarget.style.borderColor = '#B8874B'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.borderColor = '#E4DDD1'
                }}
                aria-label="Close panel"
              >
                <IconClose />
              </button>
            </div>

            {/* Drawer content */}
            <div style={{ flex: 1, padding: '28px 24px' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Inner component (needs ToastContext already provided) ─────────────────────
function AdminDashboardInner() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  // ── Layout state ──
  const [activeView, setActiveView] = useState<ActiveView>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Drawer state (replaces showProductForm / showOrderForm) ──
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined)

  // ── Dashboard stats state (read-only supabase queries) ──
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    inStock: 0,
    totalOrders: 0,
    pendingReviews: 0,
    totalRevenue: 0,
    thisWeekSales: 0,
    bestSellingProduct: null,
    lowStockProducts: [],
  })
  const [statsLoading, setStatsLoading] = useState(true)

  // ── Review requests state ──
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null)
  const [pendingReviewRequests, setPendingReviewRequests] = useState<any[]>([])
  const [reviewRequestsLoading, setReviewRequestsLoading] = useState(true)

  // ── Refresh keys (unchanged) ──
  const [productRefreshKey, setProductRefreshKey] = useState(0)
  const [orderRefreshKey, setOrderRefreshKey] = useState(0)

  useEffect(() => {
    fetchStats()
    fetchReviewRequestsData()
  }, [productRefreshKey, orderRefreshKey])

  // ── Fetch shop_settings and pending review requests ──
  async function fetchReviewRequestsData() {
    setReviewRequestsLoading(true)

    // Fetch shop_settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('shop_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (!settingsError && settingsData) {
      setGooglePlaceId(settingsData.google_place_id)
    }

    // Fetch orders where review_requested = false
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(`
        *,
        customers ( name, phone ),
        products ( name )
      `)
      .eq('review_requested', false)
      .order('order_date', { ascending: false })

    if (!ordersError && ordersData) {
      // Calculate which orders are due for review requests
      const today = new Date()
      const delayDays = settingsData?.review_delay_days ?? 4

      const dueOrders = ordersData
        .map((order: any) => ({
          id: order.id,
          customer_name: order.customers?.name ?? 'Unknown',
          customer_phone: order.customers?.phone ?? null,
          product_name: order.products?.name ?? 'Unknown product',
          order_date: order.order_date,
          days_since_purchase: Math.floor(
            (today.getTime() - new Date(order.order_date).getTime()) / (1000 * 60 * 60 * 24)
          ),
        }))
        .filter((order) => order.days_since_purchase >= delayDays)

      setPendingReviewRequests(dueOrders)
    }

    setReviewRequestsLoading(false)
  }

  // ── fetchStats — unchanged read-only queries ──
  async function fetchStats() {
    setStatsLoading(true)
    const [
      { count: totalProducts },
      { count: inStock },
      { count: totalOrders },
      { count: pendingReviews },
      { data: ordersData },
      { data: productsData },
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('products').select('*', { count: 'exact', head: true }).eq('sold', false),
      supabase.from('orders').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('review_requested', false),
      supabase.from('orders').select('total, order_date, product_id, quantity'),
      supabase.from('products').select('id, name, stock_qty'),
    ])

    // Calculate total revenue
    const totalRevenue = (ordersData ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0)

    // Calculate this week's sales (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const thisWeekSales = (ordersData ?? [])
      .filter((o) => o.order_date && new Date(o.order_date) >= sevenDaysAgo)
      .reduce((sum, o) => sum + (o.total ?? 0), 0)

    // Find best-selling product
    const productSales = new Map<string, number>()
    ;(ordersData ?? []).forEach((o) => {
      const current = productSales.get(o.product_id) ?? 0
      productSales.set(o.product_id, current + (o.quantity ?? 0))
    })
    let bestSellingProduct: { name: string; unitsSold: number } | null = null
    let maxUnits = 0
    productSales.forEach((units, productId) => {
      if (units > maxUnits) {
        maxUnits = units
        const product = (productsData ?? []).find((p) => p.id === productId)
        if (product) {
          bestSellingProduct = { name: product.name, unitsSold: units }
        }
      }
    })

    // Find low stock products (stock_qty > 0 and <= 2)
    const lowStockProducts = (productsData ?? [])
      .filter((p) => p.stock_qty > 0 && p.stock_qty <= 2)
      .map((p) => ({ name: p.name, stockQty: p.stock_qty }))

    setStats({
      totalProducts: totalProducts ?? 0,
      inStock: inStock ?? 0,
      totalOrders: totalOrders ?? 0,
      pendingReviews: pendingReviews ?? 0,
      totalRevenue,
      thisWeekSales,
      bestSellingProduct,
      lowStockProducts,
    })
    setStatsLoading(false)
  }

  // ── Existing handlers — UNCHANGED logic ──
  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function handleAddProduct() {
    setEditingProduct(undefined)
    setDrawerMode('product-add')
  }

  function handleEditProduct(product: Product) {
    setEditingProduct(product)
    setDrawerMode('product-edit')
  }

  function handleProductSuccess() {
    const wasEditing = drawerMode === 'product-edit'
    setDrawerMode(null)
    setEditingProduct(undefined)
    setProductRefreshKey((prev) => prev + 1)
    showToast(wasEditing ? 'Product updated successfully.' : 'Product added successfully.', 'success')
  }

  function handleOrderSuccess() {
    setDrawerMode(null)
    setOrderRefreshKey((prev) => prev + 1)
    setProductRefreshKey((prev) => prev + 1)
    showToast('Order recorded successfully.', 'success')
  }

  function closeDrawer() {
    setDrawerMode(null)
    setEditingProduct(undefined)
  }

  function goTo(view: ActiveView) {
    setActiveView(view)
    setSidebarOpen(false)
  }

  // ── Send review request via WhatsApp ──
  async function handleSendReviewRequest(order: any) {
    if (!googlePlaceId) {
      showToast('Set your Google Business Place ID in Settings to enable review requests.', 'error')
      return
    }

    if (!order.customer_phone) {
      showToast('No phone number on file for this customer.', 'error')
      return
    }

    // Construct Google review URL
    const googleReviewUrl = `https://search.google.com/local/writereview?placeid=${googlePlaceId}`

    // Try to shorten URL using TinyURL API
    let reviewLink = googleReviewUrl
    try {
      const tinyUrlResponse = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(googleReviewUrl)}`)
      if (tinyUrlResponse.ok) {
        const shortUrl = await tinyUrlResponse.text()
        if (shortUrl) {
          reviewLink = shortUrl
        }
      }
    } catch (error) {
      // If TinyURL fails, fall back to full URL
      console.warn('Failed to shorten URL:', error)
    }

    // Construct multi-line message
    const message = `Hi ${order.customer_name}! 👋

Thank you for choosing Atelier Fine Furniture for your ${order.product_name}. We hope it's already found its perfect place in your home.

Your experience matters a lot to us — if you have a moment, we'd be truly grateful if you could share it in a quick Google review:

${reviewLink}

Thank you for supporting our craft. 🙏
— Team Atelier`

    const encodedMessage = encodeURIComponent(message)
    const whatsappUrl = `https://wa.me/${order.customer_phone}?text=${encodedMessage}`

    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank')

    // Update order's review_requested field
    const { error } = await supabase
      .from('orders')
      .update({ review_requested: true })
      .eq('id', order.id)

    if (error) {
      showToast('Failed to mark review request as sent', 'error')
    } else {
      showToast('Review request opened in WhatsApp', 'success')
      // Refresh the pending list
      fetchReviewRequestsData()
    }
  }

  const navItems: { view: ActiveView; label: string; icon: React.ReactNode }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: <IconDashboard /> },
    { view: 'products', label: 'Products', icon: <IconProducts /> },
    { view: 'orders', label: 'Orders', icon: <IconOrders /> },
    { view: 'customers', label: 'Customers', icon: <IconCustomers /> },
    { view: 'settings', label: 'Settings', icon: <IconSettings /> },
  ]

  const drawerTitle =
    drawerMode === 'product-edit'
      ? 'Edit Product'
      : drawerMode === 'product-add'
      ? 'Add New Product'
      : 'Record Order'

  return (
    <>
      {/* ── Global CSS ──────────────────────────────────────────────────── */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .admin-nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          min-height: 46px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(250,247,242,0.8);
          background: transparent;
          border: none;
          width: 100%;
          text-align: left;
          transition: background 0.24s ease, color 0.24s ease, transform 0.24s ease;
          font-family: Inter, sans-serif;
        }
        .admin-nav-item:hover {
          background: rgba(250,247,242,0.12);
          color: #FAF7F2;
          transform: translateX(1px);
        }
        .admin-nav-item.active {
          background: linear-gradient(180deg, rgba(184,135,75,0.18), rgba(250,247,242,0.04));
          color: #FAF7F2;
          border-left: 3px solid #B8874B;
          padding-left: 18px;
        }
        .admin-add-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: #4A3728;
          color: #FAF7F2;
          border: none;
          padding: 12px 22px;
          min-height: 48px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          border-radius: 999px;
          transition: background 0.24s ease, transform 0.24s ease, box-shadow 0.24s ease;
          font-family: Inter, sans-serif;
          box-shadow: 0 12px 28px rgba(74,55,40,0.12);
        }
        .admin-add-btn:hover {
          background: #2B2420;
          transform: translateY(-1px);
        }
        .admin-section-title {
          font-family: 'Fraunces', serif;
          font-size: clamp(1.9rem, 2.25vw, 2.35rem);
          font-weight: 400;
          color: #2B2420;
          margin: 0 0 8px 0;
          letter-spacing: -0.03em;
        }
        .admin-section-sub {
          font-size: 0.95rem;
          color: #6B7259;
          letter-spacing: 0.04em;
          margin: 0 0 28px 0;
          max-width: 700px;
          line-height: 1.65;
          font-family: Inter, sans-serif;
        }
        .admin-content-card {
          background: #fff;
          border: 1px solid #E4DDD1;
          border-radius: 16px;
          box-shadow: 0 18px 46px rgba(74,55,40,0.08);
          padding: 28px;
        }
        .admin-panel-card {
          background: #fff;
          border: 1px solid #E4DDD1;
          border-radius: 16px;
          box-shadow: 0 14px 34px rgba(74,55,40,0.06);
          padding: 24px 28px;
        }
        .admin-panel-card.has-alert {
          border-color: rgba(192,82,60,0.24);
          background: rgba(255,248,241,0.95);
        }
        .admin-panel-heading {
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6B7259;
          font-family: Inter, sans-serif;
        }
        .admin-panel-title {
          font-family: 'Fraunces', serif;
          font-size: 1rem;
          color: #2B2420;
          margin: 0.35rem 0 0;
          line-height: 1.25;
        }
        .admin-stats-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .admin-review-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .admin-review-item {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 16px 18px;
          background: #FAF7F2;
          border: 1px solid #E4DDD1;
          border-radius: 14px;
          gap: 16px;
        }
        .admin-review-item .content {
          min-width: 0;
        }
        .admin-review-item h3 {
          margin: 0 0 6px;
          font-size: 0.95rem;
          color: #2B2420;
          font-weight: 600;
          font-family: Inter, sans-serif;
          word-break: break-word;
        }
        .admin-review-item p {
          margin: 0;
          font-size: 0.89rem;
          color: #6B7259;
          font-family: Inter, sans-serif;
          line-height: 1.55;
        }
        .admin-review-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 16px;
          min-height: 44px;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          transition: background 0.22s ease, transform 0.22s ease, opacity 0.22s ease;
          border: none;
          cursor: pointer;
          font-family: Inter, sans-serif;
        }
        .admin-review-action.enabled {
          background: #25D366;
          color: #FAF7F2;
        }
        .admin-review-action.enabled:hover {
          background: #128C7E;
          transform: translateY(-1px);
        }
        .admin-review-action.disabled {
          background: rgba(37,211,102,0.22);
          color: rgba(250,247,242,0.85);
          cursor: not-allowed;
          opacity: 0.72;
        }
        .admin-warning-row {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .admin-warning-row .warning-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          background: rgba(192,82,60,0.08);
          border: 1px solid rgba(192,82,60,0.18);
          border-radius: 14px;
        }
        .admin-warning-row .warning-item span {
          font-size: 0.95rem;
          color: #2B2420;
          font-weight: 600;
          font-family: Inter, sans-serif;
        }
        .admin-warning-row .warning-item strong {
          font-size: 0.82rem;
          color: #C0523C;
          font-weight: 700;
          letter-spacing: 0.08em;
          font-family: Inter, sans-serif;
        }
        .admin-cta-row {
          display: flex;
          gap: 14px;
          flex-wrap: wrap;
        }
        .admin-cta-btn {
          background: #4A3728;
          color: #FAF7F2;
          border: none;
          padding: 14px 24px;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border-radius: 999px;
          cursor: pointer;
          transition: background 0.22s ease, transform 0.22s ease;
          font-family: Inter, sans-serif;
          min-height: 48px;
        }
        .admin-cta-btn:hover {
          background: #2B2420;
          transform: translateY(-1px);
        }
        .admin-cta-btn-secondary {
          background: transparent;
          color: #4A3728;
          border: 1px solid #E4DDD1;
        }
        .admin-cta-btn-secondary:hover {
          background: #FAF7F2;
          border-color: #B8874B;
        }
        @media (max-width: 1024px) {
          .admin-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 640px) {
          .admin-stats-grid {
            grid-template-columns: 1fr;
          }
          .admin-review-item {
            flex-direction: column;
            align-items: stretch;
          }
          .admin-cta-row {
            justify-content: stretch;
          }
          .admin-cta-btn,
          .admin-cta-btn-secondary {
            width: 100%;
          }
        }
        @media (max-width: 768px) {
          .admin-sidebar {
            transform: translateX(-100%);
          }
          .admin-sidebar.open {
            transform: translateX(0);
          }
          .admin-right {
            margin-left: 0 !important;
          }
          .admin-mobile-header {
            display: flex !important;
          }
          .admin-main {
            padding: 20px 16px !important;
          }
        }
        @media (min-width: 769px) {
          .admin-sidebar {
            transform: translateX(0) !important;
          }
        }
      `}</style>

      {/* ── Slide-Over Drawer ────────────────────────────────────────────── */}
      <SlideOverDrawer
        title={drawerTitle}
        open={drawerMode !== null}
        onClose={closeDrawer}
      >
        {(drawerMode === 'product-add' || drawerMode === 'product-edit') && (
          <ProductForm
            existingProduct={editingProduct}
            onSuccess={handleProductSuccess}
            onCancel={closeDrawer}
          />
        )}
        {drawerMode === 'order-add' && (
          <OrderForm
            onSuccess={handleOrderSuccess}
            onCancel={closeDrawer}
          />
        )}
      </SlideOverDrawer>

      <div
        style={{
          display: 'flex',
          height: '100vh',
          overflow: 'hidden',
          background: '#FAF7F2',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* ── Mobile overlay ─────────────────────────────────────────────── */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(43,36,32,0.45)',
              zIndex: 40,
            }}
          />
        )}

        {/* ── Sidebar ────────────────────────────────────────────────────── */}
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            background: '#4A3728',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 50,
            transition: 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
          }}
          className={`admin-sidebar${sidebarOpen ? ' open' : ''}`}
        >
          {/* Wordmark */}
          <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid rgba(250,247,242,0.1)' }}>
            <div
              style={{
                fontFamily: 'Fraunces, serif',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '0.04em',
                color: '#FAF7F2',
                lineHeight: 1,
              }}
            >
              ATELIER
            </div>
            <div
              style={{
                fontSize: 9,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: '#B8874B',
                marginTop: 5,
                fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Admin Panel
            </div>
          </div>

          {/* Nav items */}
          <nav style={{ padding: '16px 12px', flex: 1 }}>
            <div
              style={{
                fontSize: 9,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(250,247,242,0.35)',
                fontWeight: 600,
                padding: '0 8px 10px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Navigation
            </div>
            {navItems.map(({ view, label, icon }) => (
              <button
                key={view}
                onClick={() => goTo(view)}
                className={`admin-nav-item${activeView === view ? ' active' : ''}`}
              >
                {icon}
                {label}
              </button>
            ))}
          </nav>

          {/* Log Out */}
          <div style={{ padding: '16px 12px 24px', borderTop: '1px solid rgba(250,247,242,0.1)' }}>
            <button
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                background: 'transparent',
                border: '1px solid rgba(250,247,242,0.2)',
                borderRadius: 2,
                color: 'rgba(250,247,242,0.65)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                width: '100%',
                fontFamily: 'Inter, sans-serif',
                transition: 'background 0.18s, color 0.18s, border-color 0.18s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.background = 'rgba(184,135,75,0.15)'
                el.style.borderColor = '#B8874B'
                el.style.color = '#B8874B'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.background = 'transparent'
                el.style.borderColor = 'rgba(250,247,242,0.2)'
                el.style.color = 'rgba(250,247,242,0.65)'
              }}
            >
              <IconLogout />
              Log Out
            </button>
          </div>
        </aside>

        {/* ── Right side ──────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            marginLeft: 240,
            height: '100vh',
            overflow: 'hidden',
          }}
          className="admin-right"
        >
          {/* Mobile header */}
          <header
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              background: '#4A3728',
              borderBottom: '1px solid rgba(250,247,242,0.1)',
              flexShrink: 0,
            }}
            className="admin-mobile-header"
          >
            <button
              onClick={() => setSidebarOpen(true)}
              style={{ background: 'none', border: 'none', color: '#FAF7F2', cursor: 'pointer', padding: 4, display: 'flex' }}
              aria-label="Open menu"
            >
              <IconMenu />
            </button>
            <span
              style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, color: '#FAF7F2', letterSpacing: '0.04em' }}
            >
              ATELIER
            </span>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#FAF7F2',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                opacity: sidebarOpen ? 1 : 0,
                pointerEvents: sidebarOpen ? 'auto' : 'none',
              }}
              aria-label="Close menu"
            >
              <IconClose />
            </button>
          </header>

          {/* Scrollable main */}
          <main
            style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', background: '#FAF7F2' }}
            className="admin-main"
          >
            {/* ════════ DASHBOARD ════════ */}
            {activeView === 'dashboard' && (
              <div>
                <div style={{ marginBottom: 36 }}>
                  <h1 className="admin-section-title">Overview</h1>
                  <p className="admin-section-sub">Welcome back — here's a snapshot of your store.</p>
                </div>

                <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 36 }}>
                  <StatCard label="Total Products" value={stats.totalProducts} loading={statsLoading} icon={<IconProducts />} />
                  <StatCard
                    label="In Stock"
                    value={stats.inStock}
                    loading={statsLoading}
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    }
                    accent="#6B7259"
                  />
                  <StatCard label="Total Orders" value={stats.totalOrders} loading={statsLoading} icon={<IconOrders />} />
                  <StatCard
                    label="Pending Reviews"
                    value={stats.pendingReviews}
                    loading={statsLoading}
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    }
                    accent="#B8874B"
                  />
                  <StatCard
                    label="Total Revenue"
                    value={statsLoading ? '' : `₹${stats.totalRevenue.toLocaleString('en-IN')}`}
                    loading={statsLoading}
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    }
                    accent="#4A3728"
                  />
                  <StatCard
                    label="This Week's Sales"
                    value={statsLoading ? '' : `₹${stats.thisWeekSales.toLocaleString('en-IN')}`}
                    loading={statsLoading}
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                        <polyline points="17 6 23 6 23 12" />
                      </svg>
                    }
                    accent="#B8874B"
                  />
                  <StatCard
                    label="Best-Selling Product"
                    value={statsLoading ? '' : stats.bestSellingProduct?.name ?? '—'}
                    loading={statsLoading}
                    icon={
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" />
                        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                      </svg>
                    }
                    accent="#6B7259"
                  />
                </div>

                {/* Pending Review Requests */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: 16, fontWeight: 400, color: '#2B2420', margin: 0 }}>
                        Pending Review Requests
                      </h2>
                      {pendingReviewRequests.length > 0 && (
                        <span
                          style={{
                            background: '#B8874B',
                            color: '#FAF7F2',
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            padding: '2px 6px',
                            borderRadius: 2,
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {pendingReviewRequests.length} due
                        </span>
                      )}
                    </div>
                  </div>

                  {!googlePlaceId && (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'rgba(192,82,60,0.05)',
                        border: '1px solid rgba(192,82,60,0.15)',
                        borderRadius: 2,
                        marginBottom: 12,
                      }}
                    >
                      <p style={{ fontSize: 11, color: '#C0523C', margin: 0, fontFamily: 'Inter, sans-serif' }}>
                        Set your Google Business Place ID in Settings to enable review requests.
                      </p>
                    </div>
                  )}

                  {reviewRequestsLoading ? (
                    <p style={{ fontSize: 12, color: '#6B7259', fontFamily: 'Inter, sans-serif' }}>Loading...</p>
                  ) : pendingReviewRequests.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#6B7259', fontFamily: 'Inter, sans-serif' }}>
                      No review requests due right now — check back later.
                    </p>
                  ) : (
                    <div className="admin-review-list">
                      {pendingReviewRequests.map((order) => (
                        <div key={order.id} className="admin-review-item">
                          <div className="content">
                            <h3>{order.customer_name}</h3>
                            <p style={{ marginBottom: 4 }}>{order.product_name}</p>
                            <p>{order.days_since_purchase} days since purchase</p>
                          </div>
                          <button
                            onClick={() => handleSendReviewRequest(order)}
                            disabled={!googlePlaceId || !order.customer_phone}
                            className={`admin-review-action ${googlePlaceId && order.customer_phone ? 'enabled' : 'disabled'}`}
                          >
                            {order.customer_phone ? 'Send Review Request' : 'No phone number'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Low Stock Warning Section */}
                <div style={{ marginBottom: 44 }}>
                  <div className="admin-panel-card has-alert">
                    <div className="admin-panel-heading">Low Stock Warning</div>
                    {stats.lowStockProducts.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#6B7259', fontFamily: 'Inter, sans-serif', margin: '14px 0 0 0' }}>
                        All stock levels healthy.
                      </p>
                    ) : (
                      <div className="admin-warning-row" style={{ marginTop: 16 }}>
                        {stats.lowStockProducts.map((product) => (
                          <div key={product.name} className="warning-item">
                            <span>{product.name}</span>
                            <strong>{product.stockQty} unit{product.stockQty === 1 ? '' : 's'} left</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div className="admin-panel-heading" style={{ marginBottom: 16 }}>
                    Quick Actions
                  </div>
                  <div className="admin-cta-row">
                    <button onClick={() => goTo('products')} className="admin-cta-btn">
                      Manage Products
                    </button>
                    <button onClick={() => goTo('orders')} className="admin-cta-btn admin-cta-btn-secondary">
                      View Orders
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ════════ PRODUCTS ════════ */}
            {activeView === 'products' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
                  <div>
                    <h1 className="admin-section-title">Products</h1>
                    <p className="admin-section-sub">Manage your furniture catalog.</p>
                  </div>
                  <button onClick={handleAddProduct} className="admin-add-btn" style={{ marginBottom: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Add Product
                  </button>
                </div>

                <div className="admin-content-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '20px 28px', borderBottom: '1px solid #E4DDD1' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B7259', fontFamily: 'Inter, sans-serif' }}>
                      All Products
                    </span>
                  </div>
                  <div style={{ padding: 28 }}>
                    <ProductList onEdit={handleEditProduct} refreshKey={productRefreshKey} />
                  </div>
                </div>
              </div>
            )}

            {/* ════════ ORDERS ════════ */}
            {activeView === 'orders' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 32 }}>
                  <div>
                    <h1 className="admin-section-title">Orders</h1>
                    <p className="admin-section-sub">Record and track customer orders.</p>
                  </div>
                  <button onClick={() => setDrawerMode('order-add')} className="admin-add-btn" style={{ marginBottom: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Record Order
                  </button>
                </div>

                <div className="admin-content-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '20px 28px', borderBottom: '1px solid #E4DDD1' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6B7259', fontFamily: 'Inter, sans-serif' }}>
                      All Orders
                    </span>
                  </div>
                  <div style={{ padding: 28 }}>
                    <OrderList refreshKey={orderRefreshKey} />
                  </div>
                </div>
              </div>
            )}

            {/* ════════ CUSTOMERS ════════ */}
            {activeView === 'customers' && <Customers />}

            {/* ════════ SETTINGS ════════ */}
            {activeView === 'settings' && <Settings />}
          </main>
        </div>
      </div>
    </>
  )
}

// ── Root export — wraps inner with ToastProvider ───────────────────────────────
function AdminDashboard() {
  return (
    <ToastProvider>
      <AdminDashboardInner />
    </ToastProvider>
  )
}

export default AdminDashboard