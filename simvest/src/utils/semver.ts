/** Compare semver strings (major.minor.patch). Returns negative if a < b, 0 if equal, positive if a > b. */
export function compareSemver(a: string, b: string): number {
  const pa = a.split(/[.+]/).map((s) => parseInt(s, 10) || 0);
  const pb = b.split(/[.+]/).map((s) => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export function isVersionBelow(current: string, minimum: string): boolean {
  return compareSemver(current.trim(), minimum.trim()) < 0;
}
