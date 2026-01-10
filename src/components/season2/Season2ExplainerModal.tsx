/**
 * Season2ExplainerModal - How it works modal
 * Explains the competition rules, prize pool, and charity selection
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { useSeason2Status } from '../../hooks/useSeason2';
import { formatSats } from '../../constants/season2';

interface Season2ExplainerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const Season2ExplainerModal: React.FC<Season2ExplainerModalProps> = ({
  visible,
  onClose,
}) => {
  const { dateRange, prizePoolBonus, prizePoolCharity } = useSeason2Status();

  const charityPrizePerCategory = Math.floor(prizePoolCharity / 3);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>RUNSTR SEASON II</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* How It Works */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How It Works</Text>
              <Text style={styles.paragraph}>
                Track your running, walking, and cycling workouts from{' '}
                {dateRange}. Your distance contributes to both your personal
                ranking and your chosen charity's total.
              </Text>
            </View>

            {/* Registration Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Registration</Text>
              <View style={styles.closedBadge}>
                <Ionicons
                  name="lock-closed"
                  size={16}
                  color={theme.colors.orangeBright}
                />
                <Text style={styles.closedText}>Registration is closed</Text>
              </View>
              <Text style={styles.paragraph}>
                Registration closed on December 31, 2025. Good luck to all
                participants!
              </Text>
            </View>

            {/* Prize Pool */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Prize Pool</Text>

              <View style={styles.prizeBox}>
                <Text style={styles.prizeAmount}>
                  {formatSats(prizePoolBonus)}
                </Text>
                <Text style={styles.prizeLabel}>Bonus Giveaway</Text>
                <Text style={styles.prizeDescription}>
                  All registered participants are eligible for the bonus prize.
                  One participant will be selected at the end of the competition.
                </Text>
              </View>

              <View style={styles.prizeBox}>
                <Text style={styles.prizeAmount}>
                  {formatSats(prizePoolCharity)}
                </Text>
                <Text style={styles.prizeLabel}>Charity Prizes</Text>
                <Text style={styles.prizeDescription}>
                  Split between top charity in each category:
                </Text>
                <View style={styles.charityPrizeList}>
                  <Text style={styles.charityPrizeItem}>
                    Top Running Charity: ~{formatSats(charityPrizePerCategory)}
                  </Text>
                  <Text style={styles.charityPrizeItem}>
                    Top Walking Charity: ~{formatSats(charityPrizePerCategory)}
                  </Text>
                  <Text style={styles.charityPrizeItem}>
                    Top Cycling Charity: ~{formatSats(charityPrizePerCategory)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Select Your Charity */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Your Charity</Text>
              <Text style={styles.paragraph}>
                Choose your charity in Settings. Every workout you publish adds
                distance to that charity's total. Help your favorite charity win
                the category prize!
              </Text>
            </View>

            {/* Categories */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <View style={styles.categoryList}>
                <View style={styles.categoryItem}>
                  <Ionicons
                    name="walk-outline"
                    size={20}
                    color={theme.colors.accent}
                  />
                  <Text style={styles.categoryText}>Running</Text>
                </View>
                <View style={styles.categoryItem}>
                  <Ionicons
                    name="footsteps-outline"
                    size={20}
                    color={theme.colors.accent}
                  />
                  <Text style={styles.categoryText}>Walking</Text>
                </View>
                <View style={styles.categoryItem}>
                  <Ionicons
                    name="bicycle-outline"
                    size={20}
                    color={theme.colors.accent}
                  />
                  <Text style={styles.categoryText}>Cycling</Text>
                </View>
              </View>
            </View>

            {/* Bottom padding */}
            <View style={styles.bottomPadding} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalContent: {
    flex: 1,
    backgroundColor: theme.colors.background,
    marginTop: 50,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: theme.typography.weights.semiBold,
    marginBottom: 8,
  },
  paragraph: {
    color: theme.colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  highlightText: {
    color: theme.colors.accent,
    fontSize: 24,
    fontWeight: theme.typography.weights.bold,
    marginBottom: 8,
  },
  prizeBox: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 12,
  },
  prizeAmount: {
    color: theme.colors.accent,
    fontSize: 20,
    fontWeight: theme.typography.weights.bold,
  },
  prizeLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
    marginTop: 4,
  },
  prizeDescription: {
    color: theme.colors.textMuted,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },
  charityPrizeList: {
    marginTop: 8,
  },
  charityPrizeItem: {
    color: theme.colors.text,
    fontSize: 13,
    marginTop: 4,
  },
  categoryList: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 6,
  },
  categoryText: {
    color: theme.colors.text,
    fontSize: 13,
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.medium,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  closedText: {
    color: theme.colors.orangeBright,
    fontSize: 14,
    fontWeight: theme.typography.weights.medium,
  },
  bottomPadding: {
    height: 40,
  },
});

export default Season2ExplainerModal;
