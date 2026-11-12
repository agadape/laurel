# Put your NEAR MAINNET account and its private key into .env without the key ever being shown or logged.
#   powershell -ExecutionPolicy Bypass -File tools\mainnet_key.ps1
# The key is typed or pasted into a hidden prompt (shown as *), passed to node in an environment variable that is
# cleared right after, checked against mainnet (read-only), and written to .env, which git ignores.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)
Write-Host ""
Write-Host "Laurel: save a NEAR MAINNET key to .env" -ForegroundColor Cyan
Write-Host "Never paste this key into a chat, an issue or a screenshot. It stays in .env on this computer."
$account = (Read-Host "   Mainnet account (for example yourname.near)").Trim()
Write-Host "   Paste the private key (ed25519:...) OR the 12/24-word seed phrase below (Ctrl+V or right-click). It stays hidden, shown as *."
$sec = Read-Host "   Private key or seed phrase" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
try {
  $env:LAUREL_KEY_IN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
  node tools/mainnet_key.mjs $account
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  Remove-Item Env:LAUREL_KEY_IN -ErrorAction SilentlyContinue
}
Write-Host ""
Write-Host "To share the result, send only the lines above that start with 'saved', 'key' and 'balance'. Never send .env." -ForegroundColor Yellow
