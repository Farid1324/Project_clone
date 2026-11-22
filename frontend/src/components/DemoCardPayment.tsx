import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from 'react'
import { CreditCard, LoaderCircle, ShieldCheck } from 'lucide-react'
import { formatMoney } from '../lib/format'
import type { PurchaseRequest } from '../types/api'

const testCards = [
  { number: '4242424242424242', label: 'Approved', description: 'Payment succeeds', scenario: 'approve' },
  { number: '4000000000000002', label: 'Declined', description: 'Payment is declined', scenario: 'decline' },
  { number: '4000002500003155', label: 'Verification', description: 'Try a verification code', scenario: 'verify' },
] as const

type CardFields = { name: string; number: string; expiry: string; cvc: string; country: string; postal: string }
type Field = keyof CardFields
const emptyFields: CardFields = { name: '', number: '', expiry: '', cvc: '', country: '', postal: '' }
const fieldOrder: Field[] = ['name', 'number', 'expiry', 'cvc', 'country', 'postal']
const countries = { AZ: 'Azerbaijan', DE: 'Germany', LT: 'Lithuania', GB: 'United Kingdom', US: 'United States', other: 'Other' }
// Retain extra digits so an unsupported longer number is rejected, never truncated into a sample card.
const formatCard = (value: string) => value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})(?=.)/g, '$1 ')

function errorsFor(fields: CardFields): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {}
  if (fields.name.trim().length < 2) errors.name = 'Enter a demo cardholder name.'
  if (!testCards.some(card => card.number === fields.number.replace(/\s/g, ''))) errors.number = 'Use one of the sample test cards below.'
  const match = /^(\d{2})\/(\d{2})$/.exec(fields.expiry)
  const now = new Date()
  const month = match ? Number(match[1]) : 0
  const year = match ? 2000 + Number(match[2]) : 0
  if (month < 1 || month > 12 || year * 12 + month <= now.getFullYear() * 12 + now.getMonth() + 1) errors.expiry = 'Enter a future expiry month (MM/YY).'
  if (!/^\d{3}$/.test(fields.cvc)) errors.cvc = 'Enter a 3-digit demo CVC.'
  if (!Object.hasOwn(countries, fields.country)) errors.country = 'Select a billing country.'
  if (fields.postal.trim().length < 2) errors.postal = 'Enter a demo postal code.'
  return errors
}

function DemoVerification({ amount, disabled, onConfirm, onCancel }: { amount: number; disabled: boolean; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    codeInput.current?.focus()
    return () => element?.close()
  }, [])
  function confirm(event: FormEvent) {
    event.preventDefault()
    if (disabled) return
    if (code !== '123456') { setError(true); dialog.current?.querySelector<HTMLInputElement>('input')?.focus(); return }
    onConfirm()
  }
  return <dialog ref={dialog} className="demo-verification" aria-labelledby="verification-title" aria-describedby="verification-description" onCancel={event => { event.preventDefault(); onCancel() }} onKeyDown={event => {
    if (event.key !== 'Tab') return
    if (event.shiftKey && document.activeElement === codeInput.current) { event.preventDefault(); cancelButton.current?.focus() }
    else if (!event.shiftKey && document.activeElement === cancelButton.current) { event.preventDefault(); codeInput.current?.focus() }
  }}>
    <div className="verification-mark"><ShieldCheck aria-hidden="true" size={32} /></div>
    <p className="eyebrow">SIMULATED VERIFICATION</p><h2 id="verification-title">Verify your demo payment</h2>
    <p className="verification-amount">{formatMoney(amount)}</p>
    <p id="verification-description">This simulates a bank verification step. Enter the test code <strong>123456</strong>. No bank is contacted.</p>
    <form onSubmit={confirm} noValidate>
      <div className="form-field"><label htmlFor="demo-verification-code">Verification code</label>
        <input ref={codeInput} id="demo-verification-code" autoFocus autoComplete="off" required inputMode="numeric" maxLength={6} value={code} onChange={event => { setCode(event.target.value.replace(/\D/g, '')); setError(false) }} aria-invalid={error} aria-describedby={error ? 'verification-error' : undefined} />
        {error && <p className="field-error" id="verification-error" role="alert">Use the demo verification code 123456.</p>}
      </div>
      <button className="button button-primary" disabled={disabled}>Confirm demo payment</button>
      <button ref={cancelButton} type="button" className="button button-secondary" onClick={onCancel}>Cancel verification</button>
    </form>
  </dialog>
}

export function DemoCardPayment({ amount, disabled, processing, confirmed, onConfirmedChange, onPay }: {
  amount: number
  disabled: boolean
  processing: boolean
  confirmed: boolean
  onConfirmedChange: (value: boolean) => void
  onPay: (scenario: PurchaseRequest['scenario']) => void
}) {
  const form = useRef<HTMLFormElement>(null)
  const submitButton = useRef<HTMLButtonElement>(null)
  const [fields, setFields] = useState<CardFields>(emptyFields)
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
  const [verifying, setVerifying] = useState(false)
  const [notice, setNotice] = useState('')
  const errors = errorsFor(fields)
  const selected = testCards.find(card => card.number === fields.number.replace(/\s/g, ''))
  const locked = disabled || processing || verifying

  function change(field: Field, value: string) { setNotice(''); setFields(current => ({ ...current, [field]: value })) }
  function fillCard(card: typeof testCards[number]) {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 2)
    setFields({ name: 'DEMO SHOPPER', number: formatCard(card.number), expiry: String(future.getMonth() + 1).padStart(2, '0') + '/' + String(future.getFullYear()).slice(-2), cvc: '123', country: 'LT', postal: '01100' })
    setTouched({})
    setNotice('')
  }
  function finish(scenario: PurchaseRequest['scenario']) {
    setVerifying(false)
    setFields(emptyFields)
    setTouched({})
    setNotice('')
    onPay(scenario)
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (locked || !confirmed) return
    const firstInvalid = fieldOrder.find(field => errors[field])
    if (firstInvalid) {
      setTouched(Object.fromEntries(fieldOrder.map(field => [field, true])))
      setNotice('Check the highlighted card fields before paying.')
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('#demo-card-' + firstInvalid)?.focus())
      return
    }
    if (selected?.scenario === 'verify') setVerifying(true)
    else if (selected) finish(selected.scenario)
  }
  function cancelVerification() {
    setVerifying(false)
    setFields(emptyFields)
    setTouched({})
    onConfirmedChange(false)
    setNotice('Verification cancelled. No payment was sent. Select a sample card to try again.')
    requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('#demo-card-name')?.focus())
  }
  const fieldError = (field: Field) => touched[field] && errors[field] ? <p className="field-error" id={'demo-card-' + field + '-error'}>{errors[field]}</p> : null
  const inputProps = (field: Field) => ({
    id: 'demo-card-' + field, value: fields[field], disabled: locked, autoComplete: 'off', required: true,
    // Submit validates all fields. Avoid moving the pay button between pointer-down/up
    // by inserting a blur error just as the shopper clicks it.
    onBlur: (event: FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (event.relatedTarget !== submitButton.current) setTouched(current => ({ ...current, [field]: true }))
    },
    'aria-invalid': Boolean(touched[field] && errors[field]),
    'aria-describedby': touched[field] && errors[field] ? 'demo-card-' + field + '-error' : undefined,
  })

  return <>
    <div className="payment-heading"><div><p className="eyebrow">CARD PAYMENT</p><h2>Demo checkout</h2></div><span className="payment-test-badge">TEST MODE</span></div>
    <p className="payment-privacy" id="demo-card-help"><ShieldCheck aria-hidden="true" size={19} /><span>Use the sample cards below. Card details stay in this page and are never sent to our server. No money is charged.</span></p>
    <div className="demo-card-preview" aria-hidden="true">
      <div className="preview-top"><span>KEYMARKET</span><CreditCard size={27} /></div>
      <span className="preview-number">•••• •••• •••• {fields.number.replace(/\D/g, '').length >= 4 ? fields.number.replace(/\D/g, '').slice(-4) : '••••'}</span>
      <div className="preview-bottom"><span>{fields.name.trim() || 'DEMO CARDHOLDER'}</span><span>{fields.expiry || 'MM/YY'}</span></div>
    </div>
    <fieldset className="sample-cards" disabled={locked}><legend>Choose a test card</legend><div className="sample-card-options">
      {testCards.map(card => <button type="button" key={card.number} className={'sample-card' + (selected?.number === card.number ? ' is-selected' : '')} aria-pressed={selected?.number === card.number} onClick={() => fillCard(card)}>
        <strong>{card.label}</strong><span>{formatCard(card.number)}</span><small>{card.description}</small>
      </button>)}
    </div><p>Click a card to fill sample details, or enter them yourself. Use a future expiry and any 3-digit CVC.</p></fieldset>
    <form ref={form} className="demo-card-form" onSubmit={submit} noValidate aria-describedby="demo-card-help">
      <div className="form-field"><label htmlFor="demo-card-name">Cardholder name</label><input {...inputProps('name')} maxLength={80} placeholder="DEMO SHOPPER" onChange={event => change('name', event.target.value)} />{fieldError('name')}</div>
      <div className="form-field"><label htmlFor="demo-card-number">Card number</label><input {...inputProps('number')} inputMode="numeric" maxLength={23} placeholder="4242 4242 4242 4242" onChange={event => change('number', formatCard(event.target.value))} />{fieldError('number')}</div>
      <div className="card-field-row">
        <div className="form-field"><label htmlFor="demo-card-expiry">Expiry date</label><input {...inputProps('expiry')} inputMode="numeric" maxLength={5} placeholder="MM/YY" onChange={event => { const digits = event.target.value.replace(/\D/g, '').slice(0, 4); change('expiry', digits.length > 2 ? digits.slice(0, 2) + '/' + digits.slice(2) : digits) }} />{fieldError('expiry')}</div>
        <div className="form-field"><label htmlFor="demo-card-cvc">CVC</label><input {...inputProps('cvc')} type="password" inputMode="numeric" maxLength={3} placeholder="123" onChange={event => change('cvc', event.target.value.replace(/\D/g, '').slice(0, 3))} />{fieldError('cvc')}</div>
      </div>
      <div className="card-field-row">
        <div className="form-field"><label htmlFor="demo-card-country">Billing country</label><select {...inputProps('country')} onChange={event => change('country', event.target.value)}><option value="">Select country</option>{Object.entries(countries).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{fieldError('country')}</div>
        <div className="form-field"><label htmlFor="demo-card-postal">Postal code</label><input {...inputProps('postal')} maxLength={16} placeholder="01100" onChange={event => change('postal', event.target.value)} />{fieldError('postal')}</div>
      </div>
      <label className="checkout-consent"><input type="checkbox" checked={confirmed} disabled={locked} onChange={event => onConfirmedChange(event.target.checked)} /><span>I reviewed the seller prices, stock, platforms and activation regions.</span></label>
      {notice && <p className="payment-form-notice" role="status">{notice}</p>}
      <button ref={submitButton} type="submit" className="button button-primary card-pay-button" disabled={locked || !confirmed}>{processing ? <><LoaderCircle className="payment-spinner" aria-hidden="true" size={20} />Processing demo payment…</> : <>Pay {formatMoney(amount)} <span>· demo</span></>}</button>
      <p className="payment-footnote">Approval delivers nonredeemable demo keys. A declined payment keeps your cart so you can try again.</p>
    </form>
    {verifying && <DemoVerification amount={amount} disabled={disabled || processing || !confirmed} onConfirm={() => finish('approve')} onCancel={cancelVerification} />}
  </>
}
