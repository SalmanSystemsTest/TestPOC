-- When a quote is inserted, notify-quote must run even if the phone
-- drops the client invoke. The API key is read from Vault at call time.

create extension if not exists pg_net with schema extensions;

create or replace function enqueue_quote_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  endpoint text;
  secret text;
begin
  endpoint :=
    rtrim(current_setting('app.settings.supabase_url', true), '/')
    || '/functions/v1/notify-quote';
  if endpoint is null or endpoint = '/functions/v1/notify-quote' then
    endpoint := 'https://nlsvofnxhjnbesspyofi.supabase.co/functions/v1/notify-quote';
  end if;

  select decrypted_secret into secret
  from vault.decrypted_secrets
  where name = 'notify_quote_apikey'
  limit 1;

  if secret is null or secret = '' then
    return new;
  end if;

  perform net.http_post(
    url := endpoint,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', secret
    ),
    body := jsonb_build_object(
      'quote_request_id', new.id,
      'record', jsonb_build_object('id', new.id)
    )
  );
  return new;
end;
$$;

drop trigger if exists quote_requests_notify on quote_requests;
create trigger quote_requests_notify
  after insert on quote_requests
  for each row execute function enqueue_quote_notify();
