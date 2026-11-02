export const CENTER={lat:48.611,lon:2.305};
export function distanceKm(e){const lat=Number(e.lat),lon=Number(e.lon);if(e.lat==null||e.lon==null||!Number.isFinite(lat)||!Number.isFinite(lon))return Infinity;const p=Math.PI/180,a=Math.sin((lat-CENTER.lat)*p/2)**2+Math.cos(CENTER.lat*p)*Math.cos(lat*p)*Math.sin((lon-CENTER.lon)*p/2)**2;return 12742*Math.asin(Math.sqrt(a))}
export function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:'?u.href:null}catch{return null}}
export function normalize(s){return String(s??'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
export function familyEligible(e){
 if(e.familyVerified===true)return true;
 const value=normalize([e.title,e.description,e.audience,e.tags].filter(Boolean).join(' '));
 if(/reserve aux adultes|interdit aux mineurs|public adulte|pour adultes uniquement|a partir de 18 ans/.test(value))return false;
 if(e.minAge!=null&&Number(e.minAge)>12)return false;
 return /enfants?|famill(?:e|es|ial|iale)|jeune public|tout petit|bebes?|parents? enfants?|marionnettes?|conte pour enfants|\b(?:[2-9]|10|11|12) ans\b|ferme pedagogique|ludotheque|eveil musical|chasse au tresor/.test(value)
}
export function eventKey(e){return [normalize(e.title),normalize(e.city),Math.round(Number(e.lat)*100)||0,Math.round(Number(e.lon)*100)||0].join('|')}
export function groupEvents(items,now=Date.now()){
 const groups=new Map();
 for(const raw of items||[]){
  if(!raw?.title||!safeUrl(raw.url)||!Number.isFinite(Date.parse(raw.start))||Date.parse(raw.end||raw.start)<now-86400000||!familyEligible(raw)||!Number.isFinite(distanceKm(raw))||distanceKm(raw)>40)continue;
  const key=eventKey(raw);let g=groups.get(key);
  if(!g){g={...raw,key,dates:[],sessionCount:0};groups.set(key,g)}
  if(String(raw.description||'').length>String(g.description||'').length)g.description=raw.description;
  if(!g.image&&raw.image)g.image=raw.image;
  if(!g.aiSummary&&raw.aiSummary)g.aiSummary=raw.aiSummary;
  if(g.price==null&&raw.price!=null)g.price=raw.price;
  if(g.minAge==null&&raw.minAge!=null)g.minAge=raw.minAge;
  if(g.maxAge==null&&raw.maxAge!=null)g.maxAge=raw.maxAge;
  if(Date.parse(raw.start)<Date.parse(g.start)){g.start=raw.start;g.end=raw.end||raw.start;g.url=raw.url}
  const dateKey=String(raw.start);
  if(!g.dates.some(d=>d.start===dateKey))g.dates.push({start:raw.start,end:raw.end||raw.start,url:raw.url});
 }
 return [...groups.values()].map(e=>{e.dates.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));e.sessionCount=e.dates.length;return e}).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
}
export function periodAllowed(start,period,now=new Date()){
 const t=Date.parse(start);if(!Number.isFinite(t))return false;if(period==='all')return true;
 if(period==='today')return new Date(t).toDateString()===now.toDateString();
 if(period==='weekend'){const sat=new Date(now);sat.setDate(now.getDate()+(now.getDay()===0?-1:(6-now.getDay()+7)%7));sat.setHours(0,0,0,0);const mon=new Date(sat);mon.setDate(sat.getDate()+2);return t>=sat.getTime()&&t<mon.getTime()}
 const end=new Date(now);end.setDate(now.getDate()+Number(period));return t>=now.getTime()&&t<=end.getTime();
}
// Classement éditorial automatique : une sortie vécue prime sur une annonce ou un événement généraliste.
const unwanted=/\b(?:preinscription|inscription(?:s)? ouverte(?:s)?|recrutement|appel a candidature|portes ouvertes? (?:des ecoles|scolaires)|sejours? (?:hiver|printemps|ete|vacances) 20\d\d|conference|colloque|webinaire|reunion d information|assemblee generale|vente de livres|don du sang|afterwork|formation professionnelle|ph[eè]dre|trag[eé]die classique)\b/;
const kidActivity=/\b(?:fete foraine|fetes foraines|manege|maneges|carrousel|kermesse|fete de village|fete communale|fete des enfants|village des enfants|chateau gonflable|parc d attractions|animation pour enfants|spectacle(?:s)? (?:pour enfants?|jeune public)|jeune public|marionnette|cirque|magie|chasse au tresor|jeu de piste|atelier(?:s)? (?:creatif|ludique|enfant|famill)|ferme pedagogique|parc animalier|conte(?:s)? pour enfants?|animation(?:s)? (?:pour enfants?|familial)|ludotheque|escape game|parcours aventure|visite ludique|bebe(?:s)?|tout petits?)\b/;
export function relevanceScore(e){
 const title=normalize(e.title),v=normalize([e.title,e.description].join(' '));let score=0;
 if(unwanted.test(title))score-=30;
 if(/\b(?:inscription|preinscription|information|programme|planning|annonce|appel a|stage vacances|sejour vacances)\b/.test(title))score-=12;
 if(/\b(?:jeune public|pour enfants|en famille|tout petits|marionnettes|spectacle enfants|ludique|familles)\b/.test(title))score+=12;
 if(kidActivity.test(v))score+=8;
 if(/\b(?:festival|fete|atelier|cirque|parc|animaux|ferme|magie|spectacle|chasse au tresor|jeu de piste|conte|visite guidee|exposition interactive)\b/.test(title))score+=5;
 if(/\b(?:conference|debats?|rencontre litteraire|table ronde|theatre classique|lecture adulte|exposition professionnelle)\b/.test(title))score-=15;
 if(e.minAge!=null&&Number(e.minAge)<=10)score+=3;
 if(e.image&& !/img\.openagenda\.com\/main\/$/.test(e.image))score+=2;
 if(e.price===0)score+=2;
 score+=Math.max(0,6-distanceKm(e)/7);
 return score;
}
export function worthwhile(e){
 const title=normalize(e.title);
 return !unwanted.test(title)&&relevanceScore(e)>=2;
}
export function filterEvents(events,{q='',category='all',ages=[],price='all',radius=40,sort='date',period='all',favoritesOnly=false,favorites=new Set(),now=new Date()}={}){
 const needle=normalize(q);
 const list=(events||[]).filter(e=>{
  if(distanceKm(e)>Number(radius)||(!favoritesOnly&&!worthwhile(e)))return false;
  if(favoritesOnly&&!favorites.has(e.key))return false;
  if(category!=='all'&&e.category!==category)return false;
  if(needle&&!normalize([e.title,e.city,e.description].join(' ')).includes(needle))return false;
  if(price!=='all'&&(e.price==null||(price==='free'?Number(e.price)!==0:Number(e.price)>Number(price))))return false;
  if(ages.length&&!(e.minAge==null&&e.maxAge==null)&&!ages.some(age=>Number(age)>=Number(e.minAge??0)&&Number(age)<=Number(e.maxAge??99)))return false;
  return e.dates?.some(d=>periodAllowed(d.start,period,now))??periodAllowed(e.start,period,now)
 });
 list.sort((a,b)=>sort==='distance'?distanceKm(a)-distanceKm(b)||Date.parse(a.start)-Date.parse(b.start):sort==='relevance'?relevanceScore(b)-relevanceScore(a)||distanceKm(a)-distanceKm(b):relevanceScore(b)-relevanceScore(a)||Date.parse(a.start)-Date.parse(b.start)||distanceKm(a)-distanceKm(b));
 return list;
}
