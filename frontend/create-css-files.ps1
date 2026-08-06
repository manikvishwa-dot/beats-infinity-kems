# ===========================================
# Beats Infinity KEMS
# Create CSS Files
# ===========================================

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Creating CSS Files..." -ForegroundColor Green
Write-Host "======================================"
Write-Host ""

$root = ".\src"

# Create folders if they don't exist
$folders = @(
    "$root\common",
    "$root\components\Hero",
    "$root\components\Stats",
    "$root\components\Events",
    "$root\components\Features",
    "$root\components\Journey",
    "$root\components\Gallery",
    "$root\components\CTA",
    "$root\components\Footer"
)

foreach ($folder in $folders) {
    if (!(Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder | Out-Null
        Write-Host "Created Folder : $folder" -ForegroundColor Yellow
    }
}

# CSS files to create
$files = @(
    "$root\common\Navbar.css",

    "$root\components\Hero\Hero.css",

    "$root\components\Stats\Stats.css",

    "$root\components\Events\Events.css",

    "$root\components\Features\Features.css",

    "$root\components\Journey\Journey.css",

    "$root\components\Gallery\Gallery.css",

    "$root\components\CTA\CTA.css",

    "$root\components\Footer\Footer.css"
)

foreach ($file in $files) {

    if (!(Test-Path $file)) {

        New-Item -ItemType File -Path $file | Out-Null

        Write-Host "Created File : $file" -ForegroundColor Green

    }
    else {

        Write-Host "Already Exists : $file" -ForegroundColor Cyan

    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "All CSS files are ready!" -ForegroundColor Green
Write-Host "======================================"
Write-Host ""