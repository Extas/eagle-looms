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
const EXPECTED_CONFIG_PATCH_VERSION = 20;

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

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 12 Eagle gallery presets to the site/date default", () => {
    const config = defaultConf();
    config.configPatchVersion = 12;
    config.eagleFolderPreset = "gallery";
    config.eagleFolderPath = "Eagle Looms/{site}/{gallery}";
    storage.set(CONFIG_KEY, JSON.stringify(config));

    const migrated = getConf();

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 13 Eagle gallery presets to the site/date default", () => {
    const config = defaultConf();
    config.configPatchVersion = 13;
    config.eagleFolderPreset = "gallery";
    config.eagleFolderPath = "Eagle Looms/{site}/{gallery}";
    storage.set(CONFIG_KEY, JSON.stringify(config));

    const migrated = getConf();

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 14 Eagle gallery presets to the site/date default", () => {
    const config = defaultConf();
    config.configPatchVersion = 14;
    config.eagleFolderPreset = "gallery";
    config.eagleFolderPath = "Eagle Looms/{site}/{gallery}";
    storage.set(CONFIG_KEY, JSON.stringify(config));

    const migrated = getConf();

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 15 Eagle gallery presets to the site/date default", () => {
    const config = defaultConf();
    config.configPatchVersion = 15;
    config.eagleFolderPreset = "gallery";
    config.eagleFolderPath = "Eagle Looms/{site}/{gallery}";
    storage.set(CONFIG_KEY, JSON.stringify(config));

    const migrated = getConf();

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 16 Eagle gallery presets to the site/date default", () => {
    const config = defaultConf();
    config.configPatchVersion = 16;
    config.eagleFolderPreset = "gallery";
    config.eagleFolderPath = "Eagle Looms/{site}/{gallery}";
    storage.set(CONFIG_KEY, JSON.stringify(config));

    const migrated = getConf();

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 17 Eagle gallery presets to the site/date default", () => {
    const config = defaultConf();
    config.configPatchVersion = 17;
    config.eagleFolderPreset = "gallery";
    config.eagleFolderPath = "Eagle Looms/{site}/{gallery}";
    storage.set(CONFIG_KEY, JSON.stringify(config));

    const migrated = getConf();

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 18 Eagle gallery presets to the site/date default", () => {
    const config = defaultConf();
    config.configPatchVersion = 18;
    config.eagleFolderPreset = "gallery";
    config.eagleFolderPath = "Eagle Looms/{site}/{gallery}";
    storage.set(CONFIG_KEY, JSON.stringify(config));

    const migrated = getConf();

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 19 Eagle gallery presets to the site/date default", () => {
    const config = defaultConf();
    config.configPatchVersion = 19;
    config.eagleFolderPreset = "gallery";
    config.eagleFolderPath = "Eagle Looms/{site}/{gallery}";
    storage.set(CONFIG_KEY, JSON.stringify(config));

    const migrated = getConf();

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
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

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
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

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 12 site-level Eagle gallery presets to site/date", () => {
    storage.set(siteConfigKey("Twitter | X"), JSON.stringify({
      configPatchVersion: 12,
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }));

    const migrated = getSiteConfig("Twitter | X");

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 13 site-level Eagle gallery presets to site/date", () => {
    storage.set(siteConfigKey("Twitter | X"), JSON.stringify({
      configPatchVersion: 13,
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }));

    const migrated = getSiteConfig("Twitter | X");

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 14 site-level Eagle gallery presets to site/date", () => {
    storage.set(siteConfigKey("Twitter | X"), JSON.stringify({
      configPatchVersion: 14,
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }));

    const migrated = getSiteConfig("Twitter | X");

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 15 site-level Eagle gallery presets to site/date", () => {
    storage.set(siteConfigKey("Twitter | X"), JSON.stringify({
      configPatchVersion: 15,
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }));

    const migrated = getSiteConfig("Twitter | X");

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 16 site-level Eagle gallery presets to site/date", () => {
    storage.set(siteConfigKey("Twitter | X"), JSON.stringify({
      configPatchVersion: 16,
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }));

    const migrated = getSiteConfig("Twitter | X");

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 17 site-level Eagle gallery presets to site/date", () => {
    storage.set(siteConfigKey("Twitter | X"), JSON.stringify({
      configPatchVersion: 17,
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }));

    const migrated = getSiteConfig("Twitter | X");

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 18 site-level Eagle gallery presets to site/date", () => {
    storage.set(siteConfigKey("Twitter | X"), JSON.stringify({
      configPatchVersion: 18,
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }));

    const migrated = getSiteConfig("Twitter | X");

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("migrates patch 19 site-level Eagle gallery presets to site/date", () => {
    storage.set(siteConfigKey("Twitter | X"), JSON.stringify({
      configPatchVersion: 19,
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }));

    const migrated = getSiteConfig("Twitter | X");

    expect(migrated.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(migrated.eagleFolderPreset).toBe("date");
    expect(migrated.eagleFolderPath).toBe("Eagle Looms/{site}/{date}");
  });

  it("keeps new site-level built-in choices after they are explicitly saved", () => {
    saveConf({
      eagleFolderPreset: "gallery",
      eagleFolderPath: "Eagle Looms/{site}/{gallery}",
    }, "Twitter | X");

    const siteConfig = getSiteConfig("Twitter | X");

    expect(siteConfig.configPatchVersion).toBe(EXPECTED_CONFIG_PATCH_VERSION);
    expect(siteConfig.eagleFolderPreset).toBe("gallery");
    expect(siteConfig.eagleFolderPath).toBe("Eagle Looms/{site}/{gallery}");
  });
});
