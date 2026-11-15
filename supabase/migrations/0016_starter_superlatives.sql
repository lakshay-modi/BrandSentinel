-- The starter ranking rule also catches common superlatives ("the safest", "fastest", "unbreakable"), and the AI
-- reads it too, so a ranking in other words is caught. Updates brands that started from the starter rules and
-- haven't edited this rule (version 1).
update public.rules
set check_type = 'code+ai',
    guideline = 'Claims like “No. 1”, “the best” or “the safest” need proof. Add the proof to the Fact Bank first, or describe the product instead.',
    params = '{"patterns":["\\bno\\.?\\s?1\\b","#1\\b","\\bnumber one\\b","\\bthe best\\b","\\bbest\\s+in\\b","\\bindia''?s favou?rite\\b","\\bworld''?s (?:best|first|leading)\\b","\\bmarket leader\\b","\\bunbeatable\\b","\\b(?:the\\s+)?(?:safest|fastest|cheapest|strongest|healthiest|smartest|toughest|greatest|lightest)\\b","\\bunbreakable\\b","\\bindestructible\\b"]}'::jsonb
where id = 'CLAIM-01' and source = 'BrandSentinel starter rules' and version = 1;
