$ErrorActionPreference = 'Stop'

$lines = Get-Content phash.c
$commands = @()
$inBlock = $false
foreach ($line in $lines) {
  if ($line -eq '/*') { $inBlock = $true; continue }
  if ($line -eq '*/') { break }
  if ($inBlock -and $line.Trim()) { $commands += $line.Trim() }
}
if (-not $commands) {
  Write-Error 'No commands found between /* and */ in phash.c'
  exit 1
}

foreach ($cmd in $commands) {
  $parts = [regex]::Matches($cmd, '(?:''[^'']*''|"[^"]*"|\S)+') | ForEach-Object { $_.Value }
  $exe = $parts[0]
  $args_ = $parts[1..($parts.Count - 1)]

  $resolved = Get-Command $exe -ErrorAction SilentlyContinue
  if ($resolved) {
    $exe = $resolved.Source
  } elseif ($IsWindows -and (Test-Path "C:\Program Files\LLVM\bin\$exe.exe")) {
    $exe = "C:\Program Files\LLVM\bin\$exe.exe"
  } else {
    $msg = "$exe not found in PATH"
    if ($IsWindows) { $msg += ' or C:\Program Files\LLVM\bin' }
    Write-Error $msg
    exit 1
  }

  Write-Host ">> $exe $($args_ -join ' ')"
  & $exe @args_
  if ($LASTEXITCODE) { exit $LASTEXITCODE }
}

$raw = [System.IO.File]::ReadAllBytes("$PWD/phash.wasm")
$hex = [System.BitConverter]::ToString($raw) -replace '-'
$limit = 86
$sb = [System.Text.StringBuilder]::new()
for ($i = 0; $i -lt $hex.Length; $i += $limit) {
  [void]$sb.Append($hex.Substring($i, [Math]::Min($limit, $hex.Length - $i)))
  [void]$sb.Append("\`n")
}
$hex = $sb.ToString()

@"
const computePhashFromRgba = await (async () => {
  const memory = new WebAssembly.Memory({ initial: 16 });
  const { instance: { exports } } = await WebAssembly.instantiate(Uint8Array.fromHex(``\`n$hex``), { env: { memory } });
  const fn = exports.computePhashFromRgba;
  const heapBase = exports.__heap_base.value;
  const mem = new Uint8Array(memory.buffer);
  const decoder = new TextDecoder();

  return function computePhashFromRgba(rgba, width, height, sampleSize, hashSize) {
    const rgbaLen = rgba.length;
    if (rgbaLen === 0 || !(width >= 1) || !(height >= 1) || !(sampleSize >= 1) | !(hashSize >= 1)) {
      throw new Error("Invalid argument");
    }

    // Layout at heapBase: [rgba data] [output] [heap -->]
    const rgbaPtr = (heapBase + 3) & ~3;
    const outputPtr = rgbaPtr + rgbaLen;
    const heapStart = (outputPtr + (hashSize * hashSize >> 2) + 3) & ~3;

    mem.set(rgba, rgbaPtr);

    const len = fn(rgbaPtr, width, height, sampleSize, hashSize, outputPtr, heapStart);
    return decoder.decode(mem.slice(outputPtr, outputPtr + len));
  };
})();

const width = 80;
const height = 80;
const sampleSize = 80;
const hashSize = 8;
const ab = new ArrayBuffer(width * height << 2);
const u8 = new Uint8Array(ab);
const u32 = new Uint32Array(ab);

console.log("hash white:", computePhashFromRgba(u8.fill(255), width, height, sampleSize, hashSize));
console.log("hash red:", computePhashFromRgba((u32.fill(0xFF000080), u8), width, height, sampleSize, hashSize));
console.log("hash black:", computePhashFromRgba((u32.fill(0xFF000000), u8), width, height, sampleSize, hashSize));
console.log("hash random:", computePhashFromRgba((u32.forEach((_, i, a) => void (a[i] = Math.floor(Math.random() * (0xFFFFFFFF + 1)))), u8), width, height, sampleSize, hashSize));
"@ | Set-Content -Encoding utf8 example.mjs

Write-Host '>> node example.mjs'
& node example.mjs
if ($LASTEXITCODE) { exit $LASTEXITCODE }
