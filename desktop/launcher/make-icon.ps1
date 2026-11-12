# Draws the Protok mark and writes protok.ico (PNG-compressed entries, 16 to 256 px).
#   powershell -ExecutionPolicy Bypass -File make-icon.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot 'protok.ico'
$sizes = 256, 64, 48, 32, 16
$pngs = @()
foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $k = $s / 40.0
  $r = 11 * $k; $x = 1 * $k; $w = 38 * $k
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($x, $x, 2*$r, 2*$r, 180, 90)
  $path.AddArc($x + $w - 2*$r, $x, 2*$r, 2*$r, 270, 90)
  $path.AddArc($x + $w - 2*$r, $x + $w - 2*$r, 2*$r, 2*$r, 0, 90)
  $path.AddArc($x, $x + $w - 2*$r, 2*$r, 2*$r, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.PointF 0, 0), (New-Object System.Drawing.PointF $s, $s), ([System.Drawing.Color]::FromArgb(255, 124, 156, 255)), ([System.Drawing.Color]::FromArgb(255, 61, 217, 193))
  $g.FillPath($brush, $path)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ([Math]::Max(1.5, 3.2 * $k))
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $wave = New-Object System.Drawing.Drawing2D.GraphicsPath
  $wave.AddBezier((8*$k), (25*$k), (13*$k), (25*$k), (13*$k), (15*$k), (18*$k), (15*$k))
  $wave.AddBezier((18*$k), (15*$k), (23*$k), (15*$k), (23*$k), (25*$k), (28*$k), (25*$k))
  $wave.AddBezier((28*$k), (25*$k), (31*$k), (25*$k), (32*$k), (18*$k), (32*$k), (18*$k))
  $g.DrawPath($pen, $wave)
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $pngs += ,$ms.ToArray()
}
$fs = [System.IO.File]::Create($out)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]; $d = $pngs[$i]
  $b = if ($s -ge 256) { 0 } else { $s }
  $bw.Write([byte]$b); $bw.Write([byte]$b); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32); $bw.Write([UInt32]$d.Length); $bw.Write([UInt32]$offset)
  $offset += $d.Length
}
foreach ($d in $pngs) { $bw.Write($d) }
$bw.Close()
Write-Output "wrote $out"
