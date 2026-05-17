import type {
  AssignmentCandidate,
  ChangeEntry,
  ProjectEntry,
  ProjectSlug,
} from '../types';

const SCORE_CAPABILITY = 5;
const SCORE_RELATED = 3;
const SCORE_SLUG_TOKEN = 1;
const MAX_CANDIDATES = 3;

export function suggestProjects(
  target: ChangeEntry,
  projects: ProjectEntry[],
): AssignmentCandidate[] {
  const candidates: AssignmentCandidate[] = [];

  for (const project of projects) {
    let score = 0;
    const reasons: string[] = [];

    const capability = typeof target.frontmatter.capability === 'string'
      ? target.frontmatter.capability
      : undefined;
    if (capability && project.manifest.scope?.includes(capability)) {
      score += SCORE_CAPABILITY;
      reasons.push(`capability ${capability} ∈ project.scope`);
    }

    const insideSlugs = new Set(project.changes.map((c) => c.slug));
    const relatedHit = target.blockers.find((b) => insideSlugs.has(b.targetSlug));
    if (relatedHit) {
      score += SCORE_RELATED;
      reasons.push(`related → ${relatedHit.targetSlug}(已在该项目内)`);
    }

    if (target.slug.includes(project.manifest.slug)) {
      score += SCORE_SLUG_TOKEN;
      reasons.push(`change slug 含 project slug "${project.manifest.slug}"`);
    }

    if (score > 0) {
      candidates.push({ projectSlug: project.manifest.slug, score, reasons });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, MAX_CANDIDATES);
}

export function uniqueProjectSlugs(candidates: AssignmentCandidate[]): ProjectSlug[] {
  return Array.from(new Set(candidates.map((c) => c.projectSlug)));
}
