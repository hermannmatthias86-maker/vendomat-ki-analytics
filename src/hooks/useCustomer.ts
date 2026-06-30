import { useAppData, type CustomerProfile } from '../context/AppDataContext'

export type { CustomerProfile }

/**
 * Reads the current customer from the shared AppDataProvider. The customer is
 * fetched once per authenticated user, so navigating between pages no longer
 * re-queries `users`/`customers`.
 */
export function useCustomer() {
  const { customer, customerLoading } = useAppData()
  return { customer, loading: customerLoading }
}
