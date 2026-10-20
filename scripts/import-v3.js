// Import a WordSky V3 vocabulary export into V4's database without replacing existing entries.
import fs from 'node:fs';import {transaction,getPool} from '../lib/db.js';
const file=process.argv[2];if(!file)throw Error('Usage: node scripts/import-v3.js ./wordsky-vocabulary.json');
const raw=fs.readFileSync(file,'utf8');if(raw.length>1600000)throw Error('File too large');
const data=JSON.parse(raw);if(data.app!=='WordSky'||!data.topics||Array.isArray(data.topics)||typeof data.topics!=='object')throw Error('Invalid WordSky export');
const topics=Object.entries(data.topics);if(topics.length>100)throw Error('Too many topics');let inserted=0;
try{await transaction(async db=>{
 for(const [title,cards] of topics){
  if(typeof title!=='string'||title.length<2||title.length>80||!Array.isArray(cards)||cards.length>500)throw Error('Invalid topic or card count');
  const t=await db.query('INSERT INTO ws_topics(title) VALUES($1) ON CONFLICT(title) DO UPDATE SET enabled=true RETURNING id',[title]);
  for(const item of cards){
   if(!Array.isArray(item)||item.length!==5||item.some(v=>typeof v!=='string')||item[0].length>80||item[2].length>180)throw Error('Invalid word card');
   const {rowCount}=await db.query('INSERT INTO ws_words(topic_id,english,ipa,meaning,example,translation) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(topic_id,english) DO NOTHING',[t.rows[0].id,...item]);
   inserted+=rowCount||0;
  }
 }
 });console.log('Imported',inserted,'new words across',topics.length,'topics (existing words preserved).')
}finally{await getPool().end()}
