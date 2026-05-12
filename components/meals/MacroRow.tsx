import { Text, View } from 'react-native';

type MacroRowStyles = {
  macroRow: object;
  macroLabel: object;
  macroBarTrack: object;
  macroBarFill: object;
  macroValue: object;
  macroOf: object;
};

type MacroRowProps = {
  label: string;
  consumed: number;
  target: number;
  fillColor: string;
  ss: MacroRowStyles;
};

export default function MacroRow({ label, consumed, target, fillColor, ss }: MacroRowProps) {
  const pct = target > 0 ? Math.min((consumed / target) * 100, 100) : 0;
  return (
    <View style={ss.macroRow}>
      <Text style={ss.macroLabel}>{label}</Text>
      <View style={ss.macroBarTrack}>
        <View style={[ss.macroBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: fillColor }]} />
      </View>
      <Text style={ss.macroValue}>
        {Math.round(consumed)}
        <Text style={ss.macroOf}> / {target}g</Text>
      </Text>
    </View>
  );
}
