import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { chromium, firefox } from 'playwright';
import pg from 'pg';
import { hashPassword } from '../lib/security.js';

const BASE = 'http://localhost:3000';
const db = new pg.Pool({
  connectionString:
    'postgresql://wordsky_test:wordsky_local_only@127.0.0.1:5547/wordsky_v6_test',
  ssl: false
});

const qaIds = [];
let chrome, fox;

const pass = name => console.log('PASS: ' + name);
const randomName = () => 'qa' + randomBytes(7).toString('hex');

const wait = async (fn, ms = 10000) => {
  const start = Date.now();
  do {
    if (await fn()) return;
    await new Promise(r => setTimeout(r, 150));
  } while (Date.now() - start < ms);
  throw Error('Timed out waiting for database/UI state');
};

async function createUser() {
  const username = randomName();
  const password = randomBytes(24).toString('hex');

  const { rows } = await db.query(
    `INSERT INTO ws_users(username,display_name,password_hash)
     VALUES($1,$2,$3) RETURNING id`,
    [username, 'Local UI QA', hashPassword(password)]
  );

  const id = rows[0].id;
  qaIds.push(id);
  return { id, username, password };
}

async function signIn(ctx, user) {
  const res = await ctx.request.post(BASE + '/api/auth/login', {
    headers: { origin: BASE },
    data: { username: user.username, password: user.password }
  });

  assert.equal(res.status(), 200, await res.text());

  const me = await ctx.request.get(BASE + '/api/auth/me');
  assert.equal(
    (await me.json()).actor?.id,
    user.id,
    'API server is not using the same local PostgreSQL DB'
  );
}

try {
  const name = (await db.query(
    'SELECT current_database() AS name'
  )).rows[0].name;
  assert.equal(name, 'wordsky_v6_test');

  const count = (await db.query(`
    SELECT count(*)::int AS n
    FROM information_schema.tables
    WHERE table_schema='public'
    AND table_name IN (
      'ws_learning_flashcard_reviews',
      'ws_learning_word_progress',
      'ws_personal_cards',
      'ws_personal_card_reviews',
      'ws_personal_card_progress',
      'ws_learning_review_requests',
      'ws_user_srs_schedules'
    )
  `)).rows[0].n;
  assert.equal(count, 7);

  const shared = (await db.query(`
    SELECT w.id,w.english
    FROM ws_words w
    JOIN ws_topics t ON t.id=w.topic_id
    WHERE w.enabled=true AND t.enabled=true
    ORDER BY w.id LIMIT 1
  `)).rows[0];
  assert.ok(shared, 'Local vocabulary is empty');

  const user = await createUser();
  const other = await createUser();

  chrome = await chromium.launch({ headless: true });
  fox = await firefox.launch({ headless: true });

  const ctxA = await chrome.newContext();
  const ctxB = await fox.newContext();
  const ctxOther = await chrome.newContext();

  await signIn(ctxA, user);
  await signIn(ctxB, user);
  await signIn(ctxOther, other);
  pass('Local PostgreSQL and authenticated server match');

  const A = await ctxA.newPage();
  const B = await ctxB.newPage();
  const C = await ctxOther.newPage();

  await Promise.all([
    A.goto(BASE + '/progress.html'),
    B.goto(BASE + '/progress.html')
  ]);

  for (const page of [A, B]) {
    await page.waitForFunction(() =>
      document.getElementById('ws10SourceBadge')
        ?.textContent === 'ACCOUNT · POSTGRESQL'
    );
    await page.locator('#ws24Srs')
      .waitFor({ state: 'visible' });
  }
  pass('Chromium and Firefox render account My Learning');

  await A.locator('#ws10Search').fill(shared.english);
  await A.getByRole('button', {
    name: 'Đánh dấu đã nhớ: ' + shared.english,
    exact: true
  }).first().click();

  await wait(async () => {
    const p = (await db.query(
      `SELECT remembered,review_count
       FROM ws_learning_word_progress
       WHERE user_id=$1 AND word_id=$2`,
      [user.id, shared.id]
    )).rows[0];

    return p?.remembered === true && p.review_count === 1;
  });
  pass('Chromium saves a shared review to PostgreSQL');

  await B.reload();
  await B.waitForFunction(() =>
    document.getElementById('ws10Known')?.textContent === '1'
  );
  pass('Firefox sees Chromium progress after refresh');

  const unique = randomName();

  await B.goto(BASE + '/personal.html');
  await B.locator('#personalAccount')
    .waitFor({ state: 'visible' });

  await B.locator('#personalTopic').fill('Browser QA');
  await B.locator('#personalEnglish').fill(unique);
  await B.locator('#personalMeaning').fill('Tu kiem thu');
  await B.locator('#personalSave').click();

  await B.locator('#personalList .word-row')
    .filter({ hasText: unique }).waitFor();

  await A.goto(BASE + '/personal.html');
  await A.locator('#personalList .word-row')
    .filter({ hasText: unique }).waitFor();

  pass('Personal word syncs between Firefox and Chromium');

  const row = A.locator('#personalList .word-row')
    .filter({ hasText: unique });

  await row.getByRole('button', { name: 'Cần ôn' }).click();

  await A.waitForFunction(name => {
    const row = [...document.querySelectorAll(
      '#personalList .word-row'
    )].find(e => e.textContent.includes(name));

    return row?.querySelector('small')
      ?.textContent.includes('Cần ôn') === true;
  }, unique);

  await B.goto(BASE + '/progress.html');
  await B.locator('#ws24Srs')
    .waitFor({ state: 'visible' });

  await B.locator('#ws24Status').selectOption('due');
  await B.locator('#ws24List .ws24-card')
    .filter({ hasText: unique }).waitFor();

  pass('Personal review appears in SRS Due on Firefox');

  await B.locator('#ws24Status').selectOption('upcoming');
  await B.locator('#ws24List .ws24-card')
    .filter({ hasText: shared.english }).waitFor();

  const upcomingCard = B.locator('#ws24List .ws24-card')
    .filter({hasText:shared.english}).first();

  const earlyButton = upcomingCard.getByRole('button',{
    name:'✓ Ôn sớm (giữ nguyên lịch): '+shared.english
  });
  const reviewNowButton = upcomingCard.getByRole('button',{
    name:'↻ Cần ôn ngay: '+shared.english
  });

  await earlyButton.waitFor();
  await reviewNowButton.waitFor();

  const scheduleSql = `
    SELECT due_at,review_count
    FROM ws_user_srs_schedules
    WHERE user_id=$1 AND source='shared' AND word_id=$2
  `;

  const params = [user.id,shared.id];
  const before = (await db.query(scheduleSql,params)).rows[0];

  assert.equal(before.review_count,1);
  await earlyButton.click();

  await wait(async()=>{
    const after = (await db.query(scheduleSql,params)).rows[0];
    return after?.review_count===2 &&
      after.due_at.toISOString()===before.due_at.toISOString();
  });

  pass('Upcoming early review preserves PostgreSQL due date');

  await B.locator('.ws24-advanced > summary').click();
  await B.locator('#ws24Audit').click();

  await B.waitForFunction(() =>
    document.getElementById('ws24AuditResult')
      ?.textContent.includes('Hoàn tất')
  );

  const diagnostic = await ctxB.request.get(
    BASE + '/api/learning/srs/diagnostics'
  );
  assert.equal((await diagnostic.json()).mismatched, 0);

  pass('SRS Upcoming and persisted schedules are consistent');

  await C.goto(BASE + '/personal.html');
  await C.locator('#personalAccount')
    .waitFor({ state: 'visible' });

  assert.equal(await C.locator('#personalTotal').innerText(), '0');

  assert.equal(
    await C.locator('#personalList .word-row')
      .filter({ hasText: unique }).count(),
    0
  );

  await C.goto(BASE + '/progress.html');
  await C.waitForFunction(() =>
    document.getElementById('ws10SourceBadge')
      ?.textContent === 'ACCOUNT · POSTGRESQL'
  );
  assert.equal(await C.locator('#ws10Known').innerText(), '0');

  // UX59.16: never count an empty SRS UI before its account query settles.
  await C.locator('#ws24Srs').waitFor({ state: 'visible' });
  await C.waitForFunction(() =>
    document.querySelector('#ws24Notice')?.textContent
      .includes('Lịch ôn được đọc từ PostgreSQL theo tài khoản.') &&
    document.querySelector('#ws24Reload')?.disabled === false
  );
  for (const status of ['due', 'upcoming']) {
    if (status !== 'due') {
      const responsePromise = C.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === '/api/learning/srs/queue' &&
          url.searchParams.get('status') === status &&
          response.request().method() === 'GET';
      });
      await C.locator('#ws24Status').selectOption(status);
      const response = await responsePromise;
      assert.equal(response.status(), 200);
      await C.waitForFunction(() =>
        document.querySelector('#ws24Reload')?.disabled === false &&
        document.querySelector('#ws24Notice')?.textContent
          .includes('Lịch ôn được đọc từ PostgreSQL theo tài khoản.')
      );
    }
    const result = await ctxOther.request.get(
      BASE + '/api/learning/srs/queue?status=' + status + '&page=0&size=20'
    );
    assert.equal(result.status(), 200, await result.text());
    const queue = await result.json();
    assert.equal(queue.actor_id, other.id,
      'SRS API returned another account for ' + status);
    assert.ok(Array.isArray(queue.words));
    assert.equal(queue.words.some(word => word.english === unique), false,
      'SRS API exposed private card in ' + status);
    assert.equal(
      await C.locator('#ws24List .ws24-card')
        .filter({ hasText: unique }).count(),
      0,
      'SRS UI exposed private card in ' + status
    );
  }
  pass('Different account cannot see private SRS cards in Due or Upcoming');

  pass('Different account cannot see personal learning data');

  await A.reload();
  await A.locator('#personalList .word-row')
    .filter({ hasText: unique }).waitFor();

  pass('Reload preserves personal vocabulary');
  for (const viewport of [
    {width:360,height:800},
    {width:390,height:844}
  ]) {
    await B.setViewportSize(viewport);
    await B.locator('#ws24Status').selectOption('upcoming');

    const card = B.locator('#ws24List .ws24-card')
      .filter({hasText:shared.english}).first();

    await card.waitFor({state:'visible'});

      const measurements = await B.waitForFunction(
        english => {
          const card = [...document.querySelectorAll(
            '#ws24List .ws24-card'
          )].find(el =>
            el.querySelector('.ws24-card-body strong')
              ?.textContent?.trim() === english
          );

          if (!card) return false;

          const labels = [
            '↻ Cần ôn ngay: ' + english,
            '✓ Ôn sớm (giữ nguyên lịch): ' + english
          ];

          const buttons = labels.map(label =>
            [...card.querySelectorAll('button')].find(
              el => el.getAttribute('aria-label') === label
            )
          );

          if (buttons.some(el =>
            !el || !el.isConnected ||
            el.getClientRects().length === 0
          )) return false;

          return buttons.map(el => {
            const r = el.getBoundingClientRect();
            return { x: r.x, right: r.right, height: r.height };
          });
        },
        shared.english,
        { timeout: 15000, polling: 'raf' }
      ).then(handle => handle.jsonValue());

      assert.equal(measurements.length, 2);

      for (const rect of measurements) {
        assert.ok(
          rect.x >= -1 &&
          rect.right <= viewport.width + 1 &&
          rect.height >= 35,
          'Mobile action overflows at ' + viewport.width + 'px'
        );
      }

    const overflow = await B.evaluate(() =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
    );

    assert.ok(overflow <= 1,
      'Horizontal page overflow at '+viewport.width+'px'
    );

    await B.locator('#ws24Srs').screenshot({
      path:'/tmp/wordsky-upcoming-'+viewport.width+'.png'
    });

    pass('Upcoming mobile layout '+viewport.width+'px');
  }

  // UX51: authenticated cross-browser verb practice history, no SRS side effects.
  const beforeSrs=(await db.query('SELECT count(*)::int n FROM ws_user_srs_schedules WHERE user_id=$1',[user.id])).rows[0].n;
  const emptyHistory=await ctxB.request.get(BASE+'/api/learning/verbs/history');
  assert.equal(emptyHistory.status(),200);
  assert.equal((await emptyHistory.json()).summary.runs,0);
  const attempts=[
   ['go','v1','go'],['eat','v2','ate'],['write','v3','written'],
   ['have','v1','have'],['make','v2','made'],['study','v3','studied'],
   ['play','v1','play'],['see','v2','saw'],['do','v3','done'],
   ['come','v1','incorrect']
  ].map(([v1,target,given])=>({v1,target,given}));
  const payload={request_id:randomUUID(),expected_actor_id:user.id,mode:'full',answers:attempts};
  const write=await ctxA.request.post(BASE+'/api/learning/verbs/attempts',{
   headers:{origin:BASE},data:payload});
  assert.equal(write.status(),201,await write.text());
  assert.equal((await write.json()).correct,9);
  const replay=await ctxB.request.post(BASE+'/api/learning/verbs/attempts',{
   headers:{origin:BASE},data:payload});
  assert.equal(replay.status(),200,await replay.text());
  assert.equal((await replay.json()).replayed,true);
  const conflict=await ctxA.request.post(BASE+'/api/learning/verbs/attempts',{
   headers:{origin:BASE},data:{...payload,answers:attempts.map((a,i)=>i===0?{...a,given:'wrong'}:a)}});
  assert.equal(conflict.status(),409);
  const switched=await ctxA.request.post(BASE+'/api/learning/verbs/attempts',{
   headers:{origin:BASE},data:{...payload,request_id:randomUUID(),expected_actor_id:other.id}});
  assert.equal(switched.status(),409);
  const observed=await ctxB.request.get(BASE+'/api/learning/verbs/history');
  const history=await observed.json();
  assert.equal(history.summary.runs,1);
  assert.equal(history.summary.questions,10);
  assert.equal(history.summary.correct,9);
  assert.ok(history.weak_forms.some(x=>x.v1==='come'&&x.form==='v1'));
  const otherHistory=await ctxOther.request.get(BASE+'/api/learning/verbs/history');
  assert.equal((await otherHistory.json()).summary.runs,0);
  const afterSrs=(await db.query('SELECT count(*)::int n FROM ws_user_srs_schedules WHERE user_id=$1',[user.id])).rows[0].n;
  assert.equal(afterSrs,beforeSrs);
  await A.goto(BASE+'/verbs.html',{waitUntil:'domcontentloaded'});
  await A.waitForFunction(()=>document.querySelector('#ws51Totals')?.textContent.includes('1 lượt'));
  assert.match(await A.locator('#ws51Weak').innerText(),/come \(V1\)/);
  pass('UX51 authenticated cross-device verb history, tamper defense, account isolation, no SRS writes');

  // UX59.23: hold A's SRS HTTP response, change the actual session to B,
  // then release the old response. Never render stale A cards under B.
  const ctxRace = await chrome.newContext();
  await signIn(ctxRace, user);
  const racePage = await ctxRace.newPage();
  let captureQueue, releaseQueue;
  let held = false;
  const captured = new Promise(resolve => { captureQueue = resolve; });
  const release = new Promise(resolve => { releaseQueue = resolve; });
  await racePage.route('**/api/learning/srs/queue?*', async route => {
    if (held) { await route.continue(); return; }
    held = true;
    const response = await route.fetch();
    captureQueue(await response.json());
    await release;
    await route.fulfill({ response });
  });
  await racePage.goto(BASE + '/progress.html', { waitUntil: 'domcontentloaded' });
  const heldQueue = await Promise.race([
    captured,
    new Promise((_, reject) => setTimeout(() =>
      reject(Error('SRS route was not intercepted')), 15000))
  ]);
  assert.equal(heldQueue.actor_id, user.id,
    'Held HTTP response must originate from account A');
  await signIn(ctxRace, other);
  releaseQueue();
  await racePage.waitForFunction(() => {
    const notice = document.querySelector('#ws24Notice');
    return notice?.dataset.error === 'true' &&
      notice.textContent.includes('Phiên đăng nhập đã thay đổi') &&
      document.querySelector('#ws24Reload')?.disabled === false;
  });
  assert.equal(await racePage.locator('#ws24List .ws24-card').count(), 0);
  assert.equal(await racePage.locator('#ws58DailyPlan').isVisible(), false);
  assert.equal(await racePage.locator('#ws24Practice').isEnabled(), false);
  await ctxRace.close();
  pass('Late SRS response for account A is rejected after switching to B');
  
  // UX59.24: hold a successful A review POST response, switch the browser
  // session to B and then deliver it. No A success event or SRS cards may
  // be published in B's browser; only local disposable QA accounts are used.
  const ctxReviewRace = await chrome.newContext();
  await signIn(ctxReviewRace, user);
  const reviewRacePage = await ctxReviewRace.newPage();
  await reviewRacePage.goto(BASE + '/progress.html');
  await reviewRacePage.locator('#ws24Srs').waitFor({ state: 'visible' });
  await reviewRacePage.locator('#ws24Status').selectOption('upcoming');
  const reviewRaceCard = reviewRacePage.locator('#ws24List .ws24-card')
    .filter({ hasText: shared.english }).first();
  await reviewRaceCard.waitFor({ state: 'visible' });
  await reviewRacePage.evaluate(() => {
    window.__ux5924ReviewEvents = 0;
    window.addEventListener('wordsky:srs-review-saved',
      () => { window.__ux5924ReviewEvents += 1; });
  });
  let captureReview, releaseReview;
  let interceptedReview = false;
  const reviewCaptured = new Promise(resolve => { captureReview = resolve; });
  const reviewRelease = new Promise(resolve => { releaseReview = resolve; });
  await reviewRacePage.route('**/api/learning/reviews', async route => {
    if (interceptedReview) { await route.continue(); return; }
    interceptedReview = true;
    const response = await route.fetch();
    captureReview({ status: response.status(), payload: await response.json() });
    await reviewRelease;
    await route.fulfill({ response });
  });
  await reviewRaceCard.getByRole('button', {
    name: '↻ Cần ôn ngay: ' + shared.english
  }).click();
  const heldReview = await Promise.race([
    reviewCaptured,
    new Promise((_, reject) => setTimeout(() =>
      reject(Error('SRS review POST was not intercepted')), 15000))
  ]);
  assert.equal(heldReview.status, 201, JSON.stringify(heldReview.payload));
  assert.equal(heldReview.payload.scope, 'account-review');
  await signIn(ctxReviewRace, other);
  releaseReview();
  await reviewRacePage.waitForFunction(() =>
    document.querySelector('#ws24Notice')?.textContent.includes(
      'Phiên đăng nhập đã thay đổi. Lượt ôn có thể đã được lưu')
    && document.querySelector('#ws24Reload')?.disabled === false
  );
  assert.equal(await reviewRacePage.evaluate(() =>
    window.__ux5924ReviewEvents), 0,
    'Stale review emitted a success event after account switch');
  assert.equal(await reviewRacePage.locator('#ws24List .ws24-card').count(), 0);
  assert.equal(await reviewRacePage.locator('#ws58DailyPlan').isVisible(), false);
  assert.equal(await reviewRacePage.locator('#ws24Practice').isEnabled(), false);
  assert.equal((await (await ctxReviewRace.request.get(
    BASE + '/api/auth/me')).json()).actor?.id, other.id);
  await ctxReviewRace.close();
  pass('Late review success for A cannot update account B SRS UI');
  
  // UX59.25: simulate the server committing a review but the network dropping
  // its HTTP response. The user's retry must replay the same request_id,
  // never record an additional review or advance its SRS schedule twice.
  const ctxLost = await chrome.newContext();
  await signIn(ctxLost, user);
  const lostPage = await ctxLost.newPage();
  const beforeLost = (await db.query(
    'SELECT review_count FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',
    [user.id, shared.id]
  )).rows[0].review_count;
  await lostPage.goto(BASE + '/progress.html');
  await lostPage.locator('#ws24Srs').waitFor({ state: 'visible' });
  await lostPage.locator('#ws24Status').selectOption('due');
  const retryCard = lostPage.locator('#ws24List .ws24-card')
    .filter({ hasText: shared.english }).first();
  await retryCard.waitFor({ state: 'visible' });
  const seenRetries = [];
  await lostPage.route('**/api/learning/reviews', async route => {
    const submitted = route.request().postDataJSON();
    const response = await route.fetch();
    const body = await response.json();
    seenRetries.push({ request_id:submitted.request_id,
      expected_review_count:submitted.expected_review_count,
      status:response.status(),body });
    if (seenRetries.length === 1) await route.abort('failed');
    else await route.fulfill({response});
  });
  const retryButton = retryCard.getByRole('button', {
    name: '✓ Đã nhớ: ' + shared.english
  });
  await retryButton.click();
  await lostPage.waitForFunction(() =>
    document.querySelector('#ws24Notice')?.textContent.includes(
      'Máy chủ có thể đã lưu. Hãy bấm lại cùng nút')
    && document.querySelector('#ws24Reload')?.disabled === false
  );
  await wait(async () => {
    const row = (await db.query(
      'SELECT review_count FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',
      [user.id, shared.id]
    )).rows[0];
    return row?.review_count === beforeLost + 1;
  });
  assert.equal(seenRetries.length,1);
  assert.equal(seenRetries[0].status,201);
  assert.equal(seenRetries[0].body.replayed,false);
  await retryButton.click();
  await lostPage.waitForFunction(() =>
    document.querySelector('#ws24Notice')?.textContent.includes(
      'Đã lưu từ')
    && document.querySelector('#ws24Reload')?.disabled === false
  );
  assert.equal(seenRetries.length,2);
  assert.equal(seenRetries[1].status,200);
  assert.equal(seenRetries[1].body.replayed,true);
  assert.equal(seenRetries[1].request_id,seenRetries[0].request_id,
    'Lost HTTP response generated a different idempotency key on retry');
  assert.equal(seenRetries[1].expected_review_count,
    seenRetries[0].expected_review_count);
  const afterLost=(await db.query(
    'SELECT review_count FROM ws_learning_word_progress WHERE user_id=$1 AND word_id=$2',
    [user.id, shared.id]
  )).rows[0].review_count;
  assert.equal(afterLost,beforeLost+1,
    'Lost-response retry incremented review count twice');
  await ctxLost.close();
  pass('Lost review HTTP response replays request_id exactly once');
  
  // UX59.26: two devices load the same SRS version. A saves; B submits its
  // stale version and must receive 409, refresh, and NOT record another
  // review. All writes use disposable local QA users and PostgreSQL.
  const ctxConcurrentA = await chrome.newContext();
  const ctxConcurrentB = await fox.newContext();
  await signIn(ctxConcurrentA, user);
  await signIn(ctxConcurrentB, user);
  const concurrentA = await ctxConcurrentA.newPage();
  const concurrentB = await ctxConcurrentB.newPage();
  await Promise.all([
    concurrentA.goto(BASE + '/progress.html'),
    concurrentB.goto(BASE + '/progress.html')
  ]);
  for (const p of [concurrentA, concurrentB]) {
    await p.locator('#ws24Srs').waitFor({ state: 'visible' });
    await p.locator('#ws24Status').selectOption('upcoming');
    await p.locator('#ws24List .ws24-card')
      .filter({ hasText: shared.english }).first().waitFor({ state: 'visible' });
  }
  const concurrentEndpoint = BASE +
    '/api/learning/srs/queue?status=upcoming&page=0&size=20';
  const [queueAResponse, queueBResponse] = await Promise.all([
    ctxConcurrentA.request.get(concurrentEndpoint),
    ctxConcurrentB.request.get(concurrentEndpoint)
  ]);
  assert.equal(queueAResponse.status(), 200);
  assert.equal(queueBResponse.status(), 200);
  const [queueA, queueB] = await Promise.all([
    queueAResponse.json(), queueBResponse.json()
  ]);
  assert.equal(queueA.actor_id, user.id);
  assert.equal(queueB.actor_id, user.id);
  const snapshotA = queueA.words.find(w => w.id === shared.id);
  const snapshotB = queueB.words.find(w => w.id === shared.id);
  assert.ok(snapshotA && snapshotB,
    'The same scheduled shared card must be visible on both devices');
  assert.equal(snapshotA.review_count, snapshotB.review_count);
  const concurrentBefore = (await db.query(scheduleSql, params)).rows[0];
  assert.equal(concurrentBefore.review_count, snapshotA.review_count);
  const concurrentAction = '✓ Ôn sớm (giữ nguyên lịch): ' + shared.english;
  const successResponse = concurrentA.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/learning/reviews' &&
    response.request().method() === 'POST');
  await concurrentA.locator('#ws24List .ws24-card')
    .filter({ hasText: shared.english }).first()
    .getByRole('button', { name: concurrentAction }).click();
  const accepted = await successResponse;
  assert.equal(accepted.status(), 201);
  assert.equal((await accepted.json()).replayed, false);
  await wait(async () => {
    const p = (await db.query(scheduleSql,params)).rows[0];
    return p?.review_count === concurrentBefore.review_count + 1;
  });
  const conflictResponse = concurrentB.waitForResponse(response =>
    new URL(response.url()).pathname === '/api/learning/reviews' &&
    response.request().method() === 'POST');
  await concurrentB.locator('#ws24List .ws24-card')
    .filter({ hasText: shared.english }).first()
    .getByRole('button', { name: concurrentAction }).click();
  const staleConflict = await conflictResponse;
  assert.equal(staleConflict.status(),409,await staleConflict.text());
  await concurrentB.waitForFunction(() =>
    document.querySelector('#ws24Notice')?.textContent.includes(
      'Từ đã được cập nhật ở thiết bị khác. Đã tải trạng thái mới')
    && document.querySelector('#ws24Reload')?.disabled === false
  );
  const refreshed = await ctxConcurrentB.request.get(concurrentEndpoint);
  assert.equal(refreshed.status(),200);
  assert.equal((await refreshed.json()).words.find(w =>
    w.id === shared.id)?.review_count,concurrentBefore.review_count + 1);
  const concurrentAfter = (await db.query(scheduleSql,params)).rows[0];
  assert.equal(concurrentAfter.review_count,concurrentBefore.review_count + 1,
    'Second device stale review incorrectly incremented progress');
  assert.equal(concurrentAfter.due_at.toISOString(),
    concurrentBefore.due_at.toISOString(),
    'Early review changed the original SRS due date');
  await Promise.all([ctxConcurrentA.close(),ctxConcurrentB.close()]);
  pass('Two devices: stale SRS review returns 409 and never double-counts');




  // UX59.17: switching the same browser context must evict previous
  // account learning data, not merely isolate two different contexts.
  await signIn(ctxA, other);
  await A.goto(BASE + '/progress.html');
  await A.waitForFunction(() =>
    document.getElementById('ws10SourceBadge')
      ?.textContent === 'ACCOUNT · POSTGRESQL'
  );
  await A.waitForFunction(() =>
    document.getElementById('ws10Known')?.textContent === '0'
  );
  const newActor = await ctxA.request.get(BASE + '/api/auth/me');
  assert.equal((await newActor.json()).actor?.id, other.id);
  const switchedQueue = await ctxA.request.get(
    BASE + '/api/learning/srs/queue?status=due&page=0&size=20'
  );
  assert.equal(switchedQueue.status(), 200, await switchedQueue.text());
  const switchedData = await switchedQueue.json();
  assert.equal(switchedData.actor_id, other.id);
  assert.equal(switchedData.words.some(w => w.english === unique), false);
  await A.goto(BASE + '/personal.html');
  await A.locator('#personalAccount').waitFor({ state: 'visible' });
  assert.equal(await A.locator('#personalTotal').innerText(), '0');
  assert.equal(await A.locator('#personalList .word-row')
    .filter({ hasText: unique }).count(), 0);
  pass('Same browser account switch clears previous learning and SRS data');

  // UX59.18: logout must remove the same browser session from every
  // account-only learning route, without revoking other browser sessions.
  const logout = await ctxA.request.post(BASE + '/api/auth/logout', {
    headers: { origin: BASE }
  });
  assert.equal(logout.status(), 200, await logout.text());
  assert.equal((await logout.json()).ok, true);
  const guest = await ctxA.request.get(BASE + '/api/auth/me');
  assert.equal(guest.status(), 200);
  assert.equal((await guest.json()).actor, null);
  for (const route of [
    '/api/learning/me/summary',
    '/api/learning/srs/queue?status=due&page=0&size=20',
    '/api/learning/personal'
  ]) {
    const response = await ctxA.request.get(BASE + route);
    assert.equal(response.status(), 401,
      'Logged-out session accessed ' + route);
  }
  const remaining = await ctxB.request.get(BASE + '/api/auth/me');
  assert.equal(remaining.status(), 200);
  assert.equal((await remaining.json()).actor?.id, user.id,
    'Logout of one browser unexpectedly invalidated another session');
  pass('Logout denies account learning routes and preserves other browser session');

  // UX59.21: after logout, the same browser must not render stale private
  // dashboard rows, SRS cards or account-scoped daily activity on reload.
  await A.goto(BASE + '/progress.html');
  await A.waitForFunction(() => {
    const badge = document.getElementById('ws10SourceBadge');
    const status = document.getElementById('ws15ScopeStatus');
    return badge && badge.textContent !== 'ACCOUNT · POSTGRESQL' &&
      status && !status.textContent.includes('Đang kiểm tra');
  });
  assert.notEqual(await A.locator('#ws10SourceBadge').innerText(),
    'ACCOUNT · POSTGRESQL', 'Logged-out view retained account source');
  assert.equal(await A.locator('#ws24List .ws24-card').count(), 0,
    'Logged-out browser rendered private SRS cards');
  assert.equal(await A.locator('#ws58DailyPlan').isVisible(), false,
    'Logged-out browser displayed account daily plan');
  assert.equal(await A.locator('#ws10WordList')
    .filter({ hasText: unique }).count(), 0,
    'Logged-out browser displayed private vocabulary');
  // UX59.22: do not pass on the temporarily empty SRS loading view.
  // Verify settled unauthorized state at narrow phone widths in the same
  // browser session after logout, with no production user data involved.
  for (const width of [360, 390]) {
    await A.setViewportSize({ width, height: 800 });
    await A.reload();
    await A.waitForFunction(() => {
      const notice = document.querySelector('#ws24Notice');
      const reload = document.querySelector('#ws24Reload');
      return notice?.textContent.includes('Đăng nhập học viên') &&
        notice.dataset.error === 'true' && reload?.disabled === false;
    });
    const mobile = await A.evaluate(() => ({
      overflow: document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      count: document.querySelectorAll('#ws24List .ws24-card').length,
      dailyHidden: document.querySelector('#ws58DailyPlan')?.hidden,
      practiceDisabled: document.querySelector('#ws24Practice')?.disabled,
      source: document.querySelector('#ws10SourceBadge')?.textContent
    }));
    assert.ok(mobile.overflow <= 1,
      'Logged-out My Learning overflows at ' + width + 'px: ' + JSON.stringify(mobile));
    assert.equal(mobile.count, 0,
      'Logged-out SRS cards visible at ' + width + 'px');
    assert.equal(mobile.dailyHidden, true);
    assert.equal(mobile.practiceDisabled, true);
    assert.notEqual(mobile.source, 'ACCOUNT · POSTGRESQL');
  }
  pass('Logout mobile SRS settles without stale private data at 360/390px');

  pass('Logout refresh clears private My Learning dashboard and SRS UI');


  console.log('\nWORDSKY UI E2E: 21/21 PASS');

} catch (error) {
  console.error('\nWORDSKY UI E2E: FAIL:', error.stack || error.message);
  process.exitCode = 1;

} finally {
  await Promise.allSettled([chrome?.close(), fox?.close()]);

  for (const id of qaIds) {
    try {
      await db.query('DELETE FROM ws_users WHERE id=$1', [id]);
    } catch (error) {
      console.error('QA cleanup failed:', error.message);
      process.exitCode = 1;
    }
  }

  await db.end();
  console.log('Local QA accounts cleanup attempted');
}
