# ERP_Doli17_PresetAdmin (Docker Hub only)

Images:
- Dolibarr: tuxgasy/dolibarr:17.0.4
- MariaDB: bitnami/mariadb:10.11

Quick start:
1) Extract to `C:\Users\User\Desktop\ERP\ERP_Doli17_PresetAdmin_DockerHubOnly`
2) In PowerShell: `cd scripts` then `powershell -ExecutionPolicy Bypass -File .\01_up.ps1`
3) Open http://localhost:8282
   - admin / ChangeThisAdmin!
   - Admin! / Admin123! (fallback AdminNew)
4) API key is written to `init\api_key.txt`
