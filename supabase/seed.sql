-- Development catalogue seed.
-- Prototype seven categories, Toyota/Honda/Suzuki taxonomy, ~25 parts.
-- Fitment nullability: make-only, make+model, and make+model+variant.

begin;

delete from part_fitments;
delete from parts;
delete from variants;
delete from models;
delete from makes;
delete from categories;

-- ── Categories ───────────────────────────────────────────────
insert into categories (slug, name, name_ur, icon, sort_order) values
  ('brakes',      'Brakes',      'بریکس',     'brakes',      1),
  ('filters',     'Filters',     'فلٹرز',     'filters',     2),
  ('engine',      'Engine',      'انجن',      'engine',      3),
  ('electrical',  'Electrical',  'الیکٹریکل', 'electrical',  4),
  ('suspension',  'Suspension',  'سسپنشن',    'suspension',  5),
  ('cooling',     'Cooling',     'کولنگ',     'cooling',     6),
  ('lighting',    'Lighting',    'لائٹس',     'lighting',    7);

-- ── Makes ────────────────────────────────────────────────────
insert into makes (slug, name, name_ur, sort_order) values
  ('toyota', 'Toyota', 'ٹویوٹا', 1),
  ('honda',  'Honda',  'ہونڈا',  2),
  ('suzuki', 'Suzuki', 'سوزوکی', 3);

-- ── Models ───────────────────────────────────────────────────
insert into models (make_id, slug, name, name_ur, sort_order)
select m.id, x.slug, x.name, x.name_ur, x.sort_order
from makes m
join (values
  ('toyota', 'corolla',  'Corolla',  'کرولا',   1),
  ('toyota', 'yaris',    'Yaris',    'یارس',    2),
  ('toyota', 'hilux',    'Hilux',    'ہائی لکس', 3),
  ('toyota', 'fortuner', 'Fortuner', 'فورچونر', 4),
  ('honda',  'civic',    'Civic',    'سوک',     1),
  ('honda',  'city',     'City',     'سٹی',     2),
  ('honda',  'brv',      'BR-V',     'بی آر وی', 3),
  ('suzuki', 'alto',     'Alto',     'الٹو',    1),
  ('suzuki', 'cultus',   'Cultus',   'کلٹس',    2),
  ('suzuki', 'swift',    'Swift',    'سوِفٹ',   3),
  ('suzuki', 'wagon-r',  'Wagon R',  'ویگن آر', 4)
) as x(make_slug, slug, name, name_ur, sort_order)
  on x.make_slug = m.slug;

-- ── Variants ─────────────────────────────────────────────────
insert into variants (model_id, slug, name, name_ur, sort_order)
select md.id, x.slug, x.name, x.name_ur, x.sort_order
from makes mk
join models md on md.make_id = mk.id
join (values
  ('toyota', 'corolla',  'xli',    'XLi',    'ایکس ایل آئی', 1),
  ('toyota', 'corolla',  'gli',    'GLi',    'جی ایل آئی',   2),
  ('toyota', 'corolla',  'altis',  'Altis',  'الٹس',         3),
  ('toyota', 'corolla',  'grande', 'Grande', 'گرانڈے',       4),
  ('toyota', 'yaris',    '13',     '1.3',    '1.3',           1),
  ('toyota', 'yaris',    '15',     '1.5',    '1.5',           2),
  ('toyota', 'hilux',    'vigo',   'Vigo',   'ویگو',          1),
  ('toyota', 'hilux',    'revo',   'Revo',   'ریوو',          2),
  ('toyota', 'fortuner', '27',     '2.7',    '2.7',           1),
  ('toyota', 'fortuner', '28',     '2.8',    '2.8',           2),
  ('honda',  'civic',    'rebirth','Rebirth','ریبرتھ',        1),
  ('honda',  'civic',    'oriel',  'Oriel',  'اوریئل',        2),
  ('honda',  'civic',    'rs',     'RS',     'آر ایس',        3),
  ('honda',  'city',     'ivtec',  'i-VTEC', 'آئی وی ٹیک',    1),
  ('honda',  'city',     'aspire', 'Aspire', 'اسپائر',        2),
  ('honda',  'brv',      'ivtec',  'i-VTEC', 'آئی وی ٹیک',    1),
  ('suzuki', 'alto',     'vx',     'VX',     'وی ایکس',       1),
  ('suzuki', 'alto',     'vxr',    'VXR',    'وی ایکس آر',    2),
  ('suzuki', 'alto',     'vxl',    'VXL',    'وی ایکس ایل',   3),
  ('suzuki', 'cultus',   'vxr',    'VXR',    'وی ایکس آر',    1),
  ('suzuki', 'cultus',   'vxl',    'VXL',    'وی ایکس ایل',   2),
  ('suzuki', 'swift',    'gl',     'GL',     'جی ایل',        1),
  ('suzuki', 'swift',    'glx',    'GLX',    'جی ایل ایکس',   2),
  ('suzuki', 'wagon-r',  'vxr',    'VXR',    'وی ایکس آر',    1),
  ('suzuki', 'wagon-r',  'vxl',    'VXL',    'وی ایکس ایل',   2)
) as x(make_slug, model_slug, slug, name, name_ur, sort_order)
  on x.make_slug = mk.slug and x.model_slug = md.slug;

-- ── Parts ────────────────────────────────────────────────────
insert into parts (
  sku, name, name_ur, brand, oem_number, category_id, price_pkr,
  description, description_ur, image_url
)
select
  x.sku, x.name, x.name_ur, x.brand, x.oem_number, c.id, x.price_pkr,
  x.description, x.description_ur, null
from categories c
join (values
  -- Brakes
  ('SSG-BRK-001', 'brakes', 'Front Brake Pad Set', 'فرنٹ بریک پیڈ سیٹ',
   'Brembo', '04465-YZZE1', 7200.00,
   'Ceramic front pads for Corolla GLi.', 'کرولا جی ایل آئی کے لیے فرنٹ سیرامک پیڈز۔'),
  ('SSG-BRK-002', 'brakes', 'Front Brake Pad Set', 'فرنٹ بریک پیڈ سیٹ',
   'Brembo', '45022-TR0-A00', 8100.00,
   'Front pads for Civic Oriel.', 'سوک اوریئل کے لیے فرنٹ پیڈز۔'),
  ('SSG-BRK-003', 'brakes', 'Rear Brake Shoe Set', 'ریئر بریک شو سیٹ',
   'Bosch', '53200-63J00', 3900.00,
   'Rear shoes for Cultus.', 'کلٹس کے لیے ریئر شوز۔'),
  ('SSG-BRK-004', 'brakes', 'Front Brake Disc', 'فرنٹ بریک ڈسک',
   'Brembo', '43512-12240', 11500.00,
   'Ventilated front disc, all Corolla variants.', 'تمام کرولا ویرینٹس کے لیے وینٹیلیٹڈ فرنٹ ڈسک۔'),

  -- Filters
  ('SSG-FLT-001', 'filters', 'Oil Filter', 'آئل فلٹر',
   'Denso', '90915-YZZD2', 950.00,
   'Spin-on oil filter for all Corolla variants.', 'تمام کرولا ویرینٹس کے لیے آئل فلٹر۔'),
  ('SSG-FLT-002', 'filters', 'Oil Filter', 'آئل فلٹر',
   'Honda', '15400-PLM-A02', 1100.00,
   'Oil filter for Civic.', 'سوک کے لیے آئل فلٹر۔'),
  ('SSG-FLT-003', 'filters', 'Air Filter', 'ایئر فلٹر',
   'Bosch', '13780-80G00', 1450.00,
   'Panel air filter for Alto.', 'الٹو کے لیے ایئر فلٹر۔'),
  ('SSG-FLT-004', 'filters', 'Cabin Filter', 'کیبن فلٹر',
   'Bosch', '80292-TF0-H00', 1800.00,
   'Pollen cabin filter for City.', 'سٹی کے لیے کیبن فلٹر۔'),

  -- Engine
  ('SSG-ENG-001', 'engine', 'Iridium Spark Plug (set of 4)', 'ایریڈیم اسپارک پلگ (4)',
   'NGK', '90919-01253', 4200.00,
   'Iridium plugs for Corolla 1.6/1.8.', 'کرولا 1.6/1.8 کے لیے ایریڈیم پلگ۔'),
  ('SSG-ENG-002', 'engine', 'Timing Belt Kit', 'ٹائمنگ بیلٹ کٹ',
   'Gates', '14400-RRA-A02', 18500.00,
   'Belt, tensioner and idler for Civic.', 'سوک کے لیے بیلٹ، ٹینشنر اور آئیڈلر۔'),
  ('SSG-ENG-003', 'engine', 'Engine Mount', 'انجن ماؤنٹ',
   'Febi', '11310-63J00', 5600.00,
   'RH engine mount for Cultus.', 'کلٹس کے لیے دایاں انجن ماؤنٹ۔'),
  ('SSG-ENG-004', 'engine', 'PCV Valve', 'پی سی وی والو',
   'Denso', '12204-21010', 2100.00,
   'PCV valve for Yaris.', 'یارس کے لیے پی سی وی والو۔'),

  -- Electrical
  ('SSG-ELC-001', 'electrical', 'Alternator', 'آلٹرنیٹر',
   'Denso', '27060-0W011', 28500.00,
   '12V alternator for all Corolla variants.', 'تمام کرولا ویرینٹس کے لیے آلٹرنیٹر۔'),
  ('SSG-ELC-002', 'electrical', 'Starter Motor', 'اسٹارٹر موٹر',
   'Denso', '28100-0K050', 31200.00,
   'Starter for Hilux Revo.', 'ہائی لکس ریوو کے لیے اسٹارٹر۔'),
  ('SSG-ELC-003', 'electrical', '12V Maintenance-Free Battery', '12 وولٹ بیٹری',
   'Bosch', 'DIN55-MF', 19800.00,
   'Fits all Toyota models in this catalogue.', 'اس کیٹلاگ کی تمام ٹویوٹا گاڑیوں کے لیے۔'),
  ('SSG-ELC-004', 'electrical', 'Ignition Coil', 'اگنشن کوائل',
   'Denso', '30520-RTA-003', 6400.00,
   'Ignition coil for Civic.', 'سوک کے لیے اگنشن کوائل۔'),

  -- Suspension
  ('SSG-SUS-001', 'suspension', 'Front Shock Absorber', 'فرنٹ شاک ابزربر',
   'KYB', '48510-02D40', 9200.00,
   'Gas front shock for Corolla GLi/XLi.', 'کرولا جی ایل آئی/ایکس ایل آئی کے لیے فرنٹ شاک۔'),
  ('SSG-SUS-002', 'suspension', 'Rear Shock Absorber', 'ریئر شاک ابزربر',
   'KYB', '41601-63J00', 7800.00,
   'Rear shock for Swift.', 'سوِفٹ کے لیے ریئر شاک۔'),
  ('SSG-SUS-003', 'suspension', 'Outer Tie Rod End', 'آؤٹر ٹائی روڈ اینڈ',
   '555', '53540-TF0-004', 2450.00,
   'Outer tie rod for City.', 'سٹی کے لیے آؤٹر ٹائی روڈ۔'),

  -- Cooling
  ('SSG-CLG-001', 'cooling', 'Radiator', 'ریڈی ایٹر',
   'Denso', '16400-0T070', 16800.00,
   'Aluminium radiator for all Corolla variants.', 'تمام کرولا ویرینٹس کے لیے ریڈی ایٹر۔'),
  ('SSG-CLG-002', 'cooling', 'Thermostat', 'تھرماسٹیٹ',
   'Gates', '19301-RTA-003', 3200.00,
   'Thermostat for Civic.', 'سوک کے لیے تھرماسٹیٹ۔'),
  ('SSG-CLG-003', 'cooling', 'Water Pump', 'واٹر پمپ',
   'Aisin', '17400-80G00', 7100.00,
   'Water pump for Alto.', 'الٹو کے لیے واٹر پمپ۔'),

  -- Lighting
  ('SSG-LGT-001', 'lighting', 'Headlamp Assembly (RH)', 'ہیڈ لیمپ (دایاں)',
   'Depo', '33100-TBA-A01', 14200.00,
   'Right headlamp for Civic Oriel.', 'سوک اوریئل کے لیے دایاں ہیڈ لیمپ۔'),
  ('SSG-LGT-002', 'lighting', 'Tail Lamp Assembly (LH)', 'ٹیل لیمپ (بایاں)',
   'Depo', '35750-63J00', 5600.00,
   'Left tail lamp for Cultus.', 'کلٹس کے لیے بایاں ٹیل لیمپ۔'),
  ('SSG-LGT-003', 'lighting', 'Fog Lamp (pair)', 'فاگ لیمپ (جوڑا)',
   'Depo', '81210-0K140', 8900.00,
   'Fog lamp pair for Fortuner.', 'فورچونر کے لیے فاگ لیمپ جوڑا۔')
) as x(sku, cat_slug, name, name_ur, brand, oem_number, price_pkr, description, description_ur)
  on x.cat_slug = c.slug;

-- ── Fitments ─────────────────────────────────────────────────
-- Helper: insert by part sku + make/model/variant slugs (null = all at that level).

-- Make-only: Bosch battery → all Toyotas
insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, null, null
from parts p
join makes mk on mk.slug = 'toyota'
where p.sku = 'SSG-ELC-003';

-- Make + model, variant null: all Corollas
insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, null
from parts p
join makes mk on mk.slug = 'toyota'
join models md on md.make_id = mk.id and md.slug = 'corolla'
where p.sku in (
  'SSG-BRK-004', 'SSG-FLT-001', 'SSG-ENG-001', 'SSG-ELC-001', 'SSG-CLG-001'
);

-- Make + model, variant null: all Civics
insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, null
from parts p
join makes mk on mk.slug = 'honda'
join models md on md.make_id = mk.id and md.slug = 'civic'
where p.sku in ('SSG-FLT-002', 'SSG-ENG-002', 'SSG-ELC-004', 'SSG-CLG-002');

-- Make + model, variant null: all Cultus
insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, null
from parts p
join makes mk on mk.slug = 'suzuki'
join models md on md.make_id = mk.id and md.slug = 'cultus'
where p.sku in ('SSG-BRK-003', 'SSG-ENG-003', 'SSG-LGT-002');

-- Make + model, variant null: remaining model-level parts
insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, null
from parts p
join makes mk on mk.slug = 'suzuki'
join models md on md.make_id = mk.id and md.slug = 'alto'
where p.sku in ('SSG-FLT-003', 'SSG-CLG-003');

insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, null
from parts p
join makes mk on mk.slug = 'honda'
join models md on md.make_id = mk.id and md.slug = 'city'
where p.sku in ('SSG-FLT-004', 'SSG-SUS-003');

insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, null
from parts p
join makes mk on mk.slug = 'toyota'
join models md on md.make_id = mk.id and md.slug = 'yaris'
where p.sku = 'SSG-ENG-004';

insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, null
from parts p
join makes mk on mk.slug = 'suzuki'
join models md on md.make_id = mk.id and md.slug = 'swift'
where p.sku = 'SSG-SUS-002';

insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, null
from parts p
join makes mk on mk.slug = 'toyota'
join models md on md.make_id = mk.id and md.slug = 'fortuner'
where p.sku = 'SSG-LGT-003';

-- Full variant: specific trims
insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, v.id
from parts p
join makes mk on mk.slug = 'toyota'
join models md on md.make_id = mk.id and md.slug = 'corolla'
join variants v on v.model_id = md.id and v.slug = 'gli'
where p.sku = 'SSG-BRK-001';

insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, v.id
from parts p
join makes mk on mk.slug = 'toyota'
join models md on md.make_id = mk.id and md.slug = 'corolla'
join variants v on v.model_id = md.id and v.slug in ('gli', 'xli')
where p.sku = 'SSG-SUS-001';

insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, v.id
from parts p
join makes mk on mk.slug = 'honda'
join models md on md.make_id = mk.id and md.slug = 'civic'
join variants v on v.model_id = md.id and v.slug = 'oriel'
where p.sku in ('SSG-BRK-002', 'SSG-LGT-001');

insert into part_fitments (part_id, make_id, model_id, variant_id)
select p.id, mk.id, md.id, v.id
from parts p
join makes mk on mk.slug = 'toyota'
join models md on md.make_id = mk.id and md.slug = 'hilux'
join variants v on v.model_id = md.id and v.slug = 'revo'
where p.sku = 'SSG-ELC-002';

commit;
