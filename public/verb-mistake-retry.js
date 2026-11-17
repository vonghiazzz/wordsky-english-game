// UX50: deterministic in-memory mistake summary and retry; zero account/SRS writes.
export function buildVerbMistakeSummary(questions, attempts){
 if(!Array.isArray(questions)||!Array.isArray(attempts)||questions.length!==attempts.length)
  throw Error('Incomplete practice attempt');
 const missed=[];
 let correct=0;
 questions.forEach((q,i)=>{
  if(attempts[i]?.correct===true){correct++;return;}
  missed.push({index:q.index,v1:q.v1,v2:q.v2,v3:q.v3,meaning:q.meaning,target:q.target,
   given:String(attempts[i]?.given??'')});
 });
 return {total:questions.length,correct,incorrect:missed.length,missed};
}
export function buildVerbRetryQuestions(missed){
 if(!Array.isArray(missed))throw Error('Invalid retry list');
 return missed.map(({index,v1,v2,v3,meaning,target},i)=>({index:i+1,v1,v2,v3,meaning,target}));
}
