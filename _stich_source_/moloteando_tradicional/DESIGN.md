---
name: Moloteando Tradicional
colors:
  surface: '#03132b'
  surface-dim: '#03132b'
  surface-bright: '#2b3953'
  surface-container-lowest: '#000e26'
  surface-container-low: '#0c1b34'
  surface-container: '#102038'
  surface-container-high: '#1c2a43'
  surface-container-highest: '#27354e'
  on-surface: '#d6e3ff'
  on-surface-variant: '#c2c6d4'
  inverse-surface: '#d6e3ff'
  inverse-on-surface: '#22314a'
  outline: '#8c909d'
  outline-variant: '#424752'
  surface-tint: '#acc7ff'
  primary: '#acc7ff'
  on-primary: '#002f67'
  primary-container: '#1b5eb8'
  on-primary-container: '#ccdbff'
  inverse-primary: '#185cb6'
  secondary: '#ffc472'
  on-secondary: '#452b00'
  secondary-container: '#f3a300'
  on-secondary-container: '#613e00'
  tertiary: '#6add8d'
  on-tertiary: '#003919'
  tertiary-container: '#006f38'
  on-tertiary-container: '#7ff2a0'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#acc7ff'
  on-primary-fixed: '#001a40'
  on-primary-fixed-variant: '#004591'
  secondary-fixed: '#ffddb3'
  secondary-fixed-dim: '#ffb951'
  on-secondary-fixed: '#291800'
  on-secondary-fixed-variant: '#633f00'
  tertiary-fixed: '#86faa7'
  tertiary-fixed-dim: '#6add8d'
  on-tertiary-fixed: '#00210c'
  on-tertiary-fixed-variant: '#005228'
  background: '#03132b'
  on-background: '#d6e3ff'
  surface-variant: '#27354e'
typography:
  display-lg:
    fontFamily: Epilogue
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Epilogue
    fontSize: 34px
    fontWeight: '800'
    lineHeight: 42px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Epilogue
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: 0em
  headline-md:
    fontFamily: Epilogue
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-sm:
    fontFamily: Epilogue
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Epilogue
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Epilogue
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Epilogue
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-lg:
    fontFamily: Epilogue
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.04em
  label-md:
    fontFamily: Epilogue
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Epilogue
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-md: 1.5rem
  gutter-lg: 2rem
  margin: 1rem
  margin-md: 2rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system channels the warmth, energy, and rich visual culture of Mexican street food and traditional *antojerías*. It establishes a dialogue between vibrant culinary folklore and modern digital ordering. The UI balances tactile street-food authenticity with contemporary digital poise, avoiding caricature while embracing festive warmth.

### Visual Style
The aesthetic fuses **Modern Folk Expression** with **Tactile Street Craft**:
- **Cobalt Talavera Depth**: Deep blue backgrounds reminiscent of classic Mexican glazed ceramics and nocturnal street food stalls.
- **Warm Golden Radiance**: Golden-corn accents mirroring crisp masa fried to perfection.
- **Herbal Accents**: Vibrant cilantro green serving as high-intent utility and freshness highlights.
- **Subtle Talavera Motifs**: Restrained geometric and botanical tile-inspired ornaments used in dividers, badges, and empty states.
- **Friendly & Hearty Geometry**: Generously rounded corners and pill contours that mirror the oblong shape of a freshly pressed molote.

## Colors

The palette directly honors the fried masa tradition framed by Mexican cobalt blue ceramics. Built on a rich dark canvas, the system retains high contrast, readability, and appetite appeal.

### Color Roles
- **Primary (`#1B5EB8` & `#2575FC`)**: Vibrant cobalt blue used for major interactive elements, structural branding bars, active states, and surface illumination.
- **Secondary (`#F4A300` / Masa Dorado)**: Warm golden maize tone drawn directly from crisp fried corn dough. Used for primary calls-to-action, pricing, highlights, and star ratings.
- **Tertiary (`#1F9D55` / Cilantro Fresco)**: Fresh leaf green representing salsas, herbs, and freshness. Utilized for confirmation badges, dietary labels (vegetarian/gluten-free), and cart badges.
- **Neutral Canvas (`#081830` to `#0E3B79`)**: Deep nocturnal cobalt-navy layering that allows the food photography and gold accents to pop vigorously without harsh true-black desaturation.
- **Surface Crisp White (`#FFFFFF` / `#F8FAFC`)**: Reserved for pristine typography, iconography, and high-legibility transactional surfaces.

## Typography

The typographic voice relies on **Epilogue**, an expressive, sturdy geometric sans with bold editorial personality and human warmth. It echoes Mexican hand-painted rotulado sign-painting and traditional printmaking without sacrificing digital legibility on compact mobile screens.

### Usage Rules
- **Display & Section Titles**: Use heavy weights (700 and 800) in Epilogue. Key headers may use uppercase styling with tight negative tracking (`-0.02em`) to mirror hand-painted stall banners.
- **Food Item Titles**: Set in `title-md` or `headline-sm` with semi-bold (600) weight, ensuring Spanish diacritics (á, é, í, ó, ú, ñ) render with robust balance.
- **Body & Descriptions**: Kept at regular (400) weight with generous line-height (`1.6`) against deep navy surfaces to maximize clarity in dim lighting conditions typical of dining environments.

## Layout & Spacing

The layout is built around quick-service food browsing and mobile-first ordering.

### Grid & Layout Structure
- **Mobile (0–599px)**: 4-column fluid layout with `1rem` margins and `1rem` gutters. Optimized for single-handed vertical scrolling and bottom-sheet drawers.
- **Tablet (600–1023px)**: 8-column fluid layout with `2rem` margins and `1.5rem` gutters. Food catalogs shift into an organized 2-column card arrangement.
- **Desktop (1024px+)**: 12-column structured layout capped at a maximum width of `1200px`, featuring a 4-column sticky order summary/cart and an 8-column menu gallery.

### Vertical Rhythm
Spaces follow an 8pt stepping rhythm. Food imagery maintains a 4:3 or 1:1 aspect ratio inside menu cards to showcase golden crust texture and garnish clarity.

## Elevation & Depth

Visual hierarchy is communicated through luminous tonal surfaces and ambient glowing tints rather than stark drop shadows:

- **Base Canvas**: Nocturnal Cobalt (`#081830`).
- **Surface Elevation 1 (Cards & Modules)**: Rich Navy Talavera (`#0E3B79`), finished with a hairline border (`rgba(255, 255, 255, 0.08)`) to maintain crisp boundaries without heavy lines.
- **Surface Elevation 2 (Modals, Overlays & Sticky Bars)**: Elevated Cobalt (`#14478F`) with a soft blue ambient drop shadow: `0 12px 32px rgba(8, 24, 48, 0.60)`.
- **Accent Glow**: High-priority interactive elements (e.g., golden "Ordenar" buttons) carry a warm ambient glow: `0 4px 16px rgba(244, 163, 0, 0.35)`.
- **Folk Borders**: Subtle decorative scalloped or chevron motifs in low-opacity gold (`rgba(244, 163, 0, 0.15)`) separate primary food categories.

## Shapes

The geometric identity takes inspiration from the handcrafted, tapered form of the **molote** (an artisanal, curved masa parcel).

- **Standard Radii (Level 2 - Rounded)**: Base components utilize `0.5rem` (8px).
- **Cards & Food Containers**: Styled with `rounded-lg` (1rem / 16px) or `rounded-xl` (1.5rem / 24px) to feel soft, friendly, and culinary.
- **Pills**: Action buttons, salsa badges, and price tags frequently employ full pill radiuses (`9999px`) to emphasize street-food quick-tap ergonomics.

## Components

### Buttons
- **Primary ("Ordenar / Agregar")**: Golden masa background (`#F4A300`) with deep midnight blue text (`#081830`), bold uppercase Epilogue lettering, pill-shaped radius (`9999px`), and a subtle golden glow on hover.
- **Secondary**: Translucent cobalt (`rgba(27, 94, 184, 0.25)`) with bright cobalt border (`#2575FC`) and crisp white text.
- **Tertiary / Ghost**: Borderless with white or gold text, underlined with a decorative two-dot Talavera indicator on hover.

### Food Menu Cards
- Base background set to `#0E3B79` with `1rem` corner rounding.
- Features a high-contrast top-aligned food photograph, overlaid with a pill badge for spice level (mild, green salsa, chipotle) or status (e.g., *"Más Vendido"* in `#F4A300`).
- Price displayed in oversized bold typography, accompanied by a quick `+` floating action button in cilantro green (`#1F9D55`).

### Chips & Filter Pills
- Unselected: Dark navy fill (`#0A254E`) with a soft border (`rgba(255, 255, 255, 0.15)`) and white label text.
- Selected: Vibrant cobalt blue fill (`#1B5EB8`) with white bold text and a subtle golden border dot indicator.

### Input Fields & Selectors
- Background: Deep indigo surface (`#071A34`) with inset padding (`0.75rem 1rem`).
- Border: `1px solid rgba(255, 255, 255, 0.15)`. Active/focused states transition to `#F4A300` with an outer ring blur (`0 0 0 3px rgba(244, 163, 0, 0.2)`).
- Placeholder text in soft steel blue (`#8FA8CD`).

### Salsa & Garnish Selectors (Checkboxes & Radios)
- Rounded custom checkboxes (`rounded: 6px`) and radios (`rounded: 9999px`).
- Inactive: Ring in `rgba(255, 255, 255, 0.3)`.
- Active: Filled with Cilantro Green (`#1F9D55`) or Masa Gold (`#F4A300`) featuring an inner white checkmark or center pip.

### Street Cart Drawer / Floating Tray
- Bottom-docked sticky bar on mobile devices: `#0E3B79` with a top golden border (`2px solid #F4A300`).
- Displays total molotes count, item summary, and a high-visibility golden CTA button for instant checkout.