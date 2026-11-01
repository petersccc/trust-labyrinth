# make-images.ps1
# Regenerates the cropped photos (img/) from Katarina's original photos.
# Run from anywhere:  pwsh -File tools/make-images.ps1 "<folder with the originals and the content JSON>"
param(
  [string]$Source = (Join-Path $PSScriptRoot "..\..\trust labyrinth\trust-labyrinth")
)
$app = Split-Path -Parent $PSScriptRoot
Add-Type -AssemblyName System.Drawing

# Face-centred square crops (spec section 9): face in the upper half,
# shoulders visible. Photo 1 stands right of the image centre.
$PHOTO1 = @{ file = "Katarina_Peters_Foto.jpeg"; x = 349; y = 175; size = 930; out = "photo-1.jpg"; px = 480 }
$PHOTO2 = @{ file = "Photo_1.jpeg"; x = 80; y = 150; size = 1060; out = "photo-2.jpg"; px = 520 }

function C($hex) { [System.Drawing.ColorTranslator]::FromHtml($hex) }
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 87L

New-Item -ItemType Directory -Force (Join-Path $app "img"), (Join-Path $app "og") | Out-Null

foreach ($p in $PHOTO1, $PHOTO2) {
  $img = [System.Drawing.Image]::FromFile((Join-Path $Source $p.file))
  $bmp = New-Object System.Drawing.Bitmap $p.px, $p.px
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $p.px, $p.px), (New-Object System.Drawing.Rectangle $p.x, $p.y, $p.size, $p.size), 'Pixel')
  $bmp.Save((Join-Path $app "img\$($p.out)"), $codec, $ep)
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}

# Link preview images are rendered from tools/og.html (site design, real fonts),
# see the comment at the top of that file.
Write-Host "Photo crops written to img/"
