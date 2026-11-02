# Contribuer à intercom

intercom aide une personne qui arrive à Lubumbashi à trouver l’arrêt de taxi pour aller où elle doit se rendre. Les contributions sont les bienvenues : un arrêt mieux placé, une phrase plus claire, ou un correctif.

En participant, vous acceptez le [code de conduite](CODE_OF_CONDUCT.md). Le projet est sous [licence MIT](LICENSE).

## Préparer l’environnement

Prérequis : Node.js 20 ou plus récent, et une clé API Gemini avec accès à Gemma.

```bash
git clone https://github.com/Likeur/intercom.git
cd intercom
npm install
cp .env.example .env
```

Renseignez `.env` en local. Ne le commitez pas.

| Variable | Rôle |
| --- | --- |
| `GEMINI_API_KEY` | Clé API Gemini. Elle reste sur le serveur. |
| `AI_MODEL` | Modèle prévu : `gemma-4-31b-it`. |
| `STOPS_EDITOR_TOKEN` | Jeton pour l’écran de mise à jour des arrêts. |

Puis :

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## Proposer un changement

1. Créez une branche à partir de `main`.
2. Faites le changement le plus petit qui règle le problème.
3. Vérifiez avec `npm run lint` et `npm run build`.
4. Ouvrez une pull request vers `main` et décrivez ce que la personne qui utilise l’application verra de différent.

Les pushes sur `main` mettent à jour le site. Une pull request permet d’en discuter avant.

## Arrêts de taxi

La liste vit dans `data/stops.json`. Chaque arrêt a cette forme :

```json
{
  "id": "kenya",
  "name": "Marché Kenya",
  "address": "Marché 1 de la Kenya, Avenue Basilique, Mampala",
  "lat": -11.6991,
  "lng": 27.48165,
  "serves": "marché Kenya, commune Kenya, terminus sud"
}
```

- `id` : lettres minuscules, chiffres et tirets, 48 caractères au plus, unique.
- `name` : 80 caractères au plus. `address` : 160. `serves` : 300.
- `lat` et `lng` : un point à Lubumbashi, pas une autre ville.
- 80 arrêts au plus.

Le type est dans `src/data/taxi-stops.ts`. La lecture et l’enregistrement sont dans `src/lib/stops.ts`.

Un arrêt ajouté doit venir d’un repère vérifiable. Indiquez dans la pull request comment le point a été contrôlé.

## Ce qu’il ne faut pas envoyer

- `.env`, clés API, jetons.
- Un arrêt dont les coordonnées n’ont pas été vérifiées.
- Un changement sans rapport avec le problème décrit.
