# theredincome1 — the.pinda.kr 전자책 판매 사이트

핀다AI(pinda.kr)와 같은 Cloudflare 계정에서 돌아가는 **별도 Worker, 별도 저장소**입니다. 결제는 핀다AI의 페이앱(PayApp) 구조를 그대로 가져왔고, 로그인 없이 "주문 → 결제창 → 열람 링크" 흐름으로 줄였습니다.

```
.
├─ wrangler.toml        Worker 설정 (the.pinda.kr 커스텀 도메인, 핀다AI D1 공유)
├─ schema.sql           D1 표 (eb_orders, eb_reviews)
├─ src/config.js        가격 단계·인상 일정, 책 정보, 무료 장, FAQ, 초기 후기  ← 운영 중 고칠 건 거의 여기
├─ src/worker.js        API(주문·결제통보·열람·복구·후기·관리자) + /read 렌더링
├─ src/reader.js        결제 완료 독자용 본문 화면
├─ src/book.generated.mjs  빌드가 만드는 파일 (git 제외, 직접 수정 금지)
├─ src/og-card.mjs      공유 썸네일 디자인 (핀다AI 저장소의 사본)
├─ content/book/*.md    전자책 본문 (장별, 프론트매터 + HTML, [[mock:...]] 토큰으로 화면 재현 삽화)
├─ content/blog/*.md    블로그 글 (category: 정보 | 노하우)
├─ tools/build.mjs      content → public/ (랜딩·블로그·안내·sitemap·robots·rss·OG 썸네일) + book.generated.mjs
├─ tools/mocks.mjs      스레드 글/프로필, 파트너스 리포트, 월별 그래프, 루틴표 SVG 생성기
└─ public/              빌드 결과 (git 제외. Worker가 먼저 받고 나머지를 여기서 서빙)
```

## 처음 한 번

1. GitHub 저장소 시크릿 2개: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (핀다AI 저장소와 같은 값)
2. Worker 비밀값 (PC에서 `npm i` 후):
```
npx wrangler secret put SESSION_SECRET        # 아무 긴 난수 (열람 쿠키 서명)
npx wrangler secret put PAYAPP_USER_ID        # 핀다AI와 같은 페이앱 계정 값
npx wrangler secret put PAYAPP_LINK_KEY
npx wrangler secret put PAYAPP_LINK_VAL
npx wrangler secret put PAYAPP_API_KEY        # 있으면 hash 검증까지
npx wrangler secret put ADMIN_PASSWORD        # /admin
npx wrangler secret put BIZ_NAME              # 판매자 표시 (BIZ_CEO, BIZ_REG_NO, BIZ_MAIL_ORDER_NO, BIZ_ADDRESS, BIZ_PHONE, BIZ_EMAIL 도 같은 식)
```
- 페이앱 판매자 페이지의 **feedbackurl 허용/도메인 설정**에 `https://the.pinda.kr/api/pay/feedback` 이 막히지 않는지 확인.
- 페이앱 키가 없으면 자동으로 **테스트 결제창**(/pay/mock)이 뜹니다. 실제 결제는 키를 넣은 뒤부터.
- 사업자라면 `wrangler.toml` [vars] 의 `BIZ_TYPE = "business"` 로 바꾸면 상호·대표·사업자번호·통신판매업신고가 표시됩니다.

## 배포
main 에 push 되면 `.github/workflows/deploy.yml` 이 빌드 → 구문검사 → D1 스키마 → `wrangler deploy` 를 실행합니다. 수동은:
```
npm run deploy
npx wrangler d1 execute pindaai --remote --file schema.sql   # 처음 한 번 (IF NOT EXISTS)
```
커스텀 도메인 `the.pinda.kr` 은 첫 배포 때 Cloudflare 가 DNS 레코드를 자동으로 만듭니다 (pinda.kr 존이 같은 계정에 있으므로).

## 로컬 실행
```
npm i
npx wrangler d1 execute pindaai --local --file schema.sql
npm run dev          # 빌드 후 http://localhost:8787 (페이앱 키가 없으므로 테스트 결제창)
```

## 운영 메모
- **가격 인상 일정**: `src/config.js` 의 `PRICE_STEPS` 한 곳. 랜딩 표기·카운트다운·실제 결제 금액이 같이 바뀜 (빌드 후 배포).
- **본문 수정**: `content/book/*.md` 고치고 빌드·배포하면 기존 구매자도 같은 열람 링크에서 개정 내용을 봄.
- **퍼가기 세트**: 글마다 정사각 카드(public/card), 스레드 본문(링크 없음)·첫 답글(링크)·카톡 한 줄이 자동 생성됨. 문구는 각 글 프론트매터의 `hook`/`thread`/`reply`/`kakao`.
- **후기**: 구매자가 본문 끝에서 남김(주문당 1개). `/admin` 에서 숨김 처리. `SEED_REVIEWS`(가명 사전 독자 피드백)는 실제 후기가 쌓이면 비우는 것을 권장.
- **환불**: 주문의 `openedAt`(유료 본문 첫 열람 시각)이 /admin 에 표시됨. 환불 규정(/refund)은 미열람 7일 전액.
- **흐름**: `/api/order` → 페이앱 결제창 → `/pay/return` → `/thanks?o=…`(상태 폴링) → `/read?o=…&t=…`. 다른 기기는 토큰 링크 또는 `/recover`(이메일+휴대폰).
