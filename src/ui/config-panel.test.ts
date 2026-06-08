import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConf } from "../config";
import { ADAPTER } from "../platform/adapt";
import { i18n } from "../utils/i18n";
import { ConfigPanel } from "./config-panel";
import type { Events } from "./event";

const probeMock = vi.hoisted(() => vi.fn());

vi.mock("$", () => ({
  GM_getValue: () => null,
  GM_setValue: () => undefined,
}));

vi.mock("../eagle/eagle-web-api", () => ({
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
    ADAPTER.matcher = { name: "test-site", workURLs: [/.*/], constructor: vi.fn() as any };
    ADAPTER.globalConf = defaultConf();
    ADAPTER.conf = { ...ADAPTER.globalConf };
    ADAPTER.siteConf = {};
    probeMock.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("tests the configured Eagle connection from the preview", async () => {
    probeMock.mockResolvedValue({ app: { version: "4.0.0" }, library: {} });
    const panel = createPanel();
    const button = panel.panel.querySelector<HTMLButtonElement>("#eagle-config-test-connection")!;
    const status = panel.panel.querySelector<HTMLElement>("#eagle-config-connection-status")!;

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(probeMock).toHaveBeenCalledTimes(1);
    expect(status.textContent).toBe(i18n.eagleConfigTestOk.get()
      .replace("{version}", "4.0.0")
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

  it("makes visible tag namespace priority clear in the preview", () => {
    const panel = createPanel();
    const preview = panel.panel.querySelector<HTMLElement>("#eagle-config-preview")!;

    expect(preview.textContent).toContain("copyright:/character:/author:");
    expect(preview.textContent).toContain(String(ADAPTER.globalConf.eagleMaxSourceTags));
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
});
