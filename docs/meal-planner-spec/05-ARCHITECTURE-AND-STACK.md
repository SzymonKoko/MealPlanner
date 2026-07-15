# Architektura i stos technologiczny

## Styl architektury

Modularny monolit.

Jedna aplikacja zawiera:

- frontend,
- backend,
- logikę domenową,
- integracje,
- dostęp do bazy.

Nie używaj mikroserwisów na początku.

## Proponowany stos

### Aplikacja

- Next.js
- React
- TypeScript
- App Router

### UI

- Tailwind CSS
- shadcn/ui
- dnd-kit
- React Hook Form
- Zod

### Baza danych

- PostgreSQL
- Drizzle ORM
- Drizzle Kit

### Uwierzytelnianie

- Authentik
- OpenID Connect
- lokalna tabela użytkowników połączona przez `authProviderId`

### Wdrożenie

- Docker
- Docker Compose
- Cloudflare Tunnel
- reverse proxy tylko jeżeli będzie potrzebny

### PWA

- manifest aplikacji,
- service worker,
- tryb instalowalny,
- podstawowa obsługa offline.

## Proponowana struktura katalogów

```text
src/
├── app/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── api/
│   └── layout.tsx
├── modules/
│   ├── auth/
│   ├── users/
│   ├── households/
│   ├── ingredients/
│   ├── products/
│   ├── recipes/
│   ├── meal-planner/
│   ├── nutrition/
│   ├── shopping/
│   ├── pantry/
│   ├── receipts/
│   └── expenses/
├── components/
│   ├── ui/
│   └── shared/
├── db/
│   ├── schema/
│   ├── migrations/
│   └── client.ts
├── integrations/
│   ├── authentik/
│   └── open-food-facts/
├── lib/
├── server/
└── types/
```

## Zasady modułów

Każdy moduł może zawierać:

```text
components/
queries/
actions/
services/
validators/
repository/
types/
```

Nie każdy moduł musi mieć wszystkie katalogi.

## Logika biznesowa

Logika biznesowa nie powinna znajdować się bezpośrednio w komponentach React.

Przykłady logiki domenowej:

- obliczanie makro przepisu,
- skalowanie ilości,
- agregacja listy zakupów,
- sprawdzanie członkostwa,
- rozdzielanie porcji,
- konwersje jednostek.

Powinna być możliwa do testowania bez uruchamiania UI.

## API i akcje serwerowe

Można używać:

- Server Actions dla operacji z formularzy,
- Route Handlers dla integracji i klientów zewnętrznych.

W obu przypadkach obowiązuje:

- autoryzacja,
- walidacja,
- sprawdzanie household,
- obsługa błędów.

## Walidacja

Zod powinien walidować:

- formularze,
- parametry URL,
- payloady API,
- dane z integracji zewnętrznych.

## Open Food Facts

Integrację umieść w osobnym adapterze.

Nie wiąż całej domeny z formatem odpowiedzi Open Food Facts.

Przepływ:

```text
Open Food Facts response
→ adapter
→ internal product DTO
→ validation
→ local database
```

Dane zewnętrzne muszą być możliwe do ręcznej korekty.

## OCR

Nie implementować w MVP.

Docelowo OCR może działać:

- w workerze,
- w osobnym procesie,
- przez kolejkę zadań.

Na początku nie dodawać Redisa i BullMQ.

## Pliki

Zdjęcia przepisów i paragonów:

- początkowo lokalny wolumen,
- ścieżki w bazie,
- później opcjonalnie object storage.

Nie zapisuj binarnych obrazów bezpośrednio w PostgreSQL.

## Testy

Minimalny zakres:

- testy jednostkowe logiki domenowej,
- testy integracyjne zapytań do bazy,
- testy krytycznych przepływów użytkownika.

Najważniejsze przypadki:

- agregacja składników,
- przeliczanie porcji,
- makro użytkownika,
- separacja householdów,
- zachowanie pozycji ręcznych listy zakupów.
