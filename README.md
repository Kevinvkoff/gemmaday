# gemmaday

Assistant pour se déplacer à Lubumbashi quand on ne connaît pas la ville. Le premier besoin traité : trouver l’arrêt de taxi qui permet d’aller quelque part.

Projet du hackathon Hacktoberfest. L’IA du produit est [Gemma](https://ai.google.dev/gemma) (`gemma-4-31b-it`), appelée via l’API Gemini.

**English.** gemmaday helps someone who has just arrived in Lubumbashi and does not know the city. They ask Gemma where to find the taxi stop that gets them to the place they need to reach.

## Le problème

Une personne arrive à Lubumbashi. Elle doit se rendre à différents endroits, et elle ne sait pas comment le transport local est organisé. Avant même de choisir un itinéraire, sa première question est concrète : où se trouve l’arrêt de taxi qui la mène là où elle veut aller ?

Demander au hasard dans la rue prend du temps, et les noms de lieux ne suffisent pas quand on ne sait pas quel arrêt les dessert.

## Ce que le projet fait

gemmaday est une application web. La personne écrit où elle se trouve et où elle veut aller, avec ses mots. Gemma lui indique l’arrêt de taxi à rejoindre.

Parcours visé :

1. Elle décrit son point de départ et sa destination.
2. Gemma identifie l’arrêt de taxi adapté.
3. Elle reçoit une indication claire : quel arrêt, et comment s’y rendre.

Cette première version pose la base technique. La connaissance des arrêts de Lubumbashi et le dialogue guidé autour de ces arrêts restent à construire. Aujourd’hui, l’application permet déjà de discuter avec Gemma. Elle ne connaît pas encore les arrêts de la ville.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript)
- React 19
- Tailwind CSS 4
- [`@google/genai`](https://googleapis.github.io/js-genai/) pour appeler Gemma
- Modèle configuré : `gemma-4-31b-it`

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
src/app/page.tsx            Page de discussion
src/app/chat.tsx            Interface du chat
src/app/message-content.tsx Affichage des réponses (titres, listes, gras)
src/app/api/chat/route.ts   Route serveur qui reçoit la conversation
src/lib/gemini.ts           Client Gemma et lecture des variables d’environnement
```

Pour appeler Gemma depuis du code serveur :

```ts
import { generateChatReply } from "@/lib/gemini";

const text = await generateChatReply([
  { role: "user", text: "Je viens d’arriver à Lubumbashi. Où est l’arrêt de taxi pour aller au marché ?" },
]);
```

## Suite

La prochaine étape est le métier du projet : apprendre à Gemma les arrêts de taxi de Lubumbashi, puis répondre à une personne qui vient d’arriver et qui doit se rendre quelque part.
