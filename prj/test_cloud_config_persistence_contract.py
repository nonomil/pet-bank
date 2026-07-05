import json
import subprocess
from pathlib import Path


def test_cloud_client_supports_local_persisted_config():
    js = Path("js/cloud-client.js").read_text(encoding="utf-8")
    assert "petbank_cloud_config" in js
    assert "configSource" in js
    assert "saveConfig" in js
    assert "clearConfig" in js


def test_persisted_cloud_config_overrides_runtime_defaults():
    script_path = Path("js/cloud-client.js").resolve()
    node_code = f"""
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync({json.dumps(str(script_path))}, 'utf8');
const store = new Map();
const localStorage = {{
  getItem(key) {{
    return store.has(key) ? store.get(key) : null;
  }},
  setItem(key, value) {{
    store.set(key, String(value));
  }},
  removeItem(key) {{
    store.delete(key);
  }}
}};

localStorage.setItem('petbank_cloud_config', JSON.stringify({{
  supabaseUrl: 'https://persisted.supabase.co',
  supabaseAnonKey: 'persisted-anon-key',
  siteUrl: 'http://persisted.local'
}}));

const windowObject = {{
  __PETBANK_CLOUD_CONFIG__: {{
    supabaseUrl: 'https://runtime.supabase.co',
    supabaseAnonKey: 'runtime-anon-key',
    siteUrl: 'http://runtime.local'
  }},
  __PETBANK_CLOUD_CONFIG_SOURCE__: 'cloud-config.local.js',
  __PETBANK_CLOUD_CONFIG_SOURCE_LABEL__: '站点根目录 cloud-config.local.js',
  localStorage
}};
windowObject.window = windowObject;

const context = {{
  window: windowObject,
  localStorage,
  console
}};

vm.createContext(context);
vm.runInContext(source, context);

const config = context.window.CloudClient.getConfig();
const status = context.window.CloudClient.getStatus();
console.log(JSON.stringify({{ config, status }}));
"""
    result = subprocess.run(
        ["node", "-e", node_code],
        cwd=Path.cwd(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr or result.stdout
    payload = json.loads(result.stdout)
    assert payload["config"]["supabaseUrl"] == "https://persisted.supabase.co"
    assert payload["config"]["supabaseAnonKey"] == "persisted-anon-key"
    assert payload["config"]["siteUrl"] == "http://persisted.local"
    assert payload["status"]["configSource"] == "persisted-localstorage"
    assert payload["status"]["configSourceLabel"] == "当前浏览器已保存的云端配置"
    assert payload["status"]["hasRuntimeConfig"] is True
    assert payload["status"]["runtimeConfigShadowedByPersisted"] is True


def test_auth_shell_exposes_cloud_config_actions():
    js = Path("js/auth.js").read_text(encoding="utf-8")
    assert "saveCloudConfig" in js
    assert "clearCloudConfig" in js
    assert "保存云端配置" in js
    assert "清空后会回退到 cloud-config.local.js" in js
    assert "正在覆盖默认注入的云端配置" in js
