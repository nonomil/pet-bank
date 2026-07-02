Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr h, int n);
}
"@
$procs = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne "" }
Write-Output "=== chrome windows with title ==="
$procs | ForEach-Object { Write-Output ("  PID={0} Title={1}" -f $_.Id, $_.MainWindowTitle) }
$target = $procs | Where-Object { $_.MainWindowTitle -match 'chatgpt|moment|Just' } | Select-Object -First 1
if ($target) {
  [Win]::ShowWindowAsync($target.MainWindowHandle, 9) | Out-Null
  [Win]::SetForegroundWindow($target.MainWindowHandle) | Out-Null
  Write-Output "=== ACTIVATED: $($target.MainWindowTitle) (PID $($target.Id)) ==="
} else {
  Write-Output "=== no chatgpt/moment chrome window found ==="
}
