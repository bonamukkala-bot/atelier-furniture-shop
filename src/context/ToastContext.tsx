import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// ── Types ──────────────────────────────────────────────────────────────────────
export type ToastVariant = 'success' | 'error'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

// ── Context ────────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

// ── Provider + Container ───────────────────────────────────────────────────────
let idCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = ++idCounter
    setToasts((prev) => [...prev, { id, message, variant }])

    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
      delete timers.current[id]
    }, 3000)
  }, [])

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* ── Toast Container — fixed top-right ── */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                minWidth: 260,
                maxWidth: 360,
                padding: '12px 14px 12px 16px',
                background: '#fff',
                border: `1px solid ${toast.variant === 'success' ? '#C6DEC6' : '#E4C4C4'}`,
                borderLeft: `4px solid ${toast.variant === 'success' ? '#6B7259' : '#C0523C'}`,
                borderRadius: 2,
                boxShadow: '0 4px 20px rgba(43,36,32,0.12)',
                fontFamily: 'Inter, sans-serif',
                cursor: 'default',
              }}
            >
              {/* Icon */}
              <div
                style={{
                  flexShrink: 0,
                  marginTop: 1,
                  color: toast.variant === 'success' ? '#6B7259' : '#C0523C',
                }}
              >
                {toast.variant === 'success' ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </div>

              {/* Message */}
              <div
                style={{
                  flex: 1,
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: '#2B2420',
                  fontWeight: 500,
                }}
              >
                {toast.message}
              </div>

              {/* Dismiss button */}
              <button
                onClick={() => dismiss(toast.id)}
                style={{
                  flexShrink: 0,
                  background: 'none',
                  border: 'none',
                  color: '#6B7259',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  marginTop: -1,
                  opacity: 0.6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                aria-label="Dismiss"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
