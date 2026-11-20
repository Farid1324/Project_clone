import { Link } from 'react-router-dom'

export function Brand() {
  return <Link to="/" className="brand" aria-label="Keymarket home">
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M7 7h15v15H7z" fill="var(--color-accent)" transform="rotate(-12 14 14)" />
      <path d="M18 16h15v15H18z" fill="var(--color-brand-pink)" transform="rotate(12 25 23)" />
      <path d="m13 23 8-8 4 4-8 8 2 2-4 4-6-6z" fill="var(--color-mint)" />
    </svg>
    <span>keymarket<span className="brand-dot">.</span></span>
  </Link>
}
