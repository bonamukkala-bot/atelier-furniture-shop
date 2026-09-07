import { useEffect, useState } from 'react'
import {
  adminListDeliveryPartners,
  adminUpsertDeliveryPartner,
  adminSetPartnerPin,
} from '../lib/partnerAuth'
import type { DeliveryPartner } from '../lib/types'
import { useToast } from '../context/ToastContext'

interface DeliveryPartnerManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onPartnersUpdated?: () => void
}

export default function DeliveryPartnerManagerModal({
  isOpen,
  onClose,
  onPartnersUpdated,
}: DeliveryPartnerManagerModalProps) {
  const { showToast } = useToast()

  const [partners, setPartners] = useState<DeliveryPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // ── Add / Edit Partner Form State ──
  const [showAddForm, setShowAddForm] = useState(false)
  const [partnerName, setPartnerName] = useState('')
  const [partnerPhone, setPartnerPhone] = useState('')
  const [partnerPin, setPartnerPin] = useState('')
  const [partnerStatus, setPartnerStatus] = useState<'active' | 'inactive'>('active')
  const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null)

  // ── Reset PIN Submodal State ──
  const [pinModalPartner, setPinModalPartner] = useState<DeliveryPartner | null>(null)
  const [newPin, setNewPin] = useState('')
  const [isResettingPin, setIsResettingPin] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadPartners()
      resetForm()
    }
  }, [isOpen])

  async function loadPartners() {
    setLoading(true)
    try {
      const data = await adminListDeliveryPartners()
      setPartners(data)
    } catch (err: any) {
      console.error('Error fetching delivery partners:', err)
      showToast(err.message || 'Failed to load delivery partners.', 'error')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setShowAddForm(false)
    setEditingPartner(null)
    setPartnerName('')
    setPartnerPhone('')
    setPartnerPin('')
    setPartnerStatus('active')
  }

  function openEditPartner(p: DeliveryPartner) {
    setEditingPartner(p)
    setPartnerName(p.name)
    setPartnerPhone(p.phone)
    setPartnerStatus(p.status)
    setPartnerPin('')
    setShowAddForm(true)
  }

  async function handleSavePartner(e: React.FormEvent) {
    e.preventDefault()
    if (!partnerName.trim() || !partnerPhone.trim()) {
      showToast('Name and phone number are required.', 'error')
      return
    }

    if (!editingPartner && (!partnerPin.trim() || partnerPin.trim().length !== 4)) {
      showToast('A 4-digit PIN is required for new delivery partners.', 'error')
      return
    }

    setIsSaving(true)
    try {
      await adminUpsertDeliveryPartner({
        id: editingPartner?.id,
        name: partnerName.trim(),
        phone: partnerPhone.trim(),
        pin: partnerPin.trim() || undefined,
        status: partnerStatus,
      })

      showToast(
        editingPartner ? 'Partner details updated successfully!' : 'Delivery partner added successfully!',
        'success'
      )
      resetForm()
      await loadPartners()
      onPartnersUpdated?.()
    } catch (err: any) {
      console.error('Error saving partner:', err)
      showToast(err.message || 'Failed to save delivery partner.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleResetPin(e: React.FormEvent) {
    e.preventDefault()
    if (!pinModalPartner) return

    const trimmedPin = newPin.trim()
    if (trimmedPin.length !== 4 || !/^\d{4}$/.test(trimmedPin)) {
      showToast('Please enter a valid 4-digit numeric PIN.', 'error')
      return
    }

    setIsResettingPin(true)
    try {
      await adminSetPartnerPin(pinModalPartner.id, trimmedPin)
      showToast(`PIN for ${pinModalPartner.name} updated to "${trimmedPin}".`, 'success')
      setPinModalPartner(null)
      setNewPin('')
    } catch (err: any) {
      console.error('Error resetting PIN:', err)
      showToast(err.message || 'Failed to reset PIN.', 'error')
    } finally {
      setIsResettingPin(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(43, 36, 32, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        fontFamily: 'Inter, sans-serif',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving && !isResettingPin) {
          onClose()
        }
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 4,
          boxShadow: '0 20px 40px rgba(43, 36, 32, 0.25)',
          maxWidth: 620,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #E4DDD1',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top Gold Accent Strip */}
        <div style={{ height: 4, background: '#B8874B', flexShrink: 0 }} />

        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E4DDD1',
            background: '#FAF7F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                background: 'rgba(184, 135, 75, 0.12)',
                color: '#B8874B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" rx="1" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#2B2420' }}>
                Delivery Partners &amp; PINs
              </h3>
              <p style={{ margin: 0, fontSize: 11, color: '#6B7259', marginTop: 1 }}>
                Configure zero-cost 4-digit PINs for partner login at <code style={{ color: '#4A3728', fontWeight: 600 }}>/partner-login</code>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 18,
              color: '#8A8178',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {/* Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#4A3728' }}>
              Registered Partners ({partners.length})
            </div>
            {!showAddForm && (
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowAddForm(true)
                }}
                style={{
                  background: '#4A3728',
                  color: '#FAF7F2',
                  border: 'none',
                  borderRadius: 2,
                  padding: '6px 12px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                + Add Delivery Partner
              </button>
            )}
          </div>

          {/* Add / Edit Form Card */}
          {showAddForm && (
            <div
              style={{
                background: '#FAF7F2',
                border: '1px solid #E4DDD1',
                borderRadius: 4,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#2B2420' }}>
                  {editingPartner ? `Edit Partner: ${editingPartner.name}` : 'Add New Delivery Partner'}
                </h4>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{ background: 'none', border: 'none', fontSize: 11, color: '#6B7259', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSavePartner} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7259', marginBottom: 4 }}>
                      Partner Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Ramesh Kumar"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #E4DDD1',
                        borderRadius: 2,
                        fontSize: 12,
                        background: '#FFFFFF',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7259', marginBottom: 4 }}>
                      Phone Number (Login ID) *
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g., 9876543210"
                      value={partnerPhone}
                      onChange={(e) => setPartnerPhone(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #E4DDD1',
                        borderRadius: 2,
                        fontSize: 12,
                        background: '#FFFFFF',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7259', marginBottom: 4 }}>
                      {editingPartner ? 'New 4-Digit PIN (Optional)' : '4-Digit PIN *'}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={4}
                      placeholder={editingPartner ? 'Leave blank to keep' : '4 digits'}
                      value={partnerPin}
                      onChange={(e) => setPartnerPin(e.target.value.replace(/\D/g, ''))}
                      required={!editingPartner}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #E4DDD1',
                        borderRadius: 2,
                        fontSize: 12,
                        background: '#FFFFFF',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7259', marginBottom: 4 }}>
                      Status
                    </label>
                    <select
                      value={partnerStatus}
                      onChange={(e) => setPartnerStatus(e.target.value as 'active' | 'inactive')}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #E4DDD1',
                        borderRadius: 2,
                        fontSize: 12,
                        background: '#FFFFFF',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="active">Active (Can Login)</option>
                      <option value="inactive">Inactive (Disabled)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E4DDD1',
                      padding: '6px 12px',
                      fontSize: 11,
                      borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    style={{
                      background: '#B8874B',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '6px 14px',
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 2,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isSaving ? 'Saving...' : editingPartner ? 'Update Partner' : 'Save Partner'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Partner Table / List */}
          {loading ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: '#6B7259', fontSize: 12 }}>
              Loading partners...
            </div>
          ) : partners.length === 0 ? (
            <div
              style={{
                padding: '30px 16px',
                textAlign: 'center',
                background: '#FAF7F2',
                border: '1px dashed #E4DDD1',
                borderRadius: 4,
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>🚚</div>
              <p style={{ margin: 0, fontSize: 12, color: '#6B7259' }}>
                No delivery partners added yet. Click "+ Add Delivery Partner" above to register your first partner.
              </p>
            </div>
          ) : (
            <div style={{ border: '1px solid #E4DDD1', borderRadius: 3, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#FAF7F2', borderBottom: '1px solid #E4DDD1' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6B7259', fontWeight: 600, fontSize: 11 }}>
                      Partner Name
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', color: '#6B7259', fontWeight: 600, fontSize: 11 }}>
                      Phone (Login)
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', color: '#6B7259', fontWeight: 600, fontSize: 11 }}>
                      Status
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', color: '#6B7259', fontWeight: 600, fontSize: 11 }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p, idx) => (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: idx === partners.length - 1 ? 'none' : '1px solid #E4DDD1',
                        background: idx % 2 === 0 ? '#FFFFFF' : '#FAF7F2/50',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#2B2420' }}>
                        {p.name}
                        {p.active_orders_count !== undefined && p.active_orders_count > 0 && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 10,
                              background: 'rgba(184, 135, 75, 0.15)',
                              color: '#8F632E',
                              padding: '2px 6px',
                              borderRadius: 8,
                              fontWeight: 600,
                            }}
                          >
                            {p.active_orders_count} active
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '10px 12px', color: '#4A3728', fontFamily: 'monospace' }}>
                        {p.phone}
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: p.status === 'active' ? 'rgba(74, 93, 62, 0.12)' : 'rgba(168, 75, 59, 0.12)',
                            color: p.status === 'active' ? '#384E2E' : '#A84B3B',
                          }}
                        >
                          {p.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {/* Reset PIN Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setPinModalPartner(p)
                              setNewPin('')
                            }}
                            title="Set/Reset 4-Digit PIN"
                            style={{
                              background: '#FAF7F2',
                              border: '1px solid #B8874B',
                              color: '#8F632E',
                              padding: '4px 8px',
                              fontSize: 11,
                              borderRadius: 2,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Reset PIN
                          </button>

                          {/* Edit Partner Button */}
                          <button
                            type="button"
                            onClick={() => openEditPartner(p)}
                            style={{
                              background: '#FAF7F2',
                              border: '1px solid #E4DDD1',
                              color: '#4A3728',
                              padding: '4px 8px',
                              fontSize: 11,
                              borderRadius: 2,
                              cursor: 'pointer',
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Submodal: Reset 4-Digit PIN ── */}
        {pinModalPartner && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(43, 36, 32, 0.65)',
              backdropFilter: 'blur(2px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              zIndex: 100,
            }}
          >
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 4,
                padding: 24,
                maxWidth: 380,
                width: '100%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                border: '1px solid #E4DDD1',
              }}
            >
              <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700, color: '#2B2420' }}>
                Reset PIN for {pinModalPartner.name}
              </h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 11, color: '#6B7259' }}>
                Enter a new 4-digit secret PIN. This will immediately update the partner's login credential.
              </p>

              <form onSubmit={handleResetPin}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6B7259', marginBottom: 4 }}>
                    New 4-Digit PIN *
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    placeholder="• • • •"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      textAlign: 'center',
                      fontSize: 22,
                      letterSpacing: '0.4em',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      padding: '10px',
                      border: '2px solid #B8874B',
                      borderRadius: 2,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPinModalPartner(null)
                      setNewPin('')
                    }}
                    disabled={isResettingPin}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E4DDD1',
                      padding: '7px 12px',
                      fontSize: 12,
                      borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingPin || newPin.trim().length !== 4}
                    style={{
                      background: isResettingPin || newPin.trim().length !== 4 ? '#A89E96' : '#4A3728',
                      color: '#FAF7F2',
                      border: 'none',
                      padding: '7px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 2,
                      cursor: isResettingPin || newPin.trim().length !== 4 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isResettingPin ? 'Updating...' : 'Save New PIN'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
