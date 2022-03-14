# Alt scrap
Scapper dla Altapi

## Jak uruchomić scrapper?

*Samo uruchomienie scrappera nie wykona żadnych zadań dopóki hypervisor/dispositor nie przekaże argumentów wymaganych do uruchomienia zadania*

### Docker
```
docker run -d --rm --network host -e ALTAPI_GATEWAY=ws://host.docker.internal:4010/ ghcr.io/pjatk21/alt-scrap:main
```
### Bez dockera
Przed pierwszym uruchomieniem
```bash
yarn install && yarn cli init
```
Kolejne uruchomienia
```bash
ALTAPI_GATEWAY=ws://localhost:4010/ yarn cli worker
```

## ToDo
 - [x] Zmiana dat
 - [ ] Zmiana miast
 - [ ] Obsługa rezerwacji
