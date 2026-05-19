-- =============================================================================
-- Quantuma AI — Smoke-Test Seed
-- =============================================================================
--  Phase: 5 of 10  (optional — run AFTER schema.sql, policies.sql, views.sql)
--
-- Purpose
-- ───────
-- The full PySpark pipeline (Phase 6/7) takes a few minutes and requires you
-- to download the Olist CSVs. This file inserts a tiny but realistic sample
-- so the React dashboard has data to render *right now* — you can verify
-- that the Supabase wiring from Phase 4 actually works end-to-end before
-- moving on to the Big Data part.
--
-- Volumes inserted: 4 sellers, 8 products, 20 customers, 35 orders, ~50
-- order_items, ~38 payments, ~25 reviews, 20 RFM rows, 20 segment labels,
-- 30 recommendations, 8 product_metrics, 14 kpi_snapshots, 4 ml_model_runs.
--
-- Idempotent: every INSERT uses ON CONFLICT DO NOTHING. Safe to re-run.
--
-- To wipe and re-seed:
--     TRUNCATE public.recommendations, public.customer_segments,
--              public.customer_features, public.product_metrics,
--              public.kpi_snapshots, public.sales_forecasts,
--              public.ml_model_runs, public.order_reviews,
--              public.order_payments, public.order_items, public.orders,
--              public.customers, public.products, public.sellers,
--              public.product_category_translation RESTART IDENTITY CASCADE;
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Category translation (Portuguese → English) — same shape as the Olist file.
-- -----------------------------------------------------------------------------
INSERT INTO public.product_category_translation (product_category_name, product_category_name_english) VALUES
  ('eletronicos',       'electronics'),
  ('moveis_decoracao',  'furniture_decor'),
  ('beleza_saude',      'health_beauty'),
  ('esporte_lazer',     'sports_leisure'),
  ('informatica_acessorios', 'computers_accessories'),
  ('cama_mesa_banho',   'bed_bath_table'),
  ('brinquedos',        'toys'),
  ('livros_geral',      'books_general')
ON CONFLICT (product_category_name) DO NOTHING;


-- -----------------------------------------------------------------------------
-- Sellers
-- -----------------------------------------------------------------------------
INSERT INTO public.sellers (seller_id, seller_zip_code_prefix, seller_city, seller_state) VALUES
  ('seller_001', '01000', 'sao paulo',       'SP'),
  ('seller_002', '20000', 'rio de janeiro',  'RJ'),
  ('seller_003', '30000', 'belo horizonte',  'MG'),
  ('seller_004', '90000', 'porto alegre',    'RS')
ON CONFLICT (seller_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- Products
-- -----------------------------------------------------------------------------
INSERT INTO public.products (
  product_id, product_category_name, product_name_lenght, product_description_lenght,
  product_photos_qty, product_weight_g, product_length_cm, product_height_cm, product_width_cm
) VALUES
  ('prod_001', 'eletronicos',       45, 320, 4,  800, 30, 10, 20),
  ('prod_002', 'moveis_decoracao',  52, 510, 6, 3200, 80, 40, 60),
  ('prod_003', 'beleza_saude',      33, 240, 3,  200, 12, 12,  8),
  ('prod_004', 'esporte_lazer',     38, 410, 5, 1500, 50, 20, 30),
  ('prod_005', 'informatica_acessorios', 40, 280, 4, 400, 25, 5, 18),
  ('prod_006', 'cama_mesa_banho',   46, 360, 4, 1200, 60, 30, 40),
  ('prod_007', 'brinquedos',        35, 220, 3,  600, 25, 25, 25),
  ('prod_008', 'livros_geral',      28, 180, 2,  450, 24, 16,  3)
ON CONFLICT (product_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- Customers — 20 unique people, but Olist style: each gets a fresh
-- customer_id per order. We pretend customer_unique_id_001..020 each placed
-- between 1 and 4 orders, so we need ~35 customers rows.
-- -----------------------------------------------------------------------------
INSERT INTO public.customers (customer_id, customer_unique_id, customer_zip_code_prefix, customer_city, customer_state) VALUES
  -- person 001 (VIP, 4 orders)
  ('cust_001a', 'cu_001', '01310', 'sao paulo',       'SP'),
  ('cust_001b', 'cu_001', '01310', 'sao paulo',       'SP'),
  ('cust_001c', 'cu_001', '01310', 'sao paulo',       'SP'),
  ('cust_001d', 'cu_001', '01310', 'sao paulo',       'SP'),
  -- person 002 (VIP, 3 orders)
  ('cust_002a', 'cu_002', '04500', 'sao paulo',       'SP'),
  ('cust_002b', 'cu_002', '04500', 'sao paulo',       'SP'),
  ('cust_002c', 'cu_002', '04500', 'sao paulo',       'SP'),
  -- person 003 (Loyal, 3 orders)
  ('cust_003a', 'cu_003', '20040', 'rio de janeiro',  'RJ'),
  ('cust_003b', 'cu_003', '20040', 'rio de janeiro',  'RJ'),
  ('cust_003c', 'cu_003', '20040', 'rio de janeiro',  'RJ'),
  -- person 004..006 (Loyal, 2 orders each)
  ('cust_004a', 'cu_004', '30190', 'belo horizonte',  'MG'),
  ('cust_004b', 'cu_004', '30190', 'belo horizonte',  'MG'),
  ('cust_005a', 'cu_005', '40020', 'salvador',        'BA'),
  ('cust_005b', 'cu_005', '40020', 'salvador',        'BA'),
  ('cust_006a', 'cu_006', '80010', 'curitiba',        'PR'),
  ('cust_006b', 'cu_006', '80010', 'curitiba',        'PR'),
  -- person 007..012 (New, 1 order each)
  ('cust_007a', 'cu_007', '50050', 'recife',          'PE'),
  ('cust_008a', 'cu_008', '60110', 'fortaleza',       'CE'),
  ('cust_009a', 'cu_009', '70040', 'brasilia',        'DF'),
  ('cust_010a', 'cu_010', '90010', 'porto alegre',    'RS'),
  ('cust_011a', 'cu_011', '13010', 'campinas',        'SP'),
  ('cust_012a', 'cu_012', '22270', 'rio de janeiro',  'RJ'),
  -- person 013..016 (At Risk, 1 order each, long-ago)
  ('cust_013a', 'cu_013', '88010', 'florianopolis',   'SC'),
  ('cust_014a', 'cu_014', '69005', 'manaus',          'AM'),
  ('cust_015a', 'cu_015', '57000', 'maceio',          'AL'),
  ('cust_016a', 'cu_016', '79002', 'campo grande',    'MS'),
  -- person 017..020 (At Risk, 2 orders, long-ago)
  ('cust_017a', 'cu_017', '74000', 'goiania',         'GO'),
  ('cust_017b', 'cu_017', '74000', 'goiania',         'GO'),
  ('cust_018a', 'cu_018', '76800', 'porto velho',     'RO'),
  ('cust_018b', 'cu_018', '76800', 'porto velho',     'RO'),
  ('cust_019a', 'cu_019', '29010', 'vitoria',         'ES'),
  ('cust_019b', 'cu_019', '29010', 'vitoria',         'ES'),
  ('cust_020a', 'cu_020', '64000', 'teresina',        'PI'),
  ('cust_020b', 'cu_020', '64000', 'teresina',        'PI')
ON CONFLICT (customer_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- Orders — 35 rows. Spread across the last 13 months so the 12-month chart
-- has data and the recency calculation produces a mix of fresh + stale.
-- -----------------------------------------------------------------------------
INSERT INTO public.orders (
  order_id, customer_id, order_status, order_purchase_timestamp,
  order_approved_at, order_delivered_carrier_date, order_delivered_customer_date,
  order_estimated_delivery_date
) VALUES
  -- cu_001 (VIP)
  ('ord_001', 'cust_001a', 'delivered', now() - INTERVAL '5 days',  now() - INTERVAL '5 days',  now() - INTERVAL '4 days', now() - INTERVAL '1 day',  now() + INTERVAL '2 days'),
  ('ord_002', 'cust_001b', 'delivered', now() - INTERVAL '45 days', now() - INTERVAL '45 days', now() - INTERVAL '44 days', now() - INTERVAL '40 days', now() - INTERVAL '38 days'),
  ('ord_003', 'cust_001c', 'delivered', now() - INTERVAL '120 days',now() - INTERVAL '120 days',now() - INTERVAL '119 days',now() - INTERVAL '115 days',now() - INTERVAL '113 days'),
  ('ord_004', 'cust_001d', 'delivered', now() - INTERVAL '210 days',now() - INTERVAL '210 days',now() - INTERVAL '209 days',now() - INTERVAL '205 days',now() - INTERVAL '203 days'),
  -- cu_002 (VIP)
  ('ord_005', 'cust_002a', 'delivered', now() - INTERVAL '7 days',  now() - INTERVAL '7 days',  now() - INTERVAL '6 days',  now() - INTERVAL '2 days', now() + INTERVAL '1 day'),
  ('ord_006', 'cust_002b', 'delivered', now() - INTERVAL '60 days', now() - INTERVAL '60 days', now() - INTERVAL '59 days', now() - INTERVAL '55 days',now() - INTERVAL '53 days'),
  ('ord_007', 'cust_002c', 'delivered', now() - INTERVAL '150 days',now() - INTERVAL '150 days',now() - INTERVAL '149 days',now() - INTERVAL '145 days',now() - INTERVAL '143 days'),
  -- cu_003 (Loyal)
  ('ord_008', 'cust_003a', 'delivered', now() - INTERVAL '15 days', now() - INTERVAL '15 days', now() - INTERVAL '14 days', now() - INTERVAL '10 days',now() - INTERVAL '8 days'),
  ('ord_009', 'cust_003b', 'delivered', now() - INTERVAL '80 days', now() - INTERVAL '80 days', now() - INTERVAL '79 days', now() - INTERVAL '75 days',now() - INTERVAL '73 days'),
  ('ord_010', 'cust_003c', 'delivered', now() - INTERVAL '180 days',now() - INTERVAL '180 days',now() - INTERVAL '179 days',now() - INTERVAL '175 days',now() - INTERVAL '173 days'),
  -- cu_004 (Loyal)
  ('ord_011', 'cust_004a', 'delivered', now() - INTERVAL '25 days', now() - INTERVAL '25 days', now() - INTERVAL '24 days', now() - INTERVAL '20 days',now() - INTERVAL '18 days'),
  ('ord_012', 'cust_004b', 'delivered', now() - INTERVAL '95 days', now() - INTERVAL '95 days', now() - INTERVAL '94 days', now() - INTERVAL '90 days',now() - INTERVAL '88 days'),
  -- cu_005 (Loyal)
  ('ord_013', 'cust_005a', 'delivered', now() - INTERVAL '30 days', now() - INTERVAL '30 days', now() - INTERVAL '29 days', now() - INTERVAL '25 days',now() - INTERVAL '23 days'),
  ('ord_014', 'cust_005b', 'delivered', now() - INTERVAL '100 days',now() - INTERVAL '100 days',now() - INTERVAL '99 days', now() - INTERVAL '95 days',now() - INTERVAL '93 days'),
  -- cu_006 (Loyal)
  ('ord_015', 'cust_006a', 'delivered', now() - INTERVAL '40 days', now() - INTERVAL '40 days', now() - INTERVAL '39 days', now() - INTERVAL '35 days',now() - INTERVAL '33 days'),
  ('ord_016', 'cust_006b', 'delivered', now() - INTERVAL '110 days',now() - INTERVAL '110 days',now() - INTERVAL '109 days',now() - INTERVAL '105 days',now() - INTERVAL '103 days'),
  -- cu_007..012 (New, 1 order each, recent)
  ('ord_017', 'cust_007a', 'delivered', now() - INTERVAL '3 days',  now() - INTERVAL '3 days',  now() - INTERVAL '2 days',  now() - INTERVAL '1 day',  now() + INTERVAL '3 days'),
  ('ord_018', 'cust_008a', 'delivered', now() - INTERVAL '6 days',  now() - INTERVAL '6 days',  now() - INTERVAL '5 days',  now() - INTERVAL '1 day',  now() + INTERVAL '2 days'),
  ('ord_019', 'cust_009a', 'shipped',   now() - INTERVAL '2 days',  now() - INTERVAL '2 days',  now() - INTERVAL '1 day',   NULL,                      now() + INTERVAL '5 days'),
  ('ord_020', 'cust_010a', 'delivered', now() - INTERVAL '10 days', now() - INTERVAL '10 days', now() - INTERVAL '9 days',  now() - INTERVAL '5 days', now() - INTERVAL '3 days'),
  ('ord_021', 'cust_011a', 'delivered', now() - INTERVAL '12 days', now() - INTERVAL '12 days', now() - INTERVAL '11 days', now() - INTERVAL '7 days', now() - INTERVAL '5 days'),
  ('ord_022', 'cust_012a', 'processing',now() - INTERVAL '1 day',   now() - INTERVAL '1 day',   NULL,                       NULL,                      now() + INTERVAL '7 days'),
  -- cu_013..016 (At Risk, 1 order each, long-ago)
  ('ord_023', 'cust_013a', 'delivered', now() - INTERVAL '280 days',now() - INTERVAL '280 days',now() - INTERVAL '279 days',now() - INTERVAL '275 days',now() - INTERVAL '273 days'),
  ('ord_024', 'cust_014a', 'delivered', now() - INTERVAL '300 days',now() - INTERVAL '300 days',now() - INTERVAL '299 days',now() - INTERVAL '295 days',now() - INTERVAL '293 days'),
  ('ord_025', 'cust_015a', 'delivered', now() - INTERVAL '320 days',now() - INTERVAL '320 days',now() - INTERVAL '319 days',now() - INTERVAL '315 days',now() - INTERVAL '313 days'),
  ('ord_026', 'cust_016a', 'delivered', now() - INTERVAL '340 days',now() - INTERVAL '340 days',now() - INTERVAL '339 days',now() - INTERVAL '335 days',now() - INTERVAL '333 days'),
  -- cu_017..020 (At Risk, 2 orders each, long-ago)
  ('ord_027', 'cust_017a', 'delivered', now() - INTERVAL '250 days',now() - INTERVAL '250 days',now() - INTERVAL '249 days',now() - INTERVAL '245 days',now() - INTERVAL '243 days'),
  ('ord_028', 'cust_017b', 'delivered', now() - INTERVAL '350 days',now() - INTERVAL '350 days',now() - INTERVAL '349 days',now() - INTERVAL '345 days',now() - INTERVAL '343 days'),
  ('ord_029', 'cust_018a', 'delivered', now() - INTERVAL '260 days',now() - INTERVAL '260 days',now() - INTERVAL '259 days',now() - INTERVAL '255 days',now() - INTERVAL '253 days'),
  ('ord_030', 'cust_018b', 'delivered', now() - INTERVAL '355 days',now() - INTERVAL '355 days',now() - INTERVAL '354 days',now() - INTERVAL '350 days',now() - INTERVAL '348 days'),
  ('ord_031', 'cust_019a', 'delivered', now() - INTERVAL '270 days',now() - INTERVAL '270 days',now() - INTERVAL '269 days',now() - INTERVAL '265 days',now() - INTERVAL '263 days'),
  ('ord_032', 'cust_019b', 'delivered', now() - INTERVAL '360 days',now() - INTERVAL '360 days',now() - INTERVAL '359 days',now() - INTERVAL '355 days',now() - INTERVAL '353 days'),
  ('ord_033', 'cust_020a', 'delivered', now() - INTERVAL '290 days',now() - INTERVAL '290 days',now() - INTERVAL '289 days',now() - INTERVAL '285 days',now() - INTERVAL '283 days'),
  ('ord_034', 'cust_020b', 'delivered', now() - INTERVAL '370 days',now() - INTERVAL '370 days',now() - INTERVAL '369 days',now() - INTERVAL '365 days',now() - INTERVAL '363 days'),
  ('ord_035', 'cust_012a', 'canceled',  now() - INTERVAL '4 days',  now() - INTERVAL '4 days',  NULL,                       NULL,                      now() + INTERVAL '6 days')
ON CONFLICT (order_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- Order items — one line per order, two for big-ticket orders.
-- -----------------------------------------------------------------------------
INSERT INTO public.order_items (order_id, order_item_id, product_id, seller_id, shipping_limit_date, price, freight_value) VALUES
  ('ord_001', 1, 'prod_001', 'seller_001', now() - INTERVAL '3 days', 450.00, 22.50),
  ('ord_001', 2, 'prod_005', 'seller_001', now() - INTERVAL '3 days', 180.00, 15.00),
  ('ord_002', 1, 'prod_002', 'seller_002', now() - INTERVAL '43 days', 320.00, 30.00),
  ('ord_003', 1, 'prod_006', 'seller_003', now() - INTERVAL '118 days', 210.00, 18.00),
  ('ord_004', 1, 'prod_001', 'seller_001', now() - INTERVAL '208 days', 480.00, 22.50),
  ('ord_005', 1, 'prod_002', 'seller_002', now() - INTERVAL '5 days',  350.00, 32.00),
  ('ord_005', 2, 'prod_003', 'seller_002', now() - INTERVAL '5 days',  85.00, 10.00),
  ('ord_006', 1, 'prod_004', 'seller_002', now() - INTERVAL '58 days', 220.00, 20.00),
  ('ord_007', 1, 'prod_005', 'seller_001', now() - INTERVAL '148 days', 195.00, 16.00),
  ('ord_008', 1, 'prod_007', 'seller_003', now() - INTERVAL '13 days', 130.00, 14.00),
  ('ord_009', 1, 'prod_008', 'seller_004', now() - INTERVAL '78 days', 60.00, 9.00),
  ('ord_010', 1, 'prod_001', 'seller_001', now() - INTERVAL '178 days', 460.00, 22.50),
  ('ord_011', 1, 'prod_004', 'seller_002', now() - INTERVAL '23 days', 225.00, 20.00),
  ('ord_012', 1, 'prod_006', 'seller_003', now() - INTERVAL '93 days', 215.00, 18.00),
  ('ord_013', 1, 'prod_002', 'seller_002', now() - INTERVAL '28 days', 340.00, 30.00),
  ('ord_014', 1, 'prod_007', 'seller_003', now() - INTERVAL '98 days', 125.00, 14.00),
  ('ord_015', 1, 'prod_003', 'seller_002', now() - INTERVAL '38 days', 90.00, 10.00),
  ('ord_016', 1, 'prod_005', 'seller_001', now() - INTERVAL '108 days', 190.00, 16.00),
  ('ord_017', 1, 'prod_008', 'seller_004', now() - INTERVAL '1 day',   65.00, 9.00),
  ('ord_018', 1, 'prod_003', 'seller_002', now() - INTERVAL '4 days',  88.00, 10.00),
  ('ord_019', 1, 'prod_007', 'seller_003', now() - INTERVAL '0 days',  135.00, 14.00),
  ('ord_020', 1, 'prod_001', 'seller_001', now() - INTERVAL '8 days',  455.00, 22.50),
  ('ord_021', 1, 'prod_004', 'seller_002', now() - INTERVAL '10 days', 230.00, 20.00),
  ('ord_022', 1, 'prod_006', 'seller_003', now() - INTERVAL '0 days',  205.00, 18.00),
  ('ord_023', 1, 'prod_002', 'seller_002', now() - INTERVAL '278 days', 305.00, 30.00),
  ('ord_024', 1, 'prod_008', 'seller_004', now() - INTERVAL '298 days', 58.00, 9.00),
  ('ord_025', 1, 'prod_003', 'seller_002', now() - INTERVAL '318 days', 80.00, 10.00),
  ('ord_026', 1, 'prod_007', 'seller_003', now() - INTERVAL '338 days', 120.00, 14.00),
  ('ord_027', 1, 'prod_005', 'seller_001', now() - INTERVAL '248 days', 175.00, 16.00),
  ('ord_028', 1, 'prod_001', 'seller_001', now() - INTERVAL '348 days', 440.00, 22.50),
  ('ord_029', 1, 'prod_006', 'seller_003', now() - INTERVAL '258 days', 200.00, 18.00),
  ('ord_030', 1, 'prod_002', 'seller_002', now() - INTERVAL '353 days', 310.00, 30.00),
  ('ord_031', 1, 'prod_004', 'seller_002', now() - INTERVAL '268 days', 215.00, 20.00),
  ('ord_032', 1, 'prod_008', 'seller_004', now() - INTERVAL '358 days', 55.00, 9.00),
  ('ord_033', 1, 'prod_007', 'seller_003', now() - INTERVAL '288 days', 115.00, 14.00),
  ('ord_034', 1, 'prod_003', 'seller_002', now() - INTERVAL '368 days', 75.00, 10.00),
  ('ord_035', 1, 'prod_001', 'seller_001', now() - INTERVAL '2 days',   470.00, 22.50)
ON CONFLICT (order_id, order_item_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- Payments — one per delivered/shipped/processing order. Skip the canceled one.
-- -----------------------------------------------------------------------------
INSERT INTO public.order_payments (order_id, payment_sequential, payment_type, payment_installments, payment_value) VALUES
  ('ord_001', 1, 'credit_card', 6, 667.50),
  ('ord_002', 1, 'credit_card', 4, 350.00),
  ('ord_003', 1, 'boleto',      1, 228.00),
  ('ord_004', 1, 'credit_card', 5, 502.50),
  ('ord_005', 1, 'credit_card', 6, 477.00),
  ('ord_006', 1, 'credit_card', 3, 240.00),
  ('ord_007', 1, 'debit_card',  1, 211.00),
  ('ord_008', 1, 'credit_card', 2, 144.00),
  ('ord_009', 1, 'boleto',      1, 69.00),
  ('ord_010', 1, 'credit_card', 5, 482.50),
  ('ord_011', 1, 'credit_card', 3, 245.00),
  ('ord_012', 1, 'boleto',      1, 233.00),
  ('ord_013', 1, 'credit_card', 4, 370.00),
  ('ord_014', 1, 'credit_card', 2, 139.00),
  ('ord_015', 1, 'voucher',     1, 100.00),
  ('ord_016', 1, 'credit_card', 2, 206.00),
  ('ord_017', 1, 'boleto',      1, 74.00),
  ('ord_018', 1, 'credit_card', 1, 98.00),
  ('ord_019', 1, 'credit_card', 2, 149.00),
  ('ord_020', 1, 'credit_card', 6, 477.50),
  ('ord_021', 1, 'credit_card', 4, 250.00),
  ('ord_022', 1, 'boleto',      1, 223.00),
  ('ord_023', 1, 'credit_card', 4, 335.00),
  ('ord_024', 1, 'boleto',      1, 67.00),
  ('ord_025', 1, 'voucher',     1, 90.00),
  ('ord_026', 1, 'credit_card', 2, 134.00),
  ('ord_027', 1, 'debit_card',  1, 191.00),
  ('ord_028', 1, 'credit_card', 5, 462.50),
  ('ord_029', 1, 'boleto',      1, 218.00),
  ('ord_030', 1, 'credit_card', 4, 340.00),
  ('ord_031', 1, 'credit_card', 3, 235.00),
  ('ord_032', 1, 'boleto',      1, 64.00),
  ('ord_033', 1, 'credit_card', 2, 129.00),
  ('ord_034', 1, 'voucher',     1, 85.00)
ON CONFLICT (order_id, payment_sequential) DO NOTHING;


-- -----------------------------------------------------------------------------
-- Reviews — most orders get one; mix of scores.
-- -----------------------------------------------------------------------------
INSERT INTO public.order_reviews (review_id, order_id, review_score, review_comment_title, review_comment_message, review_creation_date, review_answer_timestamp) VALUES
  ('rev_001', 'ord_001', 5, 'Excelente',     'Chegou rapido e em otimo estado.',  now() - INTERVAL '0 days', now() + INTERVAL '1 day'),
  ('rev_002', 'ord_002', 4, 'Bom produto',   NULL,                                now() - INTERVAL '38 days', now() - INTERVAL '37 days'),
  ('rev_003', 'ord_003', 5, NULL,            NULL,                                now() - INTERVAL '113 days', now() - INTERVAL '112 days'),
  ('rev_004', 'ord_004', 4, NULL,            'Funciona bem.',                     now() - INTERVAL '203 days', now() - INTERVAL '202 days'),
  ('rev_005', 'ord_005', 5, 'Otimo',         'Recomendo!',                        now() - INTERVAL '1 day',  now() + INTERVAL '0 days'),
  ('rev_006', 'ord_006', 5, NULL,            NULL,                                now() - INTERVAL '53 days', now() - INTERVAL '52 days'),
  ('rev_007', 'ord_007', 3, 'Demorou',       'A entrega demorou mais que o estimado.', now() - INTERVAL '143 days', now() - INTERVAL '142 days'),
  ('rev_008', 'ord_008', 4, NULL,            NULL,                                now() - INTERVAL '8 days', now() - INTERVAL '7 days'),
  ('rev_009', 'ord_009', 5, 'Adorei',        NULL,                                now() - INTERVAL '73 days', now() - INTERVAL '72 days'),
  ('rev_010', 'ord_010', 4, NULL,            'Bom custo-beneficio.',              now() - INTERVAL '173 days', now() - INTERVAL '172 days'),
  ('rev_011', 'ord_011', 5, NULL,            NULL,                                now() - INTERVAL '18 days', now() - INTERVAL '17 days'),
  ('rev_012', 'ord_012', 4, NULL,            NULL,                                now() - INTERVAL '88 days', now() - INTERVAL '87 days'),
  ('rev_013', 'ord_013', 3, 'OK',            'Esperava melhor.',                   now() - INTERVAL '23 days', now() - INTERVAL '22 days'),
  ('rev_014', 'ord_014', 5, NULL,            NULL,                                now() - INTERVAL '93 days', now() - INTERVAL '92 days'),
  ('rev_015', 'ord_015', 4, NULL,            NULL,                                now() - INTERVAL '33 days', now() - INTERVAL '32 days'),
  ('rev_016', 'ord_016', 5, NULL,            NULL,                                now() - INTERVAL '103 days', now() - INTERVAL '102 days'),
  ('rev_017', 'ord_017', 5, NULL,            NULL,                                now() - INTERVAL '0 days', now() + INTERVAL '1 day'),
  ('rev_018', 'ord_018', 4, NULL,            NULL,                                now() - INTERVAL '0 days', now() + INTERVAL '1 day'),
  ('rev_019', 'ord_020', 4, NULL,            NULL,                                now() - INTERVAL '3 days', now() - INTERVAL '2 days'),
  ('rev_020', 'ord_021', 5, NULL,            NULL,                                now() - INTERVAL '5 days', now() - INTERVAL '4 days'),
  ('rev_021', 'ord_023', 2, 'Decepcionado',  'Produto chegou com defeito.',       now() - INTERVAL '273 days', now() - INTERVAL '272 days'),
  ('rev_022', 'ord_024', 4, NULL,            NULL,                                now() - INTERVAL '293 days', now() - INTERVAL '292 days'),
  ('rev_023', 'ord_028', 3, NULL,            NULL,                                now() - INTERVAL '343 days', now() - INTERVAL '342 days'),
  ('rev_024', 'ord_032', 5, NULL,            NULL,                                now() - INTERVAL '353 days', now() - INTERVAL '352 days'),
  ('rev_025', 'ord_034', 4, NULL,            NULL,                                now() - INTERVAL '363 days', now() - INTERVAL '362 days')
ON CONFLICT (review_id, order_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- customer_features — RFM per person. Calibrated to produce the four
-- segments cleanly when the (mock) K-Means runs.
-- -----------------------------------------------------------------------------
INSERT INTO public.customer_features (customer_unique_id, recency_days, frequency, monetary, avg_order_value, first_purchase_at, last_purchase_at, total_orders) VALUES
  -- VIP
  ('cu_001', 5,   4, 2199.50, 549.88, now() - INTERVAL '210 days', now() - INTERVAL '5 days',   4),
  ('cu_002', 7,   3, 928.00,  309.33, now() - INTERVAL '150 days', now() - INTERVAL '7 days',   3),
  -- Loyal
  ('cu_003', 15,  3, 552.00,  184.00, now() - INTERVAL '180 days', now() - INTERVAL '15 days',  3),
  ('cu_004', 25,  2, 478.00,  239.00, now() - INTERVAL '95 days',  now() - INTERVAL '25 days',  2),
  ('cu_005', 30,  2, 509.00,  254.50, now() - INTERVAL '100 days', now() - INTERVAL '30 days',  2),
  ('cu_006', 40,  2, 306.00,  153.00, now() - INTERVAL '110 days', now() - INTERVAL '40 days',  2),
  -- New
  ('cu_007', 3,   1, 74.00,   74.00,  now() - INTERVAL '3 days',   now() - INTERVAL '3 days',   1),
  ('cu_008', 6,   1, 98.00,   98.00,  now() - INTERVAL '6 days',   now() - INTERVAL '6 days',   1),
  ('cu_009', 2,   1, 149.00,  149.00, now() - INTERVAL '2 days',   now() - INTERVAL '2 days',   1),
  ('cu_010', 10,  1, 477.50,  477.50, now() - INTERVAL '10 days',  now() - INTERVAL '10 days',  1),
  ('cu_011', 12,  1, 250.00,  250.00, now() - INTERVAL '12 days',  now() - INTERVAL '12 days',  1),
  ('cu_012', 1,   1, 223.00,  223.00, now() - INTERVAL '1 day',    now() - INTERVAL '1 day',    1),
  -- At Risk
  ('cu_013', 280, 1, 335.00,  335.00, now() - INTERVAL '280 days', now() - INTERVAL '280 days', 1),
  ('cu_014', 300, 1, 67.00,   67.00,  now() - INTERVAL '300 days', now() - INTERVAL '300 days', 1),
  ('cu_015', 320, 1, 90.00,   90.00,  now() - INTERVAL '320 days', now() - INTERVAL '320 days', 1),
  ('cu_016', 340, 1, 134.00,  134.00, now() - INTERVAL '340 days', now() - INTERVAL '340 days', 1),
  ('cu_017', 250, 2, 653.50,  326.75, now() - INTERVAL '350 days', now() - INTERVAL '250 days', 2),
  ('cu_018', 260, 2, 558.00,  279.00, now() - INTERVAL '355 days', now() - INTERVAL '260 days', 2),
  ('cu_019', 270, 2, 299.00,  149.50, now() - INTERVAL '360 days', now() - INTERVAL '270 days', 2),
  ('cu_020', 290, 2, 200.00,  100.00, now() - INTERVAL '370 days', now() - INTERVAL '290 days', 2)
ON CONFLICT (customer_unique_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- customer_segments — handpicked labels matching the RFM above.
-- -----------------------------------------------------------------------------
INSERT INTO public.customer_segments (customer_unique_id, cluster_id, segment_label, distance_to_centroid) VALUES
  ('cu_001', 0, 'VIP',     0.12),
  ('cu_002', 0, 'VIP',     0.31),
  ('cu_003', 1, 'Loyal',   0.18),
  ('cu_004', 1, 'Loyal',   0.22),
  ('cu_005', 1, 'Loyal',   0.27),
  ('cu_006', 1, 'Loyal',   0.35),
  ('cu_007', 2, 'New',     0.14),
  ('cu_008', 2, 'New',     0.16),
  ('cu_009', 2, 'New',     0.19),
  ('cu_010', 2, 'New',     0.21),
  ('cu_011', 2, 'New',     0.24),
  ('cu_012', 2, 'New',     0.28),
  ('cu_013', 3, 'At Risk', 0.31),
  ('cu_014', 3, 'At Risk', 0.34),
  ('cu_015', 3, 'At Risk', 0.37),
  ('cu_016', 3, 'At Risk', 0.40),
  ('cu_017', 3, 'At Risk', 0.42),
  ('cu_018', 3, 'At Risk', 0.45),
  ('cu_019', 3, 'At Risk', 0.48),
  ('cu_020', 3, 'At Risk', 0.50)
ON CONFLICT (customer_unique_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- recommendations — top-3 per the six most-active customers.
-- -----------------------------------------------------------------------------
INSERT INTO public.recommendations (customer_unique_id, product_id, rank, score) VALUES
  ('cu_001', 'prod_002', 1, 0.92),
  ('cu_001', 'prod_006', 2, 0.81),
  ('cu_001', 'prod_004', 3, 0.74),
  ('cu_002', 'prod_001', 1, 0.89),
  ('cu_002', 'prod_005', 2, 0.78),
  ('cu_002', 'prod_007', 3, 0.66),
  ('cu_003', 'prod_004', 1, 0.85),
  ('cu_003', 'prod_002', 2, 0.79),
  ('cu_003', 'prod_008', 3, 0.62),
  ('cu_004', 'prod_006', 1, 0.83),
  ('cu_004', 'prod_001', 2, 0.71),
  ('cu_004', 'prod_003', 3, 0.60),
  ('cu_005', 'prod_007', 1, 0.81),
  ('cu_005', 'prod_002', 2, 0.74),
  ('cu_005', 'prod_005', 3, 0.65),
  ('cu_006', 'prod_005', 1, 0.79),
  ('cu_006', 'prod_004', 2, 0.72),
  ('cu_006', 'prod_001', 3, 0.61)
ON CONFLICT (customer_unique_id, rank, generated_at) DO NOTHING;


-- -----------------------------------------------------------------------------
-- product_metrics — derived from the data above (small enough to write by hand).
-- -----------------------------------------------------------------------------
INSERT INTO public.product_metrics (product_id, total_revenue, units_sold, total_orders, avg_review_score, review_count, last_sold_at, inventory_status) VALUES
  ('prod_001', 2755.00, 6, 6, 4.40, 5, now() - INTERVAL '2 days',   'low'),
  ('prod_002', 1925.00, 6, 6, 4.50, 4, now() - INTERVAL '5 days',   'healthy'),
  ('prod_003', 418.00,  5, 5, 4.00, 1, now() - INTERVAL '4 days',   'healthy'),
  ('prod_004', 1115.00, 5, 5, 4.80, 3, now() - INTERVAL '10 days',  'healthy'),
  ('prod_005', 935.00,  5, 5, 3.50, 1, now() - INTERVAL '7 days',   'healthy'),
  ('prod_006', 1045.00, 5, 5, 4.50, 1, now() - INTERVAL '1 day',    'low'),
  ('prod_007', 625.00,  5, 5, 4.50, 1, now() - INTERVAL '2 days',   'healthy'),
  ('prod_008', 313.00,  5, 5, 5.00, 1, now() - INTERVAL '3 days',   'out_of_stock')
ON CONFLICT (product_id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- kpi_snapshots — last 14 days, gentle upward trend.
-- -----------------------------------------------------------------------------
INSERT INTO public.kpi_snapshots (snapshot_date, total_revenue, total_orders, total_customers, active_customers, avg_order_value, repeat_rate) VALUES
  (current_date - 13, 8120.00, 28, 18, 11, 290.00, 0.4400),
  (current_date - 12, 8180.00, 28, 18, 11, 292.14, 0.4400),
  (current_date - 11, 8245.00, 29, 19, 11, 284.31, 0.4500),
  (current_date - 10, 8310.00, 29, 19, 12, 286.55, 0.4500),
  (current_date - 9,  8390.00, 30, 19, 12, 279.67, 0.4500),
  (current_date - 8,  8470.00, 30, 19, 12, 282.33, 0.4600),
  (current_date - 7,  8555.00, 31, 20, 13, 275.97, 0.4600),
  (current_date - 6,  8640.00, 31, 20, 13, 278.71, 0.4700),
  (current_date - 5,  8730.00, 32, 20, 13, 272.81, 0.4700),
  (current_date - 4,  8820.00, 32, 20, 14, 275.63, 0.4700),
  (current_date - 3,  8915.00, 33, 20, 14, 270.15, 0.4800),
  (current_date - 2,  9010.00, 33, 20, 14, 273.03, 0.4800),
  (current_date - 1,  9110.00, 34, 20, 15, 267.94, 0.4800),
  (current_date,      9215.00, 34, 20, 15, 271.03, 0.4900)
ON CONFLICT (snapshot_date) DO NOTHING;


-- -----------------------------------------------------------------------------
-- ml_model_runs — four metrics so MLInsightsPage has all radials populated.
-- -----------------------------------------------------------------------------
INSERT INTO public.ml_model_runs (model_name, metric_name, metric_value, params) VALUES
  ('kmeans',           'silhouette',     0.62, '{"k": 4, "max_iter": 20}'),
  ('als',              'precision_at_10', 0.74, '{"rank": 12, "regParam": 0.1, "maxIter": 15}'),
  ('als',              'rmse',           1.18, '{"rank": 12, "regParam": 0.1, "maxIter": 15}'),
  ('sales_forecast',   'r2',             0.81, '{"model": "linear_regression", "lookback_days": 90}');


-- =============================================================================
-- Done. Open the React app — every chart should now render with real data.
-- =============================================================================
