"use client";
/** A lore card's category, then one of that category's fixed subcategories. */
import { Label } from "~/components/ui/label";
import { ValueSelect } from "~/components/ui/value-select";
import { BROWSABLE_CATEGORIES, isValidLoreCategory } from "~/lib/cards/category-enums";
import { UNCATEGORISED_LABEL, getCategoryLabel } from "~/lib/cards/category-theme";
import { subcategoriesOf, type CategoryChoice } from "~/lib/cards/category-taxonomy";

/** The value of "Uncategorised" and of "No subcategory": a select cannot hold null. */
const NONE = "__none";

const CATEGORY_OPTIONS = BROWSABLE_CATEGORIES.map(
  (category) => [category, getCategoryLabel(category)] as const
);

interface CategoryPickerProps {
  /** Prefixes the two selects' ids, so two pickers on one page do not clash. */
  idPrefix: string;
  value: CategoryChoice;
  onChange: (next: CategoryChoice) => void;
  allowUncategorised?: boolean;
  disabled?: boolean;
}

export function CategoryPicker({
  idPrefix,
  value,
  onChange,
  allowUncategorised = true,
  disabled,
}: CategoryPickerProps) {
  const categoryOptions = allowUncategorised
    ? [[NONE, UNCATEGORISED_LABEL] as const, ...CATEGORY_OPTIONS]
    : CATEGORY_OPTIONS;
  const subcategories = value.category === null ? [] : subcategoriesOf(value.category);
  const pickCategory = (next: string) =>
    onChange({ category: isValidLoreCategory(next) ? next : null, subcategory: null });
  const pickSubcategory = (next: string) =>
    onChange({ category: value.category, subcategory: next === NONE ? null : next });

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-category`}>Category</Label>
        <ValueSelect
          id={`${idPrefix}-category`}
          value={value.category ?? (allowUncategorised ? NONE : undefined)}
          onValueChange={pickCategory}
          options={categoryOptions}
          placeholder="Pick a category"
          disabled={disabled}
        />
      </div>
      {subcategories.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-subcategory`}>Subcategory</Label>
          <ValueSelect
            id={`${idPrefix}-subcategory`}
            value={value.subcategory ?? NONE}
            onValueChange={pickSubcategory}
            options={[
              [NONE, "No subcategory"] as const,
              ...subcategories.map((s) => [s.id, s.label] as const),
            ]}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}
