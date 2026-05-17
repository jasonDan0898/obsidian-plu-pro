import type { ChangeRef } from '../types';

const WIKILINK = /\[\[([^\]]+)\]\]/;
const NON_CHANGE_DOC = new Set(['proposal', 'design', 'tasks', 'spec', 'README']);
// HIC change slugs are kebab-case ASCII (letters, digits, hyphens). Non-ASCII
// slugs that violate this convention (e.g. zh-CN folder names) are filtered out
// and cannot be referenced via related:; this is by design per HIC vault rules.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function extractSlug(raw: string): string | null {
  const trimmed = raw.trim().replace(/^"|"$/g, '');
  const wikilinkMatch = trimmed.match(WIKILINK);
  const inner = wikilinkMatch ? wikilinkMatch[1] : trimmed;
  const segments = inner.split('/').filter((s) => s && s !== '..' && s !== '.');
  if (segments.length === 0) {
    return null;
  }
  const last = segments[segments.length - 1];

  if (NON_CHANGE_DOC.has(last) && segments.length >= 2) {
    return segments[segments.length - 2];
  }
  if (NON_CHANGE_DOC.has(last)) {
    return null;
  }
  if (!SLUG_RE.test(last)) {
    return null;
  }
  return last;
}

export function parseChangeRefs(
  related: string[] | undefined,
  knownSlugs: Set<string>,
): ChangeRef[] {
  if (!related || related.length === 0) {
    return [];
  }
  const seen = new Set<string>();
  const refs: ChangeRef[] = [];
  for (const raw of related) {
    const slug = extractSlug(raw);
    if (!slug) {
      continue;
    }
    if (seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    refs.push({
      targetSlug: slug,
      raw,
      resolved: knownSlugs.has(slug),
    });
  }
  return refs;
}
