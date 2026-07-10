import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConf, getSiteConfig, saveConf } from "../config";
import { ADAPTER } from "../platform/adapt";
import { i18n } from "../utils/i18n";
import { ConfigPanel } from "./config-panel";
import type { Events } from "./event";

const probeMock = vi.hoisted(() => vi.fn());
const configStorage = vi.hoisted(() => new Map<string, string>());

vi.mock("$", () => ({
  GM_getValue: (key: string) => configStorage.get(key) ?? null,
  GM_setValue: (key: string, value: string) => configStorage.set(key, value),
}));

vi.mock("../eagle/eagle-web-api", () => ({
  classifyEagleApiError: (error: any) => {
    const message = String(error?.message || error);
    if (/401|403|unauthorized|forbidden|token/i.test(message)) return "authorization";
    if (/invalid json|invalid api response/i.test(message)) return "response";
    return "other";
  },
  extractEagleLibraryName: (value: any) => value?.name || value?.data?.name || "",
  EagleWebApi: class EagleWebApi {
    readonly baseUrl: string;

    constructor(baseUrl: string) {
      this.baseUrl = baseUrl;
    }

    probe = probeMock;
  },
}));

function createEvents(overrides: Partial<Events> = {}): Events {
  return {
    showGuideEvent: vi.fn(),
    showKeyboardCustomEvent: vi.fn(),
    showSiteProfilesEvent: vi.fn(),
    showStyleCustomEvent: vi.fn(),
    showActionCustomEvent: vi.fn(),
    modNumberConfigEvent: vi.fn(),
    modBooleanConfigEvent: vi.fn(),
    modSelectConfigEvent: vi.fn(),
    modTextConfigEvent: vi.fn(),
    ...overrides,
  } as unknown as Events;
}

function createPanel(events = createEvents()): ConfigPanel {
  const root = document.createElement("div");
  root.innerHTML = ConfigPanel.html();
  document.body.appendChild(root);
  const panel = new ConfigPanel(root);
  panel.initEvents(events);
  return panel;
}

describe("ConfigPanel Eagle preview", () => {
  beforeEach(() => {
    configStorage.clear();
    ADAPTER.matcher = { name: "test-site", workURLs: [/.*/], constructor: vi.fn() as any };
    ADAPTER.globalConf = defaultConf();
    ADAPTER.conf = { ...ADAPTER.globalConf };
    ADAPTER.siteConf = {};
    probeMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("tests the configured Eagle connection from the preview", async () => {
    probeMock.mockResolvedValue({ app: { version: "4.0.0" }, library: { name: "Test Library" } });
    const panel = createPanel();
    const button = panel.panel.querySelector<HTMLButtonElement>("#eagle-config-test-connection")!;
    const status = panel.panel.querySelector<HTMLElement>("#eagle-config-connection-status")!;

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(probeMock).toHaveBeenCalledTimes(1);
    expect(status.textContent).toBe(i18n.eagleConfigTestOk.get()
      .replace("{version}", "4.0.0")
      .replace("{library}", "Test Library")
      .replace("{url}", ADAPTER.globalConf.eagleBaseUrl));
    expect(status.classList.contains("eagle-config-connection-ok")).toBe(true);
    expect(button.textContent).toBe(i18n.eagleConfigTestConnection.get());
    expect(button.disabled).toBe(false);
  });

  it("shows connection failures without hiding the current URL", async () => {
    probeMock.mockRejectedValue(new Error("connection refused"));
    const panel = createPanel();
    const button = panel.panel.querySelector<HTMLButtonElement>("#eagle-config-test-connection")!;
    const status = panel.panel.querySelector<HTMLElement>("#eagle-config-connection-status")!;

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(status.textContent).toContain(ADAPTER.globalConf.eagleBaseUrl);
    expect(status.textContent).toContain("connection refused");
    expect(status.classList.contains("eagle-config-connection-error")).toBe(true);
  });

  it("turns Eagle authorization failures into a token repair hint", async () => {
    probeMock.mockRejectedValue(new Error("403 Forbidden"));
    const panel = createPanel();
    const status = panel.panel.querySelector<HTMLElement>("#eagle-config-connection-status")!;

    panel.panel.querySelector<HTMLButtonElement>("#eagle-config-test-connection")!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(status.textContent).toContain("API token");
    expect(status.textContent).toContain("403 Forbidden");
  });

  it("identifies a non-Eagle or proxy HTML response as an API URL problem", async () => {
    probeMock.mockRejectedValue(new Error("Eagle API returned invalid JSON"));
    const panel = createPanel();
    const status = panel.panel.querySelector<HTMLElement>("#eagle-config-connection-status")!;

    panel.panel.querySelector<HTMLButtonElement>("#eagle-config-test-connection")!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(status.textContent).toContain("API URL");
    expect(status.textContent).toContain("invalid JSON");
  });

  it("keeps Eagle API tokens out of connection preview and test results", async () => {
    ADAPTER.globalConf.eagleBaseUrl = "http://192.168.1.20:41595?token=secret-value";
    ADAPTER.conf = { ...ADAPTER.globalConf };
    probeMock.mockResolvedValue({ app: { version: "4.0.0" }, library: { name: "Remote Library" } });
    const panel = createPanel();
    const status = panel.panel.querySelector<HTMLElement>("#eagle-config-connection-status")!;

    expect(status.textContent).toContain("token=***");
    expect(status.textContent).not.toContain("secret-value");
    panel.panel.querySelector<HTMLButtonElement>("#eagle-config-test-connection")!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(status.textContent).toContain("Remote Library");
    expect(status.textContent).toContain("token=***");
    expect(status.textContent).not.toContain("secret-value");
  });

  it("makes visible tag namespace priority clear in the preview", () => {
    const panel = createPanel();
    const preview = panel.panel.querySelector<HTMLElement>("#eagle-config-preview")!;

    expect(preview.textContent).toContain("copyright:/character:/author:");
    expect(preview.textContent).toContain(String(ADAPTER.globalConf.eagleMaxSourceTags));
  });

  it("gives long Eagle URL and folder path settings the expandable text layout", () => {
    const panel = createPanel();

    expect(panel.panel.querySelector("#eagleBaseUrlConfigItem")?.classList.contains("eagle-config-text-item")).toBe(true);
    expect(panel.panel.querySelector("#eagleFolderPathConfigItem")?.classList.contains("eagle-config-text-item")).toBe(true);
    expect(panel.panel.querySelector("#eagleImportLimitConfigItem")?.classList.contains("eagle-config-text-item")).toBe(false);
  });

  it("rejects an invalid Eagle API address instead of silently saving the default", () => {
    const modTextConfigEvent = vi.fn();
    const panel = createPanel(createEvents({ modTextConfigEvent }));
    const input = panel.panel.querySelector<HTMLInputElement>("#eagleBaseUrlTextInput")!;

    input.value = "not a url";
    input.dispatchEvent(new Event("change"));
    expect(modTextConfigEvent).not.toHaveBeenCalled();
    expect(input.validationMessage).toBe(i18n.eagleBaseUrlInvalid.get());

    input.value = "localhost:5000?token=custom";
    input.dispatchEvent(new Event("change"));
    expect(input.value).toBe("http://localhost:5000?token=custom");
    expect(input.validationMessage).toBe("");
    expect(modTextConfigEvent).toHaveBeenCalledWith("eagleBaseUrl");
  });

  it("allows direct entry for Eagle numeric settings without changing upstream number controls", () => {
    const modNumberConfigEvent = vi.fn();
    const panel = createPanel(createEvents({ modNumberConfigEvent }));
    const importLimit = panel.panel.querySelector<HTMLInputElement>("#eagleImportLimitInput")!;
    const columns = panel.panel.querySelector<HTMLInputElement>("#colCountInput")!;

    expect(importLimit.disabled).toBe(false);
    expect(importLimit.inputMode).toBe("numeric");
    expect(columns.disabled).toBe(true);

    importLimit.value = "250";
    importLimit.dispatchEvent(new Event("change"));
    expect(modNumberConfigEvent).toHaveBeenCalledWith("eagleImportLimit", undefined, 250);
  });

  it("restores the saved Eagle number when direct input is not numeric", () => {
    const modNumberConfigEvent = vi.fn();
    const panel = createPanel(createEvents({ modNumberConfigEvent }));
    const importLimit = panel.panel.querySelector<HTMLInputElement>("#eagleImportLimitInput")!;

    importLimit.value = "";
    importLimit.dispatchEvent(new Event("change"));
    expect(importLimit.value).toBe(String(ADAPTER.globalConf.eagleImportLimit));
    expect(modNumberConfigEvent).not.toHaveBeenCalled();
  });

  it("shows the Eagle confirmation policy in the preview", () => {
    ADAPTER.globalConf.eagleConfirmMode = "auto";
    ADAPTER.globalConf.eagleConfirmThreshold = 3;
    const panel = createPanel();
    const preview = panel.panel.querySelector<HTMLElement>("#eagle-config-preview")!;

    expect(preview.textContent).toContain(i18n.eagleConfigPreviewConfirm.get());
    expect(preview.textContent).toContain("will-write > 3");
  });

  it("explains where source URLs are stored before import", () => {
    const panel = createPanel();
    const preview = panel.panel.querySelector<HTMLElement>("#eagle-config-preview")!;

    expect(preview.textContent).toContain(i18n.eagleConfigPreviewSourceFields.get());
    expect(preview.textContent).toContain("website = source page");
    expect(preview.textContent).toContain("url = original image");
  });

  it("shows the folder preset, saved rule, and example folders separately", () => {
    ADAPTER.globalConf.eagleFolderPreset = "copyrightCharacter";
    ADAPTER.globalConf.eagleFolderPath = "Eagle Looms/{site}/{copyright}/{character}";
    const panel = createPanel();
    const preview = panel.panel.querySelector<HTMLElement>("#eagle-config-preview")!;

    expect(preview.textContent).toContain(i18n.eagleConfigPreviewPreset.get());
    expect(preview.textContent).toContain(i18n.eagleFolderPresetCopyrightCharacter.get());
    expect(preview.textContent).toContain(i18n.eagleConfigPreviewFolderTemplate.get());
    expect(preview.textContent).toContain("Eagle Looms/{site}/{copyright}/{character}");
    expect(preview.textContent).toContain(i18n.eagleConfigPreviewFolder.get());
    expect(preview.textContent).toContain("Eagle Looms/test-site/series/character a");
    expect(preview.textContent).toContain("Eagle Looms/test-site/series/character b");
  });

  it("warns before import when a custom folder rule contains unknown tokens", () => {
    ADAPTER.globalConf.eagleFolderPreset = "custom";
    ADAPTER.globalConf.eagleFolderPath = "Eagle Looms/{site}/{data}";
    const panel = createPanel();
    const warning = panel.panel.querySelector<HTMLElement>(".eagle-config-warning")!;

    expect(warning.getAttribute("role")).toBe("alert");
    expect(warning.textContent).toContain("{data}");
    expect(warning.textContent).toContain(i18n.eagleConfigFolderWarning.get());
  });

  it("warns before import when a custom folder rule has malformed token braces", () => {
    ADAPTER.globalConf.eagleFolderPreset = "custom";
    ADAPTER.globalConf.eagleFolderPath = "Eagle Looms/{site/{date}";
    const panel = createPanel();
    const warning = panel.panel.querySelector<HTMLElement>(".eagle-config-warning")!;

    expect(warning.textContent).toContain(i18n.eagleConfigMalformedFolderTokens.get());
  });

  it("keeps exactly one Eagle preview after switching config scope", () => {
    const panel = createPanel();
    const siteTab = panel.configSelect.querySelector<HTMLElement>('[data-value="test-site"]')!;
    const globalTab = panel.configSelect.querySelector<HTMLElement>('[data-value="global"]')!;

    expect(panel.panel.querySelectorAll("#eagle-config-preview")).toHaveLength(1);

    siteTab.click();
    expect(panel.panel.querySelectorAll("#eagle-config-preview")).toHaveLength(1);
    expect(panel.panel.textContent).toContain(i18n.eagleConfigPreviewInheritsGlobal.get());

    globalTab.click();
    expect(panel.panel.querySelectorAll("#eagle-config-preview")).toHaveLength(1);
    expect(panel.panel.textContent).toContain(i18n.eagleConfigPreviewGlobalScope.get());
  });

  it("uses localized labels for folder preset options", () => {
    const panel = createPanel();
    const options = [...panel.panel.querySelectorAll<HTMLOptionElement>("#eagleFolderPresetSelect option")];

    expect(options.map(option => option.textContent)).toEqual([
      i18n.eagleFolderPresetCustom.get(),
      i18n.eagleFolderPresetDate.get(),
      i18n.eagleFolderPresetCopyright.get(),
      i18n.eagleFolderPresetGallery.get(),
      i18n.eagleFolderPresetChapter.get(),
      i18n.eagleFolderPresetCopyrightAuthor.get(),
      i18n.eagleFolderPresetCopyrightCharacter.get(),
    ]);
  });

  it("keeps the last Eagle test result when unrelated config changes", async () => {
    probeMock.mockResolvedValue({ app: { version: "4.0.0" }, library: {} });
    const panel = createPanel();
    const button = panel.panel.querySelector<HTMLButtonElement>("#eagle-config-test-connection")!;

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    const statusBefore = panel.panel.querySelector<HTMLElement>("#eagle-config-connection-status")!;
    expect(statusBefore.textContent).toContain("4.0.0");

    panel.panel.querySelector<HTMLButtonElement>("#colCountAddBTN")!.click();

    const statusAfter = panel.panel.querySelector<HTMLElement>("#eagle-config-connection-status")!;
    expect(statusAfter).toBe(statusBefore);
    expect(statusAfter.textContent).toContain("4.0.0");
  });

  it("refreshes the Eagle preview when an Eagle option changes", () => {
    const panel = createPanel(createEvents({
      modNumberConfigEvent: vi.fn((key: string) => {
        if (key === "eagleMaxSourceTags") ADAPTER.globalConf.eagleMaxSourceTags += 1;
      }) as any,
    }));
    const previewBefore = panel.panel.querySelector<HTMLElement>("#eagle-config-preview")!;

    panel.panel.querySelector<HTMLButtonElement>("#eagleMaxSourceTagsAddBTN")!.click();

    const previewAfter = panel.panel.querySelector<HTMLElement>("#eagle-config-preview")!;
    expect(previewAfter).not.toBe(previewBefore);
    expect(previewAfter.textContent).toContain(String(ADAPTER.globalConf.eagleMaxSourceTags));
  });

  it("uses localized labels for confirmation mode options", () => {
    const panel = createPanel();
    const options = [...panel.panel.querySelectorAll<HTMLOptionElement>("#eagleConfirmModeSelect option")];

    expect(options.map(option => option.textContent)).toEqual([
      i18n.eagleConfirmModeAuto.get(),
      i18n.eagleConfirmModeAlways.get(),
      i18n.eagleConfirmModeNever.get(),
    ]);
  });

  it("shows the auto confirmation threshold only when auto mode uses it", () => {
    const panel = createPanel(createEvents({
      modSelectConfigEvent: vi.fn((key: string) => {
        if (key === "eagleConfirmMode") ADAPTER.globalConf.eagleConfirmMode = "always";
      }) as any,
    }));
    const mode = panel.panel.querySelector<HTMLSelectElement>("#eagleConfirmModeSelect")!;
    const threshold = panel.panel.querySelector<HTMLElement>("#eagleConfirmThresholdConfigItem")!;

    expect(threshold.hidden).toBe(false);
    mode.value = "always";
    mode.dispatchEvent(new Event("change"));
    expect(threshold.hidden).toBe(true);
  });

  it("shows when the selected site inherits global Eagle settings", () => {
    ADAPTER.conf.selectedSiteNameConfig = "test-site";
    ADAPTER.siteConf = {};
    ADAPTER.conf = { ...ADAPTER.globalConf, selectedSiteNameConfig: "test-site" } as typeof ADAPTER.conf;

    const panel = createPanel();
    const preview = panel.panel.querySelector<HTMLElement>("#eagle-config-preview")!;

    expect(preview.textContent).toContain(i18n.eagleConfigPreviewInheritsGlobal.get());
  });

  it("shows which Eagle fields are overridden by the selected site", () => {
    ADAPTER.conf.selectedSiteNameConfig = "test-site";
    ADAPTER.siteConf = {
      eagleFolderPath: "Eagle Looms/{site}/{author}",
      eagleMaxSourceTags: 7,
      eagleConfirmMode: "always",
      colCount: 9,
    };
    ADAPTER.conf = { ...ADAPTER.globalConf, ...ADAPTER.siteConf, selectedSiteNameConfig: "test-site" } as typeof ADAPTER.conf;

    const panel = createPanel();
    const preview = panel.panel.querySelector<HTMLElement>("#eagle-config-preview")!;
    const scope = preview.textContent || "";

    expect(scope).toContain(i18n.eagleFolderPath.get());
    expect(scope).toContain(i18n.eagleMaxSourceTags.get());
    expect(scope).toContain(i18n.eagleConfirmMode.get());
    expect(scope).not.toContain(i18n.colCount.get());
    expect(scope).toContain("Eagle Looms/{site}/{author}");
    expect(scope).toContain("7");
    expect(scope).toContain(i18n.eagleConfigPreviewConfirmAlways.get());
  });

  it("restores global Eagle settings without clearing unrelated site settings", () => {
    saveConf({
      eagleFolderPath: "Eagle Looms/{site}/{author}",
      eagleFolderPreset: "custom",
      colCount: 9,
    }, "test-site");
    ADAPTER.conf.selectedSiteNameConfig = "test-site";
    ADAPTER.siteConf = getSiteConfig("test-site");
    ADAPTER.conf = { ...ADAPTER.globalConf, ...ADAPTER.siteConf, selectedSiteNameConfig: "test-site" } as typeof ADAPTER.conf;
    const panel = createPanel();
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirm);

    panel.panel.querySelector<HTMLButtonElement>("#eagle-config-use-global")!.click();

    expect(confirm).toHaveBeenCalledWith(i18n.eagleConfigUseGlobalConfirm.get().replace("{site}", "test-site"));
    expect(ADAPTER.siteConf?.eagleFolderPath).toBeUndefined();
    expect(ADAPTER.siteConf?.eagleFolderPreset).toBeUndefined();
    expect(ADAPTER.siteConf?.colCount).toBe(9);
    expect(ADAPTER.conf.eagleFolderPath).toBe(ADAPTER.globalConf.eagleFolderPath);
    expect(panel.panel.querySelector("#eagle-config-use-global")).toBeNull();
    expect(panel.panel.textContent).toContain(i18n.eagleConfigPreviewInheritsGlobal.get());
  });

  it("keeps site Eagle overrides when global-setting confirmation is canceled", () => {
    saveConf({ eagleFolderPath: "Eagle Looms/{site}/{author}" }, "test-site");
    ADAPTER.conf.selectedSiteNameConfig = "test-site";
    ADAPTER.siteConf = getSiteConfig("test-site");
    ADAPTER.conf = { ...ADAPTER.globalConf, ...ADAPTER.siteConf, selectedSiteNameConfig: "test-site" } as typeof ADAPTER.conf;
    const panel = createPanel();
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));

    panel.panel.querySelector<HTMLButtonElement>("#eagle-config-use-global")!.click();

    expect(ADAPTER.siteConf?.eagleFolderPath).toBe("Eagle Looms/{site}/{author}");
    expect(getSiteConfig("test-site").eagleFolderPath).toBe("Eagle Looms/{site}/{author}");
    expect(panel.panel.querySelector("#eagle-config-use-global")).not.toBeNull();
  });
});
