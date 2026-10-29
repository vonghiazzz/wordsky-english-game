/* UX27: user-owned game mistakes read exclusively from PostgreSQL. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let lastSyncedActor = null;
  let lastSyncedAt = 0;
  let actorId = null;
  let words = [];
  let generation = 0;

  async function api(path, options = {}) {
    const headers = {accept:'application/json'};
    if (options.body !== undefined) headers['content-type']='application/json';
    const response = await fetch('/api/' + path, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      ...(options.body === undefined ? {} : {body:JSON.stringify(options.body)})
    });
    let data;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) {
      const error = new Error(data?.error || 'Không kết nối được WordSky. Hãy thử lại.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  const normalize = value => String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if(className)element.className=className;
    if(text!==undefined)element.textContent=String(text);
    return element;
  };
  function message(value, kind='info') {
    const output=$('ws27Status');
    output.textContent=value;
    output.dataset.kind=kind;
  }
  function dateText(value) {
    const at=Date.parse(value);
    return Number.isFinite(at)?new Date(at).toLocaleDateString('vi-VN',{
      timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'
    }):'—';
  }
  function addMeta(host, label) {
    host.append(make('span','',label));
  }
  function render() {
    const needle=normalize($('ws27Search').value);
    const selectedMode=$('ws27Mode').value;
    const filtered=words.filter(w=>
      (!selectedMode||w.modes?.includes(selectedMode))&&
      (!needle||normalize([w.english,w.meaning,w.topic].join(' ')).includes(needle))
    );
    $('ws27Count').textContent='Hiển thị '+filtered.length+'/'+words.length+' từ theo bộ lọc';
    $('ws27Empty').hidden=filtered.length>0;
    $('ws27Empty').querySelector('h3').textContent=words.length
      ?'Không tìm thấy từ khớp bộ lọc':'🌟 Chưa có từ sai được ghi nhận';
    const host=$('ws27List');
    host.replaceChildren();
    for(const word of filtered) {
      const card=make('article','ws27-word');
      card.dataset.wordId=String(word.word_id);
      const description=make('div','');
      const title=make('h3','',word.english);
      if(word.ipa)title.append(make('small','', '  '+word.ipa));
      description.append(title,make('p','ws27-meaning',word.meaning));
      const tags=make('div','ws27-meta');
      addMeta(tags,word.topic||'Chủ đề chung');
      addMeta(tags,(word.modes||[]).join(' · '));
      addMeta(tags,Number(word.mistake_runs||0)+' lượt gặp khó');
      addMeta(tags,'Gần nhất '+dateText(word.last_seen_at));
      if(Number(word.review_count||0)>0)addMeta(tags,'Đã ôn '+word.review_count+' lần');
      description.append(tags);
      const actions=make('div','ws27-word-actions');
      const needsReview=word.remembered===false&&Number(word.review_count||0)>0;
      const state=make('span','ws27-state '+(needsReview?'ws27-state-due':'ws27-state-neutral'),
        needsReview?'✓ Đã tự thêm vào Cần ôn':word.remembered?'✓ Đã nhớ sau lần ôn':'↻ Chưa có lượt ôn');
      actions.append(state);
      card.append(description,actions);
      host.append(card);
    }
  }

  async function load(forceSync=false) {
    const ticket=++generation;
    $('ws27Account').hidden=true;
    $('ws27Guest').hidden=true;
    message('Đang đồng bộ sổ từ sai với PostgreSQL…');
    try {
      const session=await api('auth/me');
      if(ticket!==generation)return;
      const id=session?.actor?.role==='player'?session.actor.id:null;
      if(!id) {
        actorId=null;
        lastSyncedActor=null;
        words=[];
        $('ws27Guest').hidden=false;
        message('Hãy đăng nhập học viên trên WordSky để mở sổ từ sai của tài khoản.');
        return;
      }
      if(actorId && actorId!==id){lastSyncedActor=null;lastSyncedAt=0;}
      actorId=id;
      let syncError='';
      // Automatically reconcile completed games from before this patch.
      // One actor-pinned, idempotent POST; no per-word confirmation needed.
      if(forceSync||lastSyncedActor!==id||Date.now()-lastSyncedAt>60000){
        try{
          const synced=await api('learning/game-mistakes/sync',{
            method:'POST',body:{expected_actor_id:id}
          });
          if(synced.actor_id!==id)throw Error('Kết quả đồng bộ không đúng tài khoản');
          lastSyncedActor=id;lastSyncedAt=Date.now();
        }catch(error){syncError=error.message||'Không đồng bộ được lịch ôn';}
      }
      const result=await api('learning/game-mistakes');
      if(ticket!==generation)return;
      if(result?.scope!=='account-game-mistakes'||result.actor_id!==id||
         !Array.isArray(result.words))throw Error('Phản hồi không khớp tài khoản hiện tại');
      // Prevent stale response rendering after a logout/account switch.
      const confirm=await api('auth/me');
      if(ticket!==generation)return;
      if(confirm?.actor?.role!=='player'||confirm.actor.id!==id)
        throw Error('Phiên đăng nhập đã thay đổi. Tải lại trước khi xem dữ liệu.');
      words=result.words;
      $('ws27Account').hidden=false;
      $('ws27Total').textContent=words.length+(result.has_more?'+':'');
      $('ws27Misses').textContent=words.reduce((sum,w)=>sum+Number(w.mistake_runs||0),0);
      $('ws27Reviewed').textContent=words.filter(w=>w.remembered===false&&Number(w.review_count||0)>0).length;
      $('ws27Scope').textContent='Từ sai của tài khoản hiện tại · PostgreSQL · Chỉ Solo MATCH/BOMB/CAR từ UX27. Tối đa '+result.limit+' từ gần đây.';
      render();
      message(syncError
        ?'Đã tải '+words.length+' từ. Chưa xác minh đồng bộ tự động: '+syncError
        :'Đã tự đồng bộ '+words.length+' từ với tài khoản WordSky. Từ cần ôn được đánh dấu tự động sau trận.'+
         (result.has_more?' Hiển thị '+result.limit+' từ gần đây.':''),syncError?'error':'success');
    } catch(error) {
      if(ticket!==generation)return;
      $('ws27Account').hidden=true;
      words=[];
      message(error.message||'Không thể đồng bộ sổ từ sai','error');
    }
  }

  function boot() {
    $('ws27Reload').addEventListener('click',()=>load(true));
    $('ws27Search').addEventListener('input',render);
    $('ws27Mode').addEventListener('change',render);
    window.addEventListener('pageshow',event=>{if(event.persisted)load()});
    // Cookies can change in another tab without triggering local storage events.
    // Revalidate actor ownership whenever the learner returns to this page.
    window.addEventListener('focus',()=>{if(!document.hidden)load()});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
    load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
