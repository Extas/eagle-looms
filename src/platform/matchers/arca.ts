import { GalleryMeta } from '../../download/gallery-meta';
import ImageNode from '../../img-node';
import { arcaGalleryMetaFromDocument, arcaPublishedAtFromDocument } from '../../eagle/adapters/arca';
import { ADAPTER } from '../adapt';
import { BaseMatcher, Result, OriginMeta } from '../platform';

class ArcaMatcher extends BaseMatcher<Document> {
  async *fetchPagesSource(): AsyncGenerator<Result<Document>> {
    yield Result.ok(document);
  }
  async parseImgNodes(doc: Document): Promise<ImageNode[]> {
    const imageString = '.article-content img:not(.arca-emoticon):not(.twemoji)';
    const videoString = '.article-content video:not(.arca-emoticon)';
    const publishedAt = arcaPublishedAtFromDocument(doc);

    const elements = Array.from(doc.querySelectorAll<HTMLElement>(`${imageString}, ${videoString}`));
    const nodes: ImageNode[] = [];
    const digits = elements.length.toString().length;

    elements.forEach((element, i) => {
      if (element.tagName.toLowerCase() === 'img') {
        const img = element as HTMLImageElement;
        if (img.src && img.style.width !== '0px') {
          const src = img.src;
          const href = new URL(src);
          const ext = href.pathname.split('.').pop();
          href.searchParams.set('type', 'orig');
          const title = (i + 1).toString().padStart(digits, '0') + '.' + ext;
          const node = new ImageNode(src, href.href, title, undefined, href.href);
          node.setPublishedAt(publishedAt);
          nodes.push(node);
        }
      } else if (element.tagName.toLowerCase() === 'video') {
        const video = element as HTMLVideoElement;
        if (video.src) {
          const src = video.src;
          const href = new URL(src);
          const ext = href.pathname.split('.').pop();
          href.searchParams.set('type', 'orig');
          const title = (i + 1).toString().padStart(digits, '0') + '.' + ext;
          const poster = video.poster || '';
          const node = new ImageNode(poster, href.href, title, undefined, href.href);
          node.setPublishedAt(publishedAt);
          nodes.push(node);
        }
      }
    });

    return nodes;
  }
  async fetchOriginMeta(node: ImageNode): Promise<OriginMeta> {
    return { url: node.href };
  }

  galleryMeta(): GalleryMeta {
    return arcaGalleryMetaFromDocument(document, window.location.href);
  }
}

ADAPTER.addSetup({
  name: "Arcalive",
  workURLs: [
    /arca.live\/b\/\w*\/\d+/
  ],
  match: ["https://arca.live/*"],
  constructor: () => new ArcaMatcher(),
});
