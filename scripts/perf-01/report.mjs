/**
 * Interpret a locally generated k6 --summary-export JSON.
 * This does not establish production capacity or authorize a release.
 */
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';

function metricValue(metrics,name,key){
  const value=metrics?.[name]?.values?.[key];
  assert.ok(typeof value==='number'&&Number.isFinite(value),
    'Missing k6 metric: '+name+'.'+key);
  return value;
}
export function analyzePerfSummary(summary){
  assert.ok(summary&&typeof summary==='object'&&summary.metrics&&typeof summary.metrics==='object',
    'Invalid k6 summary');
  const m=summary.metrics;
  const requests=metricValue(m,'http_reqs','count');
  const rps=metricValue(m,'http_reqs','rate');
  const errorRate=metricValue(m,'http_req_failed','rate');
  const p95=metricValue(m,'http_req_duration','p(95)');
  const p99=metricValue(m,'http_req_duration','p(99)');
  const checks=metricValue(m,'checks','rate');
  const limits={p95_ms:1000,p99_ms:2500,error_rate:0.01,check_rate:0.99};
  const passed=requests>0&&errorRate<limits.error_rate&&
    p95<limits.p95_ms&&p99<limits.p99_ms&&checks>limits.check_rate;
  return Object.freeze({
    result:passed?'PASS_LOCAL_BASELINE':'FAIL_LOCAL_BASELINE',
    tested_environment:'operator-supplied-local-test-only',
    requests,requests_per_second:rps,
    p95_ms:p95,p99_ms:p99,error_rate:errorRate,check_rate:checks,
    budgets:limits,proves_10000_concurrent_users:false,
    authorized_to_load_test_production:false,
    note:'Local read-only baseline only; compare trends after repeating tests on approved isolated staging.'
  });
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url){
  try{
    assert.equal(process.argv.length,3,'Usage: node scripts/perf-01/report.mjs perf-results.json');
    const content=readFileSync(process.argv[2],'utf8');
    assert.ok(content.length<4_000_000,'Oversized k6 summary');
    const report=analyzePerfSummary(JSON.parse(content));
    console.log(JSON.stringify(report,null,2));
    if(report.result!=='PASS_LOCAL_BASELINE')process.exitCode=1;
  }catch(error){
    console.error('PERF01_REPORT_BLOCKED: '+error.message);
    process.exitCode=1;
  }
}
