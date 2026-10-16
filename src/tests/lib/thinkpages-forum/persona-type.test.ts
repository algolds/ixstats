import { personaTypeOf } from "~/lib/thinkpages-forum/persona-type";

describe("personaTypeOf", () => {
  it.each(["government", "media", "citizen"] as const)("keeps %s", (type) => {
    expect(personaTypeOf(type)).toBe(type);
  });

  it.each(["personal", "bot", "", null, undefined])("has no type for %p", (value) => {
    expect(personaTypeOf(value)).toBeNull();
  });
});
