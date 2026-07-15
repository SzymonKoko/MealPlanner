# MealPlanner

Aplikacja webowa do wspólnego planowania posiłków, zakupów i liczenia makroskładników dla gospodarstw domowych (household).

## Wymagania

- Node.js 22+
- Docker i Docker Compose (opcjonalnie)
- PostgreSQL 16

## Szybki start (lokalnie)

```bash
cp .env.example .env
# Ustaw AUTH_SECRET i DEV_AUTH_BYPASS=true dla lokalnego developmentu

npm install
docker compose up postgres -d
npm run db:push   # lub uruchom src/db/migrations/0001_initial.sql ręcznie
npm run dev
```

Aplikacja: http://localhost:3000

## Szybki start (Docker)

```bash
cp .env.example .env
docker compose up --build
```

## Logowanie

### Tryb deweloperski

Ustaw w `.env`:

```
DEV_AUTH_BYPASS=true
AUTH_SECRET=your-secret-at-least-32-characters-long
```

### Produkcja (Authentik OIDC)

```
AUTHENTIK_ISSUER=https://auth.example.com/application/o/meal-planner/
AUTHENTIK_CLIENT_ID=...
AUTHENTIK_CLIENT_SECRET=...
DEV_AUTH_BYPASS=false
```

## Struktura

Modularny monolit Next.js z modułami domenowymi w `src/modules/`:

- `households` — gospodarstwa, zaproszenia, role
- `ingredients` / `products` — składniki i produkty
- `recipes` — przepisy z auto-makro
- `meal-planner` — planer tygodniowy
- `nutrition` — dzienne makro i cele
- `shopping` — lista zakupów

## Testy

```bash
npm test
npm run lint
```

## Migracje

```bash
npm run db:generate
npm run db:migrate
```

Pierwsza migracja: `src/db/migrations/0001_initial.sql`

## Dokumentacja projektu

Pełna specyfikacja: [`docs/meal-planner-spec/`](docs/meal-planner-spec/)

## MVP — zrealizowane funkcje

1. Logowanie (Authentik OIDC + dev bypass)
2. Tworzenie i zarządzanie household
3. CRUD składników i produktów
4. Przepisy z auto-makro (serwer)
5. Planer tygodniowy z przypisaniem porcji
6. Dzienne kalorie i makro (ekran „Dzisiaj")
7. Generowanie listy zakupów z agregacją
8. Checkboxy na liście zakupów + polling sync
9. PWA manifest + service worker
10. Mobile-first UI z dolną nawigacją

## Znane ograniczenia MVP

- Brak spiżarni, OCR, Open Food Facts
- Zaproszenia bez automatycznego e-maila (link do skopiowania)
- Offline sync checkboxów: last-write-wins via localStorage
- Konwersje jednostek: podstawowy zestaw (g, kg, ml, l, szt.)
