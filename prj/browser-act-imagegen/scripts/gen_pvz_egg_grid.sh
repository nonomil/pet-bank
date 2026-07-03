#!/usr/bin/env bash
set -u
SESS=bgpvz
BID=direct_local_104575322441121996
WORK="/c/Users/No'mi'l/AppData/Local/Temp"

# SUFFIX
STYLE="official Plants vs Zombies cartoon game render style, clean white background, thick black outlines, vibrant saturated colors, no text, no watermark."

# Grid prompts: each batch generates a 3×2 grid
declare -A GRID
GRID[batch1]="Generate a 3x2 grid showing 6 different eggs on pure white background:

1. Cherry Bomb egg - small cherry-red egg with angry face patterns and black fuse details, twin cherry shapes fused together
2. Potato Mine egg - small brown egg with crack patterns resembling potato eyes, with a tiny fuse stem on top
3. Chomper egg - green egg with tooth-like patterns running down the shell, with small purple spots
4. Jalapeno egg - bright red elongated egg with flame patterns on the shell, green stem cap on top
5. Magnet-shroom egg - small purple mushroom egg with magnet-shaped patterns on the shell, tiny red cap
6. Hypno-shroom egg - small purple-pink egg with spiral hypnotic patterns on the shell, tiny mushroom cap

Each egg should be centered in its grid cell, PVZ cartoon style, thick black outlines, vibrant colors, white background, no text, no watermark."

GRID[batch2]="Generate a 3x2 grid showing 6 different eggs on pure white background:

1. Ice-shroom egg - small icy blue egg with frost patterns on the shell, tiny mushroom cap with ice crystals
2. Sun-shroom egg - small golden-yellow egg with glowing sun patterns on the shell, tiny mushroom cap
3. Basic Zombie egg - gray-green egg with tattered zombie face patterns on the shell, cracked and worn texture
4. Conehead Zombie egg - gray-green egg with an orange traffic cone pattern on top, zombie crack patterns
5. Buckethead Zombie egg - gray-green egg with a silver bucket pattern on top, cracked zombie shell
6. Flag Zombie egg - gray-green egg with a small red flag pattern on top, zombie crack patterns on shell

Each egg should be centered in its grid cell, PVZ cartoon style, thick black outlines, vibrant colors, white background, no text, no watermark."

GRID[batch3]="Generate a 3x2 grid showing 6 different eggs on pure white background:

1. Pole Vaulting Zombie egg - gray-green egg with a long pole pattern across the shell, athletic zombie markings
2. Dancing Zombie egg - gray-green egg with disco patterns, sunglasses and microphone marks on the shell
3. Backup Dancer egg - gray-green egg with dance move patterns on the shell, backup dancer silhouette
4. Football Zombie egg - gray-green egg with a red football helmet pattern on top, bulky cracked shell
5. Gargantuar egg - massive dark gray-green egg with angry face patterns, cracked shell, tiny imp mark on top
6. Imp egg - tiny gray-green egg with mischievous face pattern on the shell, small and cracked

Each egg should be centered in its grid cell, PVZ cartoon style, thick black outlines, vibrant colors, white background, no text, no watermark."

GRID[batch4]="Generate a 2x2 grid showing 4 different eggs on pure white background:

1. Balloon Zombie egg - gray-green egg with a balloon pattern tied to the top, floating zombie marks
2. Screen Door Zombie egg - gray-green egg with a screen door pattern covering the front, zombie shell texture
3. Giga Gargantuar egg - massive dark egg with red glowing eye patterns and giant cracked shell, menacing face
4. Dr. Zomboss egg - dark egg with lab coat and machinery patterns, robotic details on the shell, green glowing eye

Each egg should be centered in its grid cell, PVZ cartoon style, thick black outlines, vibrant colors, white background, no text, no watermark."

# Actual species order per batch (matched to grid positions left→right, top→bottom)
BATCH1_ORDER="cherrybomb potatomine chomper jalapeno magnetshroom hypnoshroom"
BATCH2_ORDER="iceshroom sunshroom zombie coneheadzombie bucketheadzombie flagzombie"
BATCH3_ORDER="polevaultingzombie dancingzombie backupdancer footballzombie gargantuar imp"
BATCH4_ORDER="balloonzombie screendoorzombie gigagargantuar drzomboss"

echo "=== create session + open chatgpt ==="
browser-act --session $SESS browser open $BID "https://chatgpt.com" 2>&1 | tail -2
browser-act --session $SESS wait stable --timeout 60000 2>&1 | tail -1

for BATCH in batch1 batch2 batch3 batch4; do
  echo "===== $BATCH ====="

  # 1) New chat to clear context
  browser-act --session $SESS eval "window.location.href='https://chatgpt.com/'" 2>/dev/null
  sleep 3
  browser-act --session $SESS wait stable --timeout 30000 2>&1 | tail -1

  # 2) Find textarea
  TA=$(browser-act --session $SESS state 2>&1 | grep 'prompt-textarea' | grep -oE '\[[0-9]+\]' | head -1 | tr -d '[]')
  [ -z "$TA" ] && { echo "FAIL $BATCH no-textarea"; continue; }

  # 3) Count existing images
  N0=$(browser-act --session $SESS eval --stdin <<'JEOF0'
[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content')).length
JEOF0
)
  echo "existing images: $N0"

  # 4) Submit prompt
  PROMPT="${GRID[$BATCH]}"
  browser-act --session $SESS input "$TA" "$PROMPT" >/dev/null 2>&1
  sleep 1
  browser-act --session $SESS keys "Enter" >/dev/null 2>&1

  # 5) Poll for new image
  URL=WAIT
  for a in $(seq 1 30); do
    sleep 12
    RES=$(browser-act --session $SESS eval --stdin <<JEOF1
(async()=>{const arr=[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content'));return arr.length>${N0}?arr[arr.length-1].src:'WAIT'})()
JEOF1
)
    [ "$RES" != "WAIT" ] && [ -n "$RES" ] && { URL="$RES"; echo "image after ${a} polls"; break; }
  done
  [ "$URL" = "WAIT" ] && { echo "FAIL $BATCH no-image"; continue; }

  # 6) Download as webp via canvas
  B64LEN=$(browser-act --session $SESS eval --stdin <<JEOF2
(async()=>{try{const arr=[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content'));const u=arr[arr.length-1].src;const r=await fetch(u);if(!r.ok)return 'ERR';const b=await r.blob();const bmp=await createImageBitmap(b);const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;c.getContext('2d').drawImage(bmp,0,0);const w=await new Promise(res=>c.toBlob(res,'image/webp',0.92));const f=new FileReader();const d=await new Promise(res=>{f.onload=()=>res(f.result);f.readAsDataURL(w)});sessionStorage.setItem('imgwebp',d.split(',')[1]);return d.split(',')[1].length}catch(e){return 'EXC'}})()
JEOF2
)
  [[ "$B64LEN" =~ ^[0-9]+$ ]] || { echo "FAIL $BATCH webp($B64LEN)"; continue; }
  : > "$WORK/pvzgrid_${BATCH}.b64"
  OFF=0
  while [ $OFF -lt $B64LEN ]; do
    END=$((OFF+40000)); [ $END -gt $B64LEN ] && END=$B64LEN
    SEG=$(browser-act --session $SESS eval "sessionStorage.getItem('imgwebp').slice($OFF,$END)" 2>&1)
    printf '%s' "$SEG" >> "$WORK/pvzgrid_${BATCH}.b64"
    OFF=$END
  done
  base64 -d "$WORK/pvzgrid_${BATCH}.b64" > "$WORK/pvzgrid_${BATCH}.webp" 2>/dev/null
  echo "OK $BATCH $(wc -c < "$WORK/pvzgrid_${BATCH}.webp")B"
done

echo "=== crop grid → individual eggs → keyout ==="
python "C:/Users/No'mi'l/AppData/Local/Temp/crop_pvz_egg_grid.py"
