* [33m941851d[m[33m ([m[1;31morigin/5/30/2026/v1[m[33m, [m[1;32m5/30/2026/v1[m[33m)[m feat(offline): enhance cache hydration and chatbot offline flows
* [33m685910f[m 2 AI API + Marti AI
* [33m1d4e740[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mbackup-5-30-main[m[33m, [m[1;31morigin/main[m[33m, [m[1;31morigin/backup-5-30-main[m[33m, [m[1;31morigin/HEAD[m[33m, [m[1;32mmain[m[33m)[m chore: bump version to v1.8.7
* [33m5d65aa8[m[33m ([m[1;31morigin/chatbot-intelligence[m[33m, [m[1;32mchatbot-intelligence[m[33m)[m feat: improve chatbot intelligence, override handling, and API fallback
* [33mc82f361[m[33m ([m[1;31morigin/main-backup-5/26/26[m[33m, [m[1;32mmain-backup-5/26/26[m[33m)[m fix: force deploy latest changes
* [33mda7444f[m test: trigger vercel deploy
* [33meb24a36[m test: trigger vercel deploy
* [33m584851f[m test: trigger vercel deploy
* [33m2327e0d[m test: trigger vercel deploy
* [33meaadb0d[m test: trigger vercel deploy
* [33m981e427[m chore: force build
* [33m24a0d1d[m chore: trigger Vercel redeploy
* [33m22b342c[m chore: force Vercel redeploy
* [33m0d89ffb[m refactor: add reusable AppBackButton and fix active session tracking bugs
* [33m240e710[m new version
* [33mca6a222[m feat: implement premium iOS-style toast system & align back navigation button consistency Backend: - Configure GD extension in Dockerfile with WebP, FreeType, and JPEG support. - Allow WebP files and enforce a 5MB upload limit in update avatar validation. - Register GD image driver configuration explicitly in image.php. Frontend: - Build AppToast.vue and useToast.js composable for global iOS-style notifications. - Update wallet, salary, expense, debt, and avatar actions to fire specific custom toasts. - Remove toasts for balance and dashboard privacy toggles. - Fix undefined toast reference error in Notes.vue. - Support case-insensitive /clear command in AI Chat to purge local storage and IndexedDB. - Align all back navigation buttons across Notes, Files, Settings, Guide, and DepositSalaryModal to a consistent circular, bordered ChevronLeft style. - Clean up unused ArrowLeft imports in Notes.vue and Files.vue.
* [33mfa0a1ba[m Fix both online/offline functionality, UI update and user stats sync, new features on settings
* [33mdb049ac[m fix double user stats and deposit
* [33mb9a309e[m Align more navigation popup
* [33m5ae8300[m remove spam in console log
* [33m90b41f2[m Fix Google Sign in on Vercel
* [33m43f6c96[m Fix  AI Multi-turn, Google Oauth and Enhance UI
* [33ma3f6010[m feat(ai-chat): implement multi-turn confirmation flows and dynamic prefixes
* [33mdf7e4a9[m fix npm warning and new version 1.8.0
* [33m521d293[m[33m ([m[1;31morigin/backup-main-5/16[m[33m, [m[1;31morigin/5/19/2026[m[33m, [m[1;32mbackup-main-5/16[m[33m, [m[1;32m5/19/2026[m[33m)[m feat: improve Marti UX, chat parsing, and dashboard live insights
* [33mb6482a4[m Optimize the opening the app API calls
* [33m80fb24b[m Fixed all AI now working both online and offline mode and auto sync after reconnecting on internet
* [33m5ba1cca[m Fixed the offline cached and functional and sync the data after reconnect to the internet
* [33mdd8dac4[m Add note offline mode v.1.2.5
* [33me45f000[m feat: offline PWA with IndexedDB outbox + sync engine
* [33mae5d8bf[m fix the month filter
* [33m4f11c6b[m Fix deposit, add auto-saved notes
* [33me8db013[m fill the empty corner and back to square logo
* [33m20d4349[m fill the empty corner
* [33mb562ee0[m Revert the logo
* [33m70874ac[m change BG color
* [33md7c1c43[m wep
* [33m77baa72[m New icon MA for frame
* [33me67b366[m remove auto frame
* [33m2e19e1d[m Bounce + Splash animation
* [33meab3dfa[m update v1.2.3 and dashboard stats
* [33mc12d6ae[m feat: v1.2.3 - encrypt sensitive fields, database encryption and optimize user stats
* [33m96c9164[m Bump version to v1.2.2 and apply recent UI and bug fixes
* [33ma9a9ff8[m chore: add development_rules.md to gitignore and bump version to v1.2.1
* [33md20e7c3[m feat: encrypt notes title and content for privacy
* [33m6955efc[m feat: bump version to v1.2.0
* [33m3d94886[m fix: change PWA api cache strategy to NetworkFirst to prevent stale data overriding optimistic updates
* [33m31fa27b[m fix: update CORS rules and add mobile local IP detection for axios
* [33m36d1686[m fix: optimize pagination indexes, improve dashboard query performance, add optimistic wallet updates on deposit, and disable stateful API to resolve CSRF 419 error
* [33mbf3b7c0[m Add a global skeleton loading state
* [33m82b1890[m weep
* [33mca415a4[m woooopie
* [33m8641eb3[m Remove manual update feature and revert to silent auto-update
* [33m9db1cb0[m Refactor PWA update logic and redesign Wallet cards
* [33mccf4ff0[m Enable auto-update on desktop and manual update on mobile
* [33mc489695[m Update system update wording to EleFam app
* [33mcf1abb2[m Implement full-screen iOS style Software Update page
* [33m20a9fa9[m Add permanent System Update tab in Settings and fix mobile network hang
* [33m49d442f[m Move PWA update flow to Settings with modern progress UI
* [33m40ae91e[m Fix delay and splash in desktop
* [33mdb318ee[m Fix CSRF Token mismatch and separate the logic PC and mobile
* [33mc27f57c[m Fix CSRF Token mismatch
* [33mc6b21e9[m Login Fix (Backend — AuthService.php,  Axios Interceptor Fix, PWA Update Notifications (New)
* [33m8d87907[m Add PWA and web icon and app icon
* [33mabdc5cb[m woop almost fix everything
* [33m4710ff8[m Add uptime robot
* [33mf0bcc88[m weeeeeep
* [33me124a0f[m remove auto distribute
* [33m8a584bd[m feat: implement fully dynamic budget tracking system
* [33maa1960d[m wop
* [33me513b07[m Fix: Unify budget base to monthly_salary and handle already_spent as an explicit expense
* [33mc2d9552[m woopie
* [33m862ecb1[m wowop
* [33me415b3d[m fix log in cors auth
* [33m9fc4c79[m fix cors
* [33m112db0e[m[33m ([m[1;31morigin/test[m[33m, [m[1;32mtest[m[33m)[m wop
* [33m8ebb759[m wip
* [33m249b0d7[m fix card UI
* [33mb48b4f1[m feat: comprehensive UI/UX overhaul and system stability improvements
* [33m10d6725[m Fix: Force add SSL certificate ignored by gitignore
* [33m6a894ea[m Fix: Add SSL certificate to storage and update dynamic path resolution
* [33mc6e0194[m Fix: Re-add SSL_CA check with fallback for TiDB connection
* [33mae903df[m Fix: Completely remove SSL_CA requirement for TiDB connection
* [33mac1f590[m Fix: Disable strict SSL server cert verification for TiDB MySQL connection
* [33mc52b461[m Fix: Update CORS configuration to allow all origins for API
* [33m5d5078a[m Fix: Add vercel.json for SPA routing
* [33m4cb2fad[m Fix: Remove nested git and include backend files properly
*   [33mee765e0[m Merge branch 'main' of https://github.com/martinitokristan-dev/pamilyahub
[32m|[m[33m\[m  
[32m|[m * [33m67cce25[m Initial commit
* [33m06ed41f[m[33m ([m[1;32mmaster[m[33m)[m File working
