# Caça-Ofertas

Painel: https://ofertas-pedro.vercel.app

- Lê o canal @xetdaspromocoes no Telegram a cada 15 s (agendado no Supabase, pg_cron).
- Amazon: link curto link.amazon via SiteStripe (AMAZON_COOKIE); se falhar, amazon.com.br/dp/ASIN?tag=duffyfps-20.
- Mercado Livre: descobre o produto no perfil social do concorrente e gera o seu meli.la pelo gerador de afiliados (ML_COOKIE); se falhar, a oferta fica no painel.
- Usa a mesma foto do post e não cita forma de pagamento.
- Envia para o grupo do WhatsApp via Z-API Omni (WA_GROUP_ID na Vercel).
- Horário de silêncio e intervalo: tabela state no Supabase (quiet_hours, send_interval_sec).
- Alertas no WhatsApp (ALERT_PHONE) quando o link da Amazon ou do ML cai ou volta.
