/* UX58 M1 — pure daily learning-plan suggestion, NOT a progress store.
 * Input counts must come from an authenticated, actor-pinned SRS service.
 * No implicit daily completion, streak, timestamps or browser-local SRS truth.
 */
const integer=(n,name)=>{
 if(!Number.isSafeInteger(n)||n<0)throw Error('Số lượng '+name+' không hợp lệ');
 return n;
};
const normalizeGoal=(value,name)=>{
 if(!Number.isSafeInteger(value)||value<0||value>50)
  throw Error('Mục tiêu '+name+' phải từ 0 đến 50');
 return value;
};

/**
 * Build a suggested task plan from existing SRS queue availability.
 * `due` and `new` are disjoint source counts, not a mutable progress log.
 * `upcoming` is displayed only as context; never schedules early review.
 */
export function createDailyLearningPlan(
 availability,{dueGoal=10,newGoal=10}={}
){
 if(!availability||typeof availability!=='object'||Array.isArray(availability))
  throw Error('Thiếu số liệu SRS xác thực');
 const due=integer(availability.due,'đến hạn');
 const fresh=integer(availability.new,'từ mới');
 const upcoming=integer(availability.upcoming,'sắp đến hạn');
 const maxDue=normalizeGoal(dueGoal,'ôn tập');
 const maxNew=normalizeGoal(newGoal,'từ mới');
 const plannedDue=Math.min(due,maxDue);
 const plannedNew=Math.min(fresh,maxNew);
 return Object.freeze({
  version:1,
  source:'account-srs-read-only',
  tasks:Object.freeze([
   Object.freeze({type:'due',available:due,planned:plannedDue,url:'practice.html?status=due'}),
   Object.freeze({type:'new',available:fresh,planned:plannedNew,url:'practice.html?status=new'})
  ]),
  upcoming,
  totalPlanned:plannedDue+plannedNew,
  hasWork:plannedDue+plannedNew>0,
  // Completion and streak MUST come from authenticated server-verified review
  // events, not availability counts, page visits or localStorage guesses.
  completed:null,
  streak:null
 });
}
