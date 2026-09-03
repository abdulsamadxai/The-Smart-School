from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime

from database import get_session
from models import FeeRecord, FeeRecordRead, FeeRecordCreate, FeeRecordUpdate, Student, StageEnum, HistoryLog
from sqlmodel import SQLModel
from auth import verify_credentials

class BatchFeeRequest(SQLModel):
    student_id: int
    fee_month: str
    amount_due: float

router = APIRouter(prefix="/fees", tags=["Fees"])


@router.get("/me", response_model=dict)
def get_my_role(role: str = Depends(verify_credentials)):
    """Returns the role of the currently authenticated user."""
    return {"role": role}


@router.get("/records", response_model=List[FeeRecordRead])
def read_fee_records(
    month: str,
    class_name: Optional[str] = None,
    session: Session = Depends(get_session)
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
    session: Session = Depends(get_session)
):
    """
    Create 'unpaid' records for all admitted students for the specified month,
    if they don't already exist.
    """
    # Get all admitted students
    statement = select(Student).where(Student.stage.in_([StageEnum.admitted]))
    students = session.exec(statement).all()

    created_count = 0
    for student in students:
        # Check if record already exists for this month
        existing = session.exec(select(FeeRecord).where(
            FeeRecord.student_id == student.id,
            FeeRecord.fee_month == month
        )).first()

        if not existing:
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
    session: Session = Depends(get_session)
):
    """
    Upserts fee records for a specific month with the EXACT amount calculated
    by the frontend (including custom fines, arrears, etc.) before printing.
    """
    updated = 0
    created = 0
    
    for req in records:
        existing = session.exec(
            select(FeeRecord).where(
                FeeRecord.student_id == req.student_id,
                FeeRecord.fee_month == req.fee_month
            )
        ).first()

        if existing:
            # Overwrite amount_due if it's currently unpaid, meaning it was newly computed
            # We don't overwrite if it's already 'paid' to avoid messing up history, 
            # but usually they print unpaids.
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
    session: Session = Depends(get_session)
):
    record = session.get(FeeRecord, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Fee record not found")

    if record.status == "unpaid":
        record.status = "paid"
        record.cleared_at = datetime.utcnow()
        record.payment_method = payment_method  # Store Cash or Bank
        action = f"PAID ({payment_method or 'unspecified'})"
    else:
        record.status = "unpaid"
        record.cleared_at = None
        record.payment_method = None  # Clear payment method when marking unpaid
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


@router.get("/students/{student_id}/arrears", response_model=dict)
def get_student_arrears(
    student_id: int,
    current_month: str, # The month we are generating challans for, to exclude it from arrears
    session: Session = Depends(get_session)
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

    total_arrears = monthly_arrears + admission_arrears
    months_pending = [r.fee_month for r in records]

    return {
        "student_id": student.id,
        "arrears_amount": total_arrears,
        "months_pending": months_pending
    }


@router.get("/students/{student_id}/fee-history", response_model=List[FeeRecordRead])
def get_student_fee_history(
    student_id: int,
    session: Session = Depends(get_session)
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
