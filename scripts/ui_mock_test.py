from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'public';html=(root/'index.html').read_text();css=(root/'style.css').read_text();js=(root/'app.js').read_text()
stub=r'''window.fetch=async function(url,opts={}) {
 const path=String(url).split('/api/').at(-1);
 let data={};let ok=true;
 if(path==='auth/me')data={actor:{role:'admin',id:'owner'}};
 else if(path==='topics')data={topics:[{id:'11111111-1111-1111-1111-111111111111',title:'Food',words:[{id:'22222222-2222-2222-2222-222222222222',english:'apple',meaning:'Táo'}]}]};
 else if(path==='admin/events')data={events:[]};
 else if(path==='admin/features')data={features:['MATCH','BOMB','CAR','ATTENDANCE','SIGNUP'].map(feature_key=>({feature_key,enabled:true}))};
 else if(path==='rankings')data={players:[{id:'123',display_name:'Bạn A',xp:100,streak:4},{id:'1234',display_name:'Bạn B',xp:55,streak:2}]};
 else if(path.startsWith('admin/events')&&opts.method==='POST')data={id:'123',join_code:'ABCD123',status:'DRAFT'};
 else if(path.startsWith('admin/topics')&&opts.method==='POST')data={id:'123',title:'New'};
 else if(path.startsWith('admin/features/'))data={feature_key:path.split('/').at(-1),enabled:true};
 else if(path==='attendance/me')data={display_name:'Bạn A',xp:100,streak:4};
 return {ok,status:ok?200:400,json:async()=>data};
};'''
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox','--disable-web-security'])
 page=b.new_page(viewport={'width':1280,'height':900})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded');page.add_style_tag(content=css);page.add_script_tag(content=stub);page.add_script_tag(content=js)
 page.get_by_role('button',name='Admin').click();page.wait_for_timeout(250)
 assert page.locator('#createEventForm').is_visible()
 assert page.locator('[data-round]').count()==3
 page.locator('button[data-add-round="MATCH"]').click();assert page.locator('[data-round]').count()==4
 page.locator('button[data-remove-round="0"]').click();assert page.locator('[data-round]').count()==3
 page.locator('button[data-admin-tab="vocab"]').click();assert page.locator('#wordForm').is_visible()
 page.locator('button[data-admin-tab="features"]').click();assert page.locator('input[data-feature]').count()==5
 page.get_by_role('button',name='Xếp hạng').first.click();page.wait_for_timeout(100)
 assert page.get_by_text('Bạn A').count()>0
 print('Admin/editor/dashboard interaction test: OK, errors:',errors)
 b.close()
