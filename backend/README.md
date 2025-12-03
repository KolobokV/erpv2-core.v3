# ERPv2 Backend Connector — Stability Pack (v1.1.0)

Что добавлено:
- Корневой маршрут `/` и тихий `/favicon.ico`.
- `/snapshot` — JSON-слепок ключевых сущностей в `./data/snapshots`.
- Скрипты: `ERPv2_run.ps1` (оркестрация Dolibarr+backend), `90_smoke.ps1`, `95_snapshot.ps1`.

## Запуск
powershell -ExecutionPolicy Bypass -File .\scripts\01_up.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\ERPv2_run.ps1
## Snapshot
powershell -ExecutionPolicy Bypass -File .\scripts\95_snapshot.ps1
