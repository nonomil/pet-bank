#!/usr/bin/env bash
set -u
SESS=bgpvz
BID=direct_local_104575322441121996
WORK="/c/Users/No'mi'l/AppData/Local/Temp"

declare -A PROMPT
PROMPT[arena-stone]="Ancient Roman colosseum ruins arena, crumbling stone pillars and arches, weathered marble floor with moss, torches on broken columns, dramatic sunset light through ruins, grand epic atmosphere, wide 1920x1080 game background, fantasy illustration, no text, no watermark, no characters."

PROMPT[arena-crystal]="Underground crystal cave arena, giant glowing amethyst and purple crystals forming natural walls, bioluminescent blue pools reflecting on crystal surfaces, geode ceiling with star-like sparkles, mystical epic atmosphere, wide 1920x1080 game background, fantasy illustration, no text, no watermark, no characters."

PROMPT[arena-storm]="Floating platform arena on a mountain peak above storm clouds, lightning bolts striking nearby floating rocks, dark purple storm clouds swirling, ancient stone platform with glowing rune circles, epic dramatic atmosphere, wide 1920x1080 game background, fantasy illustration, no text, no watermark, no characters."

PROMPT[arena-lava]="Volcano forge arena inside an active volcano, rivers of molten lava flowing along the sides, obsidian rock platform with glowing orange cracks, massive anvil and forge structures, intense heat haze and ember particles, epic fiery atmosphere, wide 1920x1080 game background, fantasy illustration, no text, no watermark, no characters."

PROMPT[arena-ice]="Frozen glacial arena in polar landscape, massive ice pillars and crystal formations, frozen lake surface with frost cracks, aurora borealis in the night sky, snow-covered stone platform, cold epic atmosphere, wide 1920x1080 game background, fantasy illustration, no text, no watermark, no characters."

PROMPT[arena-void]="Cosmic void arena floating in deep space, swirling purple and blue nebula clouds, distant galaxies and stars, floating crystalline platform with glowing edges, wormhole vortex in the center, epic mysterious atmosphere, wide 1920x1080 game background, fantasy illustration, no text, no watermark, no characters."

ORDER="arena-stone arena-crystal arena-storm arena-lava arena-ice arena-void"

echo "=== open + wait chatgpt ==="
browser-act --session $SESS browser open $BID "https://chatgpt.com" 2>&1 | tail -2 || echo "(open finished)"
sleep 5
browser-act --session $SESS eval "window.location.href='https://chatgpt.com/'" 2>/dev/null || true
sleep 5
browser-act --session $SESS wait stable --timeout 120000 2>&1 | tail -1 || echo "(wait skipped)"
echo "session ready"

for PET in $ORDER; do
  echo "===== $PET ====="
  browser-act --session $SESS eval "window.location.href='https://chatgpt.com/'" 2>/dev/null
  sleep 3
  browser-act --session $SESS wait stable --timeout 30000 2>&1 | tail -1

  TA=$(browser-act --session $SESS state 2>&1 | grep 'prompt-textarea' | grep -oE '\[[0-9]+\]' | head -1 | tr -d '[]')
  [ -z "$TA" ] && { echo "FAIL $PET no-textarea"; continue; }

  N0=$(browser-act --session $SESS eval --stdin <<'JEOF0'
[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content')).length
JEOF0
)
  echo "existing images: $N0"
  browser-act --session $SESS input "$TA" "${PROMPT[$PET]}" >/dev/null 2>&1
  sleep 1
  browser-act --session $SESS keys "Enter" >/dev/null 2>&1

  URL=WAIT
  for a in $(seq 1 30); do
    sleep 12
    RES=$(browser-act --session $SESS eval --stdin <<JEOF1
(async()=>{const arr=[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content'));return arr.length>${N0}?arr[arr.length-1].src:'WAIT'})()
JEOF1
)
    [ "$RES" != "WAIT" ] && [ -n "$RES" ] && { URL="$RES"; echo "image after ${a} polls"; break; }
  done
  [ "$URL" = "WAIT" ] && { echo "FAIL $PET no-image"; continue; }

  B64LEN=$(browser-act --session $SESS eval --stdin <<JEOF2
(async()=>{try{const arr=[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content'));const u=arr[arr.length-1].src;const r=await fetch(u);if(!r.ok)return 'ERR';const b=await r.blob();const bmp=await createImageBitmap(b);const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;c.getContext('2d').drawImage(bmp,0,0);const w=await new Promise(res=>c.toBlob(res,'image/webp',0.92));const f=new FileReader();const d=await new Promise(res=>{f.onload=()=>res(f.result);f.readAsDataURL(w)});sessionStorage.setItem('imgwebp',d.split(',')[1]);return d.split(',')[1].length}catch(e){return 'EXC'}})()
JEOF2
)
  [[ "$B64LEN" =~ ^[0-9]+$ ]] || { echo "FAIL $PET webp($B64LEN)"; continue; }
  : > "$WORK/arena_$PET.b64"
  OFF=0
  while [ $OFF -lt $B64LEN ]; do
    END=$((OFF+40000)); [ $END -gt $B64LEN ] && END=$B64LEN
    SEG=$(browser-act --session $SESS eval "sessionStorage.getItem('imgwebp').slice($OFF,$END)" 2>&1)
    printf '%s' "$SEG" >> "$WORK/arena_$PET.b64"
    OFF=$END
  done
  base64 -d "$WORK/arena_$PET.b64" > "$WORK/arena_$PET.webp" 2>/dev/null
  echo "OK $PET $(wc -c < "$WORK/arena_$PET.webp")B"
done

echo "=== converting to PNG + saving ==="
python -c "
from PIL import Image
import os
import tempfile; WORK = tempfile.gettempdir()
PROJ = r'g:\\StudyCode\\宠物积分系统\\assets\\arena'
import glob
for f in sorted(glob.glob(os.path.join(WORK, 'arena_*.webp'))):
    name = os.path.basename(f).replace('.webp','')
    im = Image.open(f)
    out_webp = os.path.join(PROJ, name + '.webp')
    out_png = os.path.join(PROJ, name + '.png')
    im.save(out_webp, 'WEBP', quality=92)
    im.save(out_png, 'PNG')
    print(f'{name}: {im.size} -> WEBP({os.path.getsize(out_webp)}B) + PNG({os.path.getsize(out_png)}B)')
print('done')
"
