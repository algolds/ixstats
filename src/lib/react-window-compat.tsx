"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { List, useListRef } from "react-window";

type Align = "auto" | "start" | "end" | "center" | "smart";

type ScrollDirection = "forward" | "backward";

interface ScrollEvent {
  scrollDirection: ScrollDirection;
  scrollOffset: number;
  scrollUpdateWasRequested: boolean;
}

export interface VirtualListHandle {
  scrollTo: (scrollOffset: number) => void;
  scrollToItem: (index: number, align?: Align) => void;
  resetAfterIndex: (index: number, shouldForceUpdate?: boolean) => void;
}

interface BaseListProps<ItemData = any> {
  height: number;
  width: number | string;
  itemCount: number;
  overscanCount?: number;
  className?: string;
  layout?: "vertical" | "horizontal";
  itemData?: ItemData;
  onScroll?: (props: ScrollEvent) => void;
  children: (props: {
    index: number;
    style: React.CSSProperties;
    data: ItemData;
  }) => React.ReactNode;
}

export interface FixedSizeListProps<ItemData = any> extends BaseListProps<ItemData> {
  itemSize: number;
}

export interface VariableSizeListProps<ItemData = any> extends BaseListProps<ItemData> {
  itemSize: (index: number, data: ItemData) => number;
}

type InternalRowProps<ItemData> = {
  itemRenderer: FixedSizeListProps<ItemData>["children"];
  itemData: ItemData;
  resetVersion: number;
};

const alignMap: Record<Align, Align | "auto"> = {
  auto: "auto",
  smart: "smart",
  start: "start",
  end: "end",
  center: "center",
};

function createCompatList<ItemData, Mode extends "fixed" | "variable">(mode: Mode) {
  type Props = Mode extends "fixed"
    ? FixedSizeListProps<ItemData>
    : VariableSizeListProps<ItemData>;

  const CompatList = forwardRef<VirtualListHandle, Props>((incomingProps, ref) => {
    const {
      height,
      width,
      itemCount,
      overscanCount = 2,
      className,
      layout = "vertical",
      itemData,
      onScroll,
      children,
      style: incomingStyle,
      ...rest
    } = incomingProps as BaseListProps<ItemData> & {
      style?: React.CSSProperties;
    };

    const listRef = useListRef(null);
    const scrollOffsetRef = useRef(0);
    const listStyle = useMemo(
      () => ({
        ...(incomingStyle ?? {}),
        height,
        width,
      }),
      [incomingStyle, height, width]
    );
    const isHorizontal = layout === "horizontal";
    const [resetVersion, setResetVersion] = useState(0);
    const pendingRestoreRef = useRef(false);
    const previousOffsetRef = useRef(0);

    useImperativeHandle(
      ref,
      () => ({
        scrollTo: (offset: number) => {
          const element = listRef.current?.element;
          if (!element) return;
          if (isHorizontal) {
            element.scrollTo({ left: offset });
          } else {
            element.scrollTo({ top: offset });
          }
        },
        scrollToItem: (index: number, align: Align = "auto") => {
          listRef.current?.scrollToRow({
            index,
            align: alignMap[align],
            behavior: "auto",
          });
        },
        resetAfterIndex: () => {
          const element = listRef.current?.element;
          if (element) {
            scrollOffsetRef.current = isHorizontal ? element.scrollLeft : element.scrollTop;
          }
          pendingRestoreRef.current = true;
          setResetVersion((version) => version + 1);
        },
      }),
      [isHorizontal]
    );

    useEffect(() => {
      if (!onScroll) return;
      const element = listRef.current?.element;
      if (!element) return;

      const handler = () => {
        const currentOffset = isHorizontal ? element.scrollLeft : element.scrollTop;
        const direction: ScrollDirection =
          currentOffset > previousOffsetRef.current ? "forward" : "backward";
        previousOffsetRef.current = currentOffset;

        onScroll({
          scrollDirection: direction,
          scrollOffset: currentOffset,
          scrollUpdateWasRequested: false,
        });
      };

      element.addEventListener("scroll", handler);
      return () => {
        element.removeEventListener("scroll", handler);
      };
    }, [onScroll, isHorizontal]);

    useEffect(() => {
      if (!pendingRestoreRef.current) return;
      const element = listRef.current?.element;
      if (element) {
        if (isHorizontal) {
          element.scrollTo({ left: scrollOffsetRef.current });
        } else {
          element.scrollTo({ top: scrollOffsetRef.current });
        }
      }
      pendingRestoreRef.current = false;
    });

    const RowComponent = useCallback(
      ({
        index,
        style: rowStyle,
        ariaAttributes,
      }: {
        index: number;
        style: React.CSSProperties;
        ariaAttributes: Record<string, unknown>;
      }) => {
        const rendered = children({
          index,
          style: rowStyle,
          data: itemData as ItemData,
        });
        if (React.isValidElement(rendered)) {
          const existingStyle = (rendered.props as { style?: React.CSSProperties }).style ?? {};
          const mergedStyle = {
            ...existingStyle,
            ...rowStyle,
          };
          return React.cloneElement(
            rendered as React.ReactElement<{ style?: React.CSSProperties }>,
            {
              ...(ariaAttributes as Record<string, unknown>),
              style: mergedStyle,
            }
          );
        }
        return (
          <div {...ariaAttributes} style={rowStyle}>
            {rendered}
          </div>
        );
      },
      [children, itemData]
    );

    const rowHeight =
      mode === "fixed"
        ? (incomingProps as FixedSizeListProps<ItemData>).itemSize
        : (index: number) =>
            (incomingProps as VariableSizeListProps<ItemData>).itemSize(
              index,
              itemData as ItemData
            );

    const forwardedProps = useMemo(() => {
      const result: Record<string, unknown> = { ...rest };
      delete result.itemSize;
      delete result.children;
      delete result.layout;
      delete result.itemCount;
      delete result.itemData;
      delete result.onScroll;
      delete result.height;
      delete result.width;
      delete result.overscanCount;
      delete result.className;
      delete result.style;
      return result;
    }, [rest]);

    return (
      <List
        key={resetVersion}
        listRef={listRef}
        rowCount={itemCount}
        rowHeight={typeof rowHeight === "function" ? (index) => rowHeight(index) : rowHeight}
        overscanCount={overscanCount}
        className={className}
        style={listStyle}
        rowComponent={RowComponent}
        rowProps={{} as any}
        {...forwardedProps}
      />
    );
  });

  CompatList.displayName = mode === "fixed" ? "FixedSizeListCompat" : "VariableSizeListCompat";

  return CompatList;
}

export const FixedSizeList = createCompatList("fixed");
export const VariableSizeList = createCompatList("variable");

export type FixedSizeListHandle = VirtualListHandle;
export type VariableSizeListHandle = VirtualListHandle;
