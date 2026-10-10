$ErrorActionPreference = 'Stop'
$exitCode = 0
$statusPath = Join-Path ([IO.Path]::GetTempPath()) 'qianyu-moment-token-status.txt'
$ghPath = 'C:\Program Files\GitHub CLI\gh.exe'
$tokenPointer = [IntPtr]::Zero
$plainToken = $null

Remove-Item -LiteralPath $statusPath -Force -ErrorAction SilentlyContinue
$secureToken = Read-Host 'Paste the new GitHub fine-grained token (input is hidden)' -AsSecureString

try {
  $tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
  $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer).Trim()

  if ($plainToken -notmatch '^github_pat_[A-Za-z0-9_]+$') {
    throw 'Invalid token format. Copy the complete github_pat_... value and try again.'
  }

  $env:GH_TOKEN = $plainToken
  $canPush = & $ghPath api repos/QianyuXIE/QianyuXIE.github.io --jq '.permissions.push' 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw 'GitHub rejected the token. Check that it is complete and QianyuXIE.github.io is selected.'
  }
  if ($canPush.Trim() -ne 'true') {
    throw 'The token is missing Contents: Read and write permission.'
  }

  $plainToken | npx.cmd wrangler secret put GITHUB_TOKEN
  if ($LASTEXITCODE -ne 0) {
    throw 'GitHub accepted the token, but Cloudflare could not save it.'
  }

  [IO.File]::WriteAllText($statusPath, 'success', [Text.UTF8Encoding]::new($false))
  Write-Host 'Success: repository access verified and Cloudflare secret updated.' -ForegroundColor Green
}
catch {
  [IO.File]::WriteAllText($statusPath, ('error: ' + $_.Exception.Message), [Text.UTF8Encoding]::new($false))
  Write-Host $_.Exception.Message -ForegroundColor Red
  $exitCode = 1
}
finally {
  Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
  $plainToken = $null
  if ($tokenPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  }
}

Read-Host 'Press Enter to close this window'
exit $exitCode
