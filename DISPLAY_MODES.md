# NeuroVis Display Modes

**Date:** April 18, 2026  
**Feature:** Single View, Dual View, and Quad View modes

---

## Display Modes

### **📱 Single View**

- Shows one visualization at full size
- Maximum screen real estate for one display
- Traditional single-panel view
- Select display from sidebar list

### **⚏ Dual View**

- Shows two visualizations side-by-side
- 50/50 split screen
- **LEFT DISPLAY** - Select from first list in sidebar
- **RIGHT DISPLAY** - Select from second list in sidebar (orange highlight)
- Perfect for comparing two metrics simultaneously

### **▦ Quad View**

- Shows four visualizations in 2x2 grid
- Each panel at 25% screen size
- Pre-configured panels (customizable via sidebar)
- Great for comprehensive monitoring

---

## Sidebar Organization

### **1. DISPLAY MODE** (Top section)

Click to select mode:

- 📱 Single View (default)
- ⚏ Dual View
- ▦ Quad View

### **2. LEFT DISPLAY** (Dual mode only)

- List of all available displays
- Blue highlight = active left display
- Click to change left panel

### **3. RIGHT DISPLAY** (Dual mode only)

- List of all available displays
- Orange highlight = active right display
- Click to change right panel

### **4. DISPLAYS** (Single mode only)

- List of all available displays
- Blue highlight = active display
- Click to switch views

---

## Layout Structure

```
┌─────────────────────────────────────────────────────┐
│ HEADER (Device, Record, Theme)                     │
├────────┬────────────────────────────────────────────┤
│ DISPLAY│ BANDS: ☑Delta ☑Theta | CHANNELS: TP9 AF7  │
│ MODE   ├────────────────────────────────────────────┤
│ ───────│                                            │
│Single  │                                            │
│Dual    │           Display Area                     │
│Quad    │      (1, 2, or 4 panels)                  │
│        │                                            │
│ ───────│                                            │
│Displays│                                            │
└────────┴────────────────────────────────────────────┘
```

---

## Use Cases

### **Single View - Deep Focus**

- Analyzing one metric in detail
- Large waveforms for precise reading
- Presentations (one clear visual)
- Research analysis of specific band

**Example:** Full-screen EEG Traces for electrode placement verification

### **Dual View - Comparison**

- Compare two metrics side-by-side
- Before/after views
- Raw vs filtered data
- Time domain vs frequency domain

**Example combinations:**

- Traces (left) + Band Powers (right)
- Timeline (left) + Topographic Map (right)
- Alpha band (left) + Beta band (right)
- Raw EEG (left) + Mental State (right)

### **Quad View - Comprehensive Monitoring**

- See multiple metrics at once
- Performance monitoring
- Real-time multi-parameter analysis
- Dashboard overview

**Default quad panels:**

1. Power + Timeline (top-left)
2. Topographic Map (top-right)
3. Neuro Indices (bottom-left)
4. FFT+Bands (bottom-right)

---

## Technical Implementation

### State Variables:

```javascript
displayMode: "single" | "dual" | "quad";
view: string; // Current view in single mode
dualPanels: [string, string]; // [left, right] view IDs
quadPanels: [string, string, string, string]; // 4 view IDs
```

### renderView() Function:

- Centralized view rendering
- Returns React element for any view ID
- Used by all three display modes
- Consistent props across modes

### Styling:

- **Single:** Full width, scrollable
- **Dual:** `display: flex`, `gap: 12px`, each panel `flex: 1`
- **Quad:** `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: 12px`

---

## Keyboard Shortcuts (Future)

Potential shortcuts:

- **Ctrl+1** - Single View mode
- **Ctrl+2** - Dual View mode
- **Ctrl+4** - Quad View mode
- **Ctrl+Left/Right** - Cycle through displays
- **Ctrl+Shift+Left/Right** - Cycle right panel (dual mode)

---

## Customization Options (Future)

1. **Save Layout Presets**
   - Save favorite dual/quad combinations
   - Quick recall with hotkeys
   - Per-session or global presets

2. **Adjustable Split**
   - Drag divider in dual mode (e.g., 30/70, 60/40)
   - Resize quad panels individually

3. **Triple View**
   - Three panels: 33/33/33 or 50/25/25
   - For even more comparisons

4. **Picture-in-Picture**
   - Small overlay panel on main view
   - Keep one metric always visible

---

## Performance Considerations

### Rendering:

- Each panel renders independently
- Same refresh rate as single view
- No performance penalty for dual/quad modes

### Memory:

- All views share same data stream
- No duplication of data
- Efficient React updates

### Optimization:

- Panels only render when visible
- Scrolling optimized per panel
- Canvas rendering remains hardware-accelerated

---

## Examples

### Research Session:

**Dual View:**

- Left: Raw EEG Traces (verify signal quality)
- Right: Band Powers (monitor alpha activity)

### Live Performance:

**Quad View:**

- Timeline (top-left) - Real-time waveforms
- Mental State (top-right) - Engagement metrics
- Topographic Map (bottom-left) - Spatial distribution
- Band Powers (bottom-right) - Frequency content

### Clinical Assessment:

**Single View:**

- Start with Timeline overview
- Switch to Traces for detailed inspection
- Check Topographic Map for asymmetry
- Review Band Powers for abnormalities

---

## Benefits

✅ **Flexibility** - One, two, or four views as needed  
✅ **Efficiency** - Compare multiple metrics without switching  
✅ **Professional** - Dashboard-style monitoring  
✅ **Research-grade** - Side-by-side analysis  
✅ **Performance-ready** - Quick overview during live shows

---

## Conclusion

The Display Mode system provides flexible visualization options for different workflows. Single View for focus, Dual View for comparison, Quad View for comprehensive monitoring - all while maintaining the same band/channel filter controls across the top of every display.
