# Laurel quickstart for Windows: installs what the one-command entry needs, asks for your testnet account once,
# rehearses without sending anything, then (if you say yes) enters the competition for real.
#
#   powershell -ExecutionPolicy Bypass -File .\quickstart.ps1            # task 5 (default)
#   powershell -ExecutionPolicy Bypass -File .\quickstart.ps1 -Task 4
#   powershell -ExecutionPolicy Bypass -File .\quickstart.ps1 -Trees 40 -Depth 3
#
# Nothing here costs real money: everything runs on NEAR testnet.
param(
  [int]$Task = 5,
  [int]$Trees = 20,
  [int]$Depth = 2,
  [string]$Lr = "0.1",
  [string]$Model = ""
)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

function Say($s) { Write-Host ""; Write-Host "== $s" -ForegroundColor Cyan }
function Fail($s) { Write-Host ""; Write-Host "XX $s" -ForegroundColor Red; exit 1 }

Say "1/5  Checking Node.js and Python"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail "Node.js is not installed. Get the LTS installer at https://nodejs.org (then reopen this window and run the script again)." }
$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 18) { Fail "Node.js $(node --version) is too old; version 18 or newer is needed: https://nodejs.org" }
$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { Fail "Python is not installed. Get 3.10 or newer at https://www.python.org/downloads/ and tick 'Add python.exe to PATH' in the installer." }
$pyv = (python -c "import sys; print('%d.%d' % sys.version_info[:2])")
if ([version]$pyv -lt [version]"3.10") { Fail "Python $pyv is too old; 3.10 or newer is needed: https://www.python.org/downloads/" }
Write-Host "   node $(node --version), python $pyv"

Say "2/5  Installing the Node packages (tools/) and the Python packages"
Push-Location tools
npm install --no-fund --no-audit --loglevel=error
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "npm install failed (see above)" }
Pop-Location
python -m pip install --quiet --disable-pip-version-check scikit-learn pandas numpy
if ($LASTEXITCODE -ne 0) { Fail "pip install failed (see above). Try: python -m pip install scikit-learn pandas numpy" }
Write-Host "   done"

Say "3/5  Your NEAR testnet account"
$envPath = Join-Path $PSScriptRoot ".env"
$have = $false
if (Test-Path $envPath) {
  $txt = Get-Content $envPath -Raw
  if ($txt -match "(?m)^NEAR_ACCOUNT_ID=\S+" -and $txt -match "(?m)^NEAR_PRIVATE_KEY=ed25519:\S+") { $have = $true }
}
if ($have) {
  $id = ([regex]::Match((Get-Content $envPath -Raw), "(?m)^NEAR_ACCOUNT_ID=(\S+)")).Groups[1].Value
  Write-Host "   using $id from .env"
} else {
  Write-Host "   You need a free NEAR *testnet* account and its private key (starts with ed25519:)."
  Write-Host "   Easiest: Meteor Wallet (https://wallet.meteorwallet.app) > create wallet > switch network to TESTNET"
  Write-Host "   > Settings > Security > Export private key. Full steps with pictures: docs/QUICKSTART.md, step 1."
  Write-Host ""
  $id = Read-Host "   Account id (something.testnet)"
  if ($id -notmatch "^[a-z0-9._-]+\.testnet$") { Fail "that does not look like a testnet account id (expected something.testnet)" }
  Write-Host "   Paste the private key below (Ctrl+V or right-click). It stays hidden, shown as *, so nobody can read it off your screen."
  $sec = Read-Host "   Private key (ed25519:...)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim() } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
  if ($key -notmatch "^ed25519:[1-9A-HJ-NP-Za-km-z]{80,100}$") { Fail "that does not look like a NEAR private key (expected ed25519: followed by about 88 characters)" }
  $lines = @()
  if (Test-Path $envPath) { $lines = Get-Content $envPath | Where-Object { $_ -notmatch "^NEAR_(ACCOUNT_ID|PRIVATE_KEY)=" } }
  $lines += "NEAR_ACCOUNT_ID=$id"
  $lines += "NEAR_PRIVATE_KEY=$key"
  Set-Content -Path $envPath -Value $lines -Encoding ASCII
  Write-Host "   saved to .env (this file is ignored by git; never share it)"
}

$extra = @()
if ($Model -ne "") { $extra += @("--model", $Model) } else { $extra += @("--trees", "$Trees", "--depth", "$Depth", "--lr", $Lr) }

Say "4/5  Rehearsal: train, export, let the contract validate and quote the cost (nothing is sent)"
node tools/quickstart.mjs --task $Task @extra --dry
if ($LASTEXITCODE -ne 0) { Fail "the rehearsal stopped (the message above says why)" }

Say "5/5  Enter for real?"
Write-Host "   This stores your model on the contract, pays the task fee and asks the TEE to score it (testnet NEAR only)."
$go = Read-Host "   Type yes to enter, anything else to stop"
if ($go -ne "yes") { Write-Host "   stopped; nothing was sent. Run the script again when ready."; exit 0 }
node tools/quickstart.mjs --task $Task @extra
if ($LASTEXITCODE -ne 0) { Fail "the entry did not complete (the message above says why)" }
Write-Host ""
Write-Host "Done. Open https://laurel-near.vercel.app, connect the same testnet wallet, and find your model on exhibit $Task." -ForegroundColor Green
Write-Host "To share your result, send only the [8/8] result block above. Never send the whole window or the .env file: they can contain your private key." -ForegroundColor Yellow
