# Prompt startowy dla Codexa

Wklej poniższą instrukcję do Codexa po umieszczeniu plików dokumentacji w repozytorium.

---

Pracujesz nad aplikacją webową do wspólnego planowania posiłków, zakupów, kalorii, makroskładników i wydatków dla kilku osób należących do jednego household.

W repozytorium znajduje się dokumentacja projektowa w plikach Markdown. Przed wykonaniem jakiejkolwiek zmiany:

1. Znajdź i przeczytaj wszystkie pliki `.md` związane ze specyfikacją aplikacji.
2. Zacznij od `00-CODEX-INSTRUCTIONS.md`.
3. Następnie przeczytaj pozostałe dokumenty w kolejności wskazanej w `README.md`.
4. Przeanalizuj aktualny stan repozytorium.
5. Porównaj istniejący kod ze specyfikacją.
6. Nie rozpoczynaj od implementowania całej aplikacji naraz.

Stosuj następujące zasady:

- buduj modularny monolit,
- używaj Next.js, TypeScript, PostgreSQL i Drizzle,
- projektuj mobile first,
- każda wspólna dana ma należeć do household,
- każda operacja serwerowa musi sprawdzać członkostwo użytkownika,
- waliduj dane przez Zod,
- nie implementuj OCR, Redisa, BullMQ ani mikroserwisów podczas MVP,
- nie przechowuj własnych haseł użytkowników,
- integrację logowania oprzyj na Authentik OIDC,
- nie mieszaj ogólnych składników z konkretnymi produktami,
- logikę biznesową trzymaj poza komponentami React,
- dodawaj testy dla obliczeń i autoryzacji.

Najpierw przygotuj analizę repozytorium i zaproponuj plan pierwszego etapu. Plan powinien zawierać:

- wykryty stos i strukturę projektu,
- elementy już istniejące,
- elementy brakujące,
- proponowaną kolejność prac,
- listę plików do utworzenia lub zmiany,
- ryzyka i decyzje architektoniczne.

Nie zmieniaj jeszcze kodu, dopóki nie przedstawisz planu.

Po zaakceptowaniu planu realizuj zadania etapami. Po każdym etapie podaj:

- wykonane zmiany,
- zmienione pliki,
- migracje,
- testy,
- instrukcję uruchomienia,
- znane ograniczenia.

---
