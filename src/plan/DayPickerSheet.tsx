import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { formatDay, todayISO, type ISODate } from '@/lib/dates';
import { fonts, colors, radius, space } from '@/theme/tokens';

type Props = {
  visible: boolean;
  title: string;
  days: ISODate[];
  exclude?: ISODate | null;
  onPick: (date: ISODate) => void;
  onClose: () => void;
};

export function DayPickerSheet({ visible, title, days, exclude, onPick, onClose }: Props) {
  const today = todayISO();
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <ScrollView>
        <View style={styles.grid}>
          {days.map((d) => {
            const { weekday, date } = formatDay(d);
            const disabled = d === exclude;
            const isToday = d === today;
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ disabled }}
                disabled={disabled}
                onPress={() => onPick(d)}
                style={({ pressed }) => [styles.day, isToday && styles.today, pressed && { opacity: 0.8 }, disabled && { opacity: 0.35 }]}
              >
                <Text style={[styles.weekday, isToday && { color: colors.accent }]}>{weekday}</Text>
                <Text style={styles.date}>{date}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  day: {
    width: '30%',
    flexGrow: 1,
    paddingVertical: space.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  today: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  weekday: { fontFamily: fonts.heading, fontSize: 13, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  date: { fontFamily: fonts.bodySemibold, fontSize: 16, color: colors.ink, marginTop: 2 },
});
