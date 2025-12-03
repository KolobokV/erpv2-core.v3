import os
from pathlib import Path

DOLI_BASE_URL = os.getenv("DOLI_BASE_URL", "http://host.docker.internal:8282/api/index.php")
DOLI_API_KEY = os.getenv("DOLI_API_KEY")
DOLI_API_KEY_PATH = os.getenv("DOLI_API_KEY_PATH", r"C:\Users\User\Desktop\ERP\ERP_Doli17_PresetAdmin_DockerHubOnly\init\api_key.txt")

def read_api_key() -> str:
    if DOLI_API_KEY:
        return DOLI_API_KEY.strip()
    try:
        p = Path(DOLI_API_KEY_PATH)
        return p.read_text(encoding="utf-8").strip()
    except Exception:
        return ""
