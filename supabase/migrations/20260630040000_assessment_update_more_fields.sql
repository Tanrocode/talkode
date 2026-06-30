-- Extends the assessment edit grant from 20260630030000 to scheduling and
-- technology fields. Still column-scoped: status, candidate_access_code,
-- completion stats, and ownership fields remain write-protected from the
-- client. The existing "Recruiters can update organization assessments"
-- row policy already covers these columns since RLS policies are row-level,
-- not column-level — only the grant needs extending.
grant update (
  time_limit_minutes,
  due_at,
  technologies
) on public.assessments to authenticated;
