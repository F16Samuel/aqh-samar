import asyncio
import httpx

async def main():
    async with httpx.AsyncClient() as client:
        login_res = await client.post(
            "http://localhost:8000/api/v1/auth/login",
            data={"username": "admin@company.com", "password": "password123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test /users/
        print("\n--- Testing /users/ ---")
        users_res = await client.get("http://localhost:8000/api/v1/users/", headers=headers)
        print("Status:", users_res.status_code)
        if users_res.status_code == 500:
            print("Response:", users_res.text)
            
        # Test /reports/company
        print("\n--- Testing /reports/company ---")
        rep_res = await client.get("http://localhost:8000/api/v1/reports/company", headers=headers)
        print("Status:", rep_res.status_code)
        if rep_res.status_code == 500:
            print("Response:", rep_res.text)

        print("\n--- Testing /achievements/ ---")
        # Query DB directly to find a valid goal_id
        # We can just hit /api/v1/achievements/goal/... with the ID the user provided in the logs: ab7ec627-5bd3-41f6-b395-aafadd91ca44
        # Since it's local, I can just use admin token to bypass manager check and see what 500 error happens!
        ach_res = await client.get("http://localhost:8000/api/v1/achievements/goal/ab7ec627-5bd3-41f6-b395-aafadd91ca44", headers=headers)
        print("Status:", ach_res.status_code)
        if ach_res.status_code == 500:
            print("Response:", ach_res.text)

if __name__ == "__main__":
    asyncio.run(main())
