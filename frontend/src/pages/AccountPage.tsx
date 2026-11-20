import { Link, useNavigate } from 'react-router-dom'
import { RequireAuth } from '../components/RequireAuth'
import { useSession, useSessionMutation } from '../hooks/useSession'
import { api } from '../lib/api'
import { usePageTitle } from '../hooks/usePageTitle'

export function AccountPage() {
  usePageTitle('Your account')
  const session = useSession()
  const logout = useSessionMutation(() => api.logout())
  const navigate = useNavigate()
  return <RequireAuth><div className="market-container auth-page"><div className="auth-card"><h1>Your account</h1><p>{session.data?.data.user?.name}</p><p>{session.data?.data.user?.email}</p><Link className="button button-primary" to="/orders">Order history</Link><p>Your saved cart stays with your account when you sign out.</p>
    <button className="button button-secondary" disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/', { replace: true }) })}>{logout.isPending ? 'Signing out…' : 'Sign out'}</button>
    {logout.isError && <p role="alert" className="field-error">{logout.error.message}</p>}
  </div></div></RequireAuth>
}
