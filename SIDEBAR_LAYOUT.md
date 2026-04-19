# NeuroVis Sidebar Layout

**Date:** April 18, 2026  
**Change:** Redesigned UI from horizontal top controls to left sidebar layout

---

## New Layout Structure

```
┌─────────────────────────────────────────────┐
│ HEADER (Device, Record, Theme, etc.)       │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┬───────────────────────────┐  │
│  │          │                           │  │
│  │ SIDEBAR  │   DISPLAY AREA           │  │
│  │  (240px) │   (Remaining width)       │  │
│  │          │                           │  │
│  │  Views   │   Selected visualization  │  │
│  │  Bands   │   (timeline, traces, etc) │  │
│  │  Channels│                           │  │
│  │          │                           │  │
│  └──────────┴───────────────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## Sidebar Sections

### 1. **DISPLAYS**

Vertical list of all available views:

- 📊 Power + Timeline
- 🧠 Topographic Map
- 📈 Traces
- 📉 Band Powers
- 🌊 All Bands Timeline
- 💭 Mental State
- 🎯 Focus/Relaxation
- 🔬 FFT Spectrum (disabled)
- ⚙️ Settings
- 💾 Recordings
- etc.

**Styling:**

- Active view: Highlighted with accent color border + background
- Inactive: Subtle gray
- Click to switch views

### 2. **BAND FILTERS**

Checkboxes for frequency bands:

- ☑ Delta (0.5-4 Hz)
- ☑ Theta (4-8 Hz)
- ☑ Alpha (8-13 Hz)
- ☑ Beta (13-30 Hz)
- ☑ Gamma (30-100 Hz)

**Features:**

- Checkbox shows enabled/disabled state clearly
- Band name uses band color when enabled
- Frequency range always visible
- Colored border when active

### 3. **CHANNELS**

Buttons for electrode selection:

- TP9
- AF7
- AF8
- TP10

**Features:**

- Colored border matches band color when active
- Click to toggle on/off
- Multiple channels can be selected

---

## Benefits of Sidebar Layout

### ✅ **Advantages:**

1. **More display space** - Visualizations get full width/height
2. **Clearer organization** - All controls in one logical place
3. **No wrapping issues** - Controls stack vertically (no multi-row problems)
4. **Easy scanning** - All options visible at once (no scrolling horizontally)
5. **Traditional pattern** - Familiar to users (like DAWs, audio software)
6. **Room to grow** - Easy to add more controls without crowding

### 📐 **Layout Specifications:**

- **Sidebar width:** 240px (fixed)
- **Display area:** Flex: 1 (takes remaining space)
- **Sidebar scrolling:** Auto (if content exceeds viewport height)
- **Display scrolling:** Auto (if visualization exceeds viewport height)
- **Total height:** calc(100vh - 140px) (viewport minus header)

---

## Previous Layout Issues (Solved)

### ❌ **Old Horizontal Layout Problems:**

- Band/channel controls wrapped to 2+ rows (cluttered)
- Less space for displays (controls took vertical space)
- Hard to see all options without horizontal scrolling
- View tabs could overflow on smaller screens
- Checkbox controls mixed with pills (inconsistent UX)

### ✅ **New Sidebar Solutions:**

- Everything in one column (never wraps)
- Full width for displays
- All controls visible at once
- Consistent checkbox/button styling
- Easy to add more options

---

## Technical Implementation

### Main Container:

```javascript
h("div",
  { style: { display: "flex", height: "calc(100vh - 140px)" } },
  // Sidebar
  h("div", { style: { width: 240, borderRight: ..., overflowY: "auto" } }, ...),
  // Display area
  h("div", { style: { flex: 1, overflowY: "auto" } }, ...)
)
```

### Sidebar Sections:

- Each section has a label (7px uppercase gray text)
- Vertical flex column layout with gap spacing
- Consistent padding and styling

### Display Area:

- Takes all remaining width (`flex: 1`)
- Scrollable if content overflows
- Padding for content spacing
- Uses theme background color

---

## Responsive Behavior

Currently fixed at 240px sidebar. Future enhancements could include:

1. **Collapsible sidebar** - Hide on small screens, show with toggle button
2. **Resizable sidebar** - Drag to adjust width
3. **Mobile layout** - Switch to bottom drawer or accordion on mobile
4. **Keyboard shortcuts** - Ctrl+B to toggle sidebar visibility

---

## User Workflow

### Typical Usage:

1. **Select display type** from DISPLAYS section (e.g., "Traces")
2. **Enable/disable frequency bands** with checkboxes
3. **Select channels** to visualize
4. **View updates automatically** based on selections
5. **All controls remain visible** - no need to scroll back to top

---

## Accessibility

- **Keyboard navigation:** Tab through controls
- **Clear focus states:** Visible outlines on focus
- **Checkbox labels:** Clickable labels, not just tiny boxes
- **High contrast:** Works in all 3 themes (dark, light, high contrast)
- **Screen reader friendly:** Proper semantic HTML structure

---

## Performance

- **No layout recalc on resize** - Fixed sidebar width
- **Virtualization not needed** - Limited number of controls
- **Smooth scrolling** - Native browser scrolling (no custom JS)
- **Instant switching** - No page reloads between views

---

## Future Enhancements

1. **Collapsible sections** - Accordion-style band/channel sections
2. **Search/filter displays** - Quick find for specific views
3. **Favorites/recent** - Pin frequently used views to top
4. **Sidebar themes** - Alternative sidebar colors/layouts
5. **Multi-column displays** - Show 2+ visualizations side-by-side
6. **Drag-and-drop** - Reorder sidebar items

---

## Migration Notes

**What changed:**

- Removed horizontal view tabs
- Removed old pill-style band/channel selectors
- Moved all controls to left sidebar
- Displays now use full remaining width

**What stayed the same:**

- All views still available
- Same filtering logic (bandToggles, sChs, sBands states)
- Same keyboard shortcuts (1-9 for presets)
- Same theme system (dark/light/high contrast)

---

## Conclusion

The new sidebar layout provides a cleaner, more professional interface optimized for research and performance use. All controls are now organized logically in a left sidebar, giving maximum space to the scientifically accurate visualizations.

**Perfect for:**

- Research sessions (all controls accessible)
- Live performances (quick view switching)
- Multi-monitor setups (sidebar on left, displays span right)
- Presentations (clean, uncluttered display area)
