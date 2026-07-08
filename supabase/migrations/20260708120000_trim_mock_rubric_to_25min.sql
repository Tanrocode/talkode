-- Trim the mock interview rubric from 9 questions (~40 min) to 4 questions (~25 min).
-- Scoring dimensions reduced from 6 to 4 to avoid "not reached in session" penalties.
-- With force_advance at 3 attempts and ~90s per turn:
--   4 questions × 3 attempts × 1.5 min = ~18 min codebase + 5 min challenge + 3 min intro ≈ 26 min

update public.assessment_rubric_templates
set
  content = $rubric$# Employee Directory Dashboard Rubric

Score candidates across four dimensions:

- Code Navigation & Architecture
- Debugging
- Performance Reasoning
- React Knowledge

## Interview Flow

1. Architecture: ask what happens from page load until employee cards appear on screen — trace the full data flow.
2. Bug Investigation: ask why searching for `john` might miss "John Smith" — what does the search logic actually check?
3. Performance: ask what would need to change if the directory had 50,000 employees instead of 50.
4. React Knowledge: ask why using `Math.random()` as a list key is a problem and what they'd use instead.

## Expected Signals

- Traces data flow through `fetchEmployees`, state updates, filtering, and rendering.
- Notices case sensitivity in the search comparison.
- Spots O(n²) coworker counting, missing memoization, and repeated filtering passes.
- Identifies unstable React keys and the re-render cascade they cause.
$rubric$,
  updated_at = now()
from public.assessment_codebase_templates
where
  assessment_rubric_templates.codebase_template_id = assessment_codebase_templates.id
  and assessment_codebase_templates.slug = 'employee-directory-dashboard'
  and assessment_rubric_templates.is_mock = true;
