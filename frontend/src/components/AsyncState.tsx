import { CircleAlert, SearchX } from 'lucide-react'

interface Props { title: string; message: string; onRetry?: () => void; compact?: boolean }
export function AsyncState({ title, message, onRetry, compact = false }: Props) {
  const Icon = onRetry ? CircleAlert : SearchX
  return <div className={'async-state' + (compact ? ' async-compact' : '')} role={onRetry ? 'alert' : 'status'}>
    <Icon size={28} aria-hidden="true" />
    <div><h3>{title}</h3><p>{message}</p></div>
    {onRetry && <button type="button" onClick={onRetry} className="button button-secondary">Try again</button>}
  </div>
}
