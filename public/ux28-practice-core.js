/* UX28.1: active recall from the same account-owned SRS queue shown in My Learning.
 * No separate list of game mistakes or progress database is introduced.
 */
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const STATUSES=new Set(['due','new','upcoming']);

export function normalizeRecallAnswer(value){
 return String(value??'').normalize('NFKC').trim().toLocaleLowerCase('en')
  .replace(/[\u2018\u2019]/g,"'").replace(/\s+/g,' ');
}
export function gradeRecall(typed,expected){
 const actual=normalizeRecallAnswer(typed);
 const answer=normalizeRecallAnswer(expected);
 return {correct:actual.length>0&&answer.length>0&&actual===answer,
  provided:actual,expected:answer};
}

export function practiceSelectionFromUrl(search=''){
 const params=new URLSearchParams(search);
 const status=params.get('status')??'due';
 const topic=params.get('topic')??'';
 if(!STATUSES.has(status)||topic.length>80||/[\u0000-\u001f]/.test(topic))
   throw Error('Bộ lọc Nhóm ôn không hợp lệ. Hãy mở lại từ My Learning.');
 return {status,topic};
}
export function reviewGroupLabel(status){
 return ({due:'Đến hạn',new:'Từ mới',upcoming:'Sắp đến hạn'})[status]||'Nhóm ôn';
}
export function selectPracticeQueue(payload,actorId,{status,topic},limit=10){
 if(!payload||payload.scope!=='account-srs'||payload.actor_id!==actorId||
    payload.status!==status||payload.topic!==topic||
    !Array.isArray(payload.words)||!Number.isSafeInteger(payload.total)||
    payload.total<0||!Number.isInteger(limit)||limit<1||limit>20)
   throw Error('Lịch ôn không khớp tài khoản hoặc bộ lọc hiện tại.');
 const words=[],seen=new Set();
 for(const row of payload.words){
  if(!row||!UUID.test(row.id)||!['shared','personal'].includes(row.source)||
     !['new','due','scheduled'].includes(row.status)||
     !Number.isSafeInteger(row.review_count)||row.review_count<0||
     typeof row.english!=='string'||typeof row.meaning!=='string'||
     typeof row.topic!=='string')
   throw Error('Dữ liệu từ trong Nhóm ôn không hợp lệ.');
  const key=row.source+':'+row.id;
  if(seen.has(key))throw Error('Lịch ôn chứa từ bị lặp.');
  seen.add(key);
  // Never put a word without a Vietnamese meaning into a meaning-to-English quiz.
  if(row.meaning.trim()&&row.english.trim()&&words.length<limit)
   words.push({word_id:row.id,source:row.source,english:row.english,
    meaning:row.meaning,topic:row.topic,ipa:row.ipa||'',example:row.example||'',
    review_count:row.review_count,status:row.status});
 }
 return words;
}
export function reviewPayload(word,remembered,actorId,requestId){
 if(!word||!['shared','personal'].includes(word.source)||
    !UUID.test(word.word_id)||!UUID.test(actorId)||!UUID.test(requestId)||
    typeof remembered!=='boolean'||!Number.isSafeInteger(word.review_count)||
    word.review_count<0)
   throw Error('Không thể tạo lệnh ôn từ an toàn.');
 return {request_id:requestId,source:word.source,word_id:word.word_id,remembered,
  expected_review_count:word.review_count,expected_actor_id:actorId};
}
