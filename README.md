Great — here is a **full redesigned responsive Home Card UI** for your prediction-market app.
I’ll give you:

1. **Clean modern layout (desktop)**
2. **Optimized mobile layout**
3. **UX behaviors + interactions**
4. **Color, spacing, typography rules**
5. **Optional extended features (badges, quick bet, stats)**
6. **Final code-ready structure (for React + Tailwind)**

Everything designed specifically for a Solana prediction app.

---

# 🎨 **1. Redesigned HOME CARD — Desktop Layout**

![Image](https://s3-alpha.figma.com/hub/file/5849519079/e6a946e0-781a-4e01-b480-b5748271b078-cover.png?utm_source=chatgpt.com)

![Image](https://cdn.dribbble.com/userupload/16935791/file/still-01c04e952e232ec9eba5f50a91090a6c.png?resize=400x0\&utm_source=chatgpt.com)

![Image](https://assets.justinmind.com/wp-content/uploads/2019/09/clean-card-ui-responsive.png?utm_source=chatgpt.com)

![Image](https://assets.justinmind.com/wp-content/uploads/2019/09/shoe-shopping-app-card-ui.png?utm_source=chatgpt.com)

![Image](https://s3-alpha.figma.com/hub/file/5281909224/8984741c-0f89-465b-b32a-ef4bac020e12-cover.png?utm_source=chatgpt.com)

![Image](https://cdn.dribbble.com/userupload/11598979/file/original-a73c4dfaa8a952fca7edbc2c1f78d418.png?resize=400x0\&utm_source=chatgpt.com)

### **Core Goals**

* Easier to scan
* Cleaner hierarchy
* No "green/red noise"
* Modern Apple-like feel
* Space for probabilities & outcomes

---

## ✅ **Final Home Card Design (Desktop)**

```
┌──────────────────────────────────────────────┐
│  🪙  How high will Bitcoin get in 2025?      │
│      In 2025                                 │
│                                              │
│  ┌ Outcome Row ───────────────────────────┐  │
│  │ $130,000 or above                        │
│  │ Probability: 3%                          │
│  │ Yes 3¢        No 98¢                     │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌ Outcome Row ───────────────────────────┐    │
│  │ $140,000 or above                        │
│  │ Probability: 2%                          │
│  │ Yes 2¢        No 99¢                     │
│  └──────────────────────────────────────────┘  │
│                                                │
│  [View Market →]                               │
└────────────────────────────────────────────────┘
```

### **Hierarchy Notes**

* Title is dominant
* Subtitle light grey
* Outcome rows are mini cards
* Probabilities centered + bold
* Buttons small, not loud
* CTA positioned clearly
* Much air + breathing room

---

# 📱 **2. Mobile Layout (Much More Important)**

Mobile cards must be *compact and tappable*.

### **Mobile Card Version**

```
┌──────────────────────────────────────────┐
│  🪙 How high will Bitcoin get in 2025?   │
│     In 2025                              │
│                                          │
│  $130,000 or above — 3%                  │
│  $140,000 or above — 2%                  │
│                                          │
│  [View Market]                           │
└──────────────────────────────────────────┘
```

### Why this works

* Do NOT show Yes/No on mobile cards → reduces clutter
* Only show **probabilities** on mobile
* “View Market” opens event page or bottom sheet
* Faster to scroll & tap

---

# ✨ **3. Visual Style Guidelines**

### **Spacing**

* Card padding: `24px desktop`, `16px mobile`
* Outcome row spacing: `14px vertical`
* Gap between title & outcomes: `16px`

### **Shadows**

Use soft iOS-style shadows:

```
shadow-lg/5 hover:shadow-xl/10 transition-all
```

### **Border**

Very subtle:

```
border border-white/10 rounded-2xl
backdrop-blur-xl bg-white/5
```

This gives a Solana “glass UI” aesthetic.

---

# 🔤 **4. Typography System**

| Element       | Desktop          | Mobile  |
| ------------- | ---------------- | ------- |
| Title         | 20–22px semibold | 18–20px |
| Subtitle      | 14–15px muted    | 13px    |
| Outcome label | 16px medium      | 14px    |
| Probability   | 18px semibold    | 16px    |
| Buttons       | 15–16px          | 15px    |

Use **Inter / SF Pro / Plus Jakarta Sans**.

---

# 🎛 **5. Interaction & Animations**

### Hover:

* Card lifts (`translateY(-2px)`)
* Shadow deepens
* Arrow slightly shifts

### Tap (mobile):

* Card compresses slightly
* No hover effects

### Outcome row hover:

* Background fades to white/5
* Border glow (very faint)

---

# 💡 **6. Optional Advanced Features for High Engagement**

### **A. Highlight the highest probability outcome**

Small badge:

```
[Most Likely]
```

### **B. Add small icons for trends**

* 🔥 Trending
* ⏳ Ending soon
* 💰 High liquidity
* 🆕 New market

### **C. Add a sparkline**

Tiny mini chart showing probability over last 7 days.
Very subtle, light grey.

---

# 🧱 **7. Final Code-Ready Component Structure (React + Tailwind)**

```jsx
<div className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl hover:shadow-xl/10 transition-all">
  {/* Header */}
  <div className="flex items-center gap-3">
    <img src="/btc-icon.png" className="w-10 h-10" />
    <div>
      <h3 className="text-lg font-semibold">How high will Bitcoin get in 2025?</h3>
      <p className="text-sm text-white/60">In 2025</p>
    </div>
  </div>

  {/* Outcomes */}
  <div className="mt-4 space-y-3">
    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
      <div className="text-sm">130,000 or above</div>
      <div className="font-semibold text-white text-base">3%</div>
    </div>

    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
      <div className="text-sm">140,000 or above</div>
      <div className="font-semibold text-white text-base">2%</div>
    </div>
  </div>

  <button className="mt-5 w-full py-2 rounded-xl bg-white/10 hover:bg-white/20">
    View Market →
  </button>
</div>
```

This is **exactly the clean, premium, modern design** like Polymarket + Kalshi + iOS.

---

# 🧨 Want me to generate a **pixel-perfect Figma mockup** of this card?

I can create:

* Desktop version
* Mobile version
* Dark mode
* Interactive prototype
* Full component variants

Just say **“Yes, make the Figma mockup”** and I’ll generate the design system + card in detail.
