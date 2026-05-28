"use client";

import Color from "color";
import { PipetteIcon } from "lucide-react";
import { Slider } from "radix-ui";
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

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

const ColorPickerContext = createContext<ColorPickerContextValue | undefined>(
  undefined
);

export const useColorPicker = () => {
  const context = useContext(ColorPickerContext);

  if (!context) {
    throw new Error("useColorPicker must be used within a ColorPickerProvider");
  }

  return context;
};

export type ColorPickerProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  value?: Parameters<typeof Color>[0];
  defaultValue?: Parameters<typeof Color>[0];
  onChange?: (value: [number, number, number, number]) => void;
};

export const ColorPicker = ({
  value,
  defaultValue = "#000000",
  onChange,
  className,
  ...props
}: ColorPickerProps) => {
  const selectedColor = Color(value);
  const defaultColor = Color(defaultValue);

  const [hue, setHue] = useState(
    selectedColor.hue() || defaultColor.hue() || 0
  );
  const [saturation, setSaturation] = useState(
    selectedColor.saturationl() || defaultColor.saturationl() || 100
  );
  const [lightness, setLightness] = useState(
    selectedColor.lightness() || defaultColor.lightness() || 50
  );
  const [alpha, setAlpha] = useState(
    selectedColor.alpha() * 100 || defaultColor.alpha() * 100
  );
  const [mode, setMode] = useState("hex");

  // Keep latest onChange in a ref to avoid infinite rendering loop when parent onChange is not memoized
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }); // runs on every render to keep ref updated

  // Update color when controlled value changes
  useEffect(() => {
    if (value) {
      try {
        const color = Color(value);
        const hsl = color.hsl().object();
        const nextHue = hsl.h || 0;
        const nextSat = hsl.s || 0;
        const nextLt = hsl.l || 0;
        const nextAlpha = color.alpha() * 100;

        // Check if values have actually changed before updating state
        // to prevent conversion/precision feedback loops
        if (
          Math.abs(hue - nextHue) > 0.01 ||
          Math.abs(saturation - nextSat) > 0.01 ||
          Math.abs(lightness - nextLt) > 0.01 ||
          Math.abs(alpha - nextAlpha) > 0.01
        ) {
          setHue(nextHue);
          setSaturation(nextSat);
          setLightness(nextLt);
          setAlpha(nextAlpha);
        }
      } catch (err) {
        console.error("Invalid color value passed to ColorPicker:", value, err);
      }
    }
  }, [value, hue, saturation, lightness, alpha]);

  // Notify parent of changes
  useEffect(() => {
    if (onChangeRef.current) {
      const color = Color.hsl(hue, saturation, lightness).alpha(alpha / 100);
      const rgba = color.rgb().array();

      onChangeRef.current([rgba[0], rgba[1], rgba[2], alpha / 100]);
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
      <div
        className={cn("flex size-full flex-col gap-4", className)}
        {...props}
      />
    </ColorPickerContext.Provider>
  );
};

export type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerSelection = memo(
  ({ className, ...props }: ColorPickerSelectionProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [positionX, setPositionX] = useState(0);
    const [positionY, setPositionY] = useState(0);
    const { hue, saturation, lightness, setSaturation, setLightness } = useColorPicker();

    // Sync pointer position when saturation or lightness change externally
    useEffect(() => {
      if (!isDragging) {
        const x = saturation / 100;
        const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x);
        const y = topLightness > 0 ? 1 - lightness / topLightness : 1;
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
        const x = Math.max(
          0,
          Math.min(1, (event.clientX - rect.left) / rect.width)
        );
        const y = Math.max(
          0,
          Math.min(1, (event.clientY - rect.top) / rect.height)
        );
        setPositionX(x);
        setPositionY(y);
        setSaturation(x * 100);
        const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x);
        const lightness = topLightness * (1 - y);

        setLightness(lightness);
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
          className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white"
          style={{
            left: `${positionX * 100}%`,
            top: `${positionY * 100}%`,
            boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
          }}
        />
      </div>
    );
  }
);

ColorPickerSelection.displayName = "ColorPickerSelection";

export type ColorPickerHueProps = ComponentProps<typeof Slider.Root>;

export const ColorPickerHue = ({
  className,
  ...props
}: ColorPickerHueProps) => {
  const { hue, setHue } = useColorPicker();

  return (
    <Slider.Root
      className={cn("relative flex h-4 w-full touch-none", className)}
      max={360}
      onValueChange={([hue]) => setHue(hue)}
      step={1}
      value={[hue]}
      {...props}
    >
      <Slider.Track className="relative my-0.5 h-3 w-full grow rounded-full bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]">
        <Slider.Range className="absolute h-full" />
      </Slider.Track>
      <Slider.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </Slider.Root>
  );
};

export type ColorPickerAlphaProps = ComponentProps<typeof Slider.Root>;

export const ColorPickerAlpha = ({
  className,
  ...props
}: ColorPickerAlphaProps) => {
  const { alpha, setAlpha } = useColorPicker();

  return (
    <Slider.Root
      className={cn("relative flex h-4 w-full touch-none", className)}
      max={100}
      onValueChange={([alpha]) => setAlpha(alpha)}
      step={1}
      value={[alpha]}
      {...props}
    >
      <Slider.Track className="relative my-0.5 h-3 w-full grow rounded-full bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] bg-center bg-repeat-x dark:bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALklEQVR4nGP8+vWrCAMewM3N/QafPBM+SWLAqAGDwQBGQgoIpZOB98KoAVQwAADxzQcSVIRCfQAAAABJRU5ErkJggg==')]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent to-black/50 dark:to-white/50" />
        <Slider.Range className="absolute h-full rounded-full bg-transparent" />
      </Slider.Track>
      <Slider.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </Slider.Root>
  );
};

export type ColorPickerEyeDropperProps = ComponentProps<typeof Button>;

export const ColorPickerEyeDropper = ({
  className,
  ...props
}: ColorPickerEyeDropperProps) => {
  const { setHue, setSaturation, setLightness, setAlpha } = useColorPicker();

  const handleEyeDropper = async () => {
    try {
      // @ts-expect-error - EyeDropper API is experimental
      const eyeDropper = new EyeDropper();
      const result = await eyeDropper.open();
      const color = Color(result.sRGBHex);
      const [h, s, l] = color.hsl().array();

      setHue(h);
      setSaturation(s);
      setLightness(l);
      setAlpha(100);
    } catch (error) {
      console.error("EyeDropper failed:", error);
    }
  };

  return (
    <Button
      className={cn("shrink-0 text-muted-foreground", className)}
      onClick={handleEyeDropper}
      size="icon"
      type="button"
      variant="outline"
      {...props}
    >
      <PipetteIcon size={16} />
    </Button>
  );
};

export type ColorPickerOutputProps = ComponentProps<typeof SelectTrigger>;

const formats = ["hex", "rgb", "css", "hsl"];

export const ColorPickerOutput = ({
  className,
  ...props
}: ColorPickerOutputProps) => {
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
          "h-8 w-[3.25rem] rounded-l-none bg-secondary px-2 text-xs shadow-none",
          className
        )}
      />
      <span className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground text-xs">
        %
      </span>
    </div>
  );
};

export type ColorPickerFormatProps = HTMLAttributes<HTMLDivElement>;

export const ColorPickerFormat = ({
  className,
  ...props
}: ColorPickerFormatProps) => {
  const { hue, saturation, lightness, alpha, mode } = useColorPicker();
  const color = Color.hsl(hue, saturation, lightness, alpha / 100);

  if (mode === "hex") {
    const hex = color.hex();

    return (
      <div
        className={cn(
          "-space-x-px relative flex w-full items-center rounded-md shadow-sm",
          className
        )}
        {...props}
      >
        <Input
          className="h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none"
          readOnly
          type="text"
          value={hex}
        />
        <PercentageInput value={alpha} />
      </div>
    );
  }

  if (mode === "rgb") {
    const rgb = color
      .rgb()
      .array()
      .map((value) => Math.round(value));

    return (
      <div
        className={cn(
          "-space-x-px flex items-center rounded-md shadow-sm",
          className
        )}
        {...props}
      >
        {rgb.map((value, index) => (
          <Input
            className={cn(
              "h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none",
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
    const rgb = color
      .rgb()
      .array()
      .map((value) => Math.round(value));

    return (
      <div className={cn("w-full rounded-md shadow-sm", className)} {...props}>
        <Input
          className="h-8 w-full bg-secondary px-2 text-xs shadow-none"
          readOnly
          type="text"
          value={`rgba(${rgb.join(", ")}, ${alpha}%)`}
          {...props}
        />
      </div>
    );
  }

  if (mode === "hsl") {
    const hsl = color
      .hsl()
      .array()
      .map((value) => Math.round(value));

    return (
      <div
        className={cn(
          "-space-x-px flex items-center rounded-md shadow-sm",
          className
        )}
        {...props}
      >
        {hsl.map((value, index) => (
          <Input
            className={cn(
              "h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none",
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
            "w-10 h-9 p-0 border border-border/40 rounded-md shrink-0 relative overflow-hidden",
            disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          )}
          title="Pick Color"
          disabled={disabled}
        >
          <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] bg-center -z-10" />
          <div
            className="w-full h-full"
            style={{ backgroundColor: value || "transparent" }}
          />
        </PopoverTrigger>
        {!disabled && (
          <PopoverContent className="w-64 p-3 bg-popover border-border/50 text-foreground">
            <ColorPicker
              value={value || "#000000"}
              onChange={(rgbaArray) => {
                let colorStr = "#000000";
                if (rgbaArray[3] < 1) {
                  colorStr = `rgba(${rgbaArray[0]}, ${rgbaArray[1]}, ${rgbaArray[2]}, ${rgbaArray[3]})`;
                } else {
                  const r = rgbaArray[0].toString(16).padStart(2, "0");
                  const g = rgbaArray[1].toString(16).padStart(2, "0");
                  const b = rgbaArray[2].toString(16).padStart(2, "0");
                  colorStr = `#${r}${g}${b}`;
                }
                onChange(colorStr);
              }}
            >
              <ColorPickerSelection className="h-32 mb-2" />
              <div className="space-y-1 mb-2">
                <Label className="text-[10px] text-muted-foreground">Hue</Label>
                <ColorPickerHue />
              </div>
              <div className="space-y-1 mb-2">
                <Label className="text-[10px] text-muted-foreground">Alpha</Label>
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
        className="font-mono text-xs h-9 bg-background border-border/40 text-foreground"
      />
    </div>
  );
}
