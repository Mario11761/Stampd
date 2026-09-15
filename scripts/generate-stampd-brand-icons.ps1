Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

function New-RoundedRectanglePath {
  param(
    [System.Drawing.RectangleF]$Bounds,
    [single]$Radius
  )

  $diameter = [single]($Radius * 2)
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddArc($Bounds.X, $Bounds.Y, $diameter, $diameter, 180, 90)
  $path.AddArc($Bounds.Right - $diameter, $Bounds.Y, $diameter, $diameter, 270, 90)
  $path.AddArc($Bounds.Right - $diameter, $Bounds.Bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($Bounds.X, $Bounds.Bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()

  return $path
}

function New-StampdMarkPng {
  param(
    [string]$OutputPath,
    [int]$Size,
    [single]$MarkScale,
    [string]$MarkColor,
    [string]$BackgroundColor,
    [bool]$TransparentBackground
  )

  $bitmap = [System.Drawing.Bitmap]::new(
    $Size,
    $Size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($TransparentBackground) {
      $graphics.Clear([System.Drawing.Color]::Transparent)
    } else {
      $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($BackgroundColor))
    }

    $markSize = [single]($Size * $MarkScale)
    $strokeWidth = [single]($markSize * (2 / 34))
    $cornerRadius = [single]($markSize * (11 / 34))
    $dotSize = [single]($markSize * (12 / 34))
    $markBounds = [System.Drawing.RectangleF]::new(
      [single](-$markSize / 2),
      [single](-$markSize / 2),
      $markSize,
      $markSize
    )

    $graphics.TranslateTransform([single]($Size / 2), [single]($Size / 2))
    $graphics.RotateTransform(-7)

    $path = New-RoundedRectanglePath -Bounds $markBounds -Radius $cornerRadius
    $pen = [System.Drawing.Pen]::new(
      [System.Drawing.ColorTranslator]::FromHtml($MarkColor),
      $strokeWidth
    )
    $brush = [System.Drawing.SolidBrush]::new(
      [System.Drawing.ColorTranslator]::FromHtml($MarkColor)
    )

    try {
      $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $graphics.DrawPath($pen, $path)
      $graphics.FillEllipse(
        $brush,
        [single](-$dotSize / 2),
        [single](-$dotSize / 2),
        $dotSize,
        $dotSize
      )
    } finally {
      $brush.Dispose()
      $pen.Dispose()
      $path.Dispose()
    }

    $outputDirectory = [System.IO.Path]::GetDirectoryName($OutputPath)
    [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function New-SolidPng {
  param(
    [string]$OutputPath,
    [int]$Size,
    [string]$BackgroundColor
  )

  $bitmap = [System.Drawing.Bitmap]::new(
    $Size,
    $Size,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($BackgroundColor))
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$workspaceRoot = [System.IO.Path]::GetDirectoryName($projectRoot)
$appImages = Join-Path $projectRoot 'assets\images'
$workerPublic = Join-Path $workspaceRoot 'stampd-identity-worker\public'

$darkGreen = '#09110D'
$mint = '#7FFFB8'

New-StampdMarkPng `
  -OutputPath (Join-Path $workerPublic 'stampd-icon.png') `
  -Size 512 `
  -MarkScale 0.54 `
  -MarkColor $mint `
  -BackgroundColor $darkGreen `
  -TransparentBackground $false

New-StampdMarkPng `
  -OutputPath (Join-Path $appImages 'icon.png') `
  -Size 1024 `
  -MarkScale 0.54 `
  -MarkColor $mint `
  -BackgroundColor $darkGreen `
  -TransparentBackground $false

New-StampdMarkPng `
  -OutputPath (Join-Path $appImages 'android-icon-foreground.png') `
  -Size 512 `
  -MarkScale 0.48 `
  -MarkColor $mint `
  -BackgroundColor $darkGreen `
  -TransparentBackground $true

New-SolidPng `
  -OutputPath (Join-Path $appImages 'android-icon-background.png') `
  -Size 512 `
  -BackgroundColor $darkGreen

New-StampdMarkPng `
  -OutputPath (Join-Path $appImages 'android-icon-monochrome.png') `
  -Size 432 `
  -MarkScale 0.48 `
  -MarkColor '#FFFFFF' `
  -BackgroundColor $darkGreen `
  -TransparentBackground $true

Write-Output 'Stampd brand icon assets generated.'
