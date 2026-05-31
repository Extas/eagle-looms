import { SiteProfile, getSiteConfig, saveConf } from "../config";
import { ADAPTER } from "../platform/adapt";
import { i18n } from "../utils/i18n";
import q from "../utils/query-element";
import { b64EncodeUnicode } from "../utils/random";
import relocateElement from "../utils/relocate-element";

function createInputElement(root: HTMLElement, anchor: HTMLElement, callback: (value: string) => void) {
  const element = document.createElement("div");
  element.style.position = "fixed";
  element.style.lineHeight = "2em";
  element.id = "input-element";
  element.innerHTML = `<input type="text" style="width:20em;height:2em;"><button class="ehvp-custom-btn ehvp-custom-btn-plain">&nbsp√&nbsp</button>`;
  root.appendChild(element);
  const input = element.querySelector("input")!;
  const button = element.querySelector("button")!;
  button.addEventListener("click", () => {
    callback(input.value);
    element.remove();
  });
  // FIXME: not work
  relocateElement(element, anchor, root.offsetWidth, root.offsetHeight);
}

function createWorkURLs(workURLs: string[], container: HTMLElement, onRemove: (vaule: string) => void) {
  const urls = workURLs.map(regex => `<div><span style="user-select: text;">${regex}</span><span class="ehvp-custom-btn ehvp-custom-btn-plain" data-value="${regex}">&nbspx&nbsp</span></div>`);
  container.innerHTML = urls.join("");
  Array.from(container.querySelectorAll("div > span + span")).forEach(element => {
    element.addEventListener("click", () => {
      onRemove(element.getAttribute("data-value")!);
      element.parentElement!.remove();
    });
  });
}

export default function createSiteProfilePanel(root: HTMLElement, onclose?: () => void) {
  const matchers = ADAPTER.matchers;
  const listItems = matchers.map((matcher) => {
    const name = matcher.name;
    const id = "id-" + b64EncodeUnicode(name).replaceAll(/[+=\/]/g, "-");
    return `<li data-index="${id}" class="ehvp-custom-panel-list-item">
             <div class="ehvp-custom-panel-list-item-title">
               <div style="font-size: 1.2em;font-weight: 800;">${name}</div>
               <div>
                 <label class="ehvp-custom-panel-checkbox"><span>${i18n.addRegexp.get()}: </span><span id="${id}-add-workurl" class="ehvp-custom-btn ehvp-custom-btn-green">&nbsp+&nbsp</span></label>
               </div>
             </div>
             <div id="${id}-workurls"></div>
           </li>`;
  });
  const HTML_STR = `
<div class="ehvp-custom-panel">
  <div class="ehvp-custom-panel-title">
    <span>
      <span>${i18n.showSiteProfiles.get()}</span>
    </span>
    <span id="ehvp-custom-panel-close" class="ehvp-custom-panel-close">✖</span>
  </div>
  <div class="ehvp-custom-panel-container">
    <div class="ehvp-custom-panel-content">
      <ul class="ehvp-custom-panel-list">
      ${listItems.join("")}
      </ul>
    </div>
  </div>
</div>
`;
  const fullPanel = document.createElement("div");
  fullPanel.classList.add("ehvp-full-panel");
  fullPanel.innerHTML = HTML_STR;
  const close = () => {
    fullPanel.remove();
    onclose?.();
  };
  fullPanel.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).classList.contains("ehvp-full-panel")) {
      close();
    }
  });
  root.appendChild(fullPanel);
  fullPanel.querySelector(".ehvp-custom-panel-close")!.addEventListener("click", close);

  matchers.forEach(matcher => {
    const name = matcher.name;
    const id = "id-" + b64EncodeUnicode(name).replaceAll(/[+=\/]/g, "-");
    const defaultWorkURLs = matcher.workURLs.map(u => u.source);

    const getProfile = () => {
      return getSiteConfig(name);
    };
    // add custom work url
    const addWorkURL = q(`#${id}-add-workurl`, fullPanel);
    const workURLContainer = q(`#${id}-workurls`, fullPanel);
    const removeWorkURL = (value: string, profile: SiteProfile) => {
      const index = profile.workURLs?.indexOf(value) ?? -1;
      let changed = false;
      if (index > -1) {
        profile.workURLs!.splice(index, 1);
        changed = true;
      }
      if ((profile.workURLs?.length ?? 0) === 0) {
        profile.workURLs = undefined;
        changed = true;
        createWorkURLs(defaultWorkURLs, workURLContainer, (value) => {
          removeWorkURL(value, getProfile());
        });
      }
      if (changed) saveConf({ workURLs: profile.workURLs }, matcher.name);
    };
    addWorkURL.addEventListener("click", () => {
      const background = document.createElement("div");
      background.addEventListener("click", (event) => event.target === background && background.remove());
      background.setAttribute("style", "position:absolute;width:100%;height:100%;");
      fullPanel.appendChild(background);
      createInputElement(background, addWorkURL, (value) => {
        if (!value) return;
        try {
          new RegExp(value);
        } catch (_) {
          return;
        }
        background.remove();
        const profile = getProfile();
        if (!profile.workURLs) {
          profile.workURLs = [...defaultWorkURLs];
        }
        profile.workURLs.push(value);
        saveConf({ workURLs: profile.workURLs }, matcher.name);
        createWorkURLs(profile.workURLs, workURLContainer, (value) => {
          removeWorkURL(value, getProfile());
        });
      });
    });
    // init work urls to html
    createWorkURLs(getProfile().workURLs ?? defaultWorkURLs, workURLContainer, (value) => {
      removeWorkURL(value, getProfile());
    });
  });
  fullPanel.querySelectorAll<HTMLElement>(".p-tooltip").forEach(element => {
    const child = element.querySelector<HTMLElement>(".p-tooltiptext");
    if (!child) return;
    element.addEventListener("mouseenter", () => {
      child.style.display = "block";
      relocateElement(child, element, root.offsetWidth, root.offsetHeight);
    });
    element.addEventListener("mouseleave", () => child.style.display = "none");
  });
}
