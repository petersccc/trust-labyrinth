# make-images.ps1
# Regenerates the cropped photos (img/) and the 1200x630 link preview
# images (og/) from Katarina's original photos and the content file.
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

# Link preview images: the opening slide look, one per language.
$json = [IO.File]::ReadAllText((Join-Path $Source "trust-labyrinth-content.json"), [Text.Encoding]::UTF8) | ConvertFrom-Json
$open = $json.slide_1_opening
$photo = [System.Drawing.Image]::FromFile((Join-Path $Source $PHOTO1.file))
$sizes = @{ de = 56; en = 66; zh = 76 }
foreach ($lang in 'de', 'en', 'zh') {
  $title = ($open | Where-Object element -eq 'Title').$lang
  $caption = ($open | Where-Object element -eq 'Caption under photo').$lang
  $bmp = New-Object System.Drawing.Bitmap 1200, 630
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.InterpolationMode = 'HighQualityBicubic'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear((C '#F3EEE4'))
  # Three broken rings, scaled from the opening slide SVG (viewBox 170).
  $cx = 320; $cy = 300; $s = 2.75
  $olive = New-Object System.Drawing.Pen (C '#6B6B3A'), 8
  $tan = New-Object System.Drawing.Pen (C '#C4A47C'), 8
  foreach ($r in @(@(80, 80, 315.2, $olive), @(70, 200, 294.6, $tan), @(60, 320, 305.6, $olive))) {
    $rr = $r[0] * $s
    $g.DrawArc($r[3], [float]($cx - $rr), [float]($cy - $rr), [float](2 * $rr), [float](2 * $rr), [float]$r[1], [float]$r[2])
  }
  $g.DrawLine($olive, $cx, [float]($cy - 80 * $s), $cx, [float]($cy - 70 * $s))
  $g.DrawLine($tan, [float]($cx - 70 * $s), $cy, [float]($cx - 60 * $s), $cy)
  $g.DrawLine($tan, [float]($cx + 60 * $s), $cy, [float]($cx + 70 * $s), $cy)
  $g.DrawLine($olive, $cx, [float]($cy + 60 * $s), $cx, [float]($cy + 70 * $s))
  $d = 114 * $s; $px = $cx - $d / 2; $py = $cy - $d / 2
  $g.FillEllipse((New-Object System.Drawing.SolidBrush (C '#FAF7F1')), [float]($px - 8), [float]($py - 8), [float]($d + 16), [float]($d + 16))
  $clip = New-Object System.Drawing.Drawing2D.GraphicsPath
  $clip.AddEllipse([float]$px, [float]$py, [float]$d, [float]$d)
  $g.SetClip($clip)
  $g.DrawImage($photo, (New-Object System.Drawing.RectangleF $px, $py, $d, $d), (New-Object System.Drawing.RectangleF $PHOTO1.x, $PHOTO1.y, $PHOTO1.size, $PHOTO1.size), 'Pixel')
  $g.ResetClip()
  $fontName = if ($lang -eq 'zh') { 'Microsoft YaHei' } else { 'Segoe UI' }
  $ink = New-Object System.Drawing.SolidBrush (C '#3B2A20')
  $center = New-Object System.Drawing.StringFormat; $center.Alignment = 'Center'
  $capFont = New-Object System.Drawing.Font $fontName, 22, ([System.Drawing.FontStyle]::Italic), 'Pixel'
  $g.DrawString($caption, $capFont, $ink, (New-Object System.Drawing.RectangleF ($cx - 250), 552, 500, 40), $center)
  $titleFont = New-Object System.Drawing.Font $fontName, $sizes[$lang], ([System.Drawing.FontStyle]::Regular), 'Pixel'
  $left = New-Object System.Drawing.StringFormat; $left.Alignment = 'Near'; $left.LineAlignment = 'Center'
  $g.DrawString($title, $titleFont, $ink, (New-Object System.Drawing.RectangleF 610, 190, 570, 220), $left)
  $line = New-Object System.Drawing.Pen (C '#C4A47C'), 2
  $g.DrawLine($line, 616, 180, 1120, 180); $g.DrawLine($line, 616, 420, 1120, 420)
  $small = New-Object System.Drawing.Font 'Segoe UI', 22, ([System.Drawing.FontStyle]::Italic), 'Pixel'
  $g.DrawString('Peters Cross-Cultural Communication', $small, (New-Object System.Drawing.SolidBrush (C '#8A7A66')), 616, 440)
  $bmp.Save((Join-Path $app "og\og-image-$lang.jpg"), $codec, $ep)
  $g.Dispose(); $bmp.Dispose()
}
$photo.Dispose()
Write-Host "Images written to img/ and og/"
