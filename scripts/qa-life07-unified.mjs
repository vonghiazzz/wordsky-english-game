// LIFE-07 unified evidence integrity QA. Offline and read-only.
// This validates recorded evidence scope, NOT Cambridge correctness or human approval.
import {readFileSync} from 'node:fs';
const load = p => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const groups = [
 ['vocab/editorial/LIFE-07-cambridge-anchors.json', 9],
 ['vocab/editorial/LIFE-07-cambridge-anchors-extra.json', 6],
 ['vocab/editorial/LIFE-07-cambridge-anchors-third.json', 5],
 ['vocab/editorial/LIFE-07-cambridge-anchors-fourth.json', 3],
 ['vocab/editorial/LIFE-07-cambridge-anchors-fifth.json', 3],
];
const fail = message => { throw new Error('LIFE-07 evidence QA: ' + message); };
const proposal = load('vocab/editorial/LIFE-07-cefr-pos-proposal.json');
const examples = load('vocab/editorial/LIFE-07-examples-draft.json');
if (proposal.batch_id !== 'LIFE-07' || proposal.status !== 'EDITORIAL_ENRICHMENT_NOT_IMPORTABLE' ||
    proposal.records?.length !== 100 || examples.records?.length !== 100) fail('wrong draft or record count');
const allowed = new Set(proposal.records.map(x => x.english));
if (allowed.size !== 100) fail('duplicate inventory expression');
const seen = new Set();
let labeledComponents = 0;
for (const [path, count] of groups) {
 const file = load(path);
 if (file.batch_id !== 'LIFE-07' || file.records?.length !== count) fail('changed anchor count: ' + path);
 for (const item of file.records) {
  if (!allowed.has(item.expression) || seen.has(item.expression)) fail('unknown or repeated expression: ' + item.expression);
  seen.add(item.expression);
  const cefrVerified = item.phrase_cefr_verified ?? item.whole_phrase_cefr_verified;
  const ipaVerified = item.phrase_ipa_verified ?? item.whole_phrase_ipa_verified;
  if (cefrVerified !== false || ipaVerified !== false) fail('whole-phrase certainty asserted: ' + item.expression);
  const source = item.source ?? item.source_url;
  if (typeof source !== 'string' || !source.startsWith('https://dictionary.cambridge.org/')) fail('invalid source: ' + item.expression);
  const ipa = item.uk_ipa ?? item.headword_uk_ipa;
  if (ipa !== null && (typeof ipa !== 'string' || !ipa.startsWith('/') || !ipa.endsWith('/'))) fail('invalid component IPA: ' + item.expression);
  const label = item.label ?? item.anchor_cefr ?? null;
  if (label !== null) {
   if (!['A1','A2','B1','B2','C1','C2'].includes(label)) fail('invalid component level: ' + item.expression);
   labeledComponents++;
  }
 }
}
if (seen.size !== 26) fail('expected 26 distinct source-anchored expressions');
const distribution = { A1: 0, A2: 0, B1: 0, B2: 0 };
for (let i = 0; i < proposal.records.length; i++) {
 const row = proposal.records[i], original = examples.records[i];
 if (row.english !== original.english || row.example !== original.example || row.translation !== original.translation) fail('draft drift at ' + i);
 if (row.cefr_source_label !== null || row.cefr_evidence_kind !== 'contextual_inference' || !Object.hasOwn(distribution, row.proposed_cefr)) fail('falsified proposal certainty at ' + i);
 distribution[row.proposed_cefr]++;
}
console.log(JSON.stringify({
 status: 'PASS_EVIDENCE_METADATA_ONLY', expressions: proposal.records.length,
 unique_source_anchors: seen.size, component_sense_cefr_labels: labeledComponents,
 whole_phrase_cefr_confirmed: 0, whole_phrase_ipa_confirmed: 0,
 proposed_levels: distribution, editor_approved: false, import_authorized: false,
 production_deploy_authorized: false
}, null, 2));
