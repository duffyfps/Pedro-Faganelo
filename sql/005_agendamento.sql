-- Roda o espelhamento a cada 2 minutos (troque COLE_A_CHAVE_AQUI pela CRON_SECRET)
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'espelhar-ofertas',
  '*/2 * * * *',
  $$ select net.http_get(
       url := 'https://ofertas-pedro.vercel.app/api/mirror?key=COLE_A_CHAVE_AQUI',
       timeout_milliseconds := 60000
     ); $$
);
