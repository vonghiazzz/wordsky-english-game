from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]/'public'
html=(root/'index.html').read_text()
css=(root/'style.css').read_text()
js=(root/'app.js').read_text()
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox','--disable-web-security'])
    for name,size in [('desktop',{'width':1440,'height':900}),('mobile',{'width':390,'height':844})]:
        page=browser.new_page(viewport=size,device_scale_factor=1)
        errors=[]
        page.on('pageerror',lambda exc:errors.append(str(exc)))
        page.set_content(html,wait_until='domcontentloaded')
        page.add_style_tag(content=css)
        page.add_script_tag(content=js)
        page.wait_for_timeout(300)
        page.screenshot(path=str(root.parent/f'{name}.png'),full_page=True)
        print(name, 'title:',page.title(),'cards:',page.locator('.gamecard').count(),'overflow:',page.evaluate('document.documentElement.scrollWidth>innerWidth'),'JS errors:',errors)
        page.locator('button[data-screen="rooms"]').first.click()
        print(name, 'room visible:',page.locator('#screen-rooms').is_visible())
        page.close()
    browser.close()
