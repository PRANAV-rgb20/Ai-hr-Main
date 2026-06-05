import sys, json
sys.path.insert(0, '.')
from app.core.openrouter import _extract_json

tests = [
    ('{"score": 85, "rec": "hire"}',                              'plain JSON'),
    ('```json\n{"score": 85}\n```',                               'fenced JSON'),
    ('<think>let me think...</think>\n\n{"score": 90}',           'think+JSON'),
    ('Here is my analysis:\n{"score": 75, "rec": "maybe"}',      'preamble+JSON'),
    ('<think>reasoning</think>\n```json\n{"score":80}\n```',      'think+fence+JSON'),
    ('{"a": 1, "b": "hello \\"world\\""}',                       'JSON with escaped quotes'),
]

all_ok = True
for raw, desc in tests:
    try:
        cleaned = _extract_json(raw)
        parsed = json.loads(cleaned)
        print(f"  OK  [{desc}]: {parsed}")
    except Exception as e:
        print(f"  FAIL[{desc}]: {e}")
        all_ok = False

print()
print("All tests passed!" if all_ok else "SOME TESTS FAILED")
