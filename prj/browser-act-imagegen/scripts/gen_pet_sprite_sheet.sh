#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SESS="${SESS:-pet-sprite-sheet}"
BID="${BID:-}"
PROMPT_FILE="$ROOT/prj/汉字泡泡跑酷/assets/generated/reference/pet-sprite-chatgpt-current-prompt.txt"
OUT_DIR="$ROOT/prj/汉字泡泡跑酷/assets/generated/reference"
OUT_PNG="$OUT_DIR/pet-sprite-sheet-chatgpt.png"
TMP_B64="${TMP_B64:-${TMPDIR:-/tmp}/pet_sprite_sheet.b64}"

if [ -z "$BID" ]; then
  echo "FAIL BID is empty. Export BID=<browser-act browser id> before running."
  exit 2
fi

echo "=== open chatgpt ==="
browser-act --session "$SESS" browser open "$BID" "https://chatgpt.com" --allow-restart-chrome 2>&1 | tail -3 || true
sleep 8
browser-act --session "$SESS" wait stable --timeout 120000 2>&1 | tail -1 || true

echo "=== locate composer ==="
TA="$(browser-act --session "$SESS" state 2>&1 | grep 'prompt-textarea' | grep -oE '\[[0-9]+\]' | head -1 | tr -d '[]')"
if [ -z "$TA" ]; then
  echo "FAIL no prompt textarea"
  exit 2
fi
echo "textarea index: $TA"

N0="$(browser-act --session "$SESS" eval --stdin <<'JEOF0'
[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content')).length
JEOF0
)"
echo "existing estuary images: $N0"

PROMPT="$(python - <<PY
from pathlib import Path
p = Path(r"$PROMPT_FILE").read_text(encoding="utf-8")
print("Generate this as an image, not as text.\\n\\n" + p)
PY
)"

echo "=== send prompt ==="
browser-act --session "$SESS" input "$TA" "$PROMPT" >/dev/null
sleep 1
browser-act --session "$SESS" keys "Enter" >/dev/null

echo "=== wait new image ==="
URL="WAIT"
for a in $(seq 1 40); do
  sleep 12
  RES="$(browser-act --session "$SESS" eval --stdin <<JEOF1
(async()=>{const arr=[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content'));return arr.length>${N0}?arr[arr.length-1].src:'WAIT'})()
JEOF1
)"
  if [ "$RES" != "WAIT" ] && [ -n "$RES" ]; then
    URL="$RES"
    echo "image after ${a} polls"
    break
  fi
  echo "poll $a: wait"
done

if [ "$URL" = "WAIT" ]; then
  echo "FAIL no new image"
  exit 3
fi

echo "=== fetch generated png in browser ==="
B64LEN="$(browser-act --session "$SESS" eval --stdin <<'JEOF2'
(async()=>{try{const arr=[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content'));const u=arr[arr.length-1].src;const r=await fetch(u);if(!r.ok)return 'ERR:'+r.status;const b=await r.blob();const bmp=await createImageBitmap(b);const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;c.getContext('2d').drawImage(bmp,0,0);const png=await new Promise(res=>c.toBlob(res,'image/png'));const f=new FileReader();const d=await new Promise(res=>{f.onload=()=>res(f.result);f.readAsDataURL(png)});sessionStorage.setItem('pet_sprite_png',d.split(',')[1]);return d.split(',')[1].length}catch(e){return 'EXC:'+e.message}})()
JEOF2
)"
if ! [[ "$B64LEN" =~ ^[0-9]+$ ]]; then
  echo "FAIL png base64 length: $B64LEN"
  exit 4
fi
echo "base64 length: $B64LEN"

: > "$TMP_B64"
OFF=0
while [ "$OFF" -lt "$B64LEN" ]; do
  END=$((OFF+40000))
  [ "$END" -gt "$B64LEN" ] && END="$B64LEN"
  SEG="$(browser-act --session "$SESS" eval "sessionStorage.getItem('pet_sprite_png').slice($OFF,$END)" 2>&1)"
  printf '%s' "$SEG" >> "$TMP_B64"
  OFF="$END"
done

mkdir -p "$OUT_DIR"
base64 -d "$TMP_B64" > "$OUT_PNG"
echo "OK $OUT_PNG $(wc -c < "$OUT_PNG")B"
