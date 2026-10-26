-- Run ONCE after beacon_feud.sql. Adds "next question" with scores kept across rounds.
create or replace function public.feud_next_round(p_game uuid, p_question text, p_answers jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_host() then return jsonb_build_object('error','not_host'); end if;
 update public.feud_games set question=left(p_question,200),answer_count=jsonb_array_length(p_answers),board='[]',strikes=0,status='closed',buzzed_team=null,buzzed_by=null where id=p_game;
 insert into public.feud_secret values(p_game,p_answers) on conflict(game_id) do update set answers=excluded.answers;
 return jsonb_build_object('ok',true);
end$$;
revoke all on function public.feud_next_round(uuid,text,jsonb) from public;
grant execute on function public.feud_next_round(uuid,text,jsonb) to authenticated;
