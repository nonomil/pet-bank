import os, time
# Do NOT use mirror — it 302-redirects back to huggingface.co and breaks hub 1.17 metadata.
os.environ.pop('HF_ENDPOINT', None)
os.environ['HF_HUB_DOWNLOAD_TIMEOUT'] = '120'
os.environ['HF_HUB_DISABLE_PROGRESS_BARS'] = '0'
from huggingface_hub import snapshot_download
t0 = time.time()
print('START direct snapshot_download openbmb/VoxCPM2', flush=True)
p = snapshot_download(
    'openbmb/VoxCPM2',
    max_workers=4,
)
print('DOWNLOADED_TO', p, flush=True)
print('ELAPSED', round(time.time()-t0, 1), 's', flush=True)
