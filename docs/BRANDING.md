# Healing Buds — Brand Identity & Design System Guide

> **Single source of truth** for all visual identity, color, typography, logo usage, and component styling across the Healing Buds platform. All design tokens are defined in `src/styles/theme.css` and `src/index.css`, referenced via CSS custom properties and Tailwind config.

---

## 1. Brand Overview

| Attribute | Value |
|---|---|
| **Brand Name** | Healing Buds |
| **Tagline** | Medical Cannabis Care |
| **Industry** | Regulated medical cannabis / healthcare |
| **Tone** | Clinical trust, warm professionalism, ADHD-safe clarity |
| **Powered By** | Dr. Green NFT ecosystem |

---

## 2. Logo System

### 2.1 Logo Variants

| Variant | File | Use Case |
|---|---|---|
| **Full Logo — Teal** | `src/assets/hb-logo-teal-full.png` | Light backgrounds, footers, documents |
| **Full Logo — White** | `src/assets/hb-logo-white-full.png` | Dark/teal backgrounds, navbar, hero sections |
| **Icon — Teal** | `src/assets/hb-icon-teal.png` | Favicons, small UI elements on light bg |
| **Icon — White** | `src/assets/hb-icon-white.png` | Small UI elements on dark bg |
| **Logo — Teal (text)** | `src/assets/hb-logo-teal.png` | Compact logo for sidebars |
| **Logo — White (text)** | `src/assets/hb-logo-white.png` | Compact logo for dark contexts |

### 2.2 Logo Usage Rules

- **Minimum clear space**: Equal to the height of the "H" in the logo on all sides
- **Minimum size**: 120px wide for full logo, 32px for icon
- **Never** distort, rotate, add effects, or change logo colors
- **Always** use the provided PNG/SVG files — never recreate

### 2.3 Logo Selection by Background

| Background | Logo Variant |
|---|---|
| White / light gray (`#F4F4F5`) | Teal full logo |
| Sage / cream sections | Teal full logo |
| Primary green / teal (`#1C4F4D`, `#0D9488`) | White full logo |
| Dark mode surfaces | White full logo |
| Email headers (colored) | White full logo |
| Email footers (light gray) | Teal full logo |

### 2.4 Email Logo URLs (Storage Bucket)

```
White:      {SUPABASE_URL}/storage/v1/object/public/email-assets/hb-logo-white-full.png
Teal:       {SUPABASE_URL}/storage/v1/object/public/email-assets/hb-logo-teal-full.png
Icon White: {SUPABASE_URL}/storage/v1/object/public/email-assets/hb-logo-white.png
Icon Teal:  {SUPABASE_URL}/storage/v1/object/public/email-assets/hb-logo-teal.png
```

---

## 3. Color Palette

### 3.1 Brand Colors (Primary Palette)

All colors defined as HSL in `src/styles/theme.css` → `:root`.

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--primary-green` | `178 48% 21%` | `#1C4F4D` | Primary brand, navbar, headers |
| `--secondary-green` | `178 48% 33%` | `#2C7D7A` | Secondary elements, links |
| `--accent-green` | `164 48% 53%` | `#4DBFA1` | CTAs, highlights, accents |
| `--deep-teal` | `180 84% 32%` | `#0D9488` | Email headers, verification badges |
| `--lime-green` | `84 81% 44%` | `#84CC16` | Success states, growth indicators |
| `--subtle-dark` | `176 39% 17%` | `#1A3C3A` | Deep backgrounds, overlays |

### 3.2 Application Colors (Semantic Tokens)

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--background` | `150 12% 97%` | `180 8% 7%` | Page background |
| `--foreground` | `172 32% 20%` | `150 8% 95%` | Body text |
| `--primary` | `175 42% 35%` | `168 38% 45%` | Buttons, interactive elements |
| `--secondary` | `178 48% 33%` | `175 8% 18%` | Secondary buttons, tags |
| `--muted` | `160 14% 93%` | `175 6% 14%` | Muted surfaces |
| `--accent` | `165 35% 92%` | `168 20% 18%` | Hover states, highlights |
| `--destructive` | `15 65% 55%` | `18 60% 50%` | Errors, cancel actions |
| `--border` | `165 18% 86%` | `170 8% 20%` | Borders, dividers |

### 3.3 Highlight & Status Colors

| Token | HSL | Usage |
|---|---|---|
| `--highlight` | `42 90% 55%` | Gold accent, premium features |
| `--highlight-soft` | `42 85% 65%` | Soft gold backgrounds |
| `--success` (dark) | `158 50% 42%` | Verified, approved states |
| `--warning` (dark) | `38 70% 50%` | Pending, attention needed |
| `--info` (dark) | `195 55% 48%` | Informational messages |

### 3.4 Navbar Colors

| Token | Value | Usage |
|---|---|---|
| `--navbar-forest` | `168 30% 14%` | Deep forest green navbar |
| `--navbar-gold` | `45 92% 45%` | Gold accents in nav |
| `--nav-bg` | `178 42% 21%` | Navigation background |

### 3.5 Tailwind Usage

Always use semantic tokens in components — **never hardcode hex/rgb**:

```tsx
// ✅ Correct
<div className="bg-primary text-primary-foreground" />
<div className="bg-brand-primary-green text-foreground" />
<div className="bg-card border-border" />

// ❌ Wrong
<div className="bg-[#1C4F4D] text-white" />
<div style={{ backgroundColor: '#0D9488' }} />
```

---

## 4. Typography

### 4.1 Font Stack

| Role | Font | Tailwind Class | Usage |
|---|---|---|---|
| **Primary** | Plus Jakarta Sans | `font-jakarta` | Body, headings, buttons, UI |
| **Pharma Display** | Archivo Narrow | `font-pharma` | Medical headers, narrow displays |
| **Decorative** | Cinzel | `font-decorative` | Premium/luxury contexts only |
| **Monospace** | Geist Mono | `font-geist-mono` | Code, order IDs, technical data |

### 4.2 Type Scale

Defined as CSS variables in `src/index.css`:

| Token | Size | Usage |
|---|---|---|
| `--font-size-xs` | 0.75rem (12px) | Captions, fine print |
| `--font-size-sm` | 0.875rem (14px) | Labels, secondary text |
| `--font-size-base` | 1rem (16px) | Body text |
| `--font-size-lg` | 1.125rem (18px) | Lead paragraphs |
| `--font-size-xl` | 1.25rem (20px) | Card titles |
| `--font-size-2xl` | 1.5rem (24px) | Section subtitles |
| `--font-size-3xl` | 1.875rem (30px) | Section headings |
| `--font-size-4xl` | 2.25rem (36px) | Page titles |
| `--font-size-5xl` | 3rem (48px) | Hero headings |

### 4.3 Heading Hierarchy

```css
h1: text-4xl md:text-5xl lg:text-6xl — line-height: 1.1, letter-spacing: -0.02em
h2: text-3xl md:text-4xl lg:text-5xl — line-height: 1.15
h3: text-2xl md:text-3xl — line-height: 1.25
h4: text-xl md:text-2xl
p:  text-base md:text-lg — line-height: 1.7, letter-spacing: 0.01em
```

### 4.4 Font Weight Usage

| Weight | Usage |
|---|---|
| 400 (Regular) | Body text, descriptions |
| 500 (Medium) | Labels, buttons, nav items |
| 600 (Semibold) | Headings, card titles |
| 700 (Bold) | Hero headings, emphasis |

---

## 5. Spacing & Layout

### 5.1 Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `--spacing-xs` | 0.5rem (8px) | Tight gaps, icon spacing |
| `--spacing-sm` | 0.75rem (12px) | Form field gaps |
| `--spacing-md` | 1rem (16px) | Standard padding |
| `--spacing-lg` | 1.5rem (24px) | Card padding, section gaps |
| `--spacing-xl` | 2rem (32px) | Section padding |
| `--spacing-2xl` | 3rem (48px) | Major section breaks |
| `--spacing-3xl` | 4rem (64px) | Hero padding |

### 5.2 Border Radius

| Token | Value |
|---|---|
| `--radius` | 0.75rem (12px) — base |
| `sm` | 8px |
| `md` | 10px |
| `lg` | 12px |
| `xl` | 16px |
| `2xl` | 20px |

### 5.3 Container

- Max width: `1400px`
- Padding: `2rem`
- Centered

---

## 6. Gradients

| Token | Definition | Usage |
|---|---|---|
| `--gradient-primary` | Accent green → Secondary green (135°) | CTAs, hero elements |
| `--gradient-teal-midnight` | Secondary → Primary green (135°) | Deep section backgrounds |
| `--gradient-sage-teal` | Sage → Accent green (135°) | Soft section transitions |
| `--gradient-hero` | Transparent accent green → teal (180°) | Hero overlay |
| `--gradient-warm` | Light accent → sage (135°) | Warm section backgrounds |

---

## 7. Shadows

Sage-tinted shadows for cohesive feel:

| Token | Usage |
|---|---|
| `--shadow-xs` | Subtle elevation (inputs) |
| `--shadow-sm` | Cards at rest |
| `--shadow-md` | Cards on hover |
| `--shadow-lg` | Elevated panels |
| `--shadow-xl` | Modals, dropdowns |
| `--shadow-card` | Card with border + shadow |
| `--shadow-elegant` | Premium card treatment |

---

## 8. Motion & Transitions

| Token | Curve | Usage |
|---|---|---|
| `--transition-base` | `cubic-bezier(0.4, 0, 0.2, 1)` 150ms | Default state changes |
| `--transition-smooth` | `cubic-bezier(0.4, 0, 0.2, 1)` 200ms | Hover/focus |
| `--transition-spring` | `cubic-bezier(0.34, 1.15, 0.64, 1)` 350ms | Enter animations |
| `--transition-bounce` | `cubic-bezier(0.68, -0.3, 0.265, 1.3)` 500ms | Playful emphasis |

Framer Motion is used for page transitions, scroll animations, and hero effects.

---

## 9. Component Patterns

### 9.1 Buttons

| Class | Usage |
|---|---|
| `.btn-primary` | Main CTAs — primary bg, white text |
| `.btn-secondary` | Secondary actions |
| `.btn-outline` | Tertiary, bordered |
| `.btn-ghost` | Minimal, text-only |
| `.btn-glass` | Glassmorphism on dark/image backgrounds |

### 9.2 Cards

| Class | Usage |
|---|---|
| `.card-linear` | Clean bordered card with hover lift |
| `.card-themed` | Dark-mode-aware card |

### 9.3 Sections

| Class | Usage |
|---|---|
| `.section-default` | Standard background |
| `.section-alt` | Alternating sage tint |
| `.section-muted` | Subtle muted surface |
| `.section-sage` | Stronger sage tint |
| `.section-cream` | Warm cream tint |

---

## 10. Dark Mode

Dark mode is fully supported via `.dark` class (Tailwind `darkMode: ["class"]`).

**Rules:**
- All tokens have dark mode overrides in `theme.css`
- Use semantic tokens — they auto-switch
- Test every component in both modes
- Logo switches: teal → white automatically via conditional rendering

---

## 11. Email Branding

### Template Rules

| Element | Color | Logo |
|---|---|---|
| Header (teal `#0D9488`) | White text | `hb-logo-white-full.png` |
| Body (white `#FFFFFF`) | Dark text | — (no logo in body) |
| Footer (gray `#F4F4F5`) | Muted text | `hb-logo-teal-full.png` |

### Sender Domains

| Region | Domain |
|---|---|
| South Africa (default) | `send.healingbuds.co.za` |
| Portugal | `send.healingbuds.pt` |
| United Kingdom | `send.healingbuds.co.uk` |

---

## 12. Accessibility

- WCAG AA contrast minimums for all text
- 44×44px minimum touch targets
- Focus-visible rings using `--ring` token
- Keyboard navigation support throughout
- Screen reader labels on all interactive elements
- Reduced motion support via `prefers-reduced-motion`

---

## 13. How to Modify

### Changing Brand Colors
1. Edit `src/styles/theme.css` — update the HSL values in `:root` and `.dark`
2. The same values are duplicated in `src/index.css` `@layer base :root` — keep both in sync
3. Tailwind config (`tailwind.config.ts`) references these via `hsl(var(--token))` — no changes needed there
4. All components using semantic classes auto-update

### Adding a New Color
1. Add CSS variable to `theme.css` `:root` and `.dark`
2. Add matching entry in `tailwind.config.ts` → `colors`
3. Use via `bg-{name}` / `text-{name}` in components

### Changing Fonts
1. Update `tailwind.config.ts` → `fontFamily`
2. Ensure the font is loaded (Google Fonts link in `index.html` or `@font-face`)
3. Update base styles in `index.css` `@layer base`

### Updating Logos
1. Replace files in `src/assets/` for frontend
2. Upload new versions to `email-assets` storage bucket for emails
3. Update this document

---

## 14. File Reference

| File | Purpose |
|---|---|
| `src/styles/theme.css` | Core design tokens (CSS variables) |
| `src/index.css` | Tailwind layers, utilities, component classes |
| `tailwind.config.ts` | Tailwind theme extension mapping tokens to classes |
| `docs/BRANDING.md` | This document — brand identity guide |
| `src/assets/hb-logo-*.png` | Logo files for frontend |
| `public/email-assets/` | Logo files for email templates |

---

*Last updated: March 2026*
