<#
.SYNOPSIS
    Generates every MediMind icon asset from the master logo lockup.

.DESCRIPTION
    The supplied logo (assets/images/logo-lockup.png) is a wide banner: the
    capsule-and-brain mark on the left, the MEDIMIND wordmark and tagline on the
    right, all sitting on a solid pale-blue panel (#DDEDF9).

    This script:
      1. crops the mark out of the banner using its measured bounding box
      2. colour-keys the pale-blue panel to transparency, with graded alpha
         across a narrow band so edges do not alias into a hard fringe
      3. renders that mark onto every canvas size and shape the app needs

    Re-run it after replacing logo-lockup.png. If the new artwork has the mark
    in a different position, update the -MarkX/-MarkY/-MarkW/-MarkH parameters;
    the current values were measured from the original file.

.EXAMPLE
    cd "c:\Medimind app\medimind"
    powershell -ExecutionPolicy Bypass -File .\scripts\generate-icons.ps1
#>

param(
    [string]$Source = 'assets\images\logo-lockup.png',
    [string]$OutDir = 'assets\images',
    # Measured bounding box of the mark within the source banner.
    [int]$MarkX = 91,
    [int]$MarkY = 39,
    [int]$MarkW = 181,
    [int]$MarkH = 225,
    # The panel colour to key out, sampled from the artwork.
    [int]$PanelR = 221,
    [int]$PanelG = 237,
    [int]$PanelB = 249
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourcePath = (Resolve-Path -LiteralPath $Source).Path
$outPath = (Resolve-Path -LiteralPath $OutDir).Path
Write-Host "source: $sourcePath"

# ---------------------------------------------------------------------------
# 1. Read the source pixels
# ---------------------------------------------------------------------------
$src = New-Object System.Drawing.Bitmap($sourcePath)
$srcRect = New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Height
$srcData = $src.LockBits($srcRect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$srcStride = $srcData.Stride
$srcBytes = New-Object byte[] ($srcStride * $src.Height)
[System.Runtime.InteropServices.Marshal]::Copy($srcData.Scan0, $srcBytes, 0, $srcBytes.Length)
$src.UnlockBits($srcData)
$src.Dispose()

# ---------------------------------------------------------------------------
# 2. Crop the mark and key the panel colour to transparency
#
#    Manhattan distance from the panel colour drives the alpha:
#      <= 12  -> fully transparent (it is the panel)
#      >= 36  -> fully opaque      (it is artwork)
#      between -> ramped, which keeps antialiased edges smooth
# ---------------------------------------------------------------------------
$mark = New-Object System.Drawing.Bitmap $MarkW, $MarkH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$markRect = New-Object System.Drawing.Rectangle 0, 0, $MarkW, $MarkH
$markData = $mark.LockBits($markRect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$markBytes = New-Object byte[] ($markData.Stride * $MarkH)

for ($y = 0; $y -lt $MarkH; $y++) {
    for ($x = 0; $x -lt $MarkW; $x++) {
        $si = ($y + $MarkY) * $srcStride + ($x + $MarkX) * 4
        $b = $srcBytes[$si]; $g = $srcBytes[$si + 1]; $r = $srcBytes[$si + 2]
        $dist = [math]::Abs($r - $PanelR) + [math]::Abs($g - $PanelG) + [math]::Abs($b - $PanelB)

        if ($dist -le 12) { $a = 0 }
        elseif ($dist -ge 36) { $a = 255 }
        else { $a = [int](($dist - 12) / 24.0 * 255) }

        $mi = $y * $markData.Stride + $x * 4
        $markBytes[$mi] = $b
        $markBytes[$mi + 1] = $g
        $markBytes[$mi + 2] = $r
        $markBytes[$mi + 3] = [byte]$a
    }
}
[System.Runtime.InteropServices.Marshal]::Copy($markBytes, 0, $markData.Scan0, $markBytes.Length)
$mark.UnlockBits($markData)
Write-Host "cropped mark: ${MarkW}x${MarkH}, panel keyed to transparent"

# ---------------------------------------------------------------------------
# 3. Black silhouette, for Android 13+ themed ("monochrome") icons
# ---------------------------------------------------------------------------
$mono = New-Object System.Drawing.Bitmap $MarkW, $MarkH, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$monoData = $mono.LockBits($markRect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$monoBytes = New-Object byte[] ($monoData.Stride * $MarkH)
for ($y = 0; $y -lt $MarkH; $y++) {
    for ($x = 0; $x -lt $MarkW; $x++) {
        $i = $y * $monoData.Stride + $x * 4
        $monoBytes[$i + 3] = $markBytes[$y * $markData.Stride + $x * 4 + 3]
    }
}
[System.Runtime.InteropServices.Marshal]::Copy($monoBytes, 0, $monoData.Scan0, $monoBytes.Length)
$mono.UnlockBits($monoData)

# ---------------------------------------------------------------------------
# 4. Render onto each canvas
# ---------------------------------------------------------------------------
function Save-Canvas {
    param($Image, [int]$Size, [double]$Fraction, $Background, [string]$OutFile)

    $canvas = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($null -ne $Background) { $g.Clear($Background) }
    else { $g.Clear([System.Drawing.Color]::Transparent) }

    # Fit the mark inside `Fraction` of the canvas, preserving aspect ratio.
    $box = $Size * $Fraction
    $scale = [math]::Min($box / $Image.Width, $box / $Image.Height)
    $dw = [int][math]::Round($Image.Width * $scale)
    $dh = [int][math]::Round($Image.Height * $scale)
    $g.DrawImage($Image, [int](($Size - $dw) / 2), [int](($Size - $dh) / 2), $dw, $dh)
    $g.Dispose()

    $canvas.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    Write-Host ("  {0,-32} {1}x{1}" -f (Split-Path $OutFile -Leaf), $Size)
}

$pale = [System.Drawing.Color]::FromArgb(255, $PanelR, $PanelG, $PanelB)

Write-Host "`ngenerating:"

# In-app mark used by <LogoMark/>. 256px is plenty: it renders at 54pt or less,
# so even a 3x-density screen needs under 162px. Keeping it small matters
# because this one IS bundled into the JS bundle, unlike the native icons.
Save-Canvas $mark 256 0.94 $null (Join-Path $outPath 'logo-mark.png')

# iOS / general app icon. MUST be opaque - iOS renders transparency as black.
Save-Canvas $mark 1024 0.72 $pale (Join-Path $outPath 'icon.png')

# Android adaptive icon. The launcher masks the outer ~17% on every side, so
# the artwork is kept inside the central 58% to survive any mask shape.
Save-Canvas $mark 1024 0.58 $null (Join-Path $outPath 'android-icon-foreground.png')
Save-Canvas $mono 1024 0.58 $null (Join-Path $outPath 'android-icon-monochrome.png')

# Splash artwork, drawn over the pale-blue background set in app.json.
Save-Canvas $mark 512 0.86 $null (Join-Path $outPath 'splash-icon.png')

# Web favicon.
Save-Canvas $mark 64 0.82 $pale (Join-Path $outPath 'favicon.png')

# Flat background layer for the Android adaptive icon.
$bg = New-Object System.Drawing.Bitmap 1024, 1024, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bgG = [System.Drawing.Graphics]::FromImage($bg)
$bgG.Clear($pale)
$bgG.Dispose()
$bg.Save((Join-Path $outPath 'android-icon-background.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bg.Dispose()
Write-Host ("  {0,-32} 1024x1024 (solid)" -f 'android-icon-background.png')

$mark.Dispose()
$mono.Dispose()
Write-Host "`ndone."
