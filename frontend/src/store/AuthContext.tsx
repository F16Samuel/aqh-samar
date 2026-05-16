import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/api/supabase'
import type { Session, User } from '@supabase/supabase-js'

export type UserRole = 'employee' | 'manager' | 'admin'

export interface AppUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  manager_id: string | null
  department_id: string | null
}

interface AuthState {
  session: Session | null
  user: AppUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(supabaseUser: User, accessToken: string) {
    // Store token so axios interceptor can pick it up
    localStorage.setItem('sb_access_token', accessToken)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/api/v1/users/me`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      const json = await res.json()
      if (json.data) setUser(json.data as AppUser)
    } catch {
      // Profile fetch failed — clear session
      localStorage.removeItem('sb_access_token')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        fetchProfile(data.session.user, data.session.access_token).finally(() =>
          setLoading(false),
        )
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) {
        fetchProfile(newSession.user, newSession.access_token)
      } else {
        setUser(null)
        localStorage.removeItem('sb_access_token')
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signOut() {
    await supabase.auth.signOut()
    localStorage.removeItem('sb_access_token')
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
