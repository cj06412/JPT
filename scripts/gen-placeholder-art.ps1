# One-shot script to (re)generate placeholder art so the codebase runs without
# the real GPT-Image-generated sprites. Run from repo root:
#   powershell -ExecutionPolicy Bypass -File scripts/gen-placeholder-art.ps1
# WARNING: this overwrites everything in assets/sprites with placeholders —
# only run it when you want to reset to placeholders. Replace with real art
# (jpt-stand1/2, jpt-walk1..4, jpt-portrait, 3 expressions) before gifting.
param()

Add-Type -AssemblyName System.Drawing

function Save-Square {
  param([int]$size, [int]$r, [int]$g, [int]$b, [string]$path)
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.Clear([System.Drawing.Color]::FromArgb(255, $r, $g, $b))
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $gfx.Dispose(); $bmp.Dispose()
  Write-Host "wrote $path (${size}x${size} rgb $r,$g,$b)"
}

$root = Split-Path -Parent $PSScriptRoot
New-Item -Force -ItemType Directory "$root\assets\sprites" | Out-Null
New-Item -Force -ItemType Directory "$root\assets\fonts" | Out-Null
New-Item -Force -ItemType Directory "$root\assets\icons" | Out-Null

# Behaviour model: stand (2-frame breathing) + walk (4-frame cycle), each frame
# a SEPARATE square image (matches the real GPT-Image workflow — one file per
# frame). Slightly different tints so frame cycling is visible with placeholders.
Save-Square 256 240 70 70  "$root\assets\sprites\jpt-stand1.png"
Save-Square 256 240 95 95  "$root\assets\sprites\jpt-stand2.png"
Save-Square 256 240 60 60  "$root\assets\sprites\jpt-walk1.png"
Save-Square 256 240 100 60 "$root\assets\sprites\jpt-walk2.png"
Save-Square 256 240 60 100 "$root\assets\sprites\jpt-walk3.png"
Save-Square 256 240 30 30  "$root\assets\sprites\jpt-walk4.png"
Save-Square 256 240 130 90 "$root\assets\sprites\jpt-walk5.png"

Save-Square 256 240 60 60 "$root\assets\sprites\jpt-portrait.png"
Save-Square 256 240 60 60 "$root\assets\sprites\jpt-portrait-smile.png"
Save-Square 256 240 60 60 "$root\assets\sprites\jpt-portrait-think.png"
Save-Square 256 240 60 60 "$root\assets\sprites\jpt-portrait-confused.png"

# Silent placeholder mp3s (44 bytes — valid empty MPEG frame). Real CC0 sounds
# replace these later (see docs note in the v1.5 plan / Task 12).
New-Item -Force -ItemType Directory "$root\assets\sounds" | Out-Null
$silent = [byte[]](0xFF,0xFB,0x90,0x64) + (New-Object byte[] 40)
foreach ($n in @('complete','click','type')) {
  [System.IO.File]::WriteAllBytes("$root\assets\sounds\$n.mp3", $silent)
  Write-Host "wrote $root\assets\sounds\$n.mp3 (silent placeholder)"
}
