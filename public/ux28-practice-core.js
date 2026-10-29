/* UX28 — pure account mistake practice selection and explicit recall grading.
 * Never treat the browser as a durable learning progress source of truth.
 */
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function normalizeRecallAnswer(value){
  return String(value??'').normalize('NFKC').trim().toLocaleLowerCase('en')
    .replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ');
}

export function gradeRecall(typed,expected){
  const actual=normalizeRecallAnswer(typed);
  const answer=normalizeRecallAnswer(expected);
  return {
    correct:actual.length>0&&answer.length>0&&actual===answer,
    provided:actual,
    expected:answer
  };
}

export function validateMistakeNotebook(payload,actorId){
  if(!payload||payload.scope!=='account-game-mistakes'||payload.actor_id!==actorId||
     !Array.isArray(payload.words))throw Error('Sổ từ sai không thuộc tài khoản hiện tại.');
  const seen=new Set();
  for(const row of payload.words){
    if(!row||!UUID.test(row.word_id)||typeof row.english!=='string'||
       typeof row.meaning!=='string'||!Number.isSafeInteger(row.review_count)||
       row.review_count<0||!Array.isArray(row.modes)||
       !row.modes.every(mode=>['MATCH','BOMB','CAR'].includes(mode))||
       seen.has(row.word_id))throw Error('Dữ liệu từ cần luyện không hợp lệ.');
    seen.add(row.word_id);
  }
  return payload;
}

export function selectRecallWords(words,{scope='needed',mode='',limit=10,wordId=''}={}){
  if(!Array.isArray(words)||!['needed','all'].includes(scope)||
     !['','MATCH','BOMB','CAR'].includes(mode)||![5,10,20].includes(limit)||
     (wordId&&(!UUID.test(wordId))))throw Error('Bộ lọc luyện từ không hợp lệ.');
  const items=words.filter(w=>w&&UUID.test(w.word_id)&&
    typeof w.english==='string'&&w.english.trim()&&
    typeof w.meaning==='string'&&w.meaning.trim()&&
    (!mode||w.modes?.includes(mode))&&
    (!wordId||w.word_id===wordId)&&
    (scope==='all'||w.remembered!==true));
  const unique=new Map(items.map(w=>[w.word_id,w]));
  const sorted=[...unique.values()].sort((a,b)=>{
    const pendingA=a.remembered===true?1:0;
    const pendingB=b.remembered===true?1:0;
    if(pendingA!==pendingB)return pendingA-pendingB;
    const mistakes=Number(b.mistake_runs||0)-Number(a.mistake_runs||0);
    if(mistakes!==0)return mistakes;
    const seen=String(b.last_seen_at||'').localeCompare(String(a.last_seen_at||''));
    return seen||a.english.localeCompare(b.english,'en')||a.word_id.localeCompare(b.word_id);
  });
  return sorted.slice(0,wordId?1:limit);
}

export function reviewPayload(word,remembered,actorId,requestId){
  if(!word||!UUID.test(word.word_id)||!UUID.test(actorId)||
     !UUID.test(requestId)||typeof remembered!=='boolean'||
     !Number.isSafeInteger(word.review_count)||word.review_count<0)
    throw Error('Không thể tạo lệnh ôn từ an toàn.');
  return {
    request_id:requestId,source:'shared',word_id:word.word_id,remembered,
    expected_review_count:word.review_count,expected_actor_id:actorId
  };
}
