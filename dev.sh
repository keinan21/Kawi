#!/usr/bin/env bash
# Kendali dua dev server sekaligus: API FastAPI (:8000) + web Vite (:5173).
#
#   ./dev.sh start     nyalakan keduanya (background, log di var/dev/)
#   ./dev.sh stop      matikan keduanya (grup proses, aman untuk child --reload/vite)
#   ./dev.sh restart   stop lalu start
#   ./dev.sh status    cek hidup/mati + health check
#   ./dev.sh logs      tail -f kedua log
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="$ROOT/var/dev"
mkdir -p "$RUN"

API_PORT=8000
WEB_PORT=5173

pid_hidup() { # true bila PID ada & masih jalan
  [[ -n "${1:-}" ]] && kill -0 "$1" 2>/dev/null
}

baca_pid() { # baca pid file, kosong bila tidak ada
  local f="$RUN/$1.pid"
  [[ -f "$f" ]] && cat "$f" || true
}

cek_port() { # true bila ada yang listen di port
  ss -ltn 2>/dev/null | grep -q ":$1 "
}

tunggu_sehat() { # tunggu_url URL NAMA — poll sampai 200 atau 30s
  local url="$1" nama="$2" i
  for i in $(seq 1 60); do
    if curl -sf -o /dev/null "$url" 2>/dev/null; then
      echo "  ✓ $nama sehat — $url"
      return 0
    fi
    sleep 0.5
  done
  echo "  ✗ $nama tidak merespons dalam 30s — cek $RUN/$nama.log" >&2
  return 1
}

start() {
  local gagal=0

  # --- API ---
  if pid_hidup "$(baca_pid api)"; then
    echo "  • API sudah jalan (pid $(baca_pid api))"
  elif cek_port "$API_PORT"; then
    echo "  ! Port $API_PORT sudah terpakai proses lain — API dilewati" >&2
    gagal=1
  else
    echo "  • API  → :$API_PORT (log: var/dev/api.log)"
    (cd "$ROOT/api" && setsid nohup uv run uvicorn --app-dir src api.main:app --port "$API_PORT" \
      >"$RUN/api.log" 2>&1 </dev/null & echo $! >"$RUN/api.pid")
  fi

  # --- Web ---
  if pid_hidup "$(baca_pid web)"; then
    echo "  • Web  sudah jalan (pid $(baca_pid web))"
  elif cek_port "$WEB_PORT"; then
    echo "  ! Port $WEB_PORT sudah terpakai proses lain — web dilewati" >&2
    gagal=1
  else
    echo "  • Web  → :$WEB_PORT (log: var/dev/web.log)"
    (cd "$ROOT/web" && setsid nohup pnpm dev \
      >"$RUN/web.log" 2>&1 </dev/null & echo $! >"$RUN/web.pid")
  fi

  echo "  … menunggu health check"
  tunggu_sehat "http://localhost:$API_PORT/api/health" api || gagal=1
  tunggu_sehat "http://localhost:$WEB_PORT/" web || gagal=1

  if [[ $gagal -eq 0 ]]; then
    echo
    echo "Siap: web http://localhost:$WEB_PORT  ·  api http://localhost:$API_PORT"
  fi
  return $gagal
}

bunuh_pendengar() { # bunuh_pendengar PORT — bunuh proses yang masih listen di port (orphan)
  local port="$1" pid pgid
  for pid in $(ss -ltnpH "sport = :$port" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u); do
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
    if [[ -n "$pgid" ]]; then
      kill -TERM -- "-$pgid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    fi
  done
}

stop_satu() { # stop_satu NAMA PORT
  local nama="$1" port="$2" pid i
  pid="$(baca_pid "$nama")"
  if pid_hidup "$pid"; then
    echo "  • $nama (pid $pid) dimatikan"
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  else
    echo "  • $nama tidak jalan"
  fi
  rm -f "$RUN/$nama.pid"
  # orphan safety: kalau pid sudah mati tapi port masih nge-listen, bunuh pendengarnya
  for i in 1 2 3 4 5; do
    cek_port "$port" || return 0
    sleep 0.4
  done
  echo "  ! $nama masih menguasai port $port — dibersihkan"
  bunuh_pendengar "$port"
}

stop() {
  echo "Mematikan dev server…"
  stop_satu api "$API_PORT"
  stop_satu web "$WEB_PORT"
  sleep 1
  local nama pid
  for nama in api web; do
    pid="$(baca_pid "$nama")"
    if pid_hidup "$pid"; then
      kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
      echo "  ! $nama dipaksa mati"
    fi
  done
  echo "Selesai."
}

status() {
  local nama pid
  for nama in api web; do
    pid="$(baca_pid "$nama")"
    if pid_hidup "$pid"; then
      echo "  ✓ $nama — hidup (pid $pid)"
    else
      echo "  ✗ $nama — mati"
    fi
  done
  if curl -sf -o /dev/null "http://localhost:$API_PORT/api/health" 2>/dev/null; then
    echo "  ✓ api /api/health → 200"
  fi
  if curl -sf -o /dev/null "http://localhost:$WEB_PORT/" 2>/dev/null; then
    echo "  ✓ web http://localhost:$WEB_PORT → 200"
  fi
}

case "${1:-}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; start ;;
  status)  status ;;
  logs)    tail -f "$RUN/api.log" "$RUN/web.log" ;;
  *)
    echo "Pemakaian: ./dev.sh {start|stop|restart|status|logs}" >&2
    exit 64
    ;;
esac
