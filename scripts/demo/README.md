# Demo brand generator

Builds everything in `/demo` from one source of truth (`demo_data.py`), so rules, facts, sample posts, images and the answer key always agree.

```bash
pip install pillow reportlab
python scripts/demo/build_demo.py demo
node scripts/generate-seed.mjs > supabase/seed.sql
```
