import fs from 'node:fs/promises';

const ids = (process.env.OPENAGENDA_AGENDAS || '').split(',').map(s => s.trim()).filter(Boolean);
const key = process.env.OPENAGENDA_API_KEY || '';
const center = [48.611, 2.305]; // Brétigny-sur-Orge
const now = Date.now();
const maximumPages = 10;
const count = { received: 0, withoutCoordinates: 0, outsideRadius: 0, withoutTitle: 0, withoutTiming: 0, past: 0, notFamily: 0, retained: 0 };
const kilometers = (lat, lon) => {
  const p = Math.PI / 180;
  const a = Math.sin((lat - center[0]) * p / 2) ** 2 + Math.cos(lat * p) * Math.cos(center[0] * p) * Math.sin((lon - center[1]) * p / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};
const localized = val => typeof val === 'string' ? val : (val?.fr || val?.en || Object.values(val || {})[0] || '');
if (!key || !ids.length) {
  console.error('Configuration incomplète : OPENAGENDA_API_KEY et OPENAGENDA_AGENDAS sont nécessaires.');
  process.exit(1);
}
let oldEvents = [];
try { oldEvents = JSON.parse(await fs.readFile('data/events.json', 'utf8')).events || []; } catch {}
const collected = [];
let success = 0;
for (const id of ids) {
  console.log('--- Agenda ' + id + ' ---');
  const startReceived = count.received;
  try {
    for (let page = 0; page < maximumPages; page++) {
      const url = new URL('https://api.openagenda.com/v2/agendas/' + encodeURIComponent(id) + '/events');
      url.searchParams.set('key', key);
      url.searchParams.set('size', '100');
      url.searchParams.set('from', String(page * 100));
      url.searchParams.set('detailed', '1');
      url.searchParams.append('relative[]', 'ongoing');
      url.searchParams.append('relative[]', 'upcoming');
      const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!res.ok) throw Error('OpenAgenda HTTP ' + res.status);
      const body = await res.json();
      const events = body.events || [];
      console.log('Page ' + (page + 1) + ' : ' + events.length + ' événements reçus / total annoncé ' + (body.total ?? 'inconnu'));
      count.received += events.length;
      for (const event of events) {
        const place = event.location || {};
        const lat = Number(place.latitude ?? place.coordinates?.latitude ?? (Array.isArray(place.coordinates) ? place.coordinates[1] : NaN));
        const lon = Number(place.longitude ?? place.coordinates?.longitude ?? (Array.isArray(place.coordinates) ? place.coordinates[0] : NaN));
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) { count.withoutCoordinates++; continue; }
        if (kilometers(lat, lon) > 40) { count.outsideRadius++; continue; }
        const title = localized(event.title);
        if (!title) { count.withoutTitle++; continue; }
        const timings = event.timings || [];
        if (!timings.length) { count.withoutTiming++; continue; }
        const description = localized(event.description) + ' ' + localized(event.longDescription);
        const keywords = Array.isArray(event.keywords) ? event.keywords.join(' ') : localized(event.keywords);
        const test = (title + ' ' + description + ' ' + keywords).toLocaleLowerCase('fr');
        const child = /enfant|famill|jeune public|bébé|tout public|petits|atelier|marionnette|conte|cirque|ludique|spectacle|fête|animation|parc|jeu|magie|cinéma|festival|visite|musée|exposition|bibliothè|médiathè/.test(test);
        if (!child) { count.notFamily++; continue; }
        const category = /spectacle|théâtre|cirque|concert|marionnette|magie/.test(test) ? 'Spectacle' : /atelier|parc|jeu|loisir/.test(test) ? 'Loisir' : /musée|exposition|visite/.test(test) ? 'Découverte' : 'Événement';
        for (const time of timings) {
          const start = time.begin || time.start;
          const end = time.end || start;
          if (!start || !Number.isFinite(Date.parse(start))) { count.withoutTiming++; continue; }
          if (Date.parse(end) < now) { count.past++; continue; }
          collected.push({
            title, start, end, city: place.city || 'Essonne', lat, lon, category,
            minAge: event.age?.min ?? null, maxAge: event.age?.max ?? null,
            price: null,
            url: event.canonicalUrl || 'https://openagenda.com/fr/agendas/' + encodeURIComponent(id) + '/events/' + encodeURIComponent(event.uid)
          });
          count.retained++;
        }
      }
      if (events.length < 100) break;
    }
    success++;
  } catch (error) { console.error('Erreur agenda ' + id + ' : ' + error.message); }
  console.log('Agenda ' + id + ' : ' + (count.received - startReceived) + ' événements lus');
}
console.log('Bilan détaillé : ' + JSON.stringify(count));
if (!success) {
  console.error('Aucun agenda accessible : conservation du fichier existant.');
  process.exit(1);
}
const fresh = collected.filter(e => Date.parse(e.end || e.start) >= now);
const unique = [...new Map(fresh.map(e => [(e.title + '|' + e.start + '|' + e.city).toLocaleLowerCase('fr'), e])).values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
await fs.mkdir('data', { recursive: true });
await fs.writeFile('data/events.json', JSON.stringify({ updatedAt: new Date().toISOString(), events: unique }, null, 2) + '\n');
console.log(unique.length + ' sorties publiées. Anciennes entrées non présentes dans la collecte retirées.');
