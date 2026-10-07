# HyperSpace 3D for Android

HyperSpace 3D on an Android tablet (milestone 24): the desktop's 3D
room, top bar, start panel, and HoloML viewer, with each tab's live page
on the tilted panel. Android 10 or later; made for tablets first.

## How it is put together

- The room's page (`index.html`, `src/`) is the desktop's own code: the
  room (`apps/browser/src/renderer/scene/room.ts`), the top bar, the
  start panel, the HoloML examples, and the themes. Vite builds it into
  the app's assets. Where the desktop puts a Chromium view, the room
  places a stand-in (`src/stand-in.ts`), and after each frame it tells
  the app the page's outline on screen (`src/bridge.ts`).
- The app (`app/`, Kotlin) holds the tabs. Each tab's page is in a
  WebView of its own, drawn onto that outline through a view's animation
  matrix (`PageLayer.kt`, `Homography.kt`); a touch on the page is
  brought back through the inverse map, so it lands where it appears.
- HoloML pages are shown with the desktop's built viewer
  (`copy-viewer.mjs`), which the app answers on a path of the page's own
  site (`HolomlPage.kt`, `PageClient.kt`). On a tablet the viewer adds a
  walk pad, a jump button where the page allows jumping, and a long
  press for a right-click; its lighter drawing (half the sharpness, no
  shadows or moving light on water) is on by default, and the start
  panel has its switch.
- The tablet's tilt moves the room's parallax (`TiltSensor.kt`); the
  room draws in economy mode (at most 30 frames a second, no glow), but
  at the display's own resolution: half of it, as on the desktop,
  blurred the tab cards on the tablet (prompt 160).

Not yet on Android (later milestones): bookmarks and history, the ad
and tracker blocker, private tabs, downloads, passwords and site
permissions, the layers view, the instrument panel, and a HoloML page's
text view.

## Building and installing

You need what the desktop build needs (Node 22.13 or newer, pnpm 12),
and JDK 21 and the Android SDK (Android Studio brings both). From the
repository's root:

```
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @hypersol/android build:web
```

Then, in `apps/android`, with `JAVA_HOME` and `ANDROID_HOME` set (or the
SDK's place in `local.properties`, which is not committed):

```
./gradlew testDebugUnitTest assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The first Gradle run downloads Gradle 9.3.1 (its checksum is in
`gradle/wrapper/gradle-wrapper.properties`), the Android Gradle Plugin,
and the AndroidX libraries, from Gradle's servers, Google's Maven
repository, and Maven Central. The app is signed with Android's debug
key and installed by hand; it is not in the Play Store.

A debug build lets Chrome on the computer inspect its pages over USB
(`chrome://inspect`).
