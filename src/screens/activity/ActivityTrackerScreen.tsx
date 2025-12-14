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
import { WaterTrackerScreen } from './WaterTrackerScreen';
import { ManualEntryScreen, type ManualEntryCategory } from './ManualEntryScreen';
import LocalWorkoutStorageService from '../../services/fitness/LocalWorkoutStorageService';

// Active activity - what screen is being shown
type ActiveActivity =
  | 'run'
  | 'walk'
  | 'cycle'
  | 'strength'
  | 'diet'
  | 'meditation'
  | 'water'
  | 'manual_cardio'
  | 'manual_strength'
  | 'manual_diet'
  | 'manual_wellness'
  | 'manual';

// Cardio sub-activities shown in bottom sheet
type CardioOption = 'run' | 'walk' | 'cycle' | 'add_custom' | string;

// Strength sub-activities shown in bottom sheet
type StrengthOption = 'pushups' | 'pullups' | 'situps' | 'squats' | 'curls' | 'bench' | 'add_custom' | string;

// Diet sub-activities shown in bottom sheet
type DietOption = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'fast' | 'water' | 'add_custom' | string;

// Wellness sub-activities shown in bottom sheet (matches MeditationType in MeditationTrackerScreen)
type WellnessOption = 'guided' | 'unguided' | 'breathwork' | 'body_scan' | 'gratitude' | 'add_custom' | string;

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
  customExercises: string[];
}

const CardioMenu: React.FC<CardioMenuProps> = ({
  visible,
  onClose,
  onSelectOption,
  customExercises,
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

  const builtInItems: Array<{ option: CardioOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { option: 'run', label: 'Running', icon: 'walk' },
    { option: 'walk', label: 'Walking', icon: 'footsteps' },
    { option: 'cycle', label: 'Cycling', icon: 'bicycle' },
  ];

  const customItems = customExercises.map(name => ({
    option: `custom_${name}` as CardioOption,
    label: name,
    icon: 'document-text-outline' as keyof typeof Ionicons.glyphMap,
  }));

  const allItems = [
    ...builtInItems,
    ...customItems,
    { option: 'add_custom' as CardioOption, label: 'Add Custom', icon: 'add-circle-outline' as keyof typeof Ionicons.glyphMap },
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
          <ScrollView style={{ maxHeight: 400 }}>
            {allItems.map((item, index) => (
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
          </ScrollView>
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
  customExercises: string[];
}

const StrengthMenu: React.FC<StrengthMenuProps> = ({
  visible,
  onClose,
  onSelectOption,
  customExercises,
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

  const builtInItems: Array<{ option: StrengthOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { option: 'pushups', label: 'Pushups', icon: 'fitness-outline' },
    { option: 'pullups', label: 'Pull-ups', icon: 'body-outline' },
    { option: 'situps', label: 'Sit-ups', icon: 'body-outline' },
    { option: 'squats', label: 'Squats', icon: 'accessibility-outline' },
    { option: 'curls', label: 'Curls', icon: 'barbell-outline' },
    { option: 'bench', label: 'Bench Press', icon: 'barbell-outline' },
  ];

  const customItems = customExercises.map(name => ({
    option: `custom_${name}` as StrengthOption,
    label: name,
    icon: 'document-text-outline' as keyof typeof Ionicons.glyphMap,
  }));

  const allItems = [
    ...builtInItems,
    ...customItems,
    { option: 'add_custom' as StrengthOption, label: 'Add Custom', icon: 'add-circle-outline' as keyof typeof Ionicons.glyphMap },
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
          <ScrollView style={{ maxHeight: 400 }}>
            {allItems.map((item, index) => (
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
          </ScrollView>
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
  customExercises: string[];
}

const DietMenu: React.FC<DietMenuProps> = ({
  visible,
  onClose,
  onSelectOption,
  customExercises,
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

  const builtInItems: Array<{ option: DietOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { option: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
    { option: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
    { option: 'dinner', label: 'Dinner', icon: 'moon-outline' },
    { option: 'snack', label: 'Snack', icon: 'cafe-outline' },
    { option: 'fast', label: 'Fast', icon: 'timer-outline' },
    { option: 'water', label: 'Water', icon: 'water-outline' },
  ];

  // Custom exercises with paper/pen icon
  const customItems = customExercises.map(name => ({
    option: `custom_${name}` as DietOption,
    label: name,
    icon: 'document-text-outline' as keyof typeof Ionicons.glyphMap,
    isCustom: true,
  }));

  const allItems = [
    ...builtInItems,
    ...customItems,
    { option: 'add_custom' as DietOption, label: 'Add Custom', icon: 'add-circle-outline' as keyof typeof Ionicons.glyphMap },
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
          <ScrollView style={{ maxHeight: 400 }}>
            {allItems.map((item, index) => (
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
          </ScrollView>
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
  customExercises: string[];
}

const WellnessMenu: React.FC<WellnessMenuProps> = ({
  visible,
  onClose,
  onSelectOption,
  customExercises,
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

  const builtInItems: Array<{ option: WellnessOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { option: 'guided', label: 'Guided Meditation', icon: 'headset-outline' },
    { option: 'unguided', label: 'Unguided Meditation', icon: 'leaf-outline' },
    { option: 'breathwork', label: 'Breath Work', icon: 'water-outline' },
    { option: 'body_scan', label: 'Body Scan', icon: 'body-outline' },
    { option: 'gratitude', label: 'Gratitude', icon: 'heart-outline' },
  ];

  const customItems = customExercises.map(name => ({
    option: `custom_${name}` as WellnessOption,
    label: name,
    icon: 'document-text-outline' as keyof typeof Ionicons.glyphMap,
  }));

  const allItems = [
    ...builtInItems,
    ...customItems,
    { option: 'add_custom' as WellnessOption, label: 'Add Custom', icon: 'add-circle-outline' as keyof typeof Ionicons.glyphMap },
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
          <ScrollView style={{ maxHeight: 400 }}>
            {allItems.map((item, index) => (
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
          </ScrollView>
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

  // Custom exercise names per category
  const [customCardio, setCustomCardio] = useState<string[]>([]);
  const [customStrength, setCustomStrength] = useState<string[]>([]);
  const [customDiet, setCustomDiet] = useState<string[]>([]);
  const [customWellness, setCustomWellness] = useState<string[]>([]);

  // Manual entry state
  const [manualCategory, setManualCategory] = useState<ManualEntryCategory>('cardio');
  const [manualPrefillName, setManualPrefillName] = useState<string>('');

  // Load custom exercises when menus open
  const loadCustomExercises = async () => {
    try {
      const [cardio, strength, diet, wellness] = await Promise.all([
        LocalWorkoutStorageService.getCustomExerciseNames('cardio'),
        LocalWorkoutStorageService.getCustomExerciseNames('strength'),
        LocalWorkoutStorageService.getCustomExerciseNames('diet'),
        LocalWorkoutStorageService.getCustomExerciseNames('wellness'),
      ]);
      setCustomCardio(cardio);
      setCustomStrength(strength);
      setCustomDiet(diet);
      setCustomWellness(wellness);
    } catch (error) {
      console.warn('[ActivityTracker] Failed to load custom exercises:', error);
    }
  };

  // Load saved activity and custom exercises on mount
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
    loadCustomExercises();
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
    if (option === 'add_custom') {
      setManualCategory('cardio');
      setManualPrefillName('');
      handleActivityChange('manual_cardio');
    } else if (option.startsWith('custom_')) {
      const name = option.replace('custom_', '');
      setManualCategory('cardio');
      setManualPrefillName(name);
      handleActivityChange('manual_cardio');
    } else {
      handleActivityChange(option as ActiveActivity);
    }
    setShowCardioMenu(false);
  };

  const handleStrengthOptionSelect = (option: StrengthOption) => {
    if (option === 'add_custom') {
      setManualCategory('strength');
      setManualPrefillName('');
      handleActivityChange('manual_strength');
    } else if (option.startsWith('custom_')) {
      const name = option.replace('custom_', '');
      setManualCategory('strength');
      setManualPrefillName(name);
      handleActivityChange('manual_strength');
    } else {
      setSelectedStrength(option);
      handleActivityChange('strength');
    }
    setShowStrengthMenu(false);
  };

  const handleDietOptionSelect = (option: DietOption) => {
    if (option === 'water') {
      handleActivityChange('water');
    } else if (option === 'add_custom') {
      setManualCategory('diet');
      setManualPrefillName('');
      handleActivityChange('manual_diet');
    } else if (option.startsWith('custom_')) {
      const name = option.replace('custom_', '');
      setManualCategory('diet');
      setManualPrefillName(name);
      handleActivityChange('manual_diet');
    } else {
      setSelectedDiet(option);
      handleActivityChange('diet');
    }
    setShowDietMenu(false);
  };

  const handleWellnessOptionSelect = (option: WellnessOption) => {
    if (option === 'add_custom') {
      setManualCategory('wellness');
      setManualPrefillName('');
      handleActivityChange('manual_wellness');
    } else if (option.startsWith('custom_')) {
      const name = option.replace('custom_', '');
      setManualCategory('wellness');
      setManualPrefillName(name);
      handleActivityChange('manual_wellness');
    } else {
      setSelectedWellness(option);
      handleActivityChange('meditation');
    }
    setShowWellnessMenu(false);
  };

  // Helper to check if current activity is cardio
  const isCardioActive = ['run', 'walk', 'cycle', 'manual_cardio'].includes(activeActivity);
  const isStrengthActive = ['strength', 'manual_strength'].includes(activeActivity);
  const isDietActive = ['diet', 'water', 'manual_diet'].includes(activeActivity);
  const isWellnessActive = ['meditation', 'manual_wellness'].includes(activeActivity);

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
      case 'water':
        return <WaterTrackerScreen />;
      case 'manual_cardio':
      case 'manual_strength':
      case 'manual_diet':
      case 'manual_wellness':
        return (
          <ManualEntryScreen
            category={manualCategory}
            prefillName={manualPrefillName}
          />
        );
      case 'manual':
        return <ManualWorkoutScreen />;
      default:
        return <RunningTrackerScreen />;
    }
  };

  // Reload custom exercises when returning from manual entry
  const handleOpenCardioMenu = () => {
    loadCustomExercises();
    setShowCardioMenu(true);
  };

  const handleOpenStrengthMenu = () => {
    loadCustomExercises();
    setShowStrengthMenu(true);
  };

  const handleOpenDietMenu = () => {
    loadCustomExercises();
    setShowDietMenu(true);
  };

  const handleOpenWellnessMenu = () => {
    loadCustomExercises();
    setShowWellnessMenu(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.tabContainer}>
        <TabButton
          label="Cardio"
          isActive={isCardioActive}
          onPress={handleOpenCardioMenu}
          icon="walk"
        />
        <TabButton
          label="Strength"
          isActive={isStrengthActive}
          onPress={handleOpenStrengthMenu}
          icon="barbell"
        />
        <TabButton
          label="Diet"
          isActive={isDietActive}
          onPress={handleOpenDietMenu}
          icon="restaurant"
        />
        <TabButton
          label="Wellness"
          isActive={isWellnessActive}
          onPress={handleOpenWellnessMenu}
          icon="leaf"
        />
      </View>

      {renderContent()}

      <CardioMenu
        visible={showCardioMenu}
        onClose={() => setShowCardioMenu(false)}
        onSelectOption={handleCardioOptionSelect}
        customExercises={customCardio}
      />

      <StrengthMenu
        visible={showStrengthMenu}
        onClose={() => setShowStrengthMenu(false)}
        onSelectOption={handleStrengthOptionSelect}
        customExercises={customStrength}
      />

      <DietMenu
        visible={showDietMenu}
        onClose={() => setShowDietMenu(false)}
        onSelectOption={handleDietOptionSelect}
        customExercises={customDiet}
      />

      <WellnessMenu
        visible={showWellnessMenu}
        onClose={() => setShowWellnessMenu(false)}
        onSelectOption={handleWellnessOptionSelect}
        customExercises={customWellness}
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
    paddingVertical: 4,
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
