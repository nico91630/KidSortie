// Sélection conservatrice : ne pas confondre événement culturel général et sortie enfant.
const norm=x=>String(x??'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const signals=[
 /\benfants?\b/,/\bfamill(?:e|es|ial|iale|iaux)\b/,/\bjeune public\b/,/\btout-petits?\b/,
 /\bbebes?\b/,/\bparents?[- ]enfants?\b/,/\bpour les (?:petits|enfants|familles)\b/,
 /\b(?:des|de|a partir de|des?) [0-9]{1,2} ans\b/,/\b[0-9]{1,2}\s*[-a]\s*[0-9]{1,2} ans\b/,
 /\bmarionnettes?\b/,/\bcontes? pour enfants?\b/,/\bspectacle(?:s)? (?:pour enfants?|jeune public|familial)\b/,
 /\bateliers? (?:pour enfants?|parents?[- ]enfants?|famille)\b/,/\beveil (?:musical|artistique|corporel)\b/,
 /\bludotheque\b/,/\bparc de loisirs\b/,/\bferme pedagogique\b/,/\bchasse au tresor\b/,
 /\bsorties? en famille\b/,/\bcomedie musicale pour enfants?\b/,
 /\baires? de jeux\b/,/\bjeux? de piste\b/,/\bchasse au tresor\b/,/\brandoland\b/,/\bbaludik\b/,
 /\bparcours ludique\b/,/\bpromenade ludique\b/,/\bsentier pedagogique\b/,/\bfermes? pedagogiques?\b/,
 /\bjeux? pour enfants?\b/,/\bparcours? des petits\b/,/\binitiation pour enfants?\b/,
 /\batelier parents?[- ]enfants?\b/,/\bactivites? familiales?\b/,/\bvisite ludique\b/
];
const adult=[
 /\breserve aux adultes\b/,/\binterdit aux mineurs\b/,/\bpublic adulte\b/,
 /\b18 ans et plus\b/,/\ba partir de 18 ans\b/,/\bpour adultes uniquement\b/
];
export function familyRelevant(e){
 const t=norm([e.title,e.description,e.keywords,e.audience,e.tags].filter(Boolean).join(' '));
 if(!t||adult.some(r=>r.test(t)))return false;
 const min=Number(e.minAge);
 if(e.minAge!=null&&Number.isFinite(min)&&min>12)return false;
 // "Tout public" et "spectacle" seuls ne garantissent pas une activité familiale.
 return signals.some(r=>r.test(t));
}
