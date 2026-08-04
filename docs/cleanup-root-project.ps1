# ==============================================
# Beats Infinity Repository Cleanup
# Moves old React project files into old-root-project
# ==============================================

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host " Beats Infinity Repository Cleanup"
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$destination = "old-root-project"

# Create destination folder
if (!(Test-Path $destination)) {
    New-Item -ItemType Directory -Path $destination | Out-Null
    Write-Host "Created folder: $destination" -ForegroundColor Green
}
else {
    Write-Host "Folder already exists: $destination" -ForegroundColor Yellow
}

# Files/Folders to move
$items = @(
    "src",
    "public",
    "node_modules",
    "package.json",
    "package-lock.json",
    "vite.config.js",
    "eslint.config.js",
    "index.html"
)

foreach ($item in $items) {

    if (Test-Path $item) {

        Write-Host "Moving $item ..." -ForegroundColor Cyan

        Move-Item `
            -Path $item `
            -Destination $destination `
            -Force

    }
    else {

        Write-Host "$item not found. Skipping." -ForegroundColor DarkGray

    }

}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host " Cleanup Completed Successfully"
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

Write-Host "Current Folder Structure:" -ForegroundColor Yellow
Get-ChildItem