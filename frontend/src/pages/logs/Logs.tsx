import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import classes from "./Logs.module.scss";
import Search from "../../components/search/Search";
import { ReactComponent as ExpandIcon } from "../../assets/icons/expand.svg";
import { ReactComponent as ShrinkIcon } from "../../assets/icons/shrink.svg";
import { ReactComponent as LogsIcon } from "../../assets/icons/logs.svg";
import { LogDrawerSize, useLogDrawer } from "../../hooks/use-log-drawer";
import CaretIcon from "../../components/caret-icon/CaretIcon";
import { useSearch } from "../../hooks/use-search";
import { useFilterData } from "../../hooks/use-filter-data";
import { useMouseMove } from "../../hooks/use-mouse-move";
import {
  useGetPollingOutputs,
  useGetPollingProcesses,
} from "../../hooks/use-api";
import { ManagedProcessOutput, ProcessOutputSource } from "@flowser/shared";
import { toast } from "react-hot-toast";
import classNames from "classnames";
import { SimpleButton } from "../../components/simple-button/SimpleButton";
import { TextUtils } from "../../utils/text-utils";
import { CommonUtils } from "../../utils/common-utils";

type LogsProps = {
  className?: string;
};

const SEARCH_CONTEXT_NAME = "logs";

const Logs: FunctionComponent<LogsProps> = ({ className }) => {
  const [trackMousePosition, setTrackMousePosition] = useState(false);
  const { logDrawerSize, setSize } = useLogDrawer();
  const tinyLogRef = useRef<HTMLDivElement>(null);
  const nonTinyLogRef = useRef<HTMLDivElement>(null);
  const { data: logs } = useGetPollingOutputs();
  const logWrapperRef = logDrawerSize === "tiny" ? tinyLogRef : nonTinyLogRef;
  const logWrapperElement = logWrapperRef.current;
  const scrollBottom =
    (logWrapperElement?.scrollTop ?? 0) +
    (logWrapperElement?.clientHeight ?? 0);
  const scrollHeight = logWrapperElement?.scrollHeight ?? 0;
  const scrollDistanceToBottom = Math.abs(scrollBottom - scrollHeight);
  const shouldScrollToBottom = scrollDistanceToBottom < 10;

  const sortedLogs = useMemo(
    () =>
      logs
        // Exclude logs that indicate which our backend called the emulator
        // To reduce unnecessary clutter
        .filter((log) => {
          const isBackendCallLog = /[A-Za-z]+ called/.test(log.data);
          return !isBackendCallLog;
        })
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        ),
    [logs]
  );
  const { searchTerm, setPlaceholder } = useSearch(SEARCH_CONTEXT_NAME);
  const { data: processes } = useGetPollingProcesses();
  const isCapturingProcessLogs = processes.some(
    (process) =>
      CommonUtils.isEmulatorProcess(process) ||
      CommonUtils.isDevWalletProcess(process)
  );
  const { filteredData } = useFilterData(sortedLogs, searchTerm);
  const mouseEvent = useMouseMove(trackMousePosition);

  const scrollToBottom = (smooth = true) => {
    if (!shouldScrollToBottom) {
      return;
    }
    if (logWrapperRef.current) {
      const options: ScrollToOptions = {
        top: logWrapperRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      };
      logWrapperRef.current.scrollTo(options);
    }
  };

  useEffect(() => {
    setPlaceholder("Search logs");
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logDrawerSize, shouldScrollToBottom]);

  useEffect(() => {
    const hasErrorLogs = logs
      .filter((log) => log.isNew)
      .some((log) => log.source === ProcessOutputSource.OUTPUT_SOURCE_STDERR);
    if (hasErrorLogs) {
      toast.error("Some process encountered errors", {
        duration: 4000,
      });
    }

    scrollToBottom();
  }, [logs]);

  const onCaretChange = useCallback((state) => {
    if (state === false) {
      changeLogDrawerSize("small");
    } else {
      changeLogDrawerSize("tiny");
    }
  }, []);

  const changeLogDrawerSize = useCallback((size: LogDrawerSize) => {
    setSize(size);
    setTimeout(() => {
      scrollToBottom(false);
    }, 100);
  }, []);

  useEffect(() => {
    // ignore collapse if user moves drawer upwards
    if (!mouseEvent || mouseEvent.movementY <= 0) return;
    const bottomPosition = window.innerHeight - mouseEvent.clientY;
    // collapse if user drags drawer downwards and reaches a certain threshold
    if (bottomPosition <= 130) {
      setSize("tiny");
      setTrackMousePosition(false);
    }
  }, [mouseEvent]);

  const startPositionDrag = useCallback(() => {
    setTrackMousePosition(true);
    setSize("custom");
  }, []);

  const endPositionDrag = useCallback(() => {
    setTrackMousePosition(false);
  }, []);

  if (!isCapturingProcessLogs) {
    return null;
  }

  return (
    <div
      className={classNames(classes.root, className)}
      style={logDrawerSize === "custom" ? { top: mouseEvent?.clientY } : {}}
    >
      <VerticalDragLine
        isActive={trackMousePosition}
        startPositionDrag={startPositionDrag}
        endPositionDrag={endPositionDrag}
      />

      <div
        className={classNames(classes.header, {
          [classes.expanded]: logDrawerSize !== "tiny",
        })}
      >
        <SimpleButton
          className={classes.leftContainer}
          onClick={() => {
            if (logDrawerSize === "tiny") {
              changeLogDrawerSize("small");
            } else {
              changeLogDrawerSize("tiny");
            }
          }}
        >
          <LogsIcon />
          <span>LOGS</span>
        </SimpleButton>

        {logDrawerSize === "tiny" && (
          <div className={classes.midContainer} ref={tinyLogRef}>
            {filteredData.map((log) => (
              <LogLine key={log.id} log={log} />
            ))}
          </div>
        )}

        <div className={classes.rightContainer}>
          {logDrawerSize !== "tiny" && (
            <Search
              context={SEARCH_CONTEXT_NAME}
              className={classes.searchBox}
            />
          )}
          <div>
            {["tiny", "small", "custom"].includes(logDrawerSize) && (
              <CaretIcon
                inverted={true}
                isOpen={logDrawerSize !== "tiny"}
                className={classes.control}
                onChange={onCaretChange}
              />
            )}
            {logDrawerSize === "small" && (
              <ExpandIcon
                className={classes.control}
                onClick={() => changeLogDrawerSize("big")}
              />
            )}
            {logDrawerSize === "big" && (
              <ShrinkIcon
                className={classes.control}
                onClick={() => changeLogDrawerSize("small")}
              />
            )}
          </div>
        </div>
      </div>

      {logDrawerSize !== "tiny" && (
        <div className={classes.bigLogsContainer} ref={nonTinyLogRef}>
          {filteredData.map((log) => (
            <LogLine key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
};

function LogLine({ log }: { log: ManagedProcessOutput }) {
  return (
    <pre
      className={classes.line}
      style={
        // TODO(ui): use color from color pallet
        log.source === ProcessOutputSource.OUTPUT_SOURCE_STDERR
          ? { color: "#D02525" }
          : {}
      }
      dangerouslySetInnerHTML={{
        __html: TextUtils.formatProcessOutput(log),
      }}
    />
  );
}

type VerticalDragLineProps = {
  startPositionDrag: (e: React.MouseEvent) => void;
  endPositionDrag: (e: React.MouseEvent) => void;
  isActive?: boolean;
};

const VerticalDragLine = ({
  isActive,
  startPositionDrag,
  endPositionDrag,
}: VerticalDragLineProps) => {
  return (
    <div
      style={{
        height: 3,
        cursor: "ns-resize",
        left: 0,
        right: 0,
        top: -1.5,
        position: "absolute",
        background: isActive ? "#FFC016" : "transparent",
      }}
      onMouseDown={startPositionDrag}
      onMouseUp={endPositionDrag}
    />
  );
};

export default Logs;
