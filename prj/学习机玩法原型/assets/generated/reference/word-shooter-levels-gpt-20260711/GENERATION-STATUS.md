# Word Shooter Art Refresh Status

The three level prompts and the explosion-sheet prompt are ready in this folder.

Generation was attempted with the key from `docs/GPT生图/Grok生图.md` (the key is read from its TOML `env_key` field):

- `grok-imagine-image-quality` on `/v1/images/generations`: upstream HTTP 502.
- `gpt-image-2` with the same key: HTTP 404, no enabled channel for that model.
- The local browser generation service was already in use by another browser instance, so it was not taken over.
- A fresh retry after fixing the key-file parser produced the same HTTP 502. `GET /v1/models` succeeds and lists `grok-imagine-image-quality`, but the image generation channel remains unavailable.
- The separate `docs/GPT生图/GPT生图模型key.md` was also tested without changing the runtime assets: `GET /v1/models` returned an empty model list, and `gpt-image-2` returned HTTP 404 `no enabled channel for model "gpt-image-2"`. Its failure record is under `probe-gpt-key/`.

No failed response has been wired into the game as an image asset. Re-run the same prompt files after the selected image channel is available, then validate and publish the selected PNGs before replacing runtime assets.
