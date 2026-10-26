-- BEACON SECURITY LOCKDOWN. Run ONCE, after beacon_feud.sql and beacon_feud_update.sql.
-- Safe to re-run. Replaces the earlier emoji setup.

-- 1. Team codes become host-only (players can no longer read them)
create table if not exists public.feud_codes(game_id uuid primary key references public.feud_games on delete cascade, red_code text not null unique, blue_code text not null unique);
alter table public.feud_codes enable row level security;
drop policy if exists feud_codes_host on public.feud_codes;
create policy feud_codes_host on public.feud_codes for select to authenticated using (public.is_host());
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='feud_games' and column_name='red_code') then
  insert into public.feud_codes select id,red_code,blue_code from public.feud_games on conflict do nothing;
  alter table public.feud_games drop column red_code, drop column blue_code;
 end if; end $$;
create unique index if not exists feud_players_name on public.feud_players(game_id, lower(nickname));

create or replace function public.feud_create(p_question text, p_answers jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.feud_games; r text; b text;
begin
 if not public.is_host() then return jsonb_build_object('error','not_host'); end if;
 if jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers) not between 2 and 10 then return jsonb_build_object('error','bad_answers'); end if;
 update public.feud_games set active=false where active;
 loop
  r:=lpad((floor(random()*900000)+100000)::int::text,6,'0'); b:=lpad((floor(random()*900000)+100000)::int::text,6,'0');
  exit when r<>b and not exists(select 1 from public.feud_codes where red_code in(r,b) or blue_code in(r,b));
 end loop;
 insert into public.feud_games(question,answer_count) values(left(p_question,200),jsonb_array_length(p_answers)) returning * into g;
 insert into public.feud_codes values(g.id,r,b);
 insert into public.feud_secret values(g.id,p_answers);
 return to_jsonb(g);
end$$;

create or replace function public.feud_get_codes(p_game uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.feud_codes;
begin
 if not public.is_host() then return jsonb_build_object('error','not_host'); end if;
 select * into c from public.feud_codes where game_id=p_game;
 return jsonb_build_object('red',c.red_code,'blue',c.blue_code);
end$$;

create or replace function public.feud_join(p_code text, p_nick text, p_emoji text) returns jsonb language plpgsql security definer set search_path=public as $$
declare gid uuid; t text; ex text; n text:=trim(coalesce(p_nick,'')); c text:=trim(coalesce(p_code,''));
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'error','net'); end if;
 if length(n) not between 2 and 20 or n ~ '[<>&"]' then return jsonb_build_object('ok',false,'error','bad_nickname'); end if;
 if coalesce(length(p_emoji),0) not between 1 and 8 or p_emoji ~ '[A-Za-z0-9<>&" '']' then return jsonb_build_object('ok',false,'error','bad_emoji'); end if;
 select k.game_id, case when k.red_code=c then 'red' else 'blue' end into gid,t
  from public.feud_codes k join public.feud_games g on g.id=k.game_id where g.active and (k.red_code=c or k.blue_code=c);
 if gid is null then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
 select team into ex from public.feud_players where game_id=gid and user_id=auth.uid();
 if ex is not null then
  t:=ex; update public.feud_players set nickname=n, emoji=p_emoji where game_id=gid and user_id=auth.uid();
 else
  insert into public.feud_players(game_id,user_id,team,nickname,emoji) values(gid,auth.uid(),t,n,p_emoji);
 end if;
 return jsonb_build_object('ok',true,'game_id',gid,'team',t,'nickname',n,'emoji',p_emoji);
exception when unique_violation then return jsonb_build_object('ok',false,'error','nickname_taken');
end$$;

-- 2. Emoji on the normal quiz: only the player who holds their own participant id can set it
drop function if exists public.set_emoji(uuid,text,text);
drop table if exists public.emoji_picks;
create table public.emoji_picks(participant_id uuid primary key, emoji text not null);
alter table public.emoji_picks enable row level security;  -- no policies: reachable only through the functions below
create or replace function public.set_emoji(p_participant uuid, p_emoji text) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or coalesce(length(p_emoji),0) not between 1 and 8 or p_emoji ~ '[A-Za-z0-9<>&" '']' then return; end if;
 if not exists(select 1 from public.participants where id=p_participant) then return; end if;
 insert into public.emoji_picks values(p_participant,p_emoji) on conflict(participant_id) do update set emoji=excluded.emoji;
end$$;
create or replace function public.get_emojis(p_session uuid) returns table(nickname text, emoji text) language sql security definer set search_path=public as $$
 select p.nickname, e.emoji from public.emoji_picks e join public.participants p on p.id=e.participant_id where p.session_id=p_session
$$;

revoke all on function public.feud_create(text,jsonb),public.feud_get_codes(uuid),public.feud_join(text,text,text),public.set_emoji(uuid,text),public.get_emojis(uuid) from public;
grant execute on function public.feud_create(text,jsonb),public.feud_get_codes(uuid),public.feud_join(text,text,text),public.set_emoji(uuid,text),public.get_emojis(uuid) to authenticated;
