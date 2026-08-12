# CTRL Extension - UI Pattern Standardization Guide

## Overview

This guide explains the standardized UI patterns implemented to resolve HIGH-015 (Inconsistent UI Patterns). All components in the extension should follow these patterns for consistency.

## File Structure

```
styles/
├── variables.css    # All CSS variables (colors, spacing, typography, etc.)
├── components.css   # Standardized UI component classes
└── README.md       # This guide
```

## How to Use

### 1. Import Standardized Styles

In your component's CSS file, import the standardized styles at the top:

```css
/* Import standardized variables */
@import url('../styles/variables.css');

/* Import standardized components */
@import url('../styles/components.css');
```

### 2. Use Standardized Variables

Instead of hardcoding values, always use variables from `variables.css`:

**❌ Don't:**
```css
.my-element {
  color: #111827;
  padding: 16px;
  border-radius: 10px;
}
```

**✅ Do:**
```css
.my-element {
  color: var(--text-primary);
  padding: var(--space-4);
  border-radius: var(--border-radius-lg);
}
```

### 3. Use Standardized Component Classes

Instead of creating custom button/input styles, use the standardized classes:

**Buttons:**
```html
<button class="btn btn-primary">Primary Button</button>
<button class="btn btn-secondary">Secondary Button</button>
<button class="btn btn-ghost">Ghost Button</button>
<button class="btn btn-outline">Outline Button</button>
<button class="btn btn-text">Text Button</button>
<button class="btn btn-icon">Icon Button</button>

<!-- With sizes -->
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary btn-md">Medium</button>
<button class="btn btn-primary btn-lg">Large</button>

<!-- Full width -->
<button class="btn btn-primary btn-full">Full Width</button>
```

**Form Inputs:**
```html
<div class="form-group">
  <label for="email">Email Address</label>
  <input type="email" id="email" class="form-control form-control-md" placeholder="Enter email">
  <div class="form-help">We'll never share your email</div>
</div>

<div class="form-group">
  <label for="message">Message</label>
  <textarea id="message" class="form-control" rows="4"></textarea>
</div>

<div class="form-group">
  <label for="provider">Provider</label>
  <select id="provider" class="form-control">
    <option value="openai">OpenAI</option>
    <option value="anthropic">Anthropic</option>
  </select>
</div>
```

**Checkboxes & Radios:**
```html
<div class="checkbox-group">
  <input type="checkbox" id="remember">
  <label for="remember">Remember me</label>
</div>

<div class="radio-group">
  <input type="radio" id="option1" name="options">
  <label for="option1">Option 1</label>
  
  <input type="radio" id="option2" name="options">
  <label for="option2">Option 2</label>
</div>
```

**Cards:**
```html
<div class="card">
  <div class="card-header">
    <h3>Card Title</h3>
    <div class="card-subtitle">Subtitle text</div>
  </div>
  <div class="card-body">
    <p>Card content goes here</p>
  </div>
  <div class="card-footer">
    <button class="btn btn-secondary">Cancel</button>
    <button class="btn btn-primary">Save</button>
  </div>
</div>
```

**Modals:**
```html
<div class="modal">
  <div class="modal-backdrop"></div>
  <div class="modal-content">
    <div class="modal-header">
      <h3>Modal Title</h3>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <p>Modal content goes here</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </div>
</div>
```

**Dropdowns:**
```html
<div class="dropdown">
  <button class="btn btn-secondary">Dropdown</button>
  <div class="dropdown-menu">
    <button class="dropdown-item">Item 1</button>
    <button class="dropdown-item">Item 2</button>
    <div class="dropdown-divider"></div>
    <button class="dropdown-item">Item 3</button>
  </div>
</div>
```

**Badges:**
```html
<span class="badge badge-primary">Primary</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-error">Error</span>
<span class="badge badge-secondary">Secondary</span>
```

**Alerts:**
```html
<div class="alert alert-primary">Primary message</div>
<div class="alert alert-success">Success message</div>
<div class="alert alert-warning">Warning message</div>
<div class="alert alert-error">Error message</div>
```

**Accordions:**
```html
<div class="accordion">
  <button class="accordion-header">
    <span class="accordion-title">Section Title</span>
    <span class="accordion-arrow">▼</span>
  </button>
  <div class="accordion-content">
    <p>Content goes here</p>
  </div>
</div>
```

## Variable Naming Convention

### Color System

**Backgrounds:**
- `--bg-primary` - Main background color
- `--bg-secondary` - Secondary background (cards, sections)
- `--bg-tertiary` - Tertiary background (hover states)
- `--bg-elevated` - Elevated elements (modals, dropdowns)
- `--bg-hover` - Hover state background
- `--bg-active` - Active state background

**Text:**
- `--text-primary` - Main text color
- `--text-secondary` - Secondary text
- `--text-tertiary` - Tertiary text (labels, hints)
- `--text-muted` - Muted text (disabled, placeholders)
- `--text-inverted` - Inverted text (for dark backgrounds)

**Accent:**
- `--accent-primary` - Primary accent color
- `--accent-secondary` - Secondary accent (hover)
- `--accent-hover` - Hover accent
- `--accent-light` - Light accent (backgrounds)
- `--accent-subtle` - Subtle accent (borders)

**Semantic:**
- `--color-success` - Success (green)
- `--color-warning` - Warning (yellow/orange)
- `--color-error` - Error (red)
- `--color-info` - Info (blue)
- `--color-success-light` - Light success background
- `--color-warning-light` - Light warning background
- `--color-error-light` - Light error background
- `--color-info-light` - Light info background

**Borders:**
- `--border-primary` - Primary border
- `--border-secondary` - Secondary border
- `--border-hover` - Hover border
- `--border-active` - Active border

### Spacing System (8px base)

- `--space-0`: 0
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-10`: 40px
- `--space-12`: 48px
- `--space-16`: 64px

### Border Radius

- `--border-radius-none`: 0
- `--border-radius-sm`: 4px
- `--border-radius-md`: 6px
- `--border-radius-lg`: 10px
- `--border-radius-xl`: 12px
- `--border-radius-2xl`: 16px
- `--border-radius-full`: 9999px

### Typography

**Font Families:**
- `--font-family-base` - Base font (Inter, system fonts)
- `--font-family-mono` - Monospace font (JetBrains Mono, etc.)

**Font Sizes:**
- `--text-xs`: 11px
- `--text-sm`: 12px
- `--text-base`: 13px
- `--text-md`: 14px
- `--text-lg`: 15px
- `--text-xl`: 16px
- `--text-2xl`: 18px
- `--text-3xl`: 20px
- `--text-4xl`: 24px

**Font Weights:**
- `--font-weight-normal`: 400
- `--font-weight-medium`: 500
- `--font-weight-semibold`: 600
- `--font-weight-bold`: 700

**Line Heights:**
- `--line-height-tight`: 1.25
- `--line-height-normal`: 1.5
- `--line-height-relaxed`: 1.75

### Shadows

- `--shadow-none`: none
- `--shadow-xs`: Very small shadow
- `--shadow-sm`: Small shadow
- `--shadow-md`: Medium shadow
- `--shadow-lg`: Large shadow
- `--shadow-xl`: Extra large shadow
- `--shadow-inner`: Inner shadow
- `--shadow-up`: Shadow pointing up

### Transitions

- `--transition-fast`: 0.15s ease-out
- `--transition-normal`: 0.25s ease-out
- `--transition-slow`: 0.35s ease-out

### Z-Index

- `--z-dropdown`: 100
- `--z-sticky`: 200
- `--z-fixed`: 300
- `--z-modal-backdrop`: 400
- `--z-modal`: 500
- `--z-popover`: 600
- `--z-tooltip`: 700
- `--z-notification`: 800

## Migration Guide

When updating existing components to use standardized patterns:

### Step 1: Identify Inconsistencies

Look for:
- Hardcoded colors (e.g., `#111827`, `#ffffff`)
- Custom button/input classes
- Duplicate CSS definitions
- Inconsistent spacing/padding

### Step 2: Replace with Standardized Classes

Example migration:

**Before:**
```css
.my-button {
  padding: 10px 18px;
  border: none;
  border-radius: 10px;
  background: #0f172a;
  color: #ffffff;
  cursor: pointer;
}

.my-button:hover {
  opacity: 0.9;
}
```

**After:**
```html
<button class="btn btn-primary">Click me</button>
```

### Step 3: Use Standardized Variables

**Before:**
```css
.my-element {
  color: #4b5563;
  padding: 20px;
  margin-bottom: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
}
```

**After:**
```css
.my-element {
  color: var(--text-secondary);
  padding: var(--space-5);
  margin-bottom: var(--space-8);
  border: var(--border-width-thin) solid var(--border-primary);
  border-radius: var(--border-radius-2xl);
}
```

### Step 4: Test Across Themes

Make sure your component works correctly in all themes:
- Light (default)
- Dark
- Blue
- Purple
- Green
- Red-Black
- Nebula
- Cyberpunk
- Synthwave
- Noir
- Dune
- Blossom
- Matcha
- Lavender
- Oat
- Rainforest
- Ocean
- Sunset
- Glacial
- Magma
- Tokyo
- Parchment
- Terminal

## Best Practices

1. **Always use variables** - Never hardcode values
2. **Use component classes** - Don't reinvent buttons, inputs, modals
3. **Follow spacing system** - Use 8px base spacing
4. **Test in all themes** - Ensure theme compatibility
5. **Maintain accessibility** - Use semantic HTML, proper contrast
6. **Consistent naming** - Follow variable naming convention
7. **Document custom components** - If you create new components, document them here

## Component Checklist

When creating or updating components:

- [ ] Import standardized variables and components
- [ ] Use standardized component classes (buttons, inputs, modals, etc.)
- [ ] Use CSS variables instead of hardcoded values
- [ ] Test in light and dark themes
- [ ] Test in custom themes (nebula, cyberpunk, terminal, etc.)
- [ ] Verify accessibility (contrast, keyboard navigation)
- [ ] Check responsive behavior
- [ ] Document any custom patterns

## Examples

### Example 1: Simple Form

```html
<div class="card">
  <div class="card-header">
    <h3>Settings</h3>
  </div>
  <div class="card-body">
    <div class="form-group">
      <label for="username">Username</label>
      <input type="text" id="username" class="form-control" placeholder="Enter username">
    </div>
    
    <div class="form-group">
      <label for="email">Email</label>
      <input type="email" id="email" class="form-control" placeholder="Enter email">
    </div>
    
    <div class="checkbox-group">
      <input type="checkbox" id="notifications">
      <label for="notifications">Enable notifications</label>
    </div>
  </div>
  <div class="card-footer">
    <button class="btn btn-secondary">Cancel</button>
    <button class="btn btn-primary">Save Changes</button>
  </div>
</div>
```

### Example 2: Confirmation Modal

```html
<div class="modal">
  <div class="modal-backdrop"></div>
  <div class="modal-content modal-sm">
    <div class="modal-header">
      <h3>Confirm Action</h3>
      <button class="modal-close">×</button>
    </div>
    <div class="modal-body">
      <p>Are you sure you want to proceed? This action cannot be undone.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-primary">Confirm</button>
    </div>
  </div>
</div>
```

## Support

If you need help or have questions about the standardized UI patterns:
- Check this guide first
- Review the `variables.css` and `components.css` files
- Look at existing components in the codebase for examples

---

**Note:** This standardization is part of resolving HIGH-015 (Inconsistent UI Patterns). All new components should follow these patterns.
