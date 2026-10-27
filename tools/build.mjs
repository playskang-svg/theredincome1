// the.pinda.kr 정적 빌드: 전자책 본문 → src/book.generated.mjs, 랜딩·블로그·안내 페이지 → public/
// 실행 (저장소 루트에서): node the/tools/build.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { SITE, BRAND, PUBLISHER, BOOK, PRICE_STEPS, FREE_CHAPTERS, TEASE_CHAPTER, SEED_REVIEWS, FAQ, priceNow } from '../src/config.js';
import { renderMocks, monthlyBars } from './mocks.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const BOOK_SRC = path.join(ROOT, 'content', 'book');
const BLOG_SRC = path.join(ROOT, 'content', 'blog');
const OUT = path.join(ROOT, 'public');
const today = new Date().toISOString().slice(0, 10);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripTags = s => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const won = n => n.toLocaleString('ko-KR') + '원';
const hash = s => crypto.createHash('sha256').update(s).digest();

/* ---------- 프론트매터 ---------- */
async function readDocs(dir) {
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.md')).sort();
  const out = [];
  for (const f of files) {
    const raw = await fs.readFile(path.join(dir, f), 'utf8');
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!m) { console.warn('frontmatter 없음:', f); continue; }
    const fm = {};
    for (const line of m[1].split(/\r?\n/)) { const kv = line.match(/^([a-zA-Z]+):\s*(.*)$/); if (kv) fm[kv[1]] = kv[2].trim().replace(/^["'](.*)["']$/, '$1'); }
    for (const k of ['hook', 'thread', 'reply', 'kakao']) if (fm[k]) fm[k] = fm[k].replace(/\\n/g, '\n');   // 공유용 문구는 \n 으로 줄바꿈
    out.push({ slug: f.replace(/\.md$/, ''), fm, body: m[2].trim() });
  }
  return out;
}

/* ---------- 전자책 → book.generated.mjs ---------- */
function teaseOf(html) {
  // 앞부분 45%쯤에서 문단 경계로 끊음
  const parts = html.split(/(?<=<\/p>|<\/h3>|<\/table>|<\/ul>)/);
  const total = stripTags(html).length; let acc = 0, i = 0;
  for (; i < parts.length; i++) { acc += stripTags(parts[i]).length; if (acc > total * 0.45) break; }
  return parts.slice(0, i + 1).join('');
}
async function buildBook() {
  const docs = await readDocs(BOOK_SRC);
  const chapters = docs.map(d => {
    const html = renderMocks(d.body);
    const free = FREE_CHAPTERS.includes(d.slug), tease = d.slug === TEASE_CHAPTER;
    return { id: d.slug, num: d.fm.num ? Number(d.fm.num) : null, kind: d.fm.kind || null, title: d.fm.title, html, free, tease, chars: stripTags(d.body).length, teaseHtml: tease ? teaseOf(html) : null };
  });
  const totalChars = chapters.reduce((a, c) => a + c.chars, 0);
  const src = `// 자동 생성 (node the/tools/build.mjs) — 직접 고치지 말고 content/book/*.md 를 고치세요\n`
    + `export const BUILT = ${JSON.stringify(new Date().toISOString())};\nexport const TOTAL_CHARS = ${totalChars};\n`
    + `export const CHAPTERS = ${JSON.stringify(chapters.map(({ teaseHtml, ...c }) => c))};\n`;
  await fs.writeFile(path.join(ROOT, 'src', 'book.generated.mjs'), src);
  console.log(`전자책: ${chapters.length}장, 본문 ${totalChars.toLocaleString()}자`);
  return { chapters, totalChars };
}

/* ---------- 공통 디자인 ---------- */
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{--paper:#faf6ef;--paper2:#f1e9dc;--card:#fff;--ink:#1f1b16;--ink2:#4a433b;--muted:#857b70;--line:#e6ddd0;--green:#1f5f4a;--green2:#2b7a60;--orange:#c2410c;--gold:#b7791f;--hl:#fff3c4;--shadow:0 10px 30px #3b2a1a14}
@media (prefers-color-scheme:dark){:root{--paper:#17150f;--paper2:#1f1c15;--card:#211e17;--ink:#f3ede3;--ink2:#d6cdbf;--muted:#9c9385;--line:#2f2a21;--green:#5fbf98;--green2:#7dd3b0;--orange:#fb923c;--gold:#e0a84a;--hl:#3a3119;--shadow:0 10px 30px #0006}}
html{scroll-behavior:smooth}
body{background:var(--paper);color:var(--ink);font-family:Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif;line-height:1.75;font-size:16px;-webkit-text-size-adjust:100%;word-break:keep-all}
a{color:var(--green);text-decoration:none}a:hover{text-decoration:underline}
img,svg{max-width:100%;height:auto;display:block}
.serif{font-family:'Noto Serif KR',Pretendard,serif}
.wrap{max-width:1040px;margin:0 auto;padding:0 18px}.narrow{max-width:740px;margin:0 auto;padding:0 18px}
header.site{position:sticky;top:0;z-index:30;background:color-mix(in srgb,var(--paper) 90%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
header.site .wrap{display:flex;align-items:center;gap:8px;height:58px}
.logo{font-family:'Noto Serif KR',serif;font-weight:900;font-size:20px;color:var(--ink);letter-spacing:-.02em;white-space:nowrap}
.logo i{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--orange);margin-right:7px;vertical-align:2px}
nav.site{display:flex;gap:2px;margin-left:auto;align-items:center;overflow-x:auto;scrollbar-width:none}nav.site::-webkit-scrollbar{display:none}
nav.site a{color:var(--ink2);font-size:14px;font-weight:600;padding:7px 10px;border-radius:9px;white-space:nowrap}nav.site a:hover{background:var(--paper2);text-decoration:none}
nav.site a.cta{background:var(--green);color:#fff;padding:8px 14px}
@media (max-width:480px){nav.site a{font-size:13px;padding:7px 7px}nav.site a.cta{padding:8px 11px}nav.site a:first-child{display:none}}
main{padding:26px 0 70px}
h1,h2,h3{letter-spacing:-.015em;line-height:1.3}
h2.sec{font-family:'Noto Serif KR',serif;font-size:clamp(23px,4.2vw,32px);margin:0 0 10px}
.eyebrow{font-size:13px;font-weight:800;color:var(--orange);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}
.sub{color:var(--ink2);font-size:17px;max-width:620px}
section.blk{padding:54px 0}section.blk.alt{background:var(--paper2)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:52px;padding:0 24px;border-radius:14px;background:var(--green);color:#fff;font-weight:800;font-size:16px;border:0;cursor:pointer;font-family:inherit;box-shadow:0 8px 22px #1f5f4a40;transition:transform .12s}
.btn:hover{transform:translateY(-2px);text-decoration:none}.btn.ghost{background:var(--card);color:var(--ink);border:1px solid var(--line);box-shadow:none}
.btn.big{height:60px;font-size:18px;padding:0 32px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:var(--shadow)}
.grid2{display:grid;gap:16px;grid-template-columns:1fr}@media(min-width:720px){.grid2{grid-template-columns:1fr 1fr}}
.grid3{display:grid;gap:16px;grid-template-columns:1fr}@media(min-width:720px){.grid3{grid-template-columns:repeat(3,1fr)}}
footer.site{border-top:1px solid var(--line);padding:30px 0 100px;font-size:13px;color:var(--muted)}
footer.site .links{display:flex;flex-wrap:wrap;gap:6px 14px;margin-bottom:12px}footer.site a{color:var(--muted)}
footer.site .biz{line-height:1.7}
.fine{font-size:12.5px;color:var(--muted);line-height:1.6}
mark{background:var(--hl);color:inherit;padding:0 .15em;border-radius:3px}
/* 가격 상자 */
.price{background:var(--card);border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.price .tag{display:inline-block;font-size:12.5px;font-weight:800;color:var(--orange);background:#c2410c14;border-radius:8px;padding:4px 9px;margin-bottom:10px}
.price .now{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.price .now b{font-size:42px;font-weight:900;letter-spacing:-.03em;line-height:1}
.price .now s{color:var(--muted);font-size:17px}.price .now em{font-style:normal;color:var(--orange);font-weight:800;font-size:15px}
.price .next{margin-top:12px;padding:12px 14px;border-radius:12px;background:var(--paper2);font-size:14px;color:var(--ink2)}
.price .next b{color:var(--ink)}
.cd{display:flex;gap:6px;margin-top:8px;font-variant-numeric:tabular-nums}.cd span{flex:1;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 4px;font-size:13px;color:var(--muted)}
.cd span b{display:block;font-size:22px;color:var(--ink);font-weight:900;line-height:1.1}
.price .btn{width:100%;margin-top:14px}
.price .meta{margin-top:10px;font-size:12.5px;color:var(--muted);text-align:center}
.sold{font-size:13px;color:var(--ink2);margin-top:8px;text-align:center;min-height:18px}
/* 퍼가기 세트 */
.kit{margin:34px 0;padding:22px;border:1px solid var(--line);border-radius:18px;background:var(--card)}
.kit h2{font-size:19px;margin:0 0 4px}.kit>p{font-size:14px;color:var(--muted);margin:0 0 16px}
.kit .row{display:grid;gap:14px;grid-template-columns:1fr;align-items:start}@media(min-width:720px){.kit .row{grid-template-columns:1fr 1fr}}
.kit .sq{display:block;border-radius:14px;border:1px solid var(--line);overflow:hidden;background:#143d31}.kit .sq img{width:100%;aspect-ratio:1}
.kit .item{position:relative;margin-bottom:12px}.kit .item b{display:block;font-size:12.5px;color:var(--orange);margin-bottom:5px;letter-spacing:.04em}
.kit pre{white-space:pre-wrap;word-break:keep-all;font:inherit;font-size:14.5px;line-height:1.65;color:var(--ink2);background:var(--paper2);border-radius:12px;padding:12px 14px;padding-right:72px;margin:0}
.kit .cp{position:absolute;right:8px;top:26px;height:30px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink2);font:inherit;font-size:12px;padding:0 10px;cursor:pointer}
.kit .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.kit .acts a,.kit .acts button{display:inline-flex;align-items:center;height:38px;padding:0 14px;border-radius:19px;border:1px solid var(--line);background:var(--card);color:var(--ink2);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
.kit .acts .kakao{background:#FEE500;border-color:#FEE500;color:#191600}.kit .acts .th{background:#111;border-color:#111;color:#fff}
/* 하단 고정 바 */
.bar{position:fixed;left:0;right:0;bottom:0;z-index:40;background:color-mix(in srgb,var(--card) 94%,transparent);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:10px 14px calc(10px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:12px;transform:translateY(110%);transition:transform .25s}
.bar.on{transform:none}.bar .p{line-height:1.2}.bar .p b{font-size:20px;font-weight:900}.bar .p small{display:block;color:var(--orange);font-size:12px;font-weight:700}
.bar .btn{margin-left:auto;height:46px;padding:0 20px;font-size:15px}
/* 모달 */
.modal{position:fixed;inset:0;z-index:60;background:#0008;display:none;align-items:flex-end;justify-content:center;padding:0}
@media(min-width:600px){.modal{align-items:center;padding:20px}}
.modal.on{display:flex}
.modal .box{background:var(--card);width:100%;max-width:460px;border-radius:22px 22px 0 0;padding:24px 22px 28px;max-height:92vh;overflow:auto}
@media(min-width:600px){.modal .box{border-radius:22px}}
.modal h3{font-size:19px;margin-bottom:4px}.modal .hint{font-size:13.5px;color:var(--muted);margin-bottom:16px}
.modal label{display:block;font-size:13px;color:var(--ink2);font-weight:700;margin:12px 0 5px}
.modal input[type=email],.modal input[type=tel]{width:100%;height:48px;border:1px solid var(--line);border-radius:12px;padding:0 14px;font:inherit;font-size:16px;background:var(--paper);color:var(--ink)}
.modal .chk{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;color:var(--ink2);margin-top:14px;line-height:1.55}.modal .chk input{margin-top:4px;width:18px;height:18px}
.modal .btn{width:100%;margin-top:16px}.modal .err{color:#b91c1c;font-size:13px;min-height:18px;margin-top:8px}
.modal .close{float:right;border:0;background:transparent;font-size:22px;cursor:pointer;color:var(--muted)}
.modal .sum{display:flex;justify-content:space-between;align-items:baseline;background:var(--paper2);border-radius:12px;padding:12px 14px;font-size:14px}.modal .sum b{font-size:22px;font-weight:900}
`;
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">`;
const FAVICON = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f5f4a"/><circle cx="32" cy="30" r="13" fill="none" stroke="#faf6ef" stroke-width="5"/><rect x="18" y="46" width="28" height="5" rx="2.5" fill="#fb923c"/></svg>')}`;

// SNS 공유 썸네일(OG). 글마다 다른 따뜻한 배경 위에 큰 글씨 (핀다AI의 og-card 모듈 재사용)
const OG_DIR = path.join(OUT, 'og');
const ogQueue = new Map();
function ogBg(seed) {
  const h = hash(seed); const r = () => h[(i++) % h.length] / 255; let i = 0;
  const hue = 150 + r() * 20;
  const circles = Array.from({ length: 5 }, () => `<circle cx="${(0.3 + r() * 0.65) * 1200}" cy="${(0.1 + r() * 0.8) * 630}" r="${120 + r() * 220}" fill="none" stroke="#fb923c" stroke-opacity="${(0.12 + r() * 0.25).toFixed(2)}" stroke-width="${8 + r() * 26}"/>`).join('');
  const dots = Array.from({ length: 40 }, () => `<circle cx="${r() * 1200}" cy="${r() * 630}" r="${1 + r() * 2.5}" fill="#fff" opacity="${(0.1 + r() * 0.3).toFixed(2)}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 45% 14%)"/><stop offset="1" stop-color="hsl(${hue + 15} 40% 26%)"/></linearGradient></defs><rect width="1200" height="630" fill="url(#g)"/>${circles}${dots}</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
function ogImage({ title, excerpt, badge, cta }) {
  const name = hash(JSON.stringify([title, excerpt, badge, cta, 'the-v1'])).toString('hex').slice(0, 12);
  ogQueue.set(name, { layout: 'article', excerpt, hook: excerpt, title, badge, cta, bgImage: ogBg(title), privacy: false,
    theme: { brand: '#fde68a', accent: '#fdba74', cta: 'linear-gradient(135deg,#f97316,#c2410c)', bubble: '#fffaf0', bubbleText: '#1c2a24' } });
  return `${SITE}/og/${name}.png`;
}
// 정사각 공유 카드(1080×1080): 스레드·인스타그램에 이미지로 올리는 용도. 큰 글씨 한 문장 + 작은 출처
const CARD_DIR = path.join(OUT, 'card');
const cardQueue = new Map();
const hh = (type, style, ...children) => ({ type, props: { style, children: children.flat().filter(c => c !== null && c !== false && c !== undefined) } });
function squareTree({ hook, badge, footer = 'the.pinda.kr', cta = '자세한 글은 첫 답글에 →' }) {
  const words = hook.split(' ').filter(Boolean).map(w => hh('div', { display: 'flex', marginRight: 22 }, w));
  return hh('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 1080, height: 1080, padding: '84px 84px 80px', backgroundImage: 'linear-gradient(160deg, #143d31 0%, #1f5f4a 100%)', color: '#faf6ef', fontFamily: 'Noto Sans KR', wordBreak: 'keep-all' },
    hh('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
      hh('div', { display: 'flex', alignItems: 'center', fontSize: 32, fontWeight: 700, color: '#fdba74' }, hh('div', { display: 'flex', width: 16, height: 16, borderRadius: 8, background: '#fb923c', marginRight: 12 }), BRAND),
      hh('div', { display: 'flex', fontSize: 26, padding: '10px 26px', borderRadius: 999, border: '2px solid rgba(253,186,116,0.8)', color: '#fde68a' }, badge)),
    hh('div', { display: 'flex', flexWrap: 'wrap', fontSize: 76, fontWeight: 700, lineHeight: 1.32, letterSpacing: -2.5 }, ...words),
    hh('div', { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
      hh('div', { display: 'flex', fontSize: 28, color: '#d9e8e1' }, footer),
      hh('div', { display: 'flex', fontSize: 30, fontWeight: 700, padding: '16px 34px', borderRadius: 999, backgroundImage: 'linear-gradient(135deg, #f97316, #c2410c)', color: '#fff' }, cta)));
}
function squareCard(o) {
  const name = hash(JSON.stringify([o.hook, o.badge, o.cta, 'sq-v1'])).toString('hex').slice(0, 12);
  cardQueue.set(name, o);
  return `/card/${name}.png`;
}
async function renderOg() {
  await fs.mkdir(OG_DIR, { recursive: true }); await fs.mkdir(CARD_DIR, { recursive: true });
  const have = new Set(await fs.readdir(OG_DIR)), haveCard = new Set(await fs.readdir(CARD_DIR));
  const todo = [...ogQueue].filter(([n]) => !have.has(`${n}.png`)), todoCard = [...cardQueue].filter(([n]) => !haveCard.has(`${n}.png`));
  if (!todo.length && !todoCard.length) { console.log(`공유 썸네일: ${ogQueue.size}장, 정사각 카드 ${cardQueue.size}장 (변경 없음)`); return; }
  try {
    const { ImageResponse, GoogleFont } = await import('@cf-wasm/og/node');
    const { cardTree, cardText } = await import('../src/og-card.mjs');
    const render = async (tree, w, h, file) => {
      const text = cardText(tree);
      const res = await ImageResponse.async(tree, { width: w, height: h, emoji: 'twemoji',
        fonts: [new GoogleFont('Noto Sans KR', { weight: 400, text }), new GoogleFont('Noto Sans KR', { weight: 700, text })] });
      await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    };
    for (const [name, o] of todo) await render(cardTree(o), 1200, 630, path.join(OG_DIR, `${name}.png`));
    for (const [name, o] of todoCard) await render(squareTree(o), 1080, 1080, path.join(CARD_DIR, `${name}.png`));
    for (const f of have) if (f.endsWith('.png') && !ogQueue.has(f.slice(0, -4))) await fs.rm(path.join(OG_DIR, f));
    for (const f of haveCard) if (f.endsWith('.png') && !cardQueue.has(f.slice(0, -4))) await fs.rm(path.join(CARD_DIR, f));
    console.log(`공유 썸네일: ${ogQueue.size}장 (새로 ${todo.length}장), 정사각 카드 ${cardQueue.size}장 (새로 ${todoCard.length}장)`);
  } catch (e) { console.warn('공유 이미지 생성 실패 (네트워크/폰트). 기존 파일 유지:', e.message); }
}

function layout({ title, desc, url, body, jsonld = [], image, keywords = [], ogBadge = BRAND, extraHead = '', noindex = false, bar = true }) {
  image = image || ogImage({ title: title.replace(/\s*[-|·]\s*더 핀다.*$/, ''), excerpt: desc, badge: ogBadge });
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${keywords.length ? `<meta name="keywords" content="${esc(keywords.join(', '))}">` : ''}
${noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow,max-image-preview:large">'}
<link rel="canonical" href="${url}">
<meta property="og:type" content="${url.includes('/blog/') && !url.endsWith('/blog/') ? 'article' : 'website'}"><meta property="og:site_name" content="${esc(BRAND)}"><meta property="og:locale" content="ko_KR">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${image}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}">
<meta name="theme-color" content="#1f5f4a">
<link rel="icon" href="${FAVICON}">
<link rel="alternate" type="application/rss+xml" title="${esc(BRAND)} 블로그" href="${SITE}/blog/rss.xml">
${FONTS}
<style>${CSS}</style>
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
${extraHead}
</head>
<body>
<header class="site"><div class="wrap">
  <a class="logo" href="/"><i></i>${esc(BRAND)}</a>
  <nav class="site"><a href="/#story">책 소개</a><a href="/#preview">미리보기</a><a href="/blog/category/info">정보</a><a href="/blog/category/knowhow">노하우</a><a href="/#price" class="cta">구매하기</a></nav>
</div></header>
<main>${body}</main>
<footer class="site"><div class="wrap">
  <div class="links"><a href="/">홈</a><a href="/blog/">블로그</a><a href="/recover">열람 링크 찾기</a><a href="/terms">이용약관</a><a href="/privacy">개인정보처리방침</a><a href="/refund">환불 규정</a><a href="https://pinda.kr" rel="noopener">핀다AI</a></div>
  <div class="biz" id="biz">${esc(BRAND)} · 운영 ${esc(PUBLISHER)}</div>
  <p class="fine" style="margin-top:10px">이 책의 이야기는 실제 경험들을 바탕으로 가명·재구성했으며, 화면 이미지는 구성을 재현한 예시입니다. 수익은 개인과 시기에 따라 다르며 보장되지 않습니다. 쿠팡파트너스·스레드의 정책과 세금·건강보험 기준은 바뀔 수 있으니 본문에 안내한 공식 경로에서 확인하세요.</p>
</div></footer>
${bar ? `<div class="bar" id="bar"><div class="p"><b id="barPrice"></b><small id="barNext"></small></div><a class="btn" href="/#price" id="barBtn">지금 가격으로 읽기</a></div>` : ''}
<script>
(function(){
  var STEPS=${JSON.stringify(PRICE_STEPS)},LIST=${BOOK.listPrice};
  function kst(d){return Date.parse(d+'T00:00:00Z')-9*3600e3}
  function now(){var t=Date.now(),cur=STEPS[0],next=null;for(var i=0;i<STEPS.length;i++){if(kst(STEPS[i].from)<=t)cur=STEPS[i];else{next=STEPS[i];break}}return{cur:cur,next:next,at:next?kst(next.from):null}}
  var w=function(n){return n.toLocaleString('ko-KR')+'원'};
  window.__price=now;window.__won=w;
  function tick(){var p=now();var bp=document.getElementById('barPrice'),bn=document.getElementById('barNext');if(bp){bp.textContent=w(p.cur.price);bn.textContent=p.next?(p.next.from.slice(5).replace('-','/')+'부터 '+w(p.next.price)+'으로 인상'):'정가'}
    document.querySelectorAll('[data-price]').forEach(function(e){e.textContent=w(p.cur.price)});document.querySelectorAll('[data-list]').forEach(function(e){e.textContent=w(LIST)});
    document.querySelectorAll('[data-off]').forEach(function(e){e.textContent=Math.round((1-p.cur.price/LIST)*100)+'%'});
    document.querySelectorAll('[data-nextprice]').forEach(function(e){e.textContent=p.next?w(p.next.price):w(LIST)});document.querySelectorAll('[data-nextdate]').forEach(function(e){e.textContent=p.next?p.next.from.replace(/-/g,'.'):''});
    document.querySelectorAll('[data-label]').forEach(function(e){e.textContent=p.cur.label});
    document.querySelectorAll('.cd').forEach(function(c){if(!p.at){c.innerHTML='<span><b>정가</b>마지막 가격</span>';return}var ms=Math.max(0,p.at-Date.now()),d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4),s=Math.floor(ms%6e4/1e3);c.innerHTML='<span><b>'+d+'</b>일</span><span><b>'+h+'</b>시간</span><span><b>'+m+'</b>분</span><span><b>'+s+'</b>초</span>'})}
  tick();setInterval(tick,1000);
  var bar=document.getElementById('bar');if(bar){addEventListener('scroll',function(){var pr=document.getElementById('price');var hide=pr&&pr.getBoundingClientRect().top<innerHeight&&pr.getBoundingClientRect().bottom>0;bar.classList.toggle('on',scrollY>500&&!hide)},{passive:true})}
  fetch('/api/price').then(function(r){return r.json()}).then(function(d){var b=d.biz||{};var el=document.getElementById('biz');if(el&&b.name){el.innerHTML=(b.type==='business'?'상호 '+b.name+(b.ceo?' · 대표 '+b.ceo:'')+(b.regNo?' · 사업자등록번호 '+b.regNo:'')+(b.mailOrderNo?' · 통신판매업신고 '+b.mailOrderNo:''):'판매자 '+b.name)+(b.address?'<br>'+b.address:'')+(b.phone?' · '+b.phone:'')+(b.email?' · '+b.email:'')}
    if(d.sold>=10)document.querySelectorAll('.sold').forEach(function(e){e.textContent='지금까지 '+d.sold.toLocaleString('ko-KR')+'명이 이 가격 또는 그 이하로 읽었어요'})}).catch(function(){});
})();
</script>
</body></html>`;
}

/* ---------- 랜딩 ---------- */
const stars = n => '<span style="color:#f59e0b;letter-spacing:1px">' + '★'.repeat(n) + '</span><span style="color:#d6cfc4;letter-spacing:1px">' + '★'.repeat(5 - n) + '</span>';
const reviewCard = r => `<div class="card rv"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><b style="font-size:14.5px">${esc(r.name)}</b><span style="font-size:14px">${stars(r.stars)}</span></div><p style="font-size:14.5px;color:var(--ink2);line-height:1.7">${esc(r.body)}</p>${r.verified ? '<div class="fine" style="margin-top:8px;color:var(--green)">✓ 구매 확인된 후기</div>' : '<div class="fine" style="margin-top:8px">사전 독자 · 가명</div>'}</div>`;

const priceBox = (id = 'price') => `<div class="price" id="${id}">
  <span class="tag" data-label></span>
  <div class="now"><b data-price></b><s data-list></s><em><span data-off></span> 할인</em></div>
  <div class="next"><b data-nextdate></b>부터 <b data-nextprice></b>으로 오릅니다. 다음 인상까지<div class="cd"></div></div>
  <button class="btn big js-buy">이 가격으로 바로 읽기</button>
  <div class="sold"></div>
  <div class="meta">카드·간편결제 · 결제 즉시 열람 · 미열람 7일 내 전액 환불 · 개정판 평생 무료</div>
</div>`;

async function buildLanding({ chapters, totalChars }) {
  const url = `${SITE}/`;
  const pr = priceNow();
  const free = chapters.filter(c => c.free);
  const toc = chapters.map(c => `<li class="${c.free ? 'free' : ''}"><span class="n">${c.num ? `제${c.num}장` : esc(c.kind)}</span><span class="t">${esc(c.title)}</span><span class="s">${c.free ? (c.tease ? '일부 무료' : '무료') : '🔒'}</span></li>`).join('');
  const previewHtml = free.map(c => `<article class="pv" id="pv-${c.id}"><div class="num">${c.num ? `제${c.num}장` : esc(c.kind)}</div><h3 class="serif">${esc(c.title)}</h3>${c.tease ? `<div class="tease">${c.teaseHtml}<div class="fade"></div></div>` : c.html}</article>`).join('');
  const bars = monthlyBars({ title: '경희 씨의 8개월, 월별 수수료 (원)', data: [['2월', 0, '가입 전'], ['3월', 11840, ''], ['4월', 46300, ''], ['5월', 118900, '블로그 시작'], ['6월', 312400, ''], ['7월', 486200, ''], ['8월', 731000, '정지 9일'], ['9월', 1043600, '추석']] });
  const gets = [
    ['글 틀 5개 + 예문 20개', '첫 줄에 상품 이름 없이, 단점 하나, 질문으로 끝. 복사 버튼 눌러 내 물건으로 바꿔 쓰면 됩니다.'],
    ['첫 30일 체크리스트', '0일차부터 30일차까지 날짜순. 메모장에 붙이고 하루 한 줄씩 지우세요.'],
    ['하루 1시간 20분 시간표', '7시 10분 답글부터 밤 9시 40분까지. 월 100만 원이 된 달의 실제 하루.'],
    ['화면 재현 이미지 9장', '스레드 글·프로필, 파트너스 리포트, 입금 알림. 어디를 눌러야 하는지 보이게.'],
    ['대가성 문구·금지 표현 모음', '공정위 규정에 맞는 문구와 "쓰지 않는 표현 → 대신 쓰는 표현" 표. 계정 안 멈추게.'],
    ['소재 60개 + 시즌 달력', '쓸 게 없는 날을 위한 첫 줄 60개, 그리고 2주 먼저 올려야 하는 계절 품목표.'],
  ];
  const pains = [
    ['밤 10시 반, 식탁에서 계산기를 두드리는 분', '적금을 깼고 다음 달엔 깰 적금이 없다는 걸 아는 밤. 경희 씨도 2월 14일에 그랬습니다.'],
    ['"50대 주부 재택 부업" 검색이 지겨운 분', '나오는 건 29만 원 먼저 내라는 글과 차로 40분 가는 포장 알바. 이 책의 방법은 가입비 0원입니다.'],
    ['스마트폰은 쓰지만 컴퓨터는 무서운 분', '경희 씨는 가입부터 100만 원까지 스마트폰으로만 했습니다. 안경만 한 번 바꿔 썼습니다.'],
    ['제휴마케팅 글은 다 20대 얘기 같다는 분', '이 책의 주인공은 쉰 살이고, 독자 중 가장 많이 산 사람들도 50대였습니다.'],
  ];
  const faqHtml = FAQ.map(([q, a]) => `<details class="faq"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('');
  const steps = PRICE_STEPS.map(s => `<tr class="${s.from === pr.from ? 'cur' : ''}"><td>${esc(s.label)}</td><td>${s.from.replace(/-/g, '.')}부터</td><td><b>${won(s.price)}</b></td><td>${s.from === pr.from ? '<span class="now">지금</span>' : (Date.parse(s.from) < Date.now() ? '종료' : '예정')}</td></tr>`).join('');

  const extraCss = `<style>
.hero{padding:40px 0 30px}.hero .wrap{display:grid;gap:26px;grid-template-columns:1fr}
@media(min-width:900px){.hero .wrap{grid-template-columns:1.15fr .85fr;align-items:center}.hero{padding:56px 0 40px}}
.hero h1{font-family:'Noto Serif KR',serif;font-size:clamp(28px,5.4vw,46px);line-height:1.25;letter-spacing:-.025em;margin:10px 0 16px}
.hero h1 em{font-style:normal;color:var(--orange)}
.hero .trust{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}.hero .trust span{font-size:12.5px;font-weight:700;color:var(--ink2);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:5px 11px}
.cover{position:relative;margin:0 auto 18px;width:min(260px,70%);aspect-ratio:3/4.2;border-radius:10px 16px 16px 10px;background:linear-gradient(160deg,#1f5f4a,#143d31);box-shadow:16px 18px 40px #1f5f4a40,inset 8px 0 0 #0003;padding:26px 20px;color:#faf6ef;display:flex;flex-direction:column;justify-content:space-between}
.cover .k{font-size:11px;letter-spacing:.14em;color:#fdba74;font-weight:800}.cover h2{font-family:'Noto Serif KR',serif;font-size:22px;line-height:1.35;font-weight:900;margin-top:10px}
.cover .cup{width:64px;height:64px;border-radius:50%;border:6px solid #faf6ef;position:relative;margin-top:14px}.cover .cup:after{content:'';position:absolute;right:-18px;top:14px;width:16px;height:22px;border:5px solid #faf6ef;border-left:0;border-radius:0 12px 12px 0}
.cover .a{font-size:12px;color:#d9e8e1}
.pain{display:grid;gap:14px;grid-template-columns:1fr}@media(min-width:720px){.pain{grid-template-columns:1fr 1fr}}
.pain .card b{display:block;font-size:16.5px;margin-bottom:6px}.pain .card p{font-size:14.5px;color:var(--ink2)}
.stats{display:grid;gap:12px;grid-template-columns:repeat(3,1fr);margin:18px 0}.stats div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 10px;text-align:center}
.stats b{display:block;font-size:clamp(17px,3.6vw,26px);font-weight:900;letter-spacing:-.02em}.stats span{font-size:12px;color:var(--muted)}
.toc{list-style:none;background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden}
.toc li{display:grid;grid-template-columns:64px 1fr auto;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line);font-size:15px}
.toc li:last-child{border-bottom:0}.toc .n{font-size:12px;font-weight:800;color:var(--muted)}.toc .s{font-size:12px;color:var(--muted)}.toc li.free .s{color:var(--green);font-weight:800}
.pv{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px 22px;margin-bottom:18px;font-family:'Noto Serif KR',serif;line-height:1.9}
.pv .num{font-family:Pretendard,sans-serif;font-size:12px;font-weight:800;color:var(--orange);letter-spacing:.06em}.pv h3{font-size:clamp(20px,4vw,26px);margin:6px 0 18px}
.pv p{margin:0 0 1.1em;color:var(--ink2)}.pv h3+p{margin-top:0}.pv blockquote{margin:1.2em 0;padding:12px 16px;background:var(--paper2);border-left:3px solid var(--orange);border-radius:0 10px 10px 0}
.pv table{width:100%;border-collapse:collapse;font-family:Pretendard,sans-serif;font-size:14px;margin:0 0 1.2em}.pv th,.pv td{border:1px solid var(--line);padding:8px 10px;text-align:left}.pv th{background:var(--paper2)}
.pv figure.mock{margin:1.4em 0}.pv figure.mock svg{border:1px solid var(--line);border-radius:14px;background:#fff}.pv figcaption{font-family:Pretendard,sans-serif;font-size:12.5px;color:var(--muted);text-align:center;margin-top:8px}
.pv .tease{position:relative;max-height:520px;overflow:hidden}.pv .fade{position:absolute;left:0;right:0;bottom:0;height:260px;background:linear-gradient(to bottom,transparent,var(--card) 75%)}
.lock{text-align:center;margin-top:-40px;position:relative;z-index:2}.lock p{color:var(--ink2);font-size:15px;margin:12px 0 14px}
.gets .card b{display:block;font-size:16px;margin-bottom:6px}.gets .card p{font-size:14px;color:var(--ink2)}.gets .card i{display:block;width:34px;height:4px;border-radius:2px;background:var(--orange);margin-bottom:12px}
.rvs{display:grid;gap:14px;grid-template-columns:1fr}@media(min-width:720px){.rvs{grid-template-columns:1fr 1fr}}@media(min-width:1000px){.rvs{grid-template-columns:1fr 1fr 1fr}}
.steps{width:100%;border-collapse:collapse;font-size:14.5px;background:var(--card);border-radius:14px;overflow:hidden;border:1px solid var(--line)}.steps td{padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap}.steps td:first-child{font-weight:700}.steps tr:last-child td{border-bottom:0}
.steps tr.cur td{background:var(--hl)}@media(max-width:480px){.steps{font-size:13px}.steps td{white-space:normal;padding:9px 7px}}.steps .now{font-size:12px;font-weight:800;color:#fff;background:var(--orange);border-radius:6px;padding:2px 7px}
.faq{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:4px 18px;margin-bottom:10px}.faq summary{cursor:pointer;font-weight:700;padding:12px 0;font-size:15.5px;list-style:none;display:flex;justify-content:space-between;gap:10px}
.faq summary:after{content:'+';color:var(--muted);font-weight:400}.faq[open] summary:after{content:'−'}.faq p{padding:0 0 14px;color:var(--ink2);font-size:14.5px}
.coffee{display:flex;gap:14px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-top:16px}.coffee .c{font-size:34px}.coffee p{font-size:14.5px;color:var(--ink2)}
</style>`;

  const body = `
<section class="hero"><div class="wrap">
  <div>
    <div class="eyebrow">전자책 · 8개월의 기록과 따라 하는 법</div>
    <h1>쉰 살에 처음, 스마트폰으로 돈을 벌었습니다.<br><em>식탁에서, 하루 1시간 20분.</em></h1>
    <p class="sub">2026년 2월, 안양에 사는 50세 주부 경희 씨가 스레드를 열었습니다. 9월, 쿠팡파트너스 수수료가 처음 100만 원을 넘었습니다. 중간에 시급 400원이던 달과 계정이 9일 멈춘 주도 있습니다. 그걸 다 적었습니다. 잘된 것만 적으면 따라 할 수 없으니까요.</p>
    <div class="trust"><span>가입비 0원 방식만</span><span>규칙 지키는 법만</span><span>가명·재구성 고지</span><span>수익 보장 없음 명시</span><span>미열람 7일 전액 환불</span></div>
    <p class="fine" style="margin-top:14px">본문 ${totalChars.toLocaleString()}자 · 12장 + 부록 3편 · 모바일·PC 웹 열람, PDF 저장 · 최신 개정 ${BOOK.updated}</p>
  </div>
  <div>
    <div class="cover"><div><div class="k">THE PINDA · 전자책</div><h2>${esc(BOOK.title)}</h2></div><div><div class="cup"></div><div class="a" style="margin-top:14px">${esc(BOOK.author)}</div></div></div>
    ${priceBox('price-top')}
  </div>
</div></section>

<section class="blk" id="story"><div class="wrap">
  <div class="eyebrow">이런 밤을 보내고 있다면</div><h2 class="sec">이 책은 당신을 위해 썼습니다</h2>
  <div class="pain" style="margin-top:18px">${pains.map(([t, d]) => `<div class="card"><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div>
</div></section>

<section class="blk alt"><div class="wrap">
  <div class="eyebrow">숫자로 먼저</div><h2 class="sec">8개월, 숨긴 것 없이</h2>
  <p class="sub">첫 달은 1만 1,840원이었습니다. 3개월째 10만 원, 5개월째 30만 원. 그래프 아래 작은 글씨까지 읽어 주세요. 8월에 왜 꺾였는지가 9장입니다.</p>
  <div class="stats"><div><b>1,284원</b><span>3주째, 첫 수수료</span></div><div><b>1시간 20분</b><span>100만 원 된 달의 하루</span></div><div><b>1,043,600원</b><span>9월 수수료</span></div></div>
  <div class="card" style="padding:12px">${bars}</div>
  <p class="fine" style="margin-top:10px">한 사람의 기록을 가명으로 재구성한 수치입니다. 결과는 사람과 시기에 따라 다르며 보장되지 않습니다. 9월은 추석이 낀 달이라는 점도 본문에 밝혀 두었습니다.</p>
</div></section>

<section class="blk" id="toc"><div class="wrap">
  <div class="eyebrow">목차</div><h2 class="sec">12장과 부록 3편</h2>
  <p class="sub">앞의 세 장은 결제 없이 읽을 수 있습니다. 3장부터는 스마트폰을 옆에 두고 따라 하는 장입니다.</p>
  <ul class="toc" style="margin-top:18px">${toc}</ul>
</div></section>

<section class="blk alt" id="preview"><div class="narrow">
  <div class="eyebrow">미리보기</div><h2 class="sec">들어가며, 그리고 1장과 2장</h2>
  <p class="sub" style="margin-bottom:22px">커피 마시듯 읽어 보세요. 2장 중간에서 끊깁니다. 거기부터가 손이 필요한 부분입니다.</p>
  ${previewHtml}
  <div class="lock"><p>여기부터는 결제 후 이어서 읽을 수 있습니다.<br>3장 "첫 2주, 팔로워 0명에서 한 일들"이 바로 이어집니다.</p><button class="btn big js-buy">이어서 읽기 · <span data-price></span></button><div class="fine" style="margin-top:10px"><span data-nextdate></span>부터 <span data-nextprice></span></div></div>
</div></section>

<section class="blk gets"><div class="wrap">
  <div class="eyebrow">받는 것</div><h2 class="sec">읽고 끝나는 책이 아니라, 꺼내 쓰는 책</h2>
  <div class="grid3" style="margin-top:18px">${gets.map(([t, d]) => `<div class="card"><i></i><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join('')}</div>
</div></section>

<section class="blk alt" id="reviews"><div class="wrap">
  <div class="eyebrow">먼저 읽은 분들</div><h2 class="sec">독자 이야기</h2>
  <p class="sub">구매하신 분은 본문 끝에서 후기를 남길 수 있고, 구매가 확인된 후기는 표시가 붙어 이 자리에 올라옵니다. 처음 올라간 것은 사전 독자 피드백(가명)입니다.</p>
  <div class="rvs" id="rvs" style="margin-top:18px">${SEED_REVIEWS.map(r => reviewCard({ ...r, verified: false })).join('')}</div>
</div></section>

<section class="blk" id="price"><div class="wrap"><div class="grid2" style="align-items:start">
  <div>
    <div class="eyebrow">가격</div><h2 class="sec">지금이 가장 싸고, 계속 오릅니다</h2>
    <p class="sub">첫 독자들의 질문과 후기를 모아 책을 다듬기 위해 시작 가격을 낮게 잡았습니다. 개정이 반영될수록 가격은 아래 일정대로 정가까지 오르고, 일정은 여기 그대로 공개합니다. <mark>먼저 산 분은 개정판도 같은 링크에서 추가 비용 없이 봅니다.</mark> 먼저 산 사람이 손해 보는 책은 만들지 않기로 했습니다.</p>
    <table class="steps" style="margin-top:18px">${steps}</table>
    <div class="coffee"><div class="c">☕</div><p>지금 가격은 프랜차이즈 카페 커피 한 잔 값입니다. 그 값으로 8개월을 먼저 살아 본 사람의 지도를 받는 셈입니다. 지도가 길을 걸어 주지는 않지만, 어디서 넘어졌는지 표시된 지도는 처음 가는 길에서 꽤 큰 차이를 만듭니다.</p></div>
  </div>
  ${priceBox('price-main')}
</div></div></section>

<section class="blk alt" id="faq"><div class="narrow">
  <div class="eyebrow">자주 묻는 질문</div><h2 class="sec" style="margin-bottom:18px">사기 전에 궁금한 것</h2>
  ${faqHtml}
  <p class="fine" style="margin-top:14px">더 궁금한 점은 <a href="/blog/">블로그</a>의 정보·노하우 글을 먼저 읽어 보세요. 책의 일부 내용을 무료로 풀어 두었습니다.</p>
</div></section>

<section class="blk"><div class="narrow">${shareKit({ slug: 'book', title: BOOK.title, hook: '쉰 살에 처음, 스마트폰으로 돈을 벌었습니다. 식탁에서, 하루 1시간 20분.', thread: '쉰 살 주부가 2월에 스레드를 열고 9월에 쿠팡파트너스 수수료 100만 원을 넘긴 기록을 읽었어요.\n첫 달은 1만 1,840원. 시급 400원. 8월엔 계정이 9일 멈췄고요.\n잘된 것만 적은 글이 아니라 어디서 넘어졌는지가 다 있어서 오히려 믿음이 갔어요.\n앞의 세 장은 그냥 읽을 수 있더라고요.\n우리 나이에 부업 해보신 분, 뭐부터 하셨어요?', reply: '세 장 무료로 읽히는 곳 → {url}', kakao: '50세 주부가 스레드로 8개월 만에 월 100만 원 넘긴 기록, 앞 세 장 무료 {url}' }, url, '전자책')}</div></section>

<section class="blk" style="text-align:center"><div class="narrow">
  <h2 class="sec">식탁은 그대로 있습니다.<br>다른 건 거기 앉은 사람이 뭘 하는지입니다.</h2>
  <p class="sub" style="margin:12px auto 22px">첫 세 장을 읽었다면, 당신이 이 방식과 맞는지는 이미 반쯤 알았을 겁니다. 나머지 반은 30일이면 압니다.</p>
  <button class="btn big js-buy">지금 <span data-price></span>으로 읽기</button>
  <div class="fine" style="margin-top:12px"><span data-nextdate></span>부터 <span data-nextprice></span> · 미열람 7일 내 전액 환불</div>
</div></section>

<div class="modal" id="buy"><div class="box">
  <button class="close" aria-label="닫기" onclick="document.getElementById('buy').classList.remove('on')">×</button>
  <h3>결제 정보</h3><div class="hint">결제 완료 즉시 열람 링크가 열립니다. 이메일과 휴대폰 번호는 열람 링크를 다시 찾을 때만 씁니다.</div>
  <div class="sum"><span>${esc(BOOK.short)} 전자책</span><b data-price></b></div>
  <form id="buyForm" novalidate>
    <label for="em">이메일</label><input id="em" type="email" inputmode="email" autocomplete="email" placeholder="example@naver.com" required>
    <label for="ph">휴대폰 번호</label><input id="ph" type="tel" inputmode="numeric" autocomplete="tel" placeholder="01012345678" required>
    <label class="chk"><input type="checkbox" id="ag" required><span>디지털 콘텐츠 특성상 <b>유료 본문을 열람한 뒤에는 환불이 어렵고</b>, 열람 전 7일 이내에는 전액 환불됨을 확인했습니다. <a href="/refund" target="_blank" rel="noopener">환불 규정</a> · <a href="/privacy" target="_blank" rel="noopener">개인정보 처리</a>에 동의합니다.</span></label>
    <button class="btn big" type="submit" id="buyBtn">결제창 열기</button>
    <div class="err" id="buyErr"></div>
    <div class="fine" style="text-align:center;margin-top:6px">결제는 페이앱(PayApp) 안전결제창에서 진행되며 카드 정보는 저장되지 않습니다.</div>
  </form>
</div></div>
<script>
(function(){
  var $=function(s){return document.querySelector(s)};
  document.querySelectorAll('.js-buy').forEach(function(b){b.addEventListener('click',function(){$('#buy').classList.add('on');setTimeout(function(){$('#em').focus()},50)})});
  $('#buy').addEventListener('click',function(e){if(e.target===this)this.classList.remove('on')});
  $('#buyForm').addEventListener('submit',function(e){e.preventDefault();var err=$('#buyErr'),btn=$('#buyBtn');err.textContent='';
    var em=$('#em').value.trim(),ph=$('#ph').value.replace(/\\D/g,'');
    if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(em))return err.textContent='이메일 주소를 확인해 주세요.';
    if(!/^01[016789]\\d{7,8}$/.test(ph))return err.textContent='휴대폰 번호를 확인해 주세요. (예: 01012345678)';
    if(!$('#ag').checked)return err.textContent='환불 안내 확인에 동의해 주세요.';
    btn.disabled=true;btn.textContent='결제창을 여는 중…';
    fetch('/api/order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:em,phone:ph,agree:true})}).then(function(r){return r.json()}).then(function(j){
      if(j.payurl){location.href=j.payurl}else{err.textContent=j.error||'잠시 뒤 다시 시도해 주세요.';btn.disabled=false;btn.textContent='결제창 열기'}
    }).catch(function(){err.textContent='연결이 불안정해요. 다시 시도해 주세요.';btn.disabled=false;btn.textContent='결제창 열기'})});
  fetch('/api/reviews').then(function(r){return r.json()}).then(function(d){if(!d.reviews||!d.realCount)return;var st=function(n){return '<span style=\"color:#f59e0b;letter-spacing:1px\">'+'★'.repeat(n)+'</span><span style=\"color:#d6cfc4;letter-spacing:1px\">'+'★'.repeat(5-n)+'</span>'};var esc=function(s){return String(s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})};
    $('#rvs').innerHTML=d.reviews.map(function(r){return '<div class=\"card rv\"><div style=\"display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px\"><b style=\"font-size:14.5px\">'+esc(r.name)+'</b><span style=\"font-size:14px\">'+st(r.stars)+'</span></div><p style=\"font-size:14.5px;color:var(--ink2);line-height:1.7\">'+esc(r.body)+'</p>'+(r.verified?'<div class=\"fine\" style=\"margin-top:8px;color:var(--green)\">✓ 구매 확인된 후기</div>':'<div class=\"fine\" style=\"margin-top:8px\">사전 독자 · 가명</div>')+'</div>'}).join('')}).catch(function(){});
  if(location.hash==='#buy')$('#buy').classList.add('on');
})();
</script>`;

  const nextStep = pr.next;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'Book', name: BOOK.title, alternativeHeadline: BOOK.subtitle, author: { '@type': 'Person', name: '경희 (가명)' },
      publisher: { '@type': 'Organization', name: PUBLISHER, url: SITE }, inLanguage: 'ko', bookFormat: 'https://schema.org/EBook', numberOfPages: chapters.length, dateModified: BOOK.updated,
      description: BOOK.subtitle, url, image: ogImage({ title: BOOK.title, excerpt: '쉰 살에 처음, 스마트폰으로 돈을 벌었습니다. 식탁에서, 하루 1시간 20분.', badge: '전자책', cta: '미리보기 읽기 →' }),
      offers: { '@type': 'Offer', price: pr.price, priceCurrency: 'KRW', availability: 'https://schema.org/InStock', url: `${url}#price`, ...(nextStep ? { priceValidUntil: nextStep.from } : {}), seller: { '@type': 'Organization', name: PUBLISHER } } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: BRAND, url: SITE, publisher: { '@type': 'Organization', name: PUBLISHER } },
  ];
  await fs.writeFile(path.join(OUT, 'index.html'), layout({
    title: `${BOOK.title} | ${BRAND}`,
    desc: `50세 주부가 스마트폰 하나로 스레드·쿠팡파트너스 제휴마케팅을 시작해 8개월 만에 월 100만 원을 넘긴 기록과, 그대로 따라 하는 30일 체크리스트. 앞의 세 장은 무료로 읽을 수 있습니다. 지금 ${won(pr.price)}, ${nextStep ? nextStep.from.replace(/-/g, '.') + '부터 ' + won(nextStep.price) : '정가'}.`,
    url, body, jsonld, extraHead: extraCss, ogBadge: '전자책',
    image: ogImage({ title: BOOK.title, excerpt: '쉰 살에 처음, 스마트폰으로 돈을 벌었습니다. 식탁에서, 하루 1시간 20분.', badge: '전자책', cta: '미리보기 읽기 →' }),
    keywords: ['스레드 제휴마케팅', '50대 주부 부업', '쿠팡파트너스 전자책', '스레드 수익화', '주부 재택 부업', '제휴마케팅 시작'],
  }));
}

/* ---------- 블로그 ---------- */
const CATS = { '정보': { slug: 'info', hue: 160, desc: '수수료, 규정, 세금, 건강보험. 시작 전에 알아야 할 숫자와 규칙을 확인 경로와 함께 정리합니다.' },
  '노하우': { slug: 'knowhow', hue: 24, desc: '답글 루틴, 링크 배치, 글 틀, 시즌 달력. 식탁에서 바로 따라 하는 방법만 적습니다.' } };
const cat = n => CATS[n] || CATS['정보'];
function thumb(seed, hue) {
  const h = hash(seed); let i = 0; const r = () => h[(i++) % h.length] / 255;
  const W = 1200, H = 675, id = 't' + h.toString('hex').slice(0, 6);
  const paper = `hsl(${hue} 30% 94%)`, ink = `hsl(${hue} 45% 22%)`, acc = `hsl(${(hue + 190) % 360} 70% 50%)`;
  const rings = Array.from({ length: 3 }, () => `<circle cx="${(0.55 + r() * 0.35) * W}" cy="${(0.2 + r() * 0.6) * H}" r="${90 + r() * 160}" fill="none" stroke="${ink}" stroke-opacity="${(0.08 + r() * 0.12).toFixed(2)}" stroke-width="${10 + r() * 30}"/>`).join('');
  const bubbles = Array.from({ length: 3 }, (_, k) => { const x = 110 + k * 30 + r() * 40, y = 150 + k * 130 + r() * 20, w = 260 + r() * 240; return `<rect x="${x}" y="${y}" width="${w}" height="72" rx="36" fill="${k === 1 ? acc : '#fff'}" opacity="${k === 1 ? 0.9 : 0.95}" stroke="${ink}" stroke-opacity=".12"/>${[0, 1, 2].map(d => `<circle cx="${x + 44 + d * 22}" cy="${y + 36}" r="6" fill="${k === 1 ? '#fff' : ink}" opacity=".55"/>`).join('')}`; }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${paper}"/><stop offset="1" stop-color="hsl(${hue} 32% 86%)"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#${id})"/>${rings}${bubbles}<rect x="0" y="${H - 14}" width="${W}" height="14" fill="${acc}"/></svg>`;
}
const BLOG_CSS = `<style>
.cards{display:grid;gap:16px;grid-template-columns:1fr}@media(min-width:620px){.cards{grid-template-columns:1fr 1fr}}@media(min-width:960px){.cards{grid-template-columns:1fr 1fr 1fr}}
.pcard{display:block;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--card);transition:transform .15s,box-shadow .15s}.pcard:hover{transform:translateY(-3px);box-shadow:var(--shadow);text-decoration:none}
.pcard img{aspect-ratio:1200/675;object-fit:cover;width:100%}.pcard .b{padding:14px 16px 17px}.pcard .c{font-size:12px;font-weight:800;color:var(--orange);display:block;margin-bottom:5px}
.pcard h3{font-size:16.5px;line-height:1.45;margin:0 0 6px;color:var(--ink)}.pcard p{font-size:13.5px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cats{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 22px}.cats a{padding:8px 15px;border-radius:999px;border:1px solid var(--line);font-size:14px;font-weight:700;color:var(--ink2);background:var(--card)}.cats a.on,.cats a:hover{background:var(--green);border-color:var(--green);color:#fff;text-decoration:none}
article.post{max-width:740px;margin:0 auto}
article.post h1{font-family:'Noto Serif KR',serif;font-size:clamp(25px,5vw,36px);line-height:1.3;margin:10px 0 14px}
article.post .lede{font-size:17px;color:var(--ink2);background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:22px}
article.post .meta{display:flex;gap:10px;align-items:center;font-size:13.5px;color:var(--muted)}article.post .meta a{font-weight:800;color:var(--orange)}
article.post .hero{border-radius:16px;border:1px solid var(--line);margin-bottom:22px}
article.post h2{font-family:'Noto Serif KR',serif;font-size:clamp(19px,3.4vw,24px);margin:38px 0 12px;scroll-margin-top:72px}
article.post p{margin:0 0 16px;color:var(--ink2)}article.post ul,article.post ol{margin:0 0 18px;padding-left:22px;color:var(--ink2)}article.post li{margin-bottom:7px}
article.post blockquote{margin:0 0 18px;padding:14px 18px;border-left:3px solid var(--orange);background:var(--card);border-radius:0 12px 12px 0;color:var(--ink2)}
article.post table{width:100%;border-collapse:collapse;margin:0 0 20px;font-size:14.5px;display:block;overflow-x:auto;white-space:nowrap}article.post th,article.post td{border:1px solid var(--line);padding:9px 12px;text-align:left}article.post th{background:var(--card)}
@media(min-width:600px){article.post table{display:table;white-space:normal}}
.bookcta{margin:34px 0;padding:24px;border-radius:18px;background:linear-gradient(135deg,#1f5f4a,#143d31);color:#faf6ef}.bookcta b{display:block;font-family:'Noto Serif KR',serif;font-size:19px;margin-bottom:6px}.bookcta p{color:#d9e8e1;font-size:14.5px;margin-bottom:14px}
.bookcta a{display:inline-block;background:#faf6ef;color:#143d31;font-weight:800;padding:12px 22px;border-radius:12px}.bookcta a:hover{text-decoration:none}.bookcta small{display:block;margin-top:10px;color:#fdba74;font-size:12.5px;font-weight:700}
.share{margin:26px 0;padding-top:20px;border-top:1px solid var(--line)}.share b{display:block;font-size:14px;margin-bottom:10px}.share div{display:flex;flex-wrap:wrap;gap:8px}
.share button,.share a{display:inline-flex;align-items:center;height:38px;padding:0 14px;border-radius:19px;border:1px solid var(--line);background:var(--card);color:var(--ink2);font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}.share .kakao{background:#FEE500;border-color:#FEE500;color:#191600}
.rel{margin-top:44px}.rel h2{font-size:20px;margin-bottom:14px}
.hero-blog{text-align:center;padding:14px 0 10px}.hero-blog h1{font-family:'Noto Serif KR',serif;font-size:clamp(26px,5vw,38px)}.hero-blog p{color:var(--ink2);max-width:600px;margin:10px auto 0}
</style>`;
const bookCta = () => `<div class="bookcta"><b>이 글의 바탕이 된 8개월 기록, 전자책으로</b><p>2월 식탁의 계산기부터 9월 100만 원까지. 글 틀 5개와 예문 20개, 30일 체크리스트, 시간표, 대가성 문구 모음까지 한 권에. 앞의 세 장은 무료입니다.</p><a href="/">미리보기 읽기 →</a><small>지금 <span data-price></span> · <span data-nextdate></span>부터 <span data-nextprice></span></small></div>`;
// 글마다 "퍼가기 세트": 정사각 카드 이미지 + 스레드 본문(링크 없음) + 첫 답글(링크) + 카톡 한 줄. 책의 링크 배치 규칙과 같게
function shareKit(p, url, badge) {
  const hook = p.hook || p.sns || p.title;
  const card = squareCard({ hook, badge, cta: '자세한 글은 첫 답글에 →' });
  const thread = p.thread || `${hook}\n\n${p.description}`;
  const reply = (p.reply || '자세한 정리는 여기 → {url}').replace('{url}', url);
  const kakao = (p.kakao || `${p.title} {url}`).replace('{url}', url);
  const item = (label, text, id) => `<div class="item"><b>${label}</b><pre id="${id}">${esc(text)}</pre><button class="cp" data-for="${id}">복사</button></div>`;
  return `<section class="kit" id="share"><h2>이 글, 그대로 퍼가세요</h2><p>스레드 본문엔 링크를 넣지 않고, 첫 답글에 링크를 다는 방식입니다(노출이 덜 깎입니다). 카드 이미지는 길게 눌러 저장하거나 아래 버튼으로 받으세요. 출처만 남겨 주시면 됩니다.</p>
<div class="row"><a class="sq" href="${card}" download="${esc(p.slug || 'card')}.png"><img src="${card}" alt="${esc(hook)}" width="1080" height="1080" loading="lazy"></a>
<div>${item('스레드 본문 (링크 없이)', thread, 'k1')}${item('내 글에 다는 첫 답글 (링크)', reply, 'k2')}${item('카카오톡 · 문자 한 줄', kakao, 'k3')}</div></div>
<div class="acts"><a class="th" href="https://www.threads.net/intent/post?text=${encodeURIComponent(thread)}" target="_blank" rel="noopener">스레드에 본문 올리기</a><button class="kakao" onclick="shareN()">카카오톡 공유</button><button onclick="copyL()">링크 복사</button><a href="${card}" download="${esc(p.slug || 'card')}.png">카드 이미지 받기</a></div>
<script>document.querySelectorAll('.kit .cp').forEach(function(b){b.onclick=function(){navigator.clipboard.writeText(document.getElementById(b.dataset.for).textContent).then(function(){b.textContent='복사됐어요';setTimeout(function(){b.textContent='복사'},1500)})}});
function copyL(){navigator.clipboard.writeText(${JSON.stringify(url)}).then(function(){alert('링크를 복사했어요')})}function shareN(){if(navigator.share)navigator.share({title:${JSON.stringify(p.title)},text:${JSON.stringify(kakao)},url:${JSON.stringify(url)}}).catch(function(){});else copyL()}</script></section>`;
}
const _shareBlockUnused = (url, title, sns) => `<div class="share"><b>도움이 됐다면 한 사람에게만 공유해 주세요</b><div>
<button class="kakao" onclick="shareK()">카카오톡</button><button onclick="shareN()">공유하기</button><button onclick="copyL()">링크 복사</button><a href="https://www.threads.net/intent/post?text=${encodeURIComponent((sns || title) + ' ' + url)}" target="_blank" rel="noopener">스레드에 쓰기</a></div></div>
<script>function copyL(){navigator.clipboard.writeText(${JSON.stringify(url)}).then(function(){alert('링크를 복사했어요')})}function shareN(){if(navigator.share)navigator.share({title:${JSON.stringify(title)},text:${JSON.stringify(sns || title)},url:${JSON.stringify(url)}});else copyL()}function shareK(){shareN()}</script>`;

async function buildBlog() {
  const docs = await readDocs(BLOG_SRC);
  const posts = docs.map(d => ({ slug: d.slug, title: d.fm.title, description: d.fm.description || '', category: d.fm.category || '정보', keywords: (d.fm.keywords || '').split(',').map(s => s.trim()).filter(Boolean), date: d.fm.date || today, sns: d.fm.sns || '', hook: d.fm.hook || '', thread: d.fm.thread || '', reply: d.fm.reply || '', kakao: d.fm.kakao || '', body: renderMocks(d.body) }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  const BOUT = path.join(OUT, 'blog'), ART = path.join(BOUT, 'art');
  await fs.rm(ART, { recursive: true, force: true }); await fs.mkdir(ART, { recursive: true }); await fs.mkdir(path.join(BOUT, 'category'), { recursive: true });
  for (const p of posts) { await fs.writeFile(path.join(ART, `${p.slug}.svg`), thumb(p.slug + p.title, cat(p.category).hue)); p.thumb = `/blog/art/${p.slug}.svg`; }
  const cardOf = p => `<a class="pcard" href="/blog/${p.slug}"><img src="${p.thumb}" alt="" width="1200" height="675" loading="lazy" decoding="async"><div class="b"><span class="c">${esc(p.category)}</span><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p></div></a>`;
  const catNav = active => `<div class="cats"><a href="/blog/" class="${active ? '' : 'on'}">전체 ${posts.length}</a>${Object.keys(CATS).map(c => `<a href="/blog/category/${cat(c).slug}" class="${active === c ? 'on' : ''}">${esc(c)} ${posts.filter(p => p.category === c).length}</a>`).join('')}</div>`;

  for (const p of posts) {
    const url = `${SITE}/blog/${p.slug}`;
    let n = 0; const toc = [];
    const html = p.body.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, t) => { const id = 'h' + (++n); toc.push({ id, text: stripTags(t) }); return `<h2 id="${id}">${t}</h2>`; });
    const rel = posts.filter(x => x.slug !== p.slug).sort((a, b) => (b.category === p.category) - (a.category === p.category) || b.date.localeCompare(a.date)).slice(0, 3);
    const jsonld = [
      { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.description, datePublished: p.date, dateModified: p.date, inLanguage: 'ko-KR',
        author: { '@type': 'Organization', name: BRAND, url: SITE }, publisher: { '@type': 'Organization', name: PUBLISHER, url: SITE }, mainEntityOfPage: url, articleSection: p.category, keywords: p.keywords.join(', '), image: `${SITE}${p.thumb}` },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: SITE }, { '@type': 'ListItem', position: 2, name: '블로그', item: `${SITE}/blog/` },
        { '@type': 'ListItem', position: 3, name: p.category, item: `${SITE}/blog/category/${cat(p.category).slug}` }, { '@type': 'ListItem', position: 4, name: p.title, item: url }] },
    ];
    const body = `<div class="wrap"><article class="post">
  <div class="meta"><a href="/blog/category/${cat(p.category).slug}">${esc(p.category)}</a><time datetime="${p.date}">${p.date.replace(/-/g, '.')}</time></div>
  <h1>${esc(p.title)}</h1><p class="lede">${esc(p.description)}</p>
  <img class="hero" src="${p.thumb}" alt="" width="1200" height="675">
  ${html}
  ${shareKit(p, url, p.category)}
  ${bookCta()}
  <p class="fine">이 글은 한 운영자의 기록과 공개된 정책을 정리한 참고 자료입니다. 수수료율·표시 규정·세금·보험 기준은 바뀔 수 있으니 본문의 공식 경로에서 확인하세요. 수익은 보장되지 않습니다.</p>
</article>
<section class="rel wrap" style="padding:0"><h2>함께 읽으면 좋은 글</h2><div class="cards">${rel.map(cardOf).join('')}</div></section></div>`;
    await fs.writeFile(path.join(BOUT, `${p.slug}.html`), layout({ title: `${p.title} | ${BRAND} 블로그`, desc: p.description, url, body, jsonld, keywords: p.keywords, extraHead: BLOG_CSS, ogBadge: p.category,
      image: ogImage({ title: p.title, excerpt: p.sns || p.description, badge: p.category, cta: '이어서 읽기 →' }) }));
  }
  const listLd = { '@context': 'https://schema.org', '@type': 'Blog', name: `${BRAND} 블로그`, url: `${SITE}/blog/`, description: '스레드 제휴마케팅과 쿠팡파트너스를 50대도 따라 할 수 있게, 정보와 노하우로 나눠 정리합니다.',
    blogPost: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.date })) };
  await fs.writeFile(path.join(BOUT, 'index.html'), layout({ title: `블로그 · 스레드 제휴마케팅 정보와 노하우 | ${BRAND}`, desc: '쿠팡파트너스 수수료와 규정(정보), 스레드 답글 루틴과 링크 배치, 글 틀(노하우). 50대 주부의 8개월 기록에서 꺼낸 글을 무료로 읽어보세요.', url: `${SITE}/blog/`, jsonld: [listLd], extraHead: BLOG_CSS,
    body: `<div class="wrap"><div class="hero-blog"><h1>식탁에서 읽는 제휴마케팅</h1><p>숫자와 규칙은 <b>정보</b>에, 따라 하는 방법은 <b>노하우</b>에. 전자책의 일부를 무료로 풀어 둡니다.</p></div>${catNav(null)}<div class="cards">${posts.map(cardOf).join('')}</div>${bookCta()}</div>` }));
  for (const c of Object.keys(CATS)) {
    const list = posts.filter(p => p.category === c);
    await fs.writeFile(path.join(BOUT, 'category', `${cat(c).slug}.html`), layout({ title: `${c} 글 모음 (${list.length}편) | ${BRAND} 블로그`, desc: `${cat(c).desc} ${BRAND} 블로그의 ${c} 글 ${list.length}편.`, url: `${SITE}/blog/category/${cat(c).slug}`, extraHead: BLOG_CSS,
      body: `<div class="wrap"><div class="hero-blog"><h1>${esc(c)}</h1><p>${esc(cat(c).desc)}</p></div>${catNav(c)}<div class="cards">${list.map(cardOf).join('')}</div>${bookCta()}</div>` }));
  }
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(BRAND)} 블로그</title><link>${SITE}/blog/</link><description>스레드 제휴마케팅 정보와 노하우</description><language>ko</language>
${posts.map(p => `<item><title>${esc(p.title)}</title><link>${SITE}/blog/${p.slug}</link><guid>${SITE}/blog/${p.slug}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><category>${esc(p.category)}</category><description>${esc(p.description)}</description></item>`).join('\n')}
</channel></rss>`;
  await fs.writeFile(path.join(BOUT, 'rss.xml'), rss);
  console.log(`블로그: ${posts.length}편`);
  return posts;
}

/* ---------- 안내 페이지 ---------- */
const PAGE_CSS = `<style>.page{max-width:720px;margin:0 auto}.page h1{font-family:'Noto Serif KR',serif;font-size:clamp(24px,4.6vw,32px);margin:8px 0 18px}.page h2{font-size:18px;margin:28px 0 8px}.page p,.page li{color:var(--ink2);margin-bottom:12px}.page ol,.page ul{padding-left:22px}
.form{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:22px}.form label{display:block;font-size:13px;font-weight:700;color:var(--ink2);margin:12px 0 5px}.form input{width:100%;height:48px;border:1px solid var(--line);border-radius:12px;padding:0 14px;font:inherit;font-size:16px;background:var(--paper);color:var(--ink)}.form .btn{width:100%;margin-top:16px}.form .err{color:#b91c1c;font-size:13px;min-height:18px;margin-top:8px}
.state{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px;text-align:center}.state .big{font-size:22px;font-weight:900;margin:8px 0}.state code{display:block;word-break:break-all;background:var(--paper2);padding:10px;border-radius:10px;font-size:12.5px;margin:12px 0}
.spin{width:28px;height:28px;border:3px solid var(--line);border-top-color:var(--green);border-radius:50%;margin:0 auto 10px;animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}</style>`;
async function buildPages() {
  const page = (slug, title, desc, inner, noindex = false, bar = false) => fs.writeFile(path.join(OUT, `${slug}.html`), layout({ title: `${title} | ${BRAND}`, desc, url: `${SITE}/${slug}`, body: `<div class="wrap"><div class="page">${inner}</div></div>`, extraHead: PAGE_CSS, noindex, bar }));

  await page('thanks', '결제 확인', '결제 상태를 확인하고 전자책을 열람합니다.', `<h1>결제를 확인하고 있어요</h1>
<div class="state" id="st"><div class="spin"></div><p>결제가 완료되면 이 자리에 열람 버튼이 나타납니다. 보통 몇 초 안에 끝나요.</p></div>
<p class="fine" style="margin-top:14px">결제창을 닫았거나 취소했다면 <a href="/#price">처음부터 다시</a> 진행할 수 있습니다. 결제는 됐는데 이 화면이 바뀌지 않으면 <a href="/recover">열람 링크 찾기</a>에서 결제 때 쓴 이메일·휴대폰으로 열 수 있어요.</p>
<script>
(function(){var o=new URLSearchParams(location.search).get('o');var st=document.getElementById('st');if(!o){st.innerHTML='<p>주문 정보가 없어요. <a href="/recover">열람 링크 찾기</a>로 가 주세요.</p>';return}
var n=0;function poll(){fetch('/api/order/'+o).then(function(r){return r.json()}).then(function(j){var od=j.order;if(!od){st.innerHTML='<p>주문을 찾지 못했어요. <a href="/recover">열람 링크 찾기</a></p>';return}
if(od.state==='paid'){st.innerHTML='<div style="font-size:40px">☕</div><div class="big">고맙습니다. 결제가 끝났어요.</div><p>아래 버튼으로 바로 읽을 수 있어요. 이 주소는 저장해 두세요. 다른 기기에서도 열립니다.</p><a class="btn big" href="'+od.readUrl+'">지금 읽기 →</a><code>'+od.readUrl+'</code><button class="btn ghost" onclick="navigator.clipboard.writeText(\\''+od.readUrl+'\\').then(function(){this.textContent=\\'복사됐어요\\'}.bind(this))">주소 복사</button>'+(od.mock?'<p class="fine" style="margin-top:10px">테스트 결제입니다.</p>':'');return}
if(od.state==='canceled'){st.innerHTML='<div class="big">결제가 취소됐어요</div><p>다시 진행하시려면 아래 버튼을 눌러 주세요.</p><a class="btn" href="/#buy">다시 결제하기</a>';return}
if(od.state==='pending'){st.innerHTML='<div class="big">입금 대기 중</div><p>가상계좌 입금이 확인되면 열람 링크가 열려요. 이 페이지를 북마크해 두시거나 <a href="/recover">열람 링크 찾기</a>에서 확인하세요.</p>';return}
if(++n<60)setTimeout(poll,2000);else st.innerHTML='<p>아직 결제 확인이 안 됐어요. 결제가 끝났다면 잠시 뒤 <a href="/recover">열람 링크 찾기</a>에서 확인해 주세요.</p>'}).catch(function(){if(++n<60)setTimeout(poll,3000)})}poll()})();
</script>`, true);

  await page('recover', '열람 링크 찾기', '결제 때 입력한 이메일과 휴대폰 번호로 전자책 열람 링크를 다시 찾습니다.', `<h1>열람 링크 찾기</h1>
<p>결제 때 입력한 이메일과 휴대폰 번호를 그대로 넣어 주세요. 결제 완료된 주문이 있으면 바로 열 수 있어요. 이 브라우저에도 열람 권한이 저장됩니다.</p>
<div class="form"><form id="f" novalidate><label for="em">이메일</label><input id="em" type="email" inputmode="email" autocomplete="email"><label for="ph">휴대폰 번호</label><input id="ph" type="tel" inputmode="numeric" placeholder="01012345678"><button class="btn" type="submit">찾기</button><div class="err" id="err"></div></form><div id="res"></div></div>
<p class="fine" style="margin-top:14px">정보가 기억나지 않거나 결제 뒤 문제가 있다면 아래 판매자 이메일로 결제 일시와 금액을 적어 보내 주세요. 확인 후 안내드립니다.</p>
<script>
document.getElementById('f').addEventListener('submit',function(e){e.preventDefault();var err=document.getElementById('err'),res=document.getElementById('res');err.textContent='';res.innerHTML='';
fetch('/api/recover',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:document.getElementById('em').value,phone:document.getElementById('ph').value})}).then(function(r){return r.json()}).then(function(j){
if(j.error)return err.textContent=j.error;res.innerHTML=j.orders.map(function(o){return '<div class="state" style="margin-top:16px"><div class="big">찾았어요</div><p>결제일 '+(o.paidAt||'').slice(0,10)+'</p><a class="btn" href="'+o.readUrl+'">지금 읽기 →</a><code>'+o.readUrl+'</code></div>'}).join('')}).catch(function(){err.textContent='연결이 불안정해요. 다시 시도해 주세요.'})});
if(new URLSearchParams(location.search).get('e')==='denied')document.getElementById('err').textContent='이 브라우저에는 열람 권한이 없어요. 아래 정보로 다시 찾아 주세요.';
</script>`, true);

  await page('refund', '환불 규정', '더 핀다 전자책의 환불 규정. 미열람 7일 이내 전액 환불, 열람 후 환불 제한 안내.', `<h1>환불 규정</h1>
<p>이 전자책은 결제 즉시 열람이 시작되는 디지털 콘텐츠입니다. 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항에 따라, 아래 기준으로 환불합니다.</p>
<h2>전액 환불</h2><ul><li>결제 후 <b>7일 이내</b>이고, <b>유료 본문(3장 이후)을 한 번도 열람하지 않은</b> 경우 결제 금액 전액을 환불합니다.</li><li>결제 오류로 같은 주문이 중복 결제된 경우 중복분을 환불합니다.</li><li>서비스 장애로 열람이 불가능했던 경우 기간과 무관하게 환불합니다.</li></ul>
<h2>환불이 어려운 경우</h2><ul><li>유료 본문 열람을 시작한 뒤에는 콘텐츠가 제공된 것으로 보아 환불이 어렵습니다. 결제 전 미리보기 세 장(들어가며, 1장, 2장)을 충분히 읽고 결정해 주세요.</li><li>결제 후 7일이 지난 경우.</li></ul>
<h2>신청 방법</h2><p>판매자 이메일(페이지 하단)로 결제 일시, 결제 금액, 결제 때 쓴 이메일을 적어 보내 주세요. 영업일 기준 3일 안에 결제 수단으로 환불 처리합니다. 카드 결제 취소는 카드사 사정에 따라 3~7일 뒤 반영될 수 있습니다.</p>
<h2>개정판</h2><p>이 책은 내용이 바뀔 때 같은 열람 주소에서 개정 내용이 반영됩니다. 개정에 따른 추가 비용은 없고, 개정을 이유로 한 환불도 해당하지 않습니다.</p>`);

  await page('terms', '이용약관', '더 핀다 전자책 서비스 이용약관.', `<h1>이용약관</h1>
<h2>제1조 목적</h2><p>이 약관은 ${esc(PUBLISHER)}(이하 "판매자")가 the.pinda.kr(이하 "사이트")에서 제공하는 전자책 열람 서비스의 이용 조건을 정합니다.</p>
<h2>제2조 서비스 내용</h2><p>판매자는 결제가 완료된 이용자에게 전자책 「${esc(BOOK.title)}」을 사이트 안에서 웹으로 열람할 수 있는 권한을 제공합니다. 열람 권한은 주문별 열람 주소와 결제 때 입력한 이메일·휴대폰 번호로 확인합니다. 브라우저 인쇄 기능을 통한 개인 보관용 PDF 저장이 가능합니다.</p>
<h2>제3조 결제</h2><p>결제는 페이앱(PayApp) 결제창을 통해 이루어지며, 판매자는 카드 정보를 저장하지 않습니다. 가격은 사이트에 공개된 가격 일정에 따라 변동되며, 결제 시점의 표시 가격이 적용됩니다.</p>
<h2>제4조 이용자의 의무</h2><p>이용자는 전자책을 개인 열람 목적으로만 사용해야 하며, 열람 주소를 타인에게 공유하거나 본문을 복제·배포·재판매·공개 게시할 수 없습니다. 위반 시 열람 권한이 중단될 수 있고 저작권법에 따른 책임을 질 수 있습니다.</p>
<h2>제5조 환불</h2><p>환불은 별도의 <a href="/refund">환불 규정</a>에 따릅니다.</p>
<h2>제6조 내용의 변경과 면책</h2><p>판매자는 전자책 내용을 수정·보완할 수 있으며 개정 내용은 같은 열람 주소에서 제공됩니다. 전자책의 내용은 개인 경험을 바탕으로 한 정보 제공이며 특정 수익이나 결과를 보장하지 않습니다. 세금·보험·플랫폼 정책 등 외부 기준은 변경될 수 있으므로 이용자는 공식 경로에서 확인해야 합니다.</p>
<h2>제7조 분쟁</h2><p>서비스 이용과 관련한 분쟁은 당사자 간 협의로 해결하며, 협의가 되지 않을 경우 관련 법령과 소비자분쟁해결기준에 따릅니다.</p>
<p class="fine">시행일: 2026년 10월 26일</p>`);

  await page('privacy', '개인정보처리방침', '더 핀다 전자책 서비스의 개인정보 수집·이용·보관 안내.', `<h1>개인정보처리방침</h1>
<h2>1. 수집하는 항목과 목적</h2><ul><li><b>이메일, 휴대폰 번호</b>: 주문 식별, 열람 권한 확인과 복구, 환불 처리. 결제 시 이용자가 직접 입력합니다.</li><li><b>결제 정보</b>: 결제는 페이앱(PayApp)에서 처리되며 판매자는 결제 승인 결과(주문번호, 금액, 결제수단 종류)만 받습니다. 카드번호는 수집하지 않습니다.</li><li><b>접속 정보</b>: 브라우저 종류, 접속 국가 코드가 주문 기록에 함께 저장되며 부정 사용 방지에만 씁니다.</li><li><b>후기</b>: 이용자가 직접 입력한 표시 이름과 후기 내용은 사이트에 공개됩니다.</li></ul>
<h2>2. 보관 기간</h2><p>주문 정보는 「전자상거래 등에서의 소비자보호에 관한 법률」에 따라 계약·결제 기록 5년, 소비자 불만·분쟁 처리 기록 3년 동안 보관한 뒤 삭제합니다. 열람 권한 쿠키는 1년간 유지됩니다.</p>
<h2>3. 제3자 제공과 처리 위탁</h2><p>결제 처리를 위해 페이앱(㈜운영사)에 결제에 필요한 정보가 전달됩니다. 그 외 제3자에게 제공하지 않습니다. 서비스는 Cloudflare의 서버 인프라에서 운영됩니다.</p>
<h2>4. 쿠키</h2><p>열람 권한 확인을 위한 서명 쿠키(eb_acc)를 사용합니다. 광고 추적 쿠키는 사용하지 않습니다.</p>
<h2>5. 이용자의 권리</h2><p>이용자는 자신의 정보 열람·수정·삭제를 판매자 이메일로 요청할 수 있습니다. 단, 법령에 따라 보관해야 하는 기록은 보관 기간 동안 삭제가 제한됩니다.</p>
<h2>6. 책임자</h2><p>개인정보 보호 책임자: 판매자(페이지 하단 연락처). 시행일: 2026년 10월 26일</p>`);

  await fs.writeFile(path.join(OUT, '404.html'), layout({ title: `페이지를 찾을 수 없어요 | ${BRAND}`, desc: '요청한 페이지가 없습니다.', url: `${SITE}/404`, noindex: true, bar: false, extraHead: PAGE_CSS,
    body: `<div class="wrap"><div class="page" style="text-align:center;padding:40px 0"><h1>이 주소에는 페이지가 없어요</h1><p>주소가 바뀌었거나 잘못 입력된 것 같아요.</p><a class="btn" href="/">책 소개로 가기</a> <a class="btn ghost" href="/blog/">블로그 보기</a></div></div>` }));
}

/* ---------- 사이트맵 · robots ---------- */
async function buildSeo(posts) {
  const urls = [
    { loc: `${SITE}/`, pri: '1.0', freq: 'weekly' }, { loc: `${SITE}/blog/`, pri: '0.9', freq: 'weekly' },
    ...Object.values(CATS).map(c => ({ loc: `${SITE}/blog/category/${c.slug}`, pri: '0.7', freq: 'weekly' })),
    ...posts.map(p => ({ loc: `${SITE}/blog/${p.slug}`, pri: '0.8', freq: 'monthly', mod: p.date })),
    { loc: `${SITE}/refund`, pri: '0.3', freq: 'yearly' }, { loc: `${SITE}/terms`, pri: '0.2', freq: 'yearly' }, { loc: `${SITE}/privacy`, pri: '0.2', freq: 'yearly' },
  ];
  await fs.writeFile(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u.loc}</loc><lastmod>${u.mod || today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join('\n')}\n</urlset>\n`);
  await fs.writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /read\nDisallow: /thanks\nDisallow: /recover\nDisallow: /admin\nDisallow: /api/\nDisallow: /pay/\n\nUser-agent: GPTBot\nAllow: /\nUser-agent: ClaudeBot\nAllow: /\nUser-agent: PerplexityBot\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
}

/* ---------- 실행 ---------- */
await fs.mkdir(OUT, { recursive: true });
const book = await buildBook();
await buildLanding(book);
const posts = await buildBlog();
await buildPages();
await buildSeo(posts);
await renderOg();
console.log('빌드 완료 →', OUT);
