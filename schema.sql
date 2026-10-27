-- the.pinda.kr 전자책 판매 (핀다AI D1 공유, eb_ 접두어)
CREATE TABLE IF NOT EXISTS eb_orders (
  id TEXT PRIMARY KEY,
  mul_no TEXT,
  email TEXT,
  phone TEXT,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS eb_orders_mul ON eb_orders (mul_no);
CREATE INDEX IF NOT EXISTS eb_orders_contact ON eb_orders (email, phone);
CREATE INDEX IF NOT EXISTS eb_orders_state ON eb_orders (state, created_at);

-- 구매자 후기 (주문 1건당 1개, 관리자가 숨길 수 있음)
CREATE TABLE IF NOT EXISTS eb_reviews (
  order_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stars INTEGER NOT NULL,
  body TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS eb_reviews_visible ON eb_reviews (visible, created_at);
