$port = 8001
$path = (Get-Location).Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "Listening on http://localhost:$port/"
Write-Host "Press Ctrl+C to stop..."

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ($urlPath -eq "") {
            $urlPath = "index.html"
        }
        
        $filePath = Join-Path $path $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            if ($filePath -match '\.env$') {
                $response.StatusCode = 403
                Write-Host "403 Forbidden - $urlPath"
            } else {
                $content = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $content.Length
                
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                switch ($ext) {
                    ".html" { $response.ContentType = "text/html" }
                    ".css"  { $response.ContentType = "text/css" }
                    ".js"   { $response.ContentType = "application/javascript" }
                    default { $response.ContentType = "application/octet-stream" }
                }

                $response.OutputStream.Write($content, 0, $content.Length)
                Write-Host "200 OK - $urlPath"
            }
        } else {
            $response.StatusCode = 404
            Write-Host "404 Not Found - $urlPath"
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
