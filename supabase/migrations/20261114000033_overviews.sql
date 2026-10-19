-- Audio and video overviews in Smart Study (ADR-050): two more artifact kinds. The script / narrated slides are
-- stored like any artifact; the student's browser reads them aloud (Web Speech API), so no audio file is stored.
alter table public.generated_artifacts drop constraint generated_artifacts_kind_check;
alter table public.generated_artifacts add constraint generated_artifacts_kind_check
  check (kind in ('summary', 'flashcards', 'mind_map', 'quiz', 'audio_overview', 'video_overview'));
