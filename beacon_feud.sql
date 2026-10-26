-- Beacon Family Feud: run ONCE in Supabase > SQL Editor. Only adds new things; nothing existing is changed.
create table if not exists public.feud_games(
 id uuid primary key default gen_random_uuid(), question text not null default '', answer_count int not null default 0,
 board jsonb not null default '[]', strikes int not null default 0, status text not null default 'closed',
 buzzed_team text, buzzed_by text, red_code text not null unique, blue_code text not null unique,
 red_score int not null default 0, blue_score int not null default 0, active boolean not null default true,
 created_at timestamptz not null default now());
create table if not exists public.feud_secret(game_id uuid primary key references public.feud_games on delete cascade, answers jsonb not null);
create table if not exists public.feud_players(id uuid primary key default gen_random_uuid(), game_id uuid not null references public.feud_games on delete cascade,
 user_id uuid not null, team text not null, nickname text not null, emoji text not null, unique(game_id,user_id));
alter table public.feud_games enable row level security;
alter table public.feud_secret enable row level security;
alter table public.feud_players enable row level security;
drop policy if exists feud_games_read on public.feud_games; create policy feud_games_read on public.feud_games for select to authenticated using (true);
drop policy if exists feud_players_read on public.feud_players; create policy feud_players_read on public.feud_players for select to authenticated using (true);
drop policy if exists feud_secret_host on public.feud_secret; create policy feud_secret_host on public.feud_secret for select to authenticated using (public.is_host());
alter publication supabase_realtime add table public.feud_games;

create or replace function public.feud_create(p_question text, p_answers jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.feud_games; r text; b text;
begin
 if not public.is_host() then return jsonb_build_object('error','not_host'); end if;
 update public.feud_games set active=false where active;
 loop
  r:=lpad((floor(random()*900000)+100000)::int::text,6,'0'); b:=lpad((floor(random()*900000)+100000)::int::text,6,'0');
  exit when r<>b and not exists(select 1 from public.feud_games where red_code in(r,b) or blue_code in(r,b));
 end loop;
 insert into public.feud_games(question,answer_count,red_code,blue_code) values(left(p_question,200),jsonb_array_length(p_answers),r,b) returning * into g;
 insert into public.feud_secret values(g.id,p_answers);
 return to_jsonb(g);
end$$;

create or replace function public.feud_status(p_game uuid, p_status text) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_host() or p_status not in('open','closed') then return jsonb_build_object('ok',false); end if;
 update public.feud_games set status=p_status, buzzed_team=null, buzzed_by=null where id=p_game;
 return jsonb_build_object('ok',true);
end$$;

create or replace function public.feud_strike(p_game uuid) returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if not public.is_host() then return jsonb_build_object('ok',false); end if;
 update public.feud_games set strikes=strikes+1 where id=p_game;
 return jsonb_build_object('ok',true);
end$$;

create or replace function public.feud_reveal(p_game uuid, p_index int, p_team text) returns jsonb language plpgsql security definer set search_path=public as $$
declare a jsonb; pts int;
begin
 if not public.is_host() then return jsonb_build_object('ok',false); end if;
 select answers->p_index into a from public.feud_secret where game_id=p_game;
 if a is null or exists(select 1 from public.feud_games where id=p_game and board @> jsonb_build_array(jsonb_build_object('i',p_index))) then return jsonb_build_object('ok',false); end if;
 pts:=coalesce((a->>'points')::int,0);
 update public.feud_games set board=board||jsonb_build_array(jsonb_build_object('i',p_index,'text',a->>'text','points',pts)),
  red_score=red_score+case when p_team='red' then pts else 0 end, blue_score=blue_score+case when p_team='blue' then pts else 0 end where id=p_game;
 return jsonb_build_object('ok',true);
end$$;

create or replace function public.feud_join(p_code text, p_nick text, p_emoji text) returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.feud_games; t text; n text:=trim(coalesce(p_nick,''));
begin
 if auth.uid() is null then return jsonb_build_object('ok',false,'error','net'); end if;
 if length(n) not between 2 and 20 then return jsonb_build_object('ok',false,'error','bad_nickname'); end if;
 if coalesce(length(p_emoji),0) not between 1 and 8 then return jsonb_build_object('ok',false,'error','bad_emoji'); end if;
 select * into g from public.feud_games where active and (red_code=trim(p_code) or blue_code=trim(p_code));
 if not found then return jsonb_build_object('ok',false,'error','invalid_code'); end if;
 t:=case when g.red_code=trim(p_code) then 'red' else 'blue' end;
 insert into public.feud_players(game_id,user_id,team,nickname,emoji) values(g.id,auth.uid(),t,n,p_emoji)
  on conflict(game_id,user_id) do update set team=excluded.team,nickname=excluded.nickname,emoji=excluded.emoji;
 return jsonb_build_object('ok',true,'game_id',g.id,'team',t,'nickname',n,'emoji',p_emoji);
end$$;

create or replace function public.feud_buzz(p_game uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare pl public.feud_players;
begin
 select * into pl from public.feud_players where game_id=p_game and user_id=auth.uid();
 if not found then return jsonb_build_object('ok',false,'error','not_player'); end if;
 update public.feud_games set status='buzzed', buzzed_team=pl.team, buzzed_by=pl.emoji||' '||pl.nickname where id=p_game and status='open';
 if not found then return jsonb_build_object('ok',false,'error','too_late'); end if;
 return jsonb_build_object('ok',true);
end$$;

revoke all on function public.feud_create(text,jsonb),public.feud_status(uuid,text),public.feud_strike(uuid),public.feud_reveal(uuid,int,text),public.feud_join(text,text,text),public.feud_buzz(uuid) from public;
grant execute on function public.feud_create(text,jsonb),public.feud_status(uuid,text),public.feud_strike(uuid),public.feud_reveal(uuid,int,text),public.feud_join(text,text,text),public.feud_buzz(uuid) to authenticated;
