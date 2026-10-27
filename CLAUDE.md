# theredincome1 — the.pinda.kr 전자책 판매 사이트

스레드 제휴마케팅 전자책(『50세 주부, 스레드로 월 100만 원 벌어본 이야기』)을 파는 사이트. Cloudflare Worker + 페이앱(PayApp) 결제. 사용자는 1인 운영자이며 한국어로 답한다. 결론 먼저, 군더더기 없이.

## 현재 상태 (2026-10-27)
- 배포 완료: https://the.pinda.kr (main에 push하면 GitHub Actions가 빌드 → 구문검사 → D1 스키마 → wrangler deploy → 비밀값 반영)
- 결제 흐름 로컬 검증 완료(테스트 결제창). **실제 페이앱 결제는 아직 미검증**: GitHub 시크릿 `PAYAPP_USER_ID`, `PAYAPP_LINK_KEY`, `PAYAPP_LINK_VAL`, `PAYAPP_API_KEY`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `BIZ_*` 가 등록돼야 배포 때 Worker에 반영됨. 없으면 테스트 결제창이 뜸.
- 페이앱 판매자 설정에서 `https://the.pinda.kr/api/pay/feedback` 수신 허용 확인 필요.

## 구조
- `src/config.js` 가격 단계(`PRICE_STEPS`), 책 정보, 무료 장, FAQ, 초기 후기(`SEED_REVIEWS`). 가격은 이 한 곳이 랜딩 표기·카운트다운·실제 결제 금액을 모두 결정.
- `src/worker.js` API(주문·페이앱 feedback·열람·복구·후기·관리자) + `/read` 렌더링. `src/reader.js` 본문 화면.
- `content/book/*.md` 전자책 본문, `content/blog/*.md` 블로그(카테고리 정보/노하우). 글 프론트매터의 `hook`/`thread`/`reply`/`kakao` 가 "퍼가기 세트"(정사각 카드·스레드 본문·첫 답글·카톡 한 줄)가 됨.
- `tools/build.mjs` content → `public/`(랜딩·블로그·안내·sitemap·robots·rss·OG·정사각 카드) + `src/book.generated.mjs`(git 제외). `tools/mocks.mjs` 화면 재현 SVG.
- D1: 핀다AI와 같은 DB(`pindaai`) 공유, 표는 `eb_` 접두어(`schema.sql`).

## 명령
```
npm i
npx wrangler d1 execute pindaai --local --file schema.sql
npm run dev      # 빌드 후 http://localhost:8787 (페이앱 키 없으면 테스트 결제창)
npm run check    # 구문 검사
npm run build
```

## 지켜야 할 원칙
- 수익 수치는 "가명·재구성, 보장 없음"을 책과 페이지에서 유지. 광고 문구에 "월 100만 원"만 단독으로 쓰지 않는다.
- 쿠팡파트너스 대가성 문구, 효능·치료 표현 금지 등 책이 가르치는 규칙을 콘텐츠도 스스로 지킨다.
- 인상 일정은 `PRICE_STEPS`에 실제로 반영된 것만 표기(허위 긴박감 금지).
- 환불: 유료 본문 미열람 7일 내 전액(`/refund`). 주문의 `openedAt`으로 열람 여부 판단.
- 비밀값·키는 절대 저장소에 넣지 않는다.

## 다음 할 일 후보
1. 실제 페이앱 결제 1건 테스트(소액 → 취소) 후 feedback·열람·환불 흐름 확인
2. `/admin` 로그인, 판매자 정보(`BIZ_*`) 하단 표시 확인
3. 실제 구매 후기가 쌓이면 `SEED_REVIEWS` 비우기
4. 구글 서치콘솔·네이버 서치어드바이저에 sitemap 제출, 블로그 글 확장
5. 글별 퍼가기 카드를 스레드·블로그스팟 등에 발행하는 자동화 스크립트
