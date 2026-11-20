import { useState, type ImgHTMLAttributes } from 'react'

type MarketplaceImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src: string | null | undefined
}

export function MarketplaceImage(props: MarketplaceImageProps) {
  return <ImageSource key={props.src ?? ''} {...props} />
}

function ImageSource({ src, alt = '', ...attributes }: MarketplaceImageProps) {
  const [failed, setFailed] = useState(false)
  const source = src?.trim()
  const fallback = failed || !source
  return <img {...attributes}
    src={fallback ? '/demo/cover-unavailable.svg' : source}
    alt={fallback && alt ? 'Artwork unavailable. ' + alt : alt}
    data-artwork-fallback={fallback ? 'true' : undefined}
    onError={fallback ? undefined : () => setFailed(true)} />
}
