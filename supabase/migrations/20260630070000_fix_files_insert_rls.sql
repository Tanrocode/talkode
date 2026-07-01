-- The files INSERT policy in 20260630060000 used a WITH CHECK subquery on
-- assessment_codebase_templates to verify the target template is not active.
-- That subquery is itself subject to RLS, and the templates SELECT policy only
-- covers is_active=true rows — so the subquery always returned empty and every
-- files insert was blocked with a 42501 violation.
--
-- Fix: drop the subquery check and rely on recruiter-status alone. The FK
-- (codebase_template_id → assessment_codebase_templates.id) ensures the
-- template must already exist, and crypto UUIDs make cross-recruiter collisions
-- practically impossible. The template INSERT policy already enforces that
-- recruiters can only create is_active=false templates.

drop policy if exists "Recruiters can insert files for generated templates" on public.assessment_codebase_files;

create policy "Recruiters can insert files for generated templates"
on public.assessment_codebase_files
for insert
to authenticated
with check (
  exists (
    select 1
    from public.recruiter_profiles
    where recruiter_profiles.id = auth.uid()
      and recruiter_profiles.status = 'active'
  )
);
