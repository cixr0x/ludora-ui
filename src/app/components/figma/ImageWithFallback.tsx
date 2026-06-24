import React, { useEffect, useRef, useState } from 'react'

type ImageWithFallbackProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  lazy?: boolean;
  lazyRootMargin?: string;
};

export function ImageWithFallback(props: ImageWithFallbackProps) {
  const [didError, setDidError] = useState(false)
  const [isInView, setIsInView] = useState(!props.lazy)
  const placeholderRef = useRef<HTMLDivElement>(null)

  const handleError = () => {
    setDidError(true)
  }

  const { src, alt, style, className, lazy = false, lazyRootMargin = '0px', ...rest } = props

  useEffect(() => {
    if (!lazy || isInView) return

    const node = placeholderRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setIsInView(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsInView(true)
          observer.disconnect()
        }
      },
      {
        root: null,
        rootMargin: lazyRootMargin,
        threshold: 0.01,
      },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [isInView, lazy, lazyRootMargin])

  useEffect(() => {
    setDidError(false)
    setIsInView(!lazy)
  }, [lazy, src])

  if (lazy && !isInView) {
    return (
      <div
        ref={placeholderRef}
        className={`inline-block ${className ?? ''}`}
        style={style}
        aria-label={typeof alt === 'string' ? alt : undefined}
        data-lazy-image-placeholder="true"
        data-original-url={src}
      />
    )
  }

  return didError ? (
    <div
      className={`inline-block text-center align-middle ${className ?? ''}`}
      style={style}
      aria-label="Image failed to load"
      data-original-url={src}
    />
  ) : (
    <img src={src} alt={alt} className={className} style={style} {...rest} onError={handleError} />
  )
}
