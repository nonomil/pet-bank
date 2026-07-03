#!/usr/bin/env bash
set -u
SESS=bgpvz
BID=direct_local_104575322441121996
WORK="/c/Users/No'mi'l/AppData/Local/Temp"

STYLE="adorable cute baby pet style, minimal vector art, clean white background, thick outlines, vibrant colors, no text, no watermark."

declare -A GRID

GRID[batch1]="Generate a 3x2 grid showing 6 different cute pet eggs on pure white background:

1. Tiny round egg with soft kitten patterns, little cat ears on top, small paw prints on the shell
2. Round egg with sweet puppy face patterns, floppy ears on the sides, bone-shaped spots
3. Oval egg with bunny patterns, long ears extending from the top, fluffy tail mark on back
4. Small round egg with hamster cheek patterns, tiny paw prints, little seed decorations
5. Round egg with teddy bear patterns, small rounded ears on top, honey drop spots
6. Egg with fox face patterns, pointed ears on top, orange and white swirl patterns

Each egg centered in its grid cell, adorable cute cartoon style, clean white background, thick outlines, vibrant colors, no text, no watermark."

GRID[batch2]="Generate a 3x2 grid showing 6 different cute pet eggs on pure white background:

1. Round egg with raccoon mask patterns around the middle, little stripe tail marks
2. Round egg with panda face patterns, black eye patches, little bamboo leaf marks
3. Scaly egg with tiny dragon patterns, small wing ridges on the sides, golden sparkles
4. Magical egg with unicorn horn on top, rainbow swirls on the shell, star decorations
5. Delicate egg with fairy wing patterns, shimmering dots, tiny flower decorations
6. Faceted crystal egg shape with geometric patterns, prismatic light reflections

Each egg centered in its grid cell, adorable cute cartoon style, clean white background, thick outlines, vibrant colors, no text, no watermark."

GRID[batch3]="Generate a 3x2 grid showing 6 different cute pet eggs on pure white background:

1. Flame-patterned egg with phoenix wing marks, red and gold swirls, tiny flame tips
2. Egg with moon and rabbit patterns, crescent moon marks, starry dots
3. Cosmic egg with constellation patterns, tiny stars and shooting star marks
4. Colorful egg with rainbow scales, tiny dragon wings, colorful swirls
5. Small egg with chick patterns, little beak mark, tiny feather patterns
6. Smooth round egg with cute frog patterns, little lily pad marks, big eye spots

Each egg centered in its grid cell, adorable cute cartoon style, clean white background, thick outlines, vibrant colors, no text, no watermark."

GRID[batch4]="Generate a 3x2 grid showing 6 different cute pet eggs on pure white background:

1. Textured egg with baby dinosaur patterns, small spike ridges, tiny claw marks
2. Tough egg with T-Rex patterns, jagged ridge along the top, tiny fierce face marks
3. Serpentine egg with dragon scale patterns, wave and cloud marks
4. Dark egg with bat wing patterns folded on the shell, tiny fang marks
5. Pale translucent-looking egg with ghostly face patterns, wispy swirls
6. Bone-colored egg with skeleton dragon patterns, skull marks, ribcage lines

Each egg centered in its grid cell, adorable cute cartoon style, clean white background, thick outlines, vibrant colors, no text, no watermark."

GRID[batch5]="Generate a 3x2 grid showing 6 different sci-fi pet eggs on pure white background:

1. Metallic egg with rivet patterns, circuit board lines, glowing blue dots
2. Strange egg with alien patterns, glowing green marks, tiny antenna on top
3. Streamlined egg with rocket fin patterns, flame marks at the bottom
4. Saucer-shaped egg with UFO window patterns, tiny antenna, glowing ring marks
5. Armored egg with mechanical panels, gear patterns, rivet details
6. Glowing egg with energy pulse patterns, lightning bolt marks, luminous swirls

Each egg centered in its grid cell, sci-fi cute cartoon style, clean white background, thick outlines, vibrant colors, no text, no watermark."

GRID[batch6]="Generate a 3x2 grid showing 6 different pet eggs on pure white background:

1. Cosmic egg with nebula patterns, tiny dragon silhouette, galaxy swirls
2. Cybernetic egg with neon circuit patterns, dragon scale hexagons, glowing lines
3. Large round egg with giant panda patterns, bamboo leaf marks, fluffy cloud spots
4. Ornate egg with golden dragon scale patterns, pearl marks, cloud swirls
5. Beautiful egg with peacock feather patterns, eye-shaped spots, golden details
6. Graceful egg with deer patterns, antler marks on top, woodland leaf decorations

Each egg centered in its grid cell, cute cartoon style, clean white background, thick outlines, vibrant colors, no text, no watermark."

GRID[batch7]="Generate a 2x2 grid showing 4 different Chinese-style pet eggs on pure white background:

1. Lucky egg with Chinese auspicious beast patterns, cloud and coin marks
2. Theatrical egg with opera mask patterns, vibrant color blocks, tassel marks
3. Delicate egg with cherry blossom patterns, tiny dragon winding around, petal marks
4. Majestic golden egg with imperial dragon scale patterns, treasure marks, red accents

Each egg centered in its grid cell, Chinese folklore cute cartoon style, clean white background, thick outlines, vibrant colors, no text, no watermark."

echo "=== create session + open chatgpt ==="
browser-act --session $SESS browser open $BID "https://chatgpt.com" 2>&1 | tail -2
browser-act --session $SESS wait stable --timeout 60000 2>&1 | tail -1

for BATCH in batch1 batch2 batch3 batch4 batch5 batch6 batch7; do
  echo "===== $BATCH ====="
  browser-act --session $SESS eval "window.location.href='https://chatgpt.com/'" 2>/dev/null
  sleep 3
  browser-act --session $SESS wait stable --timeout 30000 2>&1 | tail -1

  TA=$(browser-act --session $SESS state 2>&1 | grep 'prompt-textarea' | grep -oE '\[[0-9]+\]' | head -1 | tr -d '[]')
  [ -z "$TA" ] && { echo "FAIL $BATCH no-textarea"; continue; }

  N0=$(browser-act --session $SESS eval --stdin <<'JEOF0'
[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content')).length
JEOF0
)
  echo "existing images: $N0"
  browser-act --session $SESS input "$TA" "${GRID[$BATCH]}" >/dev/null 2>&1
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
  [ "$URL" = "WAIT" ] && { echo "FAIL $BATCH no-image"; continue; }

  B64LEN=$(browser-act --session $SESS eval --stdin <<JEOF2
(async()=>{try{const arr=[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content'));const u=arr[arr.length-1].src;const r=await fetch(u);if(!r.ok)return 'ERR';const b=await r.blob();const bmp=await createImageBitmap(b);const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;c.getContext('2d').drawImage(bmp,0,0);const w=await new Promise(res=>c.toBlob(res,'image/webp',0.92));const f=new FileReader();const d=await new Promise(res=>{f.onload=()=>res(f.result);f.readAsDataURL(w)});sessionStorage.setItem('imgwebp',d.split(',')[1]);return d.split(',')[1].length}catch(e){return 'EXC'}})()
JEOF2
)
  [[ "$B64LEN" =~ ^[0-9]+$ ]] || { echo "FAIL $BATCH webp($B64LEN)"; continue; }
  : > "$WORK/cpgrid_${BATCH}.b64"
  OFF=0
  while [ $OFF -lt $B64LEN ]; do
    END=$((OFF+40000)); [ $END -gt $B64LEN ] && END=$B64LEN
    SEG=$(browser-act --session $SESS eval "sessionStorage.getItem('imgwebp').slice($OFF,$END)" 2>&1)
    printf '%s' "$SEG" >> "$WORK/cpgrid_${BATCH}.b64"
    OFF=$END
  done
  base64 -d "$WORK/cpgrid_${BATCH}.b64" > "$WORK/cpgrid_${BATCH}.webp" 2>/dev/null
  echo "OK $BATCH $(wc -c < "$WORK/cpgrid_${BATCH}.webp")B"
done

echo "=== crop grid -> individual eggs -> keyout ==="
python "C:/Users/No'mi'l/AppData/Local/Temp/crop_classpet_egg_grid.py"
