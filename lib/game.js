import { randomInt,randomUUID } from 'node:crypto';

export const MODES=['MATCH','BOMB','CAR'];
export const DIFFICULTIES=['EASY','NORMAL','HARD'];
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
  if(words.length<n)throw fail(`Chủ đề cần ít nhất ${n} từ để tổ chức vòng nối từ`);
  state.pairs=shuffle(words).slice(0,n).map(w=>({id:String(w.id),english:w.english,meaning:w.meaning,matched:false}));
  state.wrongAttempts=0;
  const distractions={EASY:0,NORMAL:2,HARD:4}[round.difficulty]||0;
  state.distractors=shuffle(words.filter(w=>!state.pairs.some(p=>p.id===String(w.id)))).slice(0,distractions).map(w=>({id:String(w.id),meaning:w.meaning}));
 }else if(round.mode==='BOMB'){
  if(words.length<n)throw fail(`Chủ đề cần ít nhất ${n} từ để tổ chức vòng điền từ`);
  const interval={EASY:4000,NORMAL:3000,HARD:2000}[round.difficulty];
  const lifetime={EASY:12000,NORMAL:9000,HARD:6500}[round.difficulty];
  const chosen=shuffle(words).slice(0,n);
  state.bombs=chosen.map((w,i)=>({id:randomUUID(),english:w.english,meaning:w.meaning,spawnAt:now+i*interval,deadline:Math.min(now+i*interval+lifetime,endsMs),status:'WAITING',tries:0}));
 }else if(round.mode==='CAR'){
  const levels=[];
  for(let i=0;i<n;i++){
   const lanes=shuffle([0,1,2,3,4]);
   levels.push({blocked:lanes.slice(0,round.difficulty==='HARD'?3:round.difficulty==='NORMAL'?2:1),bonus:lanes[4],double:lanes[3],finished:false});
  }
  state.levels=levels;state.index=0;state.stepStartedAt=now;
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
  const right=state.pairs.find(p=>p.id===input.rightId);
  const distractor=state.distractors?.some(d=>d.id===input.rightId);
  if(!left||(!right&&!distractor)||left.matched||right?.matched)throw fail('Cặp từ đã được chọn hoặc không tồn tại');
  if(left.id===right.id){left.matched=true;state.score+=points;state.correct++;result={correct:true,awarded:points}}
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
  const lane=Number(input.lane);if(!Number.isInteger(lane)||lane<0||lane>4)throw fail('Lane phải từ 0 đến 4');
  const level=state.levels[state.index];if(!level)throw fail('Đường đua đã kết thúc',409);
  level.finished=true;
  if(level.blocked.includes(lane)){
   state.health--;state.mistakes++;state.score=Math.max(0,state.score-round.penalty);
   if(state.health<=0){state.health=0;state.status='FAILED'}
  }else{
   const bonus=lane===level.double?points:(lane===level.bonus?Math.round(points*.5):0);
   state.score+=points+bonus;state.correct++;result={correct:true,awarded:points+bonus,bonus,multiplier:lane===level.double?2:1};
  }
  state.index++;state.stepStartedAt=now;
  if(state.status==='PLAYING'&&state.index>=state.levels.length)state.status='COMPLETED';
 }
 return {state,result};
}
export function publicState(state,now=Date.now()){
 const common={mode:state.mode,score:state.score,correct:state.correct,mistakes:state.mistakes,health:state.health,status:state.status,endsAt:state.endsAt,now};
 if(state.mode==='MATCH'){
  return {...common,pairs:state.pairs.map(p=>({id:p.id,english:p.english,meaning:p.meaning,matched:p.matched})),distractors:state.distractors||[]};
 }
 if(state.mode==='BOMB'){
  return {...common,bombs:state.bombs.filter(b=>now>=b.spawnAt&&b.status==='WAITING').map(b=>({id:b.id,meaning:b.meaning,deadline:b.deadline,tries:b.tries})) ,left:state.bombs.filter(b=>b.status==='WAITING').length};
 }
 if(state.mode==='CAR'){
  const l=state.levels[state.index];return {...common,index:state.index,total:state.levels.length,stepStartedAt:state.stepStartedAt,level:l?{blocked:l.blocked,bonus:l.bonus,double:l.double}:null};
 }
 return common;
}
