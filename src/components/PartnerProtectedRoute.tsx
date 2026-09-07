import { type ReactNode, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { getStoredPartnerSession } from '../lib/partnerAuth'
import type { PartnerSession } from '../lib/types'

export default function PartnerProtectedRoute({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PartnerSession | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const s = getStoredPartnerSession()
    setSession(s)
    setChecking(false)
  }, [])

  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#FAF7F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Inter, sans-serif',
          color: '#6B7259',
          fontSize: 13,
        }}
      >
        Authenticating delivery partner session...
      </div>
    )
  }

  if (!session || !session.token) {
    return <Navigate to="/partner-login" replace />
  }

  return <>{children}</>
}
