// Hand-mirrored to api/src/api/core/enums.py — keep in sync (DESIGN.md §8).

/** Jenis Pelanggaran yang dilaporkan modul proctor (DESIGN.md §7). */
export type PelanggaranType =
  | 'tab_switch'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'copy_blocked'
  | 'paste_blocked'
  | 'context_menu_blocked'
  | 'shortcut_blocked'
  | 'multi_tab';

/** Status Sesi pada state machine (DESIGN.md §3). */
export type SessionStatus =
  | 'created'
  | 'generating'
  | 'answering'
  | 'submitted'
  | 'auto_submitted';

/** Tipe Pertanyaan yang di-generate AI (DESIGN.md §6). */
export type QuestionType = 'ideasi' | 'isi' | 'harapan';
