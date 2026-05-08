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
$indent = 4
$pad = ' ' * $indent
$sb = [System.Text.StringBuilder]::new()
$col = 0
for ($i = 0; $i -ne $raw.Count; ++$i) {
  $v = [string]$raw[$i]
  if ($col -eq 0) {
    [void]$sb.Append($pad)
    $col = $indent
  } elseif (($col + 1 + $v.Length) -gt 88) {
    [void]$sb.AppendLine(',')
    [void]$sb.Append($pad)
    $col = $indent
  } else {
    [void]$sb.Append(',')
    ++$col
  }
  [void]$sb.Append($v)
  $col += $v.Length
}
$bytes = $sb.ToString()

@"
const computePhashFromRgba = await (async () => {
  const memory = new WebAssembly.Memory({ initial: 16 });
  const { instance } = await WebAssembly.instantiate(new Uint8Array(JSON.parse(``[
$bytes
  ]``)), { env: { memory } });
  const heapBase = instance.exports.__heap_base.value;
  const mem = new Uint8Array(memory.buffer);
  const i32View = new Int32Array(memory.buffer);
  const decoder = new TextDecoder();

  return function computePhashFromRgba(rgba, width, height, sampleSize, hashSize) {
    const rgbaLen = rgba.length;
    if (rgbaLen === 0 || !(width > 0) || !(height > 0) || !(sampleSize > 0) | !(hashSize > 0)) {
      throw new Error("Invalid argument");
    }

    const hexLength = hashSize * hashSize >> 2;

    // Layout at heapBase: [args struct (28)] [rgba data] [output] [heap -->]
    const argsPtr = (heapBase + 3) & ~3;
    const argsBase = argsPtr >> 2;
    const rgbaPtr = argsPtr + 28;
    const outputPtr = rgbaPtr + rgba.length;
    const heapStart = (outputPtr + (hashSize * hashSize >> 2) + 3) & ~3;

    mem.set(rgba, rgbaPtr);

    // struct computePhashFromRgbaArgs
    i32View[argsBase] = rgbaPtr;        // rgba
    i32View[argsBase + 1] = width;      // dims.width
    i32View[argsBase + 2] = height;     // dims.height
    i32View[argsBase + 3] = sampleSize; // hashing.sampleSize
    i32View[argsBase + 4] = hashSize;   // hashing.hashSize
    i32View[argsBase + 5] = outputPtr;  // output
    i32View[argsBase + 6] = heapStart;  // heapStart

    const resultLen = instance.exports.computePhashFromRgba(argsPtr);
    return decoder.decode(mem.slice(outputPtr, outputPtr + resultLen));
  };
})();

const width = 80;
const height = 80;
const sampleSize = 80;
const hashSize = 8;
const rgba = new Uint8Array(width * height * 4).fill(255);

const hash = computePhashFromRgba(rgba, width, height, sampleSize, hashSize);
console.log("hash:", hash);
"@ | Set-Content -Encoding utf8 example.mjs

Write-Host '>> node example.mjs'
& node example.mjs
if ($LASTEXITCODE) { exit $LASTEXITCODE }
