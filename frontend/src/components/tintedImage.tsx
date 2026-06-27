import type { CSSProperties } from "react";

interface TintedImageProps {
  src: string;
  alt: string;
  tintColor?: string;
  className?: string;
}

export function TintedImage({
  src,
  alt,
  tintColor = 'var(--icon, #FFF0E3)',
  className,
}: TintedImageProps) {
  // Resolve public-dir assets against the build's base path so root-absolute
  // refs like "/graph.svg" work both at the site root (desktop/mobile/web) and
  // under a sub-path like /demo/. BASE_URL is "/" for normal builds (no-op).
  const resolved = src.startsWith('/')
    ? import.meta.env.BASE_URL + src.slice(1)
    : src;

  const overlayStyle: CSSProperties = {
    backgroundColor: tintColor,
    WebkitMaskImage: `url(${resolved})`,
    maskImage: `url(${resolved})`,
    
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  };

  return (
    <div className={className ? `tinted-image ${className}` : 'tinted-image'}>
      <img src={resolved} alt={alt} />
      <div className="tinted-image-overlay" style={overlayStyle} />
    </div>
  );
}