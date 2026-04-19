# NeuroVis Header Redesign

**Date:** April 18, 2026  
**Change:** Redesigned header with larger title, better organization, and two-row layout

---

## New Header Structure

### **ROW 1: Title + Primary Controls**

```
┌────────────────────────────────────────────────────────────────┐
│ 🧠 Dr.C - NeuroViz EEG+     [Connection] [Preset] [Device]    │
│                              [OSC] [Simulator]                  │
└────────────────────────────────────────────────────────────────┘
```

**Left Side:**

- **Icon:** 🧠 (36×36px, larger)
- **Title:** "Dr.C - NeuroViz EEG+" (20px font, bold, prominent)
  - Changed from "NeuroVis EEG v2.0-NEUROSC"
  - Removed version badge
  - Cleaner, more professional

**Right Side (Primary Controls):**

1. **📡 Connection Status** - Shows connected device (e.g., "📡 Muse 2")
2. **⚡ Preset Selector** - Quick load presets (1-9)
3. **📱 Device Model** - Select hardware (Muse 2/S/Athena, OpenBCI)
4. **↔️ OSC Toggle** - ON/OFF for OSC output to Csound
5. **🎲 Simulator** - Last button (ON/OFF for test mode)

All buttons: **Larger (11-12px font, 6-14px padding, 2px borders)**

---

### **ROW 2: Secondary Controls**

```
┌────────────────────────────────────────────────────────────────┐
│ [⏺ Record] [EEG Data▾] [Filtered]    [⚙️ Filter] [💾 Presets] │
│                                                        [🌙 Dark] │
└────────────────────────────────────────────────────────────────┘
```

**Left Group (Recording):**

1. **⏺ Record / ⏹ Stop** - Start/stop recording
2. **Data Type Selector** - EEG/fNIRS/PPG/IMU (when not recording)
3. **● REC [TYPE]** - Recording indicator (when recording)
4. **Filtered / Raw Signal** - Toggle filter application to recordings

**Right Group (Settings):**

1. **⚙️ Filter Settings** - Open filter configuration
2. **💾 Manage Presets** - Save/edit/delete presets
3. **Theme Switcher** - 🌙 Dark / ☀️ Light / ⚫ Hi-Con

All buttons: **Larger (11-12px font, 7-16px padding, 2px borders)**

---

## Design Improvements

### **✅ Larger Elements**

- Title: 20px (was 14px)
- Icon: 36×36px (was 28×28px)
- Buttons: 11-12px font (was 7-9px)
- Padding: 6-16px (was 2-7px)
- Borders: 2px (was 1px)

### **✅ Better Readability**

- Higher contrast borders
- More descriptive button text
  - "⏺ Record" instead of "● REC"
  - "↔️ OSC ON" instead of "⇄ OSC Sending"
  - "🎲 Simulator ON" instead of "▶ Simulator ON"
- Clearer icons (emoji + text)
- More padding/spacing between elements

### **✅ Logical Organization**

**Row 1 = System Setup:**

- Who: Device connection
- What: Preset/configuration
- Where: Device model
- How: OSC output, Simulator mode

**Row 2 = Data Operations:**

- Record: Start/stop data capture
- Filter: Configure signal processing
- Manage: Preset management
- Theme: Visual preferences

### **✅ Professional Appearance**

- Clean two-row layout
- Consistent button sizing
- Proper visual hierarchy
- No wrapping/overflow
- Scientific software aesthetic

---

## Button States & Colors

### **Connection Status**

- **Connected:** Green background (#10b981), green border
- **Disconnected:** Hidden

### **Presets**

- **Active:** Green background/border (#10b981)
- **None:** Gray border, white background

### **Device Model**

- **Always:** Blue accent color (th.ac)

### **OSC**

- **ON:** Green (#22c55e)
- **OFF:** Gray

### **Simulator**

- **ON:** Orange (#f59e0b)
- **OFF:** Gray

### **Recording**

- **Recording:** Red (#ef4444)
- **Not Recording:** Blue accent (th.ac)

### **Filter/Presets**

- **Active view:** Blue accent
- **Inactive:** Gray

### **Theme**

- Shows current theme: 🌙 Dark, ☀️ Light, ⚫ Hi-Con
- Click to cycle through all three

---

## Responsive Behavior

### **Row 1:**

- Title on left, buttons on right
- Buttons stay on same row (enough space)
- Simulator always last button

### **Row 2:**

- Two groups: Recording (left) + Settings (right)
- Can wrap if window < 900px
- Maintains logical grouping

---

## Comparison: Old vs New

### **Old Title Bar:**

```
🧠 NeuroVis EEG [v2.0-NEUROSC badge]
Muse 2 · Bypass · SIMULATOR
```

- Small font (14px)
- Version badge cluttered
- Device info mixed with title

### **New Title Bar:**

```
🧠 Dr.C - NeuroViz EEG+
```

- Large font (20px)
- Clean, professional
- No version clutter

---

### **Old Controls:**

- 30+ tiny buttons scattered everywhere
- 7-8px font, hard to read
- Mixed purposes (recording + config + theme)
- Wrapped to 3-4 rows on smaller screens
- No clear hierarchy

### **New Controls:**

**Row 1:** 5 primary buttons (system setup)
**Row 2:** 6-7 buttons (data operations)

- 11-12px font, easy to read
- Clear grouping by purpose
- Max 2 rows, organized
- Visual hierarchy (primary vs secondary)

---

## User Workflow

### **Starting a Session:**

1. **Row 1:** Select device, load preset, turn on OSC, enable simulator if testing
2. **Row 2:** Click Record, choose data type, enable filters

### **During Performance:**

- **Row 1:** Simulator toggle, OSC toggle (most used)
- **Row 2:** Recording controls (start/stop)
- **Sidebar:** Switch between display modes/views

### **Configuration:**

- **Row 1:** Change presets quickly (dropdown)
- **Row 2:** Access filter settings, manage presets

---

## Technical Notes

### **React Structure:**

```javascript
h("div", { style: { background: th.c1, borderBottom: "2px solid " + th.bd } },
  // Row 1
  h("div", { style: { padding: "12px 16px", borderBottom: "1px solid " + th.bd } },
    Title + Primary Buttons
  ),
  // Row 2
  h("div", { style: { padding: "10px 16px" } },
    Recording Controls + Settings
  ),
)
```

### **Button Style Template:**

```javascript
style: {
  padding: "7px 14px",
  borderRadius: 6,
  border: "2px solid " + color,
  background: bgColor,
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
}
```

---

## Future Enhancements

1. **Keyboard Shortcuts**
   - Ctrl+R: Toggle recording
   - Ctrl+S: Toggle simulator
   - Ctrl+O: Toggle OSC
   - Ctrl+1-9: Load presets

2. **Collapsible Header**
   - Double-click title to minimize/maximize
   - Saves vertical space during performance

3. **Status Bar**
   - CPU usage
   - Memory usage
   - OSC message count
   - Sample rate

4. **Quick Actions Menu**
   - Right-click title for advanced options
   - Export session
   - Clear cache
   - Reset settings

---

## Conclusion

The redesigned header provides a clean, professional, easy-to-use control panel organized into two logical rows. Larger buttons with clear labels make it suitable for research, clinical, and performance contexts. The new "Dr.C - NeuroViz EEG+" branding establishes a clear identity for the system.
