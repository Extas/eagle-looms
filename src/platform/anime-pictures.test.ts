import { describe, expect, it } from 'vitest';
import { collectAnimePicturesImageCandidates, diagnoseAnimePicturesDocument, extractAnimePicturesSourceMetadata, isAnimePicturesChallengeHtml, parseAnimePicturesPostEntries, selectAnimePicturesImageCandidate } from './anime-pictures';

describe('anime-pictures matcher', () => {
  it('parses post cards in stable page order', () => {
    const doc = new DOMParser().parseFromString(`
      <div class="posts">
        <div class="post_content">
          <a href="/posts/917184?lang=en"><img src="/preview/917184.jpg" alt="first image"></a>
          <span>1200x1800 score: 12</span>
        </div>
        <div class="post_content">
          <a href="/posts/917185"><img data-src="//cdn.anime-pictures.net/preview/917185.jpg"></a>
          <span>900 x 1400</span>
        </div>
      </div>
    `, 'text/html');

    const posts = parseAnimePicturesPostEntries(doc, 'https://anime-pictures.net/posts?page=0');
    expect(posts.map((post) => post.id)).toEqual(['917184', '917185']);
    expect(posts[0]).toMatchObject({
      postUrl: 'https://anime-pictures.net/posts/917184?lang=en',
      thumbnailUrl: 'https://anime-pictures.net/preview/917184.jpg',
      width: 1200,
      height: 1800,
      score: '12',
    });
    expect(posts[1].thumbnailUrl).toBe('https://cdn.anime-pictures.net/preview/917185.jpg');
  });

  it('ignores non-result post links below the anime-pictures search grid', () => {
    const doc = new DOMParser().parseFromString(`
      <div class="posts">
        <a href="/posts/1?by_tag=201352&lang=en"><img src="/preview/1.jpg" alt="first"></a>
        <a href="/posts/2?by_tag=201352&lang=en"><img src="/preview/2.jpg" alt="second"></a>
        <a href="/posts/3?by_tag=201352&lang=en"><img src="/preview/3.jpg" alt="third"></a>
      </div>
      <section>
        <h2>Last stars</h2>
        <a href="/posts/999?lang=en"><img src="/preview/999.jpg" alt="unrelated"></a>
      </section>
    `, 'text/html');

    const posts = parseAnimePicturesPostEntries(doc, 'https://anime-pictures.net/posts?page=0&search_tag=bang+dream');
    expect(posts.map(post => post.id)).toEqual(['1', '2', '3']);
  });

  it('ignores anime-pictures Last stars sidebar thumbnails', () => {
    const doc = new DOMParser().parseFromString(`
      <main>
        <a href="/posts/10?by_tag=201352&lang=en"><img src="/preview/10.jpg" alt="result 10"></a>
        <a href="/posts/11?by_tag=201352&lang=en"><img src="/preview/11.jpg" alt="result 11"></a>
      </main>
      <div id="sidebar">
        <div class="sidebar_block">
          <div class="title">Last stars (all) 172</div>
          <div class="last-stars">
            <a href="/posts/900?lang=en"><img src="/preview/900.jpg" alt="sidebar"></a>
            <a href="/posts/901?by_tag=201352&lang=en"><img src="/preview/901.jpg" alt="sidebar same tag"></a>
          </div>
        </div>
      </div>
    `, 'text/html');

    const posts = parseAnimePicturesPostEntries(doc, 'https://anime-pictures.net/posts?page=0&search_tag=bang+dream');
    expect(posts.map(post => post.id)).toEqual(['10', '11']);
  });

  it('reports diagnostics for result pages', () => {
    const doc = new DOMParser().parseFromString(`
      <title>Anime pictures and wallpapers</title>
      <a href="/posts/917184"><img src="/preview/917184.jpg"></a>
      <a href="/posts/917185"><img src="/preview/917185.jpg"></a>
      <a href="/posts/917184">duplicate</a>
    `, 'text/html');

    const diagnostics = diagnoseAnimePicturesDocument(doc, 'https://anime-pictures.net/posts?page=0');
    expect(diagnostics.challengeDetected).toBe(false);
    expect(diagnostics.postAnchorCount).toBe(2);
    expect(diagnostics.postIdsPreview).toEqual(['917184', '917185']);
    expect(diagnostics.imageCandidateCount).toBe(2);
  });

  it('detects Cloudflare challenge pages before parsing', () => {
    const doc = new DOMParser().parseFromString(`
      <html>
        <head>
          <title>请稍候...</title>
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
        </head>
        <body>Cloudflare security verification</body>
      </html>
    `, 'text/html');

    const diagnostics = diagnoseAnimePicturesDocument(doc, 'https://anime-pictures.net/posts?page=0');
    expect(diagnostics.challengeDetected).toBe(true);
    expect(diagnostics.challengeSignals).toContain('challenge-title');
    expect(diagnostics.challengeSignals).toContain('cloudflare-markup');
  });

  it('prefers direct image candidates over API download endpoints and previews', () => {
    const html = `
      <a href="https://api.anime-pictures.net/pictures/download_image/917184-">Download original</a>
      <img src="/pictures/preview/917184.jpg">
      <script>var image = "https:\\/\\/images.anime-pictures.net\\/pictures\\/917184.png"</script>
    `;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const candidates = collectAnimePicturesImageCandidates(doc, html, 'https://anime-pictures.net/posts/917184');
    expect(candidates[0].url).toBe('https://images.anime-pictures.net/pictures/917184.png');
    expect(candidates.map(candidate => candidate.url)).toContain('https://api.anime-pictures.net/pictures/download_image/917184-');
  });

  it('adds an API download fallback and switches candidates on retry', () => {
    const html = `<script>var image = "https:\\/\\/oimages.anime-pictures.net\\/fd3\\/image.png?if=source.png"</script>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const candidates = collectAnimePicturesImageCandidates(doc, html, 'https://anime-pictures.net/posts/917184');
    const first = selectAnimePicturesImageCandidate(candidates, new Set());

    expect(candidates.map(candidate => candidate.url)).toContain('https://api.anime-pictures.net/pictures/download_image/917184-');
    expect(first?.url).toBeTruthy();

    const second = selectAnimePicturesImageCandidate(candidates, new Set([first!.url]));
    expect(second?.url).toBeTruthy();
    expect(second?.url).not.toBe(first?.url);
  });

  it('detects image-host Cloudflare challenge HTML without logging the full document', () => {
    expect(isAnimePicturesChallengeHtml(`
      <html>
        <head><title>Just a moment...</title></head>
        <body><script src="https://challenges.cloudflare.com/challenge.js"></script></body>
      </html>
    `, 'https://oimages.anime-pictures.net/image.png')).toBe(true);
  });

  it('extracts namespaced source tags and author urls from post detail pages', () => {
    const doc = new DOMParser().parseFromString(`
      <aside>
        <h2>Tags</h2>
        <span>game copyright</span>
        <a href="/posts?search_tag=project+sekai">project sekai</a><span>403</span>
        <span>character</span>
        <a href="/posts?search_tag=kusanagi+nene">kusanagi nene</a><span>26</span>
        <span>author</span>
        <a href="/posts?search_tag=soha+blan">soha blan</a><span>11</span>
        <span>reference</span>
        <a href="/posts?search_tag=single">single</a>
      </aside>
      <section>
        <h2>About artists</h2>
        <b>soha blan:</b>
        <a href="https://www.pixiv.net/users/81925632">https://www.pixiv.net/users/81925632</a>
        <a href="https://twitter.com/soha_blan">https://twitter.com/soha_blan</a>
      </section>
    `, 'text/html');

    expect(extractAnimePicturesSourceMetadata(doc, 'https://anime-pictures.net/posts/908175')).toEqual({
      tags: ['copyright:project sekai', 'character:kusanagi nene', 'author:soha blan', 'single'],
      authorUrls: ['https://www.pixiv.net/users/81925632', 'https://twitter.com/soha_blan'],
    });
  });
});
