# Alt scrap
Scapper dla Altapi

## Jak uruchomić scrapper?

*Samo uruchomienie scrappera nie wykona żadnych zadań dopóki hypervisor/dispositor nie przekaże argumentów wymaganych do uruchomienia zadania*

Scrapper ma 3 tryby pracy:
 - Scrapping poprzez HTTP forgery - `yarn cli.dist stealer` (domyślny)
 - Scrapping poprzez analizę HTML w uruchomionej przeglądarce - `yarn cli.dist worker` (legacy)
 - Bridge, podłączanie innych scrapperów i serializacja danych dostarczone przez te scrappery - `yarn cli.dist bridge` 

### Docker
```
docker run -d --rm --network host -e ALTAPI_GATEWAY=ws://host.docker.internal:4010/ ghcr.io/pjatk21/alt-scrap:main
```
> przy założeniu, że api, jest uruchomione bez dockera

### Bez dockera
Przed pierwszym uruchomieniem
```bash
yarn install && yarn build && yarn cli.dist init
```
Kolejne uruchomienia
```bash
ALTAPI_GATEWAY=ws://localhost:4010/ yarn cli.dist worker
```

## ToDo
 - [x] Zmiana dat
 - [ ] Zmiana miast
 - [ ] Obsługa rezerwacji
