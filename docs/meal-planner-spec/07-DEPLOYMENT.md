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

Przykład:

```text
food.rozwinswojbiznes.pl
```

## Authentik

Aplikacja korzysta z Authentika jako dostawcy OIDC.

Należy skonfigurować:

- client ID,
- client secret,
- issuer URL,
- redirect URI,
- logout redirect URI.

Sekrety przechowywać wyłącznie w zmiennych środowiskowych lub menedżerze sekretów.

## Zmienne środowiskowe

Przykładowe nazwy:

```text
DATABASE_URL
AUTH_SECRET
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

Nie wykonywać nieodwracalnych migracji automatycznie bez kopii zapasowej.

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
