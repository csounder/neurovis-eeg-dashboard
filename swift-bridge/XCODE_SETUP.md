# Xcode Setup Guide - Muse Bridge

Complete instructions for building the Swift bridge with Xcode.

## Repo layout (NeuroVis)

The Xcode project that builds the **`MuseBridge`** CLI lives in this repo at:

```text
swift-bridge/MuseBridgeApp/MuseBridge/MuseBridge.xcodeproj
```

Canonical Swift sources are also kept at `swift-bridge/main.swift` and `swift-bridge/Bridging-Header.h`; copy them into the Xcode target folder when you update the bridge (see Step 3).

## Prerequisites

- Xcode 13+ (or current Xcode matching your macOS SDK)
- Apple Silicon or Intel Mac (match `Muse.framework` architectures)
- **`Muse.framework`** at the NeuroVis repo root (`../Muse.framework` relative to `swift-bridge/MuseBridgeApp/`), **or** Muse SDK unpacked elsewhere (e.g. `/tmp/libmuse_macos_8.0.5/`)

## Step 1: Open or create the Xcode project

### If you already have this repo (usual path)

1. Open **`swift-bridge/MuseBridgeApp/MuseBridge/MuseBridge.xcodeproj`** in Xcode.
2. Continue at **Step 2** if framework search paths or linked frameworks are missing.

### Greenfield (only if you are not using the bundled project)

1. **File** → **New** → **Project** → **macOS** → **Command Line Tool**
2. Product Name: **`MuseBridge`**, Language: **Swift**
3. Save under **`swift-bridge/MuseBridgeApp/`** in your NeuroVis clone (you can replace the default `main.swift` in Step 3).

## Step 2: Add Muse Framework

### Link Framework

1. Select **Project** (left sidebar)
2. Select **MuseBridge** (target)
3. **Build Phases** tab → **Link Binary With Libraries** section
4. Click **+** button
5. Click **Add Other...**
6. Navigate to **`Muse.framework`** and add it:
   - **Option A:** SDK folder, e.g. `/tmp/libmuse_macos_8.0.5/Muse.framework`
   - **Option B (NeuroVis repo):** `<path-to-NeuroVis>/Muse.framework`
7. Click **Open** → **Add**

Still in **Link Binary With Libraries**, click **+** and add these **system** frameworks (required by LibMuse on macOS):

- **CoreBluetooth**
- **QuartzCore**
- **ExternalAccessory**

Then **Build Settings** → search **Other Linker Flags** → add **`-lc++`** (LibMuse is C++; without it you get linker errors such as `___gxx_personality_v0`).

### Add Framework Search Path

This tells the linker where to find `Muse.framework` at **build time**.

1. In the **Project navigator** (left sidebar), click the **blue project icon** at the very top (the `.xcodeproj` row).
2. In the main editor, under **TARGETS**, select **MuseBridge** (not “PROJECT”).
3. Open the **Build Settings** tab (next to *General*, *Signing*, *Build Phases*, etc.).
4. At the top of the table, change the filter from **Basic** to **All** (easier to find settings).
5. Click in the **search** field above the settings table and type: `Framework Search Paths`.
6. You’ll see a row **Framework Search Paths**. Under the **MuseBridge** column (not “Resolved”), **double-click** the right-hand value cell (it may say empty or `$(inherited)`).
7. A sheet or popover opens listing paths. Click the **+** button.
8. Type or paste the **folder that contains** `Muse.framework` (not the `.framework` file itself), e.g. `/tmp/libmuse_macos_8.0.5`, then press **Enter**.
9. Close the sheet if needed. You should see that path in the list.

If you use the **NeuroVis** tree, set **Framework Search Paths** to the **repo root** (the folder that **contains** `Muse.framework`), e.g. `/Users/you/dB-Studio/NeuroVis` — not `/tmp/...` unless you actually installed the SDK there.

The important part is always: **parent folder of `Muse.framework`**.

### Add Header Search Path

1. Same place: **MuseBridge** target → **Build Settings** → **All** → search **Header Search Paths**.
2. Double-click the value under **MuseBridge**, click **+**, add: `/tmp/libmuse_macos_8.0.5/Muse.framework/Headers` (or the equivalent under your SDK folder).

### Enable Bridging Header

1. Search for: `Bridging Header`
2. Set value to: `MuseBridge/Bridging-Header.h` (if you have a Bridging-Header.h file)

## Step 3: Copy Source Files

Replace the default `main.swift` with the provided `main.swift`:

Adjust paths to match where you saved the Xcode project (the inner **`MuseBridge`** folder next to `MuseBridge.xcodeproj` usually holds `main.swift` and `Bridging-Header.h`).

```bash
NEUROVIS="/Users/you/dB-Studio/NeuroVis"
DEST="$NEUROVIS/swift-bridge/MuseBridgeApp/MuseBridge/MuseBridge"

cp "$NEUROVIS/swift-bridge/main.swift" "$DEST/main.swift"
cp "$NEUROVIS/swift-bridge/Bridging-Header.h" "$DEST/Bridging-Header.h"
```

If the build says **Bridging-Header.h** is missing, the **Objective-C Bridging Header** path in Build Settings must match the file’s location (often `MuseBridge/Bridging-Header.h` relative to the target’s source folder).

## Step 4: Build

### In Xcode

```
⌘B  (Product → Build)
```

Or from the directory that contains **`MuseBridge.xcodeproj`**:

```bash
NEUROVIS="$HOME/dB-Studio/NeuroVis"
cd "$NEUROVIS/swift-bridge/MuseBridgeApp/MuseBridge"
xcodebuild -project MuseBridge.xcodeproj -scheme MuseBridge -configuration Debug
```

If you prefer not to set search paths in the GUI every time, pass the NeuroVis root (parent of `Muse.framework`) and linker flags:

```bash
NEUROVIS="$HOME/dB-Studio/NeuroVis"
cd "$NEUROVIS/swift-bridge/MuseBridgeApp/MuseBridge"
xcodebuild -project MuseBridge.xcodeproj -scheme MuseBridge -configuration Debug \
  FRAMEWORK_SEARCH_PATHS="$NEUROVIS" \
  OTHER_LDFLAGS="-framework Muse -lc++ -framework CoreBluetooth -framework QuartzCore -framework ExternalAccessory"
```

### Expected Output

```
Build complete! (X.XXs)
```

The built **`MuseBridge`** binary is under Xcode’s **DerivedData** (see Step 5).

## Step 5: Locate Executable

Xcode places the built CLI under **DerivedData** (not inside `MuseBridgeApp` unless you changed build locations):

```bash
find ~/Library/Developer/Xcode/DerivedData -path "*MuseBridge*/Build/Products/Debug/MuseBridge" -type f 2>/dev/null
```

## Step 6: Install `MuseBridge` for NeuroVis (this repo)

From the **NeuroVis repo root**, run:

```bash
chmod +x scripts/deploy-musebridge.sh   # once, if ./scripts/... says "permission denied"
./scripts/deploy-musebridge.sh
```

Or without the execute bit:

```bash
bash scripts/deploy-musebridge.sh
```

Or via npm:

```bash
npm run deploy:musebridge
# Debug build:
npm run deploy:musebridge:debug
```

That copies the compiled CLI to **`MuseBridge`** next to `server-enhanced.js` (the default **`BRIDGE_PATH`** / `./MuseBridge`). Restart **`npm start`** so Node picks up the new binary.

**Manual copy** (if you already built in Xcode’s global DerivedData):

```bash
NEUROVIS="$HOME/dB-Studio/NeuroVis"
BIN="$(find ~/Library/Developer/Xcode/DerivedData -path "*MuseBridge*/Build/Products/Release/MuseBridge" -type f 2>/dev/null | head -1)"
# Or use …/Debug/MuseBridge if you only built Debug
cp "$BIN" "$NEUROVIS/MuseBridge"
chmod +x "$NEUROVIS/MuseBridge"
```

## Step 7: Test

From the NeuroVis repo root:

```bash
cd "$HOME/dB-Studio/NeuroVis"
npm start
```

You should see:

```
✓ Web UI: http://localhost:3000
✓ OSC client ready → 127.0.0.1:7400

🚀 Launching Swift bridge: ./MuseBridge
[SWIFT] 🧠 Muse EEG Bridge v1.0 Starting...
```

## Troubleshooting

### "Muse/Muse.h file not found"

- Prefer **Framework Search Paths** = **NeuroVis repo root** (folder that contains `Muse.framework`), e.g. `/Users/you/dB-Studio/NeuroVis`
- **Header Search Paths** may include `$NEUROVIS/Muse.framework/Headers` if needed
- If you use an SDK tarball instead, point both paths at that install (e.g. `/tmp/libmuse_macos_8.0.5/`)
- **Clean Build Folder** (⇧⌘K) and rebuild

### "IXNMuseListener not found"

- Ensure bridging header is set correctly
- Try adding bridging header path to **Objective-C Bridging Header** setting

### Framework not linked

- Verify **Link Binary With Libraries** includes `Muse.framework`
- Check it's the correct M1/M2 binary (not Intel)

### Build succeeds but executable doesn't run

```bash
# After copying the binary to the repo root (Step 6)
otool -L /Users/you/dB-Studio/NeuroVis/MuseBridge
```

You should see **`Muse.framework`** among the loaded libraries (path may be `@rpath` or an absolute path to your repo).

## Xcode Project Settings Summary

| Setting | Value |
| -------- | ----- |
| Framework Search Paths | NeuroVis repo root (parent of `Muse.framework`), e.g. `/Users/you/…/NeuroVis` |
| Header Search Paths | Often `$NEUROVIS/Muse.framework/Headers` (if bridging / clang needs it) |
| Linked frameworks | `Muse`, **CoreBluetooth**, **QuartzCore**, **ExternalAccessory**; **Other Linker Flags**: `-lc++` |
| Bridging Header | `MuseBridge/Bridging-Header.h` (under `swift-bridge/MuseBridgeApp/MuseBridge/MuseBridge/`) |
| Minimum macOS | Match your Xcode target / `Muse.framework` requirements |
| Architecture | arm64 (and x86_64 if using a universal `Muse.framework`) |

## Next Steps

Once built, the executable will automatically:

1. Discover nearby Muse 2 and Muse S Athena devices
2. Accept connection commands from Node.js backend via stdin
3. Stream EEG data as JSON to stdout
4. Integrate with the web dashboard at http://localhost:3000

Good luck! 🧠
