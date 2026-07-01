-- Adds three columns to track per-assessment codebase generation.
--
-- hm_spec        Raw text the hiring manager typed into the "Codebase specification"
--                field. Preserved so we can re-generate or show them what they asked for.
-- codebase_source Distinguishes assessments that use the shared template from those
--                whose codebase was generated for them specifically.
-- codebase_spec  The reconciled brief produced by the generation pipeline (merged JD
--                signals + explicit HM constraints). Stored as JSONB so the detail page
--                can surface the domain, seam list, and any conflict warnings without
--                re-running LLM calls.

alter table public.assessments
  add column if not exists hm_spec text,
  add column if not exists codebase_source text not null default 'template'
    check (codebase_source in ('template', 'generated', 'generating')),
  add column if not exists codebase_spec jsonb;
