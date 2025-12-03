
import requests
import os

class DolibarrService:
    BASE = os.getenv("DOLI_URL_ROOT", "http://localhost:8282")
    KEY_PATH = os.getenv("DOLI_API_KEY_PATH")

    @staticmethod
    def _key():
        if not DolibarrService.KEY_PATH or not os.path.exists(DolibarrService.KEY_PATH):
            raise Exception("Dolibarr API key not found")
        return open(DolibarrService.KEY_PATH).read().strip()

    @staticmethod
    def _get(endpoint):
        url = DolibarrService.BASE + endpoint
        headers = {"DOLAPIKEY": DolibarrService._key()}
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code >= 400:
            raise Exception(f"Dolibarr error {r.status_code}: {r.text}")
        return r.json()

    @staticmethod
    def list_clients():
        return DolibarrService._get("/api/index.php/thirdparties")

    @staticmethod
    def list_invoices():
        return DolibarrService._get("/api/index.php/invoices")

    @staticmethod
    def list_products():
        return DolibarrService._get("/api/index.php/products")
