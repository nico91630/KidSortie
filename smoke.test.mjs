import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
test('page HTML and browser JavaScript parse',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match,'Missing inline application script');
 assert.doesNotThrow(()=>new vm.Script(match[1]));
 for(const feature of ['mapPanel','home-tiles','favoritesChip','loadMore','manifest.webmanifest','serviceWorker','event-core.mjs'])assert.ok(html.includes(feature),'Missing '+feature);
});
test('manifest and PWA resources present',()=>{
 const manifest=JSON.parse(fs.readFileSync('manifest.webmanifest','utf8'));
 assert.equal(manifest.display,'standalone');
 assert.equal(manifest.start_url,'/KidSortie/');
 assert.ok(manifest.icons.length);
 for(const path of ['sw.js','icons/kidsorties.svg','event-core.mjs'])assert.ok(fs.statSync(path).size>100);
});
