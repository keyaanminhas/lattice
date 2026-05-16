import type { LatticeRole } from "@/lib/auth/roles";
import { ROLES } from "@/lib/auth/roles";

export interface ClassificationResult {
  suggestedRole: LatticeRole;
  confidence: number;
  signals: { label: string; weight: number }[];
}

/**
 * Client-side semantic routing for progressive profiling at signup.
 * Production: replace with rbacApi embedding endpoint or Gemini classify action.
 */
export function classifySignupBio(bio: string, intent?: string): ClassificationResult {
  const text = `${bio} ${intent || ""}`.toLowerCase();
  const signals: { label: string; weight: number }[] = [];

  const rules: { role: LatticeRole; terms: string[]; weight: number }[] = [
    { role: ROLES.STARTUP, terms: ["startup", "founder", "mvp", "product", "raise", "seed"], weight: 1 },
    { role: ROLES.MENTOR, terms: ["mentor", "advise", "coach", "experience", "office hours"], weight: 1 },
    { role: ROLES.INVESTOR, terms: ["investor", "vc", "capital", "ticket", "portfolio"], weight: 1 },
    { role: ROLES.PARTNER, terms: ["partner", "corporate", "pilot", "distribution"], weight: 1 },
    { role: ROLES.SERVICE_PROVIDER, terms: ["legal", "accounting", "consulting", "service provider"], weight: 1 },
    { role: ROLES.ORG_ADMIN, terms: ["accelerator", "incubator", "organisation", "programme director"], weight: 0.8 },
  ];

  const scores = new Map<LatticeRole, number>();
  for (const rule of rules) {
    let hit = 0;
    for (const term of rule.terms) {
      if (text.includes(term)) hit += 1;
    }
    if (hit > 0) {
      const w = hit * rule.weight;
      scores.set(rule.role, (scores.get(rule.role) || 0) + w);
      signals.push({ label: `${rule.role} keywords (${hit})`, weight: w });
    }
  }

  const sorted = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0] || [ROLES.STARTUP, 0.3];
  const confidence = Math.min(0.95, 0.35 + top[1] * 0.12);

  return {
    suggestedRole: top[0],
    confidence,
    signals: signals.sort((a, b) => b.weight - a.weight).slice(0, 5),
  };
}
