export function getBufferedRowImageIds(items, scrollLeft, viewportWidth, preloadWidth) {
  const start = Math.max(0, scrollLeft - preloadWidth);
  const end = scrollLeft + viewportWidth + preloadWidth;

  return items
    .filter((item) => item.right >= start && item.left <= end)
    .map((item) => item.id);
}

export function getVisibleRowImageIds(items, scrollLeft, viewportWidth) {
  const start = Math.max(0, scrollLeft);
  const end = scrollLeft + viewportWidth;

  return items
    .filter((item) => item.right > start && item.left < end)
    .map((item) => item.id);
}

export function areBufferedImagesSettled(bufferedIds, preloadedIds, settledIds) {
  return bufferedIds.every((id) => preloadedIds.has(id) && settledIds.has(id));
}

export function getUnloadedBufferedImageIds(bufferedIds, mountedIds) {
  return bufferedIds.filter((id) => !mountedIds.has(id));
}

export function getPendingVisibleImageIds(visibleIds, settledIds) {
  return visibleIds.filter((id) => !settledIds.has(id));
}

export function getRowScrollState({ scrollLeft, scrollWidth, clientWidth }) {
  return {
    canScrollLeft: scrollLeft > 4,
    canScrollRight: scrollLeft < scrollWidth - clientWidth - 4,
  };
}
