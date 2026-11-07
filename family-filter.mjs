// KidSorties — éligibilité stricte des sorties familiales.
// "Enfant" cité dans un article ne suffit pas : une activité réellement adaptée doit être identifiable.
const norm=value=>String(value??'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const any=(s,patterns)=>patterns.some(p=>p.test(s));
const disallowed=[
 /\b(?:depistage|vaccination|prevention du cancer|don du sang|mammobile|mois sans tabac|octobre rose)\b/,
 /\b(?:conference|colloque|seminaire|webinaire|debat politique|table ronde|cafe philo|rencontre litteraire)\b/,
 /\b(?:recrutement|candidature|formation professionnelle|portes ouvertes scolaire|inscriptions? ouvertes?|preinscriptions?|programme de la saison)\b/,
 /\b(?:assemblee generale|messe|adoration eucharistique|celebration religieuse|office religieux)\b/,
 /\b(?:vente solidaire|collecte de jouets|brocante|vide grenier|bourse aux livres|salon d automne|salon d art|prix des lecteurs)\b/,
 /\b(?:cin[eé] rencontre|cine rencontre|projection debat|resistance a l etat|festival des musicales d automne)\b/,
 /\b(?:interdit aux mineurs|public adulte|reserve aux adultes|pour adultes uniquement|18 ans et plus)\b/
];
const specific=[
 /\b(?:jeune public|spectacle pour enfants?|theatre pour enfants?|conte pour enfants?|marionnettes?|spectacle familial|spectacle enfants?|cirque pour enfants?)\b/,
 /\b(?:atelier[s]? (?:creatif[s]?|enfants?|famill(?:e|ial)|parents? enfants?|parent enfant)|atelier d eveil|eveil musical|bebes lecteurs|heure du conte)\b/,
 /\b(?:tout petits?|petite enfance|pour les 0 3 ans|pour les 3 6 ans|pour les 6 12 ans|pour les enfants|pour les familles)\b/,
 /\b(?:fete[s]? foraine[s]?|maneges?|carrousel[s]?|kermesse[s]?|chateau[x]? gonflable[s]?|parc[s]? d attractions?)\b/,
 /\b(?:fete des enfants|fete de l enfance|village des enfants|animation[s]? pour enfants?|festival jeune public)\b/,
 /\b(?:ferme pedagogique|parc animalier|jeu[x]? de piste|chasse au tresor|parcours ludique|visite ludique|ludotheque|aire[s]? de jeux|escape game enfants?)\b/,
 /\b(?:spectacle de magie pour enfants|atelier parent bebe|conte musical jeunesse|theatre d ombres pour enfants)\b/
];
const explicitAudience=[
 /\b(?:jeune public|public familial|pour enfants?|pour les enfants|destine aux enfants|pour les familles|parents? enfants?|parents? et enfants|familles avec enfants|enfants de [0-9]|a partir de [2-9] ans|des [2-9] ans)\b/
];
const eventKind=[
 /\b(?:atelier[s]?|spectacle[s]?|visite[s]?|animation[s]?|festival|fete|parcours|jeu[x]?|exposition[s]?|concert[s]?|cinema|projection|balade|decouverte|activite[s]?)\b/
];
const genericAdult=[
 /\b(?:exposition|concert|conference|theatre|salon|rencontre|projection|festival)\b/
];
const childTitle=[
 /\b(?:kid[s]?|enfant[s]?|jeunesse|mini|tout petits?|bebes?|famill(?:e|ial)|ptits|p tits|petits|junior|ludique[s]?|adolescents|ado sphere)\b/
];
export function familyRelevant(e){
 const title=norm(e.title),description=norm(e.description),tags=norm([e.keywords,e.tags,e.audience].flat().filter(Boolean).join(' '));
 const full=[title,description,tags].filter(Boolean).join(' ');
 if(!title||any(title,disallowed)||any(full.slice(0,700),disallowed.slice(-1)))return false;
 if(e.minAge!=null && Number(e.minAge)>12)return false;
 // Une destination explicitement enfant (titre, catégorie ou phrase de présentation).
 if(any(title,specific))return true;
 // Pour une activité à durée ponctuelle, accepter une preuve enfant explicite + type d'activité.
 if(any(title,eventKind)&&any([title,tags].join(' '),explicitAudience))return true;
 // Le descriptif seul est admis uniquement si l'âge/public enfant y est clairement formulé.
 if(any(title,eventKind)&&any(description.slice(0,380),explicitAudience)&&!/(?:entree|tarif|billet|reduction|gratuit|reservation|inscription).{0,48}(?:enfants?|familles?)/.test(description.slice(0,380)))return true;
 // Les titres enfantins courts comme "Mini Croc'musique" sont recevables, les salons génériques non.
 if(any(title,childTitle)&&!any(title,genericAdult)&&/musique|spectacle|conte|atelier|jeu|animation|fete|parc|ferme|decouverte|activite|lecture/.test(full))return true;
 return false;
}
