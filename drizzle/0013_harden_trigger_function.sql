-- Harden the version-bump trigger function (Supabase advisor: function_search_path_mutable).
-- It only runs as a trigger, so nobody needs to call it; pin its search_path so it can never be
-- tricked into using a look-alike object, and take away the right to execute it from the API roles.
ALTER FUNCTION public.questions_bump_version() SET search_path = '';--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.questions_bump_version() FROM PUBLIC, anon, authenticated;
