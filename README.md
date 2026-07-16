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
npm run setup:local
npm run dev
```

Aplikacja: http://localhost:3000

## Wdrożenie produkcyjne (serwer)

```bash
git clone https://github.com/SzymonKoko/MealPlanner.git
cd MealPlanner

# pierwszy raz — skopiuj config produkcyjny
cp .env.production.example .env
nano .env   # ustaw AUTH_SECRET i AUTHENTIK_CLIENT_SECRET

# deploy z migracjami i healthcheckiem
sh scripts/deploy-production.sh
```

Aplikacja nasłuchuje na `http://192.168.1.213:3102`, a publiczny adres to `https://food.rozwinswojbiznes.pl`. Reverse proxy, DNS albo Cloudflare Tunnel powinny kierować `food.rozwinswojbiznes.pl` na `192.168.1.213:3102`.

W Authentiku skonfiguruj aplikację OIDC z redirect URI:

```text
https://food.rozwinswojbiznes.pl/api/auth/callback/authentik
```

Issuer musi odpowiadać wartości w `.env`, domyślnie:

```text
https://auth.rozwinswojbiznes.pl/application/o/food-planner-app/
```

Przy kolejnych deployach `.env` zostaje na serwerze (jest w `.gitignore`):

```bash
git pull
sh scripts/deploy-production.sh
```

Skrypt uruchamia Compose z `COMPOSE_DISABLE_ENV_FILE=1`, a aplikacja czyta `.env` jako `env_file` w trybie `raw`. To jest istotne, jeśli `AUTH_SECRET` albo `AUTHENTIK_CLIENT_SECRET` zawiera znak `$`. Przy ręcznym uruchamianiu użyj:

```bash
COMPOSE_DISABLE_ENV_FILE=1 docker compose up -d --build
```

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
AUTH_URL=https://food.rozwinswojbiznes.pl
NEXTAUTH_URL=https://food.rozwinswojbiznes.pl
AUTH_TRUST_HOST=true
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
npm run db:migrate
```

Migracje SQL znajdują się w `src/db/migrations/` i są wykonywane kolejno przez
kontener `migrate`. Rejestr zawiera checksumy; nie wolno zmieniać wykonanej
migracji — każda zmiana schematu wymaga nowego pliku SQL.

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

## Integracje z bazami żywności

- `Open Food Facts` służy do konkretnych produktów sklepowych z kodem kreskowym.
- `USDA FoodData Central` służy do ogólnych składników, np. ryż, jajko, banan, pierś z kurczaka.
- Dane z USDA są wyszukiwane wyłącznie po stronie backendu; frontend nie otrzymuje klucza API.
- Aby włączyć import składników z USDA, ustaw `USDA_API_KEY` w `.env`.

## Znane ograniczenia MVP

- Brak spiżarni i OCR
- Zaproszenia bez automatycznego e-maila (link do skopiowania)
- Offline sync checkboxów: last-write-wins via localStorage
- Konwersje jednostek domowych wymagają jawnego przelicznika dla konkretnego składnika
