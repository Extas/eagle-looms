import { GalleryMeta } from "../../download/gallery-meta";
import ImageNode from "../../img-node";
import { Chapter } from "../../page-fetcher";
import { b64DecodeUnicode } from "../../utils/random";
import { ADAPTER } from "../adapt";
import { isGalleryAuthorCategory } from "../gallery-author-urls";
import { BaseMatcher, OriginMeta, Result } from "../platform";

class MH160Matcher extends BaseMatcher<string> {

  hosts: string[];
  constructor() {
    super();
    let hosts = ["xwdf.tgmhfc.uk", "mhreswhm.tgmhfc.uk", "qwe123.tgmhfc.uk", "resmhpic.tgmhfc.uk", "reszxc.tgmhfc.uk"];
    this.hosts = hosts.map(h => ({ h: "https://" + h, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(h => h.h);
  }

  title(): string {
    return this.galleryMeta().title || "unknown";
  }

  galleryMeta(): GalleryMeta {
    return mh160GalleryMetaFromDocument(document, window.location.href);
  }

  async *fetchChapters(): AsyncGenerator<Chapter[]> {
    const elements = Array.from(document.querySelectorAll<HTMLAnchorElement>("#chapterList_ul_1 > li > a"));
    yield elements.map((elem, i) => {
      return new Chapter(i, elem.textContent!, elem.href);
    });
  }

  async *fetchPagesSource(ch: Chapter): AsyncGenerator<Result<string>> {
    yield Result.ok(ch.source);
  }

  async parseImgNodes(source: string): Promise<ImageNode[]> {
    const raw = await window.fetch(source).then(resp => resp.text()).catch(Error);
    if (raw instanceof Error) throw raw;
    const data = raw.match(/var qTcms_S_m_murl_e=\"([^"]*?)\"/)?.[1];
    if (!data) throw new Error("no images url matched, regexp: var qTcms_S_m_murl_e=\\\"([^\"]*?)\\\"");
    const spID = raw.match(/var qTcms_S_p_id=\"([^"]*?)\"/)?.[1];
    if (!spID) throw new Error("no qTcms_S_p_id matched, regexp: var qTcms_S_p_id=\\\"([^\"]*?)\\\"");
    const imgPathRaw = b64DecodeUnicode(data);
    const imgPaths = imgPathRaw.split("$qingtiandy$");
    const digits = imgPaths.length.toString().length;
    return imgPaths.map((path, i) => {
      const title = path.split("/").pop() ?? ((i + 1).toString().padStart(digits, "0") + "." + "jpg");
      return new ImageNode("", source, title, undefined, this.getImgUrl(path, spID));
    });
  }
  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.originSrc! };
  }

  getImgUrl(path: string, spID: string): string {
    if (path.startsWith("/")) {
      const id = parseInt(spID || "0");
      if (id > 542724) {
        return this.hosts[0] + path;
      } else {
        return "https://mhpic6.tgmhfc.uk" + path;
      }
    } else {
      // if(qTcms_Pic_m_if!="2"){
      // // v = path;
      // 			v=v.replace(/\?/gi,"a1a1");
      // 			v=v.replace(/&/gi,"b1b1");
      // 			v=v.replace(/%/gi,"c1c1");	
      // 			var m_httpurl="";
      // 			if(typeof(qTcms_S_m_mhttpurl)!="undefined")m_httpurl=base64_decode(qTcms_S_m_mhttpurl);			
      // 			s=qTcms_m_indexurl+"statics/pic/?p="+escape(v)+"&wapif=1&picid="+qTcms_S_m_id+"&m_httpurl="+escape(m_httpurl);	
      // 		}    }
      throw new Error("还未支持此图片url解析: " + path);
    }
  }

  headers(): Record<string, string> {
    return {
      "Accept": "image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5",
      "Referer": "https://m.mh160mh.com/",
    };
  }
}

export function mh160GalleryMetaFromDocument(doc: Document, href: string): GalleryMeta {
  const title = cleanMh160Value(doc.querySelector(".Introduct .h1")?.textContent) || cleanMh160Value(doc.title);
  const meta = new GalleryMeta(href, title);
  for (const row of mh160DetailRows(doc)) {
    const category = mh160RowCategory(row);
    const values = mh160RowValues(row);
    if (!category || values.length === 0) continue;
    meta.tags[category] = values;
    if (isGalleryAuthorCategory(category)) {
      meta.authorUrls.push(...mh160RowUrls(row, href));
    }
  }
  meta.authorUrls = [...new Set(meta.authorUrls)];
  return meta;
}

function mh160DetailRows(doc: Document): Element[] {
  return Array.from(doc.querySelectorAll(".Introduct li, .Introduct p, .Introduct .txtItme, .Introduct .txtItem, .Introduct .item"))
    .filter(row => /[:：]/.test(row.textContent || ""));
}

function mh160RowCategory(row: Element): string {
  const clone = row.cloneNode(true) as Element;
  clone.querySelectorAll("a").forEach(element => element.remove());
  const text = cleanMh160Value(clone.textContent || "");
  return cleanMh160Value(text.match(/^(.+?)[：:]/)?.[1] || "");
}

function mh160RowValues(row: Element): string[] {
  const linkValues = Array.from(row.querySelectorAll("a"))
    .map(element => cleanMh160Value(element.textContent || ""))
    .filter(Boolean);
  const values = linkValues.length ? linkValues : [rowTextAfterCategory(row)];
  return [...new Set(values
    .flatMap(value => value.split(/[、,，/|]/g))
    .map(cleanMh160Value)
    .filter(Boolean))];
}

function rowTextAfterCategory(row: Element): string {
  return cleanMh160Value(cleanMh160Value(row.textContent || "").replace(/^.+?[：:]/, ""));
}

function mh160RowUrls(row: Element, href: string): string[] {
  const urls = Array.from(row.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map(anchor => {
      const raw = anchor.getAttribute("href") || "";
      if (!raw || raw.startsWith("#") || /^javascript:/i.test(raw)) return "";
      try {
        const url = new URL(raw, href);
        return ["http:", "https:"].includes(url.protocol) ? url.href : "";
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return [...new Set(urls)];
}

function cleanMh160Value(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value)
    .replace(/[\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

ADAPTER.addSetup({
  name: "漫画160",
  workURLs: [
    /mh160mh.com\/kanmanhua\/\w+\/$/
  ],
  match: ["https://m.mh160mh.com/kanmanhua/*"],
  constructor: () => new MH160Matcher(),
});
