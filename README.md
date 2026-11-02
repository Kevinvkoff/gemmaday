# intercom

Assistant pour se déplacer à Lubumbashi quand on ne connaît pas la ville. Le premier besoin traité : trouver l’arrêt de taxi qui permet d’aller quelque part.

Projet du hackathon Hacktoberfest. L’IA du produit est [Gemma](https://ai.google.dev/gemma) (`gemma-4-31b-it`), appelée via l’API Gemini.

**English.** intercom helps someone who has just arrived in Lubumbashi and does not know the city. They ask Gemma where to find the taxi stop that gets them to the place they need to reach.

## Le problème

Une personne arrive à Lubumbashi. Elle doit se rendre à différents endroits, et elle ne sait pas comment le transport local est organisé. Avant même de choisir un itinéraire, sa première question est concrète : où se trouve l’arrêt de taxi qui la mène là où elle veut aller ?

Demander au hasard dans la rue prend du temps, et les noms de lieux ne suffisent pas quand on ne sait pas quel arrêt les dessert.

## Ce que le projet fait

intercom est une application web. La personne arrive sur le chat et dit où elle veut aller. Gemma choisit un arrêt de taxi parmi des repères de Lubumbashi, donne son adresse, puis la carte trace l’itinéraire depuis la position actuelle.

Parcours :

1. Elle écrit sa destination dans le chat.
2. Gemma indique l’arrêt où monter, avec son adresse.
3. La carte place sa position et l’arrêt, puis propose l’itinéraire routier (durée et distance).

Les arrêts sont des repères OpenStreetMap (la Poste, le marché Kenya, l’université, l’aéroport, l’hôpital Sendwe, et d’autres communes). Ce n’est pas encore un registre officiel de la ville. Si la personne ne dit pas être déjà dans un quartier, Gemma propose la Poste, d’où partent les taxis du centre.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript)
- React 19
- Tailwind CSS 4
- [`@google/genai`](https://googleapis.github.io/js-genai/) pour appeler Gemma
- Modèle configuré : `gemma-4-31b-it`
- Leaflet et OpenStreetMap pour la carte
- OSRM pour l’itinéraire entre la position actuelle et l’arrêt

La clé API reste sur le serveur. Le navigateur parle à `POST /api/chat`, qui appelle Gemma.

## Démarrer

Prérequis : Node.js 20 ou plus récent, et une clé API Gemini avec accès à Gemma.

```bash
npm install
cp .env.example .env
```

Renseigne `.env` :

| Variable | Rôle |
| --- | --- |
| `GEMINI_API_KEY` | Clé API Gemini. Elle n’est jamais envoyée au navigateur. |
| `AI_MODEL` | Modèle utilisé. La valeur prévue est `gemma-4-31b-it`. |

Puis lance l’application :

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

Autres commandes :

```bash
npm run lint
npm run build
npm run start
```

## Structure

```text
src/app/chat.tsx               Chat, point d’entrée
src/app/route-map.tsx          Carte, position et itinéraire
src/app/api/chat/route.ts      Conversation avec Gemma
src/app/api/itinerary/route.ts Itinéraire routier
src/data/taxi-stops.ts         Arrêts repères de Lubumbashi
src/lib/gemini.ts              Consigne et appel du modèle
```

## Suite

Enrichir les arrêts avec des points confirmés sur place, et couvrir les départs quand la personne est déjà dans une commune plutôt qu’au centre.
