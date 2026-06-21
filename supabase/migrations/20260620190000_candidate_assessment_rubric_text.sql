drop function if exists public.register_candidate_for_assessment(text, text);

create function public.register_candidate_for_assessment(
  p_access_code text,
  p_full_name text
)
returns table (
  candidate_id uuid,
  assessment_id uuid,
  assessment_title text,
  candidate_name text,
  time_limit_minutes integer,
  expires_at timestamptz,
  technologies public.assessment_technology[],
  code_files jsonb,
  rubric_text text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_assessment public.assessments%rowtype;
  normalized_code text;
  normalized_name text;
begin
  normalized_code := upper(
    regexp_replace(trim(coalesce(p_access_code, '')), '[[:space:]]+', '', 'g')
  );
  normalized_name := trim(coalesce(p_full_name, ''));

  if char_length(normalized_code) < 4 then
    raise exception 'Enter a valid assessment code.';
  end if;

  if char_length(normalized_name) < 2 then
    raise exception 'Enter your full name.';
  end if;

  select *
  into matched_assessment
  from public.assessments
  where upper(candidate_access_code) = normalized_code
    and (
      due_at is null
      or due_at >= now()
    )
  limit 1;

  if matched_assessment.id is null then
    raise exception 'That assessment code is invalid or expired.';
  end if;

  insert into public.candidates (
    organization_id,
    assessment_id,
    full_name,
    role_name,
    stage,
    risk,
    last_activity_at
  )
  values (
    matched_assessment.organization_id,
    matched_assessment.id,
    normalized_name,
    matched_assessment.role_name,
    'assessment',
    'low',
    now()
  )
  returning id into candidate_id;

  assessment_id := matched_assessment.id;
  assessment_title := matched_assessment.title;
  candidate_name := normalized_name;
  time_limit_minutes := matched_assessment.time_limit_minutes;
  expires_at := matched_assessment.due_at;
  technologies := matched_assessment.technologies;
  rubric_text := coalesce(matched_assessment.rubric_text, '');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'path', assessment_codebase_files.path,
        'language', assessment_codebase_files.language,
        'content', assessment_codebase_files.content,
        'lineCount', array_length(string_to_array(assessment_codebase_files.content, E'\n'), 1)
      )
      order by assessment_codebase_files.sort_order asc
    ),
    '[]'::jsonb
  )
  into code_files
  from public.assessment_codebase_files
  where assessment_codebase_files.codebase_template_id = matched_assessment.codebase_template_id;

  return next;
end;
$$;

revoke all on function public.register_candidate_for_assessment(text, text) from public;
grant execute on function public.register_candidate_for_assessment(text, text) to anon, authenticated;
