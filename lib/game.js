import { randomInt,randomUUID } from 'node:crypto';

export const MODES=['MATCH','BOMB','CAR'];
export const DIFFICULTIES=['EASY','NORMAL','HARD'];
export const MATCH_DISTRACTORS={EASY:0,NORMAL:2,HARD:4};
export const MIN_CAR_STEP_MS=1200;
export const CAR_CEFR_LEVELS=Object.freeze({NORMAL:['A1','A2'],BONUS:['B1','B2'],DOUBLE:['C1','C2']});
export const carBlockedCount=difficulty=>difficulty==='EASY'?1:2;
// Every lane needs a different reviewed word, also across stages.
export function carWordRequirements(round){
 const count=Number(round.question_count);
 const regular=5-carBlockedCount(round.difficulty)-2;
 return {A2:regular*count,BONUS:count,DOUBLE:count};
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
 if(count<required)throw fail(`Ch\u1ee7 \u0111\u1ec1 c\u1ea7n \u00edt nh\u1ea5t ${required} t\u1eeb cho v\u00f2ng ${round.mode} ${round.difficulty}, nh\u01b0ng ch\u1ec9 c\u00f3 ${count} t\u1eeb.`,400);
}

export function normalizeAnswer(value){return String(value??'').normalize('NFKC').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N} ]/gu,' ').replace(/\s+/g,' ').trim()}
export function rankForXp(xp){ if(xp>=3000)return 'Kim cương';if(xp>=1400)return 'Bạch kim';if(xp>=600)return 'Vàng';if(xp>=200)return 'Bạc';return 'Đồng'}
export function awardedAttendance(streak){return 20+Math.min(7,Math.max(1,streak))*5}
export function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a}
export const fail=(message,status=400)=>{let e=new Error(message);e.status=status;return e};
const CHECK_ID=/^[0-9a-f-]{20,40}$/i;
export function normalizeRound(input){
 const mode=String(input.mode||'').toUpperCase();const difficulty=String(input.difficulty||'NORMAL').toUpperCase();
 if(!MODES.includes(mode))throw fail('Chế độ vòng thi không hợp lệ');
 if(!DIFFICULTIES.includes(difficulty))throw fail('Độ khó không hợp lệ');
 const d={mode,difficulty,duration_seconds:Number(input.duration_seconds||100),question_count:Number(input.question_count||8),points_per_correct:Number(input.points_per_correct||100),penalty:Number(input.penalty??25),weight:Number(input.weight??1),topic_id:input.topic_id||null};
 if(!Number.isInteger(d.duration_seconds)||d.duration_seconds<20||d.duration_seconds>600)throw fail('Thời gian vòng từ 20 đến 600 giây');
 if(!Number.isInteger(d.question_count)||d.question_count<3||d.question_count>30)throw fail('Số câu/vật cản từ 3 đến 30');
 if(!Number.isInteger(d.points_per_correct)||d.points_per_correct<10||d.points_per_correct>1000)throw fail('Điểm mỗi câu từ 10 đến 1000');
 if(!Number.isInteger(d.penalty)||d.penalty<0||d.penalty>1000)throw fail('Điểm trừ không hợp lệ');
 if(!Number.isInteger(d.weight)||d.weight<1||d.weight>10)throw fail('Hệ số vòng từ 1 đến 10');
 if(d.topic_id&&!CHECK_ID.test(d.topic_id))throw fail('ID chủ đề không hợp lệ');
 if(mode!=='CAR'&&!d.topic_id)throw fail('Vòng từ vựng phải chọn chủ đề');
 if(mode==='MATCH' && d.question_count>20)throw fail('Nối từ tối đa 20 cặp');
 const interval={EASY:4,NORMAL:3,HARD:2}[difficulty];
 if(mode==='BOMB'&&d.duration_seconds<Math.ceil(d.question_count*interval+8))throw fail('Vòng bom cần thời gian ít nhất số bom × khoảng cách thả + 8 giây');
 if(mode==='CAR'&&d.duration_seconds<Math.ceil(d.question_count*1.2))throw fail('Vòng xe cần tối thiểu 1,2 giây cho mỗi chặng');
 return d;
}
export function roundWindows(startISO,rounds){
 let elapsed=0;const t=new Date(startISO).getTime();return rounds.map(r=>{const start=new Date(t+elapsed*1000).toISOString();elapsed+=Number(r.duration_seconds);return {...r,starts_at:start,ends_at:new Date(t+elapsed*1000).toISOString()}})
}
export function createState(round,words,now=Date.now(),endsMs=now+round.duration_seconds*1000){
 const n=round.question_count;
 const state={mode:round.mode,startedAt:now,endsAt:endsMs,score:0,correct:0,mistakes:0,health:3,status:'PLAYING'};
 if(round.mode==='MATCH'){
  assertWordCapacity(round,words.length);
  // The real-word ID stays on the server; meaning choices get unrelated random IDs.
  // Never expose meaning + English or a shared ID in the same public record.
  state.pairs=shuffle(words).slice(0,n).map(w=>({id:String(w.id),rightId:randomUUID(),english:w.english,meaning:w.meaning,matched:false}));
  state.wrongAttempts=0;
  const distractions=MATCH_DISTRACTORS[round.difficulty];
  state.distractors=shuffle(words.filter(w=>!state.pairs.some(p=>p.id===String(w.id)))).slice(0,distractions).map(w=>({rightId:randomUUID(),meaning:w.meaning}));
 }else if(round.mode==='BOMB'){
  assertWordCapacity(round,words.length);
  const interval={EASY:4000,NORMAL:3000,HARD:2000}[round.difficulty];
  const lifetime={EASY:12000,NORMAL:9000,HARD:6500}[round.difficulty];
  const chosen=shuffle(words).slice(0,n);
  state.bombs=chosen.map((w,i)=>({id:randomUUID(),english:w.english,meaning:w.meaning,spawnAt:now+i*interval,deadline:Math.min(now+i*interval+lifetime,endsMs),status:'WAITING',tries:0}));
  }else if(round.mode==='CAR'){
   if(!words||Array.isArray(words)||typeof words!=='object')throw fail('CAR cần 3 nhóm từ CEFR đã duyệt');
   const missing=carMissingWords(round,words);
   if(missing.length)throw fail('Chưa đủ từ đã duyệt cho Lane Escape: '+missing.join('; '));
   const buckets={A2:shuffle(words.A2),BONUS:shuffle(words.BONUS),DOUBLE:shuffle(words.DOUBLE)};
   const levels=[];
   for(let i=0;i<n;i++){
    const order=shuffle([0,1,2,3,4]);
    const blocked=new Set(order.slice(0,carBlockedCount(round.difficulty)));
    const bonus=order[carBlockedCount(round.difficulty)];
    const double=order[carBlockedCount(round.difficulty)+1];
    const lanes=Array.from({length:5},(_,lane)=>{
     if(blocked.has(lane))return {kind:'BLOCKED'};
     const tier=lane===double?'DOUBLE':lane===bonus?'BONUS':'A2';
     const card=buckets[tier].pop();
     return {kind:tier==='A2'?'NORMAL':tier,english:card.english,meaning:card.meaning,cefr:card.cefr_level};
    });
    levels.push({lanes,finished:false});
   }
   state.levels=levels;state.index=0;state.carLane=2;state.stepStartedAt=now;
 }
 return state;
}
export function reconcile(state,round,now=Date.now()){
 if(state.status!=='PLAYING')return state;
 if(state.mode==='BOMB'){
  for(const b of state.bombs){
   if(b.status==='WAITING'&&now>=b.deadline){b.status='MISSED';state.health--;state.mistakes++}
   if(state.health<=0){state.health=0;state.status='FAILED';break}
  }
  if(state.status==='PLAYING'&&state.bombs.every(b=>b.status!=='WAITING'))state.status='COMPLETED';
 }
 if(state.mode==='CAR'){
  const stepMs=Math.max(1200,Math.floor((state.endsAt-state.startedAt)/state.levels.length));
  while(state.status==='PLAYING'&&state.index<state.levels.length&&now>=state.stepStartedAt+stepMs){
   state.levels[state.index].finished=true;state.health--;state.mistakes++;state.index++;state.stepStartedAt+=stepMs;
   if(state.health<=0){state.health=0;state.status='FAILED';break}
  }
  if(state.index>=state.levels.length&&state.status==='PLAYING')state.status='COMPLETED';
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
  else{state.score=Math.max(0,state.score-round.penalty);state.mistakes++;state.wrongAttempts++;}
  if(state.pairs.every(p=>p.matched))state.status='COMPLETED';
 }else if(state.mode==='BOMB'){
  const bomb=state.bombs.find(b=>b.id===input.bombId);
  if(!bomb||bomb.status!=='WAITING'||now<bomb.spawnAt||now>=bomb.deadline)throw fail('Quả bom chưa xuất hiện, đã nổ hoặc đã được giải',409);
  const normalized=normalizeAnswer(input.answer);
  if(!normalized||normalized.length>100)throw fail('Nhập câu trả lời tiếng Anh');
  if(normalized===normalizeAnswer(bomb.english)){
   bomb.status='DEFUSED';state.correct++;state.score+=points;result={correct:true,awarded:points};
  }else{bomb.tries++;state.mistakes++;state.score=Math.max(0,state.score-round.penalty);}
  if(state.bombs.every(b=>b.status!=='WAITING'))state.status='COMPLETED';
  }else if(state.mode==='CAR'){
   const lane=Number(input.lane);if(!Number.isInteger(lane)||lane<0||lane>4)throw fail('Làn đường phải từ 1 đến 5');
   const level=state.levels[state.index];if(!level)throw fail('Đường đua đã kết thúc',409);
   if(now<state.stepStartedAt+MIN_CAR_STEP_MS)throw fail('Chặng xe chưa sẵn sàng. Hãy đợi trước khi lái.',409);
   const fromLane=Number.isInteger(state.carLane)?state.carLane:2;
   const target=level.lanes?.[lane];
   if(!target)throw fail('Làn đường không hợp lệ',409);
   if(target.kind!=='BLOCKED'){
    const typed=normalizeAnswer(input.answer);
    if(!typed||typed.length>100)throw fail('Hãy nhập từ tiếng Anh trước khi vượt chặng');
    if(typed!==normalizeAnswer(target.english)){
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
    result={correct:true,wordCorrect:true,laneSafe:true,awarded:points+bonus,bonus,multiplier:target.kind==='DOUBLE'?2:1,laneFrom:fromLane,laneTo:lane};
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
 if(state.mode==='BOMB'){
   return {...common,bombs:state.bombs.filter(b=>now>=b.spawnAt&&b.status==='WAITING').map(b=>({id:b.id,meaning:b.meaning,spawnAt:b.spawnAt,deadline:b.deadline,tries:b.tries})) ,left:state.bombs.filter(b=>b.status==='WAITING').length};
 }
 if(state.mode==='CAR'){
  const l=state.levels[state.index];return {...common,index:state.index,total:state.levels.length,carLane:Number.isInteger(state.carLane)?state.carLane:2,stepStartedAt:state.stepStartedAt,nextAllowedAt:state.stepStartedAt+MIN_CAR_STEP_MS,level:l?{lanes:l.lanes.map(x=>x.kind==='BLOCKED'?{kind:x.kind}:{kind:x.kind,meaning:x.meaning,cefr:x.cefr})}:null};
 }
 return common;
}
