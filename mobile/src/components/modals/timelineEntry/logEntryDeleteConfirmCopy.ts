export type LogEntryDeleteKind = "set" | "rest" | "mark" | "comment";

const IRREVERSIBLE_SUFFIX = " Восстановить данные будет нельзя.";

export function getLogEntryDeleteConfirmCopy(
  kind: LogEntryDeleteKind,
  markType?: "start" | "end",
): { title: string; message: string } {
  switch (kind) {
    case "set":
      return {
        title: "Удалить подход?",
        message: `Удалить подход из журнала упражнения?${IRREVERSIBLE_SUFFIX}`,
      };
    case "rest":
      return {
        title: "Удалить отдых?",
        message: `Удалить отдых из журнала упражнения?${IRREVERSIBLE_SUFFIX}`,
      };
    case "mark":
      return markType === "end"
        ? {
            title: "Удалить метку FINISH?",
            message: `Удалить метку FINISH из журнала упражнения?${IRREVERSIBLE_SUFFIX}`,
          }
        : {
            title: "Удалить метку START?",
            message: `Удалить метку START из журнала упражнения?${IRREVERSIBLE_SUFFIX}`,
          };
    case "comment":
      return {
        title: "Удалить комментарий?",
        message: `Удалить комментарий из журнала упражнения?${IRREVERSIBLE_SUFFIX}`,
      };
  }
}
