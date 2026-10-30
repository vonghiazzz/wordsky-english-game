// Fail closed on Vercel Preview until an explicitly isolated database is configured.
// This module must not log or return credentials in error messages.
const PRODUCTION_REF = 'ilyhbhoqswsioxxpuvcb';
const previewError = () => Object.assign(
  new Error('Preview database is not verified as isolated; database access is disabled.'),
  { status: 503 },
);

function parsePgUrl(value) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

function identity(url) {
  return [url.hostname.toLowerCase(), url.port || '5432',
    decodeURIComponent(url.username).toLowerCase(), url.pathname];
}

export function resolveDatabaseUrl(env = process.env) {
  if (env.VERCEL_ENV !== 'preview') return env.DATABASE_URL;

  const candidate = env.WORDSKY_PREVIEW_DATABASE_URL;
  const previewRef = String(env.WORDSKY_PREVIEW_DB_REF || '').trim().toLowerCase();
  const preview = parsePgUrl(candidate);
  const production = parsePgUrl(env.DATABASE_URL);
  if (!preview || !/^[a-z0-9]{20}$/.test(previewRef) || previewRef === PRODUCTION_REF) {
    throw previewError();
  }

  // Supabase direct connections identify a project in the hostname;
  // shared pooler connections identify it in the username (postgres.<ref>).
  const name = `${preview.hostname}.${decodeURIComponent(preview.username)}`.toLowerCase();
  if (!name.includes(previewRef) || name.includes(PRODUCTION_REF)) throw previewError();
  if (production && identity(preview).join('|') === identity(production).join('|')) {
    throw previewError();
  }
  return candidate;
}

/**
 * Diagnostics only: whether a permitted database target is configured.
 * This does not establish a database connection or run an SQL query.
 * A missing or rejected Preview target reports false without leaking
 * connection details; application queries still fail closed with 503.
 */
export function isDatabaseTargetConfigured(env = process.env) {
  try {
    return Boolean(resolveDatabaseUrl(env));
  } catch (error) {
    if (env.VERCEL_ENV === 'preview' && error?.status === 503) return false;
    throw error;
  }
}
