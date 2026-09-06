import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../context/ToastContext'
import type { DeliveryEnquiry } from '../lib/types'

export default function DeliveryEnquiriesList() {
  const { showToast } = useToast()
  const [enquiries, setEnquiries] = useState<DeliveryEnquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'contacted' | 'closed'>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetchEnquiries()
  }, [])

  async function fetchEnquiries() {
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('delivery_enquiries')
        .select(`
          *,
          products ( name, price, image_url ),
          delivery_zones ( zone_name, fee )
        `)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setEnquiries(data ?? [])
    } catch (err) {
      console.error('Error fetching delivery enquiries:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch delivery enquiries')
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(id: string, newStatus: 'new' | 'contacted' | 'closed') {
    setUpdatingId(id)
    try {
      const { error: updateError } = await supabase
        .from('delivery_enquiries')
        .update({ status: newStatus })
        .eq('id', id)

      if (updateError) throw updateError

      setEnquiries((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
      )
      showToast(`Status updated to ${newStatus}`, 'success')
    } catch (err) {
      console.error('Error updating status:', err)
      showToast('Failed to update status', 'error')
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredEnquiries = useMemo(() => {
    let result = enquiries

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((e) => (e.status || 'new') === statusFilter)
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (e) =>
          e.customer_name.toLowerCase().includes(q) ||
          e.phone.toLowerCase().includes(q) ||
          e.area_text.toLowerCase().includes(q) ||
          (e.door_flat_building && e.door_flat_building.toLowerCase().includes(q)) ||
          (e.street_locality && e.street_locality.toLowerCase().includes(q)) ||
          (e.products?.name && e.products.name.toLowerCase().includes(q))
      )
    }

    return result
  }, [enquiries, statusFilter, searchQuery])

  const statusBadgeStyle = (status: string) => {
    switch (status) {
      case 'new':
        return {
          background: 'rgba(184,135,75,0.12)',
          color: '#B8874B',
          border: '1px solid rgba(184,135,75,0.3)',
        }
      case 'contacted':
        return {
          background: 'rgba(107,114,89,0.12)',
          color: '#6B7259',
          border: '1px solid rgba(107,114,89,0.3)',
        }
      case 'closed':
        return {
          background: 'rgba(43,36,32,0.06)',
          color: '#8A827A',
          border: '1px solid rgba(43,36,32,0.15)',
        }
      default:
        return {
          background: 'rgba(184,135,75,0.12)',
          color: '#B8874B',
          border: '1px solid rgba(184,135,75,0.3)',
        }
    }
  }

  const openWhatsAppChat = (enquiry: DeliveryEnquiry) => {
    const rawPhone = enquiry.phone.replace(/\D/g, '')
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone
    const productName = enquiry.products?.name ?? 'your furniture selection'
    const msg = `Hi ${enquiry.customer_name}! Thank you for your delivery enquiry for the ${productName} at Atelier. We'd love to help you with the delivery details.`

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer')
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
      <p style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        Loading delivery enquiries...
      </p>
    )
  }

  if (error) {
    return (
      <p style={{ color: '#C0523C', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
        Error: {error}
      </p>
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
              placeholder="Search by customer, phone, area..."
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

          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { value: 'all' as const, label: 'All' },
              { value: 'new' as const, label: 'New' },
              { value: 'contacted' as const, label: 'Contacted' },
              { value: 'closed' as const, label: 'Closed' },
            ].map((tab) => {
              const active = statusFilter === tab.value
              const count =
                tab.value === 'all'
                  ? enquiries.length
                  : enquiries.filter((e) => (e.status || 'new') === tab.value).length

              return (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: active ? '#FAF7F2' : '#6B7259',
                    background: active ? '#4A3728' : '#fff',
                    border: '1px solid #E4DDD1',
                    borderRadius: 2,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.18s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      background: active ? '#B8874B' : 'rgba(107,114,89,0.15)',
                      color: active ? '#fff' : '#6B7259',
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 10,
                      fontWeight: 700,
                    }}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchEnquiries()}
            style={{
              padding: '9px 14px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#4A3728',
              background: '#fff',
              border: '1px solid #E4DDD1',
              borderRadius: 2,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
        </div>

        {(searchQuery || statusFilter !== 'all') && (
          <p style={{ fontSize: 11, color: '#6B7259', marginTop: 8, fontFamily: 'Inter, sans-serif' }}>
            Showing {filteredEnquiries.length} of {enquiries.length} enquiries
          </p>
        )}
      </div>

      {/* ── Empty state ── */}
      {filteredEnquiries.length === 0 ? (
        <div style={{ padding: '36px 20px', textAlign: 'center', background: '#FAF7F2', border: '1px solid #E4DDD1', borderRadius: 2 }}>
          <p style={{ color: '#6B7259', fontSize: 13, fontFamily: 'Inter, sans-serif', margin: 0 }}>
            {enquiries.length === 0
              ? 'No delivery enquiries submitted yet.'
              : 'No enquiries match your current filters.'}
          </p>
        </div>
      ) : (
        /* ── Table ── */
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
              <tr style={{ background: '#FAF7F2', borderBottom: '1px solid #E4DDD1' }}>
                {['Customer', 'Product', 'Delivery Address', 'Zone / Fee', 'Received', 'Status', 'Actions'].map((h) => (
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
              {filteredEnquiries.map((enquiry, i) => {
                const currentStatus = enquiry.status || 'new'
                return (
                  <tr
                    key={enquiry.id}
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid #F0EBE4',
                      background: i % 2 === 0 ? '#fff' : '#FDFAF7',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF7F2')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FDFAF7')}
                  >
                    {/* Customer */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      <div style={{ fontWeight: 600, color: '#2B2420' }}>
                        {enquiry.customer_name}
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7259', marginTop: 2 }}>
                        {enquiry.phone}
                      </div>
                    </td>

                    {/* Product */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top', color: '#4A3728' }}>
                      <div style={{ fontWeight: 500 }}>
                        {enquiry.products?.name ?? 'Piece Enquiry'}
                      </div>
                      {enquiry.products?.price && (
                        <div style={{ fontSize: 11, color: '#B8874B', marginTop: 2 }}>
                          ₹{Math.round(enquiry.products.price).toLocaleString('en-IN')}
                        </div>
                      )}
                    </td>

                    {/* Delivery Address */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top', color: '#2B2420', maxWidth: 260 }}>
                      {enquiry.door_flat_building || enquiry.street_locality ? (
                        <div style={{ fontSize: 12, lineHeight: 1.4, wordBreak: 'break-word' }}>
                          {enquiry.door_flat_building && (
                            <div style={{ fontWeight: 600, color: '#2B2420' }}>
                              {enquiry.door_flat_building}
                            </div>
                          )}
                          {enquiry.street_locality && (
                            <div style={{ color: '#4A3728', marginTop: 1 }}>
                              {enquiry.street_locality}
                            </div>
                          )}
                          <div style={{ fontSize: 11, color: '#6B7259', marginTop: 3 }}>
                            Area: {enquiry.area_text}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, lineHeight: 1.4, display: 'block', wordBreak: 'break-word' }}>
                          {enquiry.area_text}
                        </span>
                      )}
                    </td>

                    {/* Deliverability & Zone */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      {enquiry.is_deliverable ? (
                        <div>
                          <span
                            style={{
                              display: 'inline-block',
                              background: 'rgba(46,125,50,0.1)',
                              color: '#2e7d32',
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              padding: '2px 7px',
                              borderRadius: 2,
                            }}
                          >
                            Deliverable
                          </span>
                          <div style={{ fontSize: 11, color: '#4A3728', marginTop: 3, fontWeight: 500 }}>
                            {enquiry.delivery_zones?.zone_name ?? 'Zone Matched'}
                            {enquiry.delivery_zones?.fee ? ` (₹${enquiry.delivery_zones.fee})` : ''}
                          </div>
                        </div>
                      ) : (
                        <span
                          style={{
                            display: 'inline-block',
                            background: 'rgba(184,135,75,0.12)',
                            color: '#8A6D3B',
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            padding: '2px 7px',
                            borderRadius: 2,
                          }}
                        >
                          Pickup / Out of Zone
                        </span>
                      )}
                    </td>

                    {/* Received Date */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top', color: '#6B7259', fontSize: 11 }}>
                      {formatDate(enquiry.created_at)}
                    </td>

                    {/* Status dropdown */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      <select
                        value={currentStatus}
                        disabled={updatingId === enquiry.id}
                        onChange={(e) =>
                          handleStatusChange(
                            enquiry.id,
                            e.target.value as 'new' | 'contacted' | 'closed'
                          )
                        }
                        style={{
                          ...statusBadgeStyle(currentStatus),
                          padding: '4px 8px',
                          borderRadius: 2,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          outline: 'none',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>

                    {/* Action: WhatsApp link */}
                    <td style={{ padding: '12px 14px', verticalAlign: 'top' }}>
                      <button
                        onClick={() => openWhatsAppChat(enquiry)}
                        title="Chat with customer on WhatsApp"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '5px 10px',
                          background: '#25D366',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 2,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          fontFamily: 'Inter, sans-serif',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#128C7E')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#25D366')}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                        </svg>
                        Chat
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
