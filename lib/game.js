import { randomInt,randomUUID } from 'node:crypto';

export const MODES=['MATCH','BOMB','CAR','MATRIX','MEMORY'];
// Competition may use seven grid sizes; Solo only uses 4, 5 and 6.
export const MATRIX_SIZES=Object.freeze({4:8,5:12,6:18,8:32,10:50,12:72,16:128});
export const SOLO_MATRIX_SIZES=Object.freeze({4:8,5:12,6:18});
export const MATRIX_DURATION_SECONDS=Object.freeze({4:180,5:240,6:360,8:480,10:720,12:1200,16:1800});
export const MEMORY_DURATION_SECONDS=Object.freeze({4:90,5:120,6:180,8:240,10:360,12:600,16:900});
export const DIFFICULTIES=['EASY','NORMAL','HARD'];
export const MATCH_DISTRACTORS={EASY:0,NORMAL:2,HARD:4};
export const MIN_CAR_STEP_MS=1200;
export const BOMB_PRESETS=Object.freeze({EASY:{fallSeconds:20,batchSize:2,spawnIntervalSeconds:10},NORMAL:{fallSeconds:16,batchSize:2,spawnIntervalSeconds:9},HARD:{fallSeconds:10,batchSize:3,spawnIntervalSeconds:6}});
export const BOMB_DEFAULTS=BOMB_PRESETS.NORMAL;
export const DEFAULT_CAR_STEP_SECONDS=8;
export const CAR_CEFR_LEVELS=Object.freeze({NORMAL:['A1','A2'],BONUS:['B1','B2'],DOUBLE:['C1','C2']});
// Each CAR lane is a distinct CEFR challenge. EASY never forces C1/C2,
// while HARD favors high-tier words. The five lane slots remain deterministic.
export const CAR_LANE_PLANS=Object.freeze({
 EASY:Object.freeze({blocked:1,A2:3,BONUS:1,DOUBLE:0}),
 NORMAL:Object.freeze({blocked:2,A2:1,BONUS:1,DOUBLE:1}),
 HARD:Object.freeze({blocked:2,A2:0,BONUS:1,DOUBLE:2}),
});
export const carBlockedCount=difficulty=>(CAR_LANE_PLANS[difficulty]||CAR_LANE_PLANS.NORMAL).blocked;
// Every lane needs a different reviewed word, also across stages.
export function carWordRequirements(round){
 const count=Number(round.question_count);
 const plan=CAR_LANE_PLANS[round.difficulty]||CAR_LANE_PLANS.NORMAL;
 return {A2:plan.A2*count,BONUS:plan.BONUS*count,DOUBLE:plan.DOUBLE*count};
}
export function carMissingWords(round,pools){
 const req=carWordRequirements(round);
 return Object.entries(req).filter(([tier,needed])=>(pools[tier]?.length||0)<needed)
  .map(([tier,needed])=>`${tier==='BONUS'?'B1–B2':tier==='DOUBLE'?'C1–C2':'A1–A2'}: cần ${needed}, có ${pools[tier]?.length||0}`);
}
export function requiredWords(round){
 if(round.mode==='CAR')return Object.values(carWordRequirements(round)).reduce((a,b)=>a+b,0);
 return Number(round.question_count)+(round.mode==='MATCH'?MATCH_DISTRACTORS[round.difficulty]||0:0);
}
export function assertWordCapacity(round,count){
 const required=requiredWords(round);
 if(count<required)throw fail(`Kho từ vựng cần ${required} từ cho vòng ${round.mode} ${round.difficulty}, hiện có ${count} từ (thiếu ${required-count} từ).`,400);
}

export function normalizeAnswer(value){return String(value??'').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N} ]/gu,' ').replace(/\s+/g,' ').trim()}
export function rankForXp(xp){ if(xp>=3000)return 'Kim cương';if(xp>=1400)return 'Bạch kim';if(xp>=600)return 'Vàng';if(xp>=200)return 'Bạc';return 'Đồng'}
export function awardedAttendance(streak){return 20+Math.min(7,Math.max(1,streak))*5}
export function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
export const fail=(message,status=400)=>{let e=new Error(message);e.status=status;return e};
const CHECK_ID=/^[0-9a-f-]{20,40}$/i;
export function normalizeRound(input,{soloMatrix=false,soloOnly=false}={}){
 const mode=String(input.mode||'').toUpperCase();const difficulty=String(input.difficulty||'NORMAL').toUpperCase();
 if(!MODES.includes(mode)||(['MATRIX','MEMORY'].includes(mode)&&!soloMatrix))throw fail('Chế độ vòng thi không hợp lệ');
 if(!DIFFICULTIES.includes(difficulty))throw fail('Độ khó không hợp lệ');
 const bombPreset=BOMB_PRESETS[difficulty]||BOMB_DEFAULTS;
 const d={mode,difficulty,duration_seconds:Number(input.duration_seconds||100),question_count:Number(input.question_count??8),points_per_correct:Number(input.points_per_correct||100),penalty:Number(input.penalty??25),weight:Number(input.weight??1),topic_id:input.topic_id||null,bomb_fall_seconds:Number(input.bomb_fall_seconds??bombPreset.fallSeconds),bomb_batch_size:Number(input.bomb_batch_size??bombPreset.batchSize),bomb_spawn_interval_seconds:Number(input.bomb_spawn_interval_seconds??bombPreset.spawnIntervalSeconds),car_step_seconds:Number(input.car_step_seconds??DEFAULT_CAR_STEP_SECONDS)};
 if(!Number.isInteger(d.duration_seconds)||d.duration_seconds<20||d.duration_seconds>(['MATRIX','MEMORY'].includes(mode)?1800:600))
  throw fail(['MATRIX','MEMORY'].includes(mode)?'Ma trận tối đa 30 phút':'Thời gian vòng từ 20 đến 600 giây');
 if(['MATRIX','MEMORY'].includes(mode)){
  const allowed=soloOnly?SOLO_MATRIX_SIZES:MATRIX_SIZES;
  if(!Object.values(allowed).includes(d.question_count))
   throw fail(soloOnly?'Solo chỉ hỗ trợ ma trận 4×4, 5×5, 6×6':'Kích thước ma trận không hợp lệ');
 }else if(!Number.isInteger(d.question_count)||d.question_count<3||d.question_count>30)throw fail('Số câu/vật cản từ 3 đến 30');
 if(!Number.isInteger(d.points_per_correct)||d.points_per_correct<10||d.points_per_correct>1000)throw fail('Điểm mỗi câu từ 10 đến 1000');
 if(!Number.isInteger(d.penalty)||d.penalty<0||d.penalty>1000)throw fail('Điểm trừ không hợp lệ');
 if(!Number.isInteger(d.weight)||d.weight<1||d.weight>10)throw fail('Hệ số vòng từ 1 đến 10');
 if(d.topic_id&&!CHECK_ID.test(d.topic_id))throw fail('ID chủ đề không hợp lệ');
 if(mode==='MATCH' && d.question_count>20)throw fail('Nối từ tối đa 20 cặp');
 if(mode==='BOMB'){
  if(!Number.isInteger(d.bomb_fall_seconds)||d.bomb_fall_seconds<5||d.bomb_fall_seconds>60)throw fail('Thời gian bom rơi phải từ 5 đến 60 giây');
  if(!Number.isInteger(d.bomb_batch_size)||d.bomb_batch_size<1||d.bomb_batch_size>3)throw fail('Mỗi đợt được thả 1–3 quả bom');
  if(!Number.isInteger(d.bomb_spawn_interval_seconds)||d.bomb_spawn_interval_seconds<3||d.bomb_spawn_interval_seconds>45)throw fail('Khoảng cách đợt bom phải từ 3 đến 45 giây');
  const waves=Math.ceil(d.question_count/d.bomb_batch_size);
  if(d.duration_seconds<(waves-1)*d.bomb_spawn_interval_seconds+d.bomb_fall_seconds)throw fail('Thời gian vòng không đủ để bom cuối rơi hết. Tăng tổng thời gian hoặc giảm khoảng cách đợt bom.');
 }
 if(mode==='CAR'){
  if(!Number.isInteger(d.car_step_seconds)||d.car_step_seconds<2||d.car_step_seconds>45)throw fail('Thời gian mỗi chặng CAR phải từ 2 đến 45 giây');
  if(d.duration_seconds<d.question_count*d.car_step_seconds)throw fail('Thời gian vòng CAR phải ít nhất bằng số chặng × thời gian mỗi chặng');
 }
 return d;
}
// An entire multiplayer room shares the same server-persisted schedule.
// A finished round may shorten its own remaining window to five seconds; never
// trust a browser's countdown to decide when the following round opens.
export function roundWindows(startISO,rounds,overrides={}){
 const eventStart=Date.parse(startISO);
 let cursor=eventStart, lastStart=eventStart;
 const windows=rounds.map(r=>{
  const raw=overrides?.[String(r.position)];
  const advance=typeof raw==='string'?Date.parse(raw):NaN;
  if(Number.isFinite(advance)&&advance>lastStart&&advance<cursor)cursor=advance;
  const start=cursor;lastStart=start;cursor+=Number(r.duration_seconds)*1000;
  return {...r,starts_at:new Date(start).toISOString(),ends_at:new Date(cursor).toISOString()};
 });
 for(let i=0;i<windows.length-1;i++){
  if(Date.parse(windows[i+1].starts_at)<Date.parse(windows[i].ends_at))windows[i].ends_at=windows[i+1].starts_at;
 }
 return windows;
}
// Record only an identifiable vocabulary word. This is NOT an SRS review event.
export function noteWrongGameWord(state,wordId){
 if(typeof wordId!=='string'||!wordId.trim()||wordId.length>64)return;
 if(!Array.isArray(state.wrongWordIds))state.wrongWordIds=[];
 if(state.wrongWordIds.length>=30||state.wrongWordIds.includes(wordId))return;
 state.wrongWordIds.push(wordId);
}
export function createState(round,words,now=Date.now(),endsMs=now+round.duration_seconds*1000){
 const n=round.question_count;
 const state={mode:round.mode,startedAt:now,endsAt:endsMs,score:0,correct:0,mistakes:0,health:3,status:'PLAYING',wrongWordIds:[],missedPracticeWordIds:[]};
 if(round.mode==='MATCH'){
  assertWordCapacity(round,words.length);
  // The real-word ID stays on the server; meaning choices get unrelated random IDs.
  // Never expose meaning + English or a shared ID in the same public record.
  state.pairs=shuffle(words).slice(0,n).map(w=>({id:String(w.id),rightId:randomUUID(),english:w.english,meaning:w.meaning,matched:false}));
  state.wrongAttempts=0;
  const distractions=MATCH_DISTRACTORS[round.difficulty];
  state.distractors=shuffle(words.filter(w=>!state.pairs.some(p=>p.id===String(w.id)))).slice(0,distractions).map(w=>({rightId:randomUUID(),meaning:w.meaning}));
 }else if(['MATRIX','MEMORY'].includes(round.mode)){
  assertWordCapacity(round,words.length);
  if(round.mode==='MEMORY'){state.flippedIds=[];state.flipUntil=0;}
  // Each tile has a random public ID; the private mapping and word IDs
  // are kept in the database state, never in the public payload.
  const size=Object.keys(MATRIX_SIZES).find(size=>MATRIX_SIZES[size]===n);
  if(!size)throw fail('Kích thước ma trận không hợp lệ');
  state.gridSize=Number(size);
  state.pairs=shuffle(words).slice(0,n).map(w=>({
   id:String(w.id),enId:randomUUID(),viId:randomUUID(),
   english:String(w.english),meaning:String(w.meaning),matched:false
  }));
  state.cards=shuffle(state.pairs.flatMap(p=>[
   {id:p.enId,label:p.english,lang:'en'},
   {id:p.viId,label:p.meaning,lang:'vi'}
  ]));
  // 5x5 needs 12 bilingual pairs and one noninteractive centre cell.
  // The centre does not carry a word, card identifier, or secret.
  if(state.gridSize%2===1)
   state.cards.splice(Math.floor(state.gridSize*state.gridSize/2),0,{empty:true});
 }else if(round.mode==='BOMB'){
  assertWordCapacity(round,words.length);
  const bombPreset=BOMB_PRESETS[round.difficulty]||BOMB_DEFAULTS;
  const interval=Number(round.bomb_spawn_interval_seconds??bombPreset.spawnIntervalSeconds)*1000;
  const lifetime=Number(round.bomb_fall_seconds??bombPreset.fallSeconds)*1000;
  const batch=Number(round.bomb_batch_size??bombPreset.batchSize);
  const chosen=shuffle(words).slice(0,n);
  state.bombs=chosen.map((w,i)=>{const spawnAt=now+Math.floor(i/batch)*interval;return {id:randomUUID(),wordId:String(w.id),english:w.english,meaning:w.meaning,spawnAt,deadline:Math.min(spawnAt+lifetime,endsMs),slot:i%batch,status:'WAITING',tries:0}});
  }else if(round.mode==='CAR'){
   if(!words||Array.isArray(words)||typeof words!=='object')throw fail('CAR cần 3 nhóm từ CEFR đã duyệt');
   const missing=carMissingWords(round,words);
   if(missing.length)throw fail('Chưa đủ từ đã duyệt cho Lane Escape: '+missing.join('; '));
   const buckets={A2:shuffle(words.A2),BONUS:shuffle(words.BONUS),DOUBLE:shuffle(words.DOUBLE)};
   const levels=[];
   for(let i=0;i<n;i++){
    const plan=CAR_LANE_PLANS[round.difficulty]||CAR_LANE_PLANS.NORMAL;
    const laneTiers=shuffle([
     ...Array(plan.blocked).fill('BLOCKED'),
     ...Array(plan.A2).fill('A2'),
     ...Array(plan.BONUS).fill('BONUS'),
     ...Array(plan.DOUBLE).fill('DOUBLE'),
    ]);
    const lanes=laneTiers.map(tier=>{
     if(tier==='BLOCKED')return {kind:'BLOCKED'};
     const card=buckets[tier].pop();
     return {kind:tier==='A2'?'NORMAL':tier,wordId:String(card.id),english:card.english,meaning:card.meaning,cefr:card.cefr_level};
    });
    levels.push({lanes,finished:false});
   }
   state.levels=levels;state.index=0;state.carLane=2;state.stepStartedAt=now;state.stepDurationMs=Number(round.car_step_seconds??Math.floor((endsMs-now)/n/1000))*1000;
 }
 return state;
}
export function reconcile(state,round,now=Date.now()){
 if(state.status!=='PLAYING')return state;
 if(state.mode==='BOMB'){
  for(const b of state.bombs){
   if(b.status==='WAITING'&&now>=b.deadline){b.status='MISSED';if(now>=b.spawnAt)noteWrongGameWord(state,b.wordId);state.health--;state.mistakes++}
   if(state.health<=0){state.health=0;state.status='FAILED';break}
  }
  if(state.status==='PLAYING'&&state.bombs.every(b=>b.status!=='WAITING'))state.status='COMPLETED';
 }
 if(state.mode==='CAR'){
  const stepMs=Math.max(MIN_CAR_STEP_MS,Number(state.stepDurationMs)||Math.floor((state.endsAt-state.startedAt)/state.levels.length));
  while(state.status==='PLAYING'&&state.index<state.levels.length&&now>=state.stepStartedAt+stepMs){
   // A timed-out CAR stage has several valid answers. Record each safe
   // lane as an UNANSWERED PRACTICE word, never as a falsely graded typo.
   // The UI explains this distinction after the run.
   const missed=state.levels[state.index];
   if(!Array.isArray(state.missedPracticeWordIds))state.missedPracticeWordIds=[];
   for(const lane of missed.lanes){
    if(lane.kind!=='BLOCKED'&&typeof lane.wordId==='string'&&
       state.missedPracticeWordIds.length<30&&!state.missedPracticeWordIds.includes(lane.wordId))
      state.missedPracticeWordIds.push(lane.wordId);
   }
   missed.finished=true;state.health--;state.mistakes++;state.index++;state.stepStartedAt+=stepMs;
   if(state.health<=0){state.health=0;state.status='FAILED';break}
  }
  if(state.index>=state.levels.length&&state.status==='PLAYING')state.status='COMPLETED';
 }
 if(state.mode==='MEMORY'&&state.flippedIds?.length===2&&now>=Number(state.flipUntil||0)){
  state.flippedIds=[];state.flipUntil=0;
 }
 if(now>=state.endsAt&&state.status==='PLAYING')state.status='TIMEOUT';
 return state;
}
export function answerQuestion(state,round,input,now=Date.now()){
 reconcile(state,round,now);
 if(state.status!=='PLAYING')throw fail('Vòng chơi đã kết thúc',409);
 const points=round.points_per_correct;
 let result={correct:false,awarded:0};
 if(state.mode==='MATCH'){
  const left=state.pairs.find(p=>p.id===input.leftId);
  const right=state.pairs.find(p=>p.rightId===input.rightId);
  const distractor=state.distractors?.some(d=>d.rightId===input.rightId);
  if(!left||(!right&&!distractor)||left.matched||right?.matched)throw fail('Cặp từ đã được chọn hoặc không tồn tại');
  if(right&&left.id===right.id){left.matched=true;state.score+=points;state.correct++;result={correct:true,awarded:points}}
  else{noteWrongGameWord(state,left.id);state.score=Math.max(0,state.score-round.penalty);state.mistakes++;state.wrongAttempts++;state.health=Math.max(0,state.health-1);if(!state.health)state.status='FAILED';}
  if(state.pairs.every(p=>p.matched))state.status='COMPLETED';
  }else if(state.mode==='MATRIX'){
   const first=state.pairs.find(p=>p.enId===input.firstId||p.viId===input.firstId);
   const second=state.pairs.find(p=>p.enId===input.secondId||p.viId===input.secondId);
   if(!first||!second||first.matched||second.matched||input.firstId===input.secondId)
    throw fail('Thẻ không hợp lệ hoặc đã ghép',409);
   const firstLang=first.enId===input.firstId?'en':'vi';
   const secondLang=second.enId===input.secondId?'en':'vi';
   if(firstLang===secondLang)throw fail('Hãy chọn một thẻ tiếng Anh và một thẻ tiếng Việt');
   if(first.id===second.id){
    first.matched=true;state.score+=points;state.correct++;
    result={correct:true,awarded:points};
   }else{
    noteWrongGameWord(state,first.id);
    noteWrongGameWord(state,second.id);
    state.score=Math.max(0,state.score-round.penalty);
    state.mistakes++;state.health=Math.max(0,state.health-1);
    result={correct:false,awarded:-round.penalty};
    if(state.health===0)state.status='FAILED';
   }
   if(state.status==='PLAYING'&&state.pairs.every(p=>p.matched))state.status='COMPLETED';
  }else if(state.mode==='MEMORY'){
   if(state.flippedIds?.length===2&&now<Number(state.flipUntil||0))
    throw fail('Chờ hai thẻ tự úp lại trước khi lật tiếp',409);
   const cardId=String(input.cardId||'');
   const pair=state.pairs.find(p=>p.enId===cardId||p.viId===cardId);
   if(!pair||pair.matched)throw fail('Thẻ không hợp lệ hoặc đã ghép',409);
   const flips=state.flippedIds||[];
   if(flips.includes(cardId))throw fail('Thẻ đang được lật, hãy chọn thẻ khác',409);
   if(flips.length===0){
    state.flippedIds=[cardId];state.flipUntil=0;
    result={complete:false,revealed:true,awarded:0};
   }else{
    const first=state.pairs.find(p=>p.enId===flips[0]||p.viId===flips[0]);
    if(first?.id===pair.id){
     pair.matched=true;state.score+=points;state.correct++;
     state.flippedIds=[];state.flipUntil=0;
     result={complete:true,correct:true,awarded:points};
    }else{
     noteWrongGameWord(state,first.id);noteWrongGameWord(state,pair.id);
     state.score=Math.max(0,state.score-round.penalty);state.mistakes++;
     state.flippedIds=[flips[0],cardId];state.flipUntil=Math.min(state.endsAt,now+1100);
     result={complete:true,correct:false,awarded:-round.penalty};
    }
    if(state.status==='PLAYING'&&state.pairs.every(p=>p.matched))state.status='COMPLETED';
   }
  }else if(state.mode==='BOMB'){
   const normalized=normalizeAnswer(input.answer);
   if(!normalized||normalized.length>100)throw fail('Nhập câu trả lời tiếng Anh');
   // Auto mode matches a complete English answer against ANY visible active bomb.
   // Partial keystrokes are not mistakes. Keep an attempt budget and a server-side
   // throttle to prevent unlimited dictionary probing. Neither is sent to clients.
   const auto=input.auto===true && (input.bombId===undefined||input.bombId===null);
   let bomb;
   if(auto){
    if(now-Number(state.lastBombAutoAt||0)<160)throw fail('Nhập quá nhanh, hãy thử lại',429);
    if(Number(state.bombAutoAttempts||0)>=Math.max(72,Number(round.question_count||8)*18))
     throw fail('Đã vượt giới hạn thử từ tự động của vòng này',429);
    state.lastBombAutoAt=now;
    state.bombAutoAttempts=Number(state.bombAutoAttempts||0)+1;
    bomb=state.bombs.find(b=>b.status==='WAITING'&&now>=b.spawnAt&&now<b.deadline&&normalizeAnswer(b.english)===normalized);
    if(!bomb)return {state,result:{correct:false,awarded:0,auto:true}};
   }else{
    bomb=state.bombs.find(b=>b.id===input.bombId);
    if(!bomb||bomb.status!=='WAITING'||now<bomb.spawnAt||now>=bomb.deadline)throw fail('Quả bom chưa xuất hiện, đã nổ hoặc đã được giải',409);
   }
   if(normalized===normalizeAnswer(bomb.english)){
    bomb.status='DEFUSED';state.correct++;state.score+=points;result={correct:true,awarded:points,auto};
   }else{noteWrongGameWord(state,bomb.wordId);bomb.tries++;state.mistakes++;state.score=Math.max(0,state.score-round.penalty);}
   if(state.bombs.every(b=>b.status!=='WAITING'))state.status='COMPLETED';
  }else if(state.mode==='CAR'){
   const auto=input.auto===true;
   // A typed complete English answer selects its safe lane on the server.
   // No lane IDs or answer hashes are revealed to the browser in auto mode.
   if(auto&&input.lane!==undefined)throw fail('CAR tự động không nhận làn do trình duyệt chọn');
   const level=state.levels[state.index];if(!level)throw fail('Đường đua đã kết thúc',409);
   const typed=normalizeAnswer(input.answer);
   if(auto&&(!typed||typed.length>100))throw fail('Nhập từ tiếng Anh hợp lệ');
   if(now<state.stepStartedAt+MIN_CAR_STEP_MS)throw fail('Chặng xe chưa sẵn sàng. Hãy đợi trước khi lái.',409);
   let lane;
   if(auto){
    if(now-Number(state.lastCarAutoAt||0)<150)throw fail('Nhập quá nhanh, hãy thử lại',429);
    if(Number(state.carAutoAttempts||0)>=Math.max(96,Number(round.question_count||8)*24))throw fail('Đã vượt giới hạn kiểm tra CAR tự động',429);
    state.lastCarAutoAt=now;state.carAutoAttempts=Number(state.carAutoAttempts||0)+1;
    lane=level.lanes.findIndex(x=>x.kind!=='BLOCKED'&&normalizeAnswer(x.english)===typed);
    if(lane===-1)return {state,result:{correct:false,wordCorrect:false,awarded:0,auto:true}};
   }else{
    lane=Number(input.lane);
    if(!Number.isInteger(lane)||lane<0||lane>4)throw fail('Làn đường phải từ 1 đến 5');
   }
   const fromLane=Number.isInteger(state.carLane)?state.carLane:2;
   const target=level.lanes?.[lane];
   if(!target)throw fail('Làn đường không hợp lệ',409);
   if(target.kind!=='BLOCKED'){
    if(!typed||typed.length>100)throw fail('Hãy nhập từ tiếng Anh trước khi vượt chặng');
    if(typed!==normalizeAnswer(target.english)){
      noteWrongGameWord(state,target.wordId);
     state.mistakes++;state.score=Math.max(0,state.score-round.penalty);
     return {state,result:{correct:false,wordCorrect:false,awarded:0}};
    }
   }
   level.finished=true;
   if(target.kind==='BLOCKED'){
    state.health--;state.mistakes++;state.score=Math.max(0,state.score-round.penalty);
    result={correct:false,wordCorrect:null,laneSafe:false,awarded:0,laneFrom:fromLane,laneTo:fromLane};
    if(state.health<=0){state.health=0;state.status='FAILED'}
   }else{
    const bonus=target.kind==='DOUBLE'?points:(target.kind==='BONUS'?Math.round(points*.5):0);
    state.score+=points+bonus;state.correct++;state.carLane=lane;
    result={correct:true,wordCorrect:true,laneSafe:true,awarded:points+bonus,bonus,multiplier:target.kind==='DOUBLE'?2:1,laneFrom:fromLane,laneTo:lane,auto};
   }
  state.index++;state.stepStartedAt=now;
  if(state.status==='PLAYING'&&state.index>=state.levels.length)state.status='COMPLETED';
 }
 return {state,result};
}
export function publicState(state,now=Date.now()){
 const common={mode:state.mode,score:state.score,correct:state.correct,mistakes:state.mistakes,health:state.health,status:state.status,endsAt:state.endsAt,now};
 if(state.mode==='MATCH'){
  const choices=[...state.pairs.map(p=>({id:p.rightId,meaning:p.meaning,matched:p.matched})),...(state.distractors||[]).map(d=>({id:d.rightId,meaning:d.meaning,matched:false}))];
  choices.sort((a,b)=>a.id.localeCompare(b.id));
  return {...common,pairs:state.pairs.map(p=>({id:p.id,english:p.english,matched:p.matched})),rightOptions:choices};
 }
 if(state.mode==='MATRIX'){
  const completed=new Set(state.pairs.filter(p=>p.matched).flatMap(p=>[p.enId,p.viId]));
  return {...common,gridSize:state.gridSize,cards:state.cards.map(c=>c.empty?{empty:true}:({
   id:c.id,label:c.label,lang:c.lang,matched:completed.has(c.id)
  }))};
 }
 if(state.mode==='MEMORY'){
  const matched=new Set(state.pairs.filter(p=>p.matched).flatMap(p=>[p.enId,p.viId]));
  const revealed=new Set(state.flippedIds||[]);
  return {...common,gridSize:state.gridSize,flipUntil:state.flipUntil||0,cards:state.cards.map(c=>c.empty?{empty:true}:({
   id:c.id,matched:matched.has(c.id),revealed:revealed.has(c.id),
   ...(revealed.has(c.id)?{label:c.label,lang:c.lang}:{})
  }))};
 }
 if(state.mode==='BOMB'){
   return {...common,bombs:state.bombs.filter(b=>now>=b.spawnAt&&b.status==='WAITING').map((b,i)=>({id:b.id,meaning:b.meaning,spawnAt:b.spawnAt,deadline:b.deadline,slot:b.slot??(i%2),tries:b.tries})) ,left:state.bombs.filter(b=>b.status==='WAITING').length};
 }
 if(state.mode==='CAR'){
  const l=state.levels[state.index];return {...common,index:state.index,total:state.levels.length,carLane:Number.isInteger(state.carLane)?state.carLane:2,stepStartedAt:state.stepStartedAt,nextAllowedAt:state.stepStartedAt+MIN_CAR_STEP_MS,stepDeadlineAt:state.stepStartedAt+(Number(state.stepDurationMs)||Math.floor((state.endsAt-state.startedAt)/state.levels.length)),level:l?{lanes:l.lanes.map(x=>x.kind==='BLOCKED'?{kind:x.kind}:{kind:x.kind,meaning:x.meaning,cefr:x.cefr})}:null};
 }
 return common;
}
