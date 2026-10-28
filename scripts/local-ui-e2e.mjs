import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
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

  console.log('\nWORDSKY UI E2E: 12/12 PASS');

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
