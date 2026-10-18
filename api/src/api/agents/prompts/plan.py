"""Template prompt tahap PLAN (DESIGN.md §6 langkah 2).

Satu panggilan LLM tanpa tool: `{brief, doc_markdown}` -> tiga template
`[{type, angle, alasan}]`. Angle wajib berbeda antar tipe; duplikat ditolak
oleh `pipeline.validate_plan` lalu di-plan ulang satu kali.
"""

from __future__ import annotations

from api.core.enums import QuestionType

# Panduan per tipe Pertanyaan (CONTEXT.md: tiga tipe, masing-masing satu butir).
TYPE_GUIDANCE_ID: dict[str, str] = {
    QuestionType.IDEASI.value: (
        "ideasi — asal-usul ide dan inspirasinya: dari mana ide itu berasal, "
        "apa yang menjadi inspirasi, bagian mana yang direvisi sendiri."
    ),
    QuestionType.ISI.value: (
        "isi — bukti pengerjaan di dalam dokumen: keputusan yang diambil, angka "
        "dan data yang dipakai, struktur yang dipilih, trade-off yang diambil."
    ),
    QuestionType.HARAPAN.value: (
        "harapan — dampak dan langkah berikutnya: siapa yang memakai karya ini, "
        "apa rencana selanjutnya, hasil apa yang ingin dicapai."
    ),
}


def type_guidance_block() -> str:
    """Blok panduan tipe pertanyaan, disusun sesuai urutan enum."""
    lines = [
        f"- {QuestionType.IDEASI.value}: {TYPE_GUIDANCE_ID[QuestionType.IDEASI.value]}",
        f"- {QuestionType.ISI.value}: {TYPE_GUIDANCE_ID[QuestionType.ISI.value]}",
        f"- {QuestionType.HARAPAN.value}: {TYPE_GUIDANCE_ID[QuestionType.HARAPAN.value]}",
    ]
    return "\n".join(lines)


def plan_prompt(
    *,
    brief: str,
    doc_markdown: str,
    feedback: str | None = None,
    questions_per_type: int = 1,
) -> str:
    """Prompt tahap plan.

    `feedback` diisi saat plan ulang (satu kali) karena angle sebelumnya bentrok.
    `questions_per_type` bawaan Tugas; default 1 -> tiga template (DESIGN.md §6).
    """
    per_type = max(1, int(questions_per_type))
    total = per_type * len(QuestionType)
    retry = ""
    if feedback:
        retry = (
            "\n\nPERCOBAAN SEBELUMNYA DITOLAK karena: "
            f"{feedback}\n"
            "Perbaiki sekarang: ganti sudut pandang yang bentrok dengan "
            "perspektif lain yang benar-benar terdukung materi."
        )
    return (
        "TUGASMU: susun rencana pertanyaan, satu untuk setiap tipe dan setiap "
        "slot yang diminta.\n\n"
        f"PANDUAN TIPE PERTANYAAN\n{type_guidance_block()}\n\n"
        f"JUMLAH\nTepat {total} template: {per_type} untuk ideasi, {per_type} "
        f"untuk isi, dan {per_type} untuk harapan.\n\n"
        "ATURAN\n"
        "1. Jumlah template per tipe harus persis seperti diminta; tidak boleh "
        "ada tipe yang kurang atau dobel.\n"
        "2. `angle` adalah sudut pandang spesifik yang TERDUKUNG materi, bukan "
        "pertanyaan umum. Semua `angle` wajib berbeda satu sama lain, bukan "
        "hanya berbeda kata.\n"
        "3. `alasan` menjelaskan dalam satu kalimat kenapa sudut itu bagus dan "
        "bisa dijawab dari materi.\n"
        "4. Jangan menulis kalimat pertanyaan yang sudah jadi — baru di tahap "
        "generate.\n\n"
        f"BRIEF DARI GURU\n---\n{brief}\n---\n\n"
        f"MATERI UNGGAHAN (hasil ekstraksi ke markdown)\n---\n{doc_markdown}\n---"
        f"{retry}"
    )