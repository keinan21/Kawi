"""Tabel `pertanyaan` + `jawaban` — DESIGN.md §4, §6.

`evidence` = kutipan persis dari Unggahan, disimpan untuk audit Guru dan
TIDAK PERNAH di-serialize ke payload API Murid (DESIGN.md §6 langkah 5).
"""

from __future__ import annotations

from sqlalchemy import Enum as SAEnum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.enums import QuestionType
from api.core.models.base import Base, IdMixin
from api.core.models.tugas import QUESTIONS_PER_TYPE_DEFAULT


class Pertanyaan(IdMixin, Base):
    __tablename__ = "pertanyaan"
    __table_args__ = (
        Index("ix_pertanyaan_session_seq", "session_id", "seq"),
        UniqueConstraint("session_id", "type", "seq", name="uq_pertanyaan_session_type_seq"),
    )

    session_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[QuestionType] = mapped_column(
        SAEnum(
            QuestionType,
            name="question_type",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
            native_enum=False,
            validate_strings=True,
            length=16,
        ),
        nullable=False,
    )
    seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)

    sesi: Mapped["SessionRow"] = relationship(back_populates="pertanyaan")  # noqa: F821
    jawaban: Mapped["Jawaban | None"] = relationship(  # noqa: F821
        back_populates="pertanyaan",
        cascade="all, delete-orphan",
        uselist=False,
    )


class Jawaban(IdMixin, Base):
    __tablename__ = "jawaban"

    pertanyaan_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("pertanyaan.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)

    pertanyaan: Mapped[Pertanyaan] = relationship(back_populates="jawaban")


def expected_question_count(questions_per_type: int = QUESTIONS_PER_TYPE_DEFAULT) -> int:
    """Jumlah Pertanyaan yang harus siap sebelum Sesi boleh `answering`."""
    return len(QuestionType) * max(1, questions_per_type)