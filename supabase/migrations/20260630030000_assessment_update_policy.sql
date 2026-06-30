-- Lets recruiters edit an assessment after creation (title, job description,
-- rubric). Column-level grant restricts this to the fields a hiring manager
-- should control directly — status, candidate_access_code, completion stats,
-- and ownership fields stay write-protected from the client.
grant update (
  title,
  job_description,
  rubric_text,
  rubric_topics
) on public.assessments to authenticated;

drop policy if exists "Recruiters can update organization assessments" on public.assessments;
create policy "Recruiters can update organization assessments"
on public.assessments
for update
to authenticated
using (
  exists (
    select 1
    from public.recruiter_profiles
    where recruiter_profiles.id = auth.uid()
      and recruiter_profiles.organization_id = assessments.organization_id
      and recruiter_profiles.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.recruiter_profiles
    where recruiter_profiles.id = auth.uid()
      and recruiter_profiles.organization_id = assessments.organization_id
      and recruiter_profiles.status = 'active'
  )
);
