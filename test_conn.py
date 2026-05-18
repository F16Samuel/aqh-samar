import sqlalchemy

host = "aws-1-ap-northeast-1.pooler.supabase.com"
print(f"Testing Tokyo cluster 1 pooler connection on: {host}...")
try:
    url = f"postgresql://postgres.mqpqqjsrmupmpgwpyghj:G!ml!G0Br12@{host}:6543/postgres?sslmode=require"
    engine = sqlalchemy.create_engine(url)
    with engine.connect() as conn:
        result = conn.execute(sqlalchemy.text("SELECT 1")).scalar()
        print(f"============================================================")
        print(f"DATABASE CONNECTION SUCCESSFUL! SELECT 1 returned: {result}")
        print(f"============================================================")
except Exception as e:
    print(f"Connection failed: {e}")
