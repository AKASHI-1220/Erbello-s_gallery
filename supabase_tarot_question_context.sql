alter table public.tarot_submissions
  add column if not exists question_context jsonb not null default '{}'::jsonb;

create index if not exists tarot_submissions_question_context_type_idx
  on public.tarot_submissions ((question_context->>'readingType'));
