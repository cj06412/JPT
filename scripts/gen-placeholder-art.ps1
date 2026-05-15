# One-shot script to (re)generate red-square placeholder art so the codebase runs
# without the real GPT-Image-generated sprites. Run from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/gen-placeholder-art.ps1
# Replace these PNGs with real art before gifting.
param()

Add-Type -AssemblyName System.Drawing

function Save-RedSquare {
  param([int]$w, [int]$h, [string]$path)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(255, 240, 60, 60))
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "wrote $path ($w x $h)"
}

# v1.5: walk sprite is now a 4-frame horizontal sheet (each frame 96x128 -> 384x128).
# Placeholder = 4 red squares with slightly different brightness so frame cycling is visible.
function Save-WalkSheet {
  param([string]$path)
  $bmp = New-Object System.Drawing.Bitmap 384, 128
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $shades = @(60, 90, 60, 30)
  for ($i = 0; $i -lt 4; $i++) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 240, $shades[$i], $shades[$i]))
    $g.FillRectangle($brush, ($i*96), 0, 96, 128)
    $brush.Dispose()
  }
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "wrote $path (384x128, 4 frames)"
}

$root = Split-Path -Parent $PSScriptRoot
New-Item -Force -ItemType Directory "$root\assets\sprites" | Out-Null
New-Item -Force -ItemType Directory "$root\assets\fonts" | Out-Null
New-Item -Force -ItemType Directory "$root\assets\icons" | Out-Null

Save-WalkSheet "$root\assets\sprites\jpt-walk.png"
Save-RedSquare 256 256 "$root\assets\sprites\jpt-portrait.png"
Save-RedSquare 256 256 "$root\assets\sprites\jpt-portrait-smile.png"
Save-RedSquare 256 256 "$root\assets\sprites\jpt-portrait-think.png"
Save-RedSquare 256 256 "$root\assets\sprites\jpt-portrait-confused.png"

# Silent placeholder mp3s (44 bytes — valid empty MPEG frame). Real CC0 SDV
# sounds replace these later (see docs note in Task 9).
New-Item -Force -ItemType Directory "$root\assets\sounds" | Out-Null
$silent = [byte[]](0xFF,0xFB,0x90,0x64) + (New-Object byte[] 40)
foreach ($n in @('complete','click','type')) {
  [System.IO.File]::WriteAllBytes("$root\assets\sounds\$n.mp3", $silent)
  Write-Host "wrote $root\assets\sounds\$n.mp3 (silent placeholder)"
}
