import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getStoredPartnerSession,
  partnerLogout,
  fetchPartnerOrders,
  updatePartnerOrderStatus,
  acceptPartnerOrder,
} from '../lib/partnerAuth'
import type { PartnerOrder, PartnerSession } from '../lib/types'
import { useToast } from '../context/ToastContext'
import DeliveryConfirmationModal from '../components/DeliveryConfirmationModal'

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; border: string }
> = {
  out_for_delivery: {
    label: 'Out for Delivery',
    bg: 'rgba(184, 135, 75, 0.18)',
    color: '#8F632E',
    border: '1px solid rgba(184, 135, 75, 0.45)',
  },
  preparing: {
    label: 'Preparing in Workshop',
    bg: 'rgba(107, 114, 89, 0.15)',
    color: '#4A5338',
    border: '1px solid rgba(107, 114, 89, 0.35)',
  },
  confirmed: {
    label: 'Confirmed / Pending',
    bg: 'rgba(184, 135, 75, 0.12)',
    color: '#B8874B',
    border: '1px solid rgba(184, 135, 75, 0.3)',
  },
  delivered: {
    label: 'Delivered',
    bg: 'rgba(74, 93, 62, 0.15)',
    color: '#384E2E',
    border: '1px solid rgba(74, 93, 62, 0.35)',
  },
  issue: {
    label: 'Issue / Attention Needed',
    bg: 'rgba(192, 82, 60, 0.15)',
    color: '#A84B3B',
    border: '1px solid rgba(192, 82, 60, 0.35)',
  },
}

export default function PartnerDashboardPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [session, setSession] = useState<PartnerSession | null>(null)
  const [orders, setOrders] = useState<PartnerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'out_for_delivery' | 'preparing' | 'delivered'>('all')
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)

  // ── Delivery Confirmation Modal State (Item 4 reused logic) ──
  const [confirmModalOrder, setConfirmModalOrder] = useState<PartnerOrder | null>(null)

  useEffect(() => {
    const s = getStoredPartnerSession()
    if (!s || !s.token) {
      navigate('/partner-login', { replace: true })
      return
    }
    setSession(s)
    loadOrders(s.token)
  }, [navigate])

  async function loadOrders(token: string, isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const data = await fetchPartnerOrders(token)
      setOrders(data)
    } catch (err: any) {
      console.error('Error fetching partner orders:', err)
      showToast(err.message || 'Failed to load assigned deliveries.', 'error')
      if (err.message?.includes('Invalid or expired')) {
        navigate('/partner-login', { replace: true })
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  function handleLogout() {
    partnerLogout()
    showToast('Logged out of delivery portal.', 'success')
    navigate('/partner-login', { replace: true })
  }

  // Accept Assigned Order
  async function handleAcceptOrder(order: PartnerOrder) {
    if (!session?.token) return
    setStatusUpdatingId(order.id)

    try {
      await acceptPartnerOrder(session.token, order.id)
      showToast('Order accepted for delivery!', 'success')
      await loadOrders(session.token, true)
    } catch (err: any) {
      console.error('Failed to accept order:', err)
      showToast(err.message || 'Failed to accept order.', 'error')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  // Quick Status Transition (e.g. Preparing -> Out for Delivery)
  async function handleQuickStatusChange(order: PartnerOrder, newStatus: string) {
    if (!session?.token) return
    setStatusUpdatingId(order.id)

    try {
      await updatePartnerOrderStatus(session.token, order.id, newStatus)
      showToast(`Status updated to "${STATUS_CONFIG[newStatus]?.label || newStatus}"`, 'success')
      await loadOrders(session.token, true)
    } catch (err: any) {
      console.error('Failed to update status:', err)
      showToast(err.message || 'Status update failed.', 'error')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders
    if (filter === 'out_for_delivery') {
      return orders.filter((o) => (o.delivery_status || 'confirmed') === 'out_for_delivery')
    }
    if (filter === 'preparing') {
      return orders.filter((o) => ['preparing', 'confirmed'].includes(o.delivery_status || 'confirmed'))
    }
    if (filter === 'delivered') {
      return orders.filter((o) => (o.delivery_status || '') === 'delivered')
    }
    return orders
  }, [orders, filter])

  // Count stats
  const activeDeliveryCount = useMemo(
    () => orders.filter((o) => (o.delivery_status || 'confirmed') === 'out_for_delivery').length,
    [orders]
  )
  const preparingCount = useMemo(
    () => orders.filter((o) => ['preparing', 'confirmed'].includes(o.delivery_status || 'confirmed')).length,
    [orders]
  )
  const deliveredCount = useMemo(
    () => orders.filter((o) => o.delivery_status === 'delivered').length,
    [orders]
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAF7F2',
        color: '#2B2420',
        fontFamily: 'Inter, sans-serif',
        paddingBottom: 60,
      }}
    >
      {/* ── Top App Bar ── */}
      <header
        style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E4DDD1',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            margin: '0 auto',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                background: '#4A3728',
                color: '#FAF7F2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 16,
                fontFamily: 'Fraunces, serif',
              }}
            >
              A
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2B2420', lineHeight: 1.2 }}>
                {session?.partner?.name || 'Delivery Partner'}
              </div>
              <div style={{ fontSize: 11, color: '#6B7259' }}>
                Atelier Logistics · {session?.partner?.phone || ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => session?.token && loadOrders(session.token, true)}
              disabled={refreshing}
              title="Refresh assigned orders"
              style={{
                background: '#FAF7F2',
                border: '1px solid #E4DDD1',
                borderRadius: 4,
                padding: '6px 10px',
                fontSize: 12,
                color: '#4A3728',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              style={{
                background: 'rgba(192, 82, 60, 0.08)',
                border: '1px solid rgba(192, 82, 60, 0.25)',
                borderRadius: 4,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                color: '#C0523C',
                cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '16px 16px' }}>
        {/* Metric Summary Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {/* Out for Delivery Stat */}
          <div
            onClick={() => setFilter('out_for_delivery')}
            style={{
              background: filter === 'out_for_delivery' ? '#FAF3E8' : '#FFFFFF',
              border: `1px solid ${filter === 'out_for_delivery' ? '#B8874B' : '#E4DDD1'}`,
              borderRadius: 4,
              padding: '12px 10px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: filter === 'out_for_delivery' ? '0 2px 6px rgba(184, 135, 75, 0.15)' : 'none',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: '#B8874B' }}>{activeDeliveryCount}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#4A3728', marginTop: 2 }}>Out for Delivery</div>
          </div>

          {/* Preparing / Confirmed Stat */}
          <div
            onClick={() => setFilter('preparing')}
            style={{
              background: filter === 'preparing' ? '#F2F5ED' : '#FFFFFF',
              border: `1px solid ${filter === 'preparing' ? '#6B7259' : '#E4DDD1'}`,
              borderRadius: 4,
              padding: '12px 10px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: filter === 'preparing' ? '0 2px 6px rgba(107, 114, 89, 0.15)' : 'none',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: '#525843' }}>{preparingCount}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#4A3728', marginTop: 2 }}>Ready / Prep</div>
          </div>

          {/* Delivered Stat */}
          <div
            onClick={() => setFilter('delivered')}
            style={{
              background: filter === 'delivered' ? '#EDF5EB' : '#FFFFFF',
              border: `1px solid ${filter === 'delivered' ? '#4A5D3E' : '#E4DDD1'}`,
              borderRadius: 4,
              padding: '12px 10px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: filter === 'delivered' ? '0 2px 6px rgba(74, 93, 62, 0.15)' : 'none',
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: '#4A5D3E' }}>{deliveredCount}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#4A3728', marginTop: 2 }}>Delivered</div>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {(
            [
              { key: 'all', label: `All Orders (${orders.length})` },
              { key: 'out_for_delivery', label: `Out for Delivery (${activeDeliveryCount})` },
              { key: 'preparing', label: `Preparing (${preparingCount})` },
              { key: 'delivered', label: `Delivered (${deliveredCount})` },
            ] as const
          ).map((t) => {
            const active = filter === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  background: active ? '#4A3728' : '#FFFFFF',
                  color: active ? '#FAF7F2' : '#6B7259',
                  border: `1px solid ${active ? '#4A3728' : '#E4DDD1'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ── Order List ── */}
        {loading ? (
          <div
            style={{
              padding: '48px 16px',
              textAlign: 'center',
              color: '#6B7259',
              background: '#FFFFFF',
              border: '1px solid #E4DDD1',
              borderRadius: 4,
            }}
          >
            <div style={{ fontSize: 13 }}>Loading assigned deliveries...</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div
            style={{
              padding: '48px 20px',
              textAlign: 'center',
              background: '#FFFFFF',
              border: '1px dashed #E4DDD1',
              borderRadius: 4,
            }}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#2B2420', margin: '0 0 4px 0' }}>
              No deliveries found
            </h3>
            <p style={{ fontSize: 12, color: '#6B7259', margin: 0 }}>
              {filter !== 'all'
                ? 'No orders matching the selected filter.'
                : 'You have no assigned orders currently. Check back shortly.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {filteredOrders.map((order) => {
              const currentStatus = (order.delivery_status || 'confirmed').toLowerCase()
              const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.confirmed
              const isOutForDelivery = currentStatus === 'out_for_delivery'
              const isDelivered = currentStatus === 'delivered'
              const cleanPhone = (order.customer_phone || '').replace(/\D/g, '')

              return (
                <div
                  key={order.id}
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${isOutForDelivery ? '#B8874B' : '#E4DDD1'}`,
                    borderRadius: 4,
                    padding: 16,
                    boxShadow: isOutForDelivery
                      ? '0 4px 12px rgba(184, 135, 75, 0.12)'
                      : '0 2px 4px rgba(0,0,0,0.02)',
                    position: 'relative',
                  }}
                >
                  {/* Status Strip on left edge if Out for Delivery */}
                  {isOutForDelivery && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: 4,
                        background: '#B8874B',
                        borderTopLeftRadius: 4,
                        borderBottomLeftRadius: 4,
                      }}
                    />
                  )}

                  {/* Header: Order ID & Status Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#8A8178', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Order #{order.id.slice(0, 8).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#2B2420', marginTop: 2 }}>
                        {order.customer_name || 'Customer'}
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background: statusCfg.bg,
                        color: statusCfg.color,
                        border: statusCfg.border,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Product Details */}
                  <div
                    style={{
                      background: '#FAF7F2',
                      border: '1px solid #E4DDD1',
                      borderRadius: 3,
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    {order.product_image_url ? (
                      <img
                        src={order.product_image_url}
                        alt={order.product_name || 'Item'}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 3,
                          objectFit: 'cover',
                          border: '1px solid #E4DDD1',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 3,
                          background: '#E4DDD1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 18,
                        }}
                      >
                        🪑
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: '#2B2420',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {order.product_name || 'Atelier Furniture Piece'}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7259', marginTop: 2 }}>
                        Qty: {order.quantity || 1}
                        {order.total ? ` · ₹${Number(order.total).toLocaleString('en-IN')}` : ''}
                        {order.delivery_zone_name ? ` · ${order.delivery_zone_name}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Delivery Destination Address */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7259', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                      📍 Delivery Address
                    </div>
                    <div style={{ fontSize: 13, color: '#2B2420', lineHeight: 1.4 }}>
                      {order.delivery_address || 'Address registered with studio'}
                    </div>
                  </div>

                  {/* Customer Quick Action Buttons (Call, WhatsApp, Maps) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: cleanPhone ? '1fr 1fr 1fr' : '1fr',
                      gap: 8,
                      marginBottom: 16,
                      paddingTop: 8,
                      borderTop: '1px solid #E4DDD1',
                    }}
                  >
                    {cleanPhone && (
                      <>
                        {/* Call Customer */}
                        <a
                          href={`tel:${cleanPhone}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '8px 10px',
                            background: '#FAF7F2',
                            border: '1px solid #E4DDD1',
                            borderRadius: 3,
                            color: '#4A3728',
                            fontSize: 12,
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          Call
                        </a>

                        {/* WhatsApp Customer */}
                        <a
                          href={`https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '8px 10px',
                            background: '#E8F7EE',
                            border: '1px solid #C3E9D1',
                            borderRadius: 3,
                            color: '#1A7A40',
                            fontSize: 12,
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                          </svg>
                          Chat
                        </a>
                      </>
                    )}

                    {/* Google Maps Navigation */}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        order.delivery_address || 'Hyderabad'
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: '8px 10px',
                        background: '#FAF7F2',
                        border: '1px solid #E4DDD1',
                        borderRadius: 3,
                        color: '#4A3728',
                        fontSize: 12,
                        fontWeight: 600,
                        textDecoration: 'none',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="3 11 22 2 13 21 11 13 3 11" />
                      </svg>
                      Map
                    </a>
                  </div>

                  {/* ── Status Actions / Step Progression ── */}
                  <div style={{ paddingTop: 4 }}>
                    {/* CASE 0: Order Assigned but Pending Partner Acceptance */}
                    {!order.partner_accepted_at && !isDelivered ? (
                      <div
                        style={{
                          background: 'rgba(184, 135, 75, 0.1)',
                          border: '1px solid rgba(184, 135, 75, 0.35)',
                          borderRadius: 4,
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                display: 'inline-block',
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: '#B8874B',
                              }}
                            />
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#8F632E' }}>
                              Pending Your Acceptance
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: '#6B7259' }}>
                            Accept order to enable delivery actions
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAcceptOrder(order)}
                          disabled={statusUpdatingId === order.id}
                          style={{
                            width: '100%',
                            padding: '11px 16px',
                            background: '#4A3728',
                            color: '#FAF7F2',
                            border: 'none',
                            borderRadius: 3,
                            fontSize: 13,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            cursor: statusUpdatingId === order.id ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: '0 2px 6px rgba(74, 55, 40, 0.25)',
                          }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {statusUpdatingId === order.id ? 'Accepting Order...' : 'Accept Order'}
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* CASE 1: Preparing or Confirmed -> Move to Out for Delivery */}
                        {(currentStatus === 'confirmed' || currentStatus === 'preparing') && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            {currentStatus === 'confirmed' && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(order, 'preparing')}
                                disabled={statusUpdatingId === order.id}
                                style={{
                                  flex: 1,
                                  padding: '10px 12px',
                                  background: '#FAF7F2',
                                  border: '1px solid #6B7259',
                                  borderRadius: 3,
                                  color: '#525843',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: statusUpdatingId === order.id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                Mark Preparing
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(order, 'out_for_delivery')}
                              disabled={statusUpdatingId === order.id}
                              style={{
                                flex: 1,
                                padding: '10px 14px',
                                background: '#B8874B',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: 3,
                                fontSize: 12,
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                                cursor: statusUpdatingId === order.id ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="1" y="3" width="15" height="13" rx="1" />
                                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                                <circle cx="5.5" cy="18.5" r="2.5" />
                                <circle cx="18.5" cy="18.5" r="2.5" />
                              </svg>
                              Start Delivery (Out for Delivery)
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    {/* CASE 2: Out for Delivery -> Reused Item 4 Confirm Delivery (Code & Proof Photo) */}
                    {isOutForDelivery && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setConfirmModalOrder(order)}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            background: '#4A5D3E',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 3,
                            fontSize: 13,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: '0 3px 10px rgba(74, 93, 62, 0.3)',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            <path d="m9 12 2 2 4-4" />
                          </svg>
                          Confirm Delivery (Code &amp; Photo)
                        </button>
                      </div>
                    )}

                    {/* CASE 3: Delivered -> Completed info badge & photo view */}
                    {isDelivered && (
                      <div
                        style={{
                          background: 'rgba(74, 93, 62, 0.08)',
                          border: '1px solid rgba(74, 93, 62, 0.25)',
                          borderRadius: 3,
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#384E2E', fontWeight: 600 }}>
                          <span>✓ Delivery Completed</span>
                          {order.delivery_confirmed_via && (
                            <span style={{ fontWeight: 400, color: '#525843' }}>
                              (via {order.delivery_confirmed_via === 'code' ? 'customer code' : 'manual confirmation'})
                            </span>
                          )}
                        </div>

                        {order.proof_of_delivery_url && (
                          <a
                            href={order.proof_of_delivery_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              fontSize: 11,
                              color: '#384E2E',
                              textDecoration: 'underline',
                              fontWeight: 600,
                            }}
                          >
                            View Proof Photo ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* ── Reused Item 4 Confirmation Modal (scoped with partner token & required photo) ── */}
      {confirmModalOrder && session?.token && (
        <DeliveryConfirmationModal
          order={confirmModalOrder}
          isOpen={true}
          isPartnerPortal={true}
          sessionToken={session.token}
          onClose={() => setConfirmModalOrder(null)}
          onSuccess={() => {
            setConfirmModalOrder(null)
            if (session?.token) loadOrders(session.token, true)
          }}
        />
      )}
    </div>
  )
}
