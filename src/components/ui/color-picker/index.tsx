"use client";

import { ColorPicker as PipetteIcon } from "iconoir-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { cn } from "~/lib/utils/cn";

// ─── Color Math Helpers (Canonical ~/lib/color) ────────────────────────────────
import { hslToRgb, rgbToHsl, hslToHex, parseColorToHsl } from "~/lib/color";
export { hslToRgb, rgbToHsl, hslToHex, parseColorToHsl };

// ─── ColorPicker Context & Components ─────────────────────────────────────────

type ColorPickerContextValue = {
  hue: number;
  saturation: number;
  lightness: number;
  alpha: number;
  mode: string;
  setHue: (hue: number) => void;
  setSaturation: (saturation: number) => void;
  setLightness: (lightness: number) => void;
  setAlpha: (alpha: number) => void;
  setMode: (mode: string) => void;
};

const ColorPickerContext = createContext<ColorPickerContextValue | undefined>(undefined);

export const useColorPicker = () => {
  const context = useContext(ColorPickerContext);

  if (!context) {
    throw new Error("useColorPicker must be used within a ColorPickerProvider");
  }

  return context;
};

export type ColorPickerProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value?: any;
  defaultValue?: any;
  onChange?: (value: [number, number, number, number]) => void;
};

export const ColorPicker = ({
  value,
  defaultValue = "#000000",
  onChange,
  className,
  ...props
}: ColorPickerProps) => {
  const parsed = parseColorToHsl(value || defaultValue);

  const [hue, setHue] = useState(parsed.h);
  const [saturation, setSaturation] = useState(parsed.s);
  const [lightness, setLightness] = useState(parsed.l);
  const [alpha, setAlpha] = useState(parsed.a * 100);
  const [mode, setMode] = useState("hex");

  const lastValueRef = useRef(value);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Update color when controlled value changes
  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value;
      if (value) {
        const next = parseColorToHsl(value);
        const currentRgb = hslToRgb(hue, saturation, lightness);
        const incomingRgb = hslToRgb(next.h, next.s, next.l);

        if (
          currentRgb[0] === incomingRgb[0] &&
          currentRgb[1] === incomingRgb[1] &&
          currentRgb[2] === incomingRgb[2] &&
          Math.abs(next.a - alpha / 100) < 0.01
        ) {
          return;
        }

        // oxlint-disable-next-line
        setHue(next.h);
        setSaturation(next.s);
        setLightness(next.l);
        setAlpha(next.a * 100);
      }
    }
  }, [value, hue, saturation, lightness, alpha]);

  const isMountedRef = useRef(false);

  // Notify parent of changes
  useEffect(() => {
    if (isMountedRef.current) {
      if (onChangeRef.current) {
        const [r, g, b] = hslToRgb(hue, saturation, lightness);
        const a = alpha / 100;

        let colorStr = "#000000";
        if (alpha < 100) {
          colorStr = `rgba(${r}, ${g}, ${b}, ${a})`;
        } else {
          colorStr = hslToHex(hue, saturation, lightness);
        }

        lastValueRef.current = colorStr;
        onChangeRef.current([r, g, b, a]);
      }
    } else {
      isMountedRef.current = true;
    }
  }, [hue, saturation, lightness, alpha]);

  return (
    <ColorPickerContext.Provider
      value={{
        hue,
        saturation,
        lightness,
        alpha,
        mode,
        setHue,
        setSaturation,
        setLightness,
        setAlpha,
        setMode,
      }}
    >
      <div className={cn("flex size-full flex-col gap-4", className)} {...props} />
    </ColorPickerContext.Provider>
  );
};

export type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerSelection = memo(({ className, ...props }: ColorPickerSelectionProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);
  const { hue, saturation, lightness, setSaturation, setLightness } = useColorPicker();

  useEffect(() => {
    if (!isDragging) {
      const x = saturation / 100;
      const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x);
      const y = topLightness > 0 ? 1 - lightness / topLightness : 1;
      // oxlint-disable-next-line
      setPositionX(x);
      setPositionY(Math.max(0, Math.min(1, y)));
    }
  }, [saturation, lightness, isDragging]);

  const backgroundGradient = useMemo(() => {
    return `linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0)),
            linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)),
            hsl(${hue}, 100%, 50%)`;
  }, [hue]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!(isDragging && containerRef.current)) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      setPositionX(x);
      setPositionY(y);
      setSaturation(x * 100);
      const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x);
      const calculatedLightness = topLightness * (1 - y);

      setLightness(calculatedLightness);
    },
    [isDragging, setSaturation, setLightness]
  );

  useEffect(() => {
    const handlePointerUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, handlePointerMove]);

  return (
    <div
      className={cn("relative size-full cursor-crosshair rounded", className)}
      onPointerDown={(e) => {
        e.preventDefault();
        setIsDragging(true);
        handlePointerMove(e.nativeEvent);
      }}
      ref={containerRef}
      style={{
        background: backgroundGradient,
      }}
      {...props}
    >
      <div
        className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
        style={{
          left: `${positionX * 100}%`,
          top: `${positionY * 100}%`,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
});

ColorPickerSelection.displayName = "ColorPickerSelection";

export type ColorPickerHueProps = ComponentProps<typeof SliderPrimitive.Root>;

export const ColorPickerHue = ({ className, ...props }: ColorPickerHueProps) => {
  const { hue, setHue } = useColorPicker();

  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-4 w-full touch-none", className)}
      max={360}
      onValueChange={([val]: number[]) => val !== undefined && setHue(val)}
      step={1}
      value={[hue]}
      {...props}
    >
      <SliderPrimitive.Track className="relative my-0.5 h-3 w-full grow rounded-full bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]">
        <SliderPrimitive.Range className="absolute h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="border-primary/50 bg-background focus-visible:ring-ring block h-4 w-4 rounded-full border shadow transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
};

export type ColorPickerAlphaProps = ComponentProps<typeof SliderPrimitive.Root>;

export const ColorPickerAlpha = ({ className, ...props }: ColorPickerAlphaProps) => {
  const { alpha, setAlpha } = useColorPicker();

  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-4 w-full touch-none", className)}
      max={100}
      onValueChange={([val]: number[]) => val !== undefined && setAlpha(val)}
      step={1}
      value={[alpha]}
      {...props}
    >
      <SliderPrimitive.Track className="relative my-0.5 h-3 w-full grow rounded-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] bg-center bg-repeat-x dark:bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALklEQVR4nGP8+vWrCAMewM3N/QafPBM+SWLAqAGDwQBGQgoIpZOB98KoAVQwAADxzQcSVIRCfQAAAABJRU5ErkJggg==')]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent to-black/50 dark:to-white/50" />
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-transparent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="border-primary/50 bg-background focus-visible:ring-ring block h-4 w-4 rounded-full border shadow transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50" />
    </SliderPrimitive.Root>
  );
};

export type ColorPickerEyeDropperProps = ComponentProps<typeof Button>;

export const ColorPickerEyeDropper = ({ className, ...props }: ColorPickerEyeDropperProps) => {
  const { setHue, setSaturation, setLightness, setAlpha } = useColorPicker();

  const handleEyeDropper = async () => {
    try {
      // @ts-expect-error - EyeDropper API is experimental
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      const parsed = parseColorToHsl(result.sRGBHex);

      setHue(parsed.h);
      setSaturation(parsed.s);
      setLightness(parsed.l);
      setAlpha(100);
    } catch (error) {
      console.error("EyeDropper failed:", error);
    }
  };

  return (
    <Button
      className={cn("text-muted-foreground shrink-0", className)}
      onClick={handleEyeDropper}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <PipetteIcon className="size-4" />
    </Button>
  );
};

export type ColorPickerOutputProps = ComponentProps<typeof SelectTrigger>;

const formats = ["hex", "rgb", "css", "hsl"];

// oxlint-disable-next-line eslint/no-unused-vars
export const ColorPickerOutput = ({ className, ...props }: ColorPickerOutputProps) => {
  const { mode, setMode } = useColorPicker();

  return (
    <Select onValueChange={setMode} value={mode}>
      <SelectTrigger className="h-8 w-20 shrink-0 text-xs" {...props}>
        <SelectValue placeholder="Mode" />
      </SelectTrigger>
      <SelectContent>
        {formats.map((format) => (
          <SelectItem className="text-xs" key={format} value={format}>
            {format.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

type PercentageInputProps = ComponentProps<typeof Input>;

const PercentageInput = ({ className, ...props }: PercentageInputProps) => {
  return (
    <div className="relative">
      <Input
        readOnly
        type="text"
        {...props}
        className={cn(
          "bg-secondary h-8 w-[3.25rem] rounded-l-none px-2 text-xs shadow-none",
          className
        )}
      />
      <span className="text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2 text-xs">
        %
      </span>
    </div>
  );
};

export type ColorPickerFormatProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerFormat = ({ className, ...props }: ColorPickerFormatProps) => {
  const { hue, saturation, lightness, alpha, mode } = useColorPicker();

  if (mode === "hex") {
    const hex = hslToHex(hue, saturation, lightness);

    return (
      <div
        className={cn(
          "relative flex w-full items-center -space-x-px rounded-md shadow-sm",
          className
        )}
        {...props}
      >
        <Input
          className="bg-secondary h-8 rounded-r-none px-2 text-xs shadow-none"
          readOnly
          type="text"
          value={hex}
        />
        <PercentageInput value={alpha} />
      </div>
    );
  }

  if (mode === "rgb") {
    const rgb = hslToRgb(hue, saturation, lightness);

    return (
      <div
        className={cn("flex items-center -space-x-px rounded-md shadow-sm", className)}
        {...props}
      >
        {rgb.map((value, index) => (
          <Input
            className={cn(
              "bg-secondary h-8 rounded-r-none px-2 text-xs shadow-none",
              index && "rounded-l-none",
              className
            )}
            key={index}
            readOnly
            type="text"
            value={value}
          />
        ))}
        <PercentageInput value={alpha} />
      </div>
    );
  }

  if (mode === "css") {
    const rgb = hslToRgb(hue, saturation, lightness);

    return (
      <div className={cn("w-full rounded-md shadow-sm", className)} {...props}>
        <Input
          className="bg-secondary h-8 w-full px-2 text-xs shadow-none"
          readOnly
          type="text"
          value={`rgba(${rgb.join(", ")}, ${alpha}%)`}
          {...props}
        />
      </div>
    );
  }

  if (mode === "hsl") {
    const hsl = [Math.round(hue), Math.round(saturation), Math.round(lightness)];

    return (
      <div
        className={cn("flex items-center -space-x-px rounded-md shadow-sm", className)}
        {...props}
      >
        {hsl.map((value, index) => (
          <Input
            className={cn(
              "bg-secondary h-8 rounded-r-none px-2 text-xs shadow-none",
              index && "rounded-l-none",
              className
            )}
            key={index}
            readOnly
            type="text"
            value={value}
          />
        ))}
        <PercentageInput value={alpha} />
      </div>
    );
  }

  return null;
};

export function ColorPickerInput({
  value,
  onChange,
  className,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover>
        <PopoverTrigger
          className={cn(
            "border-border/40 relative h-9 w-10 shrink-0 overflow-hidden rounded-md border p-0",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          )}
          title="Pick Color"
          disabled={disabled}
        >
          <div className="absolute inset-0 -z-10 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] bg-center" />
          <div className="h-full w-full" style={{ backgroundColor: value || "transparent" }} />
        </PopoverTrigger>
        {!disabled && (
          <PopoverContent className="bg-popover border-border/50 text-foreground w-64 p-3">
            <ColorPicker
              value={value || "#000000"}
              onChange={(rgbaArray) => {
                let colorStr = "#000000";
                if (rgbaArray[3] < 1) {
                  colorStr = `rgba(${Math.round(rgbaArray[0])}, ${Math.round(rgbaArray[1])}, ${Math.round(rgbaArray[2])}, ${rgbaArray[3]})`;
                } else {
                  const r = Math.round(rgbaArray[0]).toString(16).padStart(2, "0");
                  const g = Math.round(rgbaArray[1]).toString(16).padStart(2, "0");
                  const b = Math.round(rgbaArray[2]).toString(16).padStart(2, "0");
                  colorStr = `#${r}${g}${b}`;
                }
                onChange(colorStr);
              }}
            >
              <ColorPickerSelection className="mb-2 h-32" />
              <div className="mb-2 space-y-1">
                <Label className="text-muted-foreground text-[10px]">Hue</Label>
                <ColorPickerHue />
              </div>
              <div className="mb-2 space-y-1">
                <Label className="text-muted-foreground text-[10px]">Alpha</Label>
                <ColorPickerAlpha />
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <ColorPickerOutput />
                <ColorPickerFormat />
                <ColorPickerEyeDropper />
              </div>
            </ColorPicker>
          </PopoverContent>
        )}
      </Popover>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-background border-border/40 text-foreground h-9 font-mono text-xs"
      />
    </div>
  );
}
