import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { OrderWithDetails } from '../lib/types'

interface OrderListProps {
  refreshKey: number
}

function OrderList({ refreshKey }: OrderListProps) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ── Search state (new — client-side only, no DB queries) ──
  const [searchQuery, setSearchQuery] = useState('')

  // ── Date range filter state ──
  const [dateFilter, setDateFilter] = useState<'all' | 'week' | 'month'>('all')

  useEffect(() => {
    fetchOrders()
  }, [refreshKey])

  // ── Existing fetch — UNCHANGED ──
  async function fetchOrders() {
    setLoading(true)

    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers ( name, phone ),
        products ( name )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      const formatted: OrderWithDetails[] = (data ?? []).map((o: any) => ({
        id: o.id,
        customer_id: o.customer_id,
        product_id: o.product_id,
        quantity: o.quantity,
        status: o.status,
        order_date: o.order_date,
        total: o.total,
        review_requested: o.review_requested,
        created_at: o.created_at,
        customer_name: o.customers?.name ?? 'Unknown',
        customer_phone: o.customers?.phone ?? null,
        product_name: o.products?.name ?? 'Unknown product',
      }))
      setOrders(formatted)
    }
    setLoading(false)
  }

  // ── Client-side filtered orders by customer name and date range ──
  const displayedOrders = useMemo(() => {
    let filtered = orders

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter((o) => o.customer_name.toLowerCase().includes(q))
    }

    // Filter by date range
    if (dateFilter !== 'all') {
      const now = new Date()
      const cutoffDate = new Date()
      if (dateFilter === 'week') {
        cutoffDate.setDate(now.getDate() - 7)
      } else if (dateFilter === 'month') {
        cutoffDate.setMonth(now.getMonth() - 1)
      }
      filtered = filtered.filter((o) => o.order_date && new Date(o.order_date) >= cutoffDate)
    }

    return filtered
  }, [orders, searchQuery, dateFilter])

  if (loading)
    return (
      <p style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        Loading orders...
      </p>
    )
  if (error)
    return (
      <p style={{ color: '#C0523C', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        Error: {error}
      </p>
    )
  if (orders.length === 0)
    return (
      <p style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        No orders recorded yet.
      </p>
    )

  // ── CSV Export function ──
  function exportToCSV() {
    const headers = ['Customer Name', 'Phone', 'Product', 'Quantity', 'Order Date', 'Total']
    const rows = displayedOrders.map((o) => [
      o.customer_name,
      o.customer_phone || '',
      o.product_name,
      o.quantity?.toString() || '',
      o.order_date || '',
      o.total?.toString() || '',
    ])
    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `orders-export-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div>
      {/* ── Filters bar ── */}
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
              placeholder="Search by customer name..."
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

          {/* Date range filter buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'all' as const, label: 'All Time' },
              { value: 'week' as const, label: 'This Week' },
              { value: 'month' as const, label: 'This Month' },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setDateFilter(filter.value)}
                style={{
                  padding: '9px 16px',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: dateFilter === filter.value ? '#FAF7F2' : '#6B7259',
                  background: dateFilter === filter.value ? '#B8874B' : '#fff',
                  border: '1px solid #E4DDD1',
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'background 0.18s, border-color 0.18s, color 0.18s',
                }}
                onMouseEnter={(e) => {
                  if (dateFilter !== filter.value) {
                    e.currentTarget.style.borderColor = '#B8874B'
                    e.currentTarget.style.background = '#FAF7F2'
                  }
                }}
                onMouseLeave={(e) => {
                  if (dateFilter !== filter.value) {
                    e.currentTarget.style.borderColor = '#E4DDD1'
                    e.currentTarget.style.background = '#fff'
                  }
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Export CSV button */}
          <button
            onClick={exportToCSV}
            disabled={displayedOrders.length === 0}
            style={{
              padding: '9px 16px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#4A3728',
              background: '#fff',
              border: '1px solid #E4DDD1',
              borderRadius: 2,
              cursor: displayedOrders.length > 0 ? 'pointer' : 'not-allowed',
              fontFamily: 'Inter, sans-serif',
              transition: 'background 0.18s, border-color 0.18s, color 0.18s',
              opacity: displayedOrders.length === 0 ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (displayedOrders.length > 0) {
                e.currentTarget.style.borderColor = '#B8874B'
                e.currentTarget.style.background = '#FAF7F2'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E4DDD1'
              e.currentTarget.style.background = '#fff'
            }}
          >
            Export CSV
          </button>
        </div>
        {(searchQuery || dateFilter !== 'all') && (
          <p
            style={{
              fontSize: 11,
              color: '#6B7259',
              marginTop: 8,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {displayedOrders.length} of {orders.length} orders
          </p>
        )}
      </div>

      {/* ── No results ── */}
      {displayedOrders.length === 0 && (searchQuery || dateFilter !== 'all') && (
        <p style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
          No orders match the current filters.
        </p>
      )}

      {/* ── Orders table — same structure, unchanged ── */}
      {displayedOrders.length > 0 && (
        <div
          style={{
            overflow: 'hidden',
            border: '1px solid #E4DDD1',
            borderRadius: 2,
            overflowX: 'auto',
          }}
        >
          <table
            style={{
              width: '100%',
              fontSize: 13,
              fontFamily: 'Inter, sans-serif',
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#FAF7F2',
                  borderBottom: '1px solid #E4DDD1',
                }}
              >
                {['Customer', 'Product', 'Quantity', 'Date of Purchase', 'Total', 'Review Requested'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '11px 14px',
                      textAlign: 'left',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: '#6B7259',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedOrders.map((order, i) => (
                <tr
                  key={order.id}
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid #F0EBE4',
                    background: i % 2 === 0 ? '#fff' : '#FDFAF7',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF7F2')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FDFAF7')}
                >
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontWeight: 500, color: '#2B2420' }}>
                      {order.customer_name}
                    </span>
                    {order.customer_phone && (
                      <div style={{ fontSize: 11, color: '#6B7259', marginTop: 2 }}>
                        {order.customer_phone}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#4A3728' }}>
                    {order.product_name}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#6B7259' }}>
                    {order.quantity ?? '—'}
                  </td>
                  <td style={{ padding: '12px 14px', color: '#6B7259' }}>
                    {order.order_date ?? '—'}
                  </td>
                  <td style={{ padding: '12px 14px', fontWeight: 600, color: '#B8874B' }}>
                    {order.total ? `₹${order.total.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    {order.review_requested ? (
                      <span
                        style={{
                          background: 'rgba(107,114,89,0.1)',
                          color: '#6B7259',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: 2,
                        }}
                      >
                        Sent
                      </span>
                    ) : (
                      <span
                        style={{
                          background: 'rgba(184,135,75,0.1)',
                          color: '#B8874B',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: 2,
                        }}
                      >
                        Pending
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default OrderList