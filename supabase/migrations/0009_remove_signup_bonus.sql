-- Remove the free signup bonus entirely: new users now start with 0 credits.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, credits)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    0 -- no free tier: users must purchase credits before generating videos
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
