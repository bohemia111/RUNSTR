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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../styles/theme';
import { PermissionRequestModal } from '../../components/permissions/PermissionRequestModal';
import { appPermissionService } from '../../services/initialization/AppPermissionService';
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

// Strength sub-activities shown in experimental menu
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
      size={20}
      color={isActive ? theme.colors.text : theme.colors.textMuted}
    />
    <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ExperimentalMenu - Bottom sheet with collapsible Strength/Diet/Wellness categories
type ExperimentalCategory = 'strength' | 'diet' | 'wellness' | null;

interface ExperimentalMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelectStrength: (option: StrengthOption) => void;
  onSelectDiet: (option: DietOption) => void;
  onSelectWellness: (option: WellnessOption) => void;
  customStrength: string[];
  customDiet: string[];
  customWellness: string[];
}

const ExperimentalMenu: React.FC<ExperimentalMenuProps> = ({
  visible,
  onClose,
  onSelectStrength,
  onSelectDiet,
  onSelectWellness,
  customStrength,
  customDiet,
  customWellness,
}) => {
  const slideAnim = React.useRef(new Animated.Value(500)).current;
  const [expandedCategory, setExpandedCategory] = useState<ExperimentalCategory>(null);

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
        toValue: 500,
        duration: 200,
        useNativeDriver: true,
      }).start();
      // Reset expanded state when closing
      setExpandedCategory(null);
    }
  }, [visible]);

  const strengthItems: Array<{ option: StrengthOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { option: 'pushups', label: 'Pushups', icon: 'fitness-outline' },
    { option: 'pullups', label: 'Pull-ups', icon: 'body-outline' },
    { option: 'situps', label: 'Sit-ups', icon: 'body-outline' },
    { option: 'squats', label: 'Squats', icon: 'accessibility-outline' },
    { option: 'curls', label: 'Curls', icon: 'barbell-outline' },
    { option: 'bench', label: 'Bench Press', icon: 'barbell-outline' },
    ...customStrength.map(name => ({
      option: `custom_${name}` as StrengthOption,
      label: name,
      icon: 'document-text-outline' as keyof typeof Ionicons.glyphMap,
    })),
    { option: 'add_custom', label: 'Add Custom', icon: 'add-circle-outline' },
  ];

  const dietItems: Array<{ option: DietOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { option: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
    { option: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
    { option: 'dinner', label: 'Dinner', icon: 'moon-outline' },
    { option: 'snack', label: 'Snack', icon: 'cafe-outline' },
    { option: 'fast', label: 'Fast', icon: 'timer-outline' },
    { option: 'water', label: 'Water', icon: 'water-outline' },
    ...customDiet.map(name => ({
      option: `custom_${name}` as DietOption,
      label: name,
      icon: 'document-text-outline' as keyof typeof Ionicons.glyphMap,
    })),
    { option: 'add_custom', label: 'Add Custom', icon: 'add-circle-outline' },
  ];

  const wellnessItems: Array<{ option: WellnessOption; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { option: 'guided', label: 'Guided Meditation', icon: 'headset-outline' },
    { option: 'unguided', label: 'Unguided Meditation', icon: 'leaf-outline' },
    { option: 'breathwork', label: 'Breath Work', icon: 'water-outline' },
    { option: 'body_scan', label: 'Body Scan', icon: 'body-outline' },
    { option: 'gratitude', label: 'Gratitude', icon: 'heart-outline' },
    ...customWellness.map(name => ({
      option: `custom_${name}` as WellnessOption,
      label: name,
      icon: 'document-text-outline' as keyof typeof Ionicons.glyphMap,
    })),
    { option: 'add_custom', label: 'Add Custom', icon: 'add-circle-outline' },
  ];

  const handleStrengthSelect = (option: StrengthOption) => {
    onSelectStrength(option);
    onClose();
  };

  const handleDietSelect = (option: DietOption) => {
    onSelectDiet(option);
    onClose();
  };

  const handleWellnessSelect = (option: WellnessOption) => {
    onSelectWellness(option);
    onClose();
  };

  const toggleCategory = (category: ExperimentalCategory) => {
    setExpandedCategory(prev => prev === category ? null : category);
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
            styles.experimentalMenuContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.menuHandle} />
          <Text style={styles.experimentalTitle}>Experimental Features</Text>
          <ScrollView style={{ maxHeight: 450 }}>
            {/* Strength Category */}
            <TouchableOpacity
              style={styles.categoryHeader}
              onPress={() => toggleCategory('strength')}
            >
              <Ionicons name="barbell" size={24} color={theme.colors.text} />
              <Text style={styles.categoryLabel}>Strength</Text>
              <Ionicons
                name={expandedCategory === 'strength' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
            {expandedCategory === 'strength' && (
              <View style={styles.categoryItems}>
                {strengthItems.map((item, index) => (
                  <React.Fragment key={item.option}>
                    {index > 0 && <View style={styles.subMenuDivider} />}
                    <TouchableOpacity
                      style={styles.subMenuItem}
                      onPress={() => handleStrengthSelect(item.option)}
                    >
                      <Ionicons name={item.icon} size={20} color={theme.colors.textMuted} />
                      <Text style={styles.subMenuLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            )}

            <View style={styles.menuDivider} />

            {/* Diet Category */}
            <TouchableOpacity
              style={styles.categoryHeader}
              onPress={() => toggleCategory('diet')}
            >
              <Ionicons name="restaurant" size={24} color={theme.colors.text} />
              <Text style={styles.categoryLabel}>Diet</Text>
              <Ionicons
                name={expandedCategory === 'diet' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
            {expandedCategory === 'diet' && (
              <View style={styles.categoryItems}>
                {dietItems.map((item, index) => (
                  <React.Fragment key={item.option}>
                    {index > 0 && <View style={styles.subMenuDivider} />}
                    <TouchableOpacity
                      style={styles.subMenuItem}
                      onPress={() => handleDietSelect(item.option)}
                    >
                      <Ionicons name={item.icon} size={20} color={theme.colors.textMuted} />
                      <Text style={styles.subMenuLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            )}

            <View style={styles.menuDivider} />

            {/* Wellness Category */}
            <TouchableOpacity
              style={styles.categoryHeader}
              onPress={() => toggleCategory('wellness')}
            >
              <Ionicons name="leaf" size={24} color={theme.colors.text} />
              <Text style={styles.categoryLabel}>Wellness</Text>
              <Ionicons
                name={expandedCategory === 'wellness' ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
            {expandedCategory === 'wellness' && (
              <View style={styles.categoryItems}>
                {wellnessItems.map((item, index) => (
                  <React.Fragment key={item.option}>
                    {index > 0 && <View style={styles.subMenuDivider} />}
                    <TouchableOpacity
                      style={styles.subMenuItem}
                      onPress={() => handleWellnessSelect(item.option)}
                    >
                      <Ionicons name={item.icon} size={20} color={theme.colors.textMuted} />
                      <Text style={styles.subMenuLabel}>{item.label}</Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

interface ActivityTrackerScreenProps {
  route?: {
    params?: {
      showExperimentalMenu?: boolean;
    };
  };
}

export const ActivityTrackerScreen: React.FC<ActivityTrackerScreenProps> = ({ route }) => {
  const navigation = useNavigation<any>();
  const [activeActivity, setActiveActivity] = useState<ActiveActivity>('run');
  const [showExperimentalMenu, setShowExperimentalMenu] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Selected sub-options for experimental categories
  const [selectedStrength, setSelectedStrength] = useState<StrengthOption>('pushups');
  const [selectedDiet, setSelectedDiet] = useState<DietOption>('breakfast');
  const [selectedWellness, setSelectedWellness] = useState<WellnessOption>('guided');

  // Custom exercise names per category (for experimental menu)
  const [customStrength, setCustomStrength] = useState<string[]>([]);
  const [customDiet, setCustomDiet] = useState<string[]>([]);
  const [customWellness, setCustomWellness] = useState<string[]>([]);

  // Manual entry state
  const [manualCategory, setManualCategory] = useState<ManualEntryCategory>('cardio');
  const [manualPrefillName, setManualPrefillName] = useState<string>('');

  // Load custom exercises when experimental menu opens
  const loadCustomExercises = async () => {
    try {
      const [strength, diet, wellness] = await Promise.all([
        LocalWorkoutStorageService.getCustomExerciseNames('strength'),
        LocalWorkoutStorageService.getCustomExerciseNames('diet'),
        LocalWorkoutStorageService.getCustomExerciseNames('wellness'),
      ]);
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

  // Check permissions on mount - show modal if location permission not granted
  useEffect(() => {
    const checkPermissions = async () => {
      const status = await appPermissionService.checkAllPermissions();
      if (!status.location) {
        console.log('[ActivityTracker] Location permission not granted, showing modal');
        setShowPermissionModal(true);
      }
    };
    checkPermissions();
  }, []);

  // Show experimental menu if navigated with param (from Settings)
  useEffect(() => {
    if (route?.params?.showExperimentalMenu) {
      loadCustomExercises();
      setShowExperimentalMenu(true);
    }
  }, [route?.params?.showExperimentalMenu]);

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

  // Handlers for experimental menu selections
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
  };

  // Helper to check which tab is active
  const isRunActive = activeActivity === 'run';
  const isWalkActive = activeActivity === 'walk';
  const isCycleActive = activeActivity === 'cycle';
  const isExperimentalActive = ['strength', 'diet', 'water', 'meditation', 'manual_strength', 'manual_diet', 'manual_wellness'].includes(activeActivity);

  const renderContent = () => {
    switch (activeActivity) {
      case 'run':
        return <RunningTrackerScreen />;
      case 'walk':
        return <WalkingTrackerScreen />;
      case 'cycle':
        return <CyclingTrackerScreen />;
      case 'strength': {
        // Only pass built-in exercise types to StrengthTrackerScreen
        const validExercises = ['pushups', 'pullups', 'situps', 'squats', 'curls', 'bench'] as const;
        const exercise = validExercises.includes(selectedStrength as any) ? selectedStrength as typeof validExercises[number] : undefined;
        return <StrengthTrackerScreen initialExercise={exercise} />;
      }
      case 'diet': {
        // Only pass built-in meal types to DietTrackerScreen
        const validMeals = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
        const mealType = validMeals.includes(selectedDiet as any) ? selectedDiet as typeof validMeals[number] : undefined;
        return (
          <DietTrackerScreen
            initialMealType={selectedDiet !== 'fast' ? mealType : undefined}
            startFasting={selectedDiet === 'fast'}
          />
        );
      }
      case 'meditation': {
        // Only pass built-in meditation types to MeditationTrackerScreen
        const validMeditations = ['guided', 'unguided', 'breathwork', 'body_scan', 'gratitude'] as const;
        const meditationType = validMeditations.includes(selectedWellness as any) ? selectedWellness as typeof validMeditations[number] : undefined;
        return <MeditationTrackerScreen initialType={meditationType} />;
      }
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header with back button and activity tabs on same row */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>

        <View style={styles.tabContainer}>
          <TabButton
            label="Run"
            isActive={isRunActive}
            onPress={() => handleActivityChange('run')}
            icon="walk"
          />
          <TabButton
            label="Walk"
            isActive={isWalkActive}
            onPress={() => handleActivityChange('walk')}
            icon="footsteps"
          />
          <TabButton
            label="Ride"
            isActive={isCycleActive}
            onPress={() => handleActivityChange('cycle')}
            icon="bicycle"
          />
        </View>
      </View>

      {renderContent()}

      <ExperimentalMenu
        visible={showExperimentalMenu}
        onClose={() => setShowExperimentalMenu(false)}
        onSelectStrength={handleStrengthOptionSelect}
        onSelectDiet={handleDietOptionSelect}
        onSelectWellness={handleWellnessOptionSelect}
        customStrength={customStrength}
        customDiet={customDiet}
        customWellness={customWellness}
      />

      {/* Permission Request Modal - shown on first visit if location not granted */}
      {showPermissionModal && (
        <PermissionRequestModal
          visible={true}
          onComplete={() => {
            setShowPermissionModal(false);
            console.log('[ActivityTracker] Permissions granted');
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    flex: 1,
  },
  headerSpacer: {
    width: 32,
  },
  tabContainer: {
    flex: 1,
    flexDirection: 'row',
    marginLeft: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    marginHorizontal: 3,
    borderRadius: 8,
    backgroundColor: theme.colors.card,
  },
  activeTabButton: {
    backgroundColor: theme.colors.border,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginTop: 2,
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
  // ExperimentalMenu styles
  experimentalMenuContainer: {
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
  experimentalTitle: {
    fontSize: 18,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    color: theme.colors.text,
    marginLeft: 16,
  },
  categoryItems: {
    backgroundColor: theme.colors.background,
    marginHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  subMenuLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text,
    marginLeft: 12,
  },
  subMenuDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
});
