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

    async function fetchCustomer() {
      const { data: userRecord } = await supabase
        .from('users')
        .select('customer_id, role')
        .eq('id', user!.id)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rec = userRecord as any
      if (rec?.customer_id) {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('id', rec.customer_id)
          .single()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = data as any
        if (c) setCustomer({ id: c.id, name: c.name, contact_email: c.contact_email ?? null })
      } else {
        setCustomer({
          id: user!.id,
          name: user!.user_metadata?.name || user!.email || 'Unbekannt',
          contact_email: user!.email ?? null,
        })
      }
      setLoading(false)
    }

    fetchCustomer()
  }, [user])

  return { customer, loading }
}
