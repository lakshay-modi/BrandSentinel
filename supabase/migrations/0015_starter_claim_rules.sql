-- Two more starter rules for brands that started from the starter rulebook: health or medical claims, and
-- numbers with no approved fact. A real Slack test showed a fresh workspace passing "clinically proven to boost
-- your energy" at 100/100. New brands get these from src/lib/starter-rules.ts; this adds them to existing ones.
insert into public.rules (brand_id, id, category, severity, check_type, scope, rule, guideline, good, bad, params, status, version, source, document_id)
select d.brand_id, r.id, 'claims', 'high', 'code+ai', 'all (caption and image text)', r.rule, r.guideline, r.good, r.bad, r.params, 'approved', 1, 'BrandSentinel starter rules', d.id
from public.guideline_docs d
cross join (values
  ('CLAIM-02', 'Every number must match an approved fact.',
   'Amounts, prices, percentages and counts need proof. Add each number to the Fact Bank with its source before using it in a post.',
   'A number copied exactly from the Fact Bank.', 'A protein, price or discount figure that isn''t in the Fact Bank.', '{}'::jsonb),
  ('CLAIM-04', 'No health or medical claims without approved proof.',
   'Saying a product treats, cures, prevents or improves a health condition, or that it is clinically or scientifically proven, needs proof the brand can show. Describe the product instead.',
   'Made with whole oats and nuts.', 'Clinically proven to boost your energy and immunity.',
   '{"phrases":["clinically proven","clinically tested","scientifically proven","medically proven","doctor recommended","doctor-recommended","cures","cure","heals","prevents","lose weight","weight loss","burn fat","burns fat","fat burning","boost immunity","boosts immunity","immunity booster","detox","detoxify","boost your energy","boosts energy","boost energy","lowers cholesterol","diabetic","miracle","guaranteed results"]}'::jsonb)
) as r(id, rule, guideline, good, bad, params)
where d.name = 'Starter rules' and d.kind = 'seed'
on conflict (brand_id, id) do nothing;
