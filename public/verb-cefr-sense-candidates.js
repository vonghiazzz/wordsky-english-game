/* UX53B phase 5: proposed sense splits, NOT CEFR approvals.
 * This independent editorial queue never changes the 300-verb dictionary,
 * user history, quiz eligibility, or legacy Vietnamese glosses.
 * Exact CEFR sense levels require separate dictionary-source verification.
 */
const drafts = [
 ['be','identity','là','She is a doctor.'],
 ['be','location','ở','They are at home.'],
 ['begin','event-start','bắt đầu xảy ra','The movie begins at seven.'],
 ['begin','activity-start','bắt đầu làm','I began writing a letter.'],
 ['do','perform-task','làm một việc','I do my homework.'],
 ['do','auxiliary','trợ động từ trong câu hỏi hoặc phủ định','Do you like tea?'],
 ['get','receive','nhận được','I got a letter.'],
 ['get','fetch','đi lấy rồi mang về','Please get me a glass of water.'],
 ['give','hand-over','đưa cho','Give me the book.'],
 ['give','provide','cung cấp','This book gives useful advice.'],
 ['make','create','tạo ra','She makes furniture.'],
 ['make','cause','khiến, làm cho','The news made me happy.'],
 ['speak','talk','nói chuyện','Can I speak to you?'],
 ['speak','address','phát biểu trước nhiều người','She spoke at the meeting.'],
 ['take','carry','mang theo','Take your umbrella.'],
 ['take','consume-time','mất thời gian','The journey takes two hours.']
];
const entries=Object.freeze(drafts.map(([v1,key,vi,example])=>Object.freeze({
 id:v1+'.'+key,v1,meaning_vi:vi,example_en:example,
 status:'proposed',cefrLevel:null,sense_source_id:null,sense_source_url:null
})));
export function listVerbSenseCandidates(){return entries.slice();}
export function findVerbSenseCandidates(v1){return entries.filter(x=>x.v1===v1);}
export function getApprovedVerbSenseLevel(id){
 const entry=entries.find(x=>x.id===id);
 return entry?.status==='approved'&&entry.cefrLevel&&entry.sense_source_id&&entry.sense_source_url
  ?entry.cefrLevel:null;
}
