# Developer utility: generate the PNG PWA icons on Windows; no external assets.
Add-Type -AssemblyName System.Drawing
$iconRoot = Join-Path $PSScriptRoot '..\public\icons'
foreach ($iconSize in @(192, 512)) {
    $bitmap = [System.Drawing.Bitmap]::new($iconSize, $iconSize)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#123e35'))
    $scale = $iconSize / 64.0
    $graphics.ScaleTransform($scale, $scale)
    $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#daed8b'), 3.0)
    $brush = [System.Drawing.SolidBrush]::new($pen.Color)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc(19, 14, 10, 10, 180, 90)
    $path.AddArc(35, 14, 10, 10, 270, 90)
    $path.AddArc(35, 38, 10, 10, 0, 90)
    $path.AddArc(19, 38, 10, 10, 90, 90)
    $path.CloseFigure()
    $graphics.DrawPath($pen, $path)
    $graphics.DrawLine($pen, 20, 30, 44, 30)
    $graphics.DrawLine($pen, 26, 21, 38, 21)
    $graphics.DrawLine($pen, 24, 48, 24, 52)
    $graphics.DrawLine($pen, 40, 48, 40, 52)
    $graphics.FillEllipse($brush, 24, 38, 5, 5)
    $graphics.FillEllipse($brush, 35, 38, 5, 5)
    $bitmap.Save((Join-Path $iconRoot "icon-$iconSize.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    if ($iconSize -eq 512) {
        $bitmap.Save((Join-Path $iconRoot 'maskable-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    }
    $path.Dispose(); $brush.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
