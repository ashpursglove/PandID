import { useCallback, useRef, useState, type ReactNode } from "react";

const TIP_WIDTH_PX = 256;

export interface HoverTooltipPlacement {
  top: number;
  left?: number;
  right?: number;
}

/** Position a fixed tooltip relative to a trigger rect. */
export function hoverTooltipPlacement(
  rect: DOMRect,
  placement: "right" | "below",
  tipWidth = TIP_WIDTH_PX,
): HoverTooltipPlacement {
  if (placement === "below") {
    const top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tipWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tipWidth - 8));
    return { top, left };
  }
  const placeLeft = rect.right + tipWidth + 16 > window.innerWidth;
  return {
    top: rect.top,
    left: placeLeft ? undefined : rect.right + 8,
    right: placeLeft ? window.innerWidth - rect.left + 8 : undefined,
  };
}

interface PanelProps {
  title: string;
  subtitle?: string;
  description: string;
  placement: HoverTooltipPlacement;
}

/** Styled tooltip panel — matches palette component hover tips. */
export function HoverTooltipPanel({
  title,
  subtitle,
  description,
  placement,
}: PanelProps) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 w-64 rounded-md border border-zinc-700 bg-zinc-900/95 p-2.5 text-left shadow-xl backdrop-blur"
      style={{
        top: placement.top,
        left: placement.left,
        right: placement.right,
      }}
    >
      <p className="text-xs font-semibold text-zinc-100">{title}</p>
      {subtitle && (
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-400/90">
          {subtitle}
        </p>
      )}
      <p className="mt-1 text-[11px] leading-snug text-zinc-300">{description}</p>
    </div>
  );
}

interface UseHoverTooltipOptions {
  placement?: "right" | "below";
}

/** Show / hide state for a palette-style hover tooltip on any trigger. */
export function useHoverTooltip({
  placement = "right",
}: UseHoverTooltipOptions = {}) {
  const [tip, setTip] = useState<HoverTooltipPlacement | null>(null);
  const hideTimer = useRef<number | null>(null);

  const show = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      setTip(hoverTooltipPlacement(e.currentTarget.getBoundingClientRect(), placement));
    },
    [placement],
  );

  const hide = useCallback(() => {
    hideTimer.current = window.setTimeout(() => setTip(null), 40);
  }, []);

  const dismiss = useCallback(() => setTip(null), []);

  return { tip, show, hide, dismiss };
}

interface HoverTooltipWrapProps {
  title: string;
  subtitle?: string;
  description: string;
  placement?: "right" | "below";
  children: (handlers: {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
    onFocus: (e: React.FocusEvent<HTMLElement>) => void;
    onBlur: () => void;
  }) => ReactNode;
}

/** Render-prop wrapper that attaches hover/focus handlers and draws the tip. */
export function HoverTooltipWrap({
  title,
  subtitle,
  description,
  placement = "right",
  children,
}: HoverTooltipWrapProps) {
  const { tip, show, hide, dismiss } = useHoverTooltip({ placement });

  return (
    <>
      {children({
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: (e) => show(e as unknown as React.MouseEvent<HTMLElement>),
        onBlur: dismiss,
      })}
      {tip && (
        <HoverTooltipPanel
          title={title}
          subtitle={subtitle}
          description={description}
          placement={tip}
        />
      )}
    </>
  );
}
