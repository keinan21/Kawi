# Assignment Integrity Form

Web app for collecting student assignments where the system verifies the student actually understands their own work, via locked-down submission sessions and AI-generated comprehension questions.

## Language

### People & Roles

**Guru**:
A user who creates assignments, monitors student activity, and decides whether a student may re-submit.
_Avoid_: Teacher, dosen, admin

**Murid**:
A user who completes an assignment inside a locked session and answers AI questions about it.
_Avoid_: Student, siswa, peserta

### Core Concepts

**Tugas**:
An assignment created by a Guru, consisting of a prompt/requirements and a submission window. Distributed via a shareable link, Google-Forms style — anyone with the link who logs in may start a Sesi.
_Avoid_: PR, pekerjaan, soal

**Sesi**:
The single locked session in which a Murid uploads their work and answers the AI questions. One Sesi per Murid per Tugas unless the Guru unlocks it. The answer timer starts only after the Unggahan is uploaded.
_Avoid_: Exam, ujian, attempt

**Pelanggaran**:
A recorded integrity event during a Sesi: leaving the tab, exiting fullscreen, or losing window focus. Visible to the Guru on the dashboard. Each Pelanggaran starts a countdown; an unheeded countdown ends the Sesi with an auto-submit.
_Avoid_: Warning, flag, cheat event

**Unggahan**:
The file (PDF or PPT) a Murid submits in a Sesi. Upload is one-shot; re-upload requires a Guru unlock.
_Avoid_: Submission, file, upload

**Izin Unggah Ulang**:
A Guru-granted permission that reopens a Murid's Sesi and allows a new Unggahan. Previous AI questions are discarded and regenerated for the new file.
_Avoid_: Retry, reset, edit

### AI Question Types

Each Unggahan is analyzed by AI, which generates questions in three types. All three must be answered by the Murid in the same Sesi.

**Pertanyaan Ideasi**:
Probes whether the idea in the Unggahan is the Murid's own — origin, inspiration, and what they changed.
_Avoid_: Originality check, brainstorming

**Pertanyaan Isi**:
Proves the Murid actually did the work — asks about specific details, decisions, and trade-offs inside the Unggahan.
_Avoid_: Comprehension, content check

**Pertanyaan Harapan**:
Tests whether the Murid has a future vision for their work — intended impact, next steps, who it serves.
_Avoid_: Reflection, feedback

**Penilaian AI**:
An assistive score and written assessment of a Murid's answers, shown only to the Guru as a confidential signal. The Guru remains the final judge of the real grade.
_Avoid_: Auto-grade, verdict
