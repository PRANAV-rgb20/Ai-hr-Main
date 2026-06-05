# Lumen HR — Start Backend + Frontend
# Run this from the ai-hr-main directory

Write-Host "Starting Lumen HR..." -ForegroundColor Cyan

# Kill any stale processes on our ports
$ports = @(8000, 3000)
foreach ($port in $ports) {
    $pid = (netstat -ano | Select-String ":$port " | ForEach-Object { ($_ -split '\s+')[-1] } | Select-Object -First 1)
    if ($pid) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }
}

# Start backend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; .venv\Scripts\activate; uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -WorkingDirectory "$PSScriptRoot\backend"

Start-Sleep -Seconds 3

# Start frontend in a new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm start" -WorkingDirectory "$PSScriptRoot\frontend"

Write-Host "Backend: http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Yellow
