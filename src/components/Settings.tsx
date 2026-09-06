import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../context/ToastContext'
import type { DeliveryZone } from '../lib/types'

interface SettingsProps {
  onDeliveryEnabledChange?: (enabled: boolean) => void
}

function Settings({ onDeliveryEnabledChange }: SettingsProps) {
  const { showToast } = useToast()

  // ── General Shop Settings State ──
  const [reviewDelayDays, setReviewDelayDays] = useState(4)
  const [googlePlaceId, setGooglePlaceId] = useState('')
  const [deliveryEnabled, setDeliveryEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [togglingDelivery, setTogglingDelivery] = useState(false)

  // ── Delivery Zones State ──
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [loadingZones, setLoadingZones] = useState(true)
  const [zoneModalOpen, setZoneModalOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null)
  const [zoneName, setZoneName] = useState('')
  const [maxDistanceKm, setMaxDistanceKm] = useState<string>('')
  const [zoneFee, setZoneFee] = useState<string>('')
  const [areaNames, setAreaNames] = useState('')
  const [pincodes, setPincodes] = useState('')
  const [savingZone, setSavingZone] = useState(false)
  const [deletingZoneId, setDeletingZoneId] = useState<string | null>(null)

  // ── Initial Data Fetch ──
  useEffect(() => {
    fetchSettings()
    fetchZones()
  }, [])

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          setReviewDelayDays(4)
          setGooglePlaceId('')
          setDeliveryEnabled(true)
        } else {
          showToast('Failed to load settings', 'error')
        }
      } else if (data) {
        setReviewDelayDays(data.review_delay_days ?? 4)
        setGooglePlaceId(data.google_place_id ?? '')
        const isEnabled = data.delivery_enabled ?? true
        setDeliveryEnabled(isEnabled)
        onDeliveryEnabledChange?.(isEnabled)
      }
    } catch (err) {
      console.error('Error loading settings:', err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchZones() {
    setLoadingZones(true)
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .select('*')
        .order('fee', { ascending: true })

      if (error) throw error
      setZones(data || [])
    } catch (err) {
      console.error('Error loading delivery zones:', err)
      showToast('Failed to load delivery zones', 'error')
    } finally {
      setLoadingZones(false)
    }
  }

  // ── Toggle delivery_enabled immediately ──
  async function handleToggleDelivery(newEnabledState: boolean) {
    setTogglingDelivery(true)
    // Optimistic UI update
    setDeliveryEnabled(newEnabledState)
    onDeliveryEnabledChange?.(newEnabledState)

    try {
      const { error } = await supabase
        .from('shop_settings')
        .upsert({
          id: 1,
          review_delay_days: reviewDelayDays,
          google_place_id: googlePlaceId || null,
          delivery_enabled: newEnabledState,
        })

      if (error) throw error

      showToast(
        newEnabledState ? 'Delivery features enabled' : 'Delivery features disabled',
        'success'
      )
    } catch (err) {
      // Revert optimistic update
      setDeliveryEnabled(!newEnabledState)
      onDeliveryEnabledChange?.(!newEnabledState)
      showToast(err instanceof Error ? err.message : 'Failed to update delivery toggle', 'error')
    } finally {
      setTogglingDelivery(false)
    }
  }

  // ── Save General Settings ──
  async function handleSaveGeneralSettings(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase
        .from('shop_settings')
        .upsert({
          id: 1,
          review_delay_days: reviewDelayDays,
          google_place_id: googlePlaceId || null,
          delivery_enabled: deliveryEnabled,
        })

      if (error) throw error

      showToast('Settings saved successfully', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Delivery Zone Modal Handlers ──
  function openAddZoneModal() {
    setEditingZone(null)
    setZoneName('')
    setMaxDistanceKm('')
    setZoneFee('')
    setAreaNames('')
    setPincodes('')
    setZoneModalOpen(true)
  }

  function openEditZoneModal(zone: DeliveryZone) {
    setEditingZone(zone)
    setZoneName(zone.zone_name)
    setMaxDistanceKm(zone.max_distance_km.toString())
    setZoneFee(zone.fee.toString())
    setAreaNames(zone.area_names ? zone.area_names.join(', ') : '')
    setPincodes(zone.pincodes ? zone.pincodes.join(', ') : '')
    setZoneModalOpen(true)
  }

  function closeZoneModal() {
    setZoneModalOpen(false)
    setEditingZone(null)
    setZoneName('')
    setMaxDistanceKm('')
    setZoneFee('')
    setAreaNames('')
    setPincodes('')
  }

  async function handleSaveZone(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = zoneName.trim()
    const distNum = parseFloat(maxDistanceKm)
    const feeNum = parseFloat(zoneFee)

    if (!trimmedName) {
      showToast('Zone name is required', 'error')
      return
    }
    if (isNaN(distNum) || distNum < 0) {
      showToast('Max distance must be a positive number', 'error')
      return
    }
    if (isNaN(feeNum) || feeNum < 0) {
      showToast('Fee must be a valid number (0 or greater)', 'error')
      return
    }

    const parsedAreas = areaNames
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const parsedPincodes = pincodes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    setSavingZone(true)
    try {
      if (editingZone) {
        // Update existing zone
        const { error } = await supabase
          .from('delivery_zones')
          .update({
            zone_name: trimmedName,
            max_distance_km: distNum,
            fee: feeNum,
            area_names: parsedAreas,
            pincodes: parsedPincodes,
          })
          .eq('id', editingZone.id)

        if (error) throw error
        showToast(`Zone "${trimmedName}" updated successfully`, 'success')
      } else {
        // Create new zone
        const { error } = await supabase.from('delivery_zones').insert({
          zone_name: trimmedName,
          max_distance_km: distNum,
          fee: feeNum,
          area_names: parsedAreas,
          pincodes: parsedPincodes,
        })

        if (error) throw error
        showToast(`Zone "${trimmedName}" created successfully`, 'success')
      }

      closeZoneModal()
      fetchZones()
    } catch (err) {
      console.error('Error saving delivery zone:', err)
      showToast(err instanceof Error ? err.message : 'Failed to save delivery zone', 'error')
    } finally {
      setSavingZone(false)
    }
  }

  // ── Delete Zone with Orders Safety Check ──
  async function handleDeleteZone(zone: DeliveryZone) {
    setDeletingZoneId(zone.id)

    try {
      // 1. Check if any orders reference this delivery_zone_id
      try {
        const { count, error: orderCheckError } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('delivery_zone_id', zone.id)

        if (!orderCheckError && count !== null && count > 0) {
          showToast(
            `This zone is used by ${count} existing order${count > 1 ? 's' : ''} and cannot be deleted`,
            'error'
          )
          setDeletingZoneId(null)
          return
        }
      } catch (checkErr) {
        console.warn('Orders delivery_zone_id check skipped or unsupported:', checkErr)
      }

      // 2. Prompt confirmation
      const confirmed = window.confirm(
        `Are you sure you want to delete delivery zone "${zone.zone_name}"?`
      )
      if (!confirmed) {
        setDeletingZoneId(null)
        return
      }

      // 3. Delete from delivery_zones
      const { error: deleteError } = await supabase
        .from('delivery_zones')
        .delete()
        .eq('id', zone.id)

      if (deleteError) throw deleteError

      showToast(`Zone "${zone.zone_name}" deleted successfully`, 'success')
      fetchZones()
    } catch (err) {
      console.error('Error deleting zone:', err)
      showToast(err instanceof Error ? err.message : 'Failed to delete zone', 'error')
    } finally {
      setDeletingZoneId(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6B7259' }}>
        Loading settings...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '100%', width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 className="admin-section-title">Settings</h2>
        <p className="admin-section-sub">Configure your shop preferences, reviews, and delivery services</p>
      </div>

      {/* ════════ 1. GENERAL SHOP & REVIEW SETTINGS ════════ */}
      <div className="admin-content-card">
        <h3
          style={{
            fontFamily: 'Fraunces, serif',
            fontSize: '18px',
            fontWeight: 400,
            color: '#2B2420',
            marginBottom: '4px',
          }}
        >
          Customer Reviews
        </h3>
        <p
          style={{
            fontSize: '12px',
            color: '#6B7259',
            fontFamily: 'Inter, sans-serif',
            marginBottom: '24px',
          }}
        >
          Manage automated review follow-ups and link your Google Business listing.
        </p>

        <form onSubmit={handleSaveGeneralSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Review Delay Days */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#6B7259',
                marginBottom: '8px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Send review request after ___ days
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={reviewDelayDays}
              onChange={(e) => setReviewDelayDays(Math.max(0, parseInt(e.target.value) || 0))}
              required
              style={{
                width: '100%',
                maxWidth: '400px',
                border: '1px solid #E4DDD1',
                background: '#FAF7F2',
                color: '#2B2420',
                padding: '10px 14px',
                fontSize: '14px',
                borderRadius: 2,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                transition: 'border-color 0.18s',
                minHeight: '42px',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
            />
            <p style={{ fontSize: '11px', color: '#6B7259', marginTop: '6px', fontFamily: 'Inter, sans-serif' }}>
              Number of days after purchase to send a review request to customers
            </p>
          </div>

          {/* Google Place ID */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#6B7259',
                marginBottom: '8px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Google Business Place ID
            </label>
            <input
              type="text"
              value={googlePlaceId}
              onChange={(e) => setGooglePlaceId(e.target.value)}
              placeholder="e.g., ChIJN1t_tDeuEmsRUsoyG83frY4"
              style={{
                width: '100%',
                maxWidth: '400px',
                border: '1px solid #E4DDD1',
                background: '#FAF7F2',
                color: '#2B2420',
                padding: '10px 14px',
                fontSize: '14px',
                borderRadius: 2,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                transition: 'border-color 0.18s',
                minHeight: '42px',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
            />
            <p style={{ fontSize: '11px', color: '#6B7259', marginTop: '6px', fontFamily: 'Inter, sans-serif' }}>
              Find this in your{' '}
              <a
                href="https://support.google.com/business/answer/7035772"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#B8874B', textDecoration: 'underline' }}
              >
                Google Business Profile
              </a>
              {' — used to link customers directly to your review page.'}
            </p>
          </div>

          {/* Save Button */}
          <div style={{ paddingTop: '6px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: '#4A3728',
                color: '#FAF7F2',
                border: 'none',
                padding: '10px 20px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: saving ? 'not-allowed' : 'pointer',
                borderRadius: 2,
                transition: 'background 0.2s',
                fontFamily: 'Inter, sans-serif',
                opacity: saving ? 0.6 : 1,
                minHeight: '40px',
              }}
              onMouseEnter={(e) => !saving && (e.currentTarget.style.background = '#2B2420')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#4A3728')}
            >
              {saving ? 'Saving...' : 'Save Review Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* ════════ 2. DELIVERY SETTINGS & DELIVERY ZONES ════════ */}
      <div className="admin-content-card">
        <div style={{ borderBottom: '1px solid #E4DDD1', paddingBottom: '20px', marginBottom: '24px' }}>
          <h3
            style={{
              fontFamily: 'Fraunces, serif',
              fontSize: '18px',
              fontWeight: 400,
              color: '#2B2420',
              marginBottom: '4px',
            }}
          >
            Delivery Settings
          </h3>
          <p
            style={{
              fontSize: '12px',
              color: '#6B7259',
              fontFamily: 'Inter, sans-serif',
              margin: 0,
            }}
          >
            Control shop-wide delivery visibility and customize regional delivery zones.
          </p>
        </div>

        {/* Toggle Switch */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
            background: '#FAF7F2',
            border: '1px solid #E4DDD1',
            padding: '18px 20px',
            borderRadius: '2px',
            marginBottom: '32px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#2B2420',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Enable Delivery Service
              </span>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: deliveryEnabled ? 'rgba(107,114,89,0.15)' : 'rgba(168,75,59,0.15)',
                  color: deliveryEnabled ? '#525843' : '#A84B3B',
                  border: `1px solid ${deliveryEnabled ? 'rgba(107,114,89,0.3)' : 'rgba(168,75,59,0.3)'}`,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {deliveryEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: '#6B7259',
                margin: 0,
                fontFamily: 'Inter, sans-serif',
                lineHeight: 1.5,
              }}
            >
              When off, all delivery features are hidden from the storefront and admin.
            </p>
          </div>

          {/* Toggle button */}
          <button
            type="button"
            role="switch"
            aria-checked={deliveryEnabled}
            disabled={togglingDelivery}
            onClick={() => handleToggleDelivery(!deliveryEnabled)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              width: '48px',
              height: '26px',
              flexShrink: 0,
              background: deliveryEnabled ? '#4A3728' : '#D1C7BD',
              borderRadius: '9999px',
              border: 'none',
              padding: '2px',
              cursor: togglingDelivery ? 'wait' : 'pointer',
              transition: 'background-color 0.2s',
              opacity: togglingDelivery ? 0.7 : 1,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '22px',
                height: '22px',
                background: '#FAF7F2',
                borderRadius: '50%',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transform: deliveryEnabled ? 'translateX(22px)' : 'translateX(0)',
                transition: 'transform 0.2s',
              }}
            />
          </button>
        </div>

        {/* ── Delivery Zones Management ── */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div>
              <h4
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: '16px',
                  fontWeight: 400,
                  color: '#2B2420',
                  margin: 0,
                }}
              >
                Delivery Zones
              </h4>
              <p style={{ fontSize: '11px', color: '#6B7259', margin: '2px 0 0 0', fontFamily: 'Inter, sans-serif' }}>
                Set max distance coverage, locality areas, pincodes, and shipping fees per zone
              </p>
            </div>

            <button
              type="button"
              onClick={openAddZoneModal}
              style={{
                background: '#4A3728',
                color: '#FAF7F2',
                border: 'none',
                padding: '8px 16px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderRadius: '2px',
                fontFamily: 'Inter, sans-serif',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2B2420')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#4A3728')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add New Zone
            </button>
          </div>

          {/* Zones Table */}
          {loadingZones ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#6B7259', fontSize: '13px' }}>
              Loading delivery zones...
            </div>
          ) : zones.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                background: '#FAF7F2',
                border: '1px dashed #E4DDD1',
                borderRadius: '2px',
              }}
            >
              <p style={{ fontSize: '13px', color: '#6B7259', fontFamily: 'Inter, sans-serif', margin: 0 }}>
                No delivery zones configured yet. Click <strong>"Add New Zone"</strong> to define your first zone.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #E4DDD1', borderRadius: '2px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>
                <thead>
                  <tr style={{ background: '#FAF7F2', borderBottom: '1px solid #E4DDD1' }}>
                    <th
                      style={{
                        padding: '12px 16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#6B7259',
                      }}
                    >
                      Zone Name
                    </th>
                    <th
                      style={{
                        padding: '12px 16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#6B7259',
                      }}
                    >
                      Areas Covered
                    </th>
                    <th
                      style={{
                        padding: '12px 16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#6B7259',
                      }}
                    >
                      Max Distance
                    </th>
                    <th
                      style={{
                        padding: '12px 16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#6B7259',
                      }}
                    >
                      Delivery Fee
                    </th>
                    <th
                      style={{
                        padding: '12px 16px',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#6B7259',
                        textAlign: 'right',
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((zone, idx) => (
                    <tr
                      key={zone.id}
                      style={{
                        borderBottom: idx === zones.length - 1 ? 'none' : '1px solid #E4DDD1',
                        background: idx % 2 === 0 ? '#FFFFFF' : '#FAF7F2/40',
                      }}
                    >
                      <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#2B2420', verticalAlign: 'top' }}>
                        <div>{zone.zone_name}</div>
                        {zone.pincodes && zone.pincodes.length > 0 && (
                          <div style={{ fontSize: '11px', color: '#6B7259', fontWeight: 400, marginTop: '2px' }}>
                            {zone.pincodes.length} PIN{zone.pincodes.length > 1 ? 's' : ''}: {zone.pincodes.slice(0, 3).join(', ')}
                            {zone.pincodes.length > 3 ? ` +${zone.pincodes.length - 3}` : ''}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '12px', color: '#4A3728', verticalAlign: 'top', maxWidth: '280px' }}>
                        {zone.area_names && zone.area_names.length > 0 ? (
                          <div style={{ lineHeight: 1.4 }}>
                            {zone.area_names.join(', ')}
                          </div>
                        ) : (
                          <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>None specified</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#4A3728', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        {zone.max_distance_km} km
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 600, color: '#B8874B', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        ₹{Number(zone.fee).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => openEditZoneModal(zone)}
                            style={{
                              background: 'transparent',
                              border: '1px solid #E4DDD1',
                              color: '#4A3728',
                              padding: '6px 12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '2px',
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
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={deletingZoneId === zone.id}
                            onClick={() => handleDeleteZone(zone)}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(168,75,59,0.3)',
                              color: '#A84B3B',
                              padding: '6px 12px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '2px',
                              cursor: deletingZoneId === zone.id ? 'wait' : 'pointer',
                              transition: 'all 0.15s',
                              opacity: deletingZoneId === zone.id ? 0.6 : 1,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(168,75,59,0.08)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                            }}
                          >
                            {deletingZoneId === zone.id ? 'Checking...' : 'Delete'}
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
      </div>

      {/* ════════ ZONE ADD / EDIT MODAL ════════ */}
      {zoneModalOpen && (
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
            padding: '16px',
          }}
          onClick={closeZoneModal}
        >
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #E4DDD1',
              maxWidth: '520px',
              width: '100%',
              padding: '28px',
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
                height: '3px',
                background: '#B8874B',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3
                style={{
                  fontFamily: 'Fraunces, serif',
                  fontSize: '20px',
                  fontWeight: 400,
                  color: '#2B2420',
                  margin: 0,
                }}
              >
                {editingZone ? 'Edit Delivery Zone' : 'Add New Delivery Zone'}
              </h3>
              <button
                type="button"
                onClick={closeZoneModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  color: '#6B7259',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveZone} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Zone Name */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#6B7259',
                    marginBottom: '6px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Zone Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Zone 1 (Core City)"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid #E4DDD1',
                    background: '#FAF7F2',
                    color: '#2B2420',
                    padding: '10px 14px',
                    fontSize: '14px',
                    borderRadius: 2,
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                    transition: 'border-color 0.18s',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
                />
              </div>

              {/* Max Distance KM & Fee Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#6B7259',
                      marginBottom: '6px',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Max Distance (km) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    placeholder="e.g., 10"
                    value={maxDistanceKm}
                    onChange={(e) => setMaxDistanceKm(e.target.value)}
                    style={{
                      width: '100%',
                      border: '1px solid #E4DDD1',
                      background: '#FAF7F2',
                      color: '#2B2420',
                      padding: '10px 14px',
                      fontSize: '14px',
                      borderRadius: 2,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                      transition: 'border-color 0.18s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#6B7259',
                      marginBottom: '6px',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Delivery Fee (₹) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    placeholder="e.g., 500"
                    value={zoneFee}
                    onChange={(e) => setZoneFee(e.target.value)}
                    style={{
                      width: '100%',
                      border: '1px solid #E4DDD1',
                      background: '#FAF7F2',
                      color: '#2B2420',
                      padding: '10px 14px',
                      fontSize: '14px',
                      borderRadius: 2,
                      fontFamily: 'Inter, sans-serif',
                      outline: 'none',
                      transition: 'border-color 0.18s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
                  />
                </div>
              </div>

              {/* Areas Covered */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#6B7259',
                    marginBottom: '6px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Areas Covered
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g., Gachibowli, HITEC City, Madhapur, Kondapur, Jubilee Hills"
                  value={areaNames}
                  onChange={(e) => setAreaNames(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid #E4DDD1',
                    background: '#FAF7F2',
                    color: '#2B2420',
                    padding: '10px 14px',
                    fontSize: '13px',
                    borderRadius: 2,
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                    transition: 'border-color 0.18s',
                    resize: 'vertical',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
                />
                <p style={{ fontSize: '11px', color: '#6B7259', marginTop: '4px', fontFamily: 'Inter, sans-serif' }}>
                  Enter neighborhood names separated by commas (used for customer area matching).
                </p>
              </div>

              {/* Pincodes */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#6B7259',
                    marginBottom: '6px',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  Pincodes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g., 500032, 500081, 500084, 500019, 500033"
                  value={pincodes}
                  onChange={(e) => setPincodes(e.target.value)}
                  style={{
                    width: '100%',
                    border: '1px solid #E4DDD1',
                    background: '#FAF7F2',
                    color: '#2B2420',
                    padding: '10px 14px',
                    fontSize: '13px',
                    borderRadius: 2,
                    fontFamily: 'Inter, sans-serif',
                    outline: 'none',
                    transition: 'border-color 0.18s',
                    resize: 'vertical',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
                />
                <p style={{ fontSize: '11px', color: '#6B7259', marginTop: '4px', fontFamily: 'Inter, sans-serif' }}>
                  Enter 6-digit postal pincodes separated by commas.
                </p>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={closeZoneModal}
                  style={{
                    background: 'transparent',
                    border: '1px solid #E4DDD1',
                    color: '#6B7259',
                    padding: '10px 18px',
                    fontSize: '11px',
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
                  disabled={savingZone}
                  style={{
                    background: '#4A3728',
                    color: '#FAF7F2',
                    border: 'none',
                    padding: '10px 20px',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    cursor: savingZone ? 'not-allowed' : 'pointer',
                    borderRadius: 2,
                    fontFamily: 'Inter, sans-serif',
                    opacity: savingZone ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => !savingZone && (e.currentTarget.style.background = '#2B2420')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#4A3728')}
                >
                  {savingZone ? 'Saving...' : editingZone ? 'Update Zone' : 'Create Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
