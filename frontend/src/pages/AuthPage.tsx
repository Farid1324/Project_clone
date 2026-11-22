import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { useSession, useSessionMutation } from '../hooks/useSession'
import { usePageTitle } from '../hooks/usePageTitle'

export function AuthPage({ register = false }: { register?: boolean }) {
  usePageTitle(register ? 'Create account' : 'Sign in')
  const [params] = useSearchParams()
  const target = params.get('returnTo') ?? ''
  const wishlistReturn = /^\/wishlist(?:\?save=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\?page=[1-9][0-9]{0,4})?$/i.test(target)
  const destination = ['/checkout', '/cart', '/orders', '/account'].includes(target) || /^\/orders\/[0-9a-f-]{36}$/i.test(target) || wishlistReturn ? target : '/cart'
  const session = useSession()
  const navigate = useNavigate()
  const [fields, setFields] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const mutation = useSessionMutation((values: typeof fields) => register ? api.register(values) : api.login({ email: values.email, password: values.password }))
  if (session.data?.data.user && !mutation.isPending && !mutation.isSuccess) return <Navigate to={destination} replace />
  async function submit(event: FormEvent) {
    event.preventDefault()
    const response = await mutation.mutateAsync(fields).catch(() => null)
    if (response) { setFields({ name: '', email: '', password: '', password_confirmation: '' }); navigate(destination, { replace: true, state: { notices: response.data.cart_merge_notices } }) }
  }
  const errors = mutation.error instanceof ApiError ? mutation.error.fields : undefined
  return <div className="market-container auth-page"><div className="auth-card"><p className="eyebrow">YOUR DEMO ACCOUNT</p><h1>{register ? 'Create account' : 'Welcome back'}</h1><p>Save your cart and retrieve purchased demo keys. No real payments.</p>
    <form onSubmit={event => void submit(event)} className="auth-form">
      {(register ? ['name', 'email', 'password', 'password_confirmation'] as const : ['email', 'password'] as const).map(field => <div className="form-field" key={field}><label htmlFor={field}>{({ name: 'Name', email: 'Email', password: 'Password', password_confirmation: 'Confirm password' })[field]}</label>
        <input id={field} name={field} type={field.includes('password') ? 'password' : field === 'email' ? 'email' : 'text'} value={fields[field]} onChange={event => setFields(current => ({ ...current, [field]: event.target.value }))} required
          autoComplete={field === 'name' ? 'name' : field === 'email' ? 'username' : register ? 'new-password' : 'current-password'} maxLength={field === 'name' ? 120 : field === 'email' ? 254 : 72} minLength={register && field.includes('password') ? 12 : undefined}
          aria-invalid={Boolean(errors?.[field])} aria-describedby={errors?.[field] ? field + '-error' : undefined} />
        {errors?.[field] && <p id={field + '-error'} className="field-error">{errors[field].join(' ')}</p>}</div>)}
      {register && <p className="muted">Use a unique passphrase of at least 12 characters, up to 72 UTF-8 bytes.</p>}
      {mutation.isError && <p role="alert" className="field-error">{mutation.error.message}</p>}
      <button className="button button-primary" disabled={mutation.isPending || session.isPending}>{mutation.isPending ? 'Please wait…' : register ? 'Create demo account' : 'Sign in'}</button>
    </form><p>{register ? 'Already registered?' : 'New to Keymarket?'} <Link className="text-link" to={(register ? '/login?' : '/register?') + new URLSearchParams({ returnTo: destination })}>{register ? 'Sign in' : 'Create account'}</Link></p>
  </div></div>
}
