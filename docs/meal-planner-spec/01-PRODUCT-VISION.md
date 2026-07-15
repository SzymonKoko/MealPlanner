# Wizja produktu

## Problem

Codzienne planowanie posiłków wymaga wykonywania wielu powtarzalnych czynności:

- wybierania dań,
- sprawdzania składników,
- liczenia porcji,
- tworzenia listy zakupów,
- kontrolowania kalorii,
- pilnowania produktów w domu,
- rozliczania wspólnych zakupów.

Informacje te zwykle znajdują się w kilku aplikacjach, notatkach i arkuszach.

## Rozwiązanie

Aplikacja ma połączyć wszystkie te procesy w jednym prostym narzędziu przeznaczonym dla kilku osób mieszkających razem.

Podstawową jednostką organizacyjną jest `household`.

Household posiada wspólne:

- przepisy,
- składniki,
- produkty,
- planer,
- listy zakupów,
- zapasy,
- paragony,
- wydatki.

Jednocześnie każdy użytkownik posiada własne:

- cele kaloryczne,
- cele makroskładników,
- preferencje,
- wykluczenia,
- przypisane porcje,
- dzienne podsumowania.

## Główne wartości produktu

### Prostota

Najczęstsze operacje powinny wymagać minimalnej liczby kliknięć.

### Współdzielenie

Zmiany powinny być widoczne dla wszystkich członków household.

### Automatyzacja

Planer powinien automatycznie tworzyć zapotrzebowanie zakupowe i podsumowania żywieniowe.

### Mobile first

Lista zakupów i ekran dnia będą najczęściej używane na telefonie.

### Rozwój etapami

Aplikacja powinna działać użytecznie jeszcze przed dodaniem OCR, rozliczeń i automatycznych rekomendacji.

## Główny przepływ użytkownika

1. Użytkownik dodaje składniki lub importuje produkt.
2. Użytkownik tworzy przepis.
3. Przepis otrzymuje liczbę porcji i wartości odżywcze.
4. Użytkownik przeciąga przepis do planera.
5. Określa liczbę porcji i osoby.
6. System oblicza makro dla każdej osoby.
7. System generuje listę zakupów.
8. Household korzysta z checklisty podczas zakupów.
9. W przyszłości zakupy aktualizują zapasy i wydatki.
