import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface CustomerProfile {
  id: string
  name: string
  contact_email: string | null
}

export function useCustomer() {
  const { user } = useAuth()
  const [customer, setCustomer] = useState<CustomerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const fallback: CustomerProfile = {
      id: user!.id,
      name: user!.user_metadata?.name || user!.email || 'Unbekannt',
      contact_email: user!.email ?? null,
    }

    async function fetchCustomer() {
      try {
        const { data: userRecord } = await supabase
          .from('users')
          .select('customer_id, role')
          .eq('id', user!.id)
          .maybeSingle()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rec = userRecord as any
        if (rec?.customer_id) {
          const { data } = await supabase
            .from('customers')
            .select('*')
            .eq('id', rec.customer_id)
            .maybeSingle()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = data as any
          setCustomer(c ? { id: c.id, name: c.name, contact_email: c.contact_email ?? null } : fallback)
        } else {
          setCustomer(fallback)
        }
      } catch (err) {
        console.error('[useCustomer] fetchCustomer error:', err)
        setCustomer(fallback)
      } finally {
        setLoading(false)
      }
    }

    fetchCustomer()
  // Depend on user.id string, not the user object — auth state changes create
  // new object references on every event even when the session hasn't changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  return { customer, loading }
}
