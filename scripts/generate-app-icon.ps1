<#
.SYNOPSIS
    Generates the app icon, favicon and web home-screen icons from the square
    icon artwork (assets/images/app-icon-source.png.jpg, 1024x1024).

.DESCRIPTION
    Outputs:
      assets/images/icon.png          the artwork as-is, full-bleed PNG
                                      (iOS applies its own rounded mask)
      assets/images/favicon.png       64px
      public/apple-touch-icon.png     180px  (Safari "Add to Home Screen")
      public/icon-192.png             192px  (web app manifest)
      public/icon-512.png             512px  (web app manifest)

    The in-app mark, splash and Android adaptive layers are NOT derived from
    this file - they come from the logo lockup via generate-icons.ps1, which
    already yields a clean transparent capsule. Isolating the capsule from the
    tiled artwork proved unreliable (the tile is nearly the same colour as the
    capsule's white half), and the two renderings are the same drawing anyway.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\generate-app-icon.ps1
#>
param([string]$Source = 'assets\images\app-icon-source.png.jpg')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = New-Object System.Drawing.Bitmap((Resolve-Path -LiteralPath $Source).Path)
Write-Host "source: $($src.Width)x$($src.Height)"
$assets = (Resolve-Path -LiteralPath 'assets\images').Path
New-Item -ItemType Directory -Force -Path 'public' | Out-Null
$public = (Resolve-Path -LiteralPath 'public').Path

function Save-Square($img, [int]$size, [string]$out) {
    $c = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($c)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $size, $size); $g.Dispose()
    $c.Save($out, [System.Drawing.Imaging.ImageFormat]::Png); $c.Dispose()
    Write-Host ("  {0,-34} {1}x{1}" -f (Split-Path $out -Leaf), $size)
}
Save-Square $src 1024 (Join-Path $assets 'icon.png')
Save-Square $src 64   (Join-Path $assets 'favicon.png')
Save-Square $src 180  (Join-Path $public 'apple-touch-icon.png')
Save-Square $src 192  (Join-Path $public 'icon-192.png')
Save-Square $src 512  (Join-Path $public 'icon-512.png')
$src.Dispose()
Write-Host 'done.'
