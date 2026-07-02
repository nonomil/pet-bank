#!/usr/bin/env bash
set -u
SESS=bgpvz
BID=direct_local_104575322441121996
WORK="/c/Users/No'mi'l/AppData/Local/Temp"
SUFFIX=", official Plants vs Zombies cartoon game render style, clean transparent background, high detail 3D cartoon render, vibrant saturated colors, full body, single subject, no text, no watermark."

declare -A DESC
DESC[melonpult]="Melon-pult from Plants vs Zombies, a green melon-headed plant creature with a catapult arm, round green melon body, friendly cartoon face"
DESC[cherrybomb]="Cherry Bomb from Plants vs Zombies, two angry red cherry bomb characters with lit fuses on top, explosive plant"
DESC[coneheadzombie]="Conehead Zombie from Plants vs Zombies, gray-green zombie wearing an orange traffic cone helmet, tattered clothes, goofy stance"
DESC[polevaultingzombie]="Pole Vaulting Zombie from Plants vs Zombies, zombie athlete holding a long vaulting pole, sporty outfit"
DESC[magnetshroom]="Magnet-shroom from Plants vs Zombies, purple mushroom plant with a red magnet-shaped cap"
DESC[hypnoshroom]="Hypno-shroom from Plants vs Zombies, purple mushroom with hypnotic swirl eyes, eerie grin"
DESC[repeater]="Repeater from Plants vs Zombies, green pea shooter plant with two cannon mouths, double-barreled Peashooter"
DESC[zombie]="Basic Zombie from Plants vs Zombies, gray-green undead zombie, tattered clothes, dull eyes, lurching stance"
DESC[flagzombie]="Flag Zombie from Plants vs Zombies, zombie waving a red flag, announcing the zombie wave"
DESC[footballzombie]="Football Zombie from Plants vs Zombies, bulky zombie in red American football helmet and shoulder pads"
DESC[sunshroom]="Sun-shroom from Plants vs Zombies, small glowing golden sun mushroom, cheerful smiling face"

ORDER="magnetshroom"

echo "=== open chatgpt ==="
browser-act --session $SESS browser open $BID "https://chatgpt.com" 2>&1 | tail -2
browser-act --session $SESS wait stable --timeout 60000 2>&1 | tail -1

for PET in $ORDER; do
  echo "===== $PET ====="
  TA=$(browser-act --session $SESS state 2>&1 | grep 'prompt-textarea' | grep -oE '\[[0-9]+\]' | head -1 | tr -d '[]')
  [ -z "$TA" ] && { echo "FAIL $PET no-textarea"; continue; }
  N0=$(browser-act --session $SESS eval --stdin <<'JEOF0'
[...document.querySelectorAll('img')].filter(x=>x.src.includes('estuary/content')).length
JEOF0
)
  browser-act --session $SESS input "$TA" "Please generate an image: ${DESC[$PET]}${SUFFIX}" >/dev/null 2>&1
  sleep 1
  browser-act --session $SESS keys "Enter" >/dev/null 2>&1
  URL=WAIT
  for a in $(seq 1 20); do
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
  : > "$WORK/pvz_$PET.b64"
  OFF=0
  while [ $OFF -lt $B64LEN ]; do
    END=$((OFF+40000)); [ $END -gt $B64LEN ] && END=$B64LEN
    SEG=$(browser-act --session $SESS eval "sessionStorage.getItem('imgwebp').slice($OFF,$END)" 2>&1)
    printf '%s' "$SEG" >> "$WORK/pvz_$PET.b64"
    OFF=$END
  done
  base64 -d "$WORK/pvz_$PET.b64" > "$WORK/pvz_$PET.webp" 2>/dev/null
  echo "OK $PET $(wc -c < "$WORK/pvz_$PET.webp")B"
done

echo "=== keyout (white->transparent) + save to project ==="
python "C:/Users/No'mi'l/AppData/Local/Temp/keyout_pvz.py"
