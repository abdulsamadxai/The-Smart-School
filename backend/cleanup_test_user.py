import sqlalchemy as sa
import os
url = os.getenv('SUPABASE_DATABASE_URL', 'postgresql+psycopg2://postgres.ghoiaihbjcsjldryzmpy:%23AbdulSamad323893@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres')
engine = sa.create_engine(url)
with engine.connect() as conn:
    conn.execute(sa.text("DELETE FROM historylog WHERE student_id IN (SELECT id FROM student WHERE name = 'QA Test User')"))
    conn.execute(sa.text("DELETE FROM student WHERE name = 'QA Test User'"))
    conn.commit()
print('Cleaned up QA Test User!')
