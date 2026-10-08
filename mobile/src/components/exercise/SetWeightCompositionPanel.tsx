import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AppSwitch from "@/components/ui/AppSwitch";
import InfoNoticeModal from "@/components/profile/modals/InfoNoticeModal";
import {
  BAR_PRESETS,
  createBarTermDraft,
  createBodyweightTermDraft,
  createPlatesTermDraft,
  PLATE_PLACEMENT_PRESETS,
  PLATE_STEP_KGS,
  sumPlatesTermKg,
  type BarTermDraft,
  type CompositionTermDraft,
  type PlatesTermDraft,
  type WeightCompositionV1,
} from "@/domain/weightComposition";
import { useCatalogUi } from "@/theme/catalogUi";
import { fonts } from "@/theme/typography";

type Props = {
  terms: CompositionTermDraft[];
  onTermsChange: (next: CompositionTermDraft[]) => void;
  defaultBodyweightKg: number | null;
  bodyweightLoading: boolean;
  preview: Pick<WeightCompositionV1, "cached_effective_kg" | "cached_display">;
};

function formatKg(value: number): string {
  if (value === Math.trunc(value)) return String(Math.trunc(value));
  return String(value).replace(".", ",");
}

function parseKgInput(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}

function updateTermAt(
  terms: CompositionTermDraft[],
  id: string,
  patch: Partial<CompositionTermDraft>,
): CompositionTermDraft[] {
  return terms.map((term) => (term.id === id ? { ...term, ...patch } as CompositionTermDraft : term));
}

type TermCardProps = {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
  catalogUi: ReturnType<typeof useCatalogUi>;
};

function TermCard({ title, onRemove, children, styles, catalogUi }: TermCardProps) {
  return (
    <View style={styles.termCard}>
      <View style={styles.termHeader}>
        <Text style={styles.termTitle}>{title}</Text>
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Удалить: ${title}`}
        >
          <Ionicons name="trash-outline" size={18} color={catalogUi.textMuted} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

type BodyweightTermEditorProps = {
  term: Extract<CompositionTermDraft, { kind: "bodyweight" }>;
  defaultBodyweightKg: number | null;
  bodyweightLoading: boolean;
  onChange: (next: Extract<CompositionTermDraft, { kind: "bodyweight" }>) => void;
  onRemove: () => void;
  styles: ReturnType<typeof createStyles>;
  catalogUi: ReturnType<typeof useCatalogUi>;
};

function BodyweightTermEditor({
  term,
  defaultBodyweightKg,
  bodyweightLoading,
  onChange,
  onRemove,
  styles,
  catalogUi,
}: BodyweightTermEditorProps) {
  const [weightEditNoticeVisible, setWeightEditNoticeVisible] = useState(false);
  const inputValue =
    term.bodyweightKg != null ? formatKg(term.bodyweightKg).replace(",", ".") : "";

  return (
    <TermCard title="Собственный вес" onRemove={onRemove} styles={styles} catalogUi={catalogUi}>
      <Text style={styles.hint}>
        Вес берётся из журнала взвешиваний.
      </Text>
      <Pressable
        style={styles.placementInput}
        onPress={() => setWeightEditNoticeVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Собственный вес из журнала взвешиваний"
      >
        <Text
          style={[
            styles.bodyweightReadonlyValue,
            { color: inputValue ? catalogUi.text : catalogUi.textMuted },
          ]}
        >
          {inputValue || "кг"}
        </Text>
      </Pressable>
      <View style={styles.bodyweightRow}>
        {bodyweightLoading ? (
          <ActivityIndicator size="small" color={catalogUi.accent} />
        ) : defaultBodyweightKg != null ? (
          <Pressable
            style={styles.diaryBtn}
            onPress={() =>
              onChange({
                ...term,
                bodyweightKg: defaultBodyweightKg,
                bodyweightSource: "history",
              })
            }
            accessibilityLabel={`Подставить из дневника ${formatKg(defaultBodyweightKg)} кг`}
          >
            <Text style={styles.diaryBtnText}>
              Из дневника: {formatKg(defaultBodyweightKg)} кг
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.hint}>В дневнике веса нет записей</Text>
        )}
      </View>

      <InfoNoticeModal
        visible={weightEditNoticeVisible}
        title="Собственный вес"
        body="Чтобы изменить вес, взвесьтесь и добавьте его в журнал взвешиваний в профиле!"
        onClose={() => setWeightEditNoticeVisible(false)}
      />
    </TermCard>
  );
}

type PlatesTermEditorProps = {
  term: PlatesTermDraft;
  onChange: (next: PlatesTermDraft) => void;
  onRemove: () => void;
  styles: ReturnType<typeof createStyles>;
  catalogUi: ReturnType<typeof useCatalogUi>;
};

function isPresetPlacement(placement: string): boolean {
  return (PLATE_PLACEMENT_PRESETS as readonly string[]).includes(placement);
}

function customPlacementOpenInitial(placement: string): boolean {
  return !isPresetPlacement(placement) && placement.trim() !== "";
}

function PlatesTermEditor({ term, onChange, onRemove, styles, catalogUi }: PlatesTermEditorProps) {
  const addPlate = (kg: number) => {
    onChange({ ...term, plateKgs: [...term.plateKgs, kg] });
  };

  const removePlateAt = (index: number) => {
    onChange({ ...term, plateKgs: term.plateKgs.filter((_, i) => i !== index) });
  };

  const platesSum = sumPlatesTermKg({
    kind: "plates",
    kgs: term.plateKgs,
    mirror: term.mirror,
  });

  const [customPlacementOpen, setCustomPlacementOpen] = useState(() =>
    customPlacementOpenInitial(term.placement),
  );

  useEffect(() => {
    setCustomPlacementOpen(customPlacementOpenInitial(term.placement));
  }, [term.id]);

  return (
    <TermCard title="Блины" onRemove={onRemove} styles={styles} catalogUi={catalogUi}>
      <Text style={styles.sectionLabel}>Куда</Text>
      <View style={styles.chipRow}>
        {PLATE_PLACEMENT_PRESETS.map((preset) => {
          const selected = term.placement === preset;
          return (
            <Pressable
              key={preset}
              style={[styles.chip, selected && styles.chipOn]}
              onPress={() => {
                if (selected) {
                  onChange({ ...term, placement: "" });
                  setCustomPlacementOpen(false);
                  return;
                }
                onChange({ ...term, placement: preset });
                setCustomPlacementOpen(false);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{preset}</Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[styles.chipCustom, customPlacementOpen && styles.chipCustomOn]}
          onPress={() => {
            if (customPlacementOpen) {
              setCustomPlacementOpen(false);
              onChange({ ...term, placement: "" });
              return;
            }
            setCustomPlacementOpen(true);
            if (isPresetPlacement(term.placement)) {
              onChange({ ...term, placement: "" });
            }
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: customPlacementOpen }}
          accessibilityLabel="Ввести место крепления вручную"
        >
          <View style={styles.chipCustomInner}>
            <Ionicons
              name="pencil-outline"
              size={14}
              color={customPlacementOpen ? catalogUi.accent : catalogUi.textMuted}
            />
            <Text style={[styles.chipCustomText, customPlacementOpen && styles.chipCustomTextOn]}>
              ввести
            </Text>
          </View>
        </Pressable>
      </View>
      {customPlacementOpen ? (
        <TextInput
          style={[styles.placementInput, styles.placementInputBelowChips]}
          value={term.placement}
          onChangeText={(placement) => onChange({ ...term, placement })}
          placeholder="пояс, жилет, гриф…"
          placeholderTextColor={catalogUi.textPlaceholder}
        />
      ) : null}

      <Text style={styles.sectionLabel}>Добавить блин, кг</Text>
      <View style={styles.chipRow}>
        {PLATE_STEP_KGS.map((kg) => (
          <Pressable
            key={kg}
            style={styles.chip}
            onPress={() => addPlate(kg)}
            accessibilityLabel={`Добавить ${kg} кг`}
          >
            <Text style={styles.chipText}>+{formatKg(kg)}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.selectedPlatesWrap}>
        <Text style={styles.sectionLabel}>Выбрано</Text>
        <View style={styles.chipRow}>
          {term.plateKgs.length === 0 ? (
            <View style={[styles.chip, styles.chipOn]} accessibilityLabel="0 кг">
              <Text style={[styles.chipText, styles.chipTextOn]}>0</Text>
            </View>
          ) : (
            term.plateKgs.map((kg, index) => (
              <Pressable
                key={`${kg}-${index}`}
                style={[styles.chip, styles.chipOn]}
                onPress={() => removePlateAt(index)}
                accessibilityLabel={`Убрать ${kg} кг`}
              >
                <Text style={[styles.chipText, styles.chipTextOn]}>
                  {formatKg(kg)} ×
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </View>

      <View style={styles.mirrorRow}>
        <Text style={styles.mirrorLabel}>Удвоить (обе стороны штанги)</Text>
        <AppSwitch
          value={term.mirror}
          onValueChange={(mirror) => onChange({ ...term, mirror })}
          trackColor={{ false: catalogUi.switchOff, true: catalogUi.accent }}
          thumbColor={catalogUi.switchThumb}
        />
      </View>

      <View style={styles.sumRow}>
        <Text style={styles.sumLabel}>Сумма</Text>
        <Text style={styles.sumValue}>{`${formatKg(platesSum)} кг`}</Text>
      </View>
    </TermCard>
  );
}

type BarTermEditorProps = {
  term: BarTermDraft;
  onChange: (next: BarTermDraft) => void;
  onRemove: () => void;
  styles: ReturnType<typeof createStyles>;
  catalogUi: ReturnType<typeof useCatalogUi>;
};

function BarTermEditor({ term, onChange, onRemove, styles, catalogUi }: BarTermEditorProps) {
  const inputValue = term.barKg != null ? formatKg(term.barKg).replace(",", ".") : "";

  const applyPreset = (preset: (typeof BAR_PRESETS)[number]) => {
    onChange({
      ...term,
      barKg: preset.barKg,
      label: preset.label,
      standard: preset.standard,
    });
  };

  return (
    <TermCard title="Гриф" onRemove={onRemove} styles={styles} catalogUi={catalogUi}>
      <Text style={styles.sectionLabel}>Тип грифа</Text>
      <View style={styles.chipRow}>
        {BAR_PRESETS.map((preset) => {
          const selected = term.standard === preset.standard;
          return (
            <Pressable
              key={preset.standard}
              style={[styles.chip, selected && styles.chipOn]}
              onPress={() => applyPreset(preset)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Подпись</Text>
      <TextInput
        style={styles.placementInput}
        value={term.label}
        onChangeText={(label) =>
          onChange({ ...term, label, standard: "custom" })
        }
        placeholder="гриф, EZ-гриф…"
        placeholderTextColor={catalogUi.textPlaceholder}
      />

      <Text style={styles.sectionLabel}>Вес грифа, кг</Text>
      <TextInput
        style={styles.placementInput}
        value={inputValue}
        onChangeText={(value) =>
          onChange({
            ...term,
            barKg: parseKgInput(value),
            standard: "custom",
          })
        }
        keyboardType="decimal-pad"
      />

      <View style={styles.sumRow}>
        <Text style={styles.sumLabel}>Сумма</Text>
        <Text style={styles.sumValue}>
          {term.barKg != null && term.barKg > 0 ? `${formatKg(term.barKg)} кг` : "—"}
        </Text>
      </View>
    </TermCard>
  );
}

export default function SetWeightCompositionPanel({
  terms,
  onTermsChange,
  defaultBodyweightKg,
  bodyweightLoading,
  preview,
}: Props) {
  const catalogUi = useCatalogUi();
  const styles = useMemo(() => createStyles(catalogUi), [catalogUi]);

  const removeTerm = (id: string) => {
    onTermsChange(terms.filter((term) => term.id !== id));
  };

  const updateTerm = (id: string, patch: Partial<CompositionTermDraft>) => {
    onTermsChange(updateTermAt(terms, id, patch));
  };

  return (
    <View style={styles.wrap}>
      {terms.length === 0 ? (
        <Text style={styles.emptyHint}>
          Добавьте секции состава веса — свой вес, гриф и/или блины, в любом порядке и количестве.
        </Text>
      ) : null}

      {terms.map((term) => {
        if (term.kind === "bodyweight") {
          return (
            <BodyweightTermEditor
              key={term.id}
              term={term}
              defaultBodyweightKg={defaultBodyweightKg}
              bodyweightLoading={bodyweightLoading}
              onChange={(next) => updateTerm(term.id, next)}
              onRemove={() => removeTerm(term.id)}
              styles={styles}
              catalogUi={catalogUi}
            />
          );
        }
        if (term.kind === "bar") {
          return (
            <BarTermEditor
              key={term.id}
              term={term}
              onChange={(next) => updateTerm(term.id, next)}
              onRemove={() => removeTerm(term.id)}
              styles={styles}
              catalogUi={catalogUi}
            />
          );
        }
        return (
          <PlatesTermEditor
            key={term.id}
            term={term}
            onChange={(next) => updateTerm(term.id, next)}
            onRemove={() => removeTerm(term.id)}
            styles={styles}
            catalogUi={catalogUi}
          />
        );
      })}

      <View style={styles.addRow}>
        <Pressable
          style={styles.addBtn}
          onPress={() =>
            onTermsChange([...terms, createBodyweightTermDraft(defaultBodyweightKg)])
          }
          accessibilityRole="button"
          accessibilityLabel="Добавить секцию собственного веса"
        >
          <Ionicons name="add" size={18} color={catalogUi.accent} />
          <Text style={styles.addBtnText}>Свой вес</Text>
        </Pressable>
        <Pressable
          style={styles.addBtn}
          onPress={() => onTermsChange([...terms, createPlatesTermDraft()])}
          accessibilityRole="button"
          accessibilityLabel="Добавить секцию блинов"
        >
          <Ionicons name="add" size={18} color={catalogUi.accent} />
          <Text style={styles.addBtnText}>Блины</Text>
        </Pressable>
        <Pressable
          style={styles.addBtn}
          onPress={() => onTermsChange([...terms, createBarTermDraft()])}
          accessibilityRole="button"
          accessibilityLabel="Добавить секцию грифа"
        >
          <Ionicons name="add" size={18} color={catalogUi.accent} />
          <Text style={styles.addBtnText}>Гриф</Text>
        </Pressable>
      </View>

      <View style={styles.previewCard}>
        <Text style={styles.previewTitle}>Итого</Text>
        <Text style={styles.previewDisplay}>
          {preview.cached_display?.trim() || "—"}
        </Text>
        <Text style={styles.previewKg}>
          {preview.cached_effective_kg != null
            ? `${formatKg(preview.cached_effective_kg)} кг`
            : "—"}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (catalogUi: ReturnType<typeof useCatalogUi>) =>
  StyleSheet.create({
    wrap: {
      marginBottom: 12,
      gap: 10,
    },
    emptyHint: {
      fontFamily: fonts.regular,
      fontSize: 13,
      color: catalogUi.textMuted,
      lineHeight: 18,
    },
    termCard: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: catalogUi.border,
      backgroundColor: catalogUi.pageBg,
      gap: 8,
    },
    termHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    termTitle: {
      fontFamily: fonts.bold,
      fontSize: 14,
      color: catalogUi.text,
    },
    hint: {
      fontFamily: fonts.regular,
      fontSize: 12,
      color: catalogUi.textMuted,
      lineHeight: 16,
    },
    bodyweightRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 28,
    },
    diaryBtn: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: catalogUi.accentSoft,
    },
    diaryBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: 12,
      color: catalogUi.accent,
    },
    sectionLabel: {
      fontFamily: fonts.semiBold,
      fontSize: 11,
      color: catalogUi.textMuted,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: catalogUi.border,
    },
    chipOn: {
      backgroundColor: catalogUi.accentSoft,
    },
    chipCustom: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: catalogUi.border,
      backgroundColor: catalogUi.pageBg,
    },
    chipCustomOn: {
      borderStyle: "solid",
      borderColor: catalogUi.accent,
      backgroundColor: catalogUi.accentSoft,
    },
    chipCustomInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    chipCustomText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: catalogUi.textMuted,
    },
    chipCustomTextOn: {
      color: catalogUi.accent,
    },
    chipText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: catalogUi.textMuted,
    },
    chipTextOn: {
      color: catalogUi.accent,
    },
    placementInput: {
      borderWidth: 1,
      borderColor: catalogUi.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontFamily: fonts.regular,
      fontSize: 15,
      color: catalogUi.text,
      backgroundColor: catalogUi.cardSoft,
    },
    placementInputBelowChips: {
      marginTop: 8,
    },
    bodyweightReadonlyValue: {
      fontFamily: fonts.regular,
      fontSize: 15,
    },
    selectedPlatesWrap: {
      gap: 6,
    },
    mirrorRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 4,
    },
    mirrorLabel: {
      flex: 1,
      fontFamily: fonts.regular,
      fontSize: 13,
      color: catalogUi.textMuted,
      marginRight: 8,
    },
    sumRow: {
      flexDirection: "row",
      alignItems: "baseline",
      flexWrap: "wrap",
      gap: 6,
    },
    sumLabel: {
      fontFamily: fonts.semiBold,
      fontSize: 15,
      color: catalogUi.textMuted,
    },
    sumValue: {
      fontFamily: fonts.bold,
      fontSize: 15,
      color: catalogUi.accent,
    },
    addRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    addBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: catalogUi.border,
      backgroundColor: catalogUi.cardSoft,
    },
    addBtnText: {
      fontFamily: fonts.semiBold,
      fontSize: 13,
      color: catalogUi.accent,
    },
    previewCard: {
      marginTop: 4,
      padding: 12,
      borderRadius: 12,
      backgroundColor: catalogUi.cardSoft,
      gap: 4,
    },
    previewTitle: {
      fontFamily: fonts.semiBold,
      fontSize: 11,
      color: catalogUi.textMuted,
    },
    previewDisplay: {
      fontFamily: fonts.regular,
      fontSize: 14,
      color: catalogUi.text,
    },
    previewKg: {
      fontFamily: fonts.bold,
      fontSize: 16,
      color: catalogUi.accent,
    },
  });
