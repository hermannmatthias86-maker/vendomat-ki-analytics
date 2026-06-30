import { useAppData } from '../context/AppDataContext'

/**
 * Reads auth state from the shared AppDataProvider. The session is loaded once
 * per app session, not per component mount.
 */
export function useAuth() {
  const { user, session, authLoading, isAuthenticated } = useAppData()
  return { user, session, loading: authLoading, isAuthenticated }
}
