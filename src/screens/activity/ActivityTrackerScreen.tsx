/**
 * ActivityTrackerScreen - Main activity tracking interface
 * Provides tabs for running, walking, cycling, and more activities
 */

import React, { useState } from 'react';
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
import { theme } from '../../styles/theme';
import { RunningTrackerScreen } from './RunningTrackerScreen';
import { WalkingTrackerScreen } from './WalkingTrackerScreen';
import { CyclingTrackerScreen } from './CyclingTrackerScreen';
import { ManualWorkoutScreen } from './ManualWorkoutScreen';
import { MeditationTrackerScreen } from './MeditationTrackerScreen';
import { StrengthTrackerScreen } from './StrengthTrackerScreen';
import { DietTrackerScreen } from './DietTrackerScreen';

type ActivityTab =
  | 'run'
  | 'walk'
  | 'cycle'
  | 'strength'
  | 'diet'
  | 'meditation'
  | 'manual';
type MoreOption = 'strength' | 'diet' | 'meditation';

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

interface MoreMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelectOption: (option: MoreOption) => void;
}

const MoreMenu: React.FC<MoreMenuProps> = ({
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

  const handleSelectOption = (option: MoreOption) => {
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
            styles.moreMenuContainer,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.moreMenuHandle} />

          <TouchableOpacity
            style={styles.moreMenuItem}
            onPress={() => handleSelectOption('strength')}
          >
            <Ionicons name="barbell" size={24} color={theme.colors.text} />
            <Text style={styles.moreMenuLabel}>Strength Training</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.moreMenuItem}
            onPress={() => handleSelectOption('diet')}
          >
            <Ionicons name="restaurant" size={24} color={theme.colors.text} />
            <Text style={styles.moreMenuLabel}>Diet/Meals</Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.colors.textMuted}
            />
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.moreMenuItem}
            onPress={() => handleSelectOption('meditation')}
          >
            <Ionicons name="body" size={24} color={theme.colors.text} />
            <Text style={styles.moreMenuLabel}>Meditation</Text>
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

export const ActivityTrackerScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActivityTab>('run');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleMoreOptionSelect = (option: MoreOption) => {
    setActiveTab(option);
    setShowMoreMenu(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'run':
        return <RunningTrackerScreen />;
      case 'walk':
        return <WalkingTrackerScreen />;
      case 'cycle':
        return <CyclingTrackerScreen />;
      case 'strength':
        return <StrengthTrackerScreen />;
      case 'diet':
        return <DietTrackerScreen />;
      case 'meditation':
        return <MeditationTrackerScreen />;
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
          label="Run"
          isActive={activeTab === 'run'}
          onPress={() => setActiveTab('run')}
          icon="body"
        />
        <TabButton
          label="Walk"
          isActive={activeTab === 'walk'}
          onPress={() => setActiveTab('walk')}
          icon="walk"
        />
        <TabButton
          label="Cycle"
          isActive={activeTab === 'cycle'}
          onPress={() => setActiveTab('cycle')}
          icon="bicycle"
        />
        <TabButton
          label="More"
          isActive={['strength', 'diet', 'meditation'].includes(
            activeTab
          )}
          onPress={() => setShowMoreMenu(true)}
          icon="ellipsis-horizontal"
        />
      </View>

      {renderContent()}

      <MoreMenu
        visible={showMoreMenu}
        onClose={() => setShowMoreMenu(false)}
        onSelectOption={handleMoreOptionSelect}
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
    paddingVertical: 12,
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
  moreMenuContainer: {
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
  moreMenuHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  moreMenuLabel: {
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
