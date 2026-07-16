# Wdrożenie

## Środowisko

Aplikacja będzie uruchomiona na własnym serwerze w Dockerze.

## Minimalny Docker Compose

Usługi:

```text
app
postgres
backup
```

## Docelowe usługi

```text
app
postgres
worker
redis
backup
```

Worker i Redis dopiero wtedy, gdy pojawią się ciężkie zadania OCR lub przetwarzania.

## Przepływ ruchu

```text
Internet
→ Cloudflare
→ Cloudflare Tunnel
→ aplikacja Next.js
→ PostgreSQL
```

## Domena

Docelowo:

```text
https://food.rozwinswojbiznes.pl -> http://192.168.1.213:3102
```

## Authentik

Aplikacja korzysta z Authentika jako dostawcy OIDC.

Należy skonfigurować:

- client ID,
- client secret,
- issuer URL,
- redirect URI: `https://food.rozwinswojbiznes.pl/api/auth/callback/authentik`,
- logout redirect URI, jeśli używany: `https://food.rozwinswojbiznes.pl/login`.

Sekrety przechowywać wyłącznie w zmiennych środowiskowych lub menedżerze sekretów.

## Zmienne środowiskowe

Przykładowe nazwy:

```text
DATABASE_URL
AUTH_SECRET
AUTH_URL
NEXTAUTH_URL
AUTH_TRUST_HOST
AUTHENTIK_ISSUER
AUTHENTIK_CLIENT_ID
AUTHENTIK_CLIENT_SECRET
APP_URL
UPLOAD_DIR
```

Nie commitować pliku `.env`.

Dodać `.env.example`.

## Wolumeny

Trwałe dane:

- PostgreSQL,
- zdjęcia przepisów,
- paragony,
- kopie zapasowe.

## Kopie zapasowe

Backup powinien obejmować:

- dump PostgreSQL,
- katalog uploadów,
- konfigurację wdrożenia,
- pliki Compose,
- bezpieczną kopię sekretów poza repozytorium.

Minimalnie:

- codzienny backup bazy,
- rotacja backupów,
- test odtwarzania.

Backup bez przetestowanego odtwarzania nie jest wystarczający.

## Migracje

Migracje powinny uruchamiać się kontrolowanie.

Skrypt wdrożeniowy wykonuje zweryfikowany backup bazy i uploadów, a następnie
uruchamia usługę `migrate` przed aplikacją. Migrator stosuje pliki SQL kolejno,
zapisuje ich checksumy i blokuje równoległe wykonanie w PostgreSQL. Wykonanych
migracji nie wolno edytować. Każda zmiana schematu wymaga nowego pliku SQL.

## Logowanie

Aplikacja powinna logować:

- błędy,
- problemy autoryzacji,
- nieudane integracje,
- błędy generowania list,
- błędy migracji.

Nie logować:

- tokenów,
- sekretów,
- pełnych danych sesji,
- danych wrażliwych z paragonów bez potrzeby.

## Aktualizacje

Przykładowy proces:

1. build obrazu,
2. test,
3. backup,
4. migracja,
5. wdrożenie,
6. health check.

## Health check

Dodać endpoint sprawdzający:

- działanie aplikacji,
- połączenie z bazą.

Nie ujawniać szczegółów infrastruktury publicznie.
