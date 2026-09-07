import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { partnerLogin } from '../lib/partnerAuth'

export default function PartnerLoginPage() {
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanPhone = phone.trim()
    const cleanPin = pin.trim()

    if (!cleanPhone) {
      setError('Please enter your registered phone number.')
      return
    }

    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setError('Please enter your 4-digit secret PIN.')
      return
    }

    setLoading(true)

    try {
      await partnerLogin(cleanPhone, cleanPin)
      navigate('/partner/dashboard', { replace: true })
    } catch (err: any) {
      console.error('Partner login error:', err)
      setError(err instanceof Error ? err.message : 'Invalid phone number or 4-digit PIN.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAF7F2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#FFFFFF',
          border: '1px solid #E4DDD1',
          padding: '36px 28px',
          boxShadow: '0 20px 40px rgba(43, 36, 32, 0.08)',
          position: 'relative',
          borderRadius: 4,
        }}
      >
        {/* Top Gold Accent Strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'linear-gradient(90deg, #B8874B 0%, #D4AF37 100%)',
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
          }}
        />

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(184, 135, 75, 0.12)',
              color: '#B8874B',
              marginBottom: 12,
            }}
          >
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1" y="3" width="15" height="13" rx="1" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>

          <h1
            style={{
              fontFamily: 'Fraunces, serif',
              fontSize: 26,
              fontWeight: 400,
              color: '#2B2420',
              margin: '0 0 4px 0',
              letterSpacing: '-0.02em',
            }}
          >
            ATELIER
          </h1>
          <p
            style={{
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontWeight: 600,
              color: '#B8874B',
              margin: 0,
            }}
          >
            Delivery Partner Portal
          </p>
          <p
            style={{
              fontSize: 12,
              color: '#6B7259',
              margin: '8px 0 0 0',
            }}
          >
            Sign in with your registered phone number &amp; 4-digit PIN
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            style={{
              background: 'rgba(192, 82, 60, 0.08)',
              border: '1px solid rgba(192, 82, 60, 0.3)',
              color: '#C0523C',
              padding: '10px 14px',
              fontSize: 12,
              borderRadius: 2,
              marginBottom: 20,
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Phone Input */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#6B7259',
                marginBottom: 6,
              }}
            >
              Registered Phone Number
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="tel"
                placeholder="e.g., 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  border: '1px solid #E4DDD1',
                  borderRadius: 2,
                  fontSize: 14,
                  color: '#2B2420',
                  background: '#FAF7F2',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
              />
            </div>
          </div>

          {/* 4-Digit PIN Input */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: '#6B7259',
                marginBottom: 6,
              }}
            >
              4-Digit PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="• • • •"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                border: '1px solid #E4DDD1',
                borderRadius: 2,
                fontSize: 20,
                letterSpacing: '0.4em',
                textAlign: 'center',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: '#2B2420',
                background: '#FAF7F2',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#B8874B')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#E4DDD1')}
            />
            <p style={{ fontSize: 10, color: '#8A8178', margin: '6px 0 0 0' }}>
              Your 4-digit PIN is assigned by the workshop administrator.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !phone.trim() || pin.trim().length !== 4}
            style={{
              marginTop: 6,
              padding: '13px 16px',
              background:
                loading || !phone.trim() || pin.trim().length !== 4
                  ? '#A89E96'
                  : '#4A3728',
              color: '#FAF7F2',
              border: 'none',
              borderRadius: 2,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor:
                loading || !phone.trim() || pin.trim().length !== 4
                  ? 'not-allowed'
                  : 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 2px 8px rgba(74, 55, 40, 0.2)',
            }}
          >
            {loading ? 'Verifying Session...' : 'Sign In to Portal'}
          </button>
        </form>

        {/* Back Link */}
        <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid #E4DDD1', paddingTop: 16 }}>
          <Link
            to="/"
            style={{
              fontSize: 11,
              color: '#6B7259',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ← Return to Atelier Storefront
          </Link>
        </div>
      </div>
    </div>
  )
}
