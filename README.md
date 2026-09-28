# KARP

KARP is a Firebase-hosted Olympiad Mathematics platform.

## Firebase architecture

- Firebase Hosting serves the static site.
- Firebase Authentication handles accounts.
- Cloud Firestore stores KARP content and the complete synced MathNet problem archive.
- Firebase Storage stores uploaded assets.
- `mathnet-sync.html` is an admin-only one-time/refresh importer from `ShadenA/MathNet` on Hugging Face.
- After synchronization, Problems and Mocks use Firestore only; Hugging Face is not queried during normal site usage.

## Deploy

From the repository root:

```bash
npm install -g firebase-tools
firebase login
firebase use able-2ca24
firebase deploy --only hosting,firestore:rules,storage
```

## MathNet import

After deploying, sign in with the KARP admin account and open `/mathnet-sync.html`.
Press **Start / Resume Sync**.

The importer keeps only English statements, proof/proof-only/proof-and-answer problem types, problems with at least one supplied solution, and problems whose supplied solutions are also fully English.

Lightweight metadata is stored in Firestore index shards; complete statement and solution content is stored in `mathnetProblems`. Mock generation selects directly from Firestore using per-problem random keys, so normal mock generation does not download or scan the full archive from Hugging Face.

## Firestore quota note

Firebase's current free Firestore quota includes 20,000 document writes/day and 50,000 document reads/day. A first import of roughly 28k accepted problems can therefore exceed the free daily write quota; check the project's billing/quota status before starting the full import.