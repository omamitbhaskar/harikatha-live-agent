# ═══════════════════════════════════════════════════════════════
#  Harikatha Live Agent — Session 2 Migration
#  Run from: C:\Users\radha\Projects\harikatha-live-agent
# ═══════════════════════════════════════════════════════════════

# STEP 0: Safety — backup your current working files
# ───────────────────────────────────────────────────
Write-Host "Step 0: Backing up current files..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "backup-session1" -Force
Copy-Item "src\main.py" "backup-session1\main.py.bak" -Force
Copy-Item "Dockerfile" "backup-session1\Dockerfile.bak" -Force
Copy-Item "requirements.txt" "backup-session1\requirements.txt.bak" -Force
Copy-Item "scripts\deploy.sh" "backup-session1\deploy.sh.bak" -Force
Write-Host "  Backup saved to backup-session1\" -ForegroundColor Green

# STEP 1: Extract session2 zip into a temp folder
# ─────────────────────────────────────────────────
Write-Host "`nStep 1: Extract session2 zip..." -ForegroundColor Yellow
# First, copy the downloaded zip here (adjust path if needed):
#   Copy-Item "$HOME\Downloads\harikatha-live-agent-session2.zip" .
Expand-Archive -Path "harikatha-live-agent-session2.zip" -DestinationPath "session2-temp" -Force
Write-Host "  Extracted to session2-temp\" -ForegroundColor Green

# STEP 2: Add NEW frontend files (these don't exist yet)
# ──────────────────────────────────────────────────────
Write-Host "`nStep 2: Adding frontend files..." -ForegroundColor Yellow
Copy-Item "session2-temp\frontend\index.html" "frontend\index.html" -Force
New-Item -ItemType Directory -Path "frontend\css" -Force | Out-Null
Copy-Item "session2-temp\frontend\css\style.css" "frontend\css\style.css" -Force
New-Item -ItemType Directory -Path "frontend\js" -Force | Out-Null
Copy-Item "session2-temp\frontend\js\audio-utils.js" "frontend\js\audio-utils.js" -Force
Copy-Item "session2-temp\frontend\js\gemini-live.js" "frontend\js\gemini-live.js" -Force
Copy-Item "session2-temp\frontend\js\app.js" "frontend\js\app.js" -Force
Write-Host "  Frontend files added" -ForegroundColor Green

# STEP 3: Replace src/main.py (the big one — new WebSocket proxy)
# ────────────────────────────────────────────────────────────────
Write-Host "`nStep 3: Replacing src/main.py with WebSocket proxy version..." -ForegroundColor Yellow
Copy-Item "session2-temp\src\main.py" "src\main.py" -Force
Write-Host "  src\main.py replaced" -ForegroundColor Green

# STEP 4: Replace Dockerfile and requirements.txt
# ─────────────────────────────────────────────────
Write-Host "`nStep 4: Replacing Dockerfile and requirements.txt..." -ForegroundColor Yellow
Copy-Item "session2-temp\Dockerfile" "Dockerfile" -Force
Copy-Item "session2-temp\requirements.txt" "requirements.txt" -Force
Write-Host "  Dockerfile + requirements.txt replaced" -ForegroundColor Green

# STEP 5: Replace deploy script
# ──────────────────────────────
Write-Host "`nStep 5: Replacing deploy script..." -ForegroundColor Yellow
Copy-Item "session2-temp\scripts\deploy.sh" "scripts\deploy.sh" -Force
Write-Host "  scripts\deploy.sh replaced" -ForegroundColor Green

# STEP 6: Copy deployment guide
# ──────────────────────────────
Write-Host "`nStep 6: Adding deployment guide..." -ForegroundColor Yellow
Copy-Item "session2-temp\DEPLOY-SESSION2.md" "DEPLOY-SESSION2.md" -Force
Write-Host "  DEPLOY-SESSION2.md added" -ForegroundColor Green

# STEP 7: Cleanup temp folder
# ────────────────────────────
Write-Host "`nStep 7: Cleaning up..." -ForegroundColor Yellow
Remove-Item "session2-temp" -Recurse -Force
Write-Host "  Temp folder removed" -ForegroundColor Green

# ── DONE ──
Write-Host "`n═══════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Migration complete!" -ForegroundColor Cyan
Write-Host "  Backup in: backup-session1\" -ForegroundColor Cyan
Write-Host "  Now test locally:" -ForegroundColor Cyan
Write-Host '    $env:GOOGLE_API_KEY = "your-key"' -ForegroundColor White
Write-Host '    $env:GCP_PROJECT = "harikatha-live-agent"' -ForegroundColor White
Write-Host '    uvicorn src.main:app --reload --port 8080' -ForegroundColor White
Write-Host "═══════════════════════════════════════" -ForegroundColor Cyan
