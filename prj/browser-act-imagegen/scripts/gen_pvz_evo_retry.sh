#!/usr/bin/env bash
set -u
SESS=bgpvz
BID=direct_local_104575322441121996
WORK="/c/Users/No'mi'l/AppData/Local/Temp"
STYLE="official Plants vs Zombies game art, thick black outlines, high saturation cel-shaded, clean white background, no text, no watermark."

declare -A GRID
GRID[batch5]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Threepeater, Row2=Torchwood, Row3=Tall-nut:
[1] Threepeater SEEDLING: tiny triple-bud pea sprout, three small heads on one stem, three pairs cute eyes.
[2] Threepeater MATURE: mature Threepeater, three-barreled pea cannon on tall stem, triple rapid-fire, alert.
[3] Threepeater ULTIMATE: Ultimate Threepeater, massive three-headed Gatling, each head rotating, green energy orbs.
[4] Torchwood SEEDLING: tiny torchwood sprout, small wooden post with tiny flame, warm glowing baby face.
[5] Torchwood MATURE: mature Torchwood, tall wooden post with blazing fire, eternal flame, warm determined face.
[6] Torchwood ULTIMATE: Ultimate Torchwood, massive inferno pillar, blue-white hot flame core, ash and ember aura.
[7] Tall-nut SEEDLING: tiny tall thin sprout, small elongated nut body, cute tall baby face.
[8] Tall-nut MATURE: mature Tall-nut, very tall sturdy nut body, reaching high, protective barrier expression.
[9] Tall-nut ULTIMATE: Ultimate Tall-nut, colossal mega-height fortress nut, towering wall, impenetrable shield.
Each centered in its cell, clean white gaps. ${STYLE}"

GRID[batch10]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Flag Zombie, Row2=Pole Vaulting Zombie, Row3=Dancing Zombie:
[1] Flag Zombie SEEDLING: tiny flag baby zombie holding a small red flag, cute undead baby marching.
[2] Flag Zombie MATURE: mature Flag Zombie, standard zombie waving red flag, leading the horde, announcing wave.
[3] Flag Zombie ULTIMATE: Ultimate Flag Zombie, giant zombie commander, massive red banner, leading endless horde.
[4] Pole Vaulting Zombie SEEDLING: tiny pole vault baby zombie, small pole, cute athletic undead baby.
[5] Pole Vaulting Zombie MATURE: mature Pole Vaulting Zombie, zombie athlete with long pole, sporty outfit, leaping.
[6] Pole Vaulting Zombie ULTIMATE: Ultimate Pole Vaulting Zombie, super athlete zombie, Olympic vault, soaring.
[7] Dancing Zombie SEEDLING: tiny dancing baby zombie, small microphone, cute disco baby pose.
[8] Dancing Zombie MATURE: mature Dancing Zombie, disco zombie with sunglasses, white suit, microphone, dance pose.
[9] Dancing Zombie ULTIMATE: Ultimate Dancing Zombie, Michael Jackson-style zombie, epic dance moves, backup dancers.
Each centered in its cell, clean white gaps. ${STYLE}"

GRID[batch11]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Backup Dancer, Row2=Football Zombie, Row3=Gargantuar:
[1] Backup Dancer SEEDLING: tiny backup dancer baby zombie, small microphone, cute sidekick baby pose.
[2] Backup Dancer MATURE: mature Backup Dancer, disco zombie sidekick, matching outfit, dance in sync.
[3] Backup Dancer ULTIMATE: Ultimate Backup Dancer, elite dancer zombie, perfect synchronization, dance crew leader.
[4] Football Zombie SEEDLING: tiny football baby zombie, small red helmet, cute sports baby.
[5] Football Zombie MATURE: mature Football Zombie, bulky zombie in red football helmet and shoulder pads, charging.
[6] Football Zombie ULTIMATE: Ultimate Football Zombie, super linebacker zombie, full football gear, unstoppable.
[7] Gargantuar SEEDLING: tiny giant baby zombie, small but big for baby, cute oversized undead baby.
[8] Gargantuar MATURE: mature Gargantuar, enormous giant zombie, massive arms, menacing roar.
[9] Gargantuar ULTIMATE: Ultimate Gargantuar, colossal giant zombie, towering over buildings, throwing buses.
Each centered in its cell, clean white gaps. ${STYLE}"

GRID[batch13]="Generate a 3x2 grid of 6 Plants vs Zombies evolution forms. Row1=Giga Gargantuar, Row2=Dr. Zomboss:
[1] Giga Gargantuar SEEDLING: tiny red-eyed giant baby zombie, small but already menacing, cute terrifying baby.
[2] Giga Gargantuar MATURE: mature Giga Gargantuar, giant red-eyed gargantuar, glowing red eyes, rage.
[3] Giga Gargantuar ULTIMATE: Ultimate Giga Gargantuar, colossal red-eyed behemoth, glowing rage aura.
[4] Dr. Zomboss SEEDLING: tiny Zomboss baby genius, small lab coat, tiny goggles, cute mad-scientist baby.
[5] Dr. Zomboss MATURE: mature Dr. Zomboss, zombie genius in lab coat, evil grin, control panel, master planner.
[6] Dr. Zomboss ULTIMATE: Ultimate Dr. Zomboss, in his giant mech robot, massive machine, ultimate weapon.
Each centered in its cell, clean white gaps. ${STYLE}"

echo "=== session ready ==="
browser-act --session $SESS wait stable --timeout 30000 2>&1 | tail -1

for BATCH in batch5 batch10 batch11 batch13; do
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
  : > "$WORK/pvzevo_${BATCH}.b64"
  OFF=0
  while [ $OFF -lt $B64LEN ]; do
    END=$((OFF+40000)); [ $END -gt $B64LEN ] && END=$B64LEN
    SEG=$(browser-act --session $SESS eval "sessionStorage.getItem('imgwebp').slice($OFF,$END)" 2>&1)
    printf '%s' "$SEG" >> "$WORK/pvzevo_${BATCH}.b64"
    OFF=$END
  done
  base64 -d "$WORK/pvzevo_${BATCH}.b64" > "$WORK/pvzevo_${BATCH}.webp" 2>/dev/null
  echo "OK $BATCH $(wc -c < "$WORK/pvzevo_${BATCH}.webp")B"
done

echo "=== crop ==="
python "C:/Users/No'mi'l/AppData/Local/Temp/crop_pvz_evo_grid.py"
