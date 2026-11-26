from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from database import get_session
from auth import verify_director
from models import Student, StageEnum, FeeRecord, DailySlip
from datetime import date
from typing import Optional

router = APIRouter(prefix="/director", tags=["Director"])


@router.get("/stats")
def get_director_stats(
    date_str: Optional[str] = Query(None, alias="date", description="Date in YYYY-MM-DD format"),
    session: Session = Depends(get_session),
    _user: str = Depends(verify_director),
):
    """
    Director-only endpoint: Returns comprehensive financial statistics.
    - Monthly Fee Income = sum of PAID FeeRecords for the CURRENT month
    - Annual Income = sum of ALL PAID FeeRecords across all months of the current year
    - Daily Cash & Bank = collections cleared on the selected date (defaults to today)
    - Daily Slip Print Status = tracks whether admin has printed the official daily slip
    """
    total_students = session.exec(select(func.count(Student.id))).one()
    total_admitted = session.exec(select(func.count(Student.id)).where(Student.stage == StageEnum.admitted)).one()

    # Sum admission fees, security, and annual recurring fee
    sums = session.exec(
        select(
            func.sum(Student.challan_amount_paid),
            func.sum(Student.challan_security),
            func.sum(Student.challan_annual_fee)
        )
    ).first()
    
    total_collected = sums[0] if sums and sums[0] else 0.0
    total_security = sums[1] if sums and sums[1] else 0.0
    total_annual_fee = sums[2] if sums and sums[2] else 0.0

    today = date.today()
    target_date = date_str or today.strftime("%Y-%m-%d")

    month_names = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    current_month_str = f"{month_names[today.month - 1]} {today.year}"
    current_year = str(today.year)

    # Monthly fee income (only current month, status == paid)
    monthly_income_val = session.exec(
        select(func.sum(FeeRecord.amount_due))
        .where(FeeRecord.status == "paid", FeeRecord.fee_month == current_month_str)
    ).one()
    monthly_income = monthly_income_val if monthly_income_val else 0.0

    # Annual fee income (all paid records matching current year)
    annual_income_val = session.exec(
        select(func.sum(FeeRecord.amount_due))
        .where(FeeRecord.status == "paid", FeeRecord.fee_month.like(f"%{current_year}%"))
    ).one()
    annual_income = annual_income_val if annual_income_val else 0.0

    # Daily Filtered Records matching target_date
    daily_paid_records = session.exec(
        select(FeeRecord)
        .where(FeeRecord.status == "paid", FeeRecord.cleared_date == target_date)
    ).all()

    cash_records = [r for r in daily_paid_records if (r.payment_method or "").lower() == "cash"]
    bank_records = [r for r in daily_paid_records if (r.payment_method or "").lower() == "bank"]

    daily_cash_total = sum(r.amount_due for r in cash_records)
    daily_cash_count = len(cash_records)

    daily_bank_total = sum(r.amount_due for r in bank_records)
    daily_bank_count = len(bank_records)

    # Check official printed slip records
    cash_slip = session.exec(
        select(DailySlip).where(
            DailySlip.slip_date == target_date,
            DailySlip.payment_method == "Cash"
        )
    ).first()

    bank_slip = session.exec(
        select(DailySlip).where(
            DailySlip.slip_date == target_date,
            DailySlip.payment_method == "Bank"
        )
    ).first()

    # Detailed list of daily records for director inspection
    daily_records_list = []
    if daily_paid_records:
        student_ids = [r.student_id for r in daily_paid_records]
        relevant_students = session.exec(select(Student).where(Student.id.in_(student_ids))).all()
        student_map = {s.id: s for s in relevant_students}
        
        for r in daily_paid_records:
            st = student_map.get(r.student_id)
            daily_records_list.append({
                "id": r.id,
                "student_id": r.student_id,
                "student_name": st.name if st else f"Student #{r.student_id}",
                "parent_name": st.parent_name if st else "—",
                "gr_number": st.gr_number if st else "—",
                "class_applied_for": st.class_applied_for if st else "—",
                "fee_month": r.fee_month,
                "amount_due": r.amount_due,
                "payment_method": r.payment_method or "Cash",
                "cleared_at": r.cleared_at.strftime("%Y-%m-%d %H:%M") if r.cleared_at else None,
            })

    return {
        "total_students": total_students,
        "total_admitted": total_admitted,
        "total_monthly_fee": round(monthly_income, 2),
        "projected_annual_fee": round(annual_income, 2),
        "total_collected": round(total_collected, 2),
        "total_security": round(total_security, 2),
        "total_annual_fee": round(total_annual_fee, 2),
        "selected_date": target_date,
        "daily_cash": {
            "total": round(daily_cash_total, 2),
            "count": daily_cash_count,
            "slip_printed": cash_slip is not None,
            "printed_at": cash_slip.printed_at.strftime("%Y-%m-%d %H:%M") if cash_slip and cash_slip.printed_at else None,
            "printed_by": cash_slip.printed_by if cash_slip else None,
        },
        "daily_bank": {
            "total": round(daily_bank_total, 2),
            "count": daily_bank_count,
            "slip_printed": bank_slip is not None,
            "printed_at": bank_slip.printed_at.strftime("%Y-%m-%d %H:%M") if bank_slip and bank_slip.printed_at else None,
            "printed_by": bank_slip.printed_by if bank_slip else None,
        },
        "daily_records": daily_records_list,
    }

