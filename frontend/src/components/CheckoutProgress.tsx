export function CheckoutProgress({ step }: { step: 1 | 2 | 3 }) {
  return <ol className="checkout-steps" aria-label="Checkout progress">
    {['Cart', 'Payment', 'Demo keys'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined}><span aria-hidden="true">{index + 1}</span>{label}</li>)}
  </ol>
}
