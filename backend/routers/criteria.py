from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from database import get_session
from auth import verify_credentials
from models import CriteriaSetting, CriteriaSettingCreate, CriteriaSettingRead

router = APIRouter(prefix="/criteria", tags=["criteria"])


@router.get("", response_model=List[CriteriaSettingRead])
def list_criteria(
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    return session.exec(select(CriteriaSetting)).all()


@router.post("", response_model=CriteriaSettingRead, status_code=201)
def create_criterion(
    payload: CriteriaSettingCreate,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    # Prevent duplicate class names
    existing = session.exec(
        select(CriteriaSetting).where(CriteriaSetting.class_name == payload.class_name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A rule for class '{payload.class_name}' already exists. Use PUT to update it."
        )
    if payload.min_age_years >= payload.max_age_years:
        raise HTTPException(status_code=422, detail="min_age_years must be less than max_age_years")
    criterion = CriteriaSetting.from_orm(payload)
    session.add(criterion)
    session.commit()
    session.refresh(criterion)
    return criterion


@router.put("/{criterion_id}", response_model=CriteriaSettingRead)
def update_criterion(
    criterion_id: int,
    payload: CriteriaSettingCreate,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    criterion = session.get(CriteriaSetting, criterion_id)
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found")
    if payload.min_age_years >= payload.max_age_years:
        raise HTTPException(status_code=422, detail="min_age_years must be less than max_age_years")
    criterion.class_name = payload.class_name
    criterion.min_age_years = payload.min_age_years
    criterion.max_age_years = payload.max_age_years
    session.commit()
    session.refresh(criterion)
    return criterion


@router.delete("/{criterion_id}", status_code=204)
def delete_criterion(
    criterion_id: int,
    session: Session = Depends(get_session),
    _user: str = Depends(verify_credentials),
):
    criterion = session.get(CriteriaSetting, criterion_id)
    if not criterion:
        raise HTTPException(status_code=404, detail="Criterion not found")
    session.delete(criterion)
    session.commit()
