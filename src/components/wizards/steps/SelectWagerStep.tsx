/**
 * SelectWagerStep - Fourth step in challenge creation
 * User selects wager amount in sats (or 0 for free challenge)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { theme } from '../../../styles/theme';

interface SelectWagerStepProps {
  wagerAmount: number;
  onSelectWager: (amount: number) => void;
}

const WAGER_PRESETS = [0, 100, 500, 1000, 5000];

export const SelectWagerStep: React.FC<SelectWagerStepProps> = ({
  wagerAmount,
  onSelectWager,
}) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const handlePresetSelect = (amount: number) => {
    setShowCustom(false);
    setCustomInput('');
    onSelectWager(amount);
  };

  const handleCustomSubmit = () => {
    const amount = parseInt(customInput, 10);
    if (!isNaN(amount) && amount >= 0) {
      onSelectWager(amount);
      setShowCustom(false);
    }
  };

  const isPresetSelected = WAGER_PRESETS.includes(wagerAmount) && !showCustom;
  const isCustomSelected = !isPresetSelected && wagerAmount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.wagerOptions}>
        {WAGER_PRESETS.map((preset) => (
          <TouchableOpacity
            key={preset}
            style={[
              styles.wagerOption,
              wagerAmount === preset &&
                !showCustom &&
                styles.wagerOptionSelected,
            ]}
            onPress={() => handlePresetSelect(preset)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.wagerLabel,
                wagerAmount === preset &&
                  !showCustom &&
                  styles.wagerLabelSelected,
              ]}
            >
              {preset === 0 ? 'Free' : `${preset.toLocaleString()} sats`}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[
            styles.wagerOption,
            (showCustom || isCustomSelected) && styles.wagerOptionSelected,
          ]}
          onPress={() => setShowCustom(true)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.wagerLabel,
              (showCustom || isCustomSelected) && styles.wagerLabelSelected,
            ]}
          >
            {isCustomSelected
              ? `${wagerAmount.toLocaleString()} sats`
              : 'Custom'}
          </Text>
        </TouchableOpacity>
      </View>

      {showCustom && (
        <View style={styles.customWagerContainer}>
          <TextInput
            style={styles.customWagerInput}
            placeholder="Enter amount in sats..."
            placeholderTextColor={theme.colors.textMuted}
            value={customInput}
            onChangeText={setCustomInput}
            keyboardType="number-pad"
            autoFocus
            onSubmitEditing={handleCustomSubmit}
          />
          <TouchableOpacity
            style={styles.customWagerButton}
            onPress={handleCustomSubmit}
          >
            <Text style={styles.customWagerButtonText}>Set</Text>
          </TouchableOpacity>
        </View>
      )}

      {wagerAmount > 0 && !showCustom && (
        <View style={styles.wagerPreview}>
          <Text style={styles.wagerPreviewLabel}>You stake:</Text>
          <Text style={styles.wagerPreviewAmount}>
            {wagerAmount.toLocaleString()} sats
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wagerOptions: {
    gap: 12,
  },
  wagerOption: {
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
  },
  wagerOptionSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.border,
  },
  wagerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textMuted,
  },
  wagerLabelSelected: {
    color: theme.colors.text,
  },
  customWagerContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  customWagerInput: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: theme.colors.text,
  },
  customWagerButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  customWagerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.accentText,
  },
  wagerPreview: {
    marginTop: 20,
    padding: 20,
    backgroundColor: theme.colors.cardBackground,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wagerPreviewLabel: {
    fontSize: 14,
    color: theme.colors.textMuted,
  },
  wagerPreviewAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
