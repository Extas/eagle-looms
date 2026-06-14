import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConf, getConf, getSiteConfig, saveConf } from "./config";
import { b64EncodeUnicode } from "./utils/random";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("$", () => ({
  GM_getValue: (key: string) => storage.get(key) ?? null,
  GM_setValue: (key: string, value: string) => {
    storage.set(key, value);
  },
}));

const CONFIG_KEY = "ehvh_cfg_";

function siteConfigKey(name: string): string {
  return CONFIG_KEY + b64EncodeUnicode(name).replaceAll(/[+=\/]/g, "-");
}

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

  it("migrates old site-level built-in Eagle folder presets to site/date", () => {
    storage.set(siteConfigKey("Twitter | X"), JSON.stringify({
      configPatchVersion: 11,
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }));

    const migrated = getSiteConfig("Twitter | X");

    expect(migrated.configPatchVersion).toBe(12);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("keeps new site-level built-in choices after they are explicitly saved", () => {
    saveConf({
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }, "Twitter | X");

    const siteConfig = getSiteConfig("Twitter | X");

    expect(siteConfig.configPatchVersion).toBe(12);
    expect(siteConfig.eagleFolderPreset).toBe("gallery");
    expect(siteConfig.eagleFolderPath).toBe("Eagle Looms/{site}/{gallery}");
  });
});
