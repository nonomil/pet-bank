#!/usr/bin/env bash
set -u
SESS=bgmc2
BID=direct_local_104575322441121996
WORK="/c/Users/No'mi'l/AppData/Local/Temp"
SUFFIX=", Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, transparent background, full body, single subject, no text, no watermark."

declare -A IDLE
IDLE[creeper]="Official Minecraft creeper, green blocky body with four legs and frowning pixel face"
IDLE[wither]="Official Minecraft wither, black floating three-headed skeleton boss with three skulls"
IDLE[ender_dragon]="Official Minecraft ender dragon, large black dragon with purple glowing eyes"
IDLE[warden]="Official Minecraft warden, tall dark blue blind monster with glowing cyan chest"
IDLE[zombie]="Official Minecraft zombie, green blocky undead humanoid in torn blue shirt"
IDLE[skeleton]="Official Minecraft skeleton, white blocky skeleton holding a bow"
IDLE[spider]="Official Minecraft spider, blocky red-eyed black spider"
IDLE[blaze]="Official Minecraft blaze, yellow floating blaze with blazing rods and smoke"
IDLE[ghast]="Official Minecraft ghast, large white floating ghost with crying face and tentacles"
IDLE[phantom]="Official Minecraft phantom, blue flying phantom mob with long tail"
IDLE[iron_golem]="Official Minecraft iron golem, large gray iron protector with villager nose"
IDLE[herobrine]="Minecraft Herobrine, blocky Steve-like figure with glowing white empty eyes"
IDLE[entity_303]="Minecraft Entity 303, blocky ghost-hacker with pale skin dark hoodie and red eyes"

ORDER="creeper wither ender_dragon warden zombie skeleton spider blaze ghast phantom iron_golem herobrine entity_303"
HAPPY_ACT="now in a happy joyful pose, jumping mid-air with big pixel smile, floating hearts and sparkles above head"
ATTACK_ACT="now in a fierce aggressive attack stance, glowing angry eyes, claws or weapon raised ready to strike, motion impact lines"

echo "=== open chatgpt ==="
browser-act --session $SESS browser open $BID "https://chatgpt.com" 2>&1 | tail -2
browser-act --session $SESS wait stable --timeout 60000 2>&1 | tail -1

for PET in $ORDER; do
  for ACTION in happy attack; do
    [ "$ACTION" = "happy" ] && ACT="$HAPPY_ACT" || ACT="$ATTACK_ACT"
    echo "===== $PET $ACTION ====="
    TA=$(browser-act --session $SESS state 2>&1 | grep 'prompt-textarea' | grep -oE '\[[0-9]+\]' | head -1 | tr -d '[]')
    [ -z "$TA" ] && { echo "FAIL $PET $ACTION no-textarea"; continue; }
    N0=$(browser-act --session $SESS eval --stdin <<'JEOF0'
[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content')).length
JEOF0
)
    browser-act --session $SESS input "$TA" "Please generate an image: ${IDLE[$PET]}, ${ACT}${SUFFIX}" >/dev/null 2>&1
    sleep 1
    browser-act --session $SESS keys "Enter" >/dev/null 2>&1
    URL=WAIT
    for a in $(seq 1 20); do
      sleep 12
      RES=$(browser-act --session $SESS eval --stdin <<JEOF1
(async()=>{const arr=[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content'));return arr.length>${N0}?arr[arr.length-1].src:'WAIT'})()
JEOF1
)
      [ "$RES" != "WAIT" ] && [ -n "$RES" ] && { URL="$RES"; break; }
    done
    [ "$URL" = "WAIT" ] && { echo "FAIL $PET $ACTION no-image"; continue; }
    B64LEN=$(browser-act --session $SESS eval --stdin <<JEOF2
(async()=>{try{const arr=[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content'));const u=arr[arr.length-1].src;const r=await fetch(u);if(!r.ok)return 'ERR';const b=await r.blob();const bmp=await createImageBitmap(b);const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;c.getContext('2d').drawImage(bmp,0,0);const w=await new Promise(res=>c.toBlob(res,'image/webp',0.92));const f=new FileReader();const d=await new Promise(res=>{f.onload=()=>res(f.result);f.readAsDataURL(w)});sessionStorage.setItem('imgwebp',d.split(',')[1]);return d.split(',')[1].length}catch(e){return 'EXC'}})()
JEOF2
)
    [[ "$B64LEN" =~ ^[0-9]+$ ]] || { echo "FAIL $PET $ACTION webp($B64LEN)"; continue; }
    : > "$WORK/mc_${PET}_${ACTION}.b64"
    OFF=0
    while [ $OFF -lt $B64LEN ]; do
      END=$((OFF+40000)); [ $END -gt $B64LEN ] && END=$B64LEN
      SEG=$(browser-act --session $SESS eval "sessionStorage.getItem('imgwebp').slice($OFF,$END)" 2>&1)
      printf '%s' "$SEG" >> "$WORK/mc_${PET}_${ACTION}.b64"
      OFF=$END
    done
    base64 -d "$WORK/mc_${PET}_${ACTION}.b64" > "$WORK/mc_${PET}_${ACTION}.webp" 2>/dev/null
    echo "OK $PET $ACTION $(wc -c < "$WORK/mc_${PET}_${ACTION}.webp")B"
  done
done
echo "=== keyout ==="
python "C:/Users/No'mi'l/AppData/Local/Temp/keyout_mc.py"
