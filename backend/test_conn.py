import asyncio
import asyncpg

async def main():
    print("Testing Neon connection...")
    try:
        conn = await asyncio.wait_for(
            asyncpg.connect(
                host='ep-small-term-aquwohdo-pooler.c-8.us-east-1.aws.neon.tech',
                port=5432,
                user='neondb_owner',
                password='npg_Z3f6DjwTxtsg',
                database='neondb',
                ssl='require',
            ),
            timeout=15
        )
        ver = await conn.fetchval('SELECT version()')
        await conn.close()
        print(f"SUCCESS: {ver[:70]}")
        print("\nDatabase connection is working!")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")

asyncio.run(main())
