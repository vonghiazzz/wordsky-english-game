/* UX61.7: display-only grouping of ambiguous shared recall cues.
 * Pure helper: never changes editorial holds, review status, CEFR or SRS.
 */
import {isPendingEditorialRecall} from './ux61-pending-recall.js';

export const normalizeEditorialCue=value=>String(value??'').normalize('NFKC')
 .trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');

/** Groups only held shared cards from the already actor-verified queue.
 * Does not imply that cards sharing a Vietnamese cue are interchangeable.
 */
export function groupPendingEditorialCards(rows){
 if(!Array.isArray(rows))return [];
 const groups=new Map();
 for(const row of rows){
  if(!isPendingEditorialRecall(row))continue;
  const cue=normalizeEditorialCue(row.meaning);
  if(!cue)continue;
  if(!groups.has(cue))groups.set(cue,{cue,words:[]});
  groups.get(cue).words.push(row);
 }
 return [...groups.values()];
}
