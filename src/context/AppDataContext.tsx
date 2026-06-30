import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface CustomerProfile {
  id: string
  name: string
  contact_email: string | null
}

interface AppData {
  user: User | null
  session: Session | null
  authLoading: boolean
  isAuthenticated: boolean
  customer: CustomerProfile | null
  customerLoading: boolean
}

const AppDataContext = createContext<AppData | undefined>(undefined)

/**
 * Loads auth session + customer profile exactly ONCE per session and shares them
 * via context. Previously every page mounted its own `useAuth`/`useCustomer`,
 * so `users`/`customers` were re-fetched on every navigation (and logged 3–4×
 * under StrictMode). With a single provider there is one subscription, one
 * customer fetch per user, and one place that logs failures.
 */
export function AppDataProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [customerLoading, setCustomerLoading] = useState(true)

  // The user id we have already fetched (or are fetching) the customer for.
  // Used to dedupe: navigation re-renders consumers but must not refetch.
  const fetchedForUser = useRef<string | null>(null)

  // One auth subscription for the whole app.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch the customer once per authenticated user.
  useEffect(() => {
    if (authLoading) return // wait until we know whether someone is signed in

    if (!user) {
      setCustomer(null)
      setCustomerLoading(false)
      fetchedForUser.current = null
      return
    }

    // Already loaded / loading for this user → don't refetch on navigation.
    if (fetchedForUser.current === user.id) return
    fetchedForUser.current = user.id

    const requestedId = user.id
    const fallback: CustomerProfile = {
      id: requestedId,
      name: user.user_metadata?.name || user.email || 'Unbekannt',
      contact_email: user.email ?? null,
    }

    setCustomerLoading(true)
    ;(async () => {
      try {
        const { data: userRecord } = await supabase
          .from('users')
          .select('customer_id, role')
          .eq('id', requestedId)
          .maybeSingle()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rec = userRecord as any
        let result = fallback
        if (rec?.customer_id) {
          const { data } = await supabase
            .from('customers')
            .select('*')
            .eq('id', rec.customer_id)
            .maybeSingle()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = data as any
          if (c) result = { id: c.id, name: c.name, contact_email: c.contact_email ?? null }
        }

        // Ignore stale responses if the active user changed meanwhile.
        if (fetchedForUser.current !== requestedId) return
        setCustomer(result)
        setCustomerLoading(false)
      } catch (err) {
        if (fetchedForUser.current !== requestedId) return
        console.error('[AppData] customer load failed:', err)
        setCustomer(fallback)
        setCustomerLoading(false)
        fetchedForUser.current = null // allow a retry on the next navigation
      }
    })()
  // Depend on user.id (string) — auth events recreate the user object even when
  // the session is unchanged, which would otherwise trigger needless refetches.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading])

  return (
    <AppDataContext.Provider
      value={{
        user,
        session,
        authLoading,
        isAuthenticated: !!user,
        customer,
        customerLoading,
      }}
    >
      {children}
    </AppDataContext.Provider>
  )
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider')
  return ctx
}
