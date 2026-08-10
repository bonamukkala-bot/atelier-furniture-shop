import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../context/ToastContext'

function Settings() {
  const { showToast } = useToast()
  const [reviewDelayDays, setReviewDelayDays] = useState(4)
  const [googlePlaceId, setGooglePlaceId] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSettings() {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (error) {
        // If no row exists yet, use defaults
        if (error.code === 'PGRST116') {
          setReviewDelayDays(4)
          setGooglePlaceId('')
        } else {
          showToast('Failed to load settings', 'error')
        }
      } else if (data) {
        setReviewDelayDays(data.review_delay_days ?? 4)
        setGooglePlaceId(data.google_place_id ?? '')
      }
      setLoading(false)
    }

    fetchSettings()
  }, [showToast])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const { error } = await supabase
        .from('shop_settings')
        .upsert({
          id: 1,
          review_delay_days: reviewDelayDays,
          google_place_id: googlePlaceId || null,
        })

      if (error) throw error

      showToast('Settings saved successfully', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
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
    <div style={{ maxWidth: '100%', width: '100%' }}>
      <h2 className="admin-section-title">Settings</h2>
      <p className="admin-section-sub">Configure your shop preferences</p>

      <div className="admin-content-card">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                border: '1px solid #E4DDD1',
                background: '#FAF7F2/50',
                color: '#2B2420',
                padding: '12px 16px',
                fontSize: '14px',
                borderRadius: 2,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                transition: 'border-color 0.18s',
                minHeight: '44px',
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
                border: '1px solid #E4DDD1',
                background: '#FAF7F2/50',
                color: '#2B2420',
                padding: '12px 16px',
                fontSize: '14px',
                borderRadius: 2,
                fontFamily: 'Inter, sans-serif',
                outline: 'none',
                transition: 'border-color 0.18s',
                minHeight: '44px',
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
          <div style={{ paddingTop: '8px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: '#4A3728',
                color: '#FAF7F2',
                border: 'none',
                padding: '12px 24px',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: saving ? 'not-allowed' : 'pointer',
                borderRadius: 2,
                transition: 'background 0.2s',
                fontFamily: 'Inter, sans-serif',
                opacity: saving ? 0.6 : 1,
                minHeight: '44px',
              }}
              onMouseEnter={(e) => !saving && (e.currentTarget.style.background = '#2B2420')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#4A3728')}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Settings
