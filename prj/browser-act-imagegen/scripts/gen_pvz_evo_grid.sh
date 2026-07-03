#!/usr/bin/env bash
set -u
SESS=bgpvz
BID=direct_local_104575322441121996
WORK="/c/Users/No'mi'l/AppData/Local/Temp"
STYLE="official Plants vs Zombies game art, thick black outlines, high saturation cel-shaded, clean white background, no text, no watermark."

declare -A GRID

# 13 batches: 12 batches × 3 species × 3 stages = 9 cells, last batch × 2 species = 6 cells

GRID[batch1]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Peashooter, Row2=Sunflower, Row3=Wall-nut:
[1] Peashooter SEEDLING: tiny Peashooter seedling sprouting from soil, small green head with one leaf, big cute eyes.
[2] Peashooter MATURE: mature battle-hardened Peashooter, larger body, confident grin, thicker vine arms, battle scars.
[3] Peashooter ULTIMATE: Ultimate four-headed Gatling Pea, four cannon heads on rotating barrel, glowing green energy.
[4] Sunflower SEEDLING: tiny Sunflower seedling, small stem, one yellow petal bud barely open, big adorable eyes.
[5] Sunflower MATURE: mature Sunflower, more golden petals, radiating sunlight beams, confident beauty, lush stem.
[6] Sunflower ULTIMATE: Ultimate double-headed golden sunflower, brilliant light radiating, solar particles orbiting.
[7] Wall-nut SEEDLING: tiny Wall-nut sprout, small round brown nut body with tiny arms and legs, big nervous cute eyes.
[8] Wall-nut MATURE: mature Wall-nut with crack lines, flexing muscular brown arms, battle-scarred, determined expression.
[9] Wall-nut ULTIMATE: Ultimate Tall-nut titan, enormous fortress wall-nut, golden-brown shell with rune-like cracks.
Each centered in its cell, clean white gaps. ${STYLE}"

GRID[batch2]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Cherry Bomb, Row2=Potato Mine, Row3=Snow Pea:
[1] Cherry Bomb SEEDLING: tiny twin cherry sprouts, small round red bodies, cute angry baby faces, tiny fuses.
[2] Cherry Bomb MATURE: mature Cherry Bomb twins, larger angry red faces, fuses smoking, explosive ready pose.
[3] Cherry Bomb ULTIMATE: Ultimate Mega Cherry Bomb, massive twin cherries with huge explosions, intense rage.
[4] Potato Mine SEEDLING: tiny potato sprout with one leaf, small brown body, hidden explosive expression.
[5] Potato Mine MATURE: mature Potato Mine, larger brown body with crack lines, ready to explode, gritted teeth.
[6] Potato Mine ULTIMATE: Ultimate Mega Potato Mine, huge potato bomb with glowing red core, massive explosion cracks.
[7] Snow Pea SEEDLING: tiny icy blue pea seedling, frost on tiny leaves, cute cold breath.
[8] Snow Pea MATURE: mature Snow Pea, larger icy blue body, frost armor, chilling aura, cold expression.
[9] Snow Pea ULTIMATE: Ultimate Frost Pea, massive ice-covered pea cannon, freezing aura, icicles hanging.
Each centered in its cell, clean white gaps. ${STYLE}"

GRID[batch3]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Chomper, Row2=Repeater, Row3=Jalapeno:
[1] Chomper SEEDLING: tiny Venus flytrap sprout, small green head with tiny teeth, cute hungry baby eyes.
[2] Chomper MATURE: mature Chomper, large green head with massive sharp teeth, purple tongue, fierce hungry look.
[3] Chomper ULTIMATE: Ultimate Chomper, enormous two-headed flytrap, razor teeth, vine tendrils, devouring aura.
[4] Repeater SEEDLING: tiny pea shooter with two tiny buds for mouths, small green stem, double cute eyes.
[5] Repeater MATURE: mature Repeater, double-barreled pea cannon, larger body, rapid-fire ready stance.
[6] Repeater ULTIMATE: Ultimate Repeater, quadruple-barreled Gatling, rapid-fire rotating barrels, green energy.
[7] Jalapeno SEEDLING: tiny green chili pepper sprout, small red tip, cute spicy baby face.
[8] Jalapeno MATURE: mature Jalapeno, long bright red pepper body, fiery expression, smoking tip ready to explode.
[9] Jalapeno ULTIMATE: Ultimate Jalapeno, giant blazing pepper engulfed in flames, volcanic fury.
Each centered in its cell, clean white gaps. ${STYLE}"

GRID[batch4]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Melon-pult, Row2=Cabbage-pult, Row3=Kernel-pult:
[1] Melon-pult SEEDLING: tiny melon sprout with a small sling, baby green melon head, cute pitcher plant face.
[2] Melon-pult MATURE: mature Melon-pult, large green melon head, catapult arm, watermelon cannonball ready.
[3] Melon-pult ULTIMATE: Ultimate Melon-pult, huge melon launcher, giant watermelon bombs, explosive power.
[4] Cabbage-pult SEEDLING: tiny cabbage sprout, small leafy head, cute catapult baby face.
[5] Cabbage-pult MATURE: mature Cabbage-pult, larger cabbage head, catapult launcher, leafy armor, focused.
[6] Cabbage-pult ULTIMATE: Ultimate Cabbage-pult, massive cabbage artillery, giant cabbage bombs, super launcher.
[7] Kernel-pult SEEDLING: tiny corn kernel sprout, small husk leaves, cute buttery baby face.
[8] Kernel-pult MATURE: mature Kernel-pult, corn cob body, butter launcher, popcorn ammo, goofy grin.
[9] Kernel-pult ULTIMATE: Ultimate Kernel-pult, giant corn cannon, butter bombs, popcorn storm, massive husk armor.
Each centered in its cell, clean white gaps. ${STYLE}"

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

GRID[batch6]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Pumpkin, Row2=Spikeweed, Row3=Spikerock:
[1] Pumpkin SEEDLING: tiny pumpkin sprout, small orange gourd, cute hollow baby face.
[2] Pumpkin MATURE: mature Pumpkin, large orange pumpkin shell, hollow interior for protection, sturdy guardian.
[3] Pumpkin ULTIMATE: Ultimate Pumpkin, enormous jack-o-lantern fortress, glowing eyes, protective barrier aura.
[4] Spikeweed SEEDLING: tiny spike plant sprout, small green spines, cute prickly baby face.
[5] Spikeweed MATURE: mature Spikeweed, carpet of sharp green spikes, underground burrowing pose, sneaky.
[6] Spikeweed ULTIMATE: Ultimate Spikeweed, massive spike field, giant thorns, impaling ready, fierce protective.
[7] Spikerock SEEDLING: tiny rocky spike sprout, small stone spines, cute tough baby face.
[8] Spikerock MATURE: mature Spikerock, large rocky spike cluster, stone armor, heavy defense stance.
[9] Spikerock ULTIMATE: Ultimate Spikerock, enormous obsidian spike fortress, diamond-hard thorns, impenetrable.
Each centered in its cell, clean white gaps. ${STYLE}"

GRID[batch7]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Twin Sunflower, Row2=Squash, Row3=Magnet-shroom:
[1] Twin Sunflower SEEDLING: tiny two-headed sunflower sprout, twin buds on one stem, double cute faces.
[2] Twin Sunflower MATURE: mature Twin Sunflower, two golden flower heads side by side, double sunbeams, radiant.
[3] Twin Sunflower ULTIMATE: Ultimate Twin Sunflower, triple-headed sunflower, massive golden blooms, sun shower.
[4] Squash SEEDLING: tiny squash sprout, small round gourd body, cute angry baby face.
[5] Squash MATURE: mature Squash, large heavy gourd body, furious face, jumping smash pose.
[6] Squash ULTIMATE: Ultimate Squash, enormous mega-gourd, ground-pounding slam, shockwave cracks.
[7] Magnet-shroom SEEDLING: tiny purple mushroom sprout, small magnet cap, cute spore baby face.
[8] Magnet-shroom MATURE: mature Magnet-shroom, large purple mushroom with big red magnet cap, magnetic aura.
[9] Magnet-shroom ULTIMATE: Ultimate Magnet-shroom, giant electromagnetic mushroom, massive magnetic field, metal debris.
Each centered in its cell, clean white gaps. ${STYLE}"

GRID[batch8]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Hypno-shroom, Row2=Ice-shroom, Row3=Sun-shroom:
[1] Hypno-shroom SEEDLING: tiny purple mushroom sprout, small hypnotic swirl cap, cute dazed baby face.
[2] Hypno-shroom MATURE: mature Hypno-shroom, large purple mushroom with hypnotic spiral eyes, mesmerizing swirl cap.
[3] Hypno-shroom ULTIMATE: Ultimate Hypno-shroom, enormous psychedelic mushroom, reality-warping swirls, hypnotic aura.
[4] Ice-shroom SEEDLING: tiny icy blue mushroom sprout, frost on tiny cap, cute cold baby face.
[5] Ice-shroom MATURE: mature Ice-shroom, large icy mushroom, frost armor, freezing aura, chill expression.
[6] Ice-shroom ULTIMATE: Ultimate Ice-shroom, enormous glacier mushroom, blizzard aura, icicles, absolute zero.
[7] Sun-shroom SEEDLING: tiny glowing yellow mushroom sprout, small sun cap, warm cute face.
[8] Sun-shroom MATURE: mature Sun-shroom, larger glowing mushroom, bright sun aura, cheerful warm expression.
[9] Sun-shroom ULTIMATE: Ultimate Sun-shroom, enormous radiant mushroom, miniature sun, solar flare particles.
Each centered in its cell, clean white gaps. ${STYLE}"

GRID[batch9]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Basic Zombie, Row2=Conehead Zombie, Row3=Buckethead Zombie:
[1] Basic Zombie SEEDLING: tiny zombie sprouting from ground, small green-gray head, one eye open, confused baby.
[2] Basic Zombie MATURE: mature Basic Zombie, standard lurching zombie, tattered clothes, dull eyes, arms reaching.
[3] Basic Zombie ULTIMATE: Ultimate Basic Zombie, massive hulking zombie, torn clothes, glowing undead eyes.
[4] Conehead Zombie SEEDLING: tiny conehead baby zombie, small orange cone on head, cute undead baby face.
[5] Conehead Zombie MATURE: mature Conehead Zombie, full zombie with orange traffic cone helmet, tattered suit.
[6] Conehead Zombie ULTIMATE: Ultimate Conehead Zombie, giant zombie with mega cone, reinforced steel cone.
[7] Buckethead Zombie SEEDLING: tiny buckethead baby zombie, small silver bucket on head, cute undead baby.
[8] Buckethead Zombie MATURE: mature Buckethead Zombie, full zombie with silver bucket helmet, tough defense.
[9] Buckethead Zombie ULTIMATE: Ultimate Buckethead Zombie, giant zombie with reinforced steel bucket, invincible.
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

GRID[batch12]="Generate a 3x3 grid of 9 Plants vs Zombies evolution forms. Row1=Imp, Row2=Balloon Zombie, Row3=Screen Door Zombie:
[1] Imp SEEDLING: tiny imp baby zombie, small mischievous face, cute tiny undead baby.
[2] Imp MATURE: mature Imp, small fast zombie, mischievous grin, agile movement.
[3] Imp ULTIMATE: Ultimate Imp, swarm leader imp, commanding horde of imps, tiny but fierce.
[4] Balloon Zombie SEEDLING: tiny balloon baby zombie holding small balloon, cute floating baby undead.
[5] Balloon Zombie MATURE: mature Balloon Zombie, zombie floating with balloon, reaching down, floating over defenses.
[6] Balloon Zombie ULTIMATE: Ultimate Balloon Zombie, zombie with giant balloon cluster, flying high.
[7] Screen Door Zombie SEEDLING: tiny screen door baby zombie holding small screen, cute defensive baby.
[8] Screen Door Zombie MATURE: mature Screen Door Zombie, zombie carrying screen door shield, protected advance.
[9] Screen Door Zombie ULTIMATE: Ultimate Screen Door Zombie, giant zombie with reinforced steel door shield.
Each centered in its cell, clean white gaps. ${STYLE}"

GRID[batch13]="Generate a 3x2 grid of 6 Plants vs Zombies evolution forms. Row1=Giga Gargantuar, Row2=Dr. Zomboss:
[1] Giga Gargantuar SEEDLING: tiny red-eyed giant baby zombie, small but already menacing, cute terrifying baby.
[2] Giga Gargantuar MATURE: mature Giga Gargantuar, giant red-eyed gargantuar, glowing red eyes, rage.
[3] Giga Gargantuar ULTIMATE: Ultimate Giga Gargantuar, colossal red-eyed behemoth, glowing rage aura.
[4] Dr. Zomboss SEEDLING: tiny Zomboss baby genius, small lab coat, tiny goggles, cute mad-scientist baby.
[5] Dr. Zomboss MATURE: mature Dr. Zomboss, zombie genius in lab coat, evil grin, control panel, master planner.
[6] Dr. Zomboss ULTIMATE: Ultimate Dr. Zomboss, in his giant mech robot, massive machine, ultimate weapon.
Each centered in its cell, clean white gaps. ${STYLE}"


echo "=== create session + open chatgpt ==="
browser-act --session $SESS browser open $BID "https://chatgpt.com" 2>&1 | tail -2
browser-act --session $SESS wait stable --timeout 60000 2>&1 | tail -1

for BATCH in batch1 batch2 batch3 batch4 batch5 batch6 batch7 batch8 batch9 batch10 batch11 batch12 batch13; do
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

echo "=== crop grids -> individual stages -> keyout ==="
python "C:/Users/No'mi'l/AppData/Local/Temp/crop_pvz_evo_grid.py"
