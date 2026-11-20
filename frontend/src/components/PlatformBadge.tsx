import { Gamepad2, Monitor, CreditCard } from 'lucide-react'
import type { Platform } from '../types/api'

export function PlatformBadge({ platform, giftCard = false }: { platform: Platform; giftCard?: boolean }) {
  const Icon = giftCard ? CreditCard : platform.slug === 'steam' ? Monitor : Gamepad2
  return <span className="platform-badge"><Icon size={15} aria-hidden="true" />{platform.name}</span>
}
