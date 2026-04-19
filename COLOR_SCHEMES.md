# NeuroVis Color Schemes

**Date:** April 18, 2026  
**Purpose:** Support multiple color schemes for improved readability in different environments

---

## Available Themes

NeuroVis supports **three color schemes** optimized for different viewing conditions and accessibility needs:

### 1. **Dark** (Default) 🌙

- **Background:** Deep blue-black (#060a14)
- **Text:** Light blue-gray (#d8e2f0)
- **Accent:** Indigo (#6366f1)
- **Use case:** Low-light environments, nighttime use, reduced eye strain
- **Band colors:** Lighter variants (high contrast on dark)

### 2. **Light** ☀️

- **Background:** Soft blue-gray (#edf1f7)
- **Text:** Dark blue (#1a2540)
- **Accent:** Deep indigo (#4f46e5)
- **Use case:** Bright environments, daytime use, printing/screenshots
- **Band colors:** Darker variants (high contrast on light)

### 3. **High Contrast** ⚫

- **Background:** Pure black (#000000)
- **Text:** Pure white (#ffffff)
- **Accent:** Cyan (#00ffff)
- **Use case:** Accessibility, low vision, bright stage lighting, projectors
- **Band colors:** Lighter variants (maximum contrast on black)
- **Features:** Pure saturated colors (cyan, yellow, green, red) for maximum visibility

---

## How to Switch Themes

### In the UI:

1. Look for the theme button in the top-right header (next to Record button)
2. Click to cycle through: **Dark → Light → High Contrast → Dark**
3. Current theme is shown with icon and label:
   - 🌙 Dark
   - ☀️ Light
   - ⚫ Hi-Con

### Keyboard Shortcut:

_(Future enhancement: Ctrl+T or Cmd+T to toggle themes)_

---

## Technical Implementation

### Theme Object Structure

Each theme in the `TH` object has these properties:

```javascript
{
  isDark: boolean,    // true = use light band colors, false = use dark band colors
  bg: string,         // Main background
  c1: string,         // Card background
  c2: string,         // Secondary background
  bd: string,         // Border color
  tx: string,         // Primary text
  t2: string,         // Secondary text
  t3: string,         // Tertiary text (labels)
  ac: string,         // Accent color
  sg: string,         // Signal background
  gd: string,         // Good/success (green)
  wr: string,         // Warning (yellow)
  rd: string,         // Error/danger (red)
}
```

### Band Color Selection

Each frequency band has two color variants:

- **`band.c`** - Darker color for **light** backgrounds
- **`band.d`** - Lighter color for **dark** backgrounds

Components automatically select the right variant using:

```javascript
var color = th.isDark ? band.d : band.c;
```

This ensures:

- **Dark theme:** Uses light colors (good contrast)
- **Light theme:** Uses dark colors (good contrast)
- **High Contrast:** Uses light colors (maximum contrast on black)

### Example Band Colors

| Band  | Light Theme (c)  | Dark Theme (d)         | Frequency |
| ----- | ---------------- | ---------------------- | --------- |
| Delta | #6366f1 (indigo) | #a5b4fc (light indigo) | 0.5-4 Hz  |
| Theta | #0891b2 (cyan)   | #22d3ee (light cyan)   | 4-8 Hz    |
| Alpha | #059669 (green)  | #34d399 (light green)  | 8-13 Hz   |
| Beta  | #d97706 (orange) | #fbbf24 (light orange) | 13-30 Hz  |
| Gamma | #dc2626 (red)    | #f87171 (light red)    | 30-100 Hz |

---

## Accessibility Features

### High Contrast Theme

Designed for users with:

- Low vision
- Color blindness (uses highly distinct hues)
- Bright ambient lighting (stage performances, sunlight)
- Projector presentations

**Key features:**

- Pure black background (#000000)
- Pure white text (#ffffff)
- Saturated primary colors (no pastels)
- Maximum contrast ratios (WCAG AAA compliant)

### All Themes

- Minimum 4.5:1 contrast ratio for text (WCAG AA)
- 3:1 contrast for UI components
- No reliance on color alone for critical info
- Clear visual hierarchy

---

## Theme Persistence

### Current Behavior:

- Theme resets to "dark" on page reload
- Selected via button click

### Future Enhancements:

1. **localStorage persistence** - Remember user's theme choice
2. **System preference detection** - Auto-detect OS dark/light mode
3. **Time-based switching** - Auto dark at night, light during day
4. **Per-preset themes** - Save theme with performance presets

---

## Use Cases by Environment

### Dark Theme 🌙

- **Late-night practice sessions**
- **Studio recording** (minimal light pollution)
- **EEG sleep studies**
- **Long sessions** (reduced eye fatigue)

### Light Theme ☀️

- **Daytime research**
- **Presentations** (bright rooms)
- **Screenshots for papers**
- **Printing documentation**
- **Collaboration** (easier to see on shared screens)

### High Contrast ⚫

- **Live performances** (stage lighting)
- **Projector presentations** (conference talks)
- **Accessibility requirements**
- **Bright sunlight** (outdoor demos)
- **Video recording** (clear visuals for tutorials)

---

## Color Palette Reference

### Dark Theme Colors

```
Background:  #060a14 (deep blue-black)
Card:        #0c1222 (dark blue-gray)
Border:      #1a2540 (slate blue)
Text:        #d8e2f0 (light blue-white)
Accent:      #6366f1 (indigo)
Success:     #22c55e (green)
Warning:     #eab308 (yellow)
Error:       #ef4444 (red)
```

### Light Theme Colors

```
Background:  #edf1f7 (soft blue-gray)
Card:        #ffffff (white)
Border:      #d4dae6 (cool gray)
Text:        #1a2540 (dark blue)
Accent:      #4f46e5 (deep indigo)
Success:     #16a34a (forest green)
Warning:     #ca8a04 (gold)
Error:       #dc2626 (crimson)
```

### High Contrast Colors

```
Background:  #000000 (pure black)
Card:        #1a1a1a (near-black)
Border:      #404040 (medium gray)
Text:        #ffffff (pure white)
Accent:      #00ffff (cyan)
Success:     #00ff00 (pure green)
Warning:     #ffff00 (pure yellow)
Error:       #ff0000 (pure red)
```

---

## Testing Checklist

When adding new UI components, test all three themes:

- [ ] Text is readable in all themes
- [ ] Borders are visible in all themes
- [ ] Interactive elements have clear hover states
- [ ] Band colors display correctly
- [ ] No hardcoded colors (use `th.*` properties)
- [ ] Canvas visualizations use theme colors
- [ ] Gradients work in all themes

---

## Future Theme Ideas

### Potential Additions:

1. **Sepia** - Warm tones, reduced blue light (eye comfort)
2. **Deuteranopia** - Optimized for red-green colorblindness
3. **Protanopia** - Optimized for red-weak vision
4. **Tritanopia** - Optimized for blue-yellow colorblindness
5. **OLED Black** - True black for OLED displays (battery saving)
6. **Amber Terminal** - Retro amber CRT aesthetic
7. **Matrix Green** - Green monochrome terminal style
8. **Blueprint** - White lines on blue (engineering drawings)

### Custom Themes:

Allow users to define custom color schemes via JSON or UI color picker.

---

## Performance Considerations

- Theme switching is instant (no reload required)
- No performance impact from theme selection
- All colors defined once in `TH` object
- Canvas visualizations redraw on theme change
- Smooth transitions possible with CSS (future enhancement)

---

## Conclusion

NeuroVis's multi-theme system provides flexibility for different use cases while maintaining scientific accuracy and data integrity across all color schemes. The three carefully designed themes ensure readability in any environment from dark studios to bright conference halls.

**Remember:** Theme affects only visual presentation - all data remains accurate and scientifically valid regardless of color scheme.
