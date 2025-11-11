# RUNSTR SUBSCRIPTION IMPLEMENTATION SPECIFICATION
**Technical Architecture for Premium Tier**

**Version:** 1.0
**Last Updated:** January 2025
**Owner:** Engineering Team

---

## Overview

This document specifies the technical implementation of RUNSTR's subscription system to enable Premium tier ($4.99/mo or $49/year) with feature gating, trial management, and payment processing.

**Goals:**
1. Gate Advanced Stats page behind paywall
2. Restrict RUNSTR Season competitions to Premium subscribers
3. Enable 7-day free trials
4. Support monthly and annual subscriptions
5. Minimize implementation complexity (2-3 weeks for MVP)

**Technology Stack:**
- **Payment Processor:** RevenueCat (recommended) or Stripe
- **Platform:** React Native (iOS/Android)
- **Storage:** AsyncStorage for subscription status cache
- **Analytics:** Track conversion funnels and churn

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      RUNSTR App (React Native)              │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  UI Layer                                            │ │
│  │  - Paywall Modals                                    │ │
│  │  - Subscription Management Screen                     │ │
│  │  - Feature Gating Components                         │ │
│  └──────────────────────────────────────────────────────┘ │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Business Logic Layer                                │ │
│  │  - SubscriptionService (check status, manage trials)│ │
│  │  - PremiumFeatureGate (HOC for gating)              │ │
│  │  - ConversionTracking (analytics)                   │ │
│  └──────────────────────────────────────────────────────┘ │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Data Layer                                          │ │
│  │  - AsyncStorage (cache subscription status)         │ │
│  │  - Subscription State (global context)              │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────┐
         │   RevenueCat API (or Stripe API)       │
         │   - Purchase validation                 │
         │   - Subscription status                 │
         │   - Receipt verification                │
         └────────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────────┐
         │   App Store / Google Play               │
         │   - In-app purchase processing          │
         │   - Receipt generation                  │
         │   - Subscription management             │
         └────────────────────────────────────────┘
```

---

## Technology Decision: RevenueCat vs Stripe

### Option 1: RevenueCat (Recommended)

**Pros:**
- ✅ Handles iOS and Android in-app purchases with single API
- ✅ Automatic receipt validation (no server needed)
- ✅ Built-in trial management
- ✅ Subscription analytics dashboard
- ✅ Free tier: Up to $2,500 MRR (enough for first 500 subscribers)
- ✅ React Native SDK available

**Cons:**
- ⚠️ Vendor lock-in (switching later requires migration)
- ⚠️ 1-2% fee after $2,500 MRR (acceptable for 10K+ subscribers)

**Cost:**
- Free: 0-$2,500 MRR
- Growth: $299/mo for $2,500-$10K MRR
- Pro: $899/mo for $10K+ MRR

**Use Case:** Best for React Native apps needing iOS + Android support

---

### Option 2: Stripe

**Pros:**
- ✅ More flexible (web payments, Lightning integrations)
- ✅ Lower fees (2.9% + $0.30 vs RevenueCat's 1-2% on top of app store fees)
- ✅ More control over subscription logic

**Cons:**
- ❌ Requires backend server (more complexity)
- ❌ Doesn't handle iOS/Android in-app purchases (must use StoreKit/Google Billing separately)
- ❌ Receipt validation needs custom implementation

**Cost:**
- 2.9% + $0.30 per transaction

**Use Case:** Best if we need web subscriptions or want to avoid app store fees (requires compliance workarounds)

---

### Decision: RevenueCat for MVP

**Rationale:**
1. Faster implementation (1 week vs 3 weeks for Stripe + server)
2. Handles mobile IAP complexity (receipt validation, refunds, cancellations)
3. Free for first $2,500 MRR (no upfront cost)
4. Can migrate to Stripe later if needed

---

## Implementation Plan

### Phase 1: Core Subscription Infrastructure (Week 1)

#### Task 1.1: Install RevenueCat SDK

**Install Dependencies:**
```bash
npm install react-native-purchases
npx pod-install  # iOS only
```

**Configure iOS:**
1. Create app in App Store Connect
2. Create subscription products:
   - `runstr_monthly`: $4.99/month with 7-day free trial
   - `runstr_annual`: $49.99/year with 7-day free trial
3. Get RevenueCat API key from dashboard
4. Add API key to `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-purchases",
        {
          "apiKey": "your_revenuecat_api_key"
        }
      ]
    ]
  }
}
```

**Configure Android:**
1. Create app in Google Play Console
2. Create subscription products (same IDs as iOS)
3. Add Google Play billing permission to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="com.android.vending.BILLING" />
```

---

#### Task 1.2: Create SubscriptionService

**File:** `src/services/subscription/SubscriptionService.ts`

```typescript
import Purchases, { PurchasesOffering, CustomerInfo } from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionPeriod = 'monthly' | 'annual';

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  expiresAt?: Date;
  isActive: boolean;
  isTrial: boolean;
  willRenew: boolean;
  period?: SubscriptionPeriod;
}

class SubscriptionService {
  private static instance: SubscriptionService;
  private customerInfo: CustomerInfo | null = null;
  private offerings: PurchasesOffering | null = null;

  private constructor() {}

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  /**
   * Initialize RevenueCat SDK with user ID
   * Call this after user authenticates (npub/nsec login)
   */
  async initialize(userId: string): Promise<void> {
    try {
      await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
      await Purchases.logIn(userId);

      // Fetch initial subscription status
      await this.refreshSubscriptionStatus();

      // Fetch available offerings (subscription products)
      this.offerings = await Purchases.getOfferings();
    } catch (error) {
      console.error('SubscriptionService.initialize error:', error);
      throw error;
    }
  }

  /**
   * Refresh subscription status from RevenueCat
   * Call this on app foreground, after purchase, or when checking features
   */
  async refreshSubscriptionStatus(): Promise<SubscriptionStatus> {
    try {
      this.customerInfo = await Purchases.getCustomerInfo();
      const status = this.parseSubscriptionStatus(this.customerInfo);

      // Cache in AsyncStorage for offline access
      await AsyncStorage.setItem('@runstr:subscription_status', JSON.stringify(status));

      return status;
    } catch (error) {
      console.error('SubscriptionService.refreshSubscriptionStatus error:', error);

      // Return cached status if network fails
      const cached = await AsyncStorage.getItem('@runstr:subscription_status');
      if (cached) {
        return JSON.parse(cached);
      }

      // Default to free tier if no cache
      return { tier: 'free', isActive: false, isTrial: false, willRenew: false };
    }
  }

  /**
   * Parse CustomerInfo from RevenueCat into our SubscriptionStatus format
   */
  private parseSubscriptionStatus(customerInfo: CustomerInfo): SubscriptionStatus {
    const entitlements = customerInfo.entitlements.active;

    // Check if user has "premium" entitlement
    if (entitlements['premium']) {
      const entitlement = entitlements['premium'];

      return {
        tier: 'premium',
        isActive: true,
        isTrial: entitlement.periodType === 'trial',
        willRenew: entitlement.willRenew,
        expiresAt: new Date(entitlement.expirationDate || Date.now()),
        period: entitlement.productIdentifier?.includes('annual') ? 'annual' : 'monthly',
      };
    }

    return { tier: 'free', isActive: false, isTrial: false, willRenew: false };
  }

  /**
   * Get current subscription status (cached or fresh)
   */
  async getStatus(): Promise<SubscriptionStatus> {
    if (!this.customerInfo) {
      return this.refreshSubscriptionStatus();
    }
    return this.parseSubscriptionStatus(this.customerInfo);
  }

  /**
   * Check if user has premium access
   */
  async isPremium(): Promise<boolean> {
    const status = await this.getStatus();
    return status.tier === 'premium' && status.isActive;
  }

  /**
   * Purchase subscription (monthly or annual)
   */
  async purchase(period: SubscriptionPeriod): Promise<CustomerInfo> {
    try {
      if (!this.offerings?.current) {
        throw new Error('No subscription offerings available');
      }

      const packageId = period === 'annual' ? 'annual' : 'monthly';
      const packageToPurchase = this.offerings.current.availablePackages.find(
        (pkg) => pkg.identifier === packageId
      );

      if (!packageToPurchase) {
        throw new Error(`Package ${packageId} not found`);
      }

      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      this.customerInfo = customerInfo;

      // Track conversion event
      await this.trackConversion(period);

      return customerInfo;
    } catch (error: any) {
      if (error.code === 'USER_CANCELLED') {
        console.log('User cancelled subscription purchase');
      } else {
        console.error('SubscriptionService.purchase error:', error);
      }
      throw error;
    }
  }

  /**
   * Restore purchases (for users who reinstall app)
   */
  async restorePurchases(): Promise<CustomerInfo> {
    try {
      this.customerInfo = await Purchases.restorePurchases();
      await this.refreshSubscriptionStatus();
      return this.customerInfo;
    } catch (error) {
      console.error('SubscriptionService.restorePurchases error:', error);
      throw error;
    }
  }

  /**
   * Get available subscription offerings (for paywall UI)
   */
  async getOfferings(): Promise<PurchasesOffering | null> {
    if (!this.offerings) {
      this.offerings = await Purchases.getOfferings();
    }
    return this.offerings.current || null;
  }

  /**
   * Track subscription conversion event (for analytics)
   */
  private async trackConversion(period: SubscriptionPeriod): Promise<void> {
    // TODO: Integrate with analytics service (Mixpanel, Amplitude, etc.)
    console.log(`Subscription conversion: ${period}`);
  }
}

export default SubscriptionService;
```

---

#### Task 1.3: Create Subscription Context (Global State)

**File:** `src/contexts/SubscriptionContext.tsx`

```typescript
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import SubscriptionService, { SubscriptionStatus } from '../services/subscription/SubscriptionService';
import { useAuth } from './AuthContext'; // Existing auth context

interface SubscriptionContextType {
  status: SubscriptionStatus | null;
  isPremium: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
  purchase: (period: 'monthly' | 'annual') => Promise<void>;
  restore: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth(); // Get logged-in user
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize subscription service when user logs in
  useEffect(() => {
    if (user?.npub) {
      initializeSubscription();
    }
  }, [user?.npub]);

  const initializeSubscription = async () => {
    try {
      setIsLoading(true);
      const service = SubscriptionService.getInstance();
      await service.initialize(user.npub);
      const newStatus = await service.getStatus();
      setStatus(newStatus);
    } catch (error) {
      console.error('Failed to initialize subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refresh = async () => {
    try {
      const service = SubscriptionService.getInstance();
      const newStatus = await service.refreshSubscriptionStatus();
      setStatus(newStatus);
    } catch (error) {
      console.error('Failed to refresh subscription:', error);
    }
  };

  const purchase = async (period: 'monthly' | 'annual') => {
    try {
      const service = SubscriptionService.getInstance();
      await service.purchase(period);
      await refresh();
    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  };

  const restore = async () => {
    try {
      const service = SubscriptionService.getInstance();
      await service.restorePurchases();
      await refresh();
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  };

  const isPremium = status?.tier === 'premium' && status?.isActive;

  return (
    <SubscriptionContext.Provider value={{ status, isPremium, isLoading, refresh, purchase, restore }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};
```

---

### Phase 2: Feature Gating (Week 2)

#### Task 2.1: Create PremiumFeatureGate Component

**File:** `src/components/subscription/PremiumFeatureGate.tsx`

```typescript
import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { PaywallModal } from './PaywallModal';

interface PremiumFeatureGateProps {
  children: ReactNode;
  feature: 'advanced_stats' | 'runstr_season' | 'data_export';
  fallback?: ReactNode;
}

export const PremiumFeatureGate: React.FC<PremiumFeatureGateProps> = ({
  children,
  feature,
  fallback,
}) => {
  const { isPremium, isLoading } = useSubscription();
  const [showPaywall, setShowPaywall] = React.useState(false);

  if (isLoading) {
    return <View>{/* Loading spinner */}</View>;
  }

  if (isPremium) {
    return <>{children}</>;
  }

  // Show fallback or paywall
  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <>
      <PaywallModal
        visible={!isPremium}
        feature={feature}
        onDismiss={() => {}}
      />
    </>
  );
};
```

---

#### Task 2.2: Gate Advanced Stats Page

**File:** `src/screens/AdvancedAnalyticsScreen.tsx`

**Before (No Paywall):**
```typescript
export const AdvancedAnalyticsScreen = () => {
  return (
    <View>
      <Text>VO2 Max: 48 ml/kg/min</Text>
      <Text>Fitness Age: 28</Text>
      {/* ... rest of analytics */}
    </View>
  );
};
```

**After (With Paywall):**
```typescript
import { PremiumFeatureGate } from '../components/subscription/PremiumFeatureGate';
import { useSubscription } from '../contexts/SubscriptionContext';

export const AdvancedAnalyticsScreen = () => {
  const { isPremium } = useSubscription();

  return (
    <PremiumFeatureGate feature="advanced_stats">
      <View>
        <Text>VO2 Max: 48 ml/kg/min</Text>
        <Text>Fitness Age: 28</Text>
        {/* ... rest of analytics */}
      </View>
    </PremiumFeatureGate>
  );
};
```

---

#### Task 2.3: Gate RUNSTR Season Competitions

**File:** `src/services/competition/SimpleCompetitionService.ts`

```typescript
import { useSubscription } from '../contexts/SubscriptionContext';

export const canJoinSeason = async (seasonId: string): Promise<boolean> => {
  const subscriptionService = SubscriptionService.getInstance();
  const isPremium = await subscriptionService.isPremium();

  // RUNSTR Season competitions are Premium-only
  return isPremium;
};
```

**File:** `src/screens/EventDetailScreen.tsx`

```typescript
const handleJoinEvent = async () => {
  if (event.type === 'runstr_season') {
    const canJoin = await canJoinSeason(event.id);
    if (!canJoin) {
      // Show paywall modal
      setShowPaywall(true);
      return;
    }
  }

  // Proceed with join request...
};
```

---

### Phase 3: Paywall UI (Week 2)

#### Task 3.1: Create PaywallModal Component

**File:** `src/components/subscription/PaywallModal.tsx`

```typescript
import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSubscription } from '../../contexts/SubscriptionContext';

interface PaywallModalProps {
  visible: boolean;
  feature: 'advanced_stats' | 'runstr_season' | 'data_export';
  onDismiss: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ visible, feature, onDismiss }) => {
  const { purchase, isLoading } = useSubscription();
  const [selectedPlan, setSelectedPlan] = React.useState<'monthly' | 'annual'>('annual');
  const [purchasing, setPurchasing] = React.useState(false);

  const featureDescriptions = {
    advanced_stats: {
      title: 'Advanced Analytics',
      benefits: [
        'VO2 Max & Fitness Age',
        'Training Load Tracking',
        'Calorie Balance Analysis',
        'Historical Trends & Predictions',
      ],
    },
    runstr_season: {
      title: 'RUNSTR Season',
      benefits: [
        '3-Month Global Competition',
        '$200,000+ Sats Prize Pool',
        'Compete Against Best Athletes',
        'Seasonal Rankings & Awards',
      ],
    },
    data_export: {
      title: 'Data Export',
      benefits: [
        'Download All Workout Data (CSV/JSON)',
        'Complete Data Ownership',
        'Migrate to Any Platform',
        'Historical Analytics Export',
      ],
    },
  };

  const handlePurchase = async () => {
    try {
      setPurchasing(true);
      await purchase(selectedPlan);
      onDismiss(); // Close modal on successful purchase
    } catch (error) {
      console.error('Purchase failed:', error);
      // Show error message
    } finally {
      setPurchasing(false);
    }
  };

  const description = featureDescriptions[feature];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <Text style={styles.title}>{description.title}</Text>
          <Text style={styles.subtitle}>Unlock your full potential</Text>

          {/* Benefits */}
          <View style={styles.benefitsList}>
            {description.benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitRow}>
                <Text style={styles.checkmark}>✅</Text>
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          {/* Plan Selection */}
          <View style={styles.planSelector}>
            <TouchableOpacity
              style={[styles.planOption, selectedPlan === 'annual' && styles.planSelected]}
              onPress={() => setSelectedPlan('annual')}
            >
              <Text style={styles.planLabel}>Annual - Best Value</Text>
              <Text style={styles.planPrice}>$49/year</Text>
              <Text style={styles.planSavings}>Save $10.88 (16% off)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.planOption, selectedPlan === 'monthly' && styles.planSelected]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <Text style={styles.planLabel}>Monthly</Text>
              <Text style={styles.planPrice}>$4.99/month</Text>
              <Text style={styles.planFlexibility}>Cancel anytime</Text>
            </TouchableOpacity>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.purchaseButton}
            onPress={handlePurchase}
            disabled={purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.purchaseButtonText}>Start 7-Day Free Trial</Text>
            )}
          </TouchableOpacity>

          {/* Comparison */}
          <Text style={styles.comparison}>
            59% cheaper than Strava Premium ($12/mo)
          </Text>

          {/* Social Proof */}
          <Text style={styles.socialProof}>
            Join 1,500 Premium members who own their fitness data
          </Text>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
            <Text style={styles.closeButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // ... styles
});
```

---

### Phase 4: Subscription Management Screen (Week 3)

#### Task 4.1: Build Subscription Management UI

**File:** `src/screens/SubscriptionManagementScreen.tsx`

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Linking } from 'react-native';

export const SubscriptionManagementScreen = () => {
  const { status, restore } = useSubscription();

  const handleManageSubscription = () => {
    // Open App Store subscription management
    if (Platform.OS === 'ios') {
      Linking.openURL('https://apps.apple.com/account/subscriptions');
    } else {
      Linking.openURL('https://play.google.com/store/account/subscriptions');
    }
  };

  const handleRestorePurchases = async () => {
    try {
      await restore();
      Alert.alert('Success', 'Purchases restored successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    }
  };

  if (!status || status.tier === 'free') {
    return (
      <View>
        <Text>You're on the free plan</Text>
        <TouchableOpacity onPress={() => navigation.navigate('PaywallModal')}>
          <Text>Upgrade to Premium</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleRestorePurchases}>
          <Text>Restore Purchases</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <Text>Premium Member 🎉</Text>
      <Text>Plan: {status.period === 'annual' ? 'Annual' : 'Monthly'}</Text>
      <Text>Status: {status.isTrial ? 'Free Trial' : 'Active'}</Text>
      {status.expiresAt && (
        <Text>
          {status.willRenew ? 'Renews' : 'Expires'} on{' '}
          {status.expiresAt.toLocaleDateString()}
        </Text>
      )}

      <TouchableOpacity onPress={handleManageSubscription}>
        <Text>Manage Subscription</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleRestorePurchases}>
        <Text>Restore Purchases</Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

## Conversion Tracking & Analytics

### Events to Track

**Funnel Events:**
1. `paywall_viewed` (user sees paywall modal)
2. `trial_started` (user starts 7-day trial)
3. `purchase_completed` (user converts to paid)
4. `subscription_renewed` (user renews after first period)
5. `subscription_cancelled` (user cancels subscription)

**Feature Events:**
6. `stats_page_visited` (user tries to view Stats page)
7. `season_join_attempted` (user tries to join RUNSTR Season)
8. `paywall_dismissed` (user closes paywall without subscribing)

**Implementation:**
```typescript
import analytics from '@react-native-firebase/analytics';

export const trackEvent = async (eventName: string, params?: object) => {
  await analytics().logEvent(eventName, params);
};

// Usage
trackEvent('paywall_viewed', { feature: 'advanced_stats', from_screen: 'AdvancedAnalyticsScreen' });
trackEvent('trial_started', { plan: 'annual' });
trackEvent('purchase_completed', { plan: 'monthly', revenue: 4.99 });
```

---

## Testing Checklist

### Unit Tests
- [ ] `SubscriptionService.getStatus()` returns correct status
- [ ] `SubscriptionService.isPremium()` handles trial periods correctly
- [ ] `PremiumFeatureGate` blocks free users from premium features
- [ ] `PaywallModal` displays correct pricing for monthly/annual

### Integration Tests
- [ ] Purchase flow works on iOS test device
- [ ] Purchase flow works on Android test device
- [ ] Trial expiration triggers paywall after 7 days
- [ ] Subscription restores correctly on reinstall
- [ ] Subscription status syncs across devices

### User Acceptance Tests
- [ ] Free user can't access Stats page (sees paywall)
- [ ] Free user can't join RUNSTR Season (sees paywall)
- [ ] Premium user can access all gated features
- [ ] Premium user on trial sees "X days remaining" banner
- [ ] Cancelled subscription still works until expiration date

---

## Deployment Checklist

### Pre-Launch
- [ ] Create subscription products in App Store Connect
- [ ] Create subscription products in Google Play Console
- [ ] Configure RevenueCat with API keys
- [ ] Test purchases in sandbox mode (iOS + Android)
- [ ] Set up analytics events (Firebase, Mixpanel, etc.)
- [ ] Write subscription terms & privacy policy
- [ ] Create subscription FAQ page

### Launch Day
- [ ] Submit iOS app with subscriptions for review (2-7 days)
- [ ] Submit Android app with subscriptions for review (1-3 days)
- [ ] Announce Premium tier launch to existing users
- [ ] Offer launch promotion (50% off first year)
- [ ] Monitor conversion funnel closely (first 48 hours critical)

### Post-Launch
- [ ] Monitor churn rate weekly
- [ ] A/B test paywall messaging
- [ ] Send trial expiration reminders (Day 5, 6, 7)
- [ ] Launch win-back campaign for churned users

---

## Estimated Timeline

**Week 1: Core Infrastructure**
- Install RevenueCat SDK
- Implement SubscriptionService
- Create SubscriptionContext

**Week 2: Feature Gating + Paywall UI**
- Gate Stats page
- Gate RUNSTR Season
- Build PaywallModal component
- Add conversion tracking

**Week 3: Polish + Testing**
- Build Subscription Management screen
- Test on iOS/Android devices
- Write unit + integration tests
- Submit for app store review

**Total: 3 weeks from start to app store submission**

---

## Support & Troubleshooting

### Common Issues

**Issue 1: "No products available"**
- **Cause:** App Store Connect products not synced to RevenueCat
- **Solution:** Wait 24 hours, or clear RevenueCat cache in dashboard

**Issue 2: "Receipt validation failed"**
- **Cause:** Sandbox testing with production API key
- **Solution:** Use RevenueCat sandbox API key for testing

**Issue 3: "Subscription not restoring"**
- **Cause:** User logged in with different Apple ID
- **Solution:** Call `Purchases.restorePurchases()` to re-sync

### Contact RevenueCat Support

**Email:** support@revenuecat.com
**Docs:** docs.revenuecat.com
**Slack Community:** revenuecat-community.slack.com

---

## Conclusion

This specification provides a complete blueprint for implementing subscriptions in RUNSTR. By following this plan, we can launch Premium tier in 3 weeks and start generating revenue.

**Next Steps:**
1. Approve this spec (stakeholder signoff)
2. Create App Store Connect + Google Play subscription products
3. Begin Week 1 implementation (RevenueCat SDK + SubscriptionService)
4. Launch with 50% discount for first 1,000 subscribers

**Success Metrics:**
- 15% free-to-paid conversion rate
- <5% monthly churn
- $73,500 ARR by Year 1 end

Let's build this and start monetizing RUNSTR sustainably.

---

*Last updated: January 2025*
