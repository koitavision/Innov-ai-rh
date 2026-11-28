# INNOV RH Mali — assistante IA experte en RH et droit du travail malien

Application Mistral (Mistral App) qui embarque une **IA experte en gestion des ressources humaines au Mali** : droit du travail, contrats, licenciement, durée du travail, congés, paie (SMIG, ITS, cotisations INPS/AMO/ANPE), sécurité sociale, travailleurs étrangers, conventions collectives, santé-sécurité, institutions (inspection du travail, tribunal du travail, INPS, CANAM…).

L'IA répond **en français, avec citations des articles** (Code du travail, décrets, arrêtés, CGI) et un avertissement juridique. Elle ne remplace pas un conseil juridique : vérifiez toujours la version en vigueur au [Journal officiel](https://sgg-mali.ml).

## Architecture

- **RAG embarqué** : le corpus juridique officiel (voir `corpus/` et `apps/api/data/corpus/`) est découpé en extraits Markdown avec provenance (titre, URL source, articles concernés). Au premier appel, le backend incruste le corpus (`mistral-embed`) et met en cache les vecteurs en mémoire ; chaque question est incrustée, les extraits les plus pertinents sont injectés dans le prompt système (`apps/api/data/system-prompt.md`), et la réponse est générée par le modèle de chat avec citations.
- **Backend** (`apps/api`, FastAPI) :
  - `POST /api/v1/rh/chat` — `{messages: [{role, content}], top_k?}` → `{answer, citations[], model}`
  - `GET /api/v1/rh/sources` — liste des documents du corpus
  - `GET /api/v1/rh/status` — état du corpus/embeddings et modèles utilisés
- **Frontend** (`apps/web`, TanStack Start) : page de chat `/` (landing) → `/chat`.
- **Studio** : le même corpus est aussi chargé dans une bibliothèque de documents Mistral (voir ci-dessous) avec un prompt `rh-malienne-experte`, pour l'utiliser directement dans le chat Vibe/Studio.

## Corpus juridique (sources officielles)

Construit par `tools/corpus/build.py` (télécharge les PDF officiels, extrait le texte, découpe en extraits) à partir de `tools/corpus/sources.json` :

- Code du travail consolidé (Loi n° 92-020 du 23/09/1992, modifiée 2003-37, 2011-79, 2017-021, 2019-025) — sgg-mali.ml
- Code de prévoyance sociale (Loi n° 99-041 du 12/08/1999, consolidé 2006) — sgg-mali.ml
- Décret n° 96-178/P-RM du 13/06/1996 d'application du Code du travail (modifié par décret 2022-0125) — miroir droit-afrique/IHRDA
- Arrêté n° 2024-4363/MTFPDS-SG du 27/12/2024 (modifiant l'arrêté 96-1566 ; permis de travail des étrangers, licenciement économique) — JO 2024-30, sgg-mali.ml
- Décret n° 2015-0363/P-RM du 19/05/2015 fixant le SMIG (40 000 FCFA/mois) — JO 2015-25, sgg-mali.ml
- Loi n° 2017-021 et loi n° 2019-025 (modifications du Code du travail) — JO, sgg-mali.ml
- Guides pratiques rédigés à partir de ces textes + sites officiels DGI (dgi.gouv.ml, barème ITS art. 10 CGI loi 2016-010) et INPS (inps.ml, taux de cotisations)

Pour régénérer le corpus : `uv run --with pypdf python tools/corpus/build.py` (les PDF sont mis en cache dans `corpus/raw/`, gitigné).

## Développement local

```bash
mistral dev --no-open          # démarre l'API (:3000) et le web (:3001) derrière la gateway locale
# ou séparément :
bash tools/uv.sh run --all-packages pytest apps/api/tests   # tests backend
bunx nx run web:gen-routes && bun test apps/web             # tests frontend (depuis apps/web: bun test)
```

Les appels à l'API Mistral passent par la gateway locale (`mistral login` ou `MISTRAL_API_KEY`).

## Déploiement (Mistral Apps)

```bash
mistral login                                  # session navigateur, org INNOVTECH
mistral deploy --organization INNOVTECH --workspace "Default Workspace" --name innov-rh-mali
```

Le déploiement construit le **commit poussé** sur `origin` (branche de la PR). Variables d'environnement à régler dans les réglages Studio de l'app si besoin : `APP_NAME=INNOV RH Mali`, `RH_MODEL`, `RH_EMBEDDING_MODEL`, `RH_TOP_K`, `RH_MAX_CONTEXT_CHARS`, `RH_HISTORY_LIMIT` (valeurs par défaut dans `packages/py/env/src/env/rh.py`).

Après déploiement, publier dans le catalogue : `publish_app` (outil MCP Mistral) pour que l'app apparaisse dans Vibe.

## Utilisation dans Studio (sans l'app web)

- Bibliothèque de documents « RH Mali — droit du travail et prévoyance sociale » (corpus complet, recherche sémantique).
- Prompt « rh-malienne-experte » : instructions système identiques à `apps/api/data/system-prompt.md`.

## Avertissement

Information juridique générale fournie à titre indicatif, à jour des sources consultées (voir `apps/api/data/corpus/sources-officielles-et-veille-juridique.md`). **Ce n'est pas un conseil juridique.** Pour toute décision engageante, consultez un avocat et vérifiez les textes au Journal officiel du Mali.
