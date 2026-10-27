// the.pinda.kr — 전자책 판매 Worker
// 핀다AI(src/worker.js)의 페이앱 결제 구조를 그대로 가져와, 로그인 없이 "주문 → 결제 → 열람 링크" 흐름으로 줄였습니다.
//  - 결제 확정은 페이앱 서버가 보내는 feedback(/api/pay/feedback)에서만 합니다.
//  - 열람 권한은 (1) 주문 때 심은 서명 쿠키, (2) 주문별 열람 토큰(t=), (3) 이메일·휴대폰 복구 중 하나로 확인합니다.
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { BOOK, BRAND, SITE, priceNow, PRICE_STEPS, SEED_REVIEWS } from './config.js';
import { CHAPTERS, BUILT } from './book.generated.mjs';
import { readerPage } from './reader.js';

/* ---------- 설정 ---------- */
const HOST = 'the.pinda.kr';
function config(env, url) {
  const BASE_URL = (url && url.hostname === HOST ? `https://${HOST}` : (env.BASE_URL || SITE)).replace(/\/$/, '');
  const PAYAPP = { userId: env.PAYAPP_USER_ID, linkKey: env.PAYAPP_LINK_KEY, linkVal: env.PAYAPP_LINK_VAL, apiKey: env.PAYAPP_API_KEY, endpoint: 'https://api.payapp.kr/oapi/v2' };
  PAYAPP.enabled = !!(PAYAPP.userId && PAYAPP.linkKey && PAYAPP.linkVal);
  return {
    env, BASE_URL, SECURE: BASE_URL.startsWith('https://'),
    PAY_ON: env.PAYMENT_ENABLED === 'true',
    PAYAPP, SECRET: env.SESSION_SECRET || 'dev-only-secret-change-me',
    ADMIN: env.ADMIN_PASSWORD || '',
    BIZ: { type: env.BIZ_TYPE === 'business' ? 'business' : 'individual', name: env.BIZ_NAME || '', ceo: env.BIZ_CEO || '', regNo: env.BIZ_REG_NO || '',
      mailOrderNo: env.BIZ_MAIL_ORDER_NO || '', address: env.BIZ_ADDRESS || '', phone: env.BIZ_PHONE || '', email: env.BIZ_EMAIL || '' },
  };
}

/* ---------- 저장소 (D1, eb_ 접두어) ---------- */
const parse = row => row ? JSON.parse(row.data) : null;
const db = d1 => ({
  order: async id => parse(await d1.prepare('SELECT data FROM eb_orders WHERE id = ?').bind(id).first()),
  orderByMul: async mul => parse(await d1.prepare('SELECT data FROM eb_orders WHERE mul_no = ?').bind(mul).first()),
  ordersByContact: async (email, phone) => (await d1.prepare("SELECT data FROM eb_orders WHERE email = ? AND phone = ? AND state = 'paid' ORDER BY created_at DESC LIMIT 5").bind(email, phone).all()).results.map(parse),
  saveOrder: o => d1.prepare('INSERT OR REPLACE INTO eb_orders (id, mul_no, email, phone, state, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(o.id, o.mulNo || null, o.email, o.phone, o.state, o.createdAt, JSON.stringify(o)).run(),
  soldCount: async () => (await d1.prepare("SELECT COUNT(*) AS n FROM eb_orders WHERE state = 'paid' AND COALESCE(json_extract(data, '$.mock'), 0) = 0").first())?.n || 0,
  reviews: async () => (await d1.prepare('SELECT order_id, name, stars, body, created_at FROM eb_reviews WHERE visible = 1 ORDER BY created_at DESC LIMIT 60').all()).results,
  review: id => d1.prepare('SELECT * FROM eb_reviews WHERE order_id = ?').bind(id).first(),
  saveReview: r => d1.prepare('INSERT OR REPLACE INTO eb_reviews (order_id, name, stars, body, visible, created_at) VALUES (?, ?, ?, ?, 1, ?)')
    .bind(r.orderId, r.name, r.stars, r.body, new Date().toISOString()).run(),
  setReviewVisible: (id, v) => d1.prepare('UPDATE eb_reviews SET visible = ? WHERE order_id = ?').bind(v ? 1 : 0, id).run(),
  adminStats: async () => {
    const [sum, recent, reviews] = await d1.batch([
      d1.prepare(`SELECT COUNT(*) AS paid_n, COALESCE(SUM(json_extract(data, '$.price')), 0) AS paid_amt,
        SUM(CASE WHEN state = 'requested' THEN 1 ELSE 0 END) AS wait_n, SUM(CASE WHEN state = 'canceled' THEN 1 ELSE 0 END) AS cancel_n
        FROM eb_orders WHERE COALESCE(json_extract(data, '$.mock'), 0) = 0 AND state IN ('paid','requested','canceled')`),
      d1.prepare(`SELECT id, email, phone, state, created_at, json_extract(data, '$.price') AS price, json_extract(data, '$.paidAt') AS paid_at,
        json_extract(data, '$.openedAt') AS opened_at, json_extract(data, '$.payType') AS pay_type, json_extract(data, '$.mock') AS mock FROM eb_orders ORDER BY created_at DESC LIMIT 200`),
      d1.prepare('SELECT order_id, name, stars, body, visible, created_at FROM eb_reviews ORDER BY created_at DESC LIMIT 200'),
    ]);
    return { sum: sum.results[0], orders: recent.results, reviews: reviews.results };
  },
});

/* ---------- 서명 · 쿠키 ---------- */
const b64u = b => Buffer.from(b).toString('base64url');
const hmac = (c, s) => crypto.createHmac('sha256', c.SECRET).update(s).digest('base64url');
const sign = (c, obj) => { const p = b64u(JSON.stringify(obj)); return `${p}.${hmac(c, p)}`; };
function verify(c, token) {
  if (!token || !token.includes('.')) return null;
  const [p, s] = token.split('.');
  const good = hmac(c, p);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url')); return o.exp && o.exp < Date.now() ? null : o; } catch { return null; }
}
const cookies = req => Object.fromEntries((req.headers.get('cookie') || '').split(';').filter(Boolean).map(x => {
  const i = x.indexOf('='); return [x.slice(0, i).trim(), decodeURIComponent(x.slice(i + 1).trim())];
}));
const COOKIE_DAYS = 365;
const cookie = (c, name, val, maxAgeSec) => `${name}=${encodeURIComponent(val)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${c.SECURE ? '; Secure' : ''}`;
// 이 브라우저가 가진 주문 id 목록 (최근 5개)
const myOrders = (c, req) => (verify(c, cookies(req).eb_acc) || {}).o || [];
const accCookie = (c, ids) => cookie(c, 'eb_acc', sign(c, { o: [...new Set(ids)].slice(-5), exp: Date.now() + COOKIE_DAYS * 864e5 }), COOKIE_DAYS * 86400);
// 주문별 열람 토큰: 다른 기기에서 링크만으로 열 수 있게 (주문 데이터에 저장)
const tokenOk = (o, t) => !!(o && t && o.token && t.length === o.token.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(o.token)));
const canRead = (c, req, o, t) => !!o && (tokenOk(o, t) || myOrders(c, req).includes(o.id));

/* ---------- 페이앱 결제 (핀다AI와 같은 구조) ---------- */
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const normalizePhone = p => String(p || '').replace(/\D/g, '');
const normalizeEmail = e => String(e || '').trim().toLowerCase();
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 120;
const phoneOk = p => /^01[016789]\d{7,8}$/.test(p);

async function payappRequest(c, order) {
  const r = await fetch(c.PAYAPP.endpoint, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
    body: new URLSearchParams({
      cmd: 'payrequest', userid: c.PAYAPP.userId,
      goodname: `전자책 ${BOOK.short}`, price: String(order.price), recvphone: order.phone,
      memo: `${BRAND} 전자책 (${order.email})`,
      smsuse: 'n',
      feedbackurl: `${c.BASE_URL}/api/pay/feedback`,
      returnurl: `${c.BASE_URL}/pay/return`,
      var1: order.id, var2: order.email,
      checkretry: 'y',
    }),
  });
  const res = Object.fromEntries(new URLSearchParams(await r.text()));
  if (res.state !== '1' || !res.payurl) throw new Error(res.errorMessage || '결제창을 여는 데 실패했습니다. 잠시 뒤 다시 시도해 주세요.');
  return res;
}
function verifyFeedback(c, f, order) {
  const P = c.PAYAPP;
  if (f.userid !== P.userId) return 'userid';
  if (f.linkkey !== P.linkKey) return 'linkkey';
  if (f.linkval !== P.linkVal) return 'linkval';
  if (P.apiKey && f.hash && f.hash.toLowerCase() !== sha256(f.userid + f.responsedate + P.apiKey)) return 'hash';
  if (!order) return 'order';
  if (Number(f.price) !== order.price) return 'price';
  return null;
}
const mockPayPage = o => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>테스트 결제</title>
<body style="font-family:sans-serif;background:#f6f1ea;display:grid;place-items:center;height:100vh;margin:0">
<form method="post" action="/pay/mock/${o.id}/complete" style="background:#fff;padding:28px;border-radius:16px;width:min(360px,90vw);text-align:center;box-shadow:0 8px 30px #0002">
<div style="font-size:12px;color:#71717b;margin-bottom:8px">페이앱 키가 없어 표시되는 테스트 결제창</div>
<h2 style="margin:0 0 6px;font-size:17px">${esc(BOOK.title)}</h2><div style="font-size:22px;font-weight:700;margin-bottom:20px">${o.price.toLocaleString()}원</div>
<button style="width:100%;height:48px;border:0;border-radius:10px;background:#1f5f4a;color:#fff;font-size:15px;font-weight:600">결제 완료(테스트)</button>
<a href="/pay/mock/${o.id}/cancel" style="display:block;margin-top:12px;font-size:13px;color:#71717b">취소하고 돌아가기</a></form>`;

/* ---------- HTTP 도구 ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function mkHeaders(base, extra) { const h = new Headers(base); for (const [k, v] of Object.entries(extra || {})) for (const x of [].concat(v)) h.append(k, x); return h; }
const json = (code, obj, headers = {}) => new Response(JSON.stringify(obj), { status: code, headers: mkHeaders({ 'content-type': 'application/json', 'cache-control': 'no-store' }, headers) });
const html = (code, body, headers = {}) => new Response(body, { status: code, headers: mkHeaders({ 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, headers) });
const text = (code, body) => new Response(body, { status: code, headers: { 'content-type': 'text/plain; charset=utf-8' } });
const redirect = (to, headers = {}) => new Response(null, { status: 302, headers: mkHeaders({ location: to }, headers) });
async function readBody(req, max = 2e4) {
  const raw = await req.text();
  if (raw.length > max) throw Object.assign(new Error('too large'), { code: 413 });
  if ((req.headers.get('content-type') || '').includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(raw));
  return raw ? JSON.parse(raw) : {};
}
// 아주 단순한 속도 제한 (isolate 메모리, 최선 노력). 복구·후기·주문 생성 남용 방지
const hits = new Map();
function rateLimited(key, limit = 20, windowMs = 10 * 60e3) {
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > limit;
}
const ip = req => req.headers.get('cf-connecting-ip') || '0';
const publicOrder = (c, o) => ({ id: o.id, state: o.state, price: o.price, paidAt: o.paidAt || null, openedAt: o.openedAt || null,
  readUrl: o.state === 'paid' ? `${c.BASE_URL}/read?o=${o.id}&t=${o.token}` : null, mock: !!o.mock, email: o.email });

/* ---------- API ---------- */
async function handleApi(c, store, req, url) {
  const p = url.pathname, m = req.method;

  if (m === 'GET' && p === '/api/price') {
    const sold = await store.soldCount().catch(() => 0);
    return json(200, { ...priceNow(), steps: PRICE_STEPS, sold, payEnabled: c.PAY_ON, built: BUILT, biz: c.BIZ }, { 'cache-control': 'public, max-age=60' });
  }

  if (m === 'GET' && p === '/api/reviews') {
    const rows = await store.reviews().catch(() => []);
    const real = rows.map(r => ({ name: r.name, stars: r.stars, body: r.body, at: r.created_at.slice(0, 10), verified: true }));
    return json(200, { reviews: [...real, ...SEED_REVIEWS.map(r => ({ ...r, verified: false }))].slice(0, 60), realCount: real.length }, { 'cache-control': 'public, max-age=120' });
  }

  // 주문 생성 → 결제창 주소
  if (m === 'POST' && p === '/api/order') {
    if (!c.PAY_ON) return json(403, { error: '지금은 판매를 잠시 쉬고 있어요. 곧 다시 열겠습니다.' });
    if (rateLimited('order:' + ip(req), 10)) return json(429, { error: '요청이 너무 잦아요. 잠시 뒤 다시 시도해 주세요.' });
    const b = await readBody(req);
    const email = normalizeEmail(b.email), phone = normalizePhone(b.phone);
    if (!emailOk(email)) return json(400, { error: '이메일 주소를 확인해 주세요. 열람 링크를 다시 찾을 때 필요해요.' });
    if (!phoneOk(phone)) return json(400, { error: '휴대폰 번호를 확인해 주세요. (예: 01012345678)' });
    if (!b.agree) return json(400, { error: '디지털 콘텐츠 환불 안내에 동의해 주세요.' });
    const pr = priceNow();
    const order = { id: crypto.randomUUID(), token: crypto.randomBytes(18).toString('hex'), bookId: BOOK.id, email, phone,
      price: pr.price, priceLabel: pr.label, state: 'requested', createdAt: new Date().toISOString(), ua: (req.headers.get('user-agent') || '').slice(0, 160), country: req.headers.get('cf-ipcountry') || null };
    try {
      if (c.PAYAPP.enabled) { const r = await payappRequest(c, order); order.mulNo = r.mul_no; order.payurl = r.payurl; }
      else { order.mock = true; order.payurl = `/pay/mock/${order.id}`; }
      await store.saveOrder(order);
      return json(200, { orderId: order.id, payurl: order.payurl, mock: !!order.mock, price: order.price }, { 'set-cookie': accCookie(c, [...myOrders(c, req), order.id]) });
    } catch (e) { console.error('[payapp] 결제요청 실패:', e.message); return json(502, { error: e.message }); }
  }

  const oid = p.match(/^\/api\/order\/([0-9a-f-]{36})$/);
  if (m === 'GET' && oid) {
    const o = await store.order(oid[1]);
    if (!canRead(c, req, o, url.searchParams.get('t'))) return json(404, { error: 'not_found' });
    return json(200, { order: publicOrder(c, o) });
  }

  // 페이앱 결제결과 통보 (서버→서버). 여러 번 올 수 있으므로 멱등하게, 반드시 'SUCCESS'
  if (m === 'POST' && p === '/api/pay/feedback') {
    const f = await readBody(req);
    const order = (f.var1 && await store.order(f.var1)) || (f.mul_no && await store.orderByMul(f.mul_no));
    const bad = verifyFeedback(c, f, order);
    if (bad) { console.error('[payapp] feedback 검증 실패:', bad, f.mul_no); return text(400, 'FAIL'); }
    const state = String(f.pay_state);
    order.mulNo = order.mulNo || f.mul_no; order.payType = f.pay_type; order.lastState = state; order.lastFeedbackAt = new Date().toISOString();
    if (state === '4' && order.state !== 'paid') { order.state = 'paid'; order.paidAt = new Date().toISOString(); }
    else if (['8', '9', '16', '31', '32', '64'].includes(state)) { order.state = 'canceled'; order.canceledAt = new Date().toISOString(); order.cancelMemo = f.cancelmemo || ''; }
    else if (['70', '71'].includes(state)) { order.partialCancel = true; }
    else if (state === '10') { order.state = 'pending'; }      // 가상계좌 입금 대기
    await store.saveOrder(order);
    return text(200, 'SUCCESS');
  }

  // 열람 링크 복구: 결제 때 쓴 이메일 + 휴대폰
  if (m === 'POST' && p === '/api/recover') {
    if (rateLimited('recover:' + ip(req), 8)) return json(429, { error: '시도가 너무 잦아요. 10분 뒤 다시 해 주세요.' });
    const b = await readBody(req);
    const email = normalizeEmail(b.email), phone = normalizePhone(b.phone);
    if (!emailOk(email) || !phoneOk(phone)) return json(400, { error: '결제 때 입력한 이메일과 휴대폰 번호를 그대로 넣어 주세요.' });
    const list = await store.ordersByContact(email, phone);
    if (!list.length) return json(404, { error: '결제 완료된 주문을 찾지 못했어요. 입력한 정보가 결제 때와 같은지 확인해 주세요.' });
    return json(200, { orders: list.map(o => publicOrder(c, o)) }, { 'set-cookie': accCookie(c, [...myOrders(c, req), ...list.map(o => o.id)]) });
  }

  // 구매자 후기 (주문당 1개)
  if (m === 'POST' && p === '/api/review') {
    if (rateLimited('review:' + ip(req), 10)) return json(429, { error: '잠시 뒤 다시 시도해 주세요.' });
    const b = await readBody(req);
    const o = await store.order(String(b.orderId || ''));
    if (!canRead(c, req, o, b.token) || o.state !== 'paid') return json(403, { error: '구매하신 분만 후기를 남길 수 있어요.' });
    const stars = Math.min(5, Math.max(1, Number(b.stars) | 0));
    const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 24) || '익명';
    const body = String(b.body || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    if (body.length < 10) return json(400, { error: '후기는 10자 이상 적어 주세요.' });
    if (/https?:\/\/|www\./i.test(body)) return json(400, { error: '후기에는 링크를 넣을 수 없어요.' });
    await store.saveReview({ orderId: o.id, name, stars, body });
    return json(200, { ok: true });
  }

  // 관리자
  if (p.startsWith('/api/admin/')) {
    if (!c.ADMIN || req.headers.get('x-admin-pw') !== c.ADMIN) return json(401, { error: 'unauthorized' });
    if (m === 'GET' && p === '/api/admin/stats') return json(200, await store.adminStats());
    if (m === 'POST' && p === '/api/admin/review') { const b = await readBody(req); await store.setReviewVisible(String(b.orderId), !!b.visible); return json(200, { ok: true }); }
  }

  return json(404, { error: 'not_found' });
}

/* ---------- 관리자 화면 ---------- */
const ADMIN_PAGE = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>관리 · ${esc(BRAND)}</title>
<style>body{margin:0;font-family:system-ui,sans-serif;background:#f6f1ea;color:#1c1917;font-size:14px}.wrap{max-width:1100px;margin:0 auto;padding:20px 14px}
h1{font-size:20px}h2{font-size:15px;margin:22px 0 8px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.card{background:#fff;border:1px solid #e7e0d6;border-radius:12px;padding:14px}
.card b{display:block;font-size:20px}.card span{color:#78716c;font-size:12px}.tbl{background:#fff;border:1px solid #e7e0d6;border-radius:12px;overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}
th,td{padding:8px 10px;border-bottom:1px solid #eee;text-align:left}th{font-size:12px;color:#78716c}form{max-width:320px;margin:18vh auto;background:#fff;border:1px solid #e7e0d6;border-radius:14px;padding:24px;display:grid;gap:12px}
input{height:42px;border:1px solid #d6cfc4;border-radius:10px;padding:0 12px;font:inherit}button{height:36px;border:0;border-radius:9px;background:#1f5f4a;color:#fff;font:inherit;font-weight:600;padding:0 12px;cursor:pointer}
.ghost{background:#fff;color:#78716c;border:1px solid #d6cfc4;height:28px;font-size:12px}#err{color:#b91c1c;min-height:18px}</style>
<div class="wrap" id="app"></div>
<script>
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const kst=iso=>iso?new Date(iso).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'-';
let pw=sessionStorage.getItem('pw')||'';
async function api(m,u,b){const r=await fetch(u,{method:m,headers:{'x-admin-pw':pw,'content-type':'application/json'},body:b?JSON.stringify(b):undefined});if(r.status===401)throw new Error('비밀번호가 다릅니다');return r.json()}
function login(){$('#app').innerHTML='<form onsubmit="return go(event)"><h1>관리</h1><input type="password" id="pw" placeholder="ADMIN_PASSWORD" autofocus><button>들어가기</button><div id="err"></div></form>'}
window.go=async e=>{e.preventDefault();pw=$('#pw').value;try{await load();sessionStorage.setItem('pw',pw)}catch(x){$('#err').textContent=x.message}return false};
async function load(){const d=await api('GET','/api/admin/stats');const won=n=>(Number(n)||0).toLocaleString('ko-KR')+'원';const s=d.sum||{};
$('#app').innerHTML='<h1>${esc(BRAND)} 주문·후기</h1><div class="cards">'+[['결제 완료',s.paid_n+'건',won(s.paid_amt)],['결제 대기',s.wait_n+'건','요청 후 미완료'],['취소',s.cancel_n+'건','']].map(x=>'<div class="card"><span>'+x[0]+'</span><b>'+x[1]+'</b><span>'+x[2]+'</span></div>').join('')+'</div>'
+'<h2>최근 주문 (200건)</h2><div class="tbl"><table><tr><th>시각</th><th>이메일</th><th>휴대폰</th><th>금액</th><th>상태</th><th>결제</th><th>열람</th></tr>'+(d.orders||[]).map(o=>'<tr><td>'+kst(o.paid_at||o.created_at)+'</td><td>'+esc(o.email)+'</td><td>'+esc(o.phone)+'</td><td>'+won(o.price)+'</td><td>'+esc(o.state)+(o.mock?' (테스트)':'')+'</td><td>'+esc(o.pay_type||'-')+'</td><td>'+kst(o.opened_at)+'</td></tr>').join('')+'</table></div>'
+'<h2>후기</h2><div class="tbl"><table><tr><th>시각</th><th>이름</th><th>별점</th><th>내용</th><th></th></tr>'+(d.reviews||[]).map(r=>'<tr style="opacity:'+(r.visible?1:.45)+'"><td>'+kst(r.created_at)+'</td><td>'+esc(r.name)+'</td><td>'+'★'.repeat(r.stars)+'</td><td style="white-space:normal;max-width:480px">'+esc(r.body)+'</td><td><button class="ghost" onclick="tog(\\''+r.order_id+'\\','+(r.visible?0:1)+')">'+(r.visible?'숨기기':'보이기')+'</button></td></tr>').join('')+'</table></div>'}
window.tog=async(id,v)=>{await api('POST','/api/admin/review',{orderId:id,visible:!!v});load()};
pw?load().catch(login):login();
</script></html>`;

/* ---------- 진입 ---------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const c = config(env, url);
    const store = db(env.DB);
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(c, store, req, url);

      if (url.pathname === '/admin' || url.pathname === '/admin/') {
        if (!c.ADMIN) return text(404, 'Not found');
        return html(200, ADMIN_PAGE, { 'x-robots-tag': 'noindex' });
      }

      // 결제 후 페이앱이 돌려보내는 주소 (GET/POST). 이 브라우저의 최근 주문으로 감사 페이지 이동
      if (url.pathname === '/pay/return') {
        const ids = myOrders(c, req);
        return redirect(ids.length ? `/thanks?o=${ids[ids.length - 1]}` : '/recover');
      }

      // 테스트 결제 (페이앱 키가 없을 때만)
      const mock = url.pathname.match(/^\/pay\/mock\/([0-9a-f-]{36})(?:\/(complete|cancel))?$/);
      if (mock && c.PAY_ON && !c.PAYAPP.enabled) {
        const o = await store.order(mock[1]);
        if (!o?.mock || !myOrders(c, req).includes(o.id)) return text(404, 'Not found');
        if (!mock[2]) return html(200, mockPayPage(o));
        if (mock[2] === 'complete' && req.method === 'POST' && o.state !== 'paid') { o.state = 'paid'; o.paidAt = new Date().toISOString(); o.payType = 'mock'; await store.saveOrder(o); }
        if (mock[2] === 'cancel') { o.state = 'canceled'; o.canceledAt = new Date().toISOString(); await store.saveOrder(o); }
        return redirect('/pay/return');
      }

      // 전자책 본문 (결제 완료 주문만). 토큰 링크로 왔으면 이 브라우저에도 권한 쿠키를 심어 다음엔 /read 만으로 열림
      if (url.pathname === '/read' || url.pathname === '/read/') {
        const t = url.searchParams.get('t');
        let id = url.searchParams.get('o');
        const mine = myOrders(c, req);
        if (!id) {   // 주문 번호 없이 왔으면 이 브라우저의 결제 완료 주문 중 최신
          for (const x of [...mine].reverse()) { const o = await store.order(x); if (o?.state === 'paid') { id = x; break; } }
          if (!id) return redirect('/recover');
        }
        const o = await store.order(id);
        if (!canRead(c, req, o, t)) return redirect('/recover?e=denied');
        if (o.state !== 'paid') return redirect(`/thanks?o=${o.id}`);
        const headers = {};
        if (!mine.includes(o.id)) headers['set-cookie'] = accCookie(c, [...mine, o.id]);
        if (!o.openedAt) { o.openedAt = new Date().toISOString(); await store.saveOrder(o); }   // 환불 기준(열람 시작) 기록
        return html(200, readerPage({ chapters: CHAPTERS, order: o, biz: c.BIZ, base: c.BASE_URL }), { ...headers, 'x-robots-tag': 'noindex, nofollow' });
      }

      return env.ASSETS.fetch(req);
    } catch (e) {
      console.error(e);
      if (url.pathname.startsWith('/api/')) return json(e.code === 413 ? 413 : 500, { error: e.message });
      return text(500, '잠시 문제가 생겼어요. 새로고침해 주세요.');
    }
  },
};
