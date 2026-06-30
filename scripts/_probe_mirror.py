import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
import requests
print('requests version', requests.__version__)
# Probe what the mirror returns for a file HEAD
r = requests.head('https://hf-mirror.com/openbmb/VoxCPM2/resolve/main/config.json', allow_redirects=True, timeout=30)
print('status', r.status_code)
print('url_after_redirect', r.url)
for k, v in r.headers.items():
    print('HDR', k, '=', v)
