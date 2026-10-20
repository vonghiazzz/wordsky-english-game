import pg from 'pg';
const { Pool }=pg;
let pool;
export function getPool(){
 if(!process.env.DATABASE_URL) throw Object.assign(new Error('Chưa cấu hình DATABASE_URL.'),{status:503});
 if(!pool) pool=new Pool({connectionString:process.env.DATABASE_URL,max:5,idleTimeoutMillis:10000,connectionTimeoutMillis:8000,ssl:process.env.DATABASE_URL.includes('localhost')?undefined:{rejectUnauthorized:true}});
 return pool;
}
export const sql=async(text,params=[])=>getPool().query(text,params);
export async function transaction(fn){ const client=await getPool().connect(); try {await client.query('BEGIN');const val=await fn(client);await client.query('COMMIT');return val;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release()} }
