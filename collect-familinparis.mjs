// Indexation prudente de données structurées Event publiées par Familin'Paris.
// On ne transforme jamais la date de publication d'un article en date de sortie.
// Seuls les événements dotés d'une date et de coordonnées confirmées sont conservés.
import fs from 'node:fs/promises';
import { familyRelevant } from './family-filter.mjs';

const ROOT='https://www.familinparis.fr';
const START=ROOT+'/sortie-enfant-paris/';
const CENTER=[48.611,2.305];
const TODAY=Date.now();
const km=(lat,lon)=>{const p=Math.PI/180,a=Math.sin((lat-CENTER[0])*p/2)**2+Math.cos(lat*p)*Math.cos(CENTER[0]*p)*Math.sin((lon-CENTER[1])*p/2)**2;return 12742*Math.asin(Math.sqrt(a))};
const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
async function fetchText(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(14000),headers:{'User-Agent':'KidSorties/1.0 (event metadata indexing; source links preserved)'}});
 if(!r.ok)throw Error('HTTP '+r.status);return r.text();
}
function jsonld(html){
 const nodes=[];
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const obj=JSON.parse(match[1]);const walk=x=>{if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object'){if(x['@graph'])walk(x['@graph']);if(x['@type'])nodes.push(x)}};walk(obj)}catch{}
 }
 return nodes;
}
function eventFrom(schema,sourceUrl){
 const types=[].concat(schema['@type']||[]);
 if(!types.some(t=>String(t).toLowerCase().endsWith('event')))return null;
 const title=plain(schema.name),description=plain(schema.description).slice(0,350);
 if(!title||!familyRelevant({title,description}))return null;
 const start=String(schema.startDate||'');
 if(!/^\d{4}-\d{2}-\d{2}/.test(start)||!Number.isFinite(Date.parse(start)))return null;
 const startTime=Date.parse(start);
 if(startTime<TODAY-86400000||startTime>TODAY+120*86400000)return null;
 const location=[].concat(schema.location||[])[0]||{};
 const geo=location.geo||location.location?.geo||{};
 const lat=Number(geo.latitude),lon=Number(geo.longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||km(lat,lon)>40)return null;
 const end=String(schema.endDate||start);
 const address=location.address||{};
 const city=plain(typeof address==='string'?address:address.addressLocality)||'Île-de-France';
 const image=(Array.isArray(schema.image)?schema.image[0]:schema.image)||null;
 const imageUrl=typeof image==='string'?image:image?.url;
 const priceRaw=schema.offers?.price??(Array.isArray(schema.offers)?schema.offers[0]?.price:null);
 const price=priceRaw!=null&&Number.isFinite(Number(priceRaw))?Number(priceRaw):null;
 const category=/spectacle|théâtre|cirque|marionnette|conte|concert/i.test(title)?'Spectacle':/atelier|jeu de piste|escape|loisir/i.test(title)?'Loisir':'Événement';
 return {title,start,end:Number.isFinite(Date.parse(end))?end:start,city,lat,lon,category,familyVerified:true,minAge:null,maxAge:null,price,description,image:/^https:\/\//.test(imageUrl||'')?imageUrl:null,source:"Familin'Paris",url:sourceUrl};
}
function linksFrom(html){
 const urls=new Set();
 for(const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)){
  try{const u=new URL(m[1],ROOT);if(u.hostname==='www.familinparis.fr'&&u.pathname!=='/sortie-enfant-paris/'&&!/\/(?:tag|category|wp-content|wp-admin|contact|mentions-legales)\//.test(u.pathname)&&u.pathname.split('/').filter(Boolean).length>=1)urls.add(u.origin+u.pathname)}catch{}
 }
 return [...urls].slice(0,75);
}
try{
 const markup=await fetchText(START);
 const urls=[START,...linksFrom(markup)];
 const results=[];let ok=0;
 for(let i=0;i<urls.length;i+=3){
  await Promise.all(urls.slice(i,i+3).map(async url=>{
   try{const html=url===START?markup:await fetchText(url);ok++;for(const obj of jsonld(html)){const event=eventFrom(obj,url);if(event)results.push(event)}}catch(err){console.warn('FamilinParis '+url+': '+err.message)}
  }));
 }
 if(!ok)throw Error('aucune page accessible');
 const unique=[...new Map(results.map(x=>[[x.title,x.start,x.city].join('|').toLowerCase(),x])).values()].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
 await fs.mkdir('data',{recursive:true});
 await fs.writeFile('data/familinparis.json',JSON.stringify({updatedAt:new Date().toISOString(),source:"Familin'Paris",events:unique},null,2)+'\n');
 console.log('FamilinParis : '+ok+' pages accessibles, '+unique.length+' événements datés et géolocalisés, aucune date inventée');
}catch(err){console.warn('FamilinParis non collecté : '+err.message+' ; données précédentes conservées')}
