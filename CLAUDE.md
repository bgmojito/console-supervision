# Console de supervision

Deux apps HTML monofichier réunies en une seule application :
- `sources/aim-trainer.html` : entraîneur de visée CS2 camouflé en console de supervision serveurs
  (modes Inspection / ronde de nuit en three.js, Précision, Suivi, Dérive, Classique) ;
- `sources/bhop-surf.html` : bhop + surf façon CS:Source (three.js r128).

La console est la coquille affichée au lancement, à l'identique de l'original. Le bhop et le surf deviennent des
modules lancés depuis la console (entrées ANALYSE › Routage et ANALYSE › Débit).

## Règles

- **Ne change aucun comportement existant** : physique du mouvement, constantes, parcours, visée, recul, replay
  restent strictement identiques. C'est une réorganisation + intégration, pas une réécriture : le code est déplacé
  ligne pour ligne, les seules adaptations sont celles qu'impose le découpage (imports/exports, état partagé passé
  par des objets, gardes « module au premier plan », textes et ids du menu 3D).
- **Camouflage** : look console d'admin, vocabulaire « incidents » / « analyse ». Jamais « jeu », « bhop », « surf »
  dans ce qui s'affiche (les noms internes du code peuvent rester). Aucun son nulle part.
- **Les fichiers de `sources/` ne sont jamais modifiés** : ils servent de référence (sha256 ci-dessous).
- **Tester avant chaque commit** : `npm test` (lint + build + tests Playwright). Vérifier qu'il n'y a aucune erreur
  console, que chaque module se lance et que la touche panique marche.
- **Un commit par étape**, avec un message clair.

```
b02a2f2c28c6e65c0d51778a7eac226ff41cb248fe96bbe4f3ad4a364c37be63  sources/aim-trainer.html
674c988b9baa23535d679fc6732c012c5f2b4dd87ab1fbc9905abd16fe555a45  sources/bhop-surf.html
```

## Comportements d'intégration

- **Échap dans la console** : comportement d'origine conservé (bascule « Vue rapport » ↔ « Temps réel »,
  anti-rebond 400 ms, perte de capture souris en exercice = vue rapport).
- **Touche panique dans un module 3D, Échap deux fois** : le 1er appui libère la souris et met en pause, le 2e
  ramène à la console sur la vue rapport, dans la même image (souris relâchée, boucle 3D arrêtée, touches remises
  à zéro). Fonctionne aussi sans capture souris (iframe) : 1er Échap = pause, 2e = console.
- Un module 3D s'affiche en plein écran comme l'original. Son moteur n'est chargé qu'au premier lancement
  (`import()` dynamique) et sa boucle est arrêtée tant qu'il est masqué. Seul le module au premier plan reçoit
  clavier et souris.

## Structure

```
sources/            originaux, jamais modifiés
src/                application en modules ES (servie telle quelle en dev)
  index.html        balisage de la console (copie de l'original)
  main.js           point d'entrée
  styles/           console.css (copie de l'original), m3d.css (module 3D, préfixé #m3d)
  lib/util.js       utilitaires communs ($, pad, hhmmss, rand)
  console/shell.js  horloge, vue rapport, Échap, lanceur, panique, arbitrage des entrées
  aim/              aim trainer (à venir : recul, hitbox, état, rendu, replay, ronde, modes)
  m3d/              moteur 3D partagé bhop/surf (à venir : constantes, maps, état, mouvement,
                    collisions, rendu, textures, monde, viewmodel, HUD, cycle de vie)
  vendor/           three.module.js r128 officiel non modifié, polices IBM Plex (woff2)
tools/
  build.mjs         build sans dépendance -> dist/index.html autonome
  serve.mjs         serveur de dev
  test.mjs          tests Playwright (smoke dev + dist, équivalence avec sources/)
  fixtures/         three.min.js r128 (sert à charger les originaux hors ligne pendant les tests)
dist/index.html     fichier unique généré, commité (republiable comme artifact)
```

## Conventions des modules (vérifiées par `tools/build.mjs`)

- Imports en tête de fichier, en début de ligne : `import { a, b as c } from './x.js';`,
  `import * as NS from './x.js';`, `import './x.js';`. `import('./x.js')` autorisé pour le chargement différé.
- Exports par une seule liste `export { … };` en fin de fichier : les lignes d'origine restent identiques.
- Pas d'`export let` ni d'autre forme d'export : l'état partagé et modifiable passe par des objets (ex. `S.yaw`).
- Pas de cycle d'imports statiques. Chemins relatifs uniquement.
- three.js s'importe depuis `vendor/three.module.js` (r128).

## Commandes

- `npm run dev` → http://localhost:8000/ (les modules ES exigent http://)
- `npm run build` → `dist/index.html`
- `npm test` → lint + build + tests (Playwright utilise le Chromium installé ; captures dans `tools/out/`)

## Étapes

1. Structure + build, console seule. ✔
2. Intégration de l'aim trainer, vérifiée identique à l'original.
3. Intégration du bhop, puis du surf.
4. Lanceur de modules + touche panique.
5. Build final `dist/index.html` et README court.
