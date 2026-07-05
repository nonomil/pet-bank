-- 家庭账号社交注册邀请码种子数据
-- 生成日期：2026-07-05
-- 建议用途：贴到 Supabase SQL Editor 执行，作为试运行前的邀请码种子。

insert into public.registration_invites (
  invite_code,
  status,
  label,
  expires_at,
  metadata_json
)
values
  ('PARENT-BETA-MR6VCEXG-01', 'pending', '双家长联调-A', now() + interval '30 days', '{"batch":"pilot-1","generated_on":"2026-07-05","seed_index":1,"seed_code":"PARENT-BETA-MR6VCEXG-01"}'::jsonb),
  ('PARENT-BETA-MR6VCEXG-02', 'pending', '双家长联调-B', now() + interval '30 days', '{"batch":"pilot-1","generated_on":"2026-07-05","seed_index":2,"seed_code":"PARENT-BETA-MR6VCEXG-02"}'::jsonb),
  ('PARENT-BETA-MR6VCEXG-03', 'pending', '跨家庭好友联调', now() + interval '30 days', '{"batch":"pilot-1","generated_on":"2026-07-05","seed_index":3,"seed_code":"PARENT-BETA-MR6VCEXG-03"}'::jsonb);

-- 执行后建议立即确认状态
select invite_code, status, label, expires_at, claimed_at
from public.registration_invites
where invite_code in ('PARENT-BETA-MR6VCEXG-01', 'PARENT-BETA-MR6VCEXG-02', 'PARENT-BETA-MR6VCEXG-03')
order by created_at desc;

-- 如需软回滚，可撤销这一批邀请码
update public.registration_invites
set status = 'revoked'
where invite_code in ('PARENT-BETA-MR6VCEXG-01', 'PARENT-BETA-MR6VCEXG-02', 'PARENT-BETA-MR6VCEXG-03')
  and status = 'pending';
