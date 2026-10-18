-- Founder (2026-10-18): multiple-correct MCQs are marked like JEE Advanced instead of "exact set or nothing"
-- (ADR-023). Only right options picked: all of them = full marks, otherwise marks / 4 per right option picked
-- (= +1 each for a 4-mark question); any wrong option picked = −negative; blank = 0. Single and numerical unchanged.
-- Tests already released keep their stored marks until a teacher recalculates them.
create or replace function private.grade_objective(qtype text, key jsonb, response jsonb, marks numeric, negative numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when qtype = 'written' then null
    when response is null or response in ('null'::jsonb, '[]'::jsonb) then 0
    when qtype = 'single' then
      case when (select array_agg(distinct x order by x) from jsonb_array_elements_text(response) x)
              = (select array_agg(distinct x order by x) from jsonb_array_elements_text(key -> 'correct') x)
           then marks else -negative end
    when qtype = 'multi' then
      case when jsonb_typeof(response) <> 'array' or not (response <@ (key -> 'correct')) then -negative
           when (key -> 'correct') <@ response then marks
           else (select count(distinct x) from jsonb_array_elements_text(response) x) * marks / 4 end
    when qtype = 'numerical' and jsonb_typeof(response) = 'number' then
      case when abs((response #>> '{}')::numeric - (key ->> 'value')::numeric)
                <= coalesce((key ->> 'tolerance_abs')::numeric,
                            abs((key ->> 'value')::numeric) * (key ->> 'tolerance_pct')::numeric / 100, 0)
           then marks else -negative end
    else -negative
  end
$$;
