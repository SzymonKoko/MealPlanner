# Specyfikacja funkcjonalna

## 1. Użytkownicy

Każdy użytkownik posiada:

- identyfikator pochodzący z Authentika,
- nazwę wyświetlaną,
- adres e-mail,
- avatar,
- cele żywieniowe,
- preferowane jednostki,
- członkostwa w householdach.

Aplikacja nie przechowuje własnego hasła.

## 2. Household

Household posiada:

- nazwę,
- właściciela,
- członków,
- wspólne przepisy,
- wspólne składniki,
- wspólny planer,
- wspólne listy zakupów,
- ustawienia.

Role:

- `owner` — pełne zarządzanie,
- `member` — standardowe używanie,
- `viewer` — tylko odczyt.

## 3. Składniki

Składnik reprezentuje ogólny surowiec spożywczy.

Przykłady:

- mąka pszenna,
- mleko,
- ryż,
- pierś z kurczaka,
- oliwa.

Pola:

- nazwa,
- opis,
- kategoria,
- wartości odżywcze na 100 g lub 100 ml,
- jednostka bazowa,
- tagi,
- opcjonalna gęstość lub konwersje jednostek,
- informacja o alergenach.

## 4. Produkty

Produkt reprezentuje konkretny artykuł handlowy.

Przykład:

- Skyr waniliowy Piątnica 150 g.

Pola:

- nazwa,
- marka,
- kod kreskowy,
- wielkość opakowania,
- jednostka opakowania,
- wartości odżywcze,
- powiązany składnik,
- źródło danych,
- identyfikator z Open Food Facts,
- zdjęcie,
- ostatnia cena.

Produkt nie jest tym samym co składnik.

## 5. Przepisy

Przepis zawiera:

- nazwę,
- opis,
- instrukcję,
- czas przygotowania,
- liczbę porcji,
- składniki,
- ilości i jednostki,
- tagi,
- zdjęcie,
- autora,
- automatycznie obliczone makro.

Makro przepisu jest sumą wartości odżywczych składników.

Makro porcji:

```text
makro całego przepisu / liczba porcji
```

## 6. Planer

Planer działa tygodniowo.

Każdy wpis zawiera:

- datę,
- porę posiłku,
- przepis,
- liczbę porcji,
- przypisane osoby,
- porcje per osoba,
- status,
- notatkę.

Pory posiłków:

- śniadanie,
- drugie śniadanie,
- obiad,
- kolacja,
- przekąska.

Użytkownik może:

- przeciągać przepisy,
- przenosić posiłki między dniami,
- kopiować wpis,
- usuwać wpis,
- zmieniać liczbę porcji,
- przypisywać osoby,
- kopiować poprzedni tydzień.

## 7. Liczenie kalorii

Dzienny bilans jest liczony per użytkownik.

Wartości:

- kalorie,
- białko,
- węglowodany,
- tłuszcze,
- błonnik.

Źródłem danych są porcje przypisane do użytkownika.

System nie powinien zakładać, że każda osoba z household je każdy posiłek.

## 8. Lista zakupów

Lista zakupów powstaje na podstawie zakresu dat planera.

System:

1. zbiera wymagane składniki,
2. przelicza je zgodnie z liczbą porcji,
3. agreguje podobne pozycje,
4. w przyszłości odejmuje zapasy,
5. tworzy pozycje listy.

Każda pozycja posiada:

- nazwę,
- ilość,
- jednostkę,
- kategorię,
- źródło,
- status zaznaczenia,
- opcjonalny komentarz.

Źródło:

- `automatic`,
- `manual`.

Pozycje ręczne nie mogą znikać podczas ponownego generowania listy.

## 9. Spiżarnia

Moduł po MVP.

Funkcje:

- zapis stanu produktu,
- ilość,
- lokalizacja,
- data ważności,
- minimalny zapas,
- odejmowanie zapasów od listy zakupów,
- sugestie wykorzystania produktów.

## 10. Paragony i wydatki

Moduł późniejszy.

Przepływ:

1. przesłanie zdjęcia,
2. obróbka obrazu,
3. OCR,
4. ekstrakcja pozycji,
5. ręczne zatwierdzenie,
6. zapis wydatku,
7. podział kosztów.

OCR nigdy nie powinien automatycznie zatwierdzać danych bez możliwości poprawy.

## 11. Tagi

Tagi mogą dotyczyć:

- przepisów,
- składników,
- produktów.

Przykłady:

- fit,
- wysokobiałkowe,
- szybkie,
- wegetariańskie,
- śniadanie,
- meal prep,
- bez laktozy.

## 12. Wyszukiwanie

Wyszukiwanie powinno uwzględniać:

- nazwę,
- tagi,
- kategorię,
- autora,
- ostatnio używane,
- ulubione.

## 13. Powiadomienia

Po MVP:

- kończący się produkt,
- krótka data ważności,
- brak planu na kolejny dzień,
- nowy członek household,
- nieuregulowane rozliczenie.
