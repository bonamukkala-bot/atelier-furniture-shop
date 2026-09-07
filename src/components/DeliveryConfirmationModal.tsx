import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../context/ToastContext'
import type { OrderWithDetails } from '../lib/types'

interface DeliveryConfirmationModalProps {
  order: OrderWithDetails | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function DeliveryConfirmationModal({
  order,
  isOpen,
  onClose,
  onSuccess,
}: DeliveryConfirmationModalProps) {
  const { showToast } = useToast()

  const [enteredCode, setEnteredCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isOverriding, setIsOverriding] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [attempts, setAttempts] = useState(0)

  // ── Manual Override Section ──
  const [showOverride, setShowOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')

  useEffect(() => {
    if (isOpen && order) {
      setEnteredCode('')
      setErrorMsg('')
      setAttempts(0)
      setShowOverride(false)
      setOverrideReason('')
    }
  }, [isOpen, order])

  if (!isOpen || !order) return null

  const customerName = order.customers?.name || order.customer_name || 'Customer'
  const productName = order.products?.name || order.product_name || 'Order Item'
  const customerPhone = order.customers?.phone || order.customer_phone

  // ── Verify Customer 6-Digit Code ──
  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (!order) return

    const trimmedInput = enteredCode.trim().replace(/\s+/g, '')
    if (!trimmedInput) {
      setErrorMsg('Please enter the 6-digit confirmation code from the customer.')
      return
    }

    setErrorMsg('')
    setIsVerifying(true)

    try {
      // 1. Fetch current order record from Supabase to verify against stored code
      const { data: currentOrder, error: fetchErr } = await supabase
        .from('orders')
        .select('delivery_confirmation_code, delivery_status')
        .eq('id', order.id)
        .single()

      if (fetchErr || !currentOrder) {
        throw new Error('Failed to verify order details from database.')
      }

      const expectedCode = (currentOrder.delivery_confirmation_code || order.delivery_confirmation_code || '').trim()

      if (!expectedCode) {
        throw new Error('No confirmation code generated for this order. Please use manual override.')
      }

      if (trimmedInput !== expectedCode) {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        if (newAttempts >= 5) {
          setErrorMsg(`Incorrect code (${newAttempts} attempts). If the customer cannot access their tracking page, you can use the Manual Override below.`)
        } else {
          setErrorMsg(`Incorrect confirmation code (Attempt ${newAttempts}). Please ask the customer to re-check their tracking link.`)
        }
        return
      }

      // 2. Code matches! Update order status to 'delivered' with confirmed_via = 'code'
      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          delivery_status: 'delivered',
          delivery_confirmed_via: 'code',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (updateErr) throw updateErr

      // 3. Insert audit log into delivery_status_history
      const { error: histErr } = await supabase
        .from('delivery_status_history')
        .insert({
          order_id: order.id,
          status: 'delivered',
          note: 'Delivery confirmed via customer 6-digit code',
        })

      if (histErr) {
        console.warn('Failed to insert history log:', histErr)
      }

      showToast('Delivery confirmed with customer code and marked as Delivered!', 'success')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error confirming delivery:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to confirm delivery.')
    } finally {
      setIsVerifying(false)
    }
  }

  // ── Manual Delivery Confirmation Override ──
  async function handleManualOverride() {
    if (!order) return
    setIsOverriding(true)
    setErrorMsg('')

    try {
      const trimmedReason = overrideReason.trim()
      const auditNote = trimmedReason
        ? `Manually confirmed by shop owner (code not verified) — ${trimmedReason}`
        : 'Manually confirmed by shop owner (code not verified)'

      // 1. Update order in Supabase
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          delivery_status: 'delivered',
          delivery_confirmed_via: 'manual',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (orderError) throw orderError

      // 2. Insert audit log
      const { error: histError } = await supabase
        .from('delivery_status_history')
        .insert({
          order_id: order.id,
          status: 'delivered',
          note: auditNote,
        })

      if (histError) {
        console.warn('Failed to insert history log:', histError)
      }

      showToast('Order manually marked as Delivered (logged as manual override)', 'success')
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Manual override error:', err)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to override delivery status.')
    } finally {
      setIsOverriding(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(43, 36, 32, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isVerifying && !isOverriding) {
          onClose()
        }
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 4,
          boxShadow: '0 20px 40px rgba(43, 36, 32, 0.25)',
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
          border: '1px solid #E4DDD1',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #E4DDD1',
            background: '#FAF7F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                background: 'rgba(74, 93, 62, 0.15)',
                color: '#4A5D3E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#2B2420' }}>
                Confirm Delivery
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: '#6B7259', marginTop: 2 }}>
                Order #{order.id.slice(0, 8).toUpperCase()} · {productName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isVerifying || isOverriding}
            style={{
              background: 'none',
              border: 'none',
              cursor: isVerifying || isOverriding ? 'not-allowed' : 'pointer',
              color: '#8A8178',
              padding: 4,
              display: 'flex',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {/* Order Context Card */}
          <div
            style={{
              background: '#FAF7F2',
              border: '1px solid #E4DDD1',
              borderRadius: 3,
              padding: '12px 16px',
              marginBottom: 18,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#8A8178', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Customer
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#2B2420' }}>
                {customerName} {customerPhone ? `(${customerPhone})` : ''}
              </span>
            </div>

            {order.delivery_address && (
              <div style={{ fontSize: 11, color: '#6B7259', marginTop: 4 }}>
                📍 {order.delivery_address}
              </div>
            )}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div
              style={{
                background: 'rgba(168, 75, 59, 0.08)',
                border: '1px solid rgba(168, 75, 59, 0.35)',
                color: '#A84B3B',
                padding: '10px 14px',
                borderRadius: 3,
                fontSize: 12,
                lineHeight: 1.4,
                marginBottom: 16,
              }}
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleVerifyCode}>
            <div style={{ marginBottom: 18 }}>
              <label
                htmlFor="confirmation-code-input"
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#2B2420',
                  marginBottom: 6,
                }}
              >
                Enter Customer's 6-Digit Delivery Code
              </label>

              <p style={{ fontSize: 11, color: '#6B7259', lineHeight: 1.4, margin: '0 0 10px 0' }}>
                Ask the customer to read the 6-digit confirmation code displayed on their private tracking link.
              </p>

              <input
                id="confirmation-code-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                placeholder="• • • • • •"
                autoFocus
                disabled={isVerifying}
                style={{
                  width: '100%',
                  textAlign: 'center',
                  fontSize: 26,
                  letterSpacing: '0.35em',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  padding: '10px 14px',
                  borderRadius: 2,
                  border: '2px solid #B8874B',
                  outline: 'none',
                  color: '#2B2420',
                  background: '#FFFFFF',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || enteredCode.trim().length !== 6}
              style={{
                width: '100%',
                background: isVerifying || enteredCode.trim().length !== 6 ? '#9CA3AF' : '#4A5D3E',
                color: '#FFFFFF',
                border: 'none',
                padding: '12px 16px',
                borderRadius: 2,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.04em',
                cursor: isVerifying || enteredCode.trim().length !== 6 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'background 0.2s',
              }}
            >
              {isVerifying ? 'Verifying Code...' : 'Verify Code & Confirm Delivery'}
            </button>
          </form>

          {/* ════════ MANUAL OVERRIDE FALLBACK ════════ */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid #E4DDD1',
            }}
          >
            {!showOverride ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#8A8178' }}>
                  Customer cannot access tracking link?
                </span>
                <button
                  type="button"
                  onClick={() => setShowOverride(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#A84B3B',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  Manual Override
                </button>
              </div>
            ) : (
              <div
                style={{
                  background: '#FAF7F2',
                  border: '1px solid #E4DDD1',
                  borderRadius: 3,
                  padding: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: '#A84B3B' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    Manual Delivery Override
                  </span>
                </div>

                <p style={{ fontSize: 11, color: '#6B7259', lineHeight: 1.45, margin: '0 0 10px 0' }}>
                  This will mark the order as <strong>Delivered</strong> without code verification. The history log will record this delivery as <em>"Manually confirmed (unverified)"</em>.
                </p>

                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Optional reason (e.g. Phone battery drained, Offline)"
                  style={{
                    width: '100%',
                    fontSize: 11,
                    padding: '7px 10px',
                    borderRadius: 2,
                    border: '1px solid #E4DDD1',
                    background: '#FFFFFF',
                    marginBottom: 10,
                    boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowOverride(false)}
                    disabled={isOverriding}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E4DDD1',
                      color: '#4A3728',
                      padding: '6px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleManualOverride}
                    disabled={isOverriding}
                    style={{
                      background: '#A84B3B',
                      border: 'none',
                      color: '#FFFFFF',
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 2,
                      cursor: isOverriding ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {isOverriding ? 'Saving...' : 'Confirm Manual Delivery'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
