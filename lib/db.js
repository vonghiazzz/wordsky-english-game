import pg from 'pg';

const { Pool } = pg;
let pool;

// Keep PostgreSQL TLS encrypted AND certificate-verified. Supabase's pooler
// can use a private CA that is not in Node.js's default trust store.
export function buildPgConfig(connectionString, caValue) {
  const url = new URL(connectionString);
  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const ca = caValue?.replace(/\\n/g, '\n').trim();

  if (!isLocal && (!ca || !ca.includes('-----BEGIN CERTIFICATE-----'))) {
    throw Object.assign(new Error('Chưa cấu hình SUPABASE_CA_CERT.'), { status: 503 });
  }

  // pg-connection-string overrides the explicit SSL object if these
  // parameters are present in DATABASE_URL (notably sslmode=require).
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'ssl']) {
    url.searchParams.delete(key);
  }

  return {
    connectionString: url.toString(),
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 8000,
    ssl: isLocal
      ? false
      : {
          ca,
          rejectUnauthorized: true,
          servername: url.hostname,
        },
  };
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw Object.assign(new Error('Chưa cấu hình DATABASE_URL.'), { status: 503 });
  }
  if (!pool) {
    pool = new Pool(buildPgConfig(
      process.env.DATABASE_URL,
      process.env.SUPABASE_CA_CERT,
    ));
  }
  return pool;
}

export const sql = async (text, params = []) => getPool().query(text, params);

export async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
