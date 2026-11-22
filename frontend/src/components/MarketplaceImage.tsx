import { useState, type ImgHTMLAttributes } from 'react'
import { ImageOff } from 'lucide-react'

type MarketplaceImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src: string | null | undefined
}

export function MarketplaceImage(props: MarketplaceImageProps) {
  return <ImageSource key={props.src ?? ''} {...props} />
}

function ImageSource({ src, alt = '', ...attributes }: MarketplaceImageProps) {
  const [failed, setFailed] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)
  const source = src?.trim()
  const fallback = failed || !source || source === '/demo/cover-unavailable.svg'
  if (fallbackFailed) return <span className={['marketplace-image-terminal', attributes.className].filter(Boolean).join(' ')} style={attributes.style}
    role={alt ? 'img' : undefined} aria-label={alt ? 'Artwork unavailable. ' + alt : undefined} aria-hidden={alt ? undefined : true}
    data-artwork-fallback="true" data-artwork-terminal="true"><ImageOff size={32} aria-hidden="true" /><span>Artwork unavailable</span></span>
  return <img {...attributes}
    src={fallback ? '/demo/cover-unavailable.svg' : source}
    alt={fallback && alt ? 'Artwork unavailable. ' + alt : alt}
    data-artwork-fallback={fallback ? 'true' : undefined}
    onError={() => fallback ? setFallbackFailed(true) : setFailed(true)} />
}
