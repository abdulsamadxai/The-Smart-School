"""
seed.py — Populates the database with sample data for immediate testing.

Usage:
  python seed.py          # Inserts sample data (skips if data exists)
  python seed.py --clear  # Wipes ALL data, then inserts fresh sample data
"""

import sys
import json
from datetime import datetime, timedelta
from sqlmodel import Session, select

# Must run from the backend/ directory so imports resolve correctly
from database import create_db_and_tables, engine
from models import Student, HistoryLog, CriteriaSetting, StageEnum, DecisionEnum


CRITERIA = [
    {"class_name": "Playgroup", "min_age_years": 2.0, "max_age_years": 3.0},
    {"class_name": "Nursery",   "min_age_years": 3.0, "max_age_years": 4.0},
    {"class_name": "Prep",      "min_age_years": 4.0, "max_age_years": 5.0},
    {"class_name": "Grade 1",   "min_age_years": 5.0, "max_age_years": 6.5},
    {"class_name": "Grade 2",   "min_age_years": 6.0, "max_age_years": 7.5},
    {"class_name": "Grade 3",   "min_age_years": 7.0, "max_age_years": 8.5},
    {"class_name": "Grade 4",   "min_age_years": 8.0, "max_age_years": 9.5},
    {"class_name": "Grade 5",   "min_age_years": 9.0, "max_age_years": 10.5},
    {"class_name": "Grade 6",   "min_age_years": 10.0, "max_age_years": 11.5},
    {"class_name": "Grade 7",   "min_age_years": 11.0, "max_age_years": 12.5},
    {"class_name": "Grade 8",   "min_age_years": 12.0, "max_age_years": 13.5},
    {"class_name": "Grade 9",   "min_age_years": 13.0, "max_age_years": 14.5},
    {"class_name": "Grade 10",  "min_age_years": 14.0, "max_age_years": 15.5},
]

NOW = datetime.utcnow()
today_str = NOW.strftime("%Y-%m-%d")
year = NOW.year


def dob_for_age(years: float) -> str:
    days = int(years * 365.25)
    return (NOW - timedelta(days=days)).strftime("%Y-%m-%d")


def make_admitted(name, cls, age, contact, gr_idx, days_ago=30):
    return {
        "name": name,
        "class_applied_for": cls,
        "date_of_birth": dob_for_age(age),
        "contact_number": contact,
        "stage": StageEnum.admitted,
        "age_at_registration": age,
        "criteria_note": f"Age {age} years — eligible for {cls}.",
        "test_date": (NOW - timedelta(days=days_ago - 10)).strftime("%Y-%m-%d"),
        "test_time": "10:00",
        "score_total_obtained": 75.0,
        "score_total_possible": 100.0,
        "score_subjects_json": None,
        "decision": DecisionEnum.admitted,
        "decision_at": NOW - timedelta(days=days_ago - 7),
        "gr_number": f"TSS-{year}-{gr_idx:04d}",
        "joined": True,
        "registered_at": NOW - timedelta(days=days_ago),
        "logs": [
            f"Student registered for {cls}.",
            f"Criteria check passed — eligible for {cls}.",
            f"Test scheduled.",
            f"Score entered: 75/100.",
            f"Admitted. GR number: TSS-{year}-{gr_idx:04d}.",
            "Student confirmed joining.",
        ],
    }


STUDENTS_DATA = [
    # --- Playgroup ---
    make_admitted("Hamza Raza",       "Playgroup", 2.5, "0300-1010001", 1),
    make_admitted("Maryam Iqbal",     "Playgroup", 2.8, "0311-1020002", 2),
    make_admitted("Ali Jan",          "Playgroup", 2.6, "0321-1030003", 3),
    # --- Nursery ---
    make_admitted("Aisha Fatima",     "Nursery",   3.5, "0300-2010004", 4),
    make_admitted("Bilal Hassan",     "Nursery",   3.8, "0311-2020005", 5),
    make_admitted("Sana Baig",        "Nursery",   3.3, "0321-2030006", 6),
    # --- Prep ---
    make_admitted("Omar Farooq",      "Prep",      4.3, "0321-3010007", 7),
    make_admitted("Khadija Nasir",    "Prep",      4.7, "0345-3020008", 8),
    make_admitted("Zaid Khan",        "Prep",      4.5, "0301-3030009", 9),
    # --- Grade 1 ---
    make_admitted("Fatima Malik",     "Grade 1",   5.8, "0300-4010010", 10),
    make_admitted("Ibrahim Ahmed",    "Grade 1",   6.0, "0311-4020011", 11),
    make_admitted("Nadia Shah",       "Grade 1",   5.5, "0321-4030012", 12),
    # --- Grade 2 ---
    make_admitted("Sara Malik",       "Grade 2",   6.9, "0321-5010013", 13),
    make_admitted("Umer Saeed",       "Grade 2",   7.1, "0345-5020014", 14),
    make_admitted("Ayesha Tariq",     "Grade 2",   6.7, "0301-5030015", 15),
    # --- Grade 3 ---
    make_admitted("Usman Tariq",      "Grade 3",   7.4, "0333-6010016", 16),
    make_admitted("Rabia Hussain",    "Grade 3",   7.9, "0300-6020017", 17),
    make_admitted("Farhan Ali",       "Grade 3",   7.2, "0311-6030018", 18),
    # --- Grade 4 ---
    make_admitted("Hina Akram",       "Grade 4",   8.2, "0345-7010019", 19),
    make_admitted("Talha Qureshi",    "Grade 4",   8.7, "0321-7020020", 20),
    make_admitted("Amna Riaz",        "Grade 4",   8.4, "0300-7030021", 21),
    # --- Grade 5 ---
    make_admitted("Zainab Shah",      "Grade 5",   9.5, "0311-8010022", 22),
    make_admitted("Hassan Mir",       "Grade 5",   9.8, "0321-8020023", 23),
    make_admitted("Lubna Aslam",      "Grade 5",   9.3, "0345-8030024", 24),
    # --- Grade 6 ---
    make_admitted("Kamran Butt",      "Grade 6",  10.5, "0300-9010025", 25),
    make_admitted("Sumera Javed",     "Grade 6",  10.9, "0311-9020026", 26),
    make_admitted("Asad Raza",        "Grade 6",  10.3, "0321-9030027", 27),
    # --- Grade 7 ---
    make_admitted("Madiha Nawaz",     "Grade 7",  11.4, "0300-0A10028", 28),
    make_admitted("Aqib Sohail",      "Grade 7",  11.7, "0311-0A20029", 29),
    make_admitted("Nimra Bashir",     "Grade 7",  11.2, "0321-0A30030", 30),
    # --- Grade 8 ---
    make_admitted("Danish Zahid",     "Grade 8",  12.5, "0345-0B10031", 31),
    make_admitted("Sadia Hameed",     "Grade 8",  12.8, "0300-0B20032", 32),
    make_admitted("Talal Abbas",      "Grade 8",  12.3, "0311-0B30033", 33),
    # --- Grade 9 ---
    make_admitted("Maheen Yousaf",    "Grade 9",  13.6, "0321-0C10034", 34),
    make_admitted("Rehan Shafi",      "Grade 9",  13.9, "0345-0C20035", 35),
    make_admitted("Iqra Pervez",      "Grade 9",  13.4, "0300-0C30036", 36),
    # --- Grade 10 ---
    make_admitted("Waqar Munir",      "Grade 10", 14.5, "0311-0D10037", 37),
    make_admitted("Bushra Karim",     "Grade 10", 14.8, "0321-0D20038", 38),
    make_admitted("Saad Gillani",     "Grade 10", 14.3, "0345-0D30039", 39),
]


def clear_data(session: Session):
    from sqlmodel import delete
    from models import HistoryLog, Student, CriteriaSetting, FeeRecord
    session.exec(delete(FeeRecord))
    session.exec(delete(HistoryLog))
    session.exec(delete(Student))
    session.exec(delete(CriteriaSetting))
    session.commit()
    print("✓ All tables cleared.")


def seed(session: Session):
    # Criteria
    existing_criteria = session.exec(select(CriteriaSetting)).all()
    if not existing_criteria:
        for c in CRITERIA:
            session.add(CriteriaSetting(**c))
        session.commit()
        print(f"✓ Inserted {len(CRITERIA)} criteria rules.")
    else:
        print(f"  Criteria already seeded ({len(existing_criteria)} rules). Skipping.")

    # Students
    # (Disabled dummy students since you are now entering real data)
    session.commit()
    print(f"✓ Skipped dummy students (production mode active).")


if __name__ == "__main__":
    create_db_and_tables()
    with Session(engine) as session:
        if "--clear" in sys.argv:
            clear_data(session)
        seed(session)
    print("✓ Seed complete. You can now start the server.")
