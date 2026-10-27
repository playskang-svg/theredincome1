// 전자책·블로그에 넣는 "화면 재현" 삽화 — 스레드 글, 프로필, 쿠팡파트너스 리포트, 월별 수익 그래프, 하루 루틴표
// 실제 스크린샷(개인정보·저작권 문제)을 쓰지 않고, 화면 구성을 SVG로 다시 그립니다. 캡션에 '재현 예시'를 명시합니다.
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const F = "font-family:Pretendard,'Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif";
const svg = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img">${inner}</svg>`;
// 긴 글을 폭에 맞춰 줄바꿈 (한글 기준 글자 폭 ~0.95em)
function wrap(text, maxChars) {
  const out = []; for (const para of String(text).split('\n')) { let line = '';
    for (const w of para.split(' ')) { if ((line + ' ' + w).trim().length > maxChars && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim(); }
    out.push(line); }
  return out;
}
const lines = (arr, x, y, lh, style) => arr.map((t, i) => `<text x="${x}" y="${y + i * lh}" style="${F};${style}">${esc(t)}</text>`).join('');
const avatar = (x, y, r, hue, initial) => `<circle cx="${x}" cy="${y}" r="${r}" fill="hsl(${hue} 45% 70%)"/><text x="${x}" y="${y + r * 0.38}" text-anchor="middle" style="${F};font-size:${r}px;font-weight:700;fill:#fff">${esc(initial)}</text>`;

// 스레드 글 카드 (옵션: replies 배열, link 댓글 표시)
export function threadsPost({ name = '경희의 살림노트', handle = 'kh_salim', time = '3시간', text = '', likes = 128, replies = 41, reposts = 9, replyText = '', pinned = false }) {
  const body = wrap(text, 30), lh = 30, top = 92;
  const h = top + body.length * lh + 70 + (replyText ? 118 : 0);
  let y = top + body.length * lh + 14;
  let reply = '';
  if (replyText) {
    const rl = wrap(replyText, 29);
    reply = `<line x1="42" y1="${y + 14}" x2="42" y2="${y + 40 + rl.length * 26}" stroke="#d4d4d8" stroke-width="2"/>
    ${avatar(42, y + 56, 16, 20, '경')}<text x="72" y="${y + 50}" style="${F};font-size:15px;font-weight:700;fill:#111">${esc(name)}</text>
    <text x="72" y="${y + 68}" style="${F};font-size:13px;fill:#737373">답글 · 링크는 여기</text>${lines(rl, 72, y + 94, 26, 'font-size:16px;fill:#1f2937')}`;
  }
  return svg(600, h, `<rect width="600" height="${h}" rx="18" fill="#fff"/>
  ${pinned ? `<text x="72" y="30" style="${F};font-size:12px;fill:#737373">📌 고정됨</text>` : ''}
  ${avatar(42, 52, 22, 20, '경')}
  <text x="72" y="${pinned ? 56 : 50}" style="${F};font-size:16px;font-weight:700;fill:#111">${esc(name)}</text><text x="${72 + name.length * 15.5 + 8}" y="${pinned ? 56 : 50}" style="${F};font-size:14px;fill:#737373">${esc(time)}</text>
  ${lines(body, 72, top, lh, 'font-size:17px;fill:#111')}
  <g style="${F};font-size:14px;fill:#404040">
    <text x="72" y="${y}">♡ ${likes}</text><text x="150" y="${y}">💬 ${replies}</text><text x="230" y="${y}">↻ ${reposts}</text><text x="300" y="${y}">↗</text></g>
  ${reply}`);
}

// 스레드 프로필
export function threadsProfile({ name = '경희의 살림노트', handle = 'kh_salim', bio = '', followers = '1,284', topics = [], pinnedTitle = '' }) {
  const b = wrap(bio, 34);
  const h = 280 + b.length * 26 + (topics.length ? 48 : 0);
  let y = 140;
  const bioT = lines(b, 28, y, 26, 'font-size:15.5px;fill:#1f2937'); y += b.length * 26 + 10;
  const chips = topics.map((t, i) => { const x = 28 + i * 0; return ''; }).join('');
  let cx = 28, chipSvg = '';
  for (const t of topics) { const w = t.length * 14 + 26; if (cx + w > 570) break; chipSvg += `<rect x="${cx}" y="${y}" width="${w}" height="30" rx="15" fill="#f4f4f5" stroke="#e4e4e7"/><text x="${cx + w / 2}" y="${y + 20}" text-anchor="middle" style="${F};font-size:13px;fill:#374151">${esc(t)}</text>`; cx += w + 8; }
  if (topics.length) y += 48;
  return svg(600, h, `<rect width="600" height="${h}" rx="18" fill="#fff"/>
  <text x="28" y="56" style="${F};font-size:24px;font-weight:800;fill:#111">${esc(name)}</text>
  <text x="28" y="84" style="${F};font-size:15px;fill:#404040">${esc(handle)} <tspan fill="#9ca3af">threads.net</tspan></text>
  ${avatar(540, 64, 34, 20, '경')}
  ${bioT}${chipSvg}
  <text x="28" y="${y + 14}" style="${F};font-size:14px;fill:#737373">팔로워 ${esc(followers)}명</text>
  <rect x="28" y="${y + 34}" width="262" height="42" rx="10" fill="#fff" stroke="#d4d4d8"/><text x="159" y="${y + 61}" text-anchor="middle" style="${F};font-size:15px;font-weight:600;fill:#111">프로필 편집</text>
  <rect x="310" y="${y + 34}" width="262" height="42" rx="10" fill="#fff" stroke="#d4d4d8"/><text x="441" y="${y + 61}" text-anchor="middle" style="${F};font-size:15px;font-weight:600;fill:#111">프로필 공유</text>
  ${pinnedTitle ? `<text x="28" y="${y + 112}" style="${F};font-size:12px;fill:#737373">📌 고정된 스레드</text><text x="28" y="${y + 136}" style="${F};font-size:15px;fill:#111">${esc(pinnedTitle)}</text>` : ''}`);
}

// 쿠팡파트너스 실적 리포트 (구성 재현)
export function partnersReport({ month = '2026년 3월', clicks = 4210, orders = 97, sales = '3,184,200', commission = '95,526', rate = '3.0%', rows = [] }) {
  const h = 330 + rows.length * 38;
  const kpi = (x, label, v) => `<rect x="${x}" y="78" width="178" height="86" rx="12" fill="#fff" stroke="#e5e7eb"/><text x="${x + 16}" y="106" style="${F};font-size:13px;fill:#6b7280">${esc(label)}</text><text x="${x + 16}" y="146" style="${F};font-size:24px;font-weight:800;fill:#111">${esc(v)}</text>`;
  const tr = rows.map((r, i) => { const y = 262 + i * 38; return `<line x1="24" y1="${y + 26}" x2="776" y2="${y + 26}" stroke="#f1f5f9"/><text x="32" y="${y + 10}" style="${F};font-size:14px;fill:#111">${esc(r[0])}</text><text x="480" y="${y + 10}" text-anchor="end" style="${F};font-size:14px;fill:#374151">${esc(r[1])}</text><text x="620" y="${y + 10}" text-anchor="end" style="${F};font-size:14px;fill:#374151">${esc(r[2])}</text><text x="768" y="${y + 10}" text-anchor="end" style="${F};font-size:14px;font-weight:700;fill:#0f766e">${esc(r[3])}</text>`; }).join('');
  return svg(800, h, `<rect width="800" height="${h}" rx="18" fill="#f8fafc"/>
  <rect width="800" height="56" rx="18" fill="#fff"/><rect y="40" width="800" height="16" fill="#fff"/><line x1="0" y1="56" x2="800" y2="56" stroke="#e5e7eb"/>
  <text x="24" y="36" style="${F};font-size:17px;font-weight:800;fill:#111">파트너스 · 실적 리포트</text><text x="776" y="36" text-anchor="end" style="${F};font-size:14px;fill:#6b7280">${esc(month)} · 기본 수수료 ${esc(rate)}</text>
  ${kpi(24, '클릭 수', clicks.toLocaleString('ko-KR'))}${kpi(214, '구매 건수', orders.toLocaleString('ko-KR'))}${kpi(404, '구매 금액', sales + '원')}${kpi(594, '수수료(예상)', commission + '원')}
  <text x="24" y="226" style="${F};font-size:14px;font-weight:700;fill:#111">카테고리별</text>
  <g style="${F};font-size:12px;fill:#6b7280"><text x="32" y="250">카테고리</text><text x="480" y="250" text-anchor="end">클릭</text><text x="620" y="250" text-anchor="end">구매</text><text x="768" y="250" text-anchor="end">수수료</text></g>
  ${tr}
  <text x="24" y="${h - 16}" style="${F};font-size:11.5px;fill:#9ca3af">* 화면 구성을 재현한 예시 이미지입니다. 수치는 책 속 이야기 기준이며 실제 리포트 화면·수수료율은 쿠팡파트너스에서 확인하세요.</text>`);
}

// 월별 수익 막대 그래프
export function monthlyBars({ title = '8개월 수수료 흐름 (원)', data = [] }) {
  const W = 800, H = 380, L = 70, B = 70, T = 60, R = 24;
  const max = Math.max(...data.map(d => d[1])) * 1.15;
  const bw = (W - L - R) / data.length;
  const bars = data.map(([m, v, note], i) => { const x = L + i * bw + bw * 0.18, bh = (v / max) * (H - T - B), y = H - B - bh;
    return `<rect x="${x}" y="${y}" width="${bw * 0.64}" height="${bh}" rx="7" fill="${i === data.length - 1 ? '#c2410c' : '#1f5f4a'}" opacity="${0.55 + 0.45 * (i / (data.length - 1))}"/>
    <text x="${x + bw * 0.32}" y="${y - 8}" text-anchor="middle" style="${F};font-size:13px;font-weight:700;fill:#111">${v.toLocaleString('ko-KR')}</text>
    <text x="${x + bw * 0.32}" y="${H - B + 22}" text-anchor="middle" style="${F};font-size:13px;fill:#374151">${esc(m)}</text>
    ${note ? `<text x="${x + bw * 0.32}" y="${H - B + 42}" text-anchor="middle" style="${F};font-size:11px;fill:#9ca3af">${esc(note)}</text>` : ''}`; }).join('');
  return svg(W, H, `<rect width="${W}" height="${H}" rx="18" fill="#fff"/><text x="24" y="36" style="${F};font-size:16px;font-weight:800;fill:#111">${esc(title)}</text>
  <line x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}" stroke="#e5e7eb"/>${bars}
  <text x="24" y="${H - 14}" style="${F};font-size:11.5px;fill:#9ca3af">* 책 속 한 사람의 기록을 재구성한 수치. 결과는 사람과 시기마다 다릅니다.</text>`);
}

// 하루 루틴표
export function routine({ title = '월 100만 원이 된 달의 하루 (1시간 20분)', items = [] }) {
  const H = 90 + items.length * 54;
  const rows = items.map(([time, what, min], i) => { const y = 78 + i * 54; return `<rect x="24" y="${y}" width="752" height="44" rx="10" fill="${i % 2 ? '#fff' : '#f8fafc'}" stroke="#eef2f7"/>
    <text x="40" y="${y + 28}" style="${F};font-size:15px;font-weight:700;fill:#1f5f4a">${esc(time)}</text><text x="170" y="${y + 28}" style="${F};font-size:15px;fill:#111">${esc(what)}</text><text x="760" y="${y + 28}" text-anchor="end" style="${F};font-size:13px;fill:#6b7280">${esc(min)}</text>`; }).join('');
  return svg(800, H, `<rect width="800" height="${H}" rx="18" fill="#fff"/><text x="24" y="40" style="${F};font-size:16px;font-weight:800;fill:#111">${esc(title)}</text>${rows}`);
}

// 카카오톡/문자 식 수수료 정산 알림
export function notice({ title = '쿠팡파트너스', lines: ls = [], time = '오전 10:02' }) {
  const h = 70 + ls.length * 28 + 30;
  return svg(600, h, `<rect width="600" height="${h}" rx="18" fill="#f1f5f9"/><rect x="18" y="18" width="564" height="${h - 36}" rx="14" fill="#fff"/>
  <rect x="34" y="34" width="34" height="34" rx="9" fill="#e11d48"/><text x="51" y="58" text-anchor="middle" style="${F};font-size:16px;font-weight:800;fill:#fff">C</text>
  <text x="80" y="52" style="${F};font-size:14px;font-weight:700;fill:#111">${esc(title)}</text><text x="566" y="52" text-anchor="end" style="${F};font-size:12px;fill:#9ca3af">${esc(time)}</text>
  ${lines(ls, 80, 82, 28, 'font-size:15px;fill:#1f2937')}`);
}

export const MOCKS = { threadsPost, threadsProfile, partnersReport, monthlyBars, routine, notice };

// 본문 안의 [[mock:이름 {json}]] 토큰을 SVG figure로 바꿈. 캡션은 json.caption
export function renderMocks(html) {
  return html.replace(/\[\[mock:(\w+)\s*(\{[\s\S]*?\})?\s*\]\]/g, (_, name, js) => {
    const fn = MOCKS[name]; if (!fn) return `<!-- unknown mock ${name} -->`;
    let o = {}; try { o = js ? JSON.parse(js) : {}; } catch (e) { throw new Error(`mock ${name} JSON 오류: ${e.message}\n${js}`); }
    const cap = o.caption || '화면 구성을 재현한 예시 이미지';
    return `<figure class="mock">${fn(o)}<figcaption>${esc(cap)}</figcaption></figure>`;
  });
}
