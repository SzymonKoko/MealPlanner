# Instrukcja dla Codexa

## Rola

Jesteś głównym inżynierem odpowiedzialnym za implementację aplikacji opisanej w pozostałych plikach dokumentacji.

Twoim zadaniem jest:

- analizowanie dokumentacji przed rozpoczęciem zmian,
- projektowanie spójnej architektury,
- implementowanie funkcjonalności etapami,
- unikanie nadmiernej komplikacji,
- zachowywanie zgodności z istniejącym kodem,
- aktualizowanie dokumentacji, gdy zmieniają się kluczowe decyzje.

## Zasady pracy

1. Przed rozpoczęciem implementacji przeczytaj wszystkie pliki `.md` z katalogu dokumentacji.
2. Najpierw zrozum aktualny stan repozytorium.
3. Nie zakładaj, że repozytorium jest puste.
4. Nie usuwaj działającego kodu bez wyraźnej potrzeby.
5. Nie zmieniaj stosu technologicznego bez uzasadnienia.
6. Nie dodawaj mikroserwisów, Redisa, kolejek ani zewnętrznych usług, jeżeli nie są jeszcze potrzebne.
7. Preferuj modularny monolit.
8. Każda funkcjonalność powinna być powiązana z `household`.
9. Każda operacja na danych musi uwzględniać autoryzację użytkownika.
10. Nie ufaj identyfikatorom przekazywanym przez frontend.
11. Wszystkie dane wejściowe waliduj po stronie serwera.
12. W przypadku niejasności wybierz najprostszą rozsądną implementację zgodną z dokumentacją.
13. Nie implementuj funkcji z sekcji przyszłościowych podczas prac nad MVP, chyba że są konieczne jako fundament.
14. Nie twórz atrap bez wyraźnego oznaczenia.
15. Nie pozostawiaj krytycznych `TODO` w kodzie produkcyjnym.
16. Pisz kod czytelny, typowany i łatwy do testowania.

## Priorytety

Kolejność priorytetów:

1. poprawność danych,
2. bezpieczeństwo i separacja householdów,
3. prostota obsługi,
4. spójność architektury,
5. wydajność wystarczająca dla kilku użytkowników,
6. możliwość dalszej rozbudowy.

## Sposób implementacji

Dla każdej większej funkcjonalności:

1. Przeanalizuj istniejący kod.
2. Wskaż pliki, które zostaną zmienione.
3. Opisz krótko plan implementacji.
4. Dodaj lub zmień schemat bazy danych.
5. Dodaj walidację.
6. Dodaj logikę serwerową.
7. Dodaj interfejs użytkownika.
8. Dodaj testy najważniejszych przypadków.
9. Sprawdź lint, typy i testy.
10. Podsumuj wykonane zmiany.

## Standard odpowiedzi

Po wykonaniu zadania podaj:

- co zostało zrobione,
- jakie pliki zmieniono,
- jakie migracje dodano,
- jak uruchomić i przetestować funkcję,
- jakie ograniczenia pozostały.

## Zakazy

Nie należy:

- przechowywać haseł użytkowników we własnej bazie, jeżeli używany jest Authentik,
- mieszać składników ogólnych z konkretnymi produktami sklepowymi,
- obliczać makro wyłącznie po stronie klienta,
- tworzyć list zakupów bez zachowania powiązania ze źródłem pozycji,
- pozwalać użytkownikowi na dostęp do danych innego household,
- implementować OCR paragonów jako pierwszy etap projektu,
- tworzyć własnego systemu plików w bazie PostgreSQL,
- trzymać sekretów w repozytorium.

## Konwencje domenowe

Używaj angielskich nazw w kodzie i bazie danych.

Przykładowe nazwy:

- `household`
- `householdMember`
- `ingredient`
- `product`
- `recipe`
- `mealPlanEntry`
- `shoppingList`
- `pantryItem`
- `receipt`
- `expenseSplit`

Teksty interfejsu mogą być po polsku.

## Kryterium ukończenia MVP

MVP uznaje się za ukończone, gdy użytkownik może:

1. zalogować się,
2. utworzyć household,
3. dodać składniki,
4. utworzyć przepis,
5. dodać przepis do planera tygodniowego,
6. przypisać porcje do użytkowników,
7. zobaczyć dzienne kalorie i makro,
8. wygenerować listę zakupów,
9. zaznaczać kupione produkty,
10. korzystać z aplikacji wygodnie na telefonie.
