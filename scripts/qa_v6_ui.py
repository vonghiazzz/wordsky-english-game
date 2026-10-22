"""Local-only Chromium smoke; API responses are simulated, no DB writes.
Usage: python3 scripts/qa_v6_ui.py
Requires Python playwright and locally installed Chromium.
"""
from pathlib import Path
from threading import Thread
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from datetime import datetime, timezone, timedelta
import json, time, os
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
public=root/'public'
class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(public)))
Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_address[1]}'
shot=root/'preview-v6';shot.mkdir(exist_ok=True)
now=datetime.now(timezone.utc)
start=(now-timedelta(seconds=5)).isoformat()
end=(now+timedelta(minutes=3)).isoformat()
lanes=[{'kind':'BLOCKED'},{'kind':'NORMAL','meaning':'đến nơi','cefr':'A2'},{'kind':'BONUS','meaning':'cách tiếp cận','cefr':'B2'},{'kind':'DOUBLE','meaning':'sự khác biệt bất thường','cefr':'C1'},{'kind':'BLOCKED'}]
baseGame={'mode':'CAR','status':'PLAYING','score':0,'correct':0,'mistakes':0,'health':3,'index':0,'total':8,'stepStartedAt':int(time.time()*1000)-3000,'nextAllowedAt':int(time.time()*1000)-1000,'endsAt':int(time.time()*1000)+120000,'level':{'lanes':lanes}}
def run():
 with sync_playwright() as playwright:
  browser=playwright.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
  try:
   for width in [320,390,430,768]:
    page=browser.new_page(viewport={'width':width,'height':780},device_scale_factor=1,is_mobile=width<500,has_touch=width<500)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/api/**',lambda route: route.fulfill(status=200,content_type='application/json',body=json.dumps({'actor':None,'topics':[], 'events':[], 'features':[]})))
    html=(public/'index.html').read_text(encoding='utf-8')
    html=html.replace('<link rel="stylesheet" href="/style.css" />','<style>'+(public/'style.css').read_text(encoding='utf-8')+'</style>')
    html=html.replace('<script src="/app.js" defer></script>','<script>'+(public/'app.js').read_text(encoding='utf-8')+'</script>')
    page.set_content(html,wait_until='domcontentloaded')
    page.evaluate('''({start,end,level}) => {
      screen='rooms'; document.querySelectorAll('.screen').forEach(el=>el.classList.toggle('active',el.id==='screen-rooms'));
      roomCode='TEST';localTimeOffset=0;document.querySelector('#roomPane').classList.remove('hidden');document.querySelector('#joinRoomPane').classList.add('hidden');
      room={event:{join_code:'TEST',id:'e1',title:'QA CAR CEFR',status:'LIVE',participant_count:2,max_players:30,rounds:[{id:'r1',mode:'CAR',position:1,difficulty:'NORMAL',duration_seconds:180,question_count:8,points_per_correct:100,penalty:25,weight:1,starts_at:start,ends_at:end}]},board:[],me:{name:'Tester'}};
      game={runId:'run1',round:room.event.rounds[0],game:{...level}};
      renderRoom();
    }''',{'start':start,'end':end,'level':baseGame})
    page.wait_for_selector('.car-v6-lane')
    assert page.locator('.car-v6-lane').count()==5,(width,'lane count')
    page.locator('.car-v6-lane[data-lane="3"]').click()
    assert 'sự khác biệt bất thường' in page.locator('#carAnswerForm label').inner_text(),width
    assert 'C1' in page.locator('#carAnswerForm label').inner_text(),width
    page.locator('.car-v6-lane[data-lane="0"]').click()
    assert page.locator('#carAnswer').is_disabled(),width
    page.locator('.car-v6-lane[data-lane="2"]').click()
    assert page.locator('#carAnswer').is_enabled(),width
    if width==390:page.locator('#liveGame').screenshot(path=str(shot/'car-mobile.png'))
    overflow=page.evaluate('document.documentElement.scrollWidth-document.documentElement.clientWidth')
    assert overflow <= 3,('CAR overflow',width,overflow)
    # Move into BOMB mode and stress full Vietnamese definitions, some long.
    page.evaluate('''()=>{game.game={mode:'BOMB',status:'PLAYING',score:0,correct:0,mistakes:0,health:3,endsAt:Date.now()+120000,left:4,bombs:
      [{id:'a',meaning:'hành trình tham quan các địa danh văn hóa',spawnAt:Date.now()-1500,deadline:Date.now()+10500,tries:0},
       {id:'b',meaning:'sự khác biệt bất thường giữa hai kết quả',spawnAt:Date.now()-1500,deadline:Date.now()+10500,tries:0},
       {id:'c',meaning:'hành động kiểm tra một cách cực kỳ kỹ lưỡng',spawnAt:Date.now()-1500,deadline:Date.now()+10500,tries:0}]};game.round.mode='BOMB';selectedBombId='a';renderRoom();}''')
    page.wait_for_selector('.bomb-falling')
    assert page.locator('.bomb-falling').count()==3
    assert page.locator('.bomb-falling strong').first.inner_text()=='hành trình tham quan các địa danh văn hóa'
    if width==390:
     page.evaluate("document.querySelector('#toast')?.classList.add('hidden')")
     page.locator('#liveGame').screenshot(path=str(shot/'bomb-mobile.png'))
    rects=page.evaluate('''()=>({arena:(()=>{const x=document.querySelector('#bombArena').getBoundingClientRect();return {x:x.x,right:x.right}})(),bombs:[...document.querySelectorAll('.bomb-falling')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width}})})''')
    assert all(x['x']>=rects['arena']['x']-3 and x['right']<=rects['arena']['right']+3 for x in rects['bombs']),('BOMB position',width,rects)
    assert not errors,(width,errors)
    print('BROWSER QA PASS',width,'px')
    page.close()
  finally:browser.close();server.shutdown()
if __name__=='__main__':run()
