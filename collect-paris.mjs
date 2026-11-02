import { familyRelevant } from './family-filter.mjs';
import fs from 'node:fs/promises';

const base = 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/que-faire-a-paris-/records';
const center = [48.611,2.305];
const now = Date.now();
const km = (lat,lon) => {
  const p=Math.PI/180,a=Math.sin((lat-center[0])*p/2)**2+Math.cos(lat*p)*Math.cos(center[0]*p)*Math.sin((lon-center[1])*p/2)**2;
  return 12742*Math.asin(Math.sqrt(a));
};
const plain = s => String(s||'').replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/gi,' ').replace(/\s+/g,' ').trim();
const show = /(spectacle|comédie musicale|théâtre|cirque|marionnette|magie|concert|musical|conte|danse)/i;
let counters={read:0,close:0,family:0,scheduled:0}, events=[];
function occurrences(e) {
  const raw=String(e.occurrences||'').trim();
  const times=[];
  if(raw){
    for(const piece of raw.split(';')){
      const chunks=piece.trim().split('_');
      if(chunks[0]&&Number.isFinite(Date.parse(chunks[0])))times.push({start:chunks[0],end:chunks[1]&&Number.isFinite(Date.parse(chunks[1]))?chunks[1]:chunks[0]});
    }
  } else if(e.date_start&&Number.isFinite(Date.parse(e.date_start))&&Date.parse(e.date_start)>now) {
    times.push({start:e.date_start,end:e.date_end||e.date_start});
  }
  return times.filter(t=>Date.parse(t.end)>=now).slice(0,40);
}
try{
 for(let offset=0;offset<10000;offset+=100){
  const url=new URL(base);url.searchParams.set('limit','100');url.searchParams.set('offset',String(offset));url.searchParams.set('where',`date_end >= date'${new Date().toISOString().slice(0,10)}'`);
  const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
  if(!response.ok)throw Error('Paris Data HTTP '+response.status);
  const body=await response.json();
  const list=body.results||[];
  for(const e of list){
    counters.read++;
    const coords=e.lat_lon;
    const lat=Array.isArray(coords)?Number(coords[0]):Number(coords?.lat);
    const lon=Array.isArray(coords)?Number(coords[1]):Number(coords?.lon);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||km(lat,lon)>40)continue;
    counters.close++;
    const title=plain(e.title_event||e.title);
    if(!title||!e.url||!/^https:\/\//.test(e.url))continue;
    const corpus=[title,e.lead_text,e.audience,e.qfap_tags,e.universe_tags,e.description].map(plain).join(' ');
    if(!familyRelevant({title,description:[e.lead_text,e.description].map(plain).join(' '),audience:plain(e.audience),tags:[e.qfap_tags,e.universe_tags].map(plain).join(' ')}))continue;
    counters.family++;
    const cat=show.test(corpus)?'Spectacle':/atelier|jeux|loisirs/i.test(corpus)?'Loisir':/exposition|musée|visite/i.test(corpus)?'Découverte':'Événement';
    for(const t of occurrences(e)){
      counters.scheduled++;
      events.push({
       title,start:t.start,end:t.end,city:e.address_city||'Paris',lat,lon,
       category:cat,minAge:null,maxAge:null,familyVerified:true,
       price:e.price_type==='gratuit'?0:null,
       url:e.access_link?.startsWith('https://')?e.access_link:e.url,
       source:'Que faire à Paris — Ville de Paris',
       description:plain(e.lead_text).slice(0,320),
       image:e.cover_url||null
      });
    }
  }
  if(list.length<100||offset+list.length>=body.total_count)break;
 }
 if(counters.read===0)throw Error('API vide');
 const horizon=now+90*24*60*60*1000;
 const unique=[...new Map(events.filter(e=>Date.parse(e.start)<=horizon).map(e=>[(e.title+'|'+e.start+'|'+e.city).toLowerCase(),e])).values()].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).slice(0,800);
 await fs.mkdir('data',{recursive:true});
 await fs.writeFile('data/paris.json',JSON.stringify({updatedAt:new Date().toISOString(),source:'Ville de Paris, ODbL',events:unique},null,2)+'\n');
 console.log('Paris Data : '+JSON.stringify(counters)+' ; '+unique.length+' sorties publiées');
}catch(e){
 console.error('Paris Data : '+e.message+' — données précédentes conservées');
 process.exitCode=1;
}
