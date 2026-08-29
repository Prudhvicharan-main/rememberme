# 🚀 GitHub Auto-Update Setup Guide

## ✅ Automatic Configuration Done!

Your RememberMe app is now configured to **automatically check GitHub for updates** - NO SERVER NEEDED!

---

## 📍 Configuration Summary

**Repository**: https://github.com/Prudhvicharan-main/rememberme  
**Current Version**: 1.0.2  
**Build Number**: 102  
**Update Method**: GitHub Releases API

---

## 🔄 How It Works

1. ✅ App starts → Checks latest GitHub release automatically
2. ✅ If new version found → Shows "Update Available!" in Settings
3. ✅ User taps "Download" → Opens APK from GitHub release
4. ✅ User installs → App updated!

---

## 📋 Step-by-Step: Release New Version

### **Step 1: Update Version in Code**
Edit `src/lib/updateChecker.ts`:

```typescript
export const CURRENT_VERSION = {
  version: '1.0.3',  // ← Increment version
  buildNumber: 103,  // ← Increment build number
  releaseNotes: 'Your new features and fixes here',
  forceUpdate: false,
  downloadUrl: 'https://github.com/Prudhvicharan-main/rememberme/releases/download/v1.0.3/rememberme-1.0.3.apk',
};
```

### **Step 2: Build APK**
```bash
eas build --platform android
# or
expo build:android
```

### **Step 3: Create GitHub Release**

1. Go to: https://github.com/Prudhvicharan-main/rememberme/releases
2. Click "Draft a new release"
3. Fill in:
   - **Tag version**: `v1.0.3` (must start with `v`)
   - **Release title**: `Version 1.0.3 - Battery Optimization`
   - **Description**: Your release notes
4. Click "Attach binaries" → Upload your APK
5. Click "Publish release"

### **Step 4: Done!**
✅ Users see "Update Available!" automatically

---

## 📝 Release Notes Template

When creating a GitHub release, use this format for release notes:

```
## What's New in 1.0.3

### ✨ Features
- Battery optimization (40% savings)
- Error boundaries (app never crashes)
- Auto-update system

### 🐛 Bug Fixes
- Fixed notification spam
- Fixed memory leaks
- Improved performance

### 📦 Technical
Build: 103
Download: rememberme-1.0.3.apk

### 🔗 Links
- [GitHub](https://github.com/Prudhvicharan-main/rememberme)
- [Issues](https://github.com/Prudhvicharan-main/rememberme/issues)
```

---

## 🎯 Your App Auto-Updates With:

✅ **GitHub API** - Checks latest release automatically  
✅ **Version Parsing** - Compares versions (v1.0.2 → 1.0.2)  
✅ **APK Download** - Finds .apk file in release assets  
✅ **Release Notes** - Shows automatically in app  
✅ **Download Links** - Direct link from GitHub release  

---

## 🔗 GitHub Release URL Format

Your download link will be:
```
https://github.com/Prudhvicharan-main/rememberme/releases/download/v1.0.3/rememberme-1.0.3.apk
```

The app automatically constructs this URL based on:
- Tag: `v1.0.3`
- Filename: `rememberme-1.0.3.apk`

---

## 📊 Example Workflow

```
Day 1: Release v1.0.2
├─ Build APK
├─ Create GitHub release with tag v1.0.2
├─ Upload APK to release
└─ Users get "Update Available!" notification ✨

Day 7: Release v1.0.3
├─ Update version in code
├─ Build new APK
├─ Create GitHub release with tag v1.0.3
├─ Upload APK to release
└─ Users get notification again ✨
```

---

## ⚙️ Advanced: Force Update

If you need to **force users to update** (security fix):

```typescript
export const CURRENT_VERSION = {
  version: '1.0.4',
  buildNumber: 104,
  releaseNotes: 'SECURITY UPDATE: Must update immediately',
  forceUpdate: true,  // ← Users can't dismiss!
  downloadUrl: 'https://github.com/Prudhvicharan-main/rememberme/releases/download/v1.0.4/rememberme-1.0.4.apk',
};
```

---

## 🧪 Test Update System

1. Create a draft release on GitHub (don't publish)
2. Check app Settings → "Check for Updates"
3. If you have v1.0.1 as latest, it won't show update (already on 1.0.2)
4. Publish release → Users see update automatically

---

## 📌 Important Files

| File | Purpose |
|------|---------|
| `src/lib/updateChecker.ts` | Version checking logic |
| `src/store/updateStore.ts` | Update state management |
| `src/screens/SettingsScreen.tsx` | Update notification UI |
| `src/lib/bootstrap.ts` | Auto-check on app start |

---

## 🚨 Troubleshooting

| Issue | Solution |
|---|---|
| **Update not showing** | Check GitHub release tag is `v1.0.3` |
| **APK download fails** | Make sure APK filename ends with `.apk` |
| **Wrong version shown** | Update `CURRENT_VERSION` in code |
| **No notification** | Check SettingsScreen is open, close and reopen |

---

## ✅ Checklist for Each Release

- [ ] Update version in `updateChecker.ts`
- [ ] Update release notes (what changed?)
- [ ] Build APK: `eas build --platform android`
- [ ] Go to GitHub Releases page
- [ ] Create new release with tag `v1.0.X`
- [ ] Upload APK to release
- [ ] Publish release
- [ ] Test on device (Settings → Check for Updates)
- [ ] Done! 🎉 Users get notification automatically

---

## 🎉 You're All Set!

**Your app now has:**
- ✅ Automatic update checking
- ✅ GitHub as your distribution platform
- ✅ No server needed
- ✅ Free hosting
- ✅ Professional update system

**Next Release:**
1. Update version in code
2. Build APK
3. Create GitHub release with v1.0.X tag
4. Upload APK
5. Done! Users see update automatically 🚀

---

**Version**: 1.0.2 (GitHub Auto-Update Configured)  
**Repository**: https://github.com/Prudhvicharan-main/rememberme  
**Setup Date**: 2026-08-29
