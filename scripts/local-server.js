import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import handler from '../api/index.js';
const dirname=path.dirname(fileURLToPath(import.meta.url));const pub=path.resolve(dirname,'../public');const port=Number(process.env.PORT||3000);
const MIMES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{
 try{const url=new URL(req.url,'http://localhost:'+port);
  if(url.pathname==='/api'||url.pathname.startsWith('/api/')){
   let parts=[];for await(const x of req){parts.push(x);if(parts.reduce((a,b)=>a+b.length,0)>16000){res.writeHead(413);res.end('Request too large');return}}
   const raw=Buffer.concat(parts).toString();try{req.body=raw?JSON.parse(raw):{}}catch{req.body=raw}
   req.query={rest:url.pathname.replace(/^\/api\/?/,'')};await handler(req,res);return;
  }
  let rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
  const target=path.resolve(pub,rel);
  if(target!==pub&&!target.startsWith(pub+path.sep)){res.writeHead(403);res.end();return}
  const data=await fs.promises.readFile(target);
  res.setHeader('content-type',MIMES[path.extname(target)]||'application/octet-stream');res.end(data);
 }catch(e){res.statusCode=e.code==='ENOENT'?404:500;res.end('Not found')}}).listen(port,()=>console.log('WordSky V4 local server: http://localhost:'+port));
