-- Avatar shop catalogue (the purchasable items with their coin price). Without
-- these rows the avatar editor shows a lock with no price and can't complete a
-- purchase. Stable UUIDs + on-conflict update make this idempotent - safe to run
-- anytime. Values must match the premium option ids in app/avatar/page.tsx.
insert into avatar_items (id, slot, name, svg_layer, unlock_type, cost_coins) values
  ('a0a00000-0000-4000-8000-000000000001', 'accessory', 'פרח בשיער',
   '{"value":"flower","label":"פרח","emoji":"🌸"}'::jsonb, 'coins', 25),
  ('a0a00000-0000-4000-8000-000000000002', 'hairstyle', 'תסרוקת קוקו',
   '{"value":"ponytail","label":"קוקו","emoji":"💇‍♀️"}'::jsonb, 'coins', 30),
  ('a0a00000-0000-4000-8000-000000000003', 'accessory', 'אוזניות',
   '{"value":"headphones","label":"אוזניות","emoji":"🎧"}'::jsonb, 'coins', 35),
  ('a0a00000-0000-4000-8000-000000000004', 'accessory', 'כתר מלכה',
   '{"value":"crown","label":"כתר","emoji":"👑"}'::jsonb, 'coins', 45),
  ('a0a00000-0000-4000-8000-000000000005', 'accessory', 'סיכת כוכב',
   '{"value":"star","label":"כוכב","emoji":"⭐"}'::jsonb, 'coins', 20),
  ('a0a00000-0000-4000-8000-000000000006', 'accessory', 'עגילים',
   '{"value":"earrings","label":"עגילים","emoji":"💎"}'::jsonb, 'coins', 28),
  ('a0a00000-0000-4000-8000-000000000007', 'accessory', 'משקפי שמש',
   '{"value":"sunglasses","label":"משקפי שמש","emoji":"🕶️"}'::jsonb, 'coins', 22)
on conflict (id) do update set
  slot = excluded.slot, name = excluded.name, svg_layer = excluded.svg_layer,
  unlock_type = excluded.unlock_type, cost_coins = excluded.cost_coins;
