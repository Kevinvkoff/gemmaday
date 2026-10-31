# Tâches — gemmaday

Quatre personnes. Le chat avec Gemma existe déjà. Le travail restant : une personne qui arrive à Lubumbashi écrit où elle veut aller. Gemma reçoit sa position actuelle et lui propose l’arrêt de taxi le plus proche (nom et adresse). La carte trace ensuite l’itinéraire depuis cette position jusqu’à l’arrêt.

Dépôt : [github.com/Likeur/gemmaday](https://github.com/Likeur/gemmaday)

La position sert à choisir l’arrêt, pas seulement à dessiner la carte. Sans coordonnées, Gemma ne désigne pas un « arrêt le plus proche ».

## Déjà en place

- Application Next.js avec un chat (`src/app/chat.tsx`)
- Route serveur `POST /api/chat` qui appelle Gemma (`gemma-4-31b-it`)
- La clé API reste dans `.env`, côté serveur
- Affichage markdown des réponses

Gemma ne connaît pas encore les arrêts de Lubumbashi. L’écran est encore un chat générique : il n’envoie pas la position, et il n’y a pas de carte.

## Contrat commun

Les quatre lots avancent en parallèle à condition de s’accorder tout de suite sur ces formes.

**Un arrêt**

```ts
type Arret = {
  id: string;
  nom: string;
  adresse: string;
  latitude: number;
  longitude: number;
  dessert: string[];
};
```

**Ce que le navigateur envoie**

```ts
type Demande = {
  messages: { role: "user" | "model"; text: string }[];
  position: { latitude: number; longitude: number } | null;
};
```

`position` est la géolocalisation du navigateur au moment de l’envoi. Elle voyage avec le message, avant que Gemma réponde.

**Ce que le serveur renvoie**

```ts
type Reponse = {
  texte: string;
  arret: (Arret & { distanceMetres: number }) | null;
};
```

`texte` est ce que la personne lit. `arret` est l’arrêt retenu et ce que la carte affiche. `distanceMetres` est la distance entre la position envoyée et cet arrêt. Si la position manque, ou si aucun arrêt ne correspond, `arret` vaut `null`.

**Règle de choix**

1. Le serveur calcule la distance entre `position` et chaque arrêt du JSON.
2. Si le message nomme une destination, on ne garde que les arrêts qui la desservent.
3. Gemma propose le plus proche de cette liste.
4. Le calcul de distance se fait dans le code. Gemma explique le choix. Il ne devine pas quel point GPS est le plus près.

## Personne 1 — Arrêts de Lubumbashi

Fichier visé : `src/data/arrets.json`.

- [ ] Lister les arrêts utiles pour quelqu’un qui vient d’arriver (centre, gare, aéroport, marchés, université, hôpitaux, quartiers fréquentés).
- [ ] Pour chaque arrêt : nom usuel, adresse, latitude, longitude, et les lieux qu’il dessert.
- [ ] Vérifier les coordonnées sur une carte. La distance, donc l’arrêt proposé, dépend de ces chiffres.
- [ ] Noter les lieux ambigus (« le marché », « la poste », « l’université ») et les arrêts qui les desservent.
- [ ] Écrire 8 à 10 phrases de test, chacune avec une position fictive : deux positions différentes pour la même destination doivent pouvoir donner deux arrêts différents.

Livrable : le JSON, plus la liste des phrases de test et des positions. Cinq arrêts réels, assez éloignés les uns des autres, suffisent pour démarrer.

## Personne 2 — Gemma

Fichiers visés : `src/lib/gemini.ts`, `src/app/api/chat/route.ts`, un petit calcul de distance à côté des données.

- [ ] Lire `position` dans `POST /api/chat`. Sans latitude ni longitude valides, répondre que la position est nécessaire, avec `arret: null`.
- [ ] Calculer la distance (mètres) entre la personne et chaque arrêt.
- [ ] Lire la destination dans le message. Filtrer les arrêts qui la desservent, puis garder le plus proche.
- [ ] Donner à Gemma un rôle fixe : proposer cet arrêt à quelqu’un qui ne connaît pas Lubumbashi, en citant le nom, l’adresse et la distance.
- [ ] Lui passer l’arrêt déjà choisi, pas la liste brute à trier lui-même.
- [ ] Si aucun arrêt ne dessert la destination, le dire et poser une question, avec `arret: null`.
- [ ] Refuser un arrêt inventé : l’`id` renvoyé doit être celui calculé depuis `arrets.json`.
- [ ] Garder la clé API et le modèle côté serveur. Rester dans la limite actuelle (40 messages, 8000 caractères).

Livrable : la même phrase, envoyée depuis deux positions éloignées, renvoie deux arrêts différents, chacun le plus proche de la position envoyée.

## Personne 3 — Carte et itinéraire

Fichier visé : un composant carte branché sur le chat, par exemple `src/app/carte.tsx`.

- [ ] Recevoir la position déjà lue pour Gemma, et l’arrêt choisi (`latitude`, `longitude`, `distanceMetres`).
- [ ] Afficher deux points : la personne, et l’arrêt le plus proche.
- [ ] Tracer l’itinéraire entre les deux, avec la distance et un temps indicatif.
- [ ] Mettre à jour la carte quand un nouvel envoi change l’arrêt (la personne s’est déplacée, ou la destination a changé).
- [ ] Prévoir l’absence d’arrêt (`arret: null`) : la carte ne dessine pas un faux point.
- [ ] Prévoir une position simulée pour les tests, afin de vérifier le « plus proche » sans se déplacer dans la ville.

Livrable : deux positions de test montrent deux arrêts différents, et le trajet part de la position qui a servi au choix.

## Personne 4 — Parcours à l’écran

Fichiers visés : `src/app/chat.tsx`, `src/app/page.tsx`, `src/app/layout.tsx`.

- [ ] Demander la géolocalisation avant l’envoi du message, et joindre `position` à `POST /api/chat`.
- [ ] Le premier écran est le chat. Le texte d’accueil dit qu’on écrit où l’on veut aller, et que l’arrêt proposé est le plus proche de l’endroit où l’on est.
- [ ] Le placeholder invite à une destination (« Je veux aller au marché central »).
- [ ] Sous la réponse, montrer le bloc arrêt : nom, adresse, distance, puis la carte de la personne 3.
- [ ] États visibles : demande de position, position refusée, Gemma écrit, erreur réseau, lieu inconnu.
- [ ] Si la personne refuse la géolocalisation, le dire clairement et ne pas envoyer un choix d’arrêt « le plus proche ».
- [ ] Passer la page en français (`lang="fr"`, titre et description dans `layout.tsx`).
- [ ] Vérifier le parcours sur téléphone : la géolocalisation, le champ, la réponse et la carte restent utilisables.
- [ ] Préparer le scénario de démo : autoriser la position, envoyer une destination, lire l’arrêt le plus proche, voir le trajet.

Livrable : au moment de l’envoi, la requête contient la position. La réponse affichée est celle de cet arrêt-là.

## Ordre de branchement

1. Personne 1 publie 5 arrêts réels, éloignés, dans `src/data/arrets.json`.
2. Personne 4 envoie `position` avec le message. Personne 2 calcule le plus proche. Personne 3 dessine ce couple position + arrêt.
3. Personne 4 assemble le texte, la distance et la carte sur le même écran.
4. Tout le monde rejoue les phrases de test depuis au moins deux positions et corrige les trous (lieu absent, coordonnée fausse, position refusée).

## Démo

- [ ] `.env` est rempli (`GEMINI_API_KEY`, `AI_MODEL=gemma-4-31b-it`) et n’est pas commité.
- [ ] `npm run dev`, la page demande la position, puis on envoie une phrase réelle sur Lubumbashi.
- [ ] La réponse cite l’arrêt du JSON le plus proche de cette position, avec son adresse et la distance.
- [ ] La carte part de la même position et va jusqu’à cet arrêt.
- [ ] Une autre position, pour la même destination, peut proposer un autre arrêt.
- [ ] Sans position, ou pour une destination inconnue, aucun arrêt n’est fabriqué.
