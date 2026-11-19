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

/**
 * Validate the unfiltered, account-scoped summary returned with ANY SRS queue
 * page. The summary is global, not the current topic/page's `total`.
 * Never derive daily counts from paginated `words`.
 */
export function dailyPlanFromSrsQueue(payload,actorId,goals){
 const summary=payload?.summary;
 if(!actorId||typeof actorId!=='string'||
    payload?.scope!=='account-srs'||payload.actor_id!==actorId||
    !Array.isArray(payload.words)||!summary||typeof summary!=='object')
  throw Error('Dữ liệu kế hoạch không khớp tài khoản SRS');
 const due=integer(summary.due,'đến hạn');
 const fresh=integer(summary.new,'từ mới');
 const upcoming=integer(summary.upcoming,'sắp đến hạn');
 const total=integer(summary.total,'tổng SRS');
 if(due+fresh+upcoming!==total)
  throw Error('Tổng số từ SRS không khớp các nhóm');
 return createDailyLearningPlan({due,new:fresh,upcoming},goals);
}

export function validateDailyActivity(payload,actorId){
 if(!actorId||payload?.scope!=='account-daily-review-activity'||
   payload.actor_id!==actorId||payload.time_zone!=='Asia/Ho_Chi_Minh'||
   !/^\d{4}-\d{2}-\d{2}$/.test(payload.day)||!Number.isFinite(Date.parse(payload.as_of))||
   payload.basis!=='confirmed-review-history-not-game-scores')
  throw Error('Hoạt động học không khớp tài khoản hoặc múi giờ');
 for(const key of ['reviews_today','unique_words_today','streak_days'])
  integer(payload[key],key);
 if(payload.unique_words_today>payload.reviews_today||
    typeof payload.streak_capped!=='boolean'||payload.completed_goal!==null||
    (payload.streak_ends_on!==null&&typeof payload.streak_ends_on!=='string')||
    (payload.streak_days===0)!==(payload.streak_ends_on===null))
  throw Error('Dữ liệu hoạt động học không nhất quán');
 return payload;
}
