// snsogg: SNS 공유용 카드형 자동 썸네일(OG 이미지, 1200×630) 디자인
// "링크를 공유했지만 이미지를 공유한 것처럼" 보이게 — 큼직한 글씨 + 배경 그림 + 뒷내용이 흐려지며 끊김 + "이어서 보기"
// satori 노드 트리를 만들고, 렌더링은 @cf-wasm/og 가 함 (Node: render.mjs / Cloudflare Workers: '@cf-wasm/og/workerd')
// 핀다AI 저장소(src/og-card.mjs)의 사본. 디자인을 바꾸면 양쪽을 같이 고치세요

const h = (type, style, ...children) => ({ type, props: { style, children: children.flat().filter(c => c !== null && c !== false && c !== undefined) } });
const img = (src, style) => ({ type: 'img', props: { src, width: 1200, height: 630, style } });

export const cleanText = s => String(s || '').replace(/\*\*|__/g, '').replace(/<[^>]*>/g, '').replace(/[#>`]/g, '').replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s);

// 미리보기로 널리 퍼지므로 생년월일·전화번호·이메일이 든 문장은 뺌
const PRIVATE = /(?:19|20)\d{2}\s*년|\d{4}[-./]\d{1,2}[-./]\d{1,2}|양력|음력|\d{1,2}\s*시\s*\d{0,2}\s*분|오전\s*\d|오후\s*\d|01[016789][-\s]?\d{3,4}[-\s]?\d{4}|[\w.+-]+@[\w-]+\.[\w.]+/;
export function teaser(text, n = 120) {
  const lines = String(text || '').split(/\n+/).map(x => x.trim()).filter(x => x && !/^[📌※]/u.test(x));
  const sentences = cleanText(lines.join(' ')).split(/(?<=[.!?요다])\s+/).filter(s => !PRIVATE.test(s));
  return cut(sentences.join(' '), n);
}

const hashStr = s => [...String(s)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
function rng(seed) { let x = hashStr(seed) || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

// 기본 배경: 글마다 다른 밤하늘 그림(별·별자리 선·달·빛무리)을 SVG로 생성 — 외부 사진 없이, 저작권 걱정 없이
const SKIES = [['#140a2e', '#3b1460', '#7a2160'], ['#0b1233', '#24206a', '#5b2a7a'], ['#1a0b26', '#4a1550', '#8a2a4a'], ['#081a30', '#1d3266', '#4b2a78']];
export function skyArt(seed) {
  const r = rng(seed), [a, b, c] = SKIES[hashStr(seed) % SKIES.length];
  // 빛무리: 흐림 필터 대신 방사형 그라데이션 (Cloudflare Workers 무료 플랜 CPU 한도 안에서 그려지게)
  let gi = 0;
  const glow = (cx, cy, rad, col, op) => { const id = 'r' + gi++; return `<radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity="${op}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient><circle cx="${cx}" cy="${cy}" r="${rad * 1.6}" fill="url(#${id})"/>`; };
  const stars = Array.from({ length: 70 }, () => `<circle cx="${(r() * 1200).toFixed(0)}" cy="${(r() * 630).toFixed(0)}" r="${(r() * 1.8 + 0.4).toFixed(1)}" fill="#fff" opacity="${(r() * 0.6 + 0.25).toFixed(2)}"/>`).join('');
  const pts = Array.from({ length: 6 }, () => [700 + r() * 460, 40 + r() * 300]);
  const mx = 900 + r() * 200, my = 90 + r() * 120;
  const cons = pts.map(([x, y], i) => (i ? `<line x1="${pts[i - 1][0].toFixed(0)}" y1="${pts[i - 1][1].toFixed(0)}" x2="${x.toFixed(0)}" y2="${y.toFixed(0)}" stroke="#fff" stroke-opacity=".28" stroke-width="1.5"/>` : '') + `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="3.2" fill="#fff" opacity=".85"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
<mask id="moon"><rect width="1200" height="630" fill="#000"/><circle cx="${mx.toFixed(0)}" cy="${my.toFixed(0)}" r="46" fill="#fff"/><circle cx="${(mx + 22).toFixed(0)}" cy="${(my - 12).toFixed(0)}" r="42" fill="#000"/></mask></defs>
<rect width="1200" height="630" fill="url(#g)"/>
${glow(200 + r() * 300, 450 + r() * 150, 220, '#c026d3', 0.35)}${glow(800 + r() * 300, 100 + r() * 200, 200, '#6366f1', 0.4)}${glow(500 + r() * 300, 300, 160, '#f472b6', 0.18)}
${stars}${cons}
${glow(mx.toFixed(0), my.toFixed(0), 60, '#fde7ff', 0.25)}<rect width="1200" height="630" fill="#fde7ff" opacity=".92" mask="url(#moon)"/>
</svg>`;
  return 'data:image/svg+xml;base64,' + (typeof Buffer !== 'undefined' ? Buffer.from(svg).toString('base64') : btoa(unescape(encodeURIComponent(svg))));
}

const BASE = { brand: '#f5b8ff', accent: '#e9a8ff', cta: 'linear-gradient(135deg, #a855f7, #db2777)', text: '#ffffff', sub: '#e6dcf5' };

/**
 * @param {object} o
 *  layout   'chat'(질문 + 답변) | 'article'(제목 + 본문 발췌) | 'quote'(큰 문구 한 줄)
 *  brand    왼쪽 위 브랜드명            badge  오른쪽 위 배지(카테고리 등)
 *  answer   chat용 본문(핵심 문장을 큼직하게)   excerpt  article용 본문   quote  quote용   hook  직접 고른 큰 문장(있으면 우선)
 *  question, title  썸네일엔 안 나옴(미리보기 아래 제목으로 나오므로) — 배경 색 시드로만 씀
 *  footerText 왼쪽 아래 문구          cta  버튼 문구(없으면 "결론 바로 보기 →" 등에서 글마다 골라 씀)
 *  bgImage  배경 사진 URL 또는 data URI (없으면 skyArt 밤하늘 그림 자동)
 *  textSize 말풍선 글자 크기(px, 기본 74 — 세 줄에 약 37자). 브랜드를 빼려면 brand·footerText 를 안 주면 됨
 *  theme.bubble / theme.bubbleText  말풍선 배경색·글자색 (기본 흰색·진보라)
 *  theme    { brand, accent, cta, text, sub } 일부만 줘도 됨
 *  privacy  chat 답변은 기본으로 개인정보 문장을 거름(false 로 끔), article 발췌는 true 일 때만 거름
 */
export function cardTree(o) {
  const t = { ...BASE, ...(o.theme || {}) };
  const seed = o.question || o.title || o.quote || '';
  const pick = (s, n) => (o.privacy === false ? cut(cleanText(s), n) : teaser(s, n));
  const shadow = '0 2px 18px rgba(0,0,0,0.55)';
  const root = (...kids) => h('div', { display: 'flex', position: 'relative', width: 1200, height: 630, fontFamily: 'Noto Sans KR', color: t.text, wordBreak: 'keep-all', overflow: 'hidden' },
    img(o.bgImage || skyArt(seed), { position: 'absolute', left: 0, top: 0, width: 1200, height: 630, objectFit: 'cover' }),
    // 글자가 잘 읽히게 왼쪽·아래를 어둡게
    h('div', { display: 'flex', position: 'absolute', left: 0, top: 0, width: 1200, height: 630, backgroundImage: 'linear-gradient(100deg, rgba(10,4,24,0.82) 0%, rgba(10,4,24,0.55) 55%, rgba(10,4,24,0.25) 100%)' }),
    h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', width: 1200, height: 630, padding: '40px 60px 40px' }, ...kids));
  const header = h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
    o.brand ? h('div', { display: 'flex', fontSize: 38, fontWeight: 700, color: t.brand, letterSpacing: -1, textShadow: shadow }, o.brand) : h('div', { display: 'flex' }),   // brand 없으면 비움
    o.badge ? h('div', { display: 'flex', padding: '8px 22px', borderRadius: 999, background: 'rgba(255,255,255,0.14)', border: `2px solid ${t.accent}`, fontSize: 26, fontWeight: 700 }, cut(cleanText(o.badge), 18)) : null);
  const footer = h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
    h('div', { display: 'flex', fontSize: 26, color: t.sub, textShadow: shadow }, o.footerText || ''),
    h('div', { display: 'flex', padding: '16px 36px', borderRadius: 999, background: t.cta, color: '#fff', fontSize: 36, fontWeight: 700, boxShadow: '0 8px 28px rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.35)' }, pickCta(o)));

  if (o.layout === 'quote') {
    return root(header,
      h('div', { display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.25, letterSpacing: -2, textShadow: shadow }, `“${cut(cleanText(o.quote), 34)}”`),
      footer);
  }
  // 미리보기에서 제목(og:title)은 이미지 아래에 따로 나오므로, 썸네일엔 제목·질문 대신 본문 도입부 + 클릭 부르는 버튼.
  // 흰 말풍선 안에 본문 도입부를 진하고 크게 (또렷하게, 끝만 "…"으로 끊김).
  // 단어마다 따로 놓아 띄어쓰기에서만 줄이 바뀜(문장부호가 줄 앞으로 안 떨어짐)
  const hook = text => h('div', { display: 'flex', width: '100%', padding: '34px 46px', borderRadius: 44, borderBottomLeftRadius: 10, background: t.bubble || '#ffffff', boxShadow: '0 12px 40px rgba(0,0,0,0.45)' },
    h('div', { display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', overflow: 'hidden', maxHeight: Math.round(size * 1.32 * 3), width: '100%', fontSize: size, fontWeight: 700, lineHeight: 1.32, letterSpacing: -2.5, color: t.bubbleText || '#1d1030' },
      text.split(' ').filter(Boolean).map(w => h('div', { display: 'flex', marginRight: Math.round(size * 0.26) }, w))));
  const size = o.textSize || 74, n = Math.floor(3 * 1000 / size);   // 말풍선 안 세 줄에 들어갈 만큼만 (74px ≈ 40자), 넘치면 잘림
  const text = o.layout === 'article'
    ? (o.privacy === true ? teaser(o.hook || o.excerpt, n) : cut(cleanText(o.hook || o.excerpt), n))   // 글 발췌는 연도 등이 본문이라 기본은 거르지 않음
    : pick(o.hook || o.answer, n);
  return root(header, hook(text), footer);
}

// 클릭을 부르는 버튼 문구 (cta 를 안 주면 내용 해시로 골라 글마다 다르게)
const CTAS = { chat: ['결론 바로 보기 →', '이유 확인하기 →', '전체 풀이 보기 →', '내 경우도 볼까? →'], article: ['이어서 읽기 →', '핵심 확인하기 →', '정답 보러 가기 →', '자세히 보기 →'] };
export const pickCta = o => o.cta || (CTAS[o.layout === 'article' ? 'article' : 'chat'])[hashStr(o.answer || o.excerpt || o.title || '') % 4];

// 폰트 서브셋(구글 폰트 text=)용: 카드에 실제로 들어가는 글자 모음
export function cardText(tree) {
  let s = '';
  const walk = n => { if (typeof n === 'string' || typeof n === 'number') s += n; else if (n?.props?.children) [].concat(n.props.children).forEach(walk); };
  walk(tree);
  return [...new Set(s + '…→·“”Q.')].join('');
}
