// 결제 완료 독자에게 보여 주는 전자책 본문 화면 (Worker가 렌더링, 검색엔진 비노출)
import { BOOK, BRAND } from './config.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export const READER_CSS = `
*{box-sizing:border-box}
:root{--paper:#faf6ef;--ink:#1f1b16;--ink2:#4a433b;--muted:#8a8178;--line:#e6ddd0;--accent:#1f5f4a;--accent2:#c2410c;--card:#fff;--hl:#fff3c4}
@media (prefers-color-scheme:dark){:root{--paper:#17150f;--ink:#f3ede3;--ink2:#d6cdbf;--muted:#9c9385;--line:#2c2820;--accent:#7dd3b0;--accent2:#fb923c;--card:#1f1c15;--hl:#3a3119}}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:'Noto Serif KR',Pretendard,-apple-system,system-ui,serif;line-height:1.9;font-size:var(--fs,17px);-webkit-text-size-adjust:100%;word-break:keep-all}
a{color:var(--accent)}
.top{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--paper) 90%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.top .in{max-width:1080px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:10px 14px;font-family:Pretendard,system-ui,sans-serif}
.top b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1 1 auto;min-width:0}
.top .sp{display:none}
.top select{max-width:120px;flex:0 0 auto}
.top button,.top select{height:34px;flex:0 0 auto;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:9px;font:inherit;font-size:13px;padding:0 10px;cursor:pointer}
.prog{height:3px;background:var(--line)}.prog i{display:block;height:100%;width:0;background:var(--accent);transition:width .2s}
.lay{max-width:1080px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr);gap:28px;padding:18px 14px 80px}
@media (min-width:900px){.lay{grid-template-columns:250px minmax(0,1fr)}}
nav.toc{display:none;font-family:Pretendard,system-ui,sans-serif}
@media (min-width:900px){nav.toc{display:block;position:sticky;top:64px;align-self:start;max-height:calc(100vh - 80px);overflow:auto;font-size:13.5px}}
nav.toc a{display:block;padding:7px 10px;border-radius:8px;color:var(--ink2);text-decoration:none;border-left:2px solid transparent}
nav.toc a.on{background:var(--card);color:var(--accent);border-left-color:var(--accent);font-weight:700}
nav.toc .h{font-size:12px;color:var(--muted);margin:14px 10px 6px;text-transform:uppercase;letter-spacing:.08em}
article{max-width:680px;margin:0 auto;width:100%;min-width:0}
.ch{padding:34px 0 10px;border-top:1px dashed var(--line)}
.ch:first-child{border-top:0;padding-top:12px}
.ch .num{font-family:Pretendard,system-ui,sans-serif;font-size:13px;color:var(--accent2);font-weight:700;letter-spacing:.06em}
.ch h2{font-size:clamp(23px,4.5vw,30px);line-height:1.35;margin:6px 0 22px;letter-spacing:-.01em}
.ch h3{font-size:1.12em;margin:34px 0 10px;font-family:Pretendard,system-ui,sans-serif}
.ch p{margin:0 0 1.15em;color:var(--ink2)}
.ch ul,.ch ol{margin:0 0 1.2em;padding-left:1.4em;color:var(--ink2)}.ch li{margin-bottom:.45em}
.ch blockquote{margin:1.4em 0;padding:14px 18px;background:var(--card);border-left:3px solid var(--accent2);border-radius:0 12px 12px 0;color:var(--ink2);font-style:normal}
.ch table{width:100%;border-collapse:collapse;font-family:Pretendard,system-ui,sans-serif;font-size:.88em;margin:0 0 1.3em;display:block;overflow-x:auto;white-space:nowrap}
.ch th,.ch td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}.ch th{background:var(--card)}
@media (min-width:600px){.ch table{display:table;white-space:normal}}
.ch mark{background:var(--hl);color:inherit;padding:0 .15em;border-radius:3px}
.box{margin:1.4em 0;padding:16px 18px;border:1px solid var(--line);border-radius:14px;background:var(--card);font-family:Pretendard,system-ui,sans-serif;font-size:.93em}
.box b.t{display:block;margin-bottom:6px;color:var(--accent)}
.copy{margin:1.2em 0;padding:14px 16px;border-radius:12px;background:var(--card);border:1px dashed var(--line);font-family:Pretendard,system-ui,sans-serif;font-size:.9em;white-space:pre-wrap;position:relative}
.copy button{position:absolute;right:10px;top:10px;height:28px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink2);font:inherit;font-size:12px;padding:0 9px;cursor:pointer}
figure.mock{margin:1.6em 0}figure.mock svg{width:100%;height:auto;display:block;border-radius:14px;border:1px solid var(--line);background:#fff}
figure.mock figcaption{font-family:Pretendard,system-ui,sans-serif;font-size:12.5px;color:var(--muted);margin-top:8px;text-align:center}
.pn{display:flex;justify-content:space-between;gap:10px;margin:30px 0 0;font-family:Pretendard,system-ui,sans-serif;font-size:14px}
.pn a{padding:10px 14px;border:1px solid var(--line);border-radius:10px;text-decoration:none;background:var(--card);color:var(--ink2)}
.end{margin-top:50px;padding:24px;border-radius:18px;background:var(--card);border:1px solid var(--line);font-family:Pretendard,system-ui,sans-serif}
.end h3{margin:0 0 8px;font-size:18px}.end p{font-size:14px;color:var(--ink2);margin:0 0 14px}
.end label{display:block;font-size:13px;color:var(--muted);margin:10px 0 4px}
.end input,.end textarea{width:100%;border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;background:var(--paper);color:var(--ink)}
.end textarea{min-height:96px;resize:vertical}
.stars{display:flex;gap:4px;font-size:26px;cursor:pointer;user-select:none}.stars span{color:#d6cfc4}.stars span.on{color:#f59e0b}
.end button{margin-top:12px;height:44px;border:0;border-radius:10px;background:var(--accent);color:#fff;font:inherit;font-weight:700;padding:0 18px;cursor:pointer}
.msg{font-size:13px;margin-top:8px;color:var(--accent2)}
.linkbox{margin-top:18px;font-size:13px;color:var(--muted)}.linkbox code{display:block;word-break:break-all;background:var(--paper);padding:8px 10px;border-radius:8px;margin-top:6px;font-size:12px}
@media (max-width:480px){.top b{font-size:13px}.top .in{gap:6px;padding:10px 10px}}
@media print{.top,nav.toc,.pn,.end,.linkbox{display:none!important}body{background:#fff;color:#000;font-size:11.5pt}.lay{display:block;padding:0}.ch{page-break-before:always;border:0}.ch:first-child{page-break-before:auto}figure.mock svg{border:1px solid #ddd}}
`;

export function readerPage({ chapters, order, biz, base }) {
  const readUrl = `${base}/read?o=${order.id}&t=${order.token}`;
  const nav = chapters.map(ch => `<a href="#${ch.id}" data-id="${ch.id}">${esc(ch.num ? ch.num + '. ' : '')}${esc(ch.title)}</a>`).join('');
  const body = chapters.map((ch, i) => `<section class="ch" id="${ch.id}">
  <div class="num">${esc(ch.num ? `제${ch.num}장` : (ch.kind || ''))}</div><h2>${esc(ch.title)}</h2>
  ${ch.html}
  <div class="pn">${i ? `<a href="#${chapters[i - 1].id}">← ${esc(chapters[i - 1].title)}</a>` : '<span></span>'}${i < chapters.length - 1 ? `<a href="#${chapters[i + 1].id}">${esc(chapters[i + 1].title)} →</a>` : ''}</div>
</section>`).join('');
  const seller = biz?.name ? `판매자 ${esc(biz.name)}${biz.email ? ` · ${esc(biz.email)}` : ''}` : '';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>${esc(BOOK.title)} · 본문</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" as="style" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>${READER_CSS}</style></head><body>
<div class="top"><div class="in"><b>${esc(BOOK.title)}</b><span class="sp"></span>
<select id="jump" aria-label="장 이동"><option value="">목차</option>${chapters.map(ch => `<option value="${ch.id}">${esc(ch.num ? ch.num + '. ' : '')}${esc(ch.title)}</option>`).join('')}</select>
<button id="fsm" title="글자 작게">가−</button><button id="fsp" title="글자 크게">가+</button><button onclick="print()" title="PDF로 저장">PDF</button></div><div class="prog"><i id="prog"></i></div></div>
<div class="lay"><nav class="toc"><div class="h">목차</div>${nav}</nav>
<article>${body}
<div class="end" id="review"><h3>이 책, 어땠나요?</h3><p>읽고 나서 남는 한 줄을 적어 주세요. 다음 독자에게 보이고, 개정판에 반영합니다. (주문당 1회)</p>
<div class="stars" id="stars">${[1, 2, 3, 4, 5].map(n => `<span data-n="${n}">★</span>`).join('')}</div>
<label>표시할 이름 (예: 미숙 (52, 주부))</label><input id="rname" maxlength="24" placeholder="가명도 괜찮아요">
<label>후기</label><textarea id="rbody" maxlength="400" placeholder="어느 장이 도움이 됐는지, 어떤 점이 아쉬웠는지"></textarea>
<button id="rsend">후기 남기기</button><div class="msg" id="rmsg"></div>
<div class="linkbox">이 책은 아래 주소에서 언제든 다시 열 수 있어요. 메모장이나 카카오톡 '나에게 보내기'에 저장해 두세요. 잃어버리면 결제한 이메일·휴대폰으로 <a href="/recover">복구</a>할 수 있습니다.<code id="rl">${esc(readUrl)}</code>
<button class="ghost" style="margin-top:8px;height:32px;background:var(--paper);color:var(--ink2);border:1px solid var(--line)" onclick="navigator.clipboard.writeText(document.getElementById('rl').textContent).then(()=>this.textContent='복사됐어요')">주소 복사</button></div>
<p style="font-size:12px;color:var(--muted);margin-top:16px">© ${new Date().getFullYear()} ${esc(BRAND)}. 이 전자책은 구매자 개인의 열람용입니다. 무단 복제·배포·재판매를 금합니다. ${seller}</p>
</div></article></div>
<script>
const ORDER=${JSON.stringify({ id: order.id, token: order.token })};
const $=s=>document.querySelector(s);
let fs=+localStorage.getItem('fs')||17;const apply=()=>{document.documentElement.style.setProperty('--fs',fs+'px');localStorage.setItem('fs',fs)};apply();
$('#fsm').onclick=()=>{fs=Math.max(14,fs-1);apply()};$('#fsp').onclick=()=>{fs=Math.min(24,fs+1);apply()};
$('#jump').onchange=e=>{if(e.target.value)location.hash=e.target.value;e.target.value=''};
const secs=[...document.querySelectorAll('.ch')],links=[...document.querySelectorAll('nav.toc a')];
function onScroll(){const h=document.documentElement;$('#prog').style.width=(h.scrollTop/(h.scrollHeight-h.clientHeight)*100||0)+'%';
let cur=secs[0];for(const s of secs)if(s.getBoundingClientRect().top<120)cur=s;links.forEach(a=>a.classList.toggle('on',a.dataset.id===cur.id))}
addEventListener('scroll',onScroll,{passive:true});onScroll();
let stars=0;$('#stars').onclick=e=>{const n=+e.target.dataset.n;if(!n)return;stars=n;[...$('#stars').children].forEach(s=>s.classList.toggle('on',+s.dataset.n<=n))};
$('#rsend').onclick=async()=>{const m=$('#rmsg');if(!stars)return m.textContent='별점을 먼저 눌러 주세요.';
const r=await fetch('/api/review',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderId:ORDER.id,token:ORDER.token,stars,name:$('#rname').value,body:$('#rbody').value})});
const j=await r.json();m.textContent=j.ok?'고맙습니다. 후기가 등록됐어요.':(j.error||'다시 시도해 주세요.')};
document.querySelectorAll('.copy button').forEach(b=>b.onclick=()=>{navigator.clipboard.writeText(b.parentElement.textContent.replace(/복사(됐어요)?$/,'').trim()).then(()=>b.textContent='복사됐어요')});
</script></body></html>`;
}
