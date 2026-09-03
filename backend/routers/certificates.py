from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime

from database import get_session
from models import Student, FeeRecord, HistoryLog, StageEnum
from sqlmodel import SQLModel

router = APIRouter(prefix="/certificates", tags=["Certificates"])


# ── Request / Response models ─────────────────────────────────────────────────

class CertificateIssueRequest(SQLModel):
    cert_type: str                           # "leaving" | "character" | "both"
    leaving_date: Optional[str] = None       # YYYY-MM-DD
    leaving_reason: Optional[str] = None
    conduct_remarks: Optional[str] = "Good"


class ArrearsItem(SQLModel):
    fee_month: str
    amount_due: float
    record_id: int


class ClearanceResponse(SQLModel):
    student_id: int
    name: str
    father_name: Optional[str]
    gr_number: Optional[str]
    class_applied_for: str
    class_enrolled: Optional[str]
    date_of_birth: str
    registered_at: datetime
    joined: Optional[bool]
    arrears: List[ArrearsItem]
    total_arrears: float
    certificate_issued: Optional[str]
    certificate_issued_at: Optional[datetime]
    leaving_date: Optional[str]
    leaving_reason: Optional[str]
    conduct_remarks: Optional[str]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_certificate_stats(session: Session = Depends(get_session)):
    """Returns dashboard stats for the certificates page."""
    # All admitted / joined students
    all_students = session.exec(select(Student)).all()
    eligible = [
        s for s in all_students
        if s.stage == StageEnum.admitted or s.joined is True
    ]

    total_eligible = len(eligible)
    cert_issued = [s for s in eligible if s.certificate_issued]
    leaving_issued = [s for s in cert_issued if s.certificate_issued in ("leaving", "both")]
    character_issued = [s for s in cert_issued if s.certificate_issued in ("character", "both")]
    pending_certs = total_eligible - len(cert_issued)

    return {
        "total_eligible": total_eligible,
        "certificates_issued": len(cert_issued),
        "leaving_issued": len(leaving_issued),
        "character_issued": len(character_issued),
        "pending": pending_certs,
    }


@router.get("/search")
def search_students(
    q: Optional[str] = None,
    class_name: Optional[str] = None,
    session: Session = Depends(get_session)
):
    """
    Search ALL students (admitted or joined) by name, GR number or class.
    Returns lightweight list for the search-bar dropdown.
    """
    if not q and not class_name:
        return []

    all_students = session.exec(select(Student)).all()
    q_lower = q.strip().lower() if q else None

    results = []
    for s in all_students:
        is_eligible = s.stage == StageEnum.admitted or s.joined is True
        if not is_eligible:
            continue

        if class_name and s.class_applied_for != class_name and s.class_enrolled != class_name:
            continue

        if q_lower:
            name_match = q_lower in (s.name or "").lower()
            gr_match   = q_lower in (s.gr_number or "").lower()
            if not (name_match or gr_match):
                continue

        results.append({
            "id": s.id,
            "name": s.name,
            "gr_number": s.gr_number or "—",
            "class_applied_for": s.class_applied_for,
            "class_enrolled": s.class_enrolled,
            "certificate_issued": s.certificate_issued,
            "father_name": s.parent_name,
        })

    # Return up to 50 if filtering by class to ensure all students show up
    return results[:50]


@router.get("/student/{student_id}/clearance", response_model=ClearanceResponse)
def get_clearance(
    student_id: int,
    session: Session = Depends(get_session)
):
    """
    Returns the student's details plus any unpaid fee arrears.
    """
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    unpaid = session.exec(
        select(FeeRecord).where(
            FeeRecord.student_id == student_id,
            FeeRecord.status == "unpaid"
        )
    ).all()

    arrears_list = [
        ArrearsItem(
            fee_month=r.fee_month,
            amount_due=r.amount_due,
            record_id=r.id
        )
        for r in unpaid
    ]

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
        admission_arrears = round(max(0.0, total_fee - paid), 2)

    if admission_arrears > 0:
        arrears_list.append(ArrearsItem(
            fee_month="Initial Admission Balance",
            amount_due=admission_arrears,
            record_id=0
        ))

    return ClearanceResponse(
        student_id=student.id,
        name=student.name,
        father_name=student.parent_name,
        gr_number=student.gr_number,
        class_applied_for=student.class_applied_for,
        class_enrolled=student.class_enrolled,
        date_of_birth=student.date_of_birth,
        registered_at=student.registered_at,
        joined=student.joined,
        arrears=arrears_list,
        total_arrears=sum(a.amount_due for a in arrears_list),
        certificate_issued=student.certificate_issued,
        certificate_issued_at=student.certificate_issued_at,
        leaving_date=student.leaving_date,
        leaving_reason=student.leaving_reason,
        conduct_remarks=student.conduct_remarks,
    )


@router.post("/student/{student_id}/pay-admission")
def pay_admission_balance(
    student_id: int,
    method: str = Query(..., description="'Cash' or 'Bank'"),
    session: Session = Depends(get_session)
):
    """
    Pays off any remaining 'Initial Admission Balance'.
    Increments student.challan_amount_paid and creates a formal FeeRecord
    so it shows up on the Daily Cash/Bank Sheets.
    """
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Calculate current admission missing balance
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
        admission_arrears = round(max(0.0, total_fee - paid), 2)

    if admission_arrears <= 0:
        return {"message": "No admission arrears left to pay"}

    # Update student paid amount
    student.challan_amount_paid = (student.challan_amount_paid or 0.0) + admission_arrears

    # Create a synthetic FeeRecord so it appears on Daily Sheets
    fee_rec = FeeRecord(
        student_id=student.id,
        fee_month="Initial Admission Balance",
        amount_due=admission_arrears,
        status="paid",
        payment_method=method,
        cleared_at=datetime.utcnow(),
        invoice_id=f"ADM-CLR-{student.id}-{int(datetime.utcnow().timestamp())}"
    )
    session.add(fee_rec)

    # Add History Log
    log = HistoryLog(
        student_id=student.id,
        event_text=f"Initial Admission Balance of Rs. {admission_arrears} paid via {method} during Clearance."
    )
    session.add(log)
    session.add(student)
    session.commit()

    return {"message": f"Admission balance of Rs. {admission_arrears} cleared via {method}"}


@router.post("/student/{student_id}/issue")
def issue_certificate(
    student_id: int,
    body: CertificateIssueRequest,
    session: Session = Depends(get_session)
):
    """
    Marks certificate(s) as issued on the student record.
    """
    student = session.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Merge with existing type
    existing = student.certificate_issued
    if existing and existing != body.cert_type:
        student.certificate_issued = "both"
    else:
        student.certificate_issued = body.cert_type

    student.certificate_issued_at = datetime.utcnow()
    if body.leaving_date:
        student.leaving_date = body.leaving_date
    if body.leaving_reason:
        student.leaving_reason = body.leaving_reason
    if body.conduct_remarks:
        student.conduct_remarks = body.conduct_remarks

    session.add(student)

    log = HistoryLog(
        student_id=student_id,
        event_text=f"{body.cert_type.title()} certificate issued on {datetime.utcnow().strftime('%Y-%m-%d')}."
    )
    session.add(log)
    session.commit()
    session.refresh(student)

    return {
        "message": f"{body.cert_type.title()} certificate issued successfully.",
        "certificate_issued": student.certificate_issued,
        "certificate_issued_at": student.certificate_issued_at
    }
