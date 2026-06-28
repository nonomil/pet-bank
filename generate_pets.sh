#!/bin/bash
# Generate 8 pet images using Pollinations.ai (free, no API key required)
# Falls back when AGNES_API_KEY is not available

set -e
OUTPUT_DIR="/tmp/pet-bank/assets/pets"
mkdir -p "$OUTPUT_DIR"

# Pollinations.ai generates images by URL - no auth needed
# Format: https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&nologo=true

generate_image() {
    local name="$1"
    local prompt="$2"
    local file="$OUTPUT_DIR/$name.png"
    local encoded_prompt=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$prompt'))")
    local url="https://image.pollinations.ai/prompt/${encoded_prompt}?width=512&height=512&nologo=true&seed=$RANDOM"

    echo "[$name] Downloading from Pollinations.ai..."
    echo "  URL: ${url:0:120}..."

    if curl -fsSL --max-time 120 -o "$file" "$url"; then
        local size=$(stat -c%s "$file" 2>/dev/null || echo 0)
        if [ "$size" -gt 1000 ]; then
            echo "  ✓ Saved: $file ($size bytes)"
            return 0
        else
            echo "  ✗ File too small ($size bytes), retrying..."
            rm -f "$file"
        fi
    else
        echo "  ✗ Download failed"
    fi
    return 1
}

# Try AGNES first if key is available
try_agnes() {
    local name="$1"
    local prompt="$2"
    if [ -z "$AGNES_API_KEY" ]; then
        return 1
    fi
    echo "[$name] Trying AGNES API..."
    local response=$(curl -fsSL --max-time 120 \
        -X POST "https://api.agnes-ai.com/v1/images/generations" \
        -H "Authorization: Bearer $AGNES_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"prompt\": \"$prompt\", \"n\": 1, \"size\": \"512x512\"}" 2>/dev/null)

    if [ -n "$response" ]; then
        local url=$(echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data'][0]['url'])" 2>/dev/null)
        if [ -n "$url" ]; then
            curl -fsSL --max-time 60 -o "$OUTPUT_DIR/$name.png" "$url"
            return 0
        fi
    fi
    return 1
}

# Define pets
declare -A PETS
PETS[dog]="A cute Shiba Inu dog character in Minecraft voxel style, made of colorful pixel blocks, blocky 3D rendering like Minecraft game, square head and body, big expressive square eyes, kid-friendly cartoon, isolated on pure white background, full body, front view, vibrant orange and cream colors, no shadow, PNG style, 8-bit game asset, super cute and chibi proportions"
PETS[cat]="A cute orange tabby cat character in Plants vs Zombies (PVZ) PopCap cartoon art style, big expressive green eyes, exaggerated cute chibi proportions, vibrant flat orange colors with black outlines, 2D vector game asset, isolated on pure white background, full body, front view, kid-friendly cartoon, similar to PVZ plant characters, no shadow"
PETS[rabbit]="A cute white rabbit character in Minecraft voxel style, made of colorful pixel blocks, blocky 3D rendering like Minecraft game, square head and body, big expressive square eyes with pink details, kid-friendly cartoon, isolated on pure white background, full body, front view, vibrant white and pink colors, no shadow, PNG style, 8-bit game asset, super cute and chibi proportions"
PETS[turtle]="A cute green turtle character in Plants vs Zombies (PVZ) PopCap cartoon art style, big expressive eyes, exaggerated cute chibi proportions, vibrant flat green colors with black outlines, 2D vector game asset, isolated on pure white background, full body, front view, kid-friendly cartoon, similar to PVZ plant characters, no shadow"
PETS[hamster]="A cute golden hamster character in Minecraft voxel style, made of colorful pixel blocks, blocky 3D rendering like Minecraft game, square head and body, big expressive square eyes, chubby cheeks, kid-friendly cartoon, isolated on pure white background, full body, front view, vibrant golden and white colors, no shadow, PNG style, 8-bit game asset, super cute and chibi proportions"
PETS[parrot]="A cute colorful parrot character in Plants vs Zombies (PVZ) PopCap cartoon art style, big expressive eyes, exaggerated cute chibi proportions, vibrant flat colors red blue yellow with black outlines, 2D vector game asset, isolated on pure white background, full body, front view, kid-friendly cartoon, similar to PVZ plant characters, no shadow"
PETS[goldfish]="A cute goldfish character in Minecraft voxel style, made of colorful pixel blocks, blocky 3D rendering like Minecraft game, square head and body, big expressive square eyes, kid-friendly cartoon, isolated on pure white background, full body, front view, vibrant orange and gold colors, no shadow, PNG style, 8-bit game asset, super cute and chibi proportions"
PETS[hedgehog]="A cute hedgehog character in Plants vs Zombies (PVZ) PopCap cartoon art style, big expressive eyes, exaggerated cute chibi proportions, vibrant flat brown colors with black outlines and tiny spikes, 2D vector game asset, isolated on pure white background, full body, front view, kid-friendly cartoon, similar to PVZ plant characters, no shadow"

# Generate in parallel (max 4 at a time to avoid rate limiting)
generate_pet() {
    local name="$1"
    local prompt="$2"
    local file="$OUTPUT_DIR/$name.png"

    # Skip if already exists and valid
    if [ -f "$file" ] && [ $(stat -c%s "$file") -gt 5000 ]; then
        echo "[$name] Already exists, skipping"
        return 0
    fi

    # Try AGNES first
    if ! try_agnes "$name" "$prompt"; then
        # Fall back to Pollinations
        generate_image "$name" "$prompt"
    fi
}

export -f generate_image
export -f try_agnes
export -f generate_pet
export OUTPUT_DIR
export AGNES_API_KEY

START_TIME=$(date +%s)
echo "=== Starting pet image generation ==="
echo "Output directory: $OUTPUT_DIR"
echo ""

# Generate in batches of 4 parallel jobs
NAMES=(dog cat rabbit turtle hamster parrot goldfish hedgehog)
PIDS=()
MAX_PARALLEL=3

for name in "${NAMES[@]}"; do
    generate_pet "$name" "${PETS[$name]}" &
    PIDS+=($!)

    # Wait if we've hit max parallel
    while [ $(jobs -r | wc -l) -ge $MAX_PARALLEL ]; do
        sleep 0.5
    done
done

# Wait for all jobs
wait

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "=== Generation complete in ${ELAPSED}s ==="
echo ""
echo "=== File listing ==="
ls -la "$OUTPUT_DIR/"
echo ""
echo "=== Validation ==="
for name in "${NAMES[@]}"; do
    file="$OUTPUT_DIR/$name.png"
    if [ -f "$file" ]; then
        size=$(stat -c%s "$file")
        ftype=$(file -b "$file" | head -c 60)
        echo "[$name] $size bytes - $ftype"
    else
        echo "[$name] MISSING"
    fi
done
