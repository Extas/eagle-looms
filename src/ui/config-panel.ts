import { Config, ConfigBooleanType, ConfigTextType, ConfigItem, ConfigItems, ConfigNumberType, ConfigSelectType, defaultConf, resetConf } from "../config";
import { EagleWebApi } from "../eagle/eagle-web-api";
import { resolveEagleFolderPaths } from "../eagle/options";
import { ADAPTER } from "../platform/adapt";
import { I18nValue, i18n } from "../utils/i18n";
import q from "../utils/query-element";
import relocateElement from "../utils/relocate-element";
import { Events } from "./event";

export class ConfigPanel {
  root: HTMLElement;
  panel: HTMLElement;
  configSelect: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.panel = q("#config-panel", root);

    this.configSelect = q("#config-a-select", root);
  }

  initEvents(events: Events) {
    this.flushConfigItems(events);

    this.configSelect.addEventListener("click", (event) => {
      const value = (event.target as HTMLElement).getAttribute("data-value");
      if (value) {
        ADAPTER.conf.selectedSiteNameConfig = value === "global" ? undefined : value;
        console.log("ADAPTER.conf.selectedSiteNameConfig: ", ADAPTER.conf.selectedSiteNameConfig);
        Array.from(this.configSelect.querySelectorAll(".b-main-option")).forEach((element) => {
          if (element.getAttribute("data-value") === ADAPTER.conf.selectedSiteNameConfig) {
            element.classList.add("b-main-option-selected");
          } else if (element.getAttribute("data-value") === "global" && ADAPTER.conf.selectedSiteNameConfig === undefined) {
            element.classList.add("b-main-option-selected");
          } else {
            element.classList.remove("b-main-option-selected");
          }
        });
        this.flushConfigItems(events);
      }
    });

    q("#show-guide-element", this.panel).addEventListener("click", events.showGuideEvent);
    q("#show-keyboard-custom-element", this.panel).addEventListener("click", events.showKeyboardCustomEvent);
    q("#show-site-profiles-element", this.panel).addEventListener("click", events.showSiteProfilesEvent);
    q("#show-style-custom-element", this.panel).addEventListener("click", events.showStyleCustomEvent);
    q("#show-action-custom-element", this.panel).addEventListener("click", events.showActionCustomEvent);
    q("#reset-config-element", this.panel).addEventListener("click", () => {
      const selectedConfig = ADAPTER.conf.selectedSiteNameConfig;
      if (resetConf(selectedConfig)) {
        if (selectedConfig) {
          ADAPTER.siteConf = {};
          ADAPTER.conf = { ...ADAPTER.globalConf };
        } else {
          ADAPTER.globalConf = defaultConf();
          ADAPTER.conf = ADAPTER.siteConf ? { ...ADAPTER.globalConf, ...ADAPTER.siteConf } : ADAPTER.globalConf;
        }
        ADAPTER.conf.selectedSiteNameConfig = selectedConfig;
        this.flushConfigItems(events);
      }
    });
  }

  flushConfigItems(events: Events) {
    const header = q("#config-panel-header", this.panel);
    Array.from(this.panel.querySelectorAll<HTMLElement>(".config-panel-item, .eagle-config-preview")).forEach(elem => elem.remove());
    const nodes = ConfigItems.map(createOption).map(str => {
      const template = document.createElement("template");
      template.innerHTML = str.trim();
      return template.content.firstElementChild!;
    });
    header.after(...nodes);
    // modify config event
    ConfigItems.forEach(item => {
      switch (item.typ) {
        case "number":
          q(`#${item.key}MinusBTN`, this.panel).addEventListener("click", () => {
            events.modNumberConfigEvent(item.key as ConfigNumberType, 'minus');
            this.refreshEagleConfigPreviewFor(item.key);
          });
          q(`#${item.key}AddBTN`, this.panel).addEventListener("click", () => {
            events.modNumberConfigEvent(item.key as ConfigNumberType, 'add');
            this.refreshEagleConfigPreviewFor(item.key);
          });
          q(`#${item.key}Input`, this.panel).addEventListener("wheel", (event: WheelEvent) => {
            event.preventDefault();
            if (event.deltaY < 0) {
              events.modNumberConfigEvent(item.key as ConfigNumberType, 'add');
            } else if (event.deltaY > 0) {
              events.modNumberConfigEvent(item.key as ConfigNumberType, 'minus');
            }
            this.refreshEagleConfigPreviewFor(item.key);
          });
          break;
        case "boolean":
          q(`#${item.key}Checkbox`, this.panel).addEventListener("click", () => {
            events.modBooleanConfigEvent(item.key as ConfigBooleanType);
            this.refreshEagleConfigPreviewFor(item.key);
          });
          break;
        case "select":
          q(`#${item.key}Select`, this.panel).addEventListener("change", () => {
            events.modSelectConfigEvent(item.key as ConfigSelectType);
            this.refreshEagleConfigPreviewFor(item.key);
          });
          break;
        case "input":
          q(`#${item.key}TextInput`, this.panel).addEventListener("change", () => {
            events.modTextConfigEvent(item.key as ConfigTextType);
            this.refreshEagleConfigPreviewFor(item.key);
          });
          break;
      }
    });
    this.insertEagleConfigPreview();
    this.bindEagleConfigPreview();
    // tooltip hovering
    this.panel.querySelectorAll<HTMLElement>(".p-tooltip").forEach(element => {
      const child = element.querySelector<HTMLElement>(".p-tooltiptext");
      if (!child) return;
      element.addEventListener("mouseenter", () => {
        child.style.display = "block";
        relocateElement(child, element, this.root.offsetWidth, this.root.offsetHeight);
      });
      element.addEventListener("mouseleave", () => child.style.display = "none");
    });
  }

  private insertEagleConfigPreview() {
    const anchor = q("#eagleSkipDuplicatesConfigItem", this.panel);
    const preview = document.createElement("template");
    preview.innerHTML = eagleConfigPreviewHTML();
    anchor.after(preview.content.firstElementChild!);
  }

  private refreshEagleConfigPreview() {
    const preview = this.panel.querySelector("#eagle-config-preview");
    if (!preview) return;
    const next = document.createElement("template");
    next.innerHTML = eagleConfigPreviewHTML();
    preview.replaceWith(next.content.firstElementChild!);
    this.bindEagleConfigPreview();
  }

  private refreshEagleConfigPreviewFor(key: ConfigItem["key"]) {
    if (isEaglePreviewConfigKey(key)) this.refreshEagleConfigPreview();
  }

  private bindEagleConfigPreview() {
    const button = this.panel.querySelector<HTMLButtonElement>("#eagle-config-test-connection");
    const status = this.panel.querySelector<HTMLElement>("#eagle-config-connection-status");
    if (!button || !status) return;
    button.addEventListener("click", async () => {
      const conf = ADAPTER.conf.selectedSiteNameConfig ? ADAPTER.conf : ADAPTER.globalConf;
      const api = new EagleWebApi(conf.eagleBaseUrl);
      button.disabled = true;
      button.textContent = i18n.eagleConfigTestChecking.get();
      status.classList.remove("eagle-config-connection-ok", "eagle-config-connection-error");
      status.textContent = i18n.eagleConfigTestChecking.get();
      try {
        const result = await api.probe();
        status.textContent = i18n.eagleConfigTestOk.get()
          .replace("{version}", eagleVersion(result.app))
          .replace("{url}", api.baseUrl);
        status.classList.add("eagle-config-connection-ok");
      } catch (error) {
        status.textContent = i18n.eagleConfigTestFailed.get()
          .replace("{url}", api.baseUrl)
          .replace("{message}", errorMessage(error));
        status.classList.add("eagle-config-connection-error");
      } finally {
        button.disabled = false;
        button.textContent = i18n.eagleConfigTestConnection.get();
      }
    });
  }

  static html() {
    return `
<div id="config-panel" class="p-panel p-config p-collapse">
    <div id="config-panel-header" style="position: sticky;border: 1px solid black;grid-column-start: 1;grid-column-end: 11;padding: 0px 0.3em;top: 0;z-index: 1;background-color: #33333390">
      <div id="config-a-select"
      ><a class="b-main-option clickable ${ADAPTER.conf.selectedSiteNameConfig === undefined ? "b-main-option-selected" : ""}" data-value="global">${i18n.global.get()}</a
      ><a class="b-main-option clickable ${ADAPTER.conf.selectedSiteNameConfig === ADAPTER.matcher!.name ? "b-main-option-selected" : ""}" data-value="${ADAPTER.matcher!.name}">${ADAPTER.matcher!.name}</a></div>
    </div>

    <!-- config items will place here -->
    <div style="grid-column-start: 1; grid-column-end: 11; padding-left: 5px;">
        <label class="p-label">
            <span>${i18n.dragToMove.get()}:</span>
            <span id="dragHub" style="font-size: 1.85rem;cursor: grab;">✠</span>
        </label>
    </div>
    <div style="grid-column-start: 1; grid-column-end: 11; padding-left: 5px; text-align: left;">
         <a id="show-guide-element" class="clickable" style="border: 1px dotted #fff; padding: 0px 3px;">${i18n.showHelp.get()}</a>
         <a id="show-keyboard-custom-element" class="clickable" style="border: 1px dotted #fff; padding: 0px 3px;">${i18n.showKeyboard.get()}</a>
         <a id="show-site-profiles-element" class="clickable" style="border: 1px dotted #fff; padding: 0px 3px;">${i18n.showSiteProfiles.get()}</a>
         <a id="show-style-custom-element" class="clickable" style="border: 1px dotted #fff; padding: 0px 3px;">${i18n.showStyleCustom.get()}</a>
         <a id="show-action-custom-element" class="clickable" style="border: 1px dotted #fff; padding: 0px 3px;">${i18n.showActionCustom.get()}</a>
         <a id="reset-config-element" class="clickable" style="border: 1px dotted #fff; padding: 0px 3px;">${i18n.resetConfig.get()}</a>
         <a class="clickable" style="border: 1px dotted #fff; padding: 0px 3px;" href="https://github.com/Extas/eagle-looms" target="_blank">${i18n.letUsStar.get()}</a>
    </div>
</div>`;
  }
}

function createOption(item: ConfigItem) {
  const i18nKey = item.i18nKey || item.key;
  const i18nValue = (i18n as any)[i18nKey] as I18nValue;
  const i18nValueTooltip = (i18n as any)[`${i18nKey}Tooltip`] as I18nValue;
  if (!i18nValue) {
    throw new Error(`i18n key ${i18nKey} not found`);
  }
  let display = true;
  if (item.displayInSite) {
    display = item.displayInSite.test(location.href);
  }

  const conf = ADAPTER.conf.selectedSiteNameConfig ? ADAPTER.conf : ADAPTER.globalConf;

  let input = "";
  switch (item.typ) {
    case "boolean":
      input = `<input id="${item.key}Checkbox" ${conf[item.key as ConfigBooleanType] ? "checked" : ""} type="checkbox" />`;
      break;
    case "number":
      input = `<span>
                  <button id="${item.key}MinusBTN" class="p-btn" type="button">-</button>
                  <input id="${item.key}Input" value="${conf[item.key as ConfigNumberType]}" disabled type="text" />
                  <button id="${item.key}AddBTN" class="p-btn" type="button">+</button></span>`;
      break;
    case "select":
      if (!item.options) {
        throw new Error(`options for ${item.key} not found`);
      }
      const optionsStr = item.options.map(o => `<option value="${escapeAttr(o.value)}" ${conf[item.key as ConfigSelectType] == o.value ? "selected" : ""}>${escapeHTML(configOptionDisplay(item.key, o.value, o.display))}</option>`).join("");
      input = `<select id="${item.key}Select">${optionsStr}</select>`;
      break;
    case "input":
      input = `<span><input id="${item.key}TextInput" value="${escapeAttr(conf[item.key as ConfigTextType] || "")}" class="text-input" placeholder="${escapeAttr(item.placeholder ?? "")}" type="text" /></span>`
      break;

  }
  const [start, end] = item.gridColumnRange ? item.gridColumnRange : [1, 11];
  return `<div id="${item.key}ConfigItem" class="config-panel-item" style="grid-column-start: ${start}; grid-column-end: ${end}; padding-left: 5px;${display ? "" : " display: none;"}"><label class="p-label"><span><span>${i18nValue.get()}</span><span class="p-tooltip">${i18nValueTooltip ? " ?:" : " :"}<span class="p-tooltiptext">${i18nValueTooltip?.get() || ""}</span></span></span>${input}</label></div>`;
}

function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function configOptionDisplay(key: ConfigItem["key"], value: string, fallback: string): string {
  if (key === "eagleFolderPreset") return eagleFolderPresetLabel(value);
  if (key === "eagleConfirmMode") return eagleConfirmModeLabel(value);
  return fallback;
}

function eagleConfigPreviewHTML(): string {
  const conf = ADAPTER.conf.selectedSiteNameConfig ? ADAPTER.conf : ADAPTER.globalConf;
  const site = ADAPTER.matcher?.name || location.hostname || "site";
  const samplePaths = resolveEagleFolderPaths(conf.eagleFolderPath, {
    site,
    gallery: "gallery",
    chapter: "chapter",
    copyright: "series",
    character: "character",
    author: "artist",
    characters: ["character a", "character b"],
  }).slice(0, 2).map(path => path.join("/"));
  const visibleTags = conf.eagleMaxSourceTags === 0
    ? i18n.eagleConfigPreviewNoTags.get()
    : i18n.eagleConfigPreviewTags.get().replace("{count}", String(conf.eagleMaxSourceTags));
  const itemNames = conf.eagleNameDatePrefix
    ? i18n.eagleConfigPreviewDateNames.get()
    : i18n.eagleConfigPreviewSourceNames.get();
  const batchPolicy = i18n.eagleConfigPreviewBatchText.get()
    .replace("{count}", String(conf.eagleImportLimit))
    .replace("{duplicates}", conf.eagleSkipDuplicates ? i18n.eagleConfigPreviewSkipDuplicates.get() : i18n.eagleConfigPreviewAddDuplicates.get());
  const confirmPolicy = eagleConfirmPolicyText(conf.eagleConfirmMode, conf.eagleConfirmThreshold);
  return `
<div id="eagle-config-preview" class="eagle-config-preview">
  <div class="eagle-config-preview-title"><span>${escapeHTML(i18n.eagleConfigPreview.get())}</span><button type="button" id="eagle-config-test-connection" class="ehvp-custom-btn ehvp-custom-btn-plain">${escapeHTML(i18n.eagleConfigTestConnection.get())}</button></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewScope.get())}</b><span>${escapeHTML(eagleConfigScopeText())}</span></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewConnection.get())}</b><span id="eagle-config-connection-status">${escapeHTML(conf.eagleBaseUrl)}</span></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewPreset.get())}</b><span>${escapeHTML(eagleFolderPresetLabel(conf.eagleFolderPreset))}</span></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewFolderTemplate.get())}</b><code>${escapeHTML(conf.eagleFolderPath)}</code></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewFolder.get())}</b><code>${escapeHTML(samplePaths.join(" | "))}</code></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewNames.get())}</b><span>${escapeHTML(itemNames)}</span></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewSourceFields.get())}</b><span>${escapeHTML(i18n.eagleConfigPreviewSourceFieldsText.get())}</span></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewBatch.get())}</b><span>${escapeHTML(batchPolicy)}</span></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewConfirm.get())}</b><span>${escapeHTML(confirmPolicy)}</span></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewVisibleTags.get())}</b><span>${escapeHTML(visibleTags)}</span></div>
  <div><b>${escapeHTML(i18n.eagleConfigPreviewExtraAssets.get())}</b><span>${escapeHTML(i18n.eagleConfigPreviewNoExtraAssets.get())}</span></div>
</div>`;
}

function eagleFolderPresetLabel(value: string): string {
  switch (value) {
    case "custom":
      return i18n.eagleFolderPresetCustom.get();
    case "copyright":
      return i18n.eagleFolderPresetCopyright.get();
    case "gallery":
      return i18n.eagleFolderPresetGallery.get();
    case "chapter":
      return i18n.eagleFolderPresetChapter.get();
    case "copyrightAuthor":
      return i18n.eagleFolderPresetCopyrightAuthor.get();
    case "copyrightCharacter":
      return i18n.eagleFolderPresetCopyrightCharacter.get();
    default:
      return value;
  }
}

function eagleConfirmPolicyText(mode: string, threshold: number): string {
  switch (mode) {
    case "always":
      return i18n.eagleConfigPreviewConfirmAlways.get();
    case "never":
      return i18n.eagleConfigPreviewConfirmNever.get();
    case "auto":
    default:
      return i18n.eagleConfigPreviewConfirmAuto.get().replace("{count}", String(threshold));
  }
}

function eagleConfirmModeLabel(value: string): string {
  switch (value) {
    case "auto":
      return i18n.eagleConfirmModeAuto.get();
    case "always":
      return i18n.eagleConfirmModeAlways.get();
    case "never":
      return i18n.eagleConfirmModeNever.get();
    default:
      return value;
  }
}

const EAGLE_PREVIEW_CONFIG_KEYS = [
  "eagleBaseUrl",
  "eagleFolderPreset",
  "eagleFolderPath",
  "eagleImportLimit",
  "eagleConfirmMode",
  "eagleConfirmThreshold",
  "eagleMaxSourceTags",
  "eagleNameDatePrefix",
  "eagleSkipDuplicates",
] as const satisfies readonly (keyof Config)[];

function isEaglePreviewConfigKey(key: ConfigItem["key"]): boolean {
  return (EAGLE_PREVIEW_CONFIG_KEYS as readonly string[]).includes(key);
}

function eagleConfigScopeText(): string {
  if (!ADAPTER.conf.selectedSiteNameConfig) {
    return i18n.eagleConfigPreviewGlobalScope.get();
  }
  const overridden = EAGLE_PREVIEW_CONFIG_KEYS.filter(key => Object.prototype.hasOwnProperty.call(ADAPTER.siteConf || {}, key));
  if (overridden.length === 0) {
    return i18n.eagleConfigPreviewInheritsGlobal.get();
  }
  return i18n.eagleConfigPreviewOverrides.get().replace("{fields}", overridden.map(eagleConfigFieldLabel).join(", "));
}

function eagleConfigFieldLabel(key: typeof EAGLE_PREVIEW_CONFIG_KEYS[number]): string {
  switch (key) {
    case "eagleBaseUrl":
      return i18n.eagleBaseUrl.get();
    case "eagleFolderPreset":
      return i18n.eagleFolderPreset.get();
    case "eagleFolderPath":
      return i18n.eagleFolderPath.get();
    case "eagleImportLimit":
      return i18n.eagleImportLimit.get();
    case "eagleConfirmMode":
      return i18n.eagleConfirmMode.get();
    case "eagleConfirmThreshold":
      return i18n.eagleConfirmThreshold.get();
    case "eagleMaxSourceTags":
      return i18n.eagleMaxSourceTags.get();
    case "eagleNameDatePrefix":
      return i18n.eagleNameDatePrefix.get();
    case "eagleSkipDuplicates":
      return i18n.eagleSkipDuplicates.get();
  }
}

function eagleVersion(value: unknown): string {
  if (!value || typeof value !== "object") return "unknown";
  const data = value as { version?: unknown; data?: { version?: unknown } };
  return String(data.version || data.data?.version || "unknown");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "unknown error");
}

function escapeHTML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
