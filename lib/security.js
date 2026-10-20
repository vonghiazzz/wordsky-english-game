import {scryptSync,timingSafeEqual,randomBytes,createHmac,createHash} from 'node:crypto';
export function hashPassword(s, salt=randomBytes(16).toString('hex')){
 if(typeof s!=='string'||s.length<8)throw Error('Mật khẩu phải có ít nhất 8 ký tự.');
 return `scrypt:${salt}:${scryptSync(s,Buffer.from(salt,'hex'),64).toString('hex')}`;
}
export function verifyPassword(s,hash){
 try{
  if(typeof s!=='string'||s.length>1024)return false;
  const [type,salt,stored]=String(hash).split(':');
  if(type!=='scrypt'||!/^[0-9a-f]{32}$/.test(salt)||!/^[0-9a-f]{128}$/.test(stored))return false;
  return timingSafeEqual(scryptSync(s,Buffer.from(salt,'hex'),64),Buffer.from(stored,'hex'));
 }catch{return false}
}
export function randomToken(bytes=32){return randomBytes(bytes).toString('hex')}
export const hashToken=t=>createHash('sha256').update(t).digest('hex');
const mac=(s,secret)=>createHmac('sha256',secret).update(s).digest('base64url');
export function issueSession(payload,secret,ttl=7*24*3600){
 if(!secret||secret.length<32)throw Error('SESSION_SECRET is missing or weak');
 const data=Buffer.from(JSON.stringify({...payload,exp:Math.floor(Date.now()/1000)+ttl})).toString('base64url');
 return data+'.'+mac(data,secret);
}
export function parseSession(token,secret){
 if(!secret||secret.length<32||typeof token!=='string'||token.length>2400)return null;
 const bits=token.split('.');if(bits.length!==2)return null;
 const expected=Buffer.from(mac(bits[0],secret));const got=Buffer.from(bits[1]);
 if(expected.length!==got.length||!timingSafeEqual(expected,got))return null;
 try { const obj=JSON.parse(Buffer.from(bits[0],'base64url').toString());if(typeof obj.exp!=='number'||obj.exp<=Date.now()/1000||!['admin','player','guest'].includes(obj.role))return null;return obj;}catch{return null}
}
export function parseCookie(header,name){let m=String(header||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return m?decodeURIComponent(m.slice(name.length+1)):null}
export function cookie(name,value,maxAge){let c=`${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;if(process.env.APP_ORIGIN?.startsWith('https://'))c+='; Secure';return c}
export function normalizeName(s,max=40){return String(s||'').normalize('NFC').trim().replace(/\s+/g,' ').slice(0,max)}
export function username(s){let v=String(s||'').trim().toLowerCase();if(!/^[a-z][a-z0-9_]{2,23}$/.test(v))throw Object.assign(new Error('Tên đăng nhập: 3–24 ký tự a-z, số hoặc _.'),{status:400});return v}
export function sameOrigin(req){ const expected=process.env.APP_ORIGIN;const origin=req.headers?.origin;if(!origin)return true; return !expected||origin===expected;}
