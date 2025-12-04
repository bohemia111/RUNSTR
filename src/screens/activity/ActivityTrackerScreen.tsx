/**
 * ActivityTrackerScreen - Main activity tracking interface
 * Provides tabs for running, walking, cycling, and more activities
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../styles/theme';
import { RunningTrackerScreen } from './RunningTrackerScreen';
import { WalkingTrackerScreen } from './WalkingTrackerScreen';
import { CyclingTrackerScreen } from './CyclingTrackerScreen';
import { ManualWorkoutScreen } from './ManualWorkoutScreen';
import { MeditationTrackerScreen } from './MeditationTrackerScreen';
import { StrengthTrackerScreen } from './StrengthTrackerScreen';
import { DietTrackerScreen } from './DietTrackerScreen';

// Active activity - what screen is being shown
type ActiveActivity =
  | 'run'
  | 'walk'
  | 'cycle'
  | 'strength'
  | 'diet'
  | 'meditation'
  | 'manual';

// Cardio sub-activities shown in bottom sheet
type CardioOption = 'run' | 'walk' | 'cycle';

// Strength sub-activities shown in bottom sheet
type StrengthOption = 'pushups' | 'pullups' | 'situps' | 'squats' | 'curls' | 'bench';

// Diet sub-activities shown in bottom sheet
type DietOption = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'fast';

// Wellness sub-activities shown in bottom sheet (matches MeditationType in MeditationTrackerScreen)
type WellnessOption = 'guided' | 'unguided' | 'breathwork' | 'body_scan' | 'gratitude';

// AsyncStorage key for persisting active tab
const ACTIVITY_TAB_KEY = '@runstr:activity_tab';

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
}

const TabButton: React.FC<TabButtonProps> = ({
  label,
  isActive,
  onPress,
  icon,
}) => (
  <TouchableOpacity
    style={[styles.tabButton, isActive && styles.activeTabButton]}
    onPress={onPress}
  >
    <Ionicons
      name={icon}
      size={24}
      color={isActive ? theme.colors.text : theme.colors.textMuted}
    />
    <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
      {label}
    </Text>
  </TouchableOpacity>
);

interface CardioMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: CardioOption) => void;
}

const CardioMenu: React.FC<CardioMenuProps> = ({
  visible,
  onClose,
  onSelectOption,
}) => {
  const slideAnim = React.useRef(new Animated.Value(300)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSelectOption = (option: CardioOption) => {
    onSelectOption(option);
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.cardioMenuContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.menuHandle} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleSelectOption('run')}
          >
            <Ionicons name="walk" size={24} color={theme.colors.text} />
            <Text style={styles.menuLabel}>Running</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleSelectOption('walk')}
          >
            <Ionicons name="footsteps" size={24} color={theme.colors.text} />
            <Text style={styles.menuLabel}>Walking</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleSelectOption('cycle')}
          >
            <Ionicons name="bicycle" size={24} color={theme.colors.text} />
            <Text style={styles.menuLabel}>Cycling</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

// StrengthMenu - Bottom sheet for strength exercise selection
interface StrengthMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: StrengthOption) => void;
}

const StrengthMenu: React.FC<StrengthMenuProps> = ({
  visible,
  onClose,
  onSelectOption,
}) => {
  const slideAnim = React.useRef(new Animated.Value(400)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSelectOption = (option: StrengthOption) => {
    onSelectOption(option);
    onClose();
  };

  const menuItems: Array<{ option: StrengthOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { option: 'pushups', label: 'Pushups', icon: 'fitness-outline' },
    { option: 'pullups', label: 'Pull-ups', icon: 'body-outline' },
    { option: 'situps', label: 'Sit-ups', icon: 'body-outline' },
    { option: 'squats', label: 'Squats', icon: 'accessibility-outline' },
    { option: 'curls', label: 'Curls', icon: 'barbell-outline' },
    { option: 'bench', label: 'Bench Press', icon: 'barbell-outline' },
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.cardioMenuContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.menuHandle} />
          {menuItems.map((item, index) => (
            <React.Fragment key={item.option}>
              {index > 0 && <View style={styles.menuDivider} />}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleSelectOption(item.option)}
              >
                <Ionicons name={item.icon} size={24} color={theme.colors.text} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

// DietMenu - Bottom sheet for diet/meal selection
interface DietMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: DietOption) => void;
}

const DietMenu: React.FC<DietMenuProps> = ({
  visible,
  onClose,
  onSelectOption,
}) => {
  const slideAnim = React.useRef(new Animated.Value(350)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 350,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSelectOption = (option: DietOption) => {
    onSelectOption(option);
    onClose();
  };

  const menuItems: Array<{ option: DietOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { option: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
    { option: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
    { option: 'dinner', label: 'Dinner', icon: 'moon-outline' },
    { option: 'snack', label: 'Snack', icon: 'cafe-outline' },
    { option: 'fast', label: 'Fast', icon: 'timer-outline' },
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.cardioMenuContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.menuHandle} />
          {menuItems.map((item, index) => (
            <React.Fragment key={item.option}>
              {index > 0 && <View style={styles.menuDivider} />}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleSelectOption(item.option)}
              >
                <Ionicons name={item.icon} size={24} color={theme.colors.text} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

// WellnessMenu - Bottom sheet for wellness/meditation selection
interface WellnessMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: WellnessOption) => void;
}

const WellnessMenu: React.FC<WellnessMenuProps> = ({
  visible,
  onClose,
  onSelectOption,
}) => {
  const slideAnim = React.useRef(new Animated.Value(350)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 90,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 350,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSelectOption = (option: WellnessOption) => {
    onSelectOption(option);
    onClose();
  };

  const menuItems: Array<{ option: WellnessOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { option: 'guided', label: 'Guided Meditation', icon: 'headset-outline' },
    { option: 'unguided', label: 'Unguided Meditation', icon: 'leaf-outline' },
    { option: 'breathwork', label: 'Breath Work', icon: 'water-outline' },
    { option: 'body_scan', label: 'Body Scan', icon: 'body-outline' },
    { option: 'gratitude', label: 'Gratitude', icon: 'heart-outline' },
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.cardioMenuContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.menuHandle} />
          {menuItems.map((item, index) => (
            <React.Fragment key={item.option}>
              {index > 0 && <View style={styles.menuDivider} />}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleSelectOption(item.option)}
              >
                <Ionicons name={item.icon} size={24} color={theme.colors.text} />
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

export const ActivityTrackerScreen: React.FC = () => {
  const [activeActivity, setActiveActivity] = useState<ActiveActivity>('run');
  const [showCardioMenu, setShowCardioMenu] = useState(false);
  const [showStrengthMenu, setShowStrengthMenu] = useState(false);
  const [showDietMenu, setShowDietMenu] = useState(false);
  const [showWellnessMenu, setShowWellnessMenu] = useState(false);

  // Selected sub-options for each category
  const [selectedStrength, setSelectedStrength] = useState<StrengthOption>('pushups');
  const [selectedDiet, setSelectedDiet] = useState<DietOption>('breakfast');
  const [selectedWellness, setSelectedWellness] = useState<WellnessOption>('guided');

  // Load saved activity from AsyncStorage on mount
  useEffect(() => {
    const loadSavedActivity = async () => {
      try {
        const savedActivity = await AsyncStorage.getItem(ACTIVITY_TAB_KEY);
        if (savedActivity && (savedActivity as ActiveActivity)) {
          setActiveActivity(savedActivity as ActiveActivity);
          console.log('[ActivityTracker] Restored saved activity:', savedActivity);
        }
      } catch (error) {
        console.warn('[ActivityTracker] Failed to load saved activity:', error);
      }
    };
    loadSavedActivity();
  }, []);

  // Save activity to AsyncStorage whenever it changes
  const handleActivityChange = async (activity: ActiveActivity) => {
    setActiveActivity(activity);
    try {
      await AsyncStorage.setItem(ACTIVITY_TAB_KEY, activity);
      console.log('[ActivityTracker] Saved activity:', activity);
    } catch (error) {
      console.warn('[ActivityTracker] Failed to save activity:', error);
    }
  };

  const handleCardioOptionSelect = (option: CardioOption) => {
    handleActivityChange(option);
    setShowCardioMenu(false);
  };

  const handleStrengthOptionSelect = (option: StrengthOption) => {
    setSelectedStrength(option);
    handleActivityChange('strength');
    setShowStrengthMenu(false);
  };

  const handleDietOptionSelect = (option: DietOption) => {
    setSelectedDiet(option);
    handleActivityChange('diet');
    setShowDietMenu(false);
  };

  const handleWellnessOptionSelect = (option: WellnessOption) => {
    setSelectedWellness(option);
    handleActivityChange('meditation');
    setShowWellnessMenu(false);
  };

  // Helper to check if current activity is cardio
  const isCardioActive = ['run', 'walk', 'cycle'].includes(activeActivity);

  const renderContent = () => {
    switch (activeActivity) {
      case 'run':
        return <RunningTrackerScreen />;
      case 'walk':
        return <WalkingTrackerScreen />;
      case 'cycle':
        return <CyclingTrackerScreen />;
      case 'strength':
        return <StrengthTrackerScreen initialExercise={selectedStrength} />;
      case 'diet':
        return (
          <DietTrackerScreen
            initialMealType={selectedDiet !== 'fast' ? selectedDiet : undefined}
            startFasting={selectedDiet === 'fast'}
          />
        );
      case 'meditation':
        return <MeditationTrackerScreen initialType={selectedWellness} />;
      case 'manual':
        return <ManualWorkoutScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabContainer}>
        <TabButton
          label="Cardio"
          isActive={isCardioActive}
          onPress={() => setShowCardioMenu(true)}
          icon="walk"
        />
        <TabButton
          label="Strength"
          isActive={activeActivity === 'strength'}
          onPress={() => setShowStrengthMenu(true)}
          icon="barbell"
        />
        <TabButton
          label="Diet"
          isActive={activeActivity === 'diet'}
          onPress={() => setShowDietMenu(true)}
          icon="restaurant"
        />
        <TabButton
          label="Wellness"
          isActive={activeActivity === 'meditation'}
          onPress={() => setShowWellnessMenu(true)}
          icon="leaf"
        />
      </View>

      {renderContent()}

      <CardioMenu
        visible={showCardioMenu}
        onClose={() => setShowCardioMenu(false)}
        onSelectOption={handleCardioOptionSelect}
      />

      <StrengthMenu
        visible={showStrengthMenu}
        onClose={() => setShowStrengthMenu(false)}
        onSelectOption={handleStrengthOptionSelect}
      />

      <DietMenu
        visible={showDietMenu}
        onClose={() => setShowDietMenu(false)}
        onSelectOption={handleDietOptionSelect}
      />

      <WellnessMenu
        visible={showWellnessMenu}
        onClose={() => setShowWellnessMenu(false)}
        onSelectOption={handleWellnessOptionSelect}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  headerSpacer: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8, // Reduced from 12 to tighten gap below activity selector
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.card,
  },
  activeTabButton: {
    backgroundColor: theme.colors.border,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginTop: 4,
  },
  activeTabLabel: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.semiBold,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderText: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSubtext: {
    color: theme.colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  cardioMenuContainer: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.border,
  },
  menuHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginLeft: 16,
  },
  menuDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 20,
  },
});
