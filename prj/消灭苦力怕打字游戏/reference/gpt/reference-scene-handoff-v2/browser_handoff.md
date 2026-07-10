# Browser Handoff

Use this folder when image generation should happen in a logged-in browser rather than an API.

## Before starting

1. Load `web-access`.
2. Load `browser-act` and follow its startup instructions first.
3. Use the prompt in `browser_prompt.txt`.
4. For ChatGPT webpage generation, follow:
   `.codex/skills/gpt-image-ui-assets/references/browser-act-chatgpt.md`

## Suggested route

- Target site: ChatGPT or the image site the user requested
- Prompt file: `browser_prompt.txt`
- Raw downloads folder: `downloads/raw`
- Selected outputs folder: `downloads/selected`

## Browser checklist

1. Open the target site in a logged-in browser session.
2. Paste the prompt from `browser_prompt.txt`.
3. Generate the requested variants.
4. Save a screenshot of the generated page.
5. Download raw files into `downloads/raw`.
   - For ChatGPT signed image URLs, direct download can fail.
   - If needed, use browser-act page `eval` with in-page `fetch(img.src)` and decode the returned data URL locally.
6. Copy the kept outputs into `downloads/selected`.
7. If later post-processing is needed, run this workspace again with `split`, `publish-transparent`, `post-process`, or `remove-bg`.
8. Close only the browser-act sessions created for this run.

## Minimum verification

- Raw generated image opens and has the expected dimensions/mode.
- Split count is documented, including prompt deviations.
- Published PNG/WebP paths exist in `publish_manifest.json`.
- Transparent assets pass edge-alpha checks.
- A local webpage loads semantic asset filenames with `naturalWidth > 0`.
- A browser screenshot and one real interaction metric are saved.

## Notes

- If the site blocks automation, stop at the highest useful handoff point.
- If transparent assets are needed, prefer prompts that say `transparent background, no checkerboard pattern`.
- Keep a short note about what was kept or rejected in `manifest.json`.
