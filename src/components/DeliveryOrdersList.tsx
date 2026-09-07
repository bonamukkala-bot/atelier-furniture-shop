import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../context/ToastContext'
import type { OrderWithDetails, DeliveryStatusHistory } from '../lib/types'

const DELIVERY_STATUS_CONFIG: Record<
  string,
  { label: string; badgeStyle: { background: string; color: string; border: string }; waMessage: string }
> = {
  confirmed: {
    label: 'Confirmed',
    badgeStyle: {
      background: 'rgba(184, 135, 75, 0.12)',
      color: '#B8874B',
      border: '1px solid rgba(184, 135, 75, 0.35)',
    },
    waMessage: 'Your order has been confirmed and is being processed.',
  },
  preparing: {
    label: 'Preparing',
    badgeStyle: {
      background: 'rgba(107, 114, 89, 0.15)',
      color: '#525843',
      border: '1px solid rgba(107, 114, 89, 0.35)',
    },
    waMessage: 'Your order is currently being prepared at our workshop.',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    badgeStyle: {
      background: 'rgba(184, 135, 75, 0.22)',
      color: '#8F632E',
      border: '1px solid rgba(184, 135, 75, 0.5)',
    },
    waMessage: 'Your order is out for delivery!',
  },
  delivered: {
    label: 'Delivered',
    badgeStyle: {
      background: 'rgba(74, 93, 62, 0.15)',
      color: '#384E2E',
      border: '1px solid rgba(74, 93, 62, 0.35)',
    },
    waMessage: 'Your order has been successfully delivered! Thank you for choosing Atelier.',
  },
  issue: {
    label: 'Issue / On Hold',
    badgeStyle: {
      background: 'rgba(168, 75, 59, 0.15)',
      color: '#A84B3B',
      border: '1px solid rgba(168, 75, 59, 0.35)',
    },
    waMessage: 'There is an update regarding your delivery schedule. Please get in touch with us.',
  },
}

export default function DeliveryOrdersList() {
  const { showToast } = useToast()

  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // ── Status Update Modal State ──
  const [editingOrder, setEditingOrder] = useState<OrderWithDetails | null>(null)
  const [newStatus, setNewStatus] = useState<string>('confirmed')
  const [partnerName, setPartnerName] = useState('')
  const [partnerPhone, setPartnerPhone] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [savingUpdate, setSavingUpdate] = useState(false)

  // ── History View Modal State ──
  const [historyOrder, setHistoryOrder] = useState<OrderWithDetails | null>(null)
  const [historyList, setHistoryList] = useState<DeliveryStatusHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    fetchDeliveryOrders()
  }, [])

  async function fetchDeliveryOrders() {
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`
          *,
          customers ( id, name, phone, email ),
          products ( id, name, price, image_url ),
          delivery_zones ( id, zone_name, fee, transit_min_days, transit_max_days )
        `)
        .eq('fulfillment_type', 'delivery')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setOrders(data || [])
    } catch (err) {
      console.error('Error fetching delivery orders:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch delivery orders')
    } finally {
      setLoading(false)
    }
  }

  // ── Filtered Orders ──
  const filteredOrders = useMemo(() => {
    let result = orders

    if (statusFilter !== 'all') {
      result = result.filter((o) => (o.delivery_status || 'confirmed') === statusFilter)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (o) =>
          (o.customers?.name && o.customers.name.toLowerCase().includes(q)) ||
          (o.customers?.phone && o.customers.phone.toLowerCase().includes(q)) ||
          (o.customer_name && o.customer_name.toLowerCase().includes(q)) ||
          (o.customer_phone && o.customer_phone.toLowerCase().includes(q)) ||
          (o.products?.name && o.products.name.toLowerCase().includes(q)) ||
          (o.product_name && o.product_name.toLowerCase().includes(q)) ||
          (o.delivery_address && o.delivery_address.toLowerCase().includes(q)) ||
          (o.delivery_partner_name && o.delivery_partner_name.toLowerCase().includes(q))
      )
    }

    return result
  }, [orders, statusFilter, searchQuery])

  // ── Open Edit Status Modal ──
  function openEditModal(order: OrderWithDetails) {
    setEditingOrder(order)
    setNewStatus(order.delivery_status || 'confirmed')
    setPartnerName(order.delivery_partner_name || '')
    setPartnerPhone(order.delivery_partner_phone || '')
    setStatusNote('')
  }

  function closeEditModal() {
    setEditingOrder(null)
    setStatusNote('')
    setPartnerName('')
    setPartnerPhone('')
  }

  // ── Save Status & Partner Update ──
  async function handleSaveStatus(e: React.FormEvent) {
    e.preventDefault()
    if (!editingOrder) return

    setSavingUpdate(true)
    try {
      const statusToSave = newStatus
      const trimmedPartnerName = partnerName.trim() || null
      const trimmedPartnerPhone = partnerPhone.trim() || null
      const trimmedNote = statusNote.trim() || null

      // 1. Update the order row in 'orders' table
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          delivery_status: statusToSave,
          delivery_partner_name: trimmedPartnerName,
          delivery_partner_phone: trimmedPartnerPhone,
        })
        .eq('id', editingOrder.id)

      if (orderUpdateError) throw orderUpdateError

      // 2. Insert a NEW row into 'delivery_status_history'
      const { error: historyError } = await supabase
        .from('delivery_status_history')
        .insert({
          order_id: editingOrder.id,
          status: statusToSave,
          note: trimmedNote,
        })

      if (historyError) {
        console.warn('Failed to insert history log:', historyError)
      }

      showToast(`Status updated to "${DELIVERY_STATUS_CONFIG[statusToSave]?.label || statusToSave}"`, 'success')
      closeEditModal()
      fetchDeliveryOrders()
    } catch (err) {
      console.error('Error updating delivery status:', err)
      showToast(err instanceof Error ? err.message : 'Failed to update status', 'error')
    } finally {
      setSavingUpdate(false)
    }
  }

  // ── Fetch & View Status History ──
  async function openHistoryModal(order: OrderWithDetails) {
    setHistoryOrder(order)
    setLoadingHistory(true)
    try {
      const { data, error: histErr } = await supabase
        .from('delivery_status_history')
        .select('*')
        .eq('order_id', order.id)
        .order('changed_at', { ascending: false })

      if (histErr) throw histErr
      setHistoryList(data || [])
    } catch (err) {
      console.error('Error fetching status history:', err)
      showToast('Failed to load status history', 'error')
    } finally {
      setLoadingHistory(false)
    }
  }

  function closeHistoryModal() {
    setHistoryOrder(null)
    setHistoryList([])
  }

  // ── Send WhatsApp Update to Customer ──
  function sendWhatsAppUpdate(order: OrderWithDetails) {
    const rawPhone = (order.customers?.phone || order.customer_phone || '').replace(/\D/g, '')
    if (!rawPhone) {
      showToast('No customer phone number available', 'error')
      return
    }

    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone
    const customerName = order.customers?.name || order.customer_name || 'Customer'
    const productName = order.products?.name || order.product_name || 'furniture order'
    const status = order.delivery_status || 'confirmed'
    const statusText = DELIVERY_STATUS_CONFIG[status]?.waMessage || `Status: ${status}`

    // Tracking URL format: <your-site-domain>/track/<tracking_token>
    const trackingToken = order.tracking_token || order.id
    const trackingUrl = `${window.location.origin}/track/${trackingToken}`

    let partnerInfo = ''
    if (order.delivery_partner_name) {
      partnerInfo = `\nDelivery Partner: ${order.delivery_partner_name}${
        order.delivery_partner_phone ? ` (${order.delivery_partner_phone})` : ''
      }`
    }

    const message = `Hi ${customerName}! Here is an update regarding your Atelier delivery for the ${productName}:\n\n🚚 ${statusText}${partnerInfo}\n\n📍 Track your delivery status online here:\n${trackingUrl}\n\nThank you for choosing Atelier!`

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  if (loading) {
    return (
      <div style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif', padding: '24px 0' }}>
        Loading delivery orders...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ color: '#C0523C', fontSize: 13, fontFamily: 'Inter, sans-serif', padding: '24px 0' }}>
        Error: {error}
      </div>
    )
  }

  return (
    <div>
      {/* ── Top Bar: Search & Status Filters ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search bar */}
          <div style={{ position: 'relative', maxWidth: 320, flex: 1 }}>
            <div
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#B8874B',
                pointerEvents: 'none',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search customer, address, partner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: 34,
                paddingRight: 12,
                paddingTop: 9,
                paddingBottom: 9,
                border: '1px solid #E4DDD1',
                borderRadius: 2,
                fontSize: 13,
                color: '#2B2420',
                background: '#FAF7F2',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
                boxSizing: 'border-box',
                transition: 'border-color 0.18s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
            />
          </div>

          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                { key: 'all', label: 'All Orders' },
                { key: 'confirmed', label: 'Confirmed' },
                { key: 'preparing', label: 'Preparing' },
                { key: 'out_for_delivery', label: 'Out for Delivery' },
                { key: 'delivered', label: 'Delivered' },
                { key: 'issue', label: 'Issue' },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontFamily: 'Inter, sans-serif',
                    background: active ? '#4A3728' : 'transparent',
                    color: active ? '#FAF7F2' : '#6B7259',
                    border: `1px solid ${active ? '#4A3728' : '#E4DDD1'}`,
                    borderRadius: 2,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {filteredOrders.length === 0 ? (
        <div
          style={{
            padding: '40px 20px',
            textAlign: 'center',
            background: '#FAF7F2',
            border: '1px dashed #E4DDD1',
            borderRadius: 2,
          }}
        >
          <p style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif', margin: 0 }}>
            {searchQuery || statusFilter !== 'all'
              ? 'No delivery orders match your filters.'
              : 'No delivery orders recorded yet.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #E4DDD1', borderRadius: 2 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>
            <thead>
              <tr style={{ background: '#FAF7F2', borderBottom: '1px solid #E4DDD1' }}>
                {['Customer', 'Product / Total', 'Delivery Address', 'Status', 'Delivery Partner', 'Date', 'Actions'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 16px',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#6B7259',
                      whiteSpace: 'nowrap',
                      textAlign: h === 'Actions' ? 'right' : 'left',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, idx) => {
                const customerName = order.customers?.name || order.customer_name || 'Customer'
                const customerPhone = order.customers?.phone || order.customer_phone || ''
                const productName = order.products?.name || order.product_name || 'Product'
                const currentStatus = order.delivery_status || 'confirmed'
                const statusCfg = DELIVERY_STATUS_CONFIG[currentStatus] || DELIVERY_STATUS_CONFIG.confirmed

                return (
                  <tr
                    key={order.id}
                    style={{
                      borderBottom: idx === filteredOrders.length - 1 ? 'none' : '1px solid #E4DDD1',
                      background: idx % 2 === 0 ? '#FFFFFF' : '#FAF7F2/40',
                    }}
                  >
                    {/* Customer */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', minWidth: '150px' }}>
                      <div style={{ fontWeight: 600, color: '#2B2420', fontSize: 13 }}>{customerName}</div>
                      {customerPhone && (
                        <div style={{ color: '#6B7259', fontSize: 12, marginTop: 2 }}>{customerPhone}</div>
                      )}
                    </td>

                    {/* Product / Total */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', minWidth: '150px' }}>
                      <div style={{ color: '#2B2420', fontSize: 13, fontWeight: 500 }}>
                        {productName} {order.quantity > 1 ? `(×${order.quantity})` : ''}
                      </div>
                      {order.total && (
                        <div style={{ color: '#B8874B', fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                          ₹{Number(order.total).toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>

                    {/* Delivery Address & Zone */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', maxWidth: '240px' }}>
                      <div style={{ color: '#2B2420', fontSize: 12, lineHeight: 1.4 }}>
                        {order.delivery_address || 'No address specified'}
                      </div>
                      {order.delivery_zones?.zone_name && (
                        <div style={{ fontSize: 11, color: '#6B7259', marginTop: 3 }}>
                          Zone: {order.delivery_zones.zone_name}
                          {order.delivery_fee ? ` (₹${order.delivery_fee})` : ''}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          ...statusCfg.badgeStyle,
                        }}
                      >
                        {statusCfg.label}
                      </span>
                      <div>
                        <button
                          type="button"
                          onClick={() => openHistoryModal(order)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#6B7259',
                            fontSize: 10,
                            padding: 0,
                            marginTop: 4,
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          View History
                        </button>
                      </div>
                    </td>

                    {/* Delivery Partner */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', minWidth: '140px' }}>
                      {order.delivery_partner_name ? (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#2B2420' }}>
                            {order.delivery_partner_name}
                          </div>
                          {order.delivery_partner_phone && (
                            <div style={{ fontSize: 11, color: '#6B7259', marginTop: 2 }}>
                              {order.delivery_partner_phone}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>

                    {/* Date */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', fontSize: 12, color: '#6B7259', whiteSpace: 'nowrap' }}>
                      {formatDate(order.created_at)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {/* Update Status Button */}
                        <button
                          type="button"
                          onClick={() => openEditModal(order)}
                          style={{
                            background: '#FAF7F2',
                            border: '1px solid #E4DDD1',
                            color: '#4A3728',
                            padding: '6px 10px',
                            fontSize: 11,
                            fontWeight: 600,
                            borderRadius: 2,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#B8874B'
                            e.currentTarget.style.color = '#B8874B'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#E4DDD1'
                            e.currentTarget.style.color = '#4A3728'
                          }}
                        >
                          Update Status
                        </button>

                        {/* WhatsApp Notification Button */}
                        <button
                          type="button"
                          onClick={() => sendWhatsAppUpdate(order)}
                          title="Send Status Update to Customer on WhatsApp"
                          style={{
                            background: '#25D366',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 12px',
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            borderRadius: 2,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            transition: 'opacity 0.2s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                          </svg>
                          WhatsApp
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ════════ UPDATE STATUS MODAL ════════ */}
      {editingOrder && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(43, 36, 32, 0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={closeEditModal}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E4DDD1',
              maxWidth: 500,
              width: '100%',
              padding: 28,
              position: 'relative',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Accent Bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: '#B8874B',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 19, fontWeight: 400, color: '#2B2420', margin: 0 }}>
                  Update Delivery Status
                </h3>
                <p style={{ fontSize: 11, color: '#6B7259', fontFamily: 'Inter, sans-serif', margin: '2px 0 0 0' }}>
                  {editingOrder.customers?.name || editingOrder.customer_name} • {editingOrder.products?.name || editingOrder.product_name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                style={{ background: 'none', border: 'none', fontSize: 18, color: '#6B7259', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStatus} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Status Select */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#6B7259',
                    marginBottom: 6,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Delivery Status *
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid #E4DDD1',
                    background: '#FAF7F2',
                    color: '#2B2420',
                    padding: '10px 14px',
                    fontSize: 14,
                    borderRadius: 2,
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                  }}
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="preparing">Preparing</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="issue">Issue / On Hold</option>
                </select>
              </div>

              {/* Status Note */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#6B7259',
                    marginBottom: 6,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Status Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Handed to driver, Scheduled for 4 PM"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid #E4DDD1',
                    background: '#FAF7F2',
                    color: '#2B2420',
                    padding: '10px 14px',
                    fontSize: 13,
                    borderRadius: 2,
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                  }}
                />
                <p style={{ fontSize: 10, color: '#6B7259', marginTop: 4, fontFamily: 'Inter, sans-serif' }}>
                  This note will be logged in the order's delivery status history.
                </p>
              </div>

              {/* Delivery Partner Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 4 }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#6B7259',
                      marginBottom: 6,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Partner Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Ramesh (Dunzo)"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    style={{
                      width: '100%',
                      border: '1px solid #E4DDD1',
                      background: '#FAF7F2',
                      color: '#2B2420',
                      padding: '10px 14px',
                      fontSize: 13,
                      borderRadius: 2,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#6B7259',
                      marginBottom: 6,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Partner Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g., 9876543210"
                    value={partnerPhone}
                    onChange={(e) => setPartnerPhone(e.target.value)}
                    style={{
                      width: '100%',
                      border: '1px solid #E4DDD1',
                      background: '#FAF7F2',
                      color: '#2B2420',
                      padding: '10px 14px',
                      fontSize: 13,
                      borderRadius: 2,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={closeEditModal}
                  style={{
                    background: 'transparent',
                    border: '1px solid #E4DDD1',
                    color: '#6B7259',
                    padding: '9px 16px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    borderRadius: 2,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUpdate}
                  style={{
                    background: '#4A3728',
                    color: '#FAF7F2',
                    border: 'none',
                    padding: '9px 20px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: savingUpdate ? 'not-allowed' : 'pointer',
                    borderRadius: 2,
                    fontFamily: 'Inter, sans-serif',
                    opacity: savingUpdate ? 0.6 : 1,
                  }}
                >
                  {savingUpdate ? 'Saving...' : 'Save & Log History'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════ VIEW STATUS HISTORY MODAL ════════ */}
      {historyOrder && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(43, 36, 32, 0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={closeHistoryModal}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E4DDD1',
              maxWidth: 480,
              width: '100%',
              padding: 24,
              position: 'relative',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 400, color: '#2B2420', margin: 0 }}>
                Delivery Status History
              </h3>
              <button
                type="button"
                onClick={closeHistoryModal}
                style={{ background: 'none', border: 'none', fontSize: 18, color: '#6B7259', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {loadingHistory ? (
              <p style={{ fontSize: 12, color: '#6B7259' }}>Loading history...</p>
            ) : historyList.length === 0 ? (
              <p style={{ fontSize: 12, color: '#6B7259' }}>No history records logged yet for this order.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {historyList.map((hist, i) => {
                  const cfg = DELIVERY_STATUS_CONFIG[hist.status] || DELIVERY_STATUS_CONFIG.confirmed
                  return (
                    <div
                      key={hist.id || i}
                      style={{
                        padding: 12,
                        background: '#FAF7F2',
                        border: '1px solid #E4DDD1',
                        borderRadius: 2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 10,
                            fontWeight: 600,
                            ...cfg.badgeStyle,
                          }}
                        >
                          {cfg.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#6B7259' }}>{formatDate(hist.changed_at)}</span>
                      </div>
                      {hist.note && (
                        <p style={{ fontSize: 12, color: '#4A3728', margin: '4px 0 0 0', fontStyle: 'italic' }}>
                          "{hist.note}"
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
