#!/bin/bash
# Retry pet image generation with delays to avoid rate limiting

OUTPUT_DIR="/tmp/pet-bank/assets/pets"
mkdir -p "$OUTPUT_DIR"

# All pets to generate (skip ones that already exist with valid size)
declare -A PETS
PETS[cat]="A cute orange tabby cat character in Plants vs Zombies PVZ PopCap cartoon art style, big expressive green eyes, exaggerated cute chibi proportions, vibrant flat orange colors with black outlines, 2D vector game asset, isolated on pure white background, full body, front view, kid-friendly cartoon, similar to PVZ plant characters, no shadow"
PETS[rabbit]="A cute white rabbit character in Minecraft voxel style, made of colorful pixel blocks, blocky 3D rendering like Minecraft game, square head and body, big expressive square eyes with pink details, kid-friendly cartoon, isolated on pure white background, full body, front view, vibrant white and pink colors, no shadow, PNG style, 8-bit game asset, super cute and chibi proportions"
PETS[turtle]="A cute green turtle character in Plants vs Zombies PVZ PopCap cartoon art style, big expressive eyes, exaggerated cute chibi proportions, vibrant flat green colors with black outlines, 2D vector game asset, isolated on pure white background, full body, front view, kid-friendly cartoon, similar to PVZ plant characters, no shadow"
PETS[hamster]="A cute golden hamster character in Minecraft voxel style, made of colorful pixel blocks, blocky 3D rendering like Minecraft game, square head and body, big expressive square eyes, chubby cheeks, kid-friendly cartoon, isolated on pure white background, full body, front view, vibrant golden and white colors, no shadow, PNG style, 8-bit game asset, super cute and chibi proportions"
PETS[parrot]="A cute colorful parrot character in Plants vs Zombies PVZ PopCap cartoon art style, big expressive eyes, exaggerated cute chibi proportions, vibrant flat colors red blue yellow with black outlines, 2D vector game asset, isolated on pure white background, full body, front view, kid-friendly cartoon, similar to PVZ plant characters, no shadow"
PETS[goldfish]="A cute goldfish character in Minecraft voxel style, made of colorful pixel blocks, blocky 3D rendering like Minecraft game, square head and body, big expressive square eyes, kid-friendly cartoon, isolated on pure white background, full body, front view, vibrant orange and gold colors, no shadow, PNG style, 8-bit game asset, super cute and chibi proportions"

generate_one() {
    local name="$1"
    local prompt="$2"
    local file="$OUTPUT_DIR/$name.png"

    # Skip if valid PNG/JPEG already exists
    if [ -f "$file" ] && [ $(stat -c%s "$file") -gt 5000 ]; then
        echo "[$name] Already exists, skipping"
        return 0
    fi

    local encoded_prompt=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$prompt'''))")
    local seed=$((RANDOM * RANDOM))
    local url="https://image.pollinations.ai/prompt/${encoded_prompt}?width=512&height=512&nologo=true&seed=${seed}"

    echo "[$name] Generating (max 3 attempts)..."

    for attempt in 1 2 3; do
        if curl -fsSL --max-time 180 --retry 0 -o "$file" "$url" 2>/dev/null; then
            local size=$(stat -c%s "$file" 2>/dev/null || echo 0)
            if [ "$size" -gt 5000 ]; then
                echo "  ✓ [$name] Saved ($size bytes)"
                return 0
            fi
        fi
        echo "  Attempt $attempt failed, waiting before retry..."
        sleep $((attempt * 5))
    done

    echo "  ✗ [$name] All attempts failed"
    rm -f "$file"
    return 1
}

# Process sequentially with delay
for name in cat rabbit turtle hamster parrot goldfish; do
    generate_one "$name" "${PETS[$name]}"
    sleep 3  # Polite delay between requests
done

echo ""
echo "=== Final listing ==="
ls -la "$OUTPUT_DIR/"
