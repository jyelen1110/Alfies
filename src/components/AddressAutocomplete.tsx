import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

const GOOGLE_PLACES_API_KEY = 'AIzaSyBtOxQQeMSHo3QAWZRvbLBdTiiiz02IsPs';

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onAddressSelect: (address: string, placeId: string) => void;
  placeholder?: string;
  editable?: boolean;
  style?: any;
}

export default function AddressAutocomplete({
  value,
  onChangeText,
  onAddressSelect,
  placeholder = 'Start typing an address...',
  editable = true,
  style,
}: Props) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (value.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      fetchPredictions(value);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [value]);

  const fetchPredictions = async (input: string) => {
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          input
        )}&components=country:au&types=address&key=${GOOGLE_PLACES_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        setPredictions(data.predictions);
        setShowDropdown(true);
      } else {
        setPredictions([]);
        setShowDropdown(false);
      }
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAddress = (prediction: Prediction) => {
    onChangeText(prediction.description);
    onAddressSelect(prediction.description, prediction.place_id);
    setPredictions([]);
    setShowDropdown(false);
  };

  const renderPrediction = ({ item }: { item: Prediction }) => (
    <TouchableOpacity
      style={styles.predictionItem}
      onPress={() => handleSelectAddress(item)}
      activeOpacity={0.7}
    >
      <Ionicons name="location-outline" size={18} color={theme.colors.primary} />
      <View style={styles.predictionText}>
        <Text style={styles.mainText} numberOfLines={1}>
          {item.structured_formatting.main_text}
        </Text>
        <Text style={styles.secondaryText} numberOfLines={1}>
          {item.structured_formatting.secondary_text}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            if (text.length >= 3) {
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          editable={editable}
          multiline
          numberOfLines={2}
        />
        {isLoading && (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            style={styles.loader}
          />
        )}
      </View>

      {showDropdown && predictions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={predictions}
            keyExtractor={(item) => item.place_id}
            renderItem={renderPrediction}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            style={styles.list}
          />
          <View style={styles.poweredBy}>
            <Text style={styles.poweredByText}>Powered by Google</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
  },
  input: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    paddingHorizontal: theme.spacing.md,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  loader: {
    position: 'absolute',
    right: theme.spacing.md,
    top: theme.spacing.md,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    marginTop: 4,
    maxHeight: 250,
    ...theme.shadow.lg,
    zIndex: 1001,
  },
  list: {
    maxHeight: 200,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.sm,
  },
  predictionText: {
    flex: 1,
  },
  mainText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
  },
  secondaryText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  poweredBy: {
    padding: theme.spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  poweredByText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
});
