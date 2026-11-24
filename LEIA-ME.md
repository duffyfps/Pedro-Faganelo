# Caça-Ofertas

Painel: https://ofertas-pedro.vercel.app

- Lê o canal @xetdaspromocoes no Telegram a cada 15 s (agendado no Supabase, pg_cron).
- Troca os links pelos seus (Amazon: link curto link.amazon via SiteStripe; se falhar, amazon.com.br/dp/ASIN?tag=duffyfps-20).
- Usa a mesma foto do post e não cita forma de pagamento.
- Envia para o grupo do WhatsApp via Z-API Omni (WA_GROUP_ID na Vercel).
- Horário de silêncio e intervalo: tabela state no Supabase (quiet_hours, send_interval_sec).
- Ligar/desligar o envio: botão no topo do painel.
