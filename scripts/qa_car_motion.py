"""Headless Chromium UI regression: preview-only simulated responses, never touches DB."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from datetime import datetime,timedelta,timezone
import os
root=Path(__file__).resolve().parents[1]
public=root/'public'
html=(public/'index.html').read_text()
css=(public/'style.css').read_text()
js=(public/'app.js').read_text()
now=datetime.now(timezone.utc)
start=(now-timedelta(seconds=4)).isoformat()
end=(now+timedelta(seconds=175)).isoformat()
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 try:
  page=b.new_page(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
  errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
  page.route('**/api/**',lambda route:route.fulfill(status=200,content_type='application/json',body='{"actor":null,"topics":[]}'))
  html_inline=html.replace('<link rel="stylesheet" href="/style.css" />','<style>'+css+'</style>').replace('<script src="/app.js" defer></script>','<script>'+js+'</script>')
  page.set_content(html_inline,wait_until='domcontentloaded')
  page.evaluate('''({start,end})=>{
   screen='rooms';document.querySelectorAll('.screen').forEach(x=>x.classList.toggle('active',x.id==='screen-rooms'));
   roomCode='DEMO';document.querySelector('#roomPane').classList.remove('hidden');document.querySelector('#joinRoomPane').classList.add('hidden');
   room={event:{join_code:'DEMO',title:'UI Motion QA',status:'LIVE',participant_count:2,max_players:10,rounds:[{id:'r',mode:'CAR',position:1,difficulty:'NORMAL',duration_seconds:180,question_count:3,points_per_correct:100,penalty:25,weight:1,starts_at:start,ends_at:end}]},board:[],me:{name:'QA'}};
   const lanes=[{kind:'BLOCKED'},{kind:'NORMAL',cefr:'A2',meaning:'học'},{kind:'BONUS',cefr:'B2',meaning:'xây dựng'},{kind:'DOUBLE',cefr:'C1',meaning:'củng cố'},{kind:'BLOCKED'}];
   game={runId:'run',round:room.event.rounds[0],game:{mode:'CAR',status:'PLAYING',score:0,correct:0,mistakes:0,health:3,index:0,total:3,carLane:2,stepStartedAt:Date.now()-2400,nextAllowedAt:Date.now()-1000,endsAt:Date.now()+120000,level:{lanes}}};
   api=async(path,opts={})=>{
    if(path.endsWith('/answer')){
      const lane=opts.body.lane,answer=opts.body.answer;
      if(answer!=='correct')return {game:{...game.game},result:{wordCorrect:false,correct:false,awarded:0}};
      return {game:{...game.game,index:game.game.index+1,carLane:lane,correct:game.game.correct+1,score:game.game.score+200,stepStartedAt:Date.now(),nextAllowedAt:Date.now()+1200},result:{wordCorrect:true,laneSafe:true,correct:true,awarded:200,laneFrom:game.game.carLane,laneTo:lane}};
    }
    if(path.includes('/runs/'))return {game:game.game};
    return {actor:null,topics:[]};
   };
   renderRoom();
  }''',{'start':start,'end':end})
  assert page.locator('#carVehicle').count()==1
  assert page.locator('#carVehicle').evaluate("e=>e.style.left")=='50%'
  page.locator('[data-lane="3"]').click()
  assert page.locator('#carVehicle').evaluate("e=>e.style.left")=='50%', 'Selecting must not move vehicle'
  assert 'CHỌN LÀN 4' in page.locator('.car-stage .game-bar').inner_text()
  page.evaluate("document.querySelector('#carAnswer').value='wrong';document.querySelector('#carAnswerForm').requestSubmit()")
  page.wait_for_timeout(140)
  assert page.locator('#carVehicle').evaluate("e=>e.style.left")=='50%', 'Wrong answer must not move vehicle'
  assert 'CHẶNG 1/3' in page.locator('.car-stage .game-bar').inner_text()
  page.evaluate("document.querySelector('#carAnswer').value='correct';document.querySelector('#carAnswerForm').requestSubmit()")
  page.wait_for_timeout(160)
  assert page.locator('.car-is-crossing').count()==1, 'Server-verified animation should start'
  assert page.locator('#carVehicle').evaluate('e=>e.style.left')=='70%'
  page.wait_for_timeout(480)
  assert page.locator('.car-stage').count()==1
  assert page.locator('#carVehicle').evaluate("e=>e.style.left")=='70%'
  assert 'CHẶNG 2/3' in page.locator('.car-stage .game-bar').inner_text()
  assert 'LÀN 4' in page.locator('.car-stage .game-bar').inner_text()
  width=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
  assert width<=3,('overflow',width)
  assert not errors,errors
  print('CAR MOTION BROWSER PASS: target selection does not move car; wrong answer stays; correct answer animates and advances; 390px no overflow.')
 finally:b.close()
