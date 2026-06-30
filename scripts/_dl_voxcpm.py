import os
os.environ['HF_ENDPOINT'] = 'https://hf-mirror.com'
# Some new hub versions gate mirror support behind this
os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
print('HF_ENDPOINT =', os.environ['HF_ENDPOINT'], flush=True)
try:
    from huggingface_hub import snapshot_download
    p = snapshot_download('openbmb/VoxCPM2', endpoint='https://hf-mirror.com')
    print('DOWNLOADED_TO', p, flush=True)
except Exception as e:
    import traceback
    traceback.print_exc()
    print('SNAPSHOT_FAILED:', repr(e), flush=True)
    # fallback: voxcpm native loader
    try:
        from voxcpm import VoxCPM
        m = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False)
        print('MODEL_LOADED_OK', flush=True)
    except Exception as e2:
        import traceback
        traceback.print_exc()
        print('FROM_PRETRAINED_FAILED:', repr(e2), flush=True)
