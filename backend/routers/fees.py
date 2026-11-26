from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime

from database import get_session
from models import (
    FeeRecord, FeeRecordRead, FeeRecordCreate, FeeRecordUpdate,
    Student, StageEnum, HistoryLog,
    DailySlip, DailySlipRead, DailySlipCreate
)
from sqlmodel import SQLModel
from auth import verify_credentials

class BatchFeeRequest(SQLModel):
    student_id: int
    fee_month: str
    amount_due: float

class RecordDailySlipRequest(SQLModel):
    slip_date: str
    payment_method: str
    total_amount: float
    record_count: int

router = APIRouter(prefix="/fees", tags=["Fees"])



@router.get("/me", response_model=dict)
def get_my_role(role: str = Depends(verify_credentials)):
    """Returns the role of the currently authenticated user."""
    return {"role": role}


@router.get("/records", response_model=List[FeeRecordRead])
def read_fee_records(
    month: str,
    class_name: Optional[str] = None,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    """
    Get all fee records for a specific month.
    Optionally filter by class name.
    """
    statement = select(FeeRecord).where(FeeRecord.fee_month == month)
    records = session.exec(statement).all()

    if class_name:
        # Filter in memory for simplicity, or join
        records = [r for r in records if r.student and r.student.class_applied_for == class_name]

    return records


@router.post("/initialize", response_model=dict)
def initialize_fees_for_month(
    month: str,
    amount: float,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    """
    Create 'unpaid' records for all admitted students for the specified month,
    if they don't already exist.
    """
    amount = round(amount, 2)
    
    # Get all admitted students
    statement = select(Student).where(Student.stage == StageEnum.admitted)
    students = session.exec(statement).all()
    
    if not students:
        return {"message": f"Initialized fees for 0 students for month {month}."}
        
    student_ids = [s.id for s in students]
    
    # Fetch existing records for this month
    existing_records = session.exec(
        select(FeeRecord).where(
            FeeRecord.student_id.in_(student_ids),
            FeeRecord.fee_month == month
        )
    ).all()
    
    existing_map = {r.student_id: r for r in existing_records}

    created_count = 0
    for student in students:
        if student.id not in existing_map:
            new_record = FeeRecord(
                student_id=student.id,
                fee_month=month,
                amount_due=amount,
                status="unpaid"
            )
            session.add(new_record)
            
            # Log history
            log = HistoryLog(
                student_id=student.id,
                event_text=f"Fee of Rs.{amount} generated for {month}."
            )
            session.add(log)
            created_count += 1

    session.commit()
    return {"message": f"Initialized fees for {created_count} students for month {month}."}

@router.post("/batch-save")
def batch_save_fee_records(
    records: List[BatchFeeRequest],
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    """
    Upserts fee records for a specific month with the EXACT amount calculated
    by the frontend (including custom fines, arrears, etc.) before printing.
    """
    updated = 0
    created = 0
    
    if not records:
        return {"message": "Batch saved successfully.", "updated": 0, "created": 0}

    student_ids = list({req.student_id for req in records})
    fee_months = list({req.fee_month for req in records})

    # Fetch existing records for these students and months in ONE query
    existing_records = session.exec(
        select(FeeRecord).where(
            FeeRecord.student_id.in_(student_ids),
            FeeRecord.fee_month.in_(fee_months)
        )
    ).all()

    existing_map = {(r.student_id, r.fee_month): r for r in existing_records}
    
    for req in records:
        req.amount_due = round(req.amount_due, 2)
        existing = existing_map.get((req.student_id, req.fee_month))

        if existing:
            # Overwrite amount_due if it's currently unpaid
            if existing.status == "unpaid":
                existing.amount_due = req.amount_due
                session.add(existing)
                updated += 1
        else:
            new_rec = FeeRecord(
                student_id=req.student_id,
                fee_month=req.fee_month,
                amount_due=req.amount_due,
                status="unpaid"
            )
            session.add(new_rec)
            
            # log
            log = HistoryLog(
                student_id=req.student_id,
                event_text=f"Batch generated `{req.fee_month}` challan for Rs.{req.amount_due:,.2f}."
            )
            session.add(log)
            created += 1

    session.commit()
    return {"message": f"Saved {created} new records, updated {updated} existing."}


@router.put("/records/{record_id}/toggle-status", response_model=FeeRecordRead)
def toggle_fee_status(
    record_id: int,
    payment_method: Optional[str] = Query(None, description="'Cash' or 'Bank'"),
    cleared_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    record = session.get(FeeRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Fee record not found")

    if record.status == "unpaid":
        now = datetime.now()
        record.status = "paid"
        record.cleared_at = now
        record.payment_method = payment_method  # Store Cash or Bank
        record.cleared_date = cleared_date or now.strftime("%Y-%m-%d")
        action = f"PAID ({payment_method or 'unspecified'})"
    else:
        record.status = "unpaid"
        record.cleared_at = None
        record.payment_method = None  # Clear payment method when marking unpaid
        record.cleared_date = None
        action = "UNPAID"

    # Log history
    log = HistoryLog(
        student_id=record.student_id,
        event_text=f"Fee for {record.fee_month} marked as {action}."
    )
    session.add(log)

    session.add(record)
    session.commit()
    session.refresh(record)
    return record


@router.post("/daily-slips/record-print", response_model=DailySlipRead)
def record_daily_slip_print(
    req: RecordDailySlipRequest,
    session: Session = Depends(get_session),
    role: str = Depends(verify_credentials)
):
    """
    Called when an admin prints a Daily Cash or Bank slip.
    Upserts a DailySlip entry so the Director Dashboard is immediately updated with official slip print status.
    """
    statement = select(DailySlip).where(
        DailySlip.slip_date == req.slip_date,
        DailySlip.payment_method == req.payment_method
    )
    existing = session.exec(statement).first()
    now = datetime.now()

    if existing:
        existing.total_amount = req.total_amount
        existing.record_count = req.record_count
        existing.printed_by = role
        existing.printed_at = now
        session.add(existing)
        slip = existing
    else:
        slip = DailySlip(
            slip_date=req.slip_date,
            payment_method=req.payment_method,
            total_amount=req.total_amount,
            record_count=req.record_count,
            printed_by=role,
            printed_at=now
        )
        session.add(slip)

    session.commit()
    session.refresh(slip)
    return slip


@router.get("/daily-slips", response_model=List[DailySlipRead])
def get_daily_slips(
    date: Optional[str] = None,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    """
    Get daily slip print history, optionally filtered by date (YYYY-MM-DD).
    """
    statement = select(DailySlip)
    if date:
        statement = statement.where(DailySlip.slip_date == date)
    return session.exec(statement.order_by(DailySlip.printed_at.desc())).all()



@router.get("/students/{student_id}/arrears", response_model=dict)
def get_student_arrears(
    student_id: int,
    current_month: str, # The month we are generating challans for, to exclude it from arrears
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    """
    Calculate arrears: Sum of all unpaid fee records excluding the current_month.
    """
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Fetch unpaid records
    statement = select(FeeRecord).where(
        FeeRecord.student_id == student_id,
        FeeRecord.status == "unpaid",
        FeeRecord.fee_month != current_month
    )
    records = session.exec(statement).all()
    monthly_arrears = sum(r.amount_due for r in records)

    # Calculate Admission Fee balance if challan data exists
    admission_arrears = 0.0
    if student.challan_monthly_fee is not None:
        mf = student.challan_monthly_fee or 0.0
        sw = mf * (student.challan_scholarship_pct or 0.0) / 100
        sib = mf * (student.challan_sibling_discount_pct or 0.0) / 100
        orp = mf * (student.challan_orphan_discount_pct or 0.0) / 100
        mf_net = max(0.0, mf - sw - sib - orp)

        af = student.challan_admission_fee or 0.0
        asw = af * (student.challan_admission_scholarship_pct or 0.0) / 100
        af_net = max(0.0, af - asw)

        sec = student.challan_security or 0.0
        sec_sw = sec * (student.challan_security_scholarship_pct or 0.0) / 100
        sec_net = max(0.0, sec - sec_sw)

        total_fee = mf_net + af_net + (student.challan_annual_fee or 0.0) + sec_net + (student.challan_other_dues or 0.0)
        paid = student.challan_amount_paid or 0.0
        admission_arrears = max(0.0, total_fee - paid)

    total_arrears = round(monthly_arrears + admission_arrears, 2)
    months_pending = [r.fee_month for r in records]

    return {
        "student_id": student.id,
        "arrears_amount": total_arrears,
        "months_pending": months_pending
    }


@router.get("/students/{student_id}/fee-history", response_model=List[FeeRecordRead])
def get_student_fee_history(
    student_id: int,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    """
    Get all fee records for a specific student (complete fee payment history).
    """
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    statement = select(FeeRecord).where(FeeRecord.student_id == student_id)
    records = session.exec(statement).all()
    return records
