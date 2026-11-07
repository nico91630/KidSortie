import { familyRelevant } from './family-filter.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {groupEvents,distanceKm,filterEvents,periodAllowed,safeUrl} from './event-core.mjs';
const make=(date,extra={})=>({title:'Spectacle pour enfants',description:'Un spectacle pour enfants et familles',city:'Brétigny-sur-Orge',lat:48.611,lon:2.305,start:date,end:date,url:'https://example.org/show',category:'Spectacle',familyVerified:true,...extra});
test('distance is centered and outside events excluded',()=>{assert.equal(distanceKm(make('2026-11-10')),0);assert.equal(groupEvents([make('2026-11-10',{lat:48.95,lon:2.31})],Date.parse('2026-11-01')).length,1);assert.equal(groupEvents([make('2026-11-10',{lat:49.6})],Date.parse('2026-11-01')).length,0)});
test('repeat show dates grouped, duplicate sessions removed',()=>{const g=groupEvents([make('2026-11-10'),make('2026-11-10'),make('2026-11-17')],Date.parse('2026-11-01'));assert.equal(g.length,1);assert.equal(g[0].sessionCount,2)});
test('adult event excluded without positive family signal',()=>{assert.equal(groupEvents([make('2026-11-10',{title:'Concert de jazz',description:'Concert du soir',familyVerified:false})],Date.parse('2026-11-01')).length,0)});
test('age, price, radius and favorites filters',()=>{const group=groupEvents([make('2026-11-10',{price:0,minAge:3,maxAge:8})],Date.parse('2026-11-01'));assert.equal(filterEvents(group,{ages:[3],price:'free',favorites:new Set([group[0].key]),favoritesOnly:true}).length,1);assert.equal(filterEvents(group,{ages:[10],price:'free'}).length,0)});
test('Sunday still counts as weekend',()=>{assert.equal(periodAllowed('2026-11-08T14:00:00+01:00','weekend',new Date('2026-11-08T10:00:00+01:00')),true)});
test('external links reject javascript schemes',()=>assert.equal(safeUrl('javascript:alert(1)'),null));

test('filtre les événements pour adultes même marqués familyVerified',()=>{
 for(const title of ['Mammobile : dépistage du cancer du sein','Salon d’automne de l’Amicale des Artistes Biévrois','Adoration eucharistique','Prix des lecteurs 2026','Collecte de jouets et vente solidaire']){
  assert.equal(familyRelevant({title,description:'Événement ouvert aux enfants et aux familles'}),false,title);
 }
});
test('conserve les activités véritablement enfantines',()=>{
 for(const title of ['Fête foraine','Manèges et carrousel','Mini Croc’musique','Spectacle de marionnettes','Atelier créatif pour enfants','Fête des Enfants']){
  assert.equal(familyRelevant({title,description:'Activité ludique à faire en famille'}),true,title);
 }
});
test('simple mention des enfants dans une exposition généraliste ne suffit pas',()=>{
 assert.equal(familyRelevant({title:'Exposition de peinture classique',description:'Entrée gratuite pour les enfants accompagnés de leurs parents'}),false);
});

// La vérification CI rejoue ces cas à chaque évolution du filtrage.
