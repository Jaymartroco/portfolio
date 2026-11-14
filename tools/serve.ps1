# Tiny static file server for previewing the portfolio locally.
# Usage: powershell -ExecutionPolicy Bypass -File tools/serve.ps1 [-Port 8095]
param([int]$Port = 8095, [string]$Root = (Split-Path -Parent $PSScriptRoot))

$mime = @{
  '.html'='text/html; charset=utf-8'; '.css'='text/css'; '.js'='application/javascript'
  '.json'='application/json'; '.svg'='image/svg+xml'; '.png'='image/png'; '.jpg'='image/jpeg'
  '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.webp'='image/webp'; '.avif'='image/avif'
  '.ico'='image/x-icon'; '.woff'='font/woff'; '.woff2'='font/woff2'; '.ttf'='font/ttf'
  '.otf'='font/otf'; '.mp4'='video/mp4'; '.webm'='video/webm'; '.txt'='text/plain'; '.pdf'='application/pdf'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    $file = Join-Path $Root $path
    if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }
    if (-not (Test-Path $file -PathType Leaf) -and (Test-Path "$file.html")) { $file = "$file.html" }
    if (Test-Path $file -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($file)
      $ctx.Response.ContentLength64 = $bytes.Length
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $b = [Text.Encoding]::UTF8.GetBytes('Not found')
      $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    }
  } catch { $ctx.Response.StatusCode = 500 } finally { $ctx.Response.Close() }
}
