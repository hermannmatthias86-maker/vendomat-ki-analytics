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
        console.info('[useCustomer] auth.uid =', user!.id, '| users-Eintrag:', rec ?? 'KEIN EINTRAG (Fallback auf user.id)')

        if (rec?.customer_id) {
          const { data } = await supabase
            .from('customers')
            .select('*')
            .eq('id', rec.customer_id)
            .maybeSingle()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = data as any
          const resolved = c ? { id: c.id, name: c.name, contact_email: c.contact_email ?? null } : fallback
          console.info('[useCustomer] customer_id (aus customers-Tabelle):', resolved.id, '| Name:', resolved.name)
          setCustomer(resolved)
        } else {
          console.info('[useCustomer] customer_id (Fallback = user.id):', fallback.id)
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
  }, [user])

  return { customer, loading }
}
