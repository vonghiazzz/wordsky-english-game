/* UX46. Curated list: no conjugation guesses for unknown words or long phrases.
 * Source for irregular patterns: https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs
 * V1 is the base form, V2 past simple, V3 past participle.
 */
const irregular={"be":["was / were","been"],"begin":["began","begun"],"break":["broke","broken"],"bring":["brought","brought"],"buy":["bought","bought"],"come":["came","come"],"do":["did","done"],"drink":["drank","drunk"],"drive":["drove","driven"],"eat":["ate","eaten"],"fall":["fell","fallen"],"feel":["felt","felt"],"find":["found","found"],"fly":["flew","flown"],"forget":["forgot","forgotten"],"get":["got","got / gotten"],"give":["gave","given"],"go":["went","gone"],"grow":["grew","grown"],"have":["had","had"],"hear":["heard","heard"],"keep":["kept","kept"],"know":["knew","known"],"leave":["left","left"],"lose":["lost","lost"],"make":["made","made"],"meet":["met","met"],"pay":["paid","paid"],"put":["put","put"],"read":["read","read"],"ride":["rode","ridden"],"run":["ran","run"],"say":["said","said"],"see":["saw","seen"],"sell":["sold","sold"],"send":["sent","sent"],"sit":["sat","sat"],"sleep":["slept","slept"],"speak":["spoke","spoken"],"spend":["spent","spent"],"stand":["stood","stood"],"swim":["swam","swum"],"take":["took","taken"],"teach":["taught","taught"],"tell":["told","told"],"think":["thought","thought"],"understand":["understood","understood"],"wake":["woke","woken"],"wear":["wore","worn"],"win":["won","won"],"write":["wrote","written"],"become":["became","become"],"build":["built","built"],"catch":["caught","caught"],"choose":["chose","chosen"],"cost":["cost","cost"],"cut":["cut","cut"],"draw":["drew","drawn"],"hold":["held","held"],"let":["let","let"],"mean":["meant","meant"],"set":["set","set"],"show":["showed","shown / showed"],"arise":["arose","arisen"],"beat":["beat","beaten"],"bend":["bent","bent"],"bet":["bet","bet"],"bind":["bound","bound"],"bite":["bit","bitten"],"bleed":["bled","bled"],"blow":["blew","blown"],"burst":["burst","burst"],"cling":["clung","clung"],"creep":["crept","crept"],"deal":["dealt","dealt"],"dig":["dug","dug"],"dream":["dreamt / dreamed","dreamt / dreamed"],"feed":["fed","fed"],"fight":["fought","fought"],"flee":["fled","fled"],"forbid":["forbade","forbidden"],"grind":["ground","ground"],"hide":["hid","hidden"],"hit":["hit","hit"],"hurt":["hurt","hurt"],"kneel":["knelt","knelt"],"lay":["laid","laid"],"lead":["led","led"],"lend":["lent","lent"],"light":["lit","lit"],"quit":["quit","quit"],"ring":["rang","rung"],"rise":["rose","risen"],"seek":["sought","sought"],"shake":["shook","shaken"],"shoot":["shot","shot"],"shrink":["shrank","shrunk"],"shut":["shut","shut"],"sing":["sang","sung"],"sink":["sank","sunk"],"slide":["slid","slid"],"spin":["spun","spun"],"spring":["sprang","sprung"],"spread":["spread","spread"],"steal":["stole","stolen"],"stick":["stuck","stuck"],"sting":["stung","stung"],"swear":["swore","sworn"],"sweep":["swept","swept"],"swing":["swung","swung"],"tear":["tore","torn"],"throw":["threw","thrown"],"strike":["struck","struck"]};
const regular=new Set(["accept","add","agree","answer","arrive","ask","bake","call","change","check","clean","close","compare","cook","copy","dance","decide","deliver","describe","develop","enjoy","explain","finish","fix","help","hope","improve","include","invite","join","jump","learn","like","listen","live","look","love","manage","move","need","open","order","organize","paint","pass","plan","play","practice","prepare","pull","push","rain","receive","remember","repair","repeat","reply","return","save","share","smile","start","stay","stop","study","talk","travel","try","turn","use","visit","wait","walk","want","wash","watch","work","worry"]);
const normalize=s=>typeof s==='string'?s.normalize('NFKC').trim().toLowerCase():'';
function regularPast(word){
 if(word.endsWith('e'))return word+'d';
 if(/[^aeiou]y$/.test(word))return word.slice(0,-1)+'ied';
 if(['stop','plan','drop','shop','skip','chat','prefer','admit'].includes(word))return word+word.at(-1)+'ed';
 return word+'ed';
}
export function lookupVerbForms(input){
 const word=normalize(input);
 // Don't reinterpret a sentence, noun phrase, conjugated form, or ambiguous expression as a verb.
 if(!/^[a-z]+$/.test(word))return null;
 if(Object.hasOwn(irregular,word)){
  const [v2,v3]=irregular[word];
  return {v1:word,v2,v3,kind:'irregular'};
 }
 if(regular.has(word)){
  const form=regularPast(word);
  return {v1:word,v2:form,v3:form,kind:'regular'};
 }
 return null;
}
