"""Test the full resume screening pipeline live."""
import asyncio, sys
sys.path.insert(0, '.')

SAMPLE_RESUME = """
John Doe - Software Engineer
Email: john@example.com | Phone: 555-1234

SKILLS: Python, Django, REST APIs, PostgreSQL, Docker, AWS, React

EXPERIENCE:
Senior Python Developer - TechCorp (2020-2024)
- Built REST APIs using Django and FastAPI
- Managed PostgreSQL databases
- Deployed applications on AWS EC2

EDUCATION: B.Sc Computer Science, 2020
"""

JOB_DESC = "Senior Python Developer with Django, REST APIs and AWS experience"

async def main():
    from app.ai.resume_screener import screen_resume
    import json

    print("=== Testing resume screening end-to-end ===")
    print(f"Job: {JOB_DESC}")
    print()

    try:
        # screen_resume expects bytes, pass encoded
        result = await screen_resume(SAMPLE_RESUME.encode(), JOB_DESC)
        print("SUCCESS!")
        print(f"  Score: {result.get('overall_score')}")
        print(f"  Recommendation: {result.get('recommendation')}")
        print(f"  Summary: {result.get('summary', '')[:100]}")
    except json.JSONDecodeError as e:
        print(f"JSON PARSE ERROR: {e}")
        print("  This means the model returned non-JSON")
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}")

asyncio.run(main())
