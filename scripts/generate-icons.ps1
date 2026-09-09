Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $PSScriptRoot "..\public\icons"
if (-not (Test-Path $iconsDir)) {
    New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

function Generate-AdminIcon($size, $outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    # Background: Charcoal #2B2420
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 43, 36, 32))
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # Border: Brass #B8874B
    $penWidth = [Math]::Max(2, [float]($size * 0.03))
    $brassPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 184, 135, 75), $penWidth)
    $pad = [float]($size * 0.07)
    $innerSize = [float]($size - (2 * $pad))
    $g.DrawRectangle($brassPen, $pad, $pad, $innerSize, $innerSize)

    # Monogram "A" in Brass
    $fontFamily = New-Object System.Drawing.FontFamily("Georgia")
    $fontSize = [float]($size * 0.46)
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $brassBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 184, 135, 75))
    
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    $rect = New-Object System.Drawing.RectangleF(0, [float]($size * 0.02), [float]$size, [float]$size)
    $g.DrawString("A", $font, $brassBrush, $rect, $format)

    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

function Generate-PartnerIcon($size, $outputPath) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    # Background: Sage #6B7259
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 107, 114, 89))
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # Border: Ivory #FAF7F2
    $penWidth = [Math]::Max(2, [float]($size * 0.03))
    $ivoryPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 250, 247, 242), $penWidth)
    $pad = [float]($size * 0.07)
    $innerSize = [float]($size - (2 * $pad))
    $g.DrawRectangle($ivoryPen, $pad, $pad, $innerSize, $innerSize)

    # Partner Truck / Box drawing in Ivory & Brass
    $ivoryBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 250, 247, 242))
    $charcoalBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 43, 36, 32))
    $brassBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 184, 135, 75))
    $sageBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 107, 114, 89))

    $scale = [float]($size / 100.0)

    # Cargo Box
    $g.FillRectangle($ivoryBrush, [float](22 * $scale), [float](32 * $scale), [float](38 * $scale), [float](30 * $scale))
    
    # Cabin
    $cabinPoints = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(60 * $scale, 42 * $scale),
        [System.Drawing.PointF]::new(72 * $scale, 42 * $scale),
        [System.Drawing.PointF]::new(78 * $scale, 50 * $scale),
        [System.Drawing.PointF]::new(78 * $scale, 62 * $scale),
        [System.Drawing.PointF]::new(60 * $scale, 62 * $scale)
    )
    $g.FillPolygon($ivoryBrush, $cabinPoints)

    # Cabin Window (Cutout)
    $windowPoints = [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(64 * $scale, 45 * $scale),
        [System.Drawing.PointF]::new(71 * $scale, 45 * $scale),
        [System.Drawing.PointF]::new(75 * $scale, 51 * $scale),
        [System.Drawing.PointF]::new(64 * $scale, 51 * $scale)
    )
    $g.FillPolygon($sageBrush, $windowPoints)

    # Wheels (outer dark circle + brass hub)
    $wheelRadius = [float](7 * $scale)
    $w1x = [float](34 * $scale)
    $w2x = [float](68 * $scale)
    $wy = [float](62 * $scale)

    $g.FillEllipse($charcoalBrush, [float]($w1x - $wheelRadius), [float]($wy - $wheelRadius), [float]($wheelRadius * 2), [float]($wheelRadius * 2))
    $g.FillEllipse($charcoalBrush, [float]($w2x - $wheelRadius), [float]($wy - $wheelRadius), [float]($wheelRadius * 2), [float]($wheelRadius * 2))
    
    $hubRadius = [float](3 * $scale)
    $g.FillEllipse($brassBrush, [float]($w1x - $hubRadius), [float]($wy - $hubRadius), [float]($hubRadius * 2), [float]($hubRadius * 2))
    $g.FillEllipse($brassBrush, [float]($w2x - $hubRadius), [float]($wy - $hubRadius), [float]($hubRadius * 2), [float]($hubRadius * 2))

    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Generate-AdminIcon 192 (Join-Path $iconsDir "admin-icon-192.png")
Generate-AdminIcon 512 (Join-Path $iconsDir "admin-icon-512.png")
Generate-PartnerIcon 192 (Join-Path $iconsDir "partner-icon-192.png")
Generate-PartnerIcon 512 (Join-Path $iconsDir "partner-icon-512.png")

Write-Output "Generated all icons successfully."
