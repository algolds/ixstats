import { getPrimeMeridianWeather } from "./weather";

describe("getPrimeMeridianWeather", () => {
  it("calculates Summer weather for August dates", () => {
    const date = new Date("2042-08-22T14:30:00Z");
    const weather = getPrimeMeridianWeather(date);

    expect(weather.season).toBe("Summer");
    expect(weather.tempC).toBeGreaterThan(15);
    expect(weather.diurnalPhase).toBe("Afternoon");
    expect(weather.summary).toContain("Prime Meridian");
  });

  it("calculates Winter weather for January dates", () => {
    const date = new Date("2042-01-15T04:00:00Z");
    const weather = getPrimeMeridianWeather(date);

    expect(weather.season).toBe("Winter");
    expect(weather.tempC).toBeLessThan(10);
    expect(weather.diurnalPhase).toBe("Night");
  });

  it("calculates Spring weather for April dates", () => {
    const date = new Date("2042-04-10T10:00:00Z");
    const weather = getPrimeMeridianWeather(date);

    expect(weather.season).toBe("Spring");
    expect(weather.diurnalPhase).toBe("Morning");
  });
});
