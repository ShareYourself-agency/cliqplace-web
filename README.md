# Cliqplace – web

Astro (static) + Vercel. Jedna serverless funkce pro kontaktní formulář (`/api/contact`).

## Vývoj
```
npm install
npm run dev      # http://localhost:4321
npm run build
```

## Stránky
`/` · `/software` · `/hardware` · `/portal` · `/kontakt` · `/dalsi-dotazy` · `/obchodni-podminky` · `/gdpr` · `/cookies`

Texty FAQ a referencí jsou v `src/data/`.

## Kontaktní formulář
Odesílá e-mail přes [Resend](https://resend.com). Ve Vercelu nastavte proměnné:

| Proměnná | Popis |
|---|---|
| `RESEND_API_KEY` | API klíč z Resendu |
| `CONTACT_TO` | kam chodí poptávky (výchozí `info@cliqplace.cz`) |
| `CONTACT_FROM` | odesílatel z ověřené domény, např. `Web Cliqplace <web@cliqplace.cz>` |

Ochrana: validace na serveru, honeypot, časová past, limit 5 odeslání / 10 min / IP, kontrola původu.

## Bezpečnost
CSP s hashi generuje Astro (`security.csp`), další hlavičky (HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy…) jsou ve `vercel.json`.

## Animace
Vanilla JS v `src/scripts/main.ts` – vše respektuje `prefers-reduced-motion`.
