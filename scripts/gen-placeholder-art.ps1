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

$root = Split-Path -Parent $PSScriptRoot
New-Item -Force -ItemType Directory "$root\assets\sprites" | Out-Null
New-Item -Force -ItemType Directory "$root\assets\fonts" | Out-Null
New-Item -Force -ItemType Directory "$root\assets\icons" | Out-Null

Save-RedSquare 96 128 "$root\assets\sprites\jpt-walk.png"
Save-RedSquare 256 256 "$root\assets\sprites\jpt-portrait.png"
