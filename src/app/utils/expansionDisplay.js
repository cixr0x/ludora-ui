export function isExpansionItem(item) {
  return item?.is_expansion === true || item?.is_expansion === "true" || item?.item_type === "expansion";
}

export function positiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : undefined;
}

export function parentGamePath(parentItemId) {
  const id = positiveInteger(parentItemId);
  return id ? `/game/${id}` : undefined;
}
