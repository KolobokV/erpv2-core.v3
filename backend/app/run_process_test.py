import requests
import json

BASE = "http://localhost:8000"

r = requests.get(f"{BASE}/api/internal/process-instances/instance_test_001")
print("Instance before:", json.dumps(r.json(), indent=2))

r = requests.post(f"{BASE}/api/internal/process-instances/instance_test_001/generate-tasks", json={})
print("Generated:", json.dumps(r.json(), indent=2))

r = requests.get(f"{BASE}/api/tasks")
print("Tasks:", json.dumps(r.json(), indent=2))
