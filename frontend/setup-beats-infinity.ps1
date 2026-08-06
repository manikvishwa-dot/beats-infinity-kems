# ============================================================
# Beats Infinity KEMS - Project Setup Script
# Version : 1.0
# Author  : ChatGPT
# ============================================================

Clear-Host

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "      Beats Infinity Karaoke Event Management System" -ForegroundColor Green
Write-Host "               React Project Setup Utility" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

$createdFolders = 0
$createdFiles = 0
$skippedFolders = 0
$skippedFiles = 0

# ------------------------------------------------------------
# Function : Create Folder
# ------------------------------------------------------------

function Create-Folder {

    param([string]$FolderPath)

    if (!(Test-Path $FolderPath)) {

        New-Item -ItemType Directory -Path $FolderPath -Force | Out-Null

        Write-Host "✓ Folder Created : $FolderPath" -ForegroundColor Green

        $script:createdFolders++

    }
    else {

        Write-Host "• Folder Exists  : $FolderPath" -ForegroundColor Yellow

        $script:skippedFolders++

    }

}

# ------------------------------------------------------------
# Function : Create File
# ------------------------------------------------------------

function Create-File {

    param([string]$FilePath)

    if (!(Test-Path $FilePath)) {

        New-Item -ItemType File -Path $FilePath -Force | Out-Null

        Write-Host "✓ File Created   : $FilePath" -ForegroundColor Green

        $script:createdFiles++

    }
    else {

        Write-Host "• File Exists    : $FilePath" -ForegroundColor Yellow

        $script:skippedFiles++

    }

}

# ============================================================
# FOLDERS
# ============================================================

$folders = @(

"src/assets",
"src/assets/branding",
"src/assets/images",
"src/assets/images/hero",
"src/assets/images/events",
"src/assets/images/gallery",
"src/assets/icons",

"src/common",
"src/common/Navbar",
"src/common/Footer",
"src/common/Loader",
"src/common/PageHeader",
"src/common/ScrollToTop",

"src/components",
"src/components/Hero",
"src/components/Statistics",
"src/components/FeaturedEvents",
"src/components/Features",
"src/components/Journey",
"src/components/Gallery",
"src/components/CallToAction",
"src/components/EventCard",
"src/components/SingerCard",
"src/components/SongCard",

"src/config",

"src/hooks",

"src/layouts",

"src/pages",

"src/routes",

"src/services",

"src/theme",

"src/utils"

)

foreach($folder in $folders){

    Create-Folder $folder

}

# ============================================================
# FILES
# ============================================================

$files = @(

# Common

"src/common/Navbar/Navbar.jsx",
"src/common/Navbar/Navbar.css",

"src/common/Footer/Footer.jsx",
"src/common/Footer/Footer.css",

"src/common/Loader/Loader.jsx",
"src/common/Loader/Loader.css",

"src/common/PageHeader/PageHeader.jsx",
"src/common/PageHeader/PageHeader.css",

"src/common/ScrollToTop/ScrollToTop.jsx",

# Components

"src/components/Hero/Hero.jsx",
"src/components/Hero/Hero.css",

"src/components/Statistics/Statistics.jsx",
"src/components/Statistics/Statistics.css",

"src/components/FeaturedEvents/FeaturedEvents.jsx",
"src/components/FeaturedEvents/FeaturedEvents.css",

"src/components/Features/Features.jsx",
"src/components/Features/Features.css",

"src/components/Journey/Journey.jsx",
"src/components/Journey/Journey.css",

"src/components/Gallery/Gallery.jsx",
"src/components/Gallery/Gallery.css",

"src/components/CallToAction/CallToAction.jsx",
"src/components/CallToAction/CallToAction.css",

"src/components/EventCard/EventCard.jsx",
"src/components/EventCard/EventCard.css",

"src/components/SingerCard/SingerCard.jsx",
"src/components/SingerCard/SingerCard.css",

"src/components/SongCard/SongCard.jsx",
"src/components/SongCard/SongCard.css",

# Config

"src/config/assets.js",
"src/config/constants.js",
"src/config/api.js",

# Hooks

"src/hooks/useAuth.js",
"src/hooks/useApi.js",

# Layouts

"src/layouts/MainLayout.jsx",
"src/layouts/AdminLayout.jsx",

# Services

"src/services/authService.js",
"src/services/songService.js",
"src/services/eventService.js",
"src/services/singerService.js",

# Utils

"src/utils/helpers.js",
"src/utils/validators.js"

)

foreach($file in $files){

    Create-File $file

}

Write-Host ""
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host "                 SETUP COMPLETED" -ForegroundColor Green
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Folders Created : $createdFolders" -ForegroundColor Green
Write-Host "Files Created   : $createdFiles" -ForegroundColor Green
Write-Host "Folders Skipped : $skippedFolders" -ForegroundColor Yellow
Write-Host "Files Skipped   : $skippedFiles" -ForegroundColor Yellow

Write-Host ""
Write-Host "Project structure is ready." -ForegroundColor Green
Write-Host ""