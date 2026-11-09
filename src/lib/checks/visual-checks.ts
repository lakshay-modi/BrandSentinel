// Image checks: decide brand colour, contrast and alt-text problems from the browser's image analysis.
import type { BrandSettings, Finding, Location, PostInput, Rule } from "../types";
import { colourDistance, contrastRatio, round1 } from "../color";

const MIN_SHARE = 0.15; // a colour counts as a "main colour" if it covers at least 15% of the image

export function runVisualChecks(input: PostInput, rules: Map<string, Rule>, brand: BrandSettings): Finding[] {
  const out: Finding[] = [];
  // only rules set up with a fast check: a rule imported from a PDF can get the same ID but mean something else
  const fast = (id: string) => {
    const r = rules.get(id);
    return r && r.check_type.includes("code") ? r : undefined;
  };
  const vis = fast("VIS-01");
  const contrast = fast("READ-01");
  const alt = fast("READ-02");
  const palette = brand.palette ?? [];
  const base = (rule: Rule, location: Location) => ({
    id: "",
    rule_id: rule.id,
    category: rule.category,
    severity: rule.severity,
    location,
    evidence: rule.rule,
    fact_ids: [] as string[],
    source: "code" as const,
  });

  input.images.forEach((img, i) => {
    const location: Location = `image ${i + 1}`;
    const a = img.analysis;

    if (alt?.status === "approved" && !img.alt_text.trim()) {
      out.push({
        ...base(alt, location),
        quotes: [],
        message: `Image ${i + 1} has no alt text, so people using screen readers can't tell what it shows.`,
        fix: { kind: "manual", advice: "Add a one-sentence description of the image." },
      });
    }
    if (!a) return;

    if (contrast?.status === "approved") {
      const min = Number(contrast.params.min_ratio ?? 4.5);
      const minLarge = Number(contrast.params.min_ratio_large ?? 3);
      const bad = a.lines.filter((l) => l.contrast < (l.large ? minLarge : min)).sort((x, y) => x.contrast - y.contrast);
      if (bad.length) {
        const worst = bad[0];
        const need = worst.large ? minLarge : min;
        const best = palette
          .map((p) => ({ p, ratio: contrastRatio(p.hex, worst.bg) }))
          .sort((x, y) => y.ratio - x.ratio)[0];
        out.push({
          ...base(contrast, location),
          quotes: bad.map((l) => l.text),
          message: `Text “${worst.text}” is hard to read: contrast ${round1(worst.contrast)}:1 (${worst.fg} on ${worst.bg}). It needs at least ${need}:1${worst.large ? " for large text" : ""}.`,
          fix: {
            kind: "manual",
            advice: best
              ? `Change the text colour to ${best.p.name} ${best.p.hex} (${round1(best.ratio)}:1 on this background).`
              : "Use a darker text colour or a lighter background.",
          },
        });
      }
    }

    if (vis?.status === "approved") {
      const tol = brand.palette_tolerance ?? 40;
      const off = a.dominant
        .filter((d) => d.share >= MIN_SHARE)
        .map((d) => {
          const near = palette.map((p) => ({ p, dist: colourDistance(p.hex, d.hex) })).sort((x, y) => x.dist - y.dist)[0];
          return { d, near };
        })
        .filter((x) => x.near && x.near.dist > tol);
      for (const { d, near } of off) {
        out.push({
          ...base(vis, location),
          quotes: [d.hex],
          message: `Main colour ${d.hex} (${Math.round(d.share * 100)}% of the image) isn't a brand colour. Nearest brand colour: ${near.p.name} ${near.p.hex}.`,
          fix: { kind: "manual", advice: `Use brand colours only, for example ${near.p.name} ${near.p.hex}.` },
        });
      }
    }
  });
  return out;
}
