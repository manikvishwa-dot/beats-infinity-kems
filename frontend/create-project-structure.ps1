# ==============================================
# Beats Infinity Frontend Project Structure
# Author : ChatGPT
# ==============================================

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " Creating Beats Infinity Project Structure"
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

#------------------------------------------------
# FOLDERS
#------------------------------------------------

$folders = @(

"src/assets",
"src/assets/images",
"src/assets/icons",
"src/assets/logo",
"src/assets/backgrounds",

"src/components",
"src/components/common",
"src/components/landing",
"src/components/registration",
"src/components/dashboard",
"src/components/admin",

"src/layouts",

"src/pages",

"src/services",

"src/hooks",

"src/utils",

"src/styles",

"src/context",

"src/routes"

)

foreach($folder in $folders){

    New-Item -ItemType Directory -Force -Path $folder | Out-Null

}

#------------------------------------------------
# ROOT FILES
#------------------------------------------------

$files = @(

"src/App.jsx",

"src/main.jsx",

# Layouts

"src/layouts/MainLayout.jsx",
"src/layouts/AdminLayout.jsx",

# Common Components

"src/components/common/Navbar.jsx",
"src/components/common/Footer.jsx",
"src/components/common/PageContainer.jsx",
"src/components/common/PrimaryButton.jsx",
"src/components/common/Loading.jsx",
"src/components/common/SectionTitle.jsx",

# Landing Components

"src/components/landing/HeroSection.jsx",
"src/components/landing/EventInfo.jsx",
"src/components/landing/Features.jsx",
"src/components/landing/Journey.jsx",
"src/components/landing/Gallery.jsx",
"src/components/landing/Testimonials.jsx",
"src/components/landing/CallToAction.jsx",

# Registration Components

"src/components/registration/RegistrationHeader.jsx",
"src/components/registration/RegistrationStepper.jsx",
"src/components/registration/PersonalDetails.jsx",
"src/components/registration/SongSelection.jsx",
"src/components/registration/SongAutocomplete.jsx",
"src/components/registration/ReviewRegistration.jsx",
"src/components/registration/PaymentPage.jsx",
"src/components/registration/SuccessPage.jsx",

# Dashboard Components

"src/components/dashboard/ProfileCard.jsx",
"src/components/dashboard/UpcomingPerformance.jsx",
"src/components/dashboard/Notifications.jsx",

# Admin Components

"src/components/admin/AdminSidebar.jsx",
"src/components/admin/AdminTopbar.jsx",
"src/components/admin/DashboardCards.jsx",

# Pages

"src/pages/Home.jsx",
"src/pages/Registration.jsx",
"src/pages/Login.jsx",
"src/pages/SingerDashboard.jsx",
"src/pages/AdminDashboard.jsx",
"src/pages/SongManagement.jsx",
"src/pages/SingerManagement.jsx",
"src/pages/PairingManagement.jsx",
"src/pages/EventManagement.jsx",
"src/pages/PageNotFound.jsx",

# Services

"src/services/api.js",
"src/services/authService.js",
"src/services/eventService.js",
"src/services/songService.js",
"src/services/songSearchService.js",
"src/services/paymentService.js",
"src/services/singerService.js",

# Context

"src/context/AuthContext.jsx",

# Hooks

"src/hooks/useDebounce.js",
"src/hooks/useCountdown.js",

# Utils

"src/utils/constants.js",
"src/utils/helpers.js",
"src/utils/validators.js",

# Styles

"src/styles/theme.js",
"src/styles/global.css",

# Routes

"src/routes/AppRoutes.jsx"

)

foreach($file in $files){

    if(!(Test-Path $file)){

        New-Item -ItemType File -Path $file | Out-Null

    }

}

Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host " Beats Infinity Structure Created Successfully"
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Folders Created : $($folders.Count)"
Write-Host "Files Created   : $($files.Count)"
Write-Host ""