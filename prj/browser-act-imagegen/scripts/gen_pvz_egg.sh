#!/usr/bin/env bash
set -u
SESS=bgpvz
BID=direct_local_104575322441121996
WORK="/c/Users/No'mi'l/AppData/Local/Temp"
SUFFIX=", official Plants vs Zombies cartoon game render style, clean transparent background, high detail 3D cartoon render, vibrant saturated colors, full body, single subject, no text, no watermark."

declare -A DESC
# === 22 EGGS ===
DESC[cherrybomb]="A small cherry-red egg with angry face patterns and black fuse details on the shell, twin cherry shapes fused together"
DESC[potatomine]="A small brown egg with crack patterns resembling a potato's eyes, with a tiny fuse stem on top"
DESC[chomper]="A green egg with tooth-like patterns running down the shell, with small purple spots"
DESC[jalapeno]="A bright red elongated egg with flame patterns on the shell, green stem cap on top"
DESC[magnetshroom]="A small purple mushroom egg with magnet-shaped patterns on the shell, tiny red cap"
DESC[hypnoshroom]="A small purple-pink egg with spiral hypnotic patterns on the shell, tiny mushroom cap"
DESC[iceshroom]="A small icy blue egg with frost patterns on the shell, tiny mushroom cap with ice crystals"
DESC[sunshroom]="A small golden-yellow egg with glowing sun patterns on the shell, tiny mushroom cap"
DESC[zombie]="A gray-green egg with tattered zombie face patterns on the shell, cracked and worn texture"
DESC[coneheadzombie]="A gray-green egg with a tiny orange traffic cone pattern on top of the shell, zombie crack patterns"
DESC[bucketheadzombie]="A gray-green egg with a tiny silver bucket pattern on top, cracked zombie shell"
DESC[flagzombie]="A gray-green egg with a tiny red flag pattern on top, zombie crack patterns on shell"
DESC[polevaultingzombie]="A gray-green egg with a tiny long pole pattern across the shell, athletic zombie markings"
DESC[dancingzombie]="A gray-green egg with disco patterns, sunglasses and microphone marks on the shell"
DESC[backupdancer]="A gray-green egg with dance move patterns on the shell, backup dancer silhouette"
DESC[footballzombie]="A gray-green egg wearing a tiny red football helmet pattern on top, bulky cracked shell"
DESC[gargantuar]="A massive dark gray-green egg with angry face patterns, cracked shell, tiny imp mark on top"
DESC[imp]="A tiny gray-green egg with mischievous face pattern on the shell, small and cracked"
DESC[balloonzombie]="A gray-green egg with a tiny balloon pattern tied to the top, floating zombie marks"
DESC[screendoorzombie]="A gray-green egg with a tiny screen door pattern covering the front, zombie shell texture"
DESC[gigagargantuar]="A massive dark egg with red glowing eye patterns and giant cracked shell, menacing face"
DESC[drzomboss]="A dark egg with lab coat and machinery patterns, robotic details on the shell, green glowing eye"

ORDER="cherrybomb potatomine chomper jalapeno magnetshroom hypnoshroom iceshroom sunshroom zombie coneheadzombie bucketheadzombie flagzombie polevaultingzombie dancingzombie backupdancer footballzombie gargantuar imp balloonzombie screendoorzombie gigagargantuar drzomboss"

echo "=== create session + open chatgpt ==="
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
  : > "$WORK/pvzegg_$PET.b64"
  OFF=0
  while [ $OFF -lt $B64LEN ]; do
    END=$((OFF+40000)); [ $END -gt $B64LEN ] && END=$B64LEN
    SEG=$(browser-act --session $SESS eval "sessionStorage.getItem('imgwebp').slice($OFF,$END)" 2>&1)
    printf '%s' "$SEG" >> "$WORK/pvzegg_$PET.b64"
    OFF=$END
  done
  base64 -d "$WORK/pvzegg_$PET.b64" > "$WORK/pvzegg_$PET.webp" 2>/dev/null
  echo "OK $PET $(wc -c < "$WORK/pvzegg_$PET.webp")B"
done

echo "=== keyout (white->transparent) + save as egg ==="
python "C:/Users/No'mi'l/AppData/Local/Temp/keyout_pvz_egg.py"
