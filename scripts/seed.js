import fs from 'node:fs';import {sql,transaction,getPool} from '../lib/db.js';
const data=JSON.parse(fs.readFileSync(new URL('../db/seed-vocabulary.json',import.meta.url),'utf8'));
if(!process.env.DATABASE_URL)throw Error('Set DATABASE_URL; apply db/schema.sql before seeding.');
try{
 await transaction(async db=>{
  for(const [topic,items] of Object.entries(data)){
   const res=await db.query('INSERT INTO ws_topics(title) VALUES($1) ON CONFLICT(title) DO UPDATE SET enabled=true RETURNING id',[topic]);
   const id=res.rows[0].id;
   for(const [english,ipa,meaning,example,translation] of items){
    await db.query(`INSERT INTO ws_words(topic_id,english,meaning,ipa,example,translation) VALUES($1,$2,$3,$4,$5,$6)
     ON CONFLICT(topic_id,english) DO NOTHING`,[id,english,meaning,ipa,example,translation]);
   }
  }
 });
 console.log('Seeded',Object.keys(data).length,'topics,',Object.values(data).reduce((a,c)=>a+c.length,0),'words.');
}finally{await getPool().end()}
