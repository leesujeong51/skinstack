-- 다른 사람 루틴 구경하기 (공개 루틴 + 신고). Supabase SQL Editor 에서 한 번 실행.
-- 공개 테이블에는 닉네임·피부 타입 태그(선택)·제품 목록·한 줄 후기만 저장. 이메일·피부 정보(임신·수유 등)는 저장하지 않음.
-- 주의: 뷰(view)는 RLS 를 우회하므로 사용하지 않음. 테이블 RLS + 컬럼 권한으로만 보호.

create table if not exists shared_routines (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_id   text not null,                                   -- 공개한 사람의 '내 루틴' id (다시 공개하면 갱신)
  nickname    text not null check (char_length(nickname) between 1 and 20),
  skin_type   text check (skin_type in ('dry', 'oily', 'combination', 'normal')),
  slot        text not null check (slot in ('am', 'pm')),
  name        text not null check (char_length(name) between 1 and 60),
  note        text check (char_length(note) <= 200),
  items       jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20),
  report_count int not null default 0,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner, source_id)
);
create index if not exists idx_shared_routines_feed on shared_routines (hidden, created_at desc);

alter table shared_routines enable row level security;
create policy "anyone reads visible routines" on shared_routines for select using (not hidden);
create policy "owner inserts" on shared_routines for insert with check (owner = auth.uid());
create policy "owner updates" on shared_routines for update using (owner = auth.uid()) with check (owner = auth.uid());
create policy "owner deletes" on shared_routines for delete using (owner = auth.uid());

-- 숨김 여부·신고 수는 사용자가 직접 쓰지 못하게 (컬럼 단위 권한)
revoke insert, update on shared_routines from anon, authenticated;
grant insert (source_id, nickname, skin_type, slot, name, note, items) on shared_routines to authenticated;
grant update (nickname, skin_type, slot, name, note, items, updated_at) on shared_routines to authenticated;

-- ---------- 신고: 같은 사람은 한 번만, 3번 쌓이면 자동 숨김 ----------
create table if not exists routine_reports (
  routine_id uuid not null references shared_routines(id) on delete cascade,
  reporter   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason     text check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (routine_id, reporter)
);
alter table routine_reports enable row level security;
create policy "logged-in users report" on routine_reports for insert to authenticated with check (reporter = auth.uid());
-- 신고 내용은 아무도 조회하지 못함 (대시보드에서만 확인)

create or replace function handle_routine_report() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update shared_routines
     set report_count = report_count + 1,
         hidden = (report_count + 1) >= 3
   where id = new.routine_id;
  return new;
end;
$$;
drop trigger if exists on_routine_report on routine_reports;
create trigger on_routine_report after insert on routine_reports for each row execute function handle_routine_report();
-- 숨김 해제: 대시보드 Table Editor 에서 shared_routines.hidden 을 false 로
