export class GalleryMeta {
  url: string;
  title?: string;
  originTitle?: string;
  downloader: string;
  tags: Record<string, any[]>;
  authorUrls: string[];
  constructor(url: string, title: string) {
    this.url = url;
    this.title = title;
    this.tags = {};
    this.authorUrls = [];
    this.downloader = "https://github.com/MapoMagpie/comic-looms";
  }
}
