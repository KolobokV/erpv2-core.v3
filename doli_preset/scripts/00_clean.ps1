Param([switch]$Hard,[switch]$PruneImages)
$ErrorActionPreference = "Stop"
docker compose down
if($Hard){
  docker volume rm erp17preset_db_data -f | Out-Null
  docker volume rm erp17preset_doli_docs -f | Out-Null
  if(Test-Path ".\init\api_key.txt"){ Remove-Item ".\init\api_key.txt" -Force -ErrorAction SilentlyContinue }
}
if($PruneImages){ docker image prune -f | Out-Null }
