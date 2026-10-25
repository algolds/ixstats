/**
 * Realm time D2b: procurement. An order is quoted as the server prices it (imports +15% and longer), delivered on
 * the realm calendar, refused when domestic industry lacks the technology; open orders show payments and slips,
 * cancelling warns that paid money is sunk, and a paused realm's delivery countdown reads "Paused".
 */
import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";
import { OrderSheet } from "~/components/mycountry/domains/defense/procurement/OrderSheet";
import { OpenOrders } from "~/components/mycountry/domains/defense/procurement/OpenOrders";
import { CatalogBrowser } from "~/components/mycountry/domains/defense/procurement/CatalogBrowser";
import { MONTH_MS } from "~/lib/military/model";
import type { EquipmentPreset } from "~/lib/military/player-catalog";
import type { ProcurementOrderRow } from "~/hooks/useDefenseConsole";
import { ownerDefense } from "~/tests/fixtures/defense-overview";
import { CLOCK_NOW, pausedReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

beforeAll(stubResizeObserver);

const tank: EquipmentPreset = {
  key: "TANK",
  type: "vehicle",
  name: "Leopard 2A7",
  category: "Main battle tank",
  catalogCategory: "vehicle",
  subcategory: "tank",
  era: "CONTEMPORARY",
  acquisitionCost: 10e6,
};
const frigate: EquipmentPreset = {
  key: "FFG",
  type: "ship",
  name: "Future frigate",
  category: "Frigate",
  catalogCategory: "naval",
  subcategory: "frigate",
  era: "NEXT_GEN",
  acquisitionCost: 800e6,
};

function renderSheet(item: EquipmentPreset) {
  const onPlace = jest.fn();
  render(
    <OrderSheet
      item={item}
      overview={ownerDefense()}
      reader={sixTimesReader()}
      nowClockMs={CLOCK_NOW}
      pending={false}
      onOpenChange={jest.fn()}
      onPlace={onPlace}
    />
  );
  return onPlace;
}

const quote = () => within(screen.getByLabelText("Order quote"));

describe("ordering", () => {
  it("quotes a domestic order and places it for a branch that can hold it", () => {
    const onPlace = renderSheet(tank);
    fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "4" } });
    expect(quote().getByText("$40.0M")).toBeTruthy();
    expect(quote().getByText("$6.0M")).toBeTruthy();
    expect(quote().getByText(/for 24 months/)).toBeTruthy();
    expect(quote().getByText(/\d+ (Thaw|Frostfall) \d+ AE \(in /)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Order for $40.0M" }));
    expect(onPlace).toHaveBeenCalledWith({ branchId: "b-land", catalogKey: "TANK", quantity: 4, source: "domestic" });
  });

  it("imports at +15% with a longer lead time", () => {
    renderSheet(tank);
    fireEvent.click(screen.getByRole("radio", { name: "Import" }));
    expect(quote().getAllByText("$11.5M")).toHaveLength(2);
    expect(quote().getByText(/for 36 months/)).toBeTruthy();
  });

  it("refuses a domestic design past the industry's frontier but allows the import", () => {
    const onPlace = renderSheet(frigate);
    expect(screen.getByRole("alert").textContent).toMatch(/newer than your industry can build/);
    expect((screen.getByRole("button", { name: /^Order for/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Import" }));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Order for/ }));
    expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({ branchId: "b-sea", source: "import" }));
  });

  it("lists only what the nation's branches can hold, marking import-only designs", () => {
    render(
      <CatalogBrowser
        equipment={[tank, frigate, { ...tank, key: "JET", name: "Fighter", catalogCategory: "aircraft", type: "aircraft" }]}
        domains={["land", "sea"]}
        accessibleYear={2030}
        canEdit
        isLoading={false}
        onOrder={jest.fn()}
      />
    );
    expect(screen.getByText("Leopard 2A7")).toBeTruthy();
    expect(screen.getByText("Import only")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Sea" }));
    expect(screen.queryByText("Leopard 2A7")).toBeNull();
    expect(screen.getByText("Future frigate")).toBeTruthy();
  });
});

const order = (overrides: Partial<ProcurementOrderRow> = {}): ProcurementOrderRow =>
  ({
    id: "o1",
    countryId: "c1",
    branchId: "b-land",
    catalogKey: "TANK",
    quantity: 4,
    unitCost: 10.1e6,
    unitRealValue: 10e6,
    source: "domestic",
    leadMonths: 24,
    designYear: 2016,
    orderedClockMs: CLOCK_NOW - 6 * MONTH_MS,
    expectedClockMs: CLOCK_NOW + 20 * MONTH_MS,
    paidSoFar: 12e6,
    status: "ordered",
    deliveredClockMs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Leopard 2A7",
    imageUrl: null,
    totalCost: 40.4e6,
    ...overrides,
  }) as ProcurementOrderRow;

describe("open orders", () => {
  const renderOrders = (reader = sixTimesReader(), canEdit = true) => {
    const onCancel = jest.fn();
    render(
      <OpenOrders
        orders={[order()]}
        branchNames={new Map([["b-land", "Royal Army"]])}
        reader={reader}
        nowClockMs={CLOCK_NOW}
        canEdit={canEdit}
        onCancel={onCancel}
      />
    );
    return onCancel;
  };

  it("shows payments, the slip and the delivery date", () => {
    renderOrders();
    const row = screen.getByTestId("open-order");
    expect(row.textContent).toMatch(/Slipped 2 months/);
    expect(row.textContent).toMatch(/\$12(\.0)?M of \$40.4M paid/);
    expect(row.textContent).toMatch(/Royal Army · delivery \d+ (Thaw|Frostfall) \d+ AE \(in /);
  });

  it("warns that paid money is sunk before cancelling", () => {
    const onCancel = renderOrders();
    fireEvent.click(screen.getByRole("button", { name: "Cancel the order for Leopard 2A7" }));
    expect(screen.getByText(/The \$12(\.0)?M paid so far is sunk/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel order" }));
    expect(onCancel).toHaveBeenCalledWith("o1");
  });

  it("reads Paused while the realm's clock is stopped, and offers no cancel in the preview", () => {
    renderOrders(pausedReader(), false);
    expect(screen.getByTestId("open-order").textContent).toMatch(/\(Paused\)/);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
