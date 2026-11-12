import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/AuthContext'

export default function CustomerAccountControl() {
  const { t } = useTranslation()
  const { session, user, loading, signInWithGoogle, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  // Feature flag check: render nothing if not enabled
  if (import.meta.env.VITE_CUSTOMER_SIGNIN !== 'true') {
    return null
  }

  // Avoid layout shift while checking session
  if (loading) {
    return null
  }

  const handleSignIn = async () => {
    setErrorMessage(null)
    setConnecting(true)
    const { error } = await signInWithGoogle()
    if (error) {
      console.error('Google sign-in error:', error)
      setErrorMessage(t('account.signInFailed'))
      setConnecting(false)
    }
  }

  const handleSignOut = async () => {
    setMenuOpen(false)
    const { error } = await signOut()
    if (error) {
      console.error('Sign-out error:', error)
    }
  }

  // ── Signed out state ──
  if (!session || !user) {
    return (
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={handleSignIn}
          disabled={connecting}
          aria-label={t('account.signInWithGoogle')}
          title={t('account.signInWithGoogle')}
          className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-2.5 sm:px-3 py-1.5 border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] hover:text-[var(--gold)] hover:border-[var(--gold)] font-inter text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50"
        >
          {/* Google G Icon rendered in currentColor */}
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span className="hidden sm:inline">
            {connecting ? t('account.connecting') : t('account.signIn')}
          </span>
        </button>

        {errorMessage && (
          <div
            role="alert"
            className="absolute top-full right-0 mt-1.5 z-50 p-2 bg-[var(--bg)] border border-[var(--border)] text-[11px] text-[var(--ink)] font-inter shadow-md whitespace-nowrap"
          >
            {errorMessage}
          </div>
        )}
      </div>
    )
  }

  // ── Signed in state ──
  const metadata = user.user_metadata || {}
  const fullName =
    metadata.full_name ||
    metadata.name ||
    user.email?.split('@')[0] ||
    t('account.customer')
  const email = user.email || ''
  const avatarUrl = metadata.avatar_url || metadata.picture || null
  const firstName = fullName.trim().split(' ')[0]
  const initial = (firstName[0] || 'C').toUpperCase()

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-label={menuOpen ? t('account.closeAccountMenu') : t('account.openAccountMenu')}
        className="inline-flex items-center gap-1.5 min-h-[40px] px-2 sm:px-2.5 py-1 border border-[var(--border)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--gold)] transition-colors cursor-pointer"
        title={fullName}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-[var(--border)] shrink-0"
          />
        ) : (
          <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[var(--gold)]/10 text-[var(--gold)] font-fraunces text-xs font-semibold flex items-center justify-center shrink-0">
            {initial}
          </span>
        )}

        <span className="hidden sm:inline font-inter text-xs text-[var(--ink)] max-w-[100px] truncate">
          {firstName}
        </span>

        <svg
          className={`w-3.5 h-3.5 text-[var(--muted)] transition-transform duration-200 shrink-0 ${
            menuOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg)] border border-[var(--border)] shadow-md z-50 py-1.5"
        >
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="font-fraunces text-sm font-semibold text-[var(--ink)] truncate">
              {fullName}
            </p>
            {email && (
              <p className="font-inter text-xs text-[var(--muted)] truncate mt-0.5">
                {email}
              </p>
            )}
          </div>

          <Link
            to="/my-orders"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className="w-full text-left px-3 py-2 text-xs font-inter font-medium text-[var(--ink)] hover:text-[var(--gold)] hover:bg-[var(--border)]/20 transition-colors flex items-center gap-2 cursor-pointer min-h-[40px]"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
              />
            </svg>
            <span>{t('account.myOrders')}</span>
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 text-xs font-inter font-medium text-[var(--muted)] hover:text-[var(--gold)] hover:bg-[var(--border)]/20 transition-colors flex items-center gap-2 cursor-pointer min-h-[40px]"
          >
            <svg
              className="w-3.5 h-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
            <span>{t('account.signOut')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
