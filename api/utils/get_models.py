import os
import requests

url = "https://api.intelligence.io.solutions/api/v1/models"

headers = {
    "accept": "application/json",
    "Authorization": f"Bearer {os.getenv('IOINTELLIGENCE_API_KEY')}",
}

response = requests.get(url, headers=headers)
print(response.json())
