export function getBufferedRowImageIds(items, scrollLeft, viewportWidth, preloadWidth) {
  const start = Math.max(0, scrollLeft - preloadWidth);
  const end = scrollLeft + viewportWidth + preloadWidth;

  return items
    .filter((item) => item.right >= start && item.left <= end)
    .map((item) => item.id);
}

export function areBufferedImagesSettled(bufferedIds, preloadedIds, settledIds) {
  return bufferedIds.every((id) => preloadedIds.has(id) && settledIds.has(id));
}

export function getUnloadedBufferedImageIds(bufferedIds, mountedIds) {
  return bufferedIds.filter((id) => !mountedIds.has(id));
}
