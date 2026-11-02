import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Résumés produits côté serveur (GitHub Actions) pour ne pas ralentir les visiteurs.
// Clé secrète facultative. Sans elle, l'interface affiche la description de la source.
const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.log('GEMINI_API_KEY absente : résumés IA désactivés, descriptions des sources conservées.');
  process.exit(0);
}
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const maxNew = 12; // Limite le quota par exécution.
let generated = 0;
const files = ['data/events.json','data/paris.json'];
const cacheFile = 'data/summary-cache.json';
let cache = {};
try { cache = JSON.parse(await fs.readFile(cacheFile,'utf8')); } catch {}
const normalize = x => String(x || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const signature = e => createHash('sha256').update([e.title,normalize(e.description)].join('|')).digest('hex');
let errorCount = 0;
for (const path of files) {
  let doc;
  try { doc = JSON.parse(await fs.readFile(path,'utf8')); } catch { continue; }
  let changed = false;
  for (const e of doc.events || []) {
    const description = normalize(e.description);
    const hash = signature(e);
    if (cache[hash]?.text) {
      if (e.aiSummary !== cache[hash].text) { e.aiSummary = cache[hash].text;changed=true; }
      continue;
    }
    if (generated >= maxNew || description.length < 95) continue;
    const prompt = [
      'Tu rédiges pour KidSorties, un agenda français des sorties avec enfants.',
      'Rédige un vrai résumé utile et naturel en français en 2 ou 3 phrases, 45 à 75 mots maximum.',
      'Explique ce que les enfants feront ou verront et ce qui rend cette sortie intéressante.',
      'Ne répète pas seulement le titre. Ne fais pas de publicité.',
      'Ne déduis PAS les âges, horaires, tarifs ou prestations non précisés.',
      'N’ajoute aucune information factuelle absente de la description.',
      'Rends uniquement le résumé, sans titres ni formatage.',
      'Titre : ' + normalize(e.title),
      'Ville : ' + normalize(e.city),
      'Description fournie par l’organisateur : ' + description.slice(0,1800)
    ].join('\n');
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
        body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{temperature:0.35,maxOutputTokens:220}}),
        signal:AbortSignal.timeout(20000)
      });
      if (!response.ok) throw Error('HTTP '+response.status);
      const json = await response.json();
      const result = normalize((json.candidates?.[0]?.content?.parts || []).map(p=>p.text||'').join(' '));
      if (result.length < 55 || result.length > 620) throw Error('Réponse trop courte ou longue');
      e.aiSummary = result;
      cache[hash] = {text:result};
      changed = true;
      generated++;
    } catch (err) {
      errorCount++;
      console.warn('Résumé IA indisponible pour un événement : '+err.message);
      if (errorCount >= 3) break;
    }
  }
  if (changed) await fs.writeFile(path,JSON.stringify(doc,null,2)+'\n');
}
await fs.writeFile(cacheFile,JSON.stringify(cache,null,2)+'\n');
console.log('Résumés IA créés : '+generated+' ; erreurs : '+errorCount);
