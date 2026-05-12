import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';

type MealCardStyles = {
  mealCard: object;
  mealCardInner: object;
  mealCardName: object;
  mealCardKcal: object;
  accentText: object;
  addBtn: object;
  addBtnText: object;
};

type MealCardProps = {
  label: string;
  kcal: number;
  onPress: () => void;
  ss: MealCardStyles;
};

function formatKcal(n: number): string {
  const r = Math.round(n);
  if (r >= 1000) {
    return `${Math.floor(r / 1000)}.${String(r % 1000).padStart(3, '0')}`;
  }
  return String(r);
}

export default function MealCard({ label, kcal, onPress, ss }: MealCardProps) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={ss.mealCard} onPress={onPress} activeOpacity={0.75}>
      <View style={ss.mealCardInner}>
        <View>
          <Text style={ss.mealCardName}>{label}</Text>
          <Text style={ss.mealCardKcal}>
            {kcal > 0 ? (
              <>
                <Text style={ss.accentText}>{formatKcal(kcal)}</Text>
                <Text> {t('home.kcalUnit')}</Text>
              </>
            ) : (
              t('home.empty')
            )}
          </Text>
        </View>
        <View style={ss.addBtn}>
          <Text style={ss.addBtnText}>+</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}
