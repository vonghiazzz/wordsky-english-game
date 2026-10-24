import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {roundWindows} from '../lib/game.js';
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const learn=fs.readFileSync(new URL('../public/learn.html',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../api/index.js',import.meta.url),'utf8');
const schema=fs.readFileSync(new URL('../db/migrations/20261024_160000_room_fast_forward.sql',import.meta.url),'utf8');
const start='2026-10-24T09:00:00.000Z';
const rounds=[{position:1,duration_seconds:90},{position:2,duration_seconds:90},{position:3,duration_seconds:90}];

test('no early finishes leaves legacy windows unchanged',()=>{
 const w=roundWindows(start,rounds);
 assert.equal(w[0].ends_at,'2026-10-24T09:01:30.000Z');
 assert.equal(w[1].starts_at,w[0].ends_at);
});
test('five-second fast-forward clamps current end and advances next scheduled round',()=>{
 const w=roundWindows(start,rounds,{'2':'2026-10-24T09:00:25.000Z'});
 assert.equal(w[0].ends_at,'2026-10-24T09:00:25.000Z');
 assert.equal(w[1].starts_at,w[0].ends_at);
 assert.equal(w[2].starts_at,w[1].ends_at);
});
test('subsequent early finish preserves ordering of all three rounds',()=>{
 const w=roundWindows(start,rounds,{'2':'2026-10-24T09:00:25.000Z','3':'2026-10-24T09:00:45.000Z'});
 assert.equal(w[1].ends_at,w[2].starts_at);
 assert.equal(w[2].starts_at,'2026-10-24T09:00:45.000Z');
});
test('invalid or later overrides cannot delay the original schedule',()=>{
 const w=roundWindows(start,rounds,{'2':'not-a-date','3':'2026-10-24T10:00:00Z'});
 assert.equal(w[1].starts_at,'2026-10-24T09:01:30.000Z');
 assert.equal(w[2].starts_at,'2026-10-24T09:03:00.000Z');
});
test('out-of-order override cannot make a round end before it starts',()=>{
 const w=roundWindows(start,rounds,{'2':'2026-10-24T09:00:30.000Z','3':'2026-10-24T09:00:25.000Z'});
 assert.equal(w[2].starts_at,'2026-10-24T09:02:00.000Z');
 assert.ok(w.every(x=>Date.parse(x.ends_at)>Date.parse(x.starts_at)));
 const equal=roundWindows(start,rounds,{'2':'2026-10-24T09:00:30.000Z','3':'2026-10-24T09:00:30.000Z'});
 assert.ok(equal.every(x=>Date.parse(x.ends_at)>Date.parse(x.starts_at)));
});
test('server schedules only after joined participants have completed',()=>{
 assert.match(api,/shortenRoundWhenEveryoneFinished/);
 assert.match(api,/FROM ws_participants p LEFT JOIN ws_runs r/);
 assert.match(api,/finished!==total/);
 assert.match(api,/new Date\(now\+5000\)/);
 assert.match(api,/FOR UPDATE/);
 assert.match(schema,/ADD COLUMN IF NOT EXISTS round_start_overrides jsonb/);
});
test('new round starts automatically only after a prior run completed',()=>{
 assert.match(app,/game\.game\.status!=='PLAYING'&&game\.round\.id!==next\.id/);
 assert.match(app,/await startRound\(\)/);
});
test('multiplayer BOMB preserves the input and the falling bomb DOM during polling',()=>{
 assert.match(app,/syncBombArena\(\)/);
 assert.match(app,/reconcileBombCards\(arena,g,rd\)/);
 assert.match(app,/if\(!present\.has\(String\(bomb\.id\)\)\)/);
 assert.doesNotMatch(app,/pointerdown.*data-game-key/);
});
test('learn typing game hides keyboard before Ready and accepts native typing',()=>{
 assert.match(learn,/\.game-area\.typing-active:not\(\.typing-running\) \.typing-dock\{display:none\}/);
 assert.match(learn,/\.game-area \.game-overlay\{z-index:12\}/);
 assert.match(learn,/function setTypingEnabled\(enabled\).*readOnly=false/);
 assert.match(learn,/\$\('typingAnswer'\)\.addEventListener\('input'/);
 assert.doesNotMatch(learn,/id="virtualKeyboard"/);
});
