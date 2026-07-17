# Odporny watcher wdrożeń

## Cel

Automatyczny watcher ma nadal wykrywać kolejne zmiany na śledzonej gałęzi po
nieudanym wdrożeniu. Po wykryciu nowego commita ma rozpocząć świeży,
krótki log dla tego wdrożenia.

## Projekt

- `scripts/watch-deploy.sh` sam zarządza plikiem logu wskazanym przez
  `WATCH_LOG_FILE`, domyślnie `watch-deploy.log` w katalogu repozytorium.
- Funkcja `log` zapisuje komunikaty jednocześnie na standardowe wyjście i do
  pliku logu.
- Po wykryciu nowego zdalnego commita, przed `git pull`, watcher zeruje plik
  logu. Następne komunikaty opisują wyłącznie bieżący cykl wdrożenia.
- Niepowodzenie `git pull` nadal kończy watcher, ponieważ oznacza niespójność
  repozytorium wymagającą interwencji.
- Niepowodzenie komendy deploy nie kończy watchera. Zostaje zapisane jako błąd,
  a pętla przechodzi do kolejnej iteracji.
- Udane wdrożenie nadal zapisuje `Deploy finished`.

## Testy

Test integracyjny watchera użyje tymczasowego repozytorium:

1. Utworzy istniejący, stary wpis w pliku logu.
2. Wypchnie nowy commit.
3. Uruchomi watcher z komendą deploy kończącą się błędem.
4. Sprawdzi, że stary wpis został usunięty, a błąd zapisany.
5. Wypchnie kolejny commit i uruchomi następną iterację tego samego scenariusza.
6. Sprawdzi, że drugi commit został pobrany i wdrożenie się powiodło.

Test nie zależy od Dockera ani środowiska produkcyjnego.
