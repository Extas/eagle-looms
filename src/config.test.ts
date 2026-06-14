import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConf, getConf } from "./config";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("$", () => ({
  GM_getValue: (key: string) => storage.get(key) ?? null,
  GM_setValue: (key: string, value: string) => {
    storage.set(key, value);
  },
}));

const CONFIG_KEY = "ehvh_cfg_";

describe("config migrations", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("migrates old built-in Eagle folder presets to the site/date default", () => {
    const config = defaultConf();
    config.configPatchVersion = 11;
    config.eagleFolderPreset = "gallery";
    config.eagleFolderPath = "Eagle Looms/{site}/{gallery}";
    storage.set(CONFIG_KEY, JSON.stringify(config));

    const migrated = getConf();

    expect(migrated.configPatchVersion).toBe(12);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("keeps truly custom Eagle folder paths during the site/date migration", () => {
    const config = defaultConf();
    config.configPatchVersion = 11;
    config.eagleFolderPreset = "custom";
    config.eagleFolderPath = "Eagle Looms/{site}/curated";
    storage.set(CONFIG_KEY, JSON.stringify(config));

    const migrated = getConf();

    expect(migrated.configPatchVersion).toBe(12);
    expect(migrated.eagleFolderPreset).toBe("custom");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/curated");
  });
});
