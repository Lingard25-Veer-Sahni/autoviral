-- Instagram/Meta integration was abandoned (Meta's Instagram API access now
-- requires business verification) -- YouTube is the sole supported platform
-- going forward. This tightens the social_accounts.platform check constraint
-- to match and clears out any pre-existing instagram rows, which the app no
-- longer reads or writes.

delete from public.social_accounts where platform = 'instagram';

alter table public.social_accounts drop constraint if exists social_accounts_platform_check;
alter table public.social_accounts add constraint social_accounts_platform_check check (platform in ('youtube'));
