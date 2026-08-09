export function isBroadSitemapLastmodRefresh(
  existingEntries: number,
  changedEntries: number,
) {
  return existingEntries >= 10 && changedEntries / existingEntries >= 0.7;
}
