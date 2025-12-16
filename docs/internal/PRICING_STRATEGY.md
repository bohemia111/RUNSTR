# RUNSTR PRICING STRATEGY
**Subscription Model, Conversion Funnels, and Revenue Optimization**

**Version:** 1.0
**Last Updated:** January 2025
**Owner:** Product/Growth Team

---

## Executive Summary

RUNSTR uses a freemium SaaS model with a single Premium tier at **$4.99/month or $49/year**—59% cheaper than Strava Premium ($12/mo, $144/yr) while providing comparable or superior features.

**Key Decisions:**
- **95% of features free:** Activity tracking, team participation, competition creation, social features
- **5% of features premium:** Advanced analytics (Stats page), exclusive RUNSTR Season, data export
- **Zero platform fees:** Event management, charity donations, entry fees all pass-through (no RUNSTR cut)

**Target Metrics:**
- **15% free-to-paid conversion:** Industry standard for fitness app freemium
- **<5% monthly churn:** Strong retention via quarterly RUNSTR Seasons and social features
- **6-month payback period:** LTV ($98) / CAC ($16) = healthy SaaS economics

---

## Pricing Rationale

### Why $4.99/Month

**Psychological Pricing:**
- **Below $5 threshold:** Feels "affordable" vs $12 (Strava Premium)
- **Above $3.99:** Signals quality, not "cheap"
- **Annual: $49 vs $50:** Just below psychological barrier, 16% discount vs monthly

**Competitive Positioning:**
- **Strava Premium:** $12/mo ($144/yr) → We're 59% cheaper
- **Garmin Coach:** Free (but requires $300+ device) → We're device-agnostic
- **Nike Run Club:** Free (but data mining) → We're privacy-first

**Value Perception Matrix:**

| Price Point | Perception | Risk |
|-------------|------------|------|
| $2.99/mo | "Too cheap, must be low quality" | Undervalues product |
| $4.99/mo | "Great value, affordable" | ✅ Sweet spot |
| $9.99/mo | "Good value, but competing with streaming services" | Harder conversion |
| $12/mo | "Same as Strava, no price advantage" | Loses differentiation |

**Revenue Model:**
- 10,000 users × 15% conversion × $49/year = **$73,500 ARR** (Year 1)
- 50,000 users × 15% conversion × $49/year = **$367,500 ARR** (Year 2)
- 200,000 users × 15% conversion × $49/year = **$1.47M ARR** (Year 3)

---

## Feature Gating Strategy

### Free Forever (95% of Features)

**Core Value Proposition:** "Everything you need to compete and connect"

**Features:**
1. **Activity Tracking**
   - GPS tracking for all workout types (running, cycling, hiking, etc.)
   - Manual workout entry (strength, meditation, diet)
   - Apple Health sync (unlimited workouts)
   - Garmin Connect integration (unlimited workouts)

2. **Social Features**
   - Workout cards (beautiful SVG social sharing)
   - Post to Nostr (kind 1 social posts)
   - Team discovery and joining
   - Competition participation

3. **Competition System**
   - Join unlimited competitions
   - Create unlimited competitions (captains)
   - View leaderboards
   - Event payment (Lightning invoices)

4. **Basic Analytics**
   - Workout history timeline
   - Basic stats (total distance, calories, duration)
   - Personal records tracking

5. **Team Management**
   - Join teams (unlimited)
   - Captain dashboard (if captain)
   - Member roster management
   - Join request approval

**Why Keep So Much Free:**
- **Network effects:** More free users → more competitions → more value for everyone
- **Viral growth:** Free users invite friends to teams/competitions
- **Conversion funnel:** Let users experience quality before asking for money
- **Mission alignment:** Communities shouldn't pay to organize

---

### Premium Tier: $4.99/Month or $49/Year

**Marketing Tagline:** "Unlock your full potential with advanced insights"

**Features:**
1. **Advanced Stats Page**
   - VO2 Max estimation (cardio performance)
   - Fitness Age calculation (vs population norms)
   - BMI and body composition tracking
   - Weekly caloric balance analysis
   - Activity streak analytics (longest streaks, current streaks)
   - Trend graphs (30-day, 90-day, annual)

2. **RUNSTR Season Access**
   - Exclusive quarterly 3-month competitions
   - $200,000+ sats prize pools
   - Global leaderboards across all activity types
   - Seasonal rankings and awards

3. **Training Analytics**
   - Training load tracking (acute vs chronic workload)
   - Recovery recommendations (prevent overtraining)
   - Performance predictions ("You can run 5K in 22 min with 8 weeks training")
   - Heart rate zone analysis

4. **Data Export**
   - Download all workout data (CSV/JSON)
   - Historical analytics export
   - Nostr event backup
   - Migrate your data anytime (data portability)

5. **Priority Support**
   - Email support <12-hour response time (vs <24hr free)
   - Feature request priority
   - Beta access to new features

**Why This Gating Works:**
- **Value-based pricing:** Premium users get insights worth far more than $4.99
- **Non-blocking:** Free users can still use 95% of app (not crippled freemium)
- **Comparison point:** Strava Premium ($12/mo) gates similar features
- **Upgrade trigger:** Once users are hooked on free features, analytics become desirable

---

## Conversion Funnel Optimization

### The RUNSTR Conversion Funnel

```
Download App (100% of users)
    ↓
Complete Onboarding (90%)
    ↓
First Workout Tracked (80%)
    ↓
Join a Team (60%)
    ↓
View Stats Page Teaser (50%)
    ↓
Start Free Trial (20%)
    ↓
Convert to Paid (15% overall)
```

**Leakage Analysis:**
- **10% drop at onboarding:** Improve UX, reduce friction
- **10% never track workout:** Add activation email sequence
- **20% don't join team:** Improve team discovery, recommended teams
- **50% never see Stats page:** Add in-app prompts, post-workout teasers
- **80% of trial users don't convert:** Shorten trial (7 days → 3 days), add urgency

---

### Conversion Touchpoints

#### Touchpoint 1: Post-Workout Stats Teaser

**When:** Immediately after user completes workout

**UI Element:** Banner at bottom of workout summary

**Copy:**
```
🔒 Want to see your VO2 Max trend?

Unlock advanced analytics with Premium:
• VO2 Max estimation
• Fitness Age calculation
• Training load tracking

Try free for 7 days

[Unlock Premium] button
```

**Success Metric:** 10% of post-workout users tap "Unlock Premium"

---

#### Touchpoint 2: Stats Page Hard Paywall

**When:** User navigates to Stats page from Profile tab

**UI Element:** Full-screen modal with blurred Stats page background

**Copy:**
```
Advanced Analytics
Unlock your full potential

✅ VO2 Max & Fitness Age
✅ Training Load Tracking
✅ Calorie Balance Analysis
✅ Historical Trends & Predictions

$4.99/month or $49/year
59% cheaper than Strava Premium

[Start Free Trial] button
[Learn More] link
```

**Benefit List Below Fold:**
- "See how your fitness age compares to population averages"
- "Predict your 5K time based on current training"
- "Optimize recovery to prevent overtraining"
- "Export all your data anytime (complete ownership)"

**Social Proof:**
- "Join 1,500 Premium members who own their fitness data"

**Success Metric:** 25% of users who hit paywall start trial

---

#### Touchpoint 3: RUNSTR Season Invitation

**When:** Quarterly (start of each season)

**UI Element:** In-app notification + email

**Copy (Email):**
```
Subject: RUNSTR Season 2 is Open! 🏃⚡️

Hey [Name],

RUNSTR Season 2 starts February 1st—a 3-month global competition with $200,000 sats in prizes.

Last season, 500 athletes competed. Top 3 in each category won:
1st: 66,667 sats (~$45)
2nd: 33,333 sats (~$22)
3rd: 16,667 sats (~$11)

**Premium members only.** Upgrade now to compete.

$4.99/month or $49/year
Start free trial (7 days)

[Join RUNSTR Season] button

See you on the leaderboards,
Dakota
```

**Success Metric:** 30% trial start rate from Season invitation emails

---

#### Touchpoint 4: Team Captain Upgrade Prompt

**When:** User creates 3rd competition (power user signal)

**UI Element:** Modal after successful competition creation

**Copy:**
```
You're a power user! 🎉

You've created 3 competitions. You clearly love organizing events.

Premium captains get:
• Advanced member analytics
• Competition performance insights
• Priority support for event issues
• Early access to captain features

Try Premium free for 7 days

[Upgrade to Premium] button
[Maybe Later] link
```

**Success Metric:** 40% trial start (high-intent power users)

---

#### Touchpoint 5: Trial Expiration Urgency

**When:** Day 6 of 7-day trial

**UI Element:** Email + push notification + in-app banner

**Copy (Email):**
```
Subject: Your trial ends tomorrow ⏰

Hey [Name],

Just a heads up: your Premium trial expires in 24 hours.

You've unlocked:
• VO2 Max trend (currently 47 ml/kg/min—excellent!)
• Fitness Age (28, you're 6 years younger than your real age!)
• Training load analysis (you're in the optimal zone)

Keep these insights for just $4.99/month (cancel anytime).

[Keep Premium] button

Not ready? No worries, you'll still have access to:
✅ Unlimited workout tracking
✅ Team competitions
✅ Social workout cards

- Dakota
```

**Success Metric:** 20% of trial users convert at expiration reminder

---

### Free Trial Optimization

**Current: 7-Day Free Trial**

**Arguments for 7 Days:**
- Standard in fitness app industry (Strava, Nike, etc.)
- Gives users time to complete multiple workouts
- See VO2 Max trend (needs 2-3 runs)

**Arguments Against 7 Days:**
- 80% of trial users forget about app by Day 7
- Low urgency = low conversion
- Users "ghost" without canceling (bad UX perception)

**A/B Test Proposal:**

| Variant | Trial Length | Expected Conversion | Rationale |
|---------|--------------|---------------------|-----------|
| Control | 7 days | 15% | Industry standard |
| Test A | 3 days | 18% | Higher urgency, forces engagement |
| Test B | 14 days | 12% | More data, lower urgency |

**Recommendation:** Test 3-day trial with aggressive email sequence (Day 1, Day 2, Day 3 expiration)

---

## Annual vs Monthly Pricing

### Annual Pricing: $49/Year ($4.08/Month)

**Discount:** 16% off vs monthly ($49 vs $59.88)

**Why Offer Annual:**
1. **Cash flow:** Upfront payment improves runway
2. **Retention:** Annual subscribers churn less (pre-committed)
3. **LTV:** 12 months guaranteed vs variable monthly retention

**Conversion Split Target:**
- 60% annual subscriptions ($49)
- 40% monthly subscriptions ($4.99/mo)

**Blended ARPU:** (0.6 × $49) + (0.4 × $59.88) = **$53.35/year**

**Why Users Choose Annual:**
- "Save $10.88/year" messaging
- "Pay once, forget for 12 months" convenience
- Commitment to fitness (signals serious intent)

**Why Users Choose Monthly:**
- Lower commitment (try before fully committing)
- Cash flow (easier to stomach $5 than $50)
- Flexibility (cancel if life changes)

**UI Decision Point:**
```
Choose Your Plan

[Annual - Best Value]
$49/year
Save $10.88 (16% off)

[Monthly]
$4.99/month
Cancel anytime

Both include 7-day free trial

[Start Free Trial] button
```

**Default:** Annual plan (pre-selected radio button)

**Success Metric:** 60% of paid subscribers choose annual

---

## Discounts & Promotions

### Launch Promotion: First 1,000 Subscribers

**Offer:** 50% off first year → $24.50 (normally $49)

**Marketing:**
- "Early adopter pricing: $24.50/year (limited to first 1,000)"
- Creates urgency + rewards early believers
- PR angle: "We sold out 1,000 lifetime deals in 2 weeks"

**Revenue Impact:**
- 1,000 subscribers × $24.50 = $24,500 Year 1 revenue
- Year 2 renewal at full price: 1,000 × $49 × 70% retention = $34,300
- **Lifetime value:** $24.50 + $34.30 (Year 2) + $24.01 (Year 3) = **$82.81**
- Acceptable vs full LTV of $98 (15% discount on lifetime basis)

---

### Student Discount: 40% Off

**Offer:** $29/year (normally $49) with .edu email verification

**Rationale:**
- Students have low income (price sensitive)
- Lifetime value play (capture them early, retain post-graduation)
- Viral: College running clubs will all use RUNSTR

**Verification:**
- SheerID or manual .edu email check
- Must re-verify annually

**Revenue Impact:**
- Assume 500 students in Year 2
- 500 × $29 = $14,500 (vs $24,500 at full price)
- **Trade-off:** $10K less revenue but 500 evangelists in college market

---

### Charity Partner Discount: 20% Off

**Offer:** $39/year (normally $49) via charity affiliate code

**Distribution:**
- Charities get custom code (e.g., "OPENSATS20")
- Include in charity's email blasts, social posts
- Charity earns $5 per paid signup (affiliate commission)

**Win-Win:**
- Users get discount
- Charity earns affiliate revenue ($5 per signup)
- RUNSTR gets cheaper CAC (charity drives signups)

**Revenue Impact:**
- 200 charity-referred subscribers × $39 = $7,800 (vs $9,800 at full price)
- Charity commission: 200 × $5 = $1,000 paid to charity
- **Net to RUNSTR:** $6,800 (but CAC = $0, pure organic)

---

### Seasonal Promotions

**Black Friday / Cyber Monday (November):**
- **Offer:** Annual sub for $35 (28% off)
- **Timing:** 4-day sale (Fri-Mon)
- **Expected conversions:** 500 subs (spike in signups)

**New Year Fitness Resolution (January):**
- **Offer:** "First month free" (monthly subscription)
- **Timing:** Jan 1-31
- **Expected conversions:** 1,000 trial starts, 200 paid conversions

---

## Churn Prevention Strategies

### Target Monthly Churn: <5%

**Industry Benchmarks:**
- Fitness apps: 5-10% monthly churn (high due to seasonal fitness trends)
- SaaS average: 3-8% monthly churn
- RUNSTR target: <5% (with retention tactics below)

---

### Churn Trigger 1: Seasonal Fitness Drop-Off

**Problem:** Users subscribe in January (New Year's resolution), churn by March

**Solution: RUNSTR Seasons (Quarterly Competitions)**
- Q1: Winter Season (Jan-Mar) → Spring transition keeps them engaged
- Q2: Spring Season (Apr-Jun) → Summer transition
- Q3: Summer Season (Jul-Sep) → Fall transition
- Q4: Fall Season (Oct-Dec) → New Year transition

**Psychology:** "I can't cancel mid-season, I'm ranked #23 in my division!"

**Expected Impact:** Reduce Q1→Q2 churn by 30%

---

### Churn Trigger 2: Forgot Why They're Paying

**Problem:** Users don't visit Stats page regularly, forget value

**Solution: Weekly Insights Email**
```
Subject: Your Week in Fitness 📊

Hey [Name],

Your stats this week:
• 3 workouts, 25km total distance
• VO2 Max: 48 ml/kg/min (+1 from last month!)
• Fitness Age: 28 (6 years younger than real age)
• Training load: Optimal zone

Keep it up! You're on track to hit your distance goal.

[View Full Analytics] button

- RUNSTR
```

**Frequency:** Weekly on Monday (start of week, motivational timing)

**Expected Impact:** 20% increase in Stats page visits → 10% churn reduction

---

### Churn Trigger 3: Found Cheaper Alternative

**Problem:** User discovers Strava lowered price or got coupon

**Solution: Proactive Retention Offer**
- Target: Users who haven't logged workout in 14 days (at-risk signal)
- Email: "We miss you! Here's 3 months for $10"
- Discount: 40% off to win them back

**Expected Impact:** Recover 30% of at-risk users

---

### Churn Recovery: Win-Back Campaign

**Target:** Users who canceled in past 90 days

**Email Sequence:**

**Day 30 Post-Churn:**
```
Subject: We miss you, [Name]!

Hey [Name],

We noticed you canceled RUNSTR Premium. We'd love to understand why.

[2-question survey: "What made you cancel?" + "What would bring you back?"]

If it was price, we can offer 50% off for 3 months to win you back: $7.50 total.

[Reactivate Premium] button

- Dakota
```

**Day 60 Post-Churn:**
```
Subject: Here's what's new in RUNSTR

Hey [Name],

Since you left, we've added:
• AI training recommendations (Premium)
• Team vs Team competitions
• Enhanced social feed

We'd love to have you back. Here's 3 months free to check out the new features.

[Claim Free Months] button
```

**Day 90 Post-Churn:**
```
Subject: Final offer: Come back to RUNSTR

Hey [Name],

Last email, I promise!

We really want you back. Here's our best offer: 6 months for $15 (70% off).

If we can't win you back with that, we understand. No hard feelings.

[Reactivate Now] button

- Dakota
```

**Expected Recovery:** 10-15% of churned users reactivate

---

## Pricing Psychology & Messaging

### Anchor to Competitor Pricing

**DON'T say:** "$4.99/month for RUNSTR Premium"

**DO say:** "Strava charges $12/month. RUNSTR charges $4.99/month—59% less for the same features."

**Why:** Anchoring makes $4.99 feel like a steal vs $12 (even if user never considered Strava)

---

### Emphasize Privacy Value

**DON'T say:** "Get advanced analytics"

**DO say:** "Get advanced analytics without selling your data to advertisers"

**Why:** Privacy-conscious users will pay premium to avoid surveillance

---

### Frame Annual as "Less Than Coffee"

**DON'T say:** "$49/year"

**DO say:** "$49/year—less than one coffee per month ($4.08/mo)"

**Why:** Breaks down annual cost to daily amount (feels negligible)

---

### Social Proof at Checkout

**Include on payment page:**
- "Join 1,500 Premium members"
- "Rated 4.9/5 stars by 500 users"
- Testimonial: "Best $50 I spend all year." - Sarah, Brooklyn

**Why:** Reduces purchase anxiety, validates decision

---

## Revenue Projections by Scenario

### Conservative Scenario (10% Conversion)

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Total Users | 10,000 | 50,000 | 200,000 |
| Paid Subscribers | 1,000 | 5,000 | 20,000 |
| ARR | $49,000 | $245,000 | $980,000 |
| Monthly Churn | 6% | 5% | 4% |

---

### Base Scenario (15% Conversion) ← **Target**

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Total Users | 10,000 | 50,000 | 200,000 |
| Paid Subscribers | 1,500 | 7,500 | 30,000 |
| ARR | $73,500 | $367,500 | $1,470,000 |
| Monthly Churn | 5% | 4% | 3% |

---

### Optimistic Scenario (20% Conversion)

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Total Users | 10,000 | 50,000 | 200,000 |
| Paid Subscribers | 2,000 | 10,000 | 40,000 |
| ARR | $98,000 | $490,000 | $1,960,000 |
| Monthly Churn | 4% | 3% | 2% |

---

## A/B Testing Roadmap

### Test 1: Trial Length (Months 1-2)

**Variants:**
- Control: 7-day trial
- Test A: 3-day trial
- Test B: 14-day trial

**Hypothesis:** 3-day trial creates urgency, increases conversion

**Success Metric:** Conversion rate from trial start → paid

---

### Test 2: Paywall Messaging (Months 2-3)

**Variants:**
- Control: "Unlock advanced analytics"
- Test A: "See your VO2 Max trend (like pro athletes)"
- Test B: "Strava charges $12/mo. We charge $4.99/mo."

**Hypothesis:** Competitive comparison increases perceived value

**Success Metric:** Click-through rate on paywall modal

---

### Test 3: Annual vs Monthly Default (Months 3-4)

**Variants:**
- Control: Annual plan pre-selected
- Test A: Monthly plan pre-selected
- Test B: No pre-selection (force user to choose)

**Hypothesis:** Annual default increases annual subscription mix

**Success Metric:** % of subscribers choosing annual

---

### Test 4: Discount Urgency (Months 4-5)

**Variants:**
- Control: "50% off first year"
- Test A: "50% off first year (ends in 48 hours)"
- Test B: "50% off first year (only 100 spots left)"

**Hypothesis:** Scarcity increases immediate conversions

**Success Metric:** Conversion rate during promotion period

---

## Implementation Checklist

### Technical Requirements

**Subscription Infrastructure:**
- [ ] Integrate Stripe or RevenueCat
- [ ] Set up subscription products (Monthly: $4.99, Annual: $49)
- [ ] Implement subscription status API (check user's premium status)
- [ ] Build paywall modals (Stats page, RUNSTR Season)
- [ ] Create trial management system (7-day free trial)
- [ ] Add subscription management screen (cancel, upgrade, billing)

**Analytics & Tracking:**
- [ ] Track conversion funnel (signup → trial → paid)
- [ ] Monitor churn rate (weekly, monthly)
- [ ] Measure CAC by channel (organic, paid ads, referrals)
- [ ] Calculate LTV (average subscription length × ARPU)

**Email Automation:**
- [ ] Welcome series (Days 0-7)
- [ ] Trial expiration reminders (Days 5, 6, 7)
- [ ] Churn recovery sequences (Days 30, 60, 90 post-churn)
- [ ] Weekly insights email (Premium users only)

---

## Success Metrics Dashboard

**Track Weekly:**
- Trial starts
- Trial → Paid conversion rate
- Churn rate (new and existing)
- MRR (Monthly Recurring Revenue)
- ARPU (Average Revenue Per User)

**Track Monthly:**
- Total paid subscribers
- ARR (Annual Recurring Revenue)
- Annual vs Monthly subscription mix
- CAC by channel
- LTV:CAC ratio

**Track Quarterly:**
- Cohort retention curves (Month 1, 3, 6, 12)
- Net Revenue Retention (expansion - churn)
- Product-market fit surveys (NPS score)

---

## Conclusion

RUNSTR's pricing strategy balances three goals:

1. **Accessibility:** $4.99/mo removes price objection, 59% cheaper than Strava
2. **Sustainability:** 15% conversion at $49/yr = $1.47M ARR at 200K users (Year 3)
3. **Mission Alignment:** 95% free features ensure communities can organize without barriers

**Next Steps:**
1. Implement subscription infrastructure (Stripe/RevenueCat)
2. Deploy conversion funnels (Stats page paywall, RUNSTR Season invites)
3. Launch with 50% discount for first 1,000 subscribers
4. A/B test trial length, paywall messaging, and discount urgency
5. Monitor metrics weekly, iterate based on conversion data

The pricing is right. Now let's build the funnels and start converting.

---

*Last updated: January 2025*
