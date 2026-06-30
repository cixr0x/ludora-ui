export function containedImageSize(naturalWidth, naturalHeight, boxSize) {
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  const box = Number(boxSize);

  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(box)) return undefined;
  if (width <= 0 || height <= 0 || box <= 0) return undefined;

  const scale = Math.min(box / width, box / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}
