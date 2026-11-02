import fs from 'node:fs/promises';
import { familyRelevant } from './family-filter.mjs';

// Collecte additionnelle sur les fiches publiques d'Essonne Tourisme (Apidae).
// Sans API privée, sans reprises intégrales : titre, date, lieu, bref descriptif et lien source.
const root='https://www.essonnetourisme.com';
const center=[48.611,2.305];
const monthNames={'janvier':0,'fevrier':1,'mars':2,'avril':3,'mai':4,'juin':5,'juillet':6,'aout':7,'septembre':8,'octobre':9,'novembre':10,'decembre':11};
const norm=x=>String(x||'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const km=(lat,lon)=>{const p=Math.PI/180,a=Math.sin((lat-center[0])*p/2)**2+Math.cos(lat*p)*Math.cos(center[0]*p)*Math.sin((lon-center[1])*p/2)**2;return 12742*Math.asin(Math.sqrt(a))};
const decode=s=>String(s||'').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;|&#34;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&[eé]acute;/gi,'é').replace(/&agrave;/gi,'à').replace(/&rsquo;/gi,'’').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n));
const plain=s=>decode(String(s||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ')).trim();
const dateRegex=/(\d{1,2})\s+(janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)\s+(20\d{2})/gi;
const toDate=(d,m,y)=>{const n=monthNames[norm(m)];if(n==null)return null;const dt=new Date(Date.UTC(Number(y),n,Number(d),11));return dt.getUTCMonth()===n&&dt.getUTCDate()===Number(d)?dt:null};
const positive=/\b(p.tits curieux|jeune public|enfants?|famill|tout.petit|b[eé]b[eé]|marionnette|contes?|atelier|cin[eé].go[uû]ter|mon premier cin[eé]|souriscontines|[eé]veil musical|chasse au tr[eé]sor|jeu de piste|th[eé][aâ]tre d.ombre|[eé]nigme|parc animalier|spectacle)\b/i;
const exclude=/\b(inscription(?:s)? ouverte(?:s)?|bourse aux|vente de|recrutement|conf[eé]rence|cin[eé].seniors|saison culturelle|concert de musique de chambre|assembl[eé]e g[eé]n[eé]rale|salon des vins|rencontre d.auteur)\b/i;
async function html(url){const res=await fetch(url,{headers:{'user-agent':'KidSorties/1.0 (public family event indexing; link to source)'},signal:AbortSignal.timeout(18000)});if(!res.ok)throw Error('HTTP '+res.status);return res.text()}
function candidateLinks(markup){
 const found=new Map();
 const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
 for(const hit of markup.matchAll(re)){
  let url;try{url=new URL(decode(hit[1]),root)}catch{continue}
  if(url.hostname!=='www.essonnetourisme.com'||!/^\/p\/[^/]+\/?$/.test(url.pathname))continue;
  const label=plain(hit[2]);const vicinity=plain(markup.slice(Math.max(0,hit.index-500),Math.min(markup.length,hit.index+950)));
  const relevant=positive.test(label)||positive.test(vicinity);
  if(!relevant||exclude.test(label))continue;
  found.set(url.origin+url.pathname,{url:url.origin+url.pathname,score:(positive.test(label)?3:0)+(norm(vicinity).includes('ptits curieux')?3:0),label});
 }
 return [...found.values()].sort((a,b)=>b.score-a.score).slice(0,100);
}
function parseEvent(candidate,markup,now){
 const body=plain(markup);
 const title=plain((markup.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)||markup.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)||[])[1])||candidate.label;
 if(!title||title.length>160||exclude.test(title))return null;
 const coords=body.match(/Latitude\s*:\s*(-?\d{1,2}\.\d+)\s*\/\s*Longitude\s*:\s*(-?\d{1,2}\.\d+)/i);
 if(!coords)return null;
 const lat=Number(coords[1]),lon=Number(coords[2]);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||km(lat,lon)>40)return null;
 const city=plain((markup.match(/\b(91\d{3})\s+([^<\r\n]{3,45})/i)||[])[2])||'Essonne';
 const afterDesc=body.split(/Description/i).slice(1).join('Description').split(/Informations pratiques/i)[0].slice(0,700);
 const description=afterDesc||body.slice(0,350);
 if(!familyRelevant({title,description})||!positive.test(title+' '+description))return null;
 const section=body.split(/Ouvertures/i).slice(1).join('Ouvertures').slice(0,650);
 const dates=[...section.matchAll(dateRegex)].map(m=>toDate(m[1],m[2],m[3])).filter(Boolean);
 // Conserver seulement les dates explicitement identifiées, jamais de séance déduite.
 const start=dates.find(d=>d.getTime()>=now-86400000);
 if(!start||start.getTime()>now+120*86400000)return null;
 const price=/\bgratuit(?:e|ement)?\b/i.test(body.split(/Tarifs/i).slice(1).join('Tarifs').slice(0,220))?0:null;
 const category=/\b(th[eé][aâ]tre|spectacle|marionnette|concert|cirque|contes?)\b/i.test(title+' '+description)?'Spectacle':/\b(atelier|jeux|cin[eé]|[eé]veil)\b/i.test(title+' '+description)?'Loisir':'Découverte';
 const iso=start.toISOString();
 return {title,start:iso,end:iso,city,lat,lon,category,familyVerified:true,
 minAge:null,maxAge:null,price,description:description.slice(0,350),
 image:null,source:'Essonne Tourisme (Apidae)',url:candidate.url};
}
const now=Date.now();
try{
 const listing=await html(root+'/agenda/');
 const links=candidateLinks(listing);
 const events=[];let checked=0,failed=0;
 // Charge modérée : trois requêtes concurrentes, au maximum cent fiches.
 for(let i=0;i<links.length;i+=3){
  await Promise.all(links.slice(i,i+3).map(async c=>{try{const markup=await html(c.url);checked++;const item=parseEvent(c,markup,now);if(item)events.push(item)}catch(e){failed++;console.warn('Fiche Essonne : '+e.message)}}));
 }
 if(!checked)throw Error('aucune fiche accessible');
 const unique=[...new Map(events.map(e=>[norm(e.title)+'|'+e.start+'|'+norm(e.city),e])).values()].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
 await fs.mkdir('data',{recursive:true});
 await fs.writeFile('data/essonne.json',JSON.stringify({updatedAt:new Date().toISOString(),source:'Essonne Tourisme',events:unique},null,2)+'\n');
 console.log('Essonne Tourisme : '+links.length+' liens, '+checked+' fiches, '+failed+' erreurs, '+unique.length+' sorties familiales');
}catch(err){console.warn('Essonne Tourisme indisponible : '+err.message+' — anciens résultats conservés')}
