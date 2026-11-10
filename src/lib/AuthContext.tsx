import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

interface AuthContextType {
  session: Session | null
  isAdmin: boolean
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  isAdmin: false,
  loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkedUserId, setCheckedUserId] = useState<string | null | undefined>(undefined)

  // 1. Session effect: getSession() once + onAuthStateChange (calls setSession only)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  // 2. Separate admin effect: runs when session?.user?.id changes
  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!sessionLoaded) return

    let cancelled = false

    if (!userId) {
      setIsAdmin(false)
      setCheckedUserId(null)
      return
    }

    async function verifyAdmin() {
      try {
        const { data, error } = await supabase.rpc('is_admin')
        if (cancelled) return
        if (error) {
          console.error('Error verifying admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(data === true)
        }
      } catch (err) {
        if (cancelled) return
        console.error('Unexpected error verifying admin status:', err)
        setIsAdmin(false)
      } finally {
        if (!cancelled) {
          setCheckedUserId(userId)
        }
      }
    }

    verifyAdmin()

    return () => {
      cancelled = true
    }
  }, [userId, sessionLoaded])

  // loading stays true until both initial session check and admin check for current user are finished
  const loading = !sessionLoaded || checkedUserId !== userId

  return (
    <AuthContext.Provider value={{ session, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
