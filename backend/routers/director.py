from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from database import get_session
from auth import verify_director
from models import Student, StageEnum, FeeRecord
from datetime import date

router = APIRouter(prefix="/director", tags=["Director"])


@router.get("/stats")
def get_director_stats(
    session: Session = Depends(get_session),
    _user: str = Depends(verify_director),
):
    """
    Director-only endpoint: Returns comprehensive financial statistics.
    - Monthly Fee Income = sum of PAID FeeRecords for the CURRENT month
    - Annual Income = sum of ALL PAID FeeRecords across all months of the current year
    """
    all_students = session.exec(select(Student)).all()

    admitted = [s for s in all_students if s.stage == StageEnum.admitted]
    total_students = len(all_students)
    total_admitted = len(admitted)

    # Admission fees (from challan_amount_paid on student record)
    total_collected = 0.0
    total_security = 0.0
    for s in all_students:
        total_collected += s.challan_amount_paid or 0.0
        total_security += s.challan_security or 0.0

    # Current month string e.g. "July 2026"
    today = date.today()
    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    current_month_str = f"{month_names[today.month - 1]} {today.year}"
    current_year = today.year

    # All PAID fee records
    all_paid_records = session.exec(
        select(FeeRecord).where(FeeRecord.status == "paid")
    ).all()

    # Monthly: only current month
    monthly_income = sum(r.amount_due for r in all_paid_records if r.fee_month == current_month_str)

    # Annual: all paid records whose month string contains the current year
    annual_income = sum(r.amount_due for r in all_paid_records if str(current_year) in r.fee_month)

    return {
        "total_students": total_students,
        "total_admitted": total_admitted,
        "total_monthly_fee": round(monthly_income, 2),
        "projected_annual_fee": round(annual_income, 2),
        "total_collected": round(total_collected, 2),
        "total_security": round(total_security, 2),
    }
