import type { CSSProperties } from "react";

interface TintedImageProps {
  src: string;
  alt: string;
  tintColor?: string;
  blendMode?: CSSProperties['mixBlendMode'];
  className?: string;
}

export function TintedImage({
  src,
  alt,
  tintColor = '#FFF0E3',
  blendMode = 'multiply',
  className,
}: TintedImageProps) {
  
  const containerStyle: CSSProperties = {
    position: 'relative',
    display: 'inline-block', 
    overflow: 'hidden',
  };

  const imageStyle: CSSProperties = {
    display: 'block', 
    width: '100%',
    height: 'auto',
  };

  const overlayStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: tintColor,
    mixBlendMode: blendMode,
    pointerEvents: 'none',
    
    WebkitMaskImage: `url(${src})`,
    WebkitMaskSize: '100% 100%',
    maskImage: `url(${src})`,
    maskSize: '100% 100%',
  };

  return (
    <div className={className} style={containerStyle}>
      <img src={src} alt={alt} style={imageStyle} />
      <div style={overlayStyle} />
    </div>
  );
}