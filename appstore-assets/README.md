# Ritovo — App Store Assets

## Screenshots (10 required)

### Step 1 — Capture in Xcode Simulator

1. Open Xcode → open `ios/App/App.xcodeproj`
2. In the Simulator device picker choose:
   - **iPhone 11 Pro Max** → gives 1242 × 2688 px at 3x
   - **iPhone 14 Plus** or **iPhone 15 Plus** → gives 1284 × 2778 px at 3x
3. Build & Run the app (⌘R)
4. Sign in, navigate to each screen below
5. Take a screenshot: **Device menu → Screenshot** (or Cmd+S)
6. Screenshots save to your Desktop automatically
7. Rename and move to `appstore-assets/raw/`:

| Filename               | Screen to show                              |
|------------------------|---------------------------------------------|
| `01-dashboard.png`     | Dashboard with stats + upcoming events       |
| `02-setlist.png`       | Set List with song cards visible             |
| `03-library.png`       | Song Library grid (several cards showing)    |
| `04-rehearsals.png`    | Rehearsals list                             |
| `05-calendar.png`      | Calendar view                               |
| `06-concerts.png`      | Concerts page with a gig showing            |
| `07-members.png`       | Members list                                |
| `08-profile.png`       | Group Profile page                          |
| `09-availability.png`  | My Profile → availability grid              |
| `10-signin.png`        | Sign-in screen (sign out first)             |

### Step 2 — Format to App Store dimensions

```bash
cd appstore-assets
npm install sharp
node format-screenshots.js
```

Output files in `appstore-assets/output/` — ready to upload to App Store Connect.
Each raw screenshot produces two files:
- `*_6_5inch.png` → 1242 × 2688 px (required for 6.5" display)  
- `*_6_7inch.png` → 1284 × 2778 px (required for 6.7" display)

---

## App Previews (3 required — video)

Apple requires `.mov` or `.mp4`, up to 30 seconds each, at the same resolutions.

### Easiest method — iOS screen recording on your phone

1. On the iPhone, go to Settings → Control Centre → add Screen Recording
2. Open the TestFlight build
3. Start screen recording (press the ● button in Control Centre)
4. Record each flow (30 sec max):
   - **Preview 1**: Sign in → Dashboard → Set List (swipe through cards)
   - **Preview 2**: Song Library → add song to set list
   - **Preview 3**: Rehearsal detail → Calendar → Members
5. Stop recording → video saves to Photos
6. AirDrop to Mac → upload directly to App Store Connect

### Alternative — Xcode Simulator screen recording

1. Open Simulator
2. File → Record Screen (or use `xcrun simctl io booted recordVideo output.mov`)
3. Perform the flow, stop recording

### Resize video if needed

```bash
# Resize to 1284x2778 (6.7")
ffmpeg -i input.mov -vf scale=1284:2778 -c:v libx264 -crf 18 output_6_7.mp4

# Resize to 1242x2688 (6.5")
ffmpeg -i input.mov -vf scale=1242:2688 -c:v libx264 -crf 18 output_6_5.mp4
```
