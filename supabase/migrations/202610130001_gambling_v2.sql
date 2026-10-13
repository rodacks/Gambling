-- GAMBLING V2.0. Apply once through Supabase migrations / SQL Editor.
-- All economic writes are server-only. auth.users belongs to Supabase Auth.
begin;
create table public.player_profiles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 username text not null check(username ~ '^[a-z0-9_]{3,20}$'),
 bio text not null default '' check(length(bio)<=150 and bio !~ '[<>]'),
 avatar text not null default 'spade' check(avatar in ('car-0','car-1','car-2','car-3','car-4','car-5','heart','club','diamond','spade','roulette-red','roulette-black','roulette-green')),
 original boolean not null default false,
 joined_at timestamptz not null default now()
);
create unique index player_username_unique on public.player_profiles(lower(username));
create table public.account_origins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 provider text not null check(provider in ('email','google','other')),
 created_at timestamptz not null default now()
);
create table public.player_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 preferences jsonb not null default '{"sound":true,"reducedMotion":false,"sensitivity":1}'::jsonb
);
create table public.game_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0,
 state jsonb not null,
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(state)='object'),
 check((state->>'balance')::numeric >= 0 and (state->>'balance')::numeric < 90000000000000),
 check((state->>'peak')::numeric >= (state->>'balance')::numeric)
);
create table public.reward_grants (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind='original'),
 amount numeric(18,2) not null check(amount=5000),
 granted_at timestamptz not null default now(),
 acknowledged_at timestamptz,
 primary key(user_id,kind)
);
create table public.game_operations (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 action jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
create table public.coin_transactions (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 amount numeric(18,2) not null,
 label text not null,
 created_at timestamptz not null default now(),
 primary key(user_id,id)
);
create index coin_transactions_history on public.coin_transactions(user_id,created_at desc);
create table public.daily_claims (
 user_id uuid not null references auth.users(id) on delete cascade,
 operation_id uuid not null,
 claimed_at timestamptz not null default now(),
 primary key(user_id,operation_id)
);
create index daily_claims_time on public.daily_claims(user_id,claimed_at desc);
create table public.game_sessions (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 game text not null check(game in ('blackjack','racing','roulette','jitter','precision','reaction')),
 prepared_at timestamptz not null default now(),
 started_at timestamptz,
 finished_at timestamptz
);
create index game_sessions_user on public.game_sessions(user_id,prepared_at desc);
create table public.official_results (
 session_id uuid primary key references public.game_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 game text not null,
 ruleset text not null,
 net numeric(18,2) not null,
 score numeric not null default 0,
 status text not null check(status in ('verified','flagged')),
 evidence jsonb not null default '{}'::jsonb,
 result jsonb not null,
 created_at timestamptz not null default now()
);
create index results_review on public.official_results(status,created_at desc);
create table public.personal_records (
 user_id uuid not null references auth.users(id) on delete cascade,
 game text not null,
 ruleset text not null,
 value numeric not null check(value>0),
 session_id uuid not null references public.game_sessions(id),
 achieved_at timestamptz not null default now(),
 primary key(user_id,game,ruleset)
);
create index personal_records_ranking on public.personal_records(game,ruleset,value desc,user_id);
create index accounts_balance on public.game_accounts(((state->>'balance')::numeric) desc);
create index accounts_peak on public.game_accounts(((state->>'peak')::numeric) desc);
create table public.request_limits (
 user_id uuid not null references auth.users(id) on delete cascade,
 scope text not null,
 bucket bigint not null,
 hits integer not null,
 primary key(user_id,scope,bucket)
);

create function public.gambling_initial_state(p_name text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('version',1,'name',p_name,'balance',5000,'peak',5000,'granted',5000,'earned',0,'lost',0,'xp',0,'lastBonus',null,'settings',jsonb_build_object('sound',true,'reducedMotion',false,'sensitivity',1),'stats',(select jsonb_object_agg(g,jsonb_build_object('played',0,'wins',0,'losses',0,'ties',0,'earned',0,'lost',0,'best',0,'bestNet',0,'medals','[]'::jsonb)) from unnest(array['blackjack','racing','roulette','jitter','reaction','precision']) g),'history','[]'::jsonb,'ledger','[]'::jsonb,'active',null);
$$;

create function public.gambling_original_grant(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare granted boolean; s jsonb; stamp bigint; movement jsonb;
begin
 if not exists(select 1 from public.account_origins o join auth.users u on u.id=o.user_id where o.user_id=p_user and o.provider='email' and u.email_confirmed_at is not null) then return; end if;
 -- Same row lock used by gameplay serializes verification rewards with bets.
 select state into s from public.game_accounts where user_id=p_user for update;
 if s is null then return; end if;
 insert into public.reward_grants(user_id,kind,amount) values(p_user,'original',5000) on conflict do nothing returning true into granted;
 if granted is not true then return; end if;
 update public.player_profiles set original=true where user_id=p_user;
 stamp=floor(extract(epoch from clock_timestamp())*1000);
 movement=jsonb_build_object('id','original-'||p_user,'at',stamp,'label','Recompensa cuenta original','amount',5000);
 s=jsonb_set(s,'{balance}',to_jsonb((s->>'balance')::numeric+5000));
 s=jsonb_set(s,'{peak}',to_jsonb(greatest((s->>'peak')::numeric,(s->>'balance')::numeric)));
 s=jsonb_set(s,'{granted}',to_jsonb((s->>'granted')::numeric+5000));
 s=jsonb_set(s,'{ledger}',jsonb_build_array(movement)||(s->'ledger'));
 update public.game_accounts set state=s,revision=revision+1,updated_at=now() where user_id=p_user;
 insert into public.coin_transactions(user_id,id,amount,label) values(p_user,'original-'||p_user,5000,'Recompensa cuenta original');
end $$;

create function public.gambling_initialize_user() returns trigger language plpgsql security definer set search_path='' as $$
declare provider text; uname text;
begin
 provider=coalesce(new.raw_app_meta_data->>'provider','other');
 if provider not in ('email','google') then provider='other'; end if;
 if provider='email' then
   uname=lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
   if uname !~ '^[a-z0-9_]{3,20}$' then raise exception 'Nombre de usuario inválido (3–20 letras, números o guion bajo).'; end if;
 else
   loop
     uname='player_'||substr(replace(gen_random_uuid()::text,'-',''),1,12);
     exit when not exists(select 1 from public.player_profiles where username=uname);
   end loop;
 end if;
 insert into public.account_origins(user_id,provider) values(new.id,provider);
 insert into public.player_profiles(user_id,username,avatar) values(new.id,uname,case when provider='google' then 'car-1' else 'spade' end);
 insert into public.player_preferences(user_id) values(new.id);
 insert into public.game_accounts(user_id,state) values(new.id,public.gambling_initial_state(uname));
 insert into public.coin_transactions(user_id,id,amount,label) values(new.id,'initial-'||new.id,5000,'Saldo inicial');
 perform public.gambling_original_grant(new.id);
 return new;
end $$;
create trigger gambling_auth_created after insert on auth.users for each row execute function public.gambling_initialize_user();
create function public.gambling_verified_user() returns trigger language plpgsql security definer set search_path='' as $$
begin perform public.gambling_original_grant(new.id);return new;end $$;
create trigger gambling_auth_verified after update of email_confirmed_at on auth.users for each row execute function public.gambling_verified_user();

create function public.gambling_rate_limit(p_user uuid,p_scope text,p_limit integer) returns boolean language plpgsql security definer set search_path='' as $$
declare used integer; window_id bigint;
begin
 window_id=floor(extract(epoch from clock_timestamp())/60);
 insert into public.request_limits(user_id,scope,bucket,hits) values(p_user,p_scope,window_id,1)
 on conflict(user_id,scope,bucket) do update set hits=public.request_limits.hits+1 returning hits into used;
 delete from public.request_limits where user_id=p_user and bucket<window_id-2;
 return used<=p_limit;
end $$;

create function public.gambling_commit(p_user uuid,p_operation uuid,p_revision bigint,p_action jsonb,p_state jsonb,p_result jsonb default null,p_status text default 'verified',p_evidence jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_state jsonb; rev bigint; prior jsonb; entry jsonb; record_value numeric; rules text; g text; round_id uuid;
begin
 select state,revision into current_state,rev from public.game_accounts where user_id=p_user for update;
 if not found then raise exception 'Cuenta no inicializada'; end if;
 select action into prior from public.game_operations where user_id=p_user and operation_id=p_operation;
 if found then
   if prior<>p_action then raise exception 'Identificador de operación reutilizado con otra acción'; end if;
   return jsonb_build_object('status','duplicate','state',current_state,'revision',rev);
 end if;
 if rev<>p_revision then return jsonb_build_object('status','conflict');end if;
 if (p_state->>'balance')::numeric<0 or (p_state->>'peak')::numeric<(current_state->>'peak')::numeric then raise exception 'Economía inválida';end if;
 insert into public.game_operations(user_id,operation_id,action) values(p_user,p_operation,p_action);
 if p_action->>'type'='daily' then
  if exists(select 1 from public.daily_claims where user_id=p_user and claimed_at>clock_timestamp()-interval '24 hours') then raise exception 'Bonificación diaria no disponible';end if;
  insert into public.daily_claims(user_id,operation_id) values(p_user,p_operation);
 end if;
 update public.game_accounts set state=p_state,revision=revision+1,updated_at=now() where user_id=p_user;
 update public.player_preferences set preferences=p_state->'settings' where user_id=p_user;
 for entry in select value from jsonb_array_elements(p_state->'ledger') loop
  insert into public.coin_transactions(user_id,id,amount,label,created_at) values(p_user,entry->>'id',(entry->>'amount')::numeric,entry->>'label',to_timestamp((entry->>'at')::numeric/1000)) on conflict do nothing;
 end loop;
 if p_state->'active'<>'null'::jsonb then
  insert into public.game_sessions(id,user_id,game,started_at) values((p_state->'active'->>'id')::uuid,p_user,p_state->'active'->>'game',case when coalesce((p_state->'active'->>'prepared')::boolean,false) then null else to_timestamp((p_state->'active'->>'startedAt')::numeric/1000) end)
  on conflict(id) do update set started_at=excluded.started_at;
 end if;
 if p_result is not null then
  g=p_result->>'game';round_id=(p_result->>'id')::uuid;
  if (current_state->'active'->>'id') is distinct from round_id::text then raise exception 'Resultado sin sesión activa'; end if;
  rules=case g when 'jitter' then 'jitter-10s-v1' when 'precision' then 'precision-20s-v1' else g||'-v1' end;
  update public.game_sessions set finished_at=now() where id=round_id and user_id=p_user;
  insert into public.official_results(session_id,user_id,game,ruleset,net,score,status,evidence,result) values(round_id,p_user,g,rules,(p_result->>'net')::numeric,coalesce((p_result->>'score')::numeric,0),p_status,p_evidence,p_result);
  record_value=case when g in ('blackjack','racing','roulette') then (p_result->>'net')::numeric else coalesce((p_result->>'score')::numeric,0) end;
  if p_status='verified' and record_value>0 then
   insert into public.personal_records(user_id,game,ruleset,value,session_id) values(p_user,g,rules,record_value,round_id)
   on conflict(user_id,game,ruleset) do update set value=excluded.value,session_id=excluded.session_id,achieved_at=now()
   where case when excluded.game='reaction' then excluded.value<public.personal_records.value else excluded.value>public.personal_records.value end;
  end if;
 end if;
 return jsonb_build_object('status','applied','state',p_state,'revision',rev+1);
end $$;

create function public.gambling_edit_profile(p_user uuid,p_username text,p_bio text,p_avatar text) returns void language plpgsql security definer set search_path='' as $$
begin
 -- Lock account first, matching the ordering of all economic transactions.
 perform 1 from public.game_accounts where user_id=p_user for update;
 update public.player_profiles set username=lower(trim(p_username)),bio=p_bio,avatar=p_avatar where user_id=p_user;
 update public.game_accounts set state=jsonb_set(state,'{name}',to_jsonb(lower(trim(p_username)))),revision=revision+1 where user_id=p_user;
end $$;
create function public.gambling_acknowledge(p_user uuid) returns void language sql security definer set search_path='' as $$
 update public.reward_grants set acknowledged_at=coalesce(acknowledged_at,now()) where user_id=p_user and kind='original';
$$;

-- A deliberately narrow public projection: no auth UUID, email, deck, sessions or tokens.
create view public.public_players with (security_barrier=true) as
select p.id,p.username,p.bio,p.avatar,p.original,p.joined_at as "joinedAt",
 (a.state->>'balance')::numeric as balance,(a.state->>'peak')::numeric as peak,(a.state->>'xp')::bigint as xp,
 (select coalesce(sum((s.value->>'played')::integer),0) from jsonb_each(a.state->'stats') s) as played,
 (select coalesce(sum((s.value->>'wins')::integer),0) from jsonb_each(a.state->'stats') s) as wins,
 (a.state->>'lost')::numeric as lost,(a.state->>'earned')::numeric as earned,
 coalesce((select jsonb_object_agg(r.game,r.value) from public.personal_records r where r.user_id=p.user_id and r.ruleset=case r.game when 'jitter' then 'jitter-10s-v1' when 'precision' then 'precision-20s-v1' else r.game||'-v1' end),'{}'::jsonb) as records
from public.player_profiles p join public.game_accounts a on a.user_id=p.user_id;
create view public.public_rankings with (security_barrier=true) as
with entries as (
 select p.*,v.kind,v.value from public.public_players p cross join lateral(values('balance',p.balance),('peak',p.peak)) v(kind,value)
 union all
 select p.*,r.key as kind,(r.value#>>'{}')::numeric as value from public.public_players p cross join lateral jsonb_each(p.records) r
)
select e.*,row_number() over(partition by kind order by case when kind='reaction' then -value else value end desc,"joinedAt",id) as position from entries e;

-- Default deny on ALL underlying tables. Users cannot forge economy, origins or records.
do $$ declare t text; begin
 foreach t in array array['player_profiles','account_origins','player_preferences','game_accounts','reward_grants','game_operations','coin_transactions','daily_claims','game_sessions','official_results','personal_records','request_limits'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
create policy own_profile_read on public.player_profiles for select to authenticated using(user_id=auth.uid());
grant select on public.player_profiles to authenticated;
-- The owner-executed public views intentionally expose only the listed safe columns.
revoke all on public.public_players,public.public_rankings from public;
grant select on public.public_players,public.public_rankings to anon,authenticated,service_role;
revoke all on function public.gambling_initial_state(text),public.gambling_original_grant(uuid),public.gambling_initialize_user(),public.gambling_verified_user(),public.gambling_rate_limit(uuid,text,integer),public.gambling_commit(uuid,uuid,bigint,jsonb,jsonb,jsonb,text,jsonb),public.gambling_edit_profile(uuid,text,text,text),public.gambling_acknowledge(uuid) from public,anon,authenticated;
grant execute on function public.gambling_rate_limit(uuid,text,integer),public.gambling_commit(uuid,uuid,bigint,jsonb,jsonb,jsonb,text,jsonb),public.gambling_edit_profile(uuid,text,text,text),public.gambling_acknowledge(uuid) to service_role;
commit;
