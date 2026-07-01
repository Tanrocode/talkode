-- Grant recruiters permission to insert generated (non-active) codebase templates and files.
-- Previously only SELECT was granted; INSERT of generated codebases silently fell back to the
-- shared template because Supabase returned an RLS error that was caught and swallowed.

grant insert on public.assessment_codebase_templates to authenticated;
grant insert on public.assessment_codebase_files to authenticated;

-- Recruiters may insert new templates only when is_active = false (generated, not shared)
drop policy if exists "Recruiters can insert generated codebase templates" on public.assessment_codebase_templates;
create policy "Recruiters can insert generated codebase templates"
on public.assessment_codebase_templates
for insert
to authenticated
with check (
  not is_active
  and exists (
    select 1
    from public.recruiter_profiles
    where recruiter_profiles.id = auth.uid()
      and recruiter_profiles.status = 'active'
  )
);

-- Recruiters may insert files only into non-active (generated) templates
drop policy if exists "Recruiters can insert files for generated templates" on public.assessment_codebase_files;
create policy "Recruiters can insert files for generated templates"
on public.assessment_codebase_files
for insert
to authenticated
with check (
  exists (
    select 1
    from public.assessment_codebase_templates t
    join public.recruiter_profiles rp
      on rp.id = auth.uid()
     and rp.status = 'active'
    where t.id = codebase_template_id
      and not t.is_active
  )
);

-- Extend the files SELECT policy to also allow reading files from generated templates
-- that belong to an assessment in the recruiter's organization.
-- The old policy only covered is_active = true templates, so generated codebase files
-- were invisible to the assessment detail page.
drop policy if exists "Recruiters can read active codebase files" on public.assessment_codebase_files;
create policy "Recruiters can read codebase files"
on public.assessment_codebase_files
for select
to authenticated
using (
  exists (
    select 1
    from public.recruiter_profiles rp
    where rp.id = auth.uid()
      and rp.status = 'active'
  )
  and (
    -- Shared, active templates (original policy)
    exists (
      select 1
      from public.assessment_codebase_templates t
      where t.id = assessment_codebase_files.codebase_template_id
        and t.is_active
    )
    or
    -- Generated templates linked to an assessment in this recruiter's org
    exists (
      select 1
      from public.assessments a
      join public.recruiter_profiles rp
        on rp.id = auth.uid()
       and rp.organization_id = a.organization_id
      where a.codebase_template_id = assessment_codebase_files.codebase_template_id
    )
  )
);
