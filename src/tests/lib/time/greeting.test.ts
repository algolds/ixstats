/** @jest-environment node */
import { greetingForHour } from "~/lib/time/greeting";

it.each([
  [4, "Good night"],
  [5, "Good morning"],
  [11, "Good morning"],
  [12, "Good afternoon"],
  [16, "Good afternoon"],
  [17, "Good evening"],
  [20, "Good evening"],
  [21, "Good night"],
])("hour %i greets %s", (hour, greeting) => {
  expect(greetingForHour(hour)).toBe(greeting);
});
