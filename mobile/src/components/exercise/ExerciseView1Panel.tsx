import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  fetchExerciseInWorkout,
  exerciseLogFromRow,
  plannedSetsFromExerciseRow,
  plannedSetsJsonFromExerciseRow,
} from "@/api/exerciseInWorkout";
import SetEditorModal from "@/components/modals/SetEditorModal";
import TimelineEntryCreateModal from "@/components/modals/TimelineEntryCreateModal";
import RestEditorModal, { isRestLogEntry } from "@/components/modals/RestEditorModal";
import MarkEditorModal, { isMarkLogEntry } from "@/components/modals/MarkEditorModal";
import CommentEditorModal, { isCommentLogEntry } from "@/components/modals/CommentEditorModal";
import type { ExerciseTimerPhase } from "@/components/exercise/TabTimer";
import {
  buildExerciseTimelineFromPlannedJson,
  formatRestEventMmSs,
  formatTimelineEventTime,
  timelineEventFromLogEntry,
} from "@/utils/exerciseTimeline";
import { getExerciseSetProgress } from "@/utils/exerciseSetProgress";
import { fmtDuration } from "@/utils/time";
import { on } from "@/utils/eventBus";
import {
  applyExerciseUpdatedPayload,
  EXERCISE_UPDATED_EVENT,
  type ExerciseTimelineSource,
} from "@/utils/exerciseUpdatedEvent";
import { metricToken } from "@/components/workouts/metricIcon";
import { pressableStyle } from "@/utils/pressableStyles";
import { useCatalogUi } from "@/theme/catalogUi";
import { PLAQUE_RADIUS } from "@/theme/plaqueStyles";
import { fonts, type } from "@/theme/typography";

import {
  createEmptyNextSetDraft,
  type NextSetDraft,
} from "@/domain/nextSetDraft";
import {
  VIEW1_CHANNEL_EMPTY,
  view1SetChannelsFromLogEntry,
  view1SetChannelsFromNextSetDraft,
  view1SetChannelsNativeId,
  view1SetMetaLineFromEvent,
  type View1SetChannels,
} from "@/utils/view1SetChannels";

type LogEntry = Record<string, unknown>;

type View1SetRow = {
  kind: "set";
  idxInLog: number | null;
  idxInPlanned: number | null;
  setNumber: number;
  channels: View1SetChannels;
  setComment: string | null;
  isPlaceholder?: boolean;
  isPlanned?: boolean;
};

type View1RestRow = {
  kind: "rest";
  idxInLog: number | null;
  idxInPlanned: number | null;
  detailsLine: string;
  comment: string | null;
  isLive?: boolean;
  isPlanned?: boolean;
};

type View1MarkRow = {
  kind: "mark";
  idxInLog: number;
  markType: "start" | "end";
  timeLabel: string;
  comment: string | null;
};

type View1CommentRow = {
  kind: "comment";
  idxInLog: number;
  timeLabel: string;
  comment: string;
};

type View1Row = View1SetRow | View1RestRow | View1MarkRow | View1CommentRow;

function pickExerciseLogEntries(ex: unknown): LogEntry[] {
  if (!ex || typeof ex !== "object") return [];
  return exerciseLogFromRow(ex as Record<string, unknown>);
}

function view1RowKey(row: View1Row, index: number): string {
  if (row.kind === "mark") return `mark-${row.idxInLog}`;
  if (row.kind === "comment") return `comment-${row.idxInLog}`;
  if (row.kind === "rest" && row.isLive) return "live-rest";
  if (row.kind === "rest" && row.isPlanned) return `planned-rest-${index}-${row.detailsLine}`;
  if (row.kind === "rest") return `rest-${row.idxInLog}`;
  if (row.kind === "set" && row.isPlanned) return `planned-set-${row.setNumber}`;
  if (row.kind === "set" && row.isPlaceholder) return `placeholder-${row.setNumber}`;
  if (row.kind === "set") return `set-${row.idxInLog}`;
  return `row-${index}`;
}

function parseLogDatetimeMs(item: LogEntry): number | null {
  const raw = item.datetime ?? item.time;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function eventDurationSeconds(event: ReturnType<typeof timelineEventFromLogEntry>): number {
  if (!event) return 0;
  if (event.type === "set") {
    const raw = event.set_seconds;
    return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }
  if (event.type === "rest") {
    const raw = event.rest_seconds ?? event.rest;
    return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }
  return 0;
}

function buildLogEventDateByIndex(log: LogEntry[]): (string | null)[] {
  const result: (string | null)[] = Array(log.length).fill(null);
  let cursorMs: number | null = null;

  for (let index = 0; index < log.length; index += 1) {
    const item = log[index];
    if (!item || typeof item !== "object") continue;

    const event = timelineEventFromLogEntry(item);
    const explicitMs = parseLogDatetimeMs(item);
    const eventMs = explicitMs ?? cursorMs;
    if (eventMs != null) {
      result[index] = new Date(eventMs).toISOString();
    }

    if (!event) continue;
    if (event.type === "mark") {
      if (explicitMs != null) cursorMs = explicitMs;
      if (event.mark_type === "end") cursorMs = null;
      continue;
    }
    if (eventMs != null) {
      cursorMs = eventMs + eventDurationSeconds(event) * 1000;
    }
  }

  return result;
}

type View1SetChannelsBlockProps = {
  setNumber: number;
  channels: View1SetChannels;
  styles: ReturnType<typeof createStyles>;
};

function View1SetChannelsBlock({ setNumber, channels, styles }: View1SetChannelsBlockProps) {
  const valueStyle = (value: string) =>
    value === VIEW1_CHANNEL_EMPTY ? styles.channelValueEmpty : styles.channelValue;
  const hasTextWeight = channels.weightString !== VIEW1_CHANNEL_EMPTY;
  const hasTextReps = channels.repsString !== VIEW1_CHANNEL_EMPTY;
  const showTextChannel = hasTextWeight || hasTextReps;
  const showNumericWeight = channels.weightKg !== VIEW1_CHANNEL_EMPTY;

  return (
    <View nativeID={view1SetChannelsNativeId(setNumber)} style={styles.channelsWrap}>
      <View style={styles.channelRow}>
        <Text style={styles.channelLabel}>Вес</Text>
        <View style={styles.channelStack}>
          <Text style={valueStyle(channels.compositionDisplay)} numberOfLines={3}>
            {channels.compositionDisplay}
          </Text>
          {channels.compositionTotalKg !== VIEW1_CHANNEL_EMPTY ? (
            <Text style={styles.channelCompositionTotal} numberOfLines={1}>
              {channels.compositionTotalKg}
            </Text>
          ) : null}
        </View>
      </View>

      {showNumericWeight ? (
        <View style={styles.channelRow}>
          <Text style={styles.channelLabel}>Вес (число)</Text>
          <View style={styles.channelStack}>
            <Text style={valueStyle(channels.weightKg)} numberOfLines={2}>
              {channels.weightKg}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.channelRow}>
        <Text style={styles.channelLabel}>Повторений</Text>
        <View style={styles.channelStack}>
          <Text style={valueStyle(channels.reps)} numberOfLines={2}>
            {channels.reps}
          </Text>
        </View>
      </View>

      {showTextChannel ? (
        <View style={styles.channelRow}>
          <Text style={styles.channelLabel}>Текстом</Text>
          <View style={styles.channelValuesRow}>
            {hasTextWeight ? (
              <View style={styles.channelValueCol}>
                <Text style={styles.channelSubLabel}>Вес</Text>
                <Text style={styles.channelValue} numberOfLines={2}>
                  {channels.weightString}
                </Text>
              </View>
            ) : null}
            {hasTextReps ? (
              <View style={styles.channelValueCol}>
                <Text style={styles.channelSubLabel}>Повт.</Text>
                <Text style={styles.channelValue} numberOfLines={2}>
                  {channels.repsString}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  exerciseId: number | null;
  contentInsetHorizontal?: number;
  nextSetDraft?: NextSetDraft;
  timerPhase?: ExerciseTimerPhase;
  /** Снимок журнала с экрана /exercise/[id] — без пустого «Вид 1» до fetch. */
  initialLog?: LogEntry[];
  /** Журнал с родителя (таймер): без отдельного GET на exercise:updated. */
  liveLog?: LogEntry[];
  /** planned_sets_json с родителя (вкладка «Подходы»). */
  livePlannedSetsJson?: LogEntry[];
  initialPlannedSets?: number | null;
  initialPlannedSetsJson?: LogEntry[];
  /** Показать заголовок «Вид 1» с возможностью свернуть блок. */
  collapsible?: boolean;
  /** Начальное состояние при `collapsible`. */
  defaultExpanded?: boolean;
  /** Поля «Вес (текст)» и «Повторения (текст)» в карточках и модалках. */
  showSetTextFields?: boolean;
  /** Открыть редактор черновика текущего/следующего подхода из таймера. */
  onEditNextSetDraft?: () => void;
  /** Сколько секунд прошло в текущей фазе таймера. */
  liveTimerElapsedSec?: number;
};

/** Список подходов «Вид 1» — общий для вкладок «Подходы» и «Таймер». */
export default function ExerciseView1Panel({
  exerciseId,
  contentInsetHorizontal = 16,
  nextSetDraft = createEmptyNextSetDraft(),
  timerPhase = "idle",
  initialLog,
  liveLog,
  livePlannedSetsJson,
  initialPlannedSets,
  initialPlannedSetsJson,
  collapsible = false,
  defaultExpanded = true,
  showSetTextFields = true,
  onEditNextSetDraft,
  liveTimerElapsedSec = 0,
}: Props) {
  const catalogUi = useCatalogUi();
  const styles = useMemo(
    () => createStyles(catalogUi, contentInsetHorizontal),
    [catalogUi, contentInsetHorizontal],
  );
  const hasInitialSnapshot = initialLog !== undefined;
  const skipFirstFetchRef = useRef(hasInitialSnapshot);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [log, setLog] = useState<LogEntry[]>(initialLog ?? []);
  const [plannedSets, setPlannedSets] = useState<number | null>(
    initialPlannedSets !== undefined ? initialPlannedSets : null,
  );
  const [plannedSetsJson, setPlannedSetsJson] = useState<LogEntry[]>(
    initialPlannedSetsJson ?? [],
  );
  const [loading, setLoading] = useState(!hasInitialSnapshot);
  const [error, setError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editorIdx, setEditorIdx] = useState<number | null>(null);
  const [editorInitial, setEditorInitial] = useState<LogEntry | null>(null);
  const [editorTimeline, setEditorTimeline] = useState<ExerciseTimelineSource>("log");
  const [restEditorOpen, setRestEditorOpen] = useState(false);
  const [restEditorIdx, setRestEditorIdx] = useState<number | null>(null);
  const [restEditorInitial, setRestEditorInitial] = useState<LogEntry | null>(null);
  const [restEditorTimeline, setRestEditorTimeline] = useState<ExerciseTimelineSource>("log");
  const [markEditorOpen, setMarkEditorOpen] = useState(false);
  const [markEditorIdx, setMarkEditorIdx] = useState<number | null>(null);
  const [markEditorInitial, setMarkEditorInitial] = useState<LogEntry | null>(null);
  const [commentEditorOpen, setCommentEditorOpen] = useState(false);
  const [commentEditorIdx, setCommentEditorIdx] = useState<number | null>(null);
  const [commentEditorInitial, setCommentEditorInitial] = useState<LogEntry | null>(null);
  const parentOwnsLog = liveLog !== undefined;
  const displayLog = liveLog ?? log;
  const displayPlannedSetsJson = livePlannedSetsJson ?? plannedSetsJson;

  const fetchExercise = useCallback(async (options?: { silent?: boolean }) => {
    if (!exerciseId) return;
    try {
      if (!options?.silent) setLoading(true);
      setError("");
      const ex = await fetchExerciseInWorkout(exerciseId);
      setLog(pickExerciseLogEntries(ex));
      setPlannedSets(plannedSetsFromExerciseRow(ex));
      setPlannedSetsJson(plannedSetsJsonFromExerciseRow(ex));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [exerciseId]);

  const handleExerciseUpdated = useCallback(
    (payload?: unknown) => {
      const applied = applyExerciseUpdatedPayload(payload, exerciseId, {
        onLog: (nextLog, nextPlanned) => {
          if (!parentOwnsLog) {
            setLog(nextLog);
            if (nextPlanned !== undefined) setPlannedSets(nextPlanned);
          }
        },
        onPlannedOnly: (nextPlanned) => {
          setPlannedSets(nextPlanned);
        },
        onPlannedJson: (nextPlannedJson) => {
          if (livePlannedSetsJson !== undefined) return;
          setPlannedSetsJson([...nextPlannedJson]);
        },
      });
      if (applied) return;
      if (parentOwnsLog) return;
      void fetchExercise({ silent: true });
    },
    [exerciseId, fetchExercise, livePlannedSetsJson, parentOwnsLog],
  );

  useEffect(() => {
    if (!parentOwnsLog) {
      if (skipFirstFetchRef.current) {
        skipFirstFetchRef.current = false;
      } else {
        void fetchExercise();
      }
    }
    return on(EXERCISE_UPDATED_EVENT, handleExerciseUpdated);
  }, [fetchExercise, handleExerciseUpdated, parentOwnsLog]);

  function openEdit(idx: number, entry: LogEntry, timeline: ExerciseTimelineSource = "log") {
    if (isRestLogEntry(entry)) {
      setRestEditorIdx(idx);
      setRestEditorInitial(entry);
      setRestEditorTimeline(timeline);
      setRestEditorOpen(true);
      return;
    }
    if (timeline === "planned") {
      setEditorIdx(idx);
      setEditorInitial(entry);
      setEditorTimeline("planned");
      setEditorOpen(true);
      return;
    }
    if (isMarkLogEntry(entry)) {
      setMarkEditorIdx(idx);
      setMarkEditorInitial(entry);
      setMarkEditorOpen(true);
      return;
    }
    if (isCommentLogEntry(entry)) {
      setCommentEditorIdx(idx);
      setCommentEditorInitial(entry);
      setCommentEditorOpen(true);
      return;
    }
    setEditorIdx(idx);
    setEditorInitial(entry);
    setEditorTimeline("log");
    setEditorOpen(true);
  }

  function openCreate() {
    setCreateModalOpen(true);
  }

  function openEditByLogIndex(logIndex: number | null) {
    if (logIndex == null) return;
    const entry = displayLog[logIndex];
    if (!entry) return;
    openEdit(logIndex, entry, "log");
  }

  function openEditByPlannedIndex(plannedIndex: number | null) {
    if (plannedIndex == null) return;
    const entry = displayPlannedSetsJson[plannedIndex];
    if (!entry) return;
    openEdit(plannedIndex, entry, "planned");
  }

  const view1LogRows = useMemo((): View1Row[] => {
    const arr: View1Row[] = [];
    let sn = 0;

    for (let i = 0; i < displayLog.length; i += 1) {
      const item = displayLog[i];
      if (!item || typeof item !== "object") continue;

      const event = timelineEventFromLogEntry(item);
      if (!event) {
        const legacyComment = typeof item.comment === "string" ? item.comment.trim() : "";
        const hasRest = item.rest != null || item.rest_seconds != null;
        const hasSetFields =
          item.reps != null ||
          item.weight != null ||
          item.weight_kg != null ||
          item.set_time != null ||
          item.set_seconds != null;
        if (
          legacyComment &&
          !item.mark_type &&
          item.type !== "mark" &&
          item.type !== "rest" &&
          item.type !== "set" &&
          !hasRest &&
          !hasSetFields
        ) {
          arr.push({
            kind: "comment",
            idxInLog: i,
            timeLabel: formatTimelineEventTime(
              typeof item.datetime === "string" ? item.datetime : undefined,
            ),
            comment: legacyComment,
          });
        }
        continue;
      }

      if (event.type === "comment") {
        const text = typeof event.comment === "string" ? event.comment.trim() : "";
        if (!text) continue;
        arr.push({
          kind: "comment",
          idxInLog: i,
          timeLabel: formatTimelineEventTime(event.datetime),
          comment: text,
        });
        continue;
      }

      if (event.type === "mark") {
        const comment = typeof event.comment === "string" ? event.comment.trim() : "";
        arr.push({
          kind: "mark",
          idxInLog: i,
          markType: event.mark_type === "end" ? "end" : "start",
          timeLabel: formatTimelineEventTime(event.datetime),
          comment: comment || null,
        });
        continue;
      }

      if (event.type === "rest") {
        const comment = typeof event.comment === "string" ? event.comment.trim() : "";
        arr.push({
          kind: "rest",
          idxInLog: i,
          idxInPlanned: null,
          detailsLine: formatRestEventMmSs(event),
          comment: comment || null,
        });
        continue;
      }

      if (event.type !== "set") continue;

      sn += 1;
      const setComment = typeof event.comment === "string" ? event.comment.trim() : "";

      arr.push({
        kind: "set",
        idxInLog: i,
        idxInPlanned: null,
        setNumber: sn,
        channels: view1SetChannelsFromLogEntry(item, view1SetMetaLineFromEvent(event)),
        setComment: setComment || null,
      });
    }

    return arr;
  }, [displayLog]);
  const bodyweightAtByLogIndex = useMemo(
    () => buildLogEventDateByIndex(displayLog),
    [displayLog],
  );

  const actualSetRows = useMemo(
    () => view1LogRows.filter((row): row is View1SetRow => row.kind === "set"),
    [view1LogRows],
  );

  const setProgress = getExerciseSetProgress(displayLog);
  const loggedSetCount = setProgress.loggedSetCount;
  const hasExplicitPlan = plannedSets != null && plannedSets > 0;
  const currentSetNumber = loggedSetCount + 1;
  const showCurrentSet = timerPhase === "set";
  const showNextSet = timerPhase === "rest";
  const showActiveDraftSet = showCurrentSet || showNextSet;
  const totalDisplayRows =
    hasExplicitPlan && plannedSets != null
      ? Math.max(plannedSets, showActiveDraftSet ? loggedSetCount + 1 : loggedSetCount)
      : showActiveDraftSet
        ? Math.max(loggedSetCount + 1, 1)
        : loggedSetCount;

  const plannedView1Rows = useMemo((): View1Row[] => {
    if (!displayPlannedSetsJson.length) return [];

    const rows: View1Row[] = [];
    let sn = actualSetRows.length;

    for (let i = 0; i < displayPlannedSetsJson.length; i += 1) {
      const item = displayPlannedSetsJson[i];
      if (!item || typeof item !== "object") continue;
      const event = buildExerciseTimelineFromPlannedJson([item])[0];
      if (!event) continue;

      if (event.type === "rest") {
        rows.push({
          kind: "rest",
          idxInLog: null,
          idxInPlanned: i,
          detailsLine: formatRestEventMmSs(event),
          comment: null,
          isPlanned: true,
        });
        continue;
      }
      if (event.type !== "set") continue;

      sn += 1;

      rows.push({
        kind: "set",
        idxInLog: null,
        idxInPlanned: i,
        setNumber: sn,
        channels: view1SetChannelsFromLogEntry(item),
        setComment: null,
        isPlanned: true,
      });
    }

    return rows;
  }, [actualSetRows.length, displayPlannedSetsJson]);

  const hasStructuredPlan = plannedView1Rows.length > 0;

  const view1DisplayRows = useMemo((): View1Row[] => {
    const rows: View1Row[] = [...view1LogRows];
    const activeDraftRow: View1SetRow = {
      kind: "set",
      idxInLog: null,
      idxInPlanned: null,
      setNumber: currentSetNumber,
      channels: view1SetChannelsFromNextSetDraft(nextSetDraft),
      setComment: null,
      isPlaceholder: true,
    };
    if (showNextSet) {
      rows.push({
        kind: "rest",
        idxInLog: null,
        idxInPlanned: null,
        detailsLine: `${fmtDuration(liveTimerElapsedSec)} ИДЁТ`,
        comment: null,
        isLive: true,
      });
    }
    if (hasStructuredPlan) {
      if (showActiveDraftSet) rows.push(activeDraftRow);
      rows.push(
        ...plannedView1Rows.filter(
          (row) => !(showActiveDraftSet && row.kind === "set" && row.setNumber === currentSetNumber),
        ),
      );
      return rows;
    }

    const template = actualSetRows[actualSetRows.length - 1];
    const templateChannels = template?.channels;

    for (let i = actualSetRows.length + 1; i <= totalDisplayRows; i += 1) {
      const isCurrent = showCurrentSet && i === currentSetNumber;
      const isActiveDraft = showActiveDraftSet && i === currentSetNumber;
      rows.push({
        kind: "set",
        idxInLog: null,
        idxInPlanned: null,
        setNumber: i,
        channels: isActiveDraft
          ? view1SetChannelsFromNextSetDraft(nextSetDraft)
          : templateChannels
            ? { ...templateChannels, metaLine: "" }
            : view1SetChannelsFromNextSetDraft(createEmptyNextSetDraft()),
        setComment: null,
        isPlaceholder: true,
      });
    }

    return rows;
  }, [
    actualSetRows,
    hasStructuredPlan,
    liveTimerElapsedSec,
    plannedView1Rows,
    totalDisplayRows,
    view1LogRows,
    currentSetNumber,
    nextSetDraft,
    showActiveDraftSet,
    showCurrentSet,
    showNextSet,
  ]);

  function renderView1Row({ item }: { item: View1Row }) {
    if (item.kind === "mark") {
      const isStart = item.markType === "start";
      const iconColor = isStart
        ? metricToken("green", catalogUi.dark).fg
        : catalogUi.dark
          ? "#FCA5A5"
          : "#E53E3E";
      const lineColor = isStart
        ? catalogUi.dark
          ? "#3D5A32"
          : "#B8E0A8"
        : catalogUi.dark
          ? "#5C3030"
          : "#F5C6C6";

      return (
        <Pressable
          style={styles.markRow}
          onPress={() => openEditByLogIndex(item.idxInLog)}
          accessibilityRole="button"
          accessibilityLabel={isStart ? "Редактировать START" : "Редактировать FINISH"}
        >
          <View style={styles.markRowMain}>
            <MaterialCommunityIcons
              name={isStart ? "flag-checkered" : "flag"}
              size={18}
              color={iconColor}
            />
            <Text style={[styles.markLabel, isStart ? styles.markLabelStart : styles.markLabelEnd]}>
              {isStart ? "START" : "FINISH"}
            </Text>
            <View style={[styles.markLine, { backgroundColor: lineColor }]} />
            <Text style={styles.markTime}>{item.timeLabel}</Text>
          </View>
          {item.comment ? (
            <View style={styles.markCommentWrap}>
              <Ionicons name="chatbox-ellipses-outline" size={14} color={catalogUi.textMuted} />
              <Text style={styles.markCommentText}>{item.comment}</Text>
            </View>
          ) : null}
        </Pressable>
      );
    }

    if (item.kind === "rest") {
      const plannedRest = item.isPlanned === true;
      const liveRest = item.isLive === true;
      const iconColor = catalogUi.accent;
      const lineColor = catalogUi.dark ? "#2F4A54" : "#B8E0EA";
      const openRestEditor = () =>
        plannedRest
          ? openEditByPlannedIndex(item.idxInPlanned)
          : openEditByLogIndex(item.idxInLog);
      const restBody = (
        <>
          <View style={styles.markRowMain}>
            <MaterialCommunityIcons name="timer-sand" size={18} color={iconColor} />
            <Text style={styles.restMarkLabel}>
              {plannedRest ? "ОТДЫХ · ПЛАН" : "ОТДЫХ"}
            </Text>
            <Text style={styles.markTime} numberOfLines={1}>
              {item.detailsLine || "—"}
            </Text>
            <View style={[styles.markLine, { backgroundColor: lineColor }]} />
          </View>
          {item.comment ? (
            <View style={styles.markCommentWrap}>
              <Ionicons name="chatbox-ellipses-outline" size={14} color={catalogUi.textMuted} />
              <Text style={styles.markCommentText}>{item.comment}</Text>
            </View>
          ) : null}
        </>
      );
      if (liveRest) {
        return (
          <View style={styles.markRow} accessibilityLabel={`ОТДЫХ ${item.detailsLine}`}>
            {restBody}
          </View>
        );
      }
      return (
        <Pressable
          style={styles.markRow}
          onPress={openRestEditor}
          accessibilityRole="button"
          accessibilityLabel={plannedRest ? "Редактировать отдых из плана" : "Редактировать отдых"}
        >
          {restBody}
        </Pressable>
      );
    }

    if (item.kind === "comment") {
      const commentIconColor = metricToken("violet", catalogUi.dark).fg;
      return (
        <Pressable
          style={[styles.setCard, styles.commentCard]}
          onPress={() => openEditByLogIndex(item.idxInLog)}
        >
          <View style={styles.setTopRow}>
            <View style={styles.timelineRowLeft}>
              <View style={[styles.rowLeadingCircle, styles.commentLeadingCircle]}>
                <MaterialCommunityIcons name="comment-text" size={20} color={commentIconColor} />
              </View>
              <Text style={styles.commentKindLabel}>Комментарий</Text>
            </View>
            <View style={styles.commentTopCenter}>
              {item.timeLabel !== "--:--" ? (
                <Text style={styles.commentTime}>{item.timeLabel}</Text>
              ) : null}
            </View>
            <Pressable
              hitSlop={12}
              style={styles.kebab}
              onPress={() => openEditByLogIndex(item.idxInLog)}
              accessibilityLabel="Меню комментария"
            >
              <Ionicons name="ellipsis-vertical" size={18} color={catalogUi.textMuted} />
            </Pressable>
          </View>
          <View style={styles.commentBody}>
            <View style={styles.commentRow}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color={commentIconColor} />
              <Text style={styles.commentText}>{item.comment}</Text>
            </View>
          </View>
        </Pressable>
      );
    }

    const status = item.isPlanned
      ? "planned"
      : item.isPlaceholder
        ? showCurrentSet && item.setNumber === currentSetNumber
          ? "current"
          : "next"
        : "done";

    const statusLabel =
      status === "planned"
        ? "План"
        : status === "done"
          ? "Выполнено"
          : status === "current"
            ? "Текущий"
            : "Следующий";
    const statusStyle =
      status === "planned"
        ? styles.statusPlanned
        : status === "done"
          ? styles.statusDone
          : status === "current"
            ? styles.statusCurrent
            : styles.statusNext;
    const cardStatusStyle =
      status === "planned"
        ? styles.setCardPlanned
        : status === "done"
          ? styles.setCardDone
          : status === "current"
            ? styles.setCardActive
            : styles.setCardNext;

    const isDraftPlaceholder = item.isPlaceholder && (status === "current" || status === "next");

    const cardBody = (
      <>
        <View style={styles.setHeaderRow}>
          <View style={styles.setLeft}>
            <View style={styles.rowLeadingCircle}>
              <Text style={styles.setNumberText}>{item.setNumber}</Text>
            </View>
            <View style={[styles.statusPill, statusStyle]}>
              <Text
                style={[
                  styles.statusText,
                  status === "done" && styles.statusTextDoneCompact,
                  status === "current" && styles.statusTextCurrent,
                  status === "current" && styles.statusTextCurrentCompact,
                  status === "next" && styles.statusTextNextCompact,
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>

          <View1SetChannelsBlock
            setNumber={item.setNumber}
            channels={item.channels}
            styles={styles}
          />

          {!isDraftPlaceholder ? (
            <Pressable
              hitSlop={12}
              style={styles.kebab}
              onPress={() => {
                if (status === "planned") openEditByPlannedIndex(item.idxInPlanned);
                else if (item.idxInLog != null) openEditByLogIndex(item.idxInLog);
                else openCreate();
              }}
              accessibilityLabel="Меню подхода"
            >
              <Ionicons name="ellipsis-vertical" size={18} color={catalogUi.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {item.channels.metaLine ? (
          <Text style={styles.detailsLine} numberOfLines={4}>
            {item.channels.metaLine}
          </Text>
        ) : null}

        {item.setComment ? (
          <View style={styles.commentsWrap}>
            <View style={styles.commentRow}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color={catalogUi.accent} />
              <Text style={styles.commentText}>
                <Text style={styles.commentAccent}>Подход: </Text>
                {item.setComment}
              </Text>
            </View>
          </View>
        ) : null}
      </>
    );

    if (isDraftPlaceholder) {
      if (onEditNextSetDraft) {
        return (
          <Pressable
            style={[styles.setCard, cardStatusStyle]}
            onPress={onEditNextSetDraft}
            accessibilityRole="button"
            accessibilityLabel={
              status === "current"
                ? `Редактировать текущий подход ${item.setNumber}`
                : `Редактировать следующий подход ${item.setNumber}`
            }
          >
            {cardBody}
          </Pressable>
        );
      }

      return (
        <View
          style={[styles.setCard, cardStatusStyle]}
          accessibilityLabel={
            status === "current"
              ? `Текущий подход ${item.setNumber}`
              : `Следующий подход ${item.setNumber}`
          }
        >
          {cardBody}
        </View>
      );
    }

    return (
      <Pressable
        style={[styles.setCard, cardStatusStyle]}
        onPress={() => {
          if (status === "planned") openEditByPlannedIndex(item.idxInPlanned);
          else if (item.idxInLog != null) openEditByLogIndex(item.idxInLog);
          else openCreate();
        }}
      >
        {cardBody}
      </Pressable>
    );
  }

  if (!exerciseId) return null;

  const listBody = loading ? null : (
    <>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {view1DisplayRows.length === 0 ? (
        <Text style={styles.muted}>Подходов пока нет</Text>
      ) : (
        view1DisplayRows.map((row, index) => (
          <React.Fragment key={view1RowKey(row, index)}>
            {renderView1Row({ item: row })}
          </React.Fragment>
        ))
      )}
    </>
  );

  const toggleExpanded = () => setExpanded((v) => !v);

  const sectionToggle = (placement: "top" | "bottom") => (
    <Pressable
      style={pressableStyle(
        placement === "top" ? styles.sectionHeader : styles.sectionFooter,
        { pressed: { opacity: 0.88 } },
      )}
      onPress={toggleExpanded}
      accessibilityRole="button"
      accessibilityLabel={expanded ? "Скрыть вид 1" : "Показать вид 1"}
      accessibilityState={{ expanded }}
    >
      <Text style={styles.sectionTitle}>Вид 1</Text>
      <Ionicons
        name={expanded ? "chevron-up" : "chevron-down"}
        size={20}
        color={catalogUi.textMuted}
      />
    </Pressable>
  );

  return (
    <View style={[styles.wrap, collapsible && styles.wrapCollapsible]}>
      {collapsible ? sectionToggle("top") : null}

      {!collapsible || expanded ? <View style={styles.list}>{listBody}</View> : null}

      {collapsible && expanded ? sectionToggle("bottom") : null}

      <TimelineEntryCreateModal
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        exerciseId={exerciseId}
        showSetTextFields={showSetTextFields}
      />

      {editorIdx != null ? (
        <SetEditorModal
          visible={editorOpen}
          onClose={() => setEditorOpen(false)}
          exerciseId={exerciseId}
          setIdx={editorIdx}
          initial={editorInitial}
          mode="edit"
          timeline={editorTimeline}
          bodyweightAt={
            editorTimeline === "log" && editorIdx != null
              ? bodyweightAtByLogIndex[editorIdx]
              : null
          }
          showSetTextFields={showSetTextFields}
        />
      ) : null}

      {restEditorIdx != null ? (
        <RestEditorModal
          visible={restEditorOpen}
          onClose={() => setRestEditorOpen(false)}
          exerciseId={exerciseId}
          setIdx={restEditorIdx}
          initial={restEditorInitial}
          timeline={restEditorTimeline}
        />
      ) : null}

      {markEditorIdx != null ? (
        <MarkEditorModal
          visible={markEditorOpen}
          onClose={() => setMarkEditorOpen(false)}
          exerciseId={exerciseId}
          setIdx={markEditorIdx}
          initial={markEditorInitial}
        />
      ) : null}

      {commentEditorIdx != null ? (
        <CommentEditorModal
          visible={commentEditorOpen}
          onClose={() => setCommentEditorOpen(false)}
          exerciseId={exerciseId}
          setIdx={commentEditorIdx}
          initial={commentEditorInitial}
        />
      ) : null}
    </View>
  );
}

const createStyles = (catalogUi: ReturnType<typeof useCatalogUi>, hPad: number) =>
  StyleSheet.create({
    wrap: {},
    wrapCollapsible: {
      marginBottom: 4,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: hPad,
      marginBottom: 4,
      paddingVertical: 8,
    },
    sectionFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: hPad,
      marginTop: 4,
      paddingVertical: 8,
    },
    sectionTitle: {
      ...type.bodyMedium,
      fontFamily: fonts.bold,
      color: catalogUi.text,
    },
    list: {
      paddingHorizontal: hPad,
      paddingBottom: 12,
    },
    muted: {
      fontFamily: fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color: catalogUi.textMuted,
      textAlign: "center",
      paddingTop: 12,
    },
    err: {
      fontFamily: fonts.semiBold,
      fontSize: 14,
      lineHeight: 20,
      color: catalogUi.dark ? "#FCA5A5" : "#dc2626",
      marginBottom: 8,
    },
    setCard: {
      backgroundColor: catalogUi.cardBg,
      borderRadius: PLAQUE_RADIUS,
      padding: 14,
      marginTop: 12,
      borderWidth: 0,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
      elevation: 1,
    },
    setCardActive: {
      backgroundColor: catalogUi.cardSoft,
    },
    setCardDone: {
      backgroundColor: catalogUi.dark ? "#1E2A22" : "#F6FFF8",
    },
    setCardNext: {},
    setCardPlanned: {
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: catalogUi.dark ? "#6B5A2E" : "#E8D4A8",
      backgroundColor: catalogUi.dark ? "#1F1B14" : "#FFFBF2",
    },
    setHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    setTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    setLeft: { width: 72, alignItems: "flex-start", flexShrink: 0, marginRight: 6 },
    timelineRowLeft: { width: 72, alignItems: "flex-start" },
    rowLeadingCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: catalogUi.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    setNumberText: { fontFamily: fonts.extraBold, fontSize: 14, color: catalogUi.accent },
    statusPill: {
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: catalogUi.border,
    },
    statusDone: { backgroundColor: catalogUi.dark ? "#213128" : "#E8F8E8" },
    statusCurrent: { backgroundColor: catalogUi.accentSoft },
    statusNext: { backgroundColor: catalogUi.border },
    statusPlanned: {
      backgroundColor: catalogUi.dark ? "#3D3420" : "#F5E6C8",
    },
    statusText: { fontFamily: fonts.semiBold, fontSize: 12, color: catalogUi.textMuted },
    statusTextDoneCompact: { fontSize: 8, lineHeight: 10 },
    statusTextCurrent: { color: catalogUi.accent },
    statusTextCurrentCompact: { fontSize: 8, lineHeight: 10 },
    statusTextNextCompact: { fontSize: 8, lineHeight: 10 },
    channelsWrap: { flex: 1, minWidth: 0, gap: 6, marginLeft: -4 },
    channelRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    channelLabel: {
      width: 96,
      flexShrink: 0,
      fontFamily: fonts.semiBold,
      fontSize: 12,
      lineHeight: 16,
      color: catalogUi.accent,
      letterSpacing: 0.2,
      paddingTop: 1,
    },
    channelValuesRow: { flex: 1, minWidth: 0, flexDirection: "row", gap: 12 },
    channelValueCol: { flex: 1, minWidth: 0 },
    channelSubLabel: {
      fontFamily: fonts.regular,
      fontSize: 10,
      lineHeight: 13,
      color: catalogUi.textMuted,
    },
    channelValue: {
      fontFamily: fonts.bold,
      fontSize: 12,
      lineHeight: 16,
      color: catalogUi.text,
      marginTop: 1,
    },
    channelValueEmpty: {
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 16,
      color: catalogUi.textMuted,
      marginTop: 1,
    },
    channelStack: { flex: 1, minWidth: 0, gap: 2 },
    channelCompositionTotal: {
      fontFamily: fonts.semiBold,
      fontSize: 11,
      lineHeight: 14,
      color: catalogUi.textMuted,
    },
    metricValue: {
      fontFamily: fonts.bold,
      fontSize: 14,
      lineHeight: 18,
      color: catalogUi.text,
      marginTop: 6,
    },
    kebab: { flexShrink: 0, paddingTop: 2, paddingRight: 2 },
    commentTopCenter: {
      flex: 1,
      minWidth: 0,
      alignItems: "flex-end",
    },
    detailsLine: {
      marginTop: 0,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: catalogUi.text,
    },
    commentCard: {
      backgroundColor: catalogUi.dark ? "#352A48" : "#E4D8FF",
    },
    commentLeadingCircle: {
      backgroundColor: catalogUi.dark ? "#4A3A62" : "#F5F0FF",
    },
    commentBody: {
      marginTop: 12,
    },
    commentKindLabel: {
      marginTop: 8,
      fontFamily: fonts.semiBold,
      fontSize: 11,
      lineHeight: 14,
      color: catalogUi.textMuted,
    },
    commentTime: {
      marginTop: 4,
      textAlign: "right",
      fontFamily: fonts.semiBold,
      fontSize: 12,
      lineHeight: 16,
      color: catalogUi.textMuted,
    },
    markRow: {
      marginTop: 10,
      paddingVertical: 4,
    },
    markRowMain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    markLabel: {
      fontFamily: fonts.extraBold,
      fontSize: 10,
      lineHeight: 12,
      letterSpacing: 0.6,
    },
    markLabelStart: {
      color: catalogUi.dark ? "#86EFAC" : "#22C55E",
    },
    markLabelEnd: {
      color: catalogUi.dark ? "#FCA5A5" : "#DC2626",
    },
    restMarkLabel: {
      fontFamily: fonts.extraBold,
      fontSize: 10,
      lineHeight: 12,
      letterSpacing: 0.6,
      color: catalogUi.accent,
    },
    markLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      minHeight: 1,
    },
    markTime: {
      fontFamily: fonts.semiBold,
      fontSize: 11,
      lineHeight: 14,
      color: catalogUi.textMuted,
      flexShrink: 0,
    },
    markCommentWrap: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginTop: 6,
      paddingLeft: 26,
    },
    markCommentText: {
      flex: 1,
      minWidth: 0,
      fontFamily: fonts.regular,
      fontSize: 12,
      lineHeight: 16,
      color: catalogUi.textMuted,
    },
    commentsWrap: {
      marginTop: 12,
      backgroundColor: catalogUi.cardSoft,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
    },
    commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    commentText: { flex: 1, minWidth: 0, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: catalogUi.textMuted },
    commentAccent: { fontFamily: fonts.extraBold, color: catalogUi.accent },
  });
