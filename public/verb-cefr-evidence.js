/* UX53A batch01: editorially matched English VERB headwords, Oxford 3000 (A1-B2).
 * Source: https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf
 * Exact verb POS labels checked against Oxford PDF page 1/11.
 * This is HEADWORD/POS level, NOT CEFR verification of a Vietnamese gloss,
 * individual sense, V2/V3 inflection, or a user's proficiency.
 * Unmatched words intentionally remain level=null and status='unreviewed'.
 * Data is review evidence, NOT a production training eligibility decision.
 */
export const VERB_CEFR_SOURCE=Object.freeze({
 id:'oxford-3000-en-pos-cefr',
 url:"https://www.oxfordlearnersdictionaries.com/us/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000.pdf",
 edition:'Oxford 3000 English, A1-B2 wordlist',
 evidence:'page 1/11, verb part-of-speech and CEFR label',
 scope:'headword-pos'
});
const evidence=Object.freeze({
  "accept": "A2",
  "achieve": "A2",
  "adapt": "B2",
  "add": "A1",
  "admire": "B1",
  "advise": "B1",
  "affect": "A2",
  "afford": "B1",
  "agree": "A1",
  "allow": "A2",
  "announce": "B1",
  "answer": "A1",
  "apologize": "B1",
  "appear": "A2",
  "apply": "A2",
  "approve": "B2",
  "arise": "B2",
  "arrange": "A2",
  "arrive": "A1",
  "ask": "A1",
  "assist": "B1",
  "attach": "B1",
  "attend": "A2",
  "attract": "B1",
  "avoid": "A2",
  "bake": "B1",
  "be": "A1",
  "beat": "A2",
  "become": "A1",
  "begin": "A1",
  "behave": "A2",
  "believe": "A1",
  "belong": "A2",
  "bend": "B1",
  "bet": "B2",
  "bite": "B1",
  "blow": "A2",
  "book": "A2",
  "borrow": "A2",
  "break": "A1",
  "bring": "A1",
  "broadcast": "B2",
  "brush": "A2",
  "build": "A1",
  "burn": "A2",
  "buy": "A1",
  "call": "A1"
});
export function getVerbCefrEvidence(v1){
 const level=Object.hasOwn(evidence,v1)?evidence[v1]:null;
 if(!level)return {level:null,status:'unreviewed',source_id:null,source_url:null,scope:null};
 return {level,status:'source_matched',source_id:VERB_CEFR_SOURCE.id,
  source_url:VERB_CEFR_SOURCE.url,scope:VERB_CEFR_SOURCE.scope};
}
export function listVerbCefrMatches(){return Object.entries(evidence).map(([v1,level])=>({v1,level}));}
