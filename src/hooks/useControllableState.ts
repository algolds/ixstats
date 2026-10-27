import { useCallback, useState } from "react";

interface UseControllableStateParams<T> {
  prop?: T;
  defaultProp?: T;
  onChange?: (state: T) => void;
}

/**
 * Native controlled/uncontrolled state manager replacing @radix-ui/react-use-controllable-state.
 */
export function useControllableState<T>({
  prop,
  defaultProp,
  onChange = () => {},
}: UseControllableStateParams<T>): [T, (state: React.SetStateAction<T>) => void] {
  const [uncontrolledProp, setUncontrolledProp] = useState<T | undefined>(defaultProp);
  const isControlled = prop !== undefined;
  const value = isControlled ? (prop as T) : (uncontrolledProp as T);

  const setValue = useCallback(
    (nextState: React.SetStateAction<T>) => {
      const setter = nextState as (prevState: T) => T;
      const nextValue = typeof nextState === "function" ? setter(value) : nextState;

      if (!isControlled) {
        setUncontrolledProp(nextValue);
      }
      onChange(nextValue);
    },
    [isControlled, onChange, value]
  );

  return [value, setValue];
}
