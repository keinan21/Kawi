"""Template prompt tahap ASSESS / Penilaian AI (DESIGN.md §6 langkah 6).

Satu panggilan terstruktur menghasilkan tiga skor aspek + ringkasan Bahasa
Indonesia. `skor_total` dari model **tidak dipercaya** — `assess.py` selalu
menghitung ulang dari tiga skor aspek (aturan recompute-don't-trust).
"""

from __future__ import annotations

from api.core.enums import QuestionType

MIN_RINGKASAN_CHARS = 20
MAX_RINGKASAN_CHARS = 900


def assess_prompt(*, brief: str, pairs: list[tuple[QuestionType, str, str]]) -> str:
    """Prompt penilaian; `pairs` = [(tipe, teks pertanyaan, teks jawaban)]."""
    blocks = []
    for index, (tipe, question, answer) in enumerate(pairs, start=1):
        blocks.append(
            f"[{index}] tipe: {tipe.value}\n"
            f"    pertanyaan: {question}\n"
            f"    jawaban murid: {answer}"
        )
    return (
        "TUGASMU: nilai apakah jawaban Murid menunjukkan bahwa dia benar-benar "
        "memahami karyanya sendiri.\n\n"
        "ATURAN SKOR (0-100 per aspek)\n"
        "100 = spesifik, detail, dan konsisten dengan isi unggahan.\n"
        "70-99 = benar tapi kurang detail.\n"
        "40-69 = umum, dangkal, atau separuh benar.\n"
        "1-39 = tidak menjawab, mengada-ada, atau bertentangan dengan materi.\n"
        "0 = kosong atau sama sekali tidak menjawab.\n\n"
        "ATURAN MENILAI\n"
        "1. Nilai tiap pertanyaan pada aspek tipenya sendiri.\n"
        "2. Jangan memberi nilai berdasarkan kualitas tulisan atau niat baik; "
        "hanya isi jawaban yang dinilai.\n"
        "3. Jawaban singkat tapi tepat tetap tinggi; jawaban panjang tapi "
        "mengambang tetap rendah.\n"
        "4. Kalau jawaban memuat fakta yang tidak ada di materi, skor maksimal "
        "40.\n"
        "5. Tulis `ringkasan` dalam Bahasa Indonesia: 2-4 kalimat untuk Guru, "
        "sebutkan pola jawaban Murid pada tiap aspek dan kelemahannya. Jangan "
        "berikan nilai di dalam ringkasan.\n\n"
        f"BRIEF DARI GURU\n---\n{brief}\n---\n\n"
        "PERTANYAAN DAN JAWABAN MURID\n---\n" + "\n".join(blocks) + "\n---"
    )