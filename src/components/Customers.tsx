import { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../context/ToastContext'

interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
}

interface CustomerWithStats extends Customer {
  totalOrders: number
  totalSpent: number
  rawOrdersCount: number
}

interface Order {
  id: string
  product_name: string
  quantity: number
  order_date: string
  total: number | null
}

type SortOption = 'spent_desc' | 'spent_asc' | 'orders_desc' | 'name_asc'

function Customers() {
  const { showToast } = useToast()
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('spent_desc')
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null)
  const [customerOrders, setCustomerOrders] = useState<Order[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<CustomerWithStats | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deleteLockRef = useRef(false)

  useEffect(() => {
    fetchCustomers()
  }, [])

  async function fetchCustomers() {
    setLoading(true)
    try {
      // Fetch all customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (customersError) throw customersError

      // Fetch all orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')

      if (ordersError) throw ordersError

      // Calculate stats for each customer
      const customersWithStats = (customersData ?? []).map((customer: Customer) => {
        const allCustomerOrders = (ordersData ?? []).filter(
          (order) => order.customer_id === customer.id
        )
        const customerOrders = allCustomerOrders.filter(
          (order) =>
            order.delivery_status !== 'cancelled' &&
            order.delivery_status !== 'requested'
        )
        const totalOrders = customerOrders.length
        const totalSpent = customerOrders.reduce((sum: number, order: any) => sum + (order.total || 0), 0)

        return {
          ...customer,
          totalOrders,
          totalSpent,
          rawOrdersCount: allCustomerOrders.length,
        }
      })

      setCustomers(customersWithStats)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load customers', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchCustomerOrders(customerId: string) {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          products ( name )
        `)
        .eq('customer_id', customerId)
        .order('order_date', { ascending: false })

      if (error) throw error

      const validOrders = (data ?? []).filter(
        (order) => order.delivery_status !== 'cancelled' && order.delivery_status !== 'requested'
      )

      const orders = validOrders.map((order: any) => ({
        id: order.id,
        product_name: order.products?.name ?? 'Unknown product',
        quantity: order.quantity,
        order_date: order.order_date,
        total: order.total,
      }))

      setCustomerOrders(orders)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load customer orders', 'error')
    }
  }

  function handleCustomerClick(customer: CustomerWithStats) {
    setSelectedCustomer(customer)
    setPanelOpen(true)
    fetchCustomerOrders(customer.id)
  }

  function closePanel() {
    setPanelOpen(false)
    setSelectedCustomer(null)
    setCustomerOrders([])
  }

  async function handleConfirmDelete() {
    if (!customerToDelete || deleteLockRef.current || deleting) return
    deleteLockRef.current = true
    setDeleting(true)

    try {
      const targetId = customerToDelete.id
      const { data, error } = await supabase.rpc('admin_delete_customer', {
        p_customer_id: targetId,
      })

      if (error) {
        showToast('Could not delete this customer. Please try again.', 'error')
        return
      }

      const result = (data ?? null) as { ok?: boolean; code?: string; message?: string } | null
      if (result?.ok === true) {
        setCustomerToDelete(null)
        if (selectedCustomer?.id === targetId) {
          closePanel()
        }
        showToast('Customer deleted', 'success')
        await fetchCustomers()
        return
      }

      switch (result?.code) {
        case 'not_admin':
          showToast('You do not have permission to delete customers.', 'error')
          break
        case 'has_orders':
          showToast('This customer has orders and cannot be deleted.', 'error')
          await fetchCustomers()
          break
        case 'not_found':
          showToast('Customer not found. It may already be deleted.', 'error')
          await fetchCustomers()
          break
        default:
          showToast('Could not delete this customer. Please try again.', 'error')
          break
      }
    } catch {
      showToast('Could not delete this customer. Please try again.', 'error')
    } finally {
      deleteLockRef.current = false
      setDeleting(false)
    }
  }

  const displayedCustomers = useMemo(() => {
    let filtered = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    )

    switch (sortOption) {
      case 'spent_desc':
        filtered.sort((a, b) => b.totalSpent - a.totalSpent)
        break
      case 'spent_asc':
        filtered.sort((a, b) => a.totalSpent - b.totalSpent)
        break
      case 'orders_desc':
        filtered.sort((a, b) => b.totalOrders - a.totalOrders)
        break
      case 'name_asc':
        filtered.sort((a, b) => a.name.localeCompare(b.name))
        break
    }

    return filtered
  }, [customers, searchQuery, sortOption])

  if (loading) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6B7259' }}>
        Loading customers...
      </div>
    )
  }

  return (
    <>
      <div style={{ maxWidth: '100%', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
          <div>
            <h1 className="admin-section-title">Customers</h1>
            <p className="admin-section-sub">View and manage your customer base.</p>
          </div>
        </div>

        {/* Search and Sort */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                border: '1px solid #E4DDD1',
                background: '#FAF7F2/50',
                color: '#2B2420',
                padding: '10px 14px',
                fontSize: '13px',
                borderRadius: 2,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                transition: 'border-color 0.18s',
                minHeight: '44px',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
            />
          </div>
          <div>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              style={{
                border: '1px solid #E4DDD1',
                background: '#FAF7F2/50',
                color: '#2B2420',
                padding: '10px 14px',
                fontSize: '13px',
                borderRadius: 2,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                cursor: 'pointer',
                transition: 'border-color 0.18s',
                minHeight: '44px',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
            >
              <option value="spent_desc">Total Spent: High to Low</option>
              <option value="spent_asc">Total Spent: Low to High</option>
              <option value="orders_desc">Most Orders</option>
              <option value="name_asc">Name A-Z</option>
            </select>
          </div>
        </div>

        {/* Customers Table */}
        <div className="admin-content-card" style={{ padding: 0, overflow: 'hidden' }}>
          {customers.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#6B7259', fontFamily: 'Inter, sans-serif' }}>
                No customers yet — they'll appear here once you record your first order.
              </p>
            </div>
          ) : displayedCustomers.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#6B7259', fontFamily: 'Inter, sans-serif' }}>
                No customers match your search.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: '#FAF7F2', borderBottom: '1px solid #E4DDD1' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259' }}>
                    Customer Name
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259' }}>
                    Phone
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259' }}>
                    Total Orders
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259' }}>
                    Total Spent
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => handleCustomerClick(customer)}
                    style={{ borderBottom: '1px solid #E4DDD1', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#FAF7F2')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#2B2420', fontWeight: 500, wordBreak: 'break-word' }}>
                      {customer.name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6B7259', wordBreak: 'break-word' }}>
                      {customer.phone}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6B7259', textAlign: 'right', fontWeight: 500 }}>
                      {customer.totalOrders}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#2B2420', textAlign: 'right', fontWeight: 500 }}>
                      ₹{customer.totalSpent.toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {customer.rawOrdersCount === 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCustomerToDelete(customer)
                          }}
                          className="px-2.5 py-1 text-xs font-medium text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-sm hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Panel */}
      {panelOpen && selectedCustomer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(43,36,32,0.45)',
            zIndex: 50,
          }}
          onClick={closePanel}
        >
          <div
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '100%',
              maxWidth: '450px',
              height: '100vh',
              background: '#fff',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
              zIndex: 51,
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E4DDD1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
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
                  Customer Details
                </div>
                <h2
                  style={{
                    fontFamily: 'Fraunces, serif',
                    fontSize: 18,
                    fontWeight: 400,
                    color: '#2B2420',
                    margin: 0,
                    wordBreak: 'break-word',
                  }}
                >
                  {selectedCustomer.name}
                </h2>
              </div>
              <button
                onClick={closePanel}
                style={{
                  background: 'none',
                  border: '1px solid #E4DDD1',
                  borderRadius: 2,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  color: '#6B7259',
                  display: 'flex',
                  transition: 'background 0.15s, border-color 0.15s',
                  minHeight: '44px',
                  minWidth: '44px',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#FAF7F2'
                  e.currentTarget.style.borderColor = '#B8874B'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none'
                  e.currentTarget.style.borderColor = '#E4DDD1'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Panel Content */}
            <div style={{ flex: 1, padding: '20px 16px sm:px-24', overflowY: 'auto' }}>
              {/* Summary */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 16,
                  marginBottom: 28,
                }}
              >
                <div
                  style={{
                    background: '#FAF7F2',
                    padding: '16px',
                    borderRadius: 2,
                    border: '1px solid #E4DDD1',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259', marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>
                    Total Orders
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#2B2420', fontFamily: 'Fraunces, serif' }}>
                    {selectedCustomer.totalOrders}
                  </div>
                </div>
                <div
                  style={{
                    background: '#FAF7F2',
                    padding: '16px',
                    borderRadius: 2,
                    border: '1px solid #E4DDD1',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259', marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>
                    Total Spent
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#2B2420', fontFamily: 'Fraunces, serif' }}>
                    ₹{selectedCustomer.totalSpent.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259', marginBottom: 12, fontFamily: 'Inter, sans-serif' }}>
                  Contact Information
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13, color: '#2B2420', fontFamily: 'Inter, sans-serif' }}>
                    <span style={{ color: '#6B7259', fontWeight: 500 }}>Phone:</span> {selectedCustomer.phone}
                  </div>
                  {selectedCustomer.email && (
                    <div style={{ fontSize: 13, color: '#2B2420', fontFamily: 'Inter, sans-serif' }}>
                      <span style={{ color: '#6B7259', fontWeight: 500 }}>Email:</span> {selectedCustomer.email}
                    </div>
                  )}
                </div>
              </div>

              {/* Order History */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259', marginBottom: 12, fontFamily: 'Inter, sans-serif' }}>
                  Order History
                </div>
                {customerOrders.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#6B7259', fontFamily: 'Inter, sans-serif' }}>
                    No orders yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {customerOrders.map((order) => (
                      <div
                        key={order.id}
                        style={{
                          padding: '14px',
                          background: '#FAF7F2',
                          borderRadius: 2,
                          border: '1px solid #E4DDD1',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#2B2420', marginBottom: 4, fontFamily: 'Inter, sans-serif' }}>
                          {order.product_name}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7259', fontFamily: 'Inter, sans-serif' }}>
                          <span>Qty: {order.quantity}</span>
                          <span>{new Date(order.order_date).toLocaleDateString('en-IN')}</span>
                        </div>
                        {order.total && (
                          <div style={{ fontSize: 12, color: '#2B2420', fontWeight: 500, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>
                            ₹{order.total.toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delete customer */}
              <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #E4DDD1' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6B7259', marginBottom: 12, fontFamily: 'Inter, sans-serif' }}>
                  Delete customer
                </div>
                {selectedCustomer.rawOrdersCount === 0 ? (
                  <button
                    type="button"
                    onClick={() => setCustomerToDelete(selectedCustomer)}
                    className="w-full px-4 py-2.5 text-sm font-medium text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-sm hover:bg-[#FEE2E2] transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full px-4 py-2.5 text-sm font-medium text-[#6B7259] bg-[#FAF7F2] border border-[#E4DDD1] rounded-sm opacity-70 cursor-not-allowed"
                  >
                    Has orders, cannot delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {customerToDelete && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(43,36,32,0.55)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => {
            if (!deleting) setCustomerToDelete(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-customer-title"
            className="w-full max-w-sm bg-white border border-[#E4DDD1] rounded-sm shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="delete-customer-title"
              style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 400, color: '#2B2420', margin: '0 0 8px' }}
            >
              Delete customer
            </h3>
            <p className="text-sm font-medium text-[#2B2420] mb-1 break-words">
              {customerToDelete.name}
            </p>
            <p className="text-xs text-[#6B7259] mb-3">
              {customerToDelete.phone}
            </p>
            <p className="text-sm text-[#6B7259] mb-5">
              This permanently removes this customer record. It cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  if (!deleting) setCustomerToDelete(null)
                }}
                className="px-4 py-2 text-sm font-medium text-[#2B2420] bg-[#FAF7F2] border border-[#E4DDD1] rounded-sm hover:border-[#B8874B] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-[#991B1B] border border-[#991B1B] rounded-sm hover:bg-[#7F1D1D] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Customers
