import { describe, expect, it } from 'vitest';
import { animePicturesApiDetailUrl, animePicturesApiPostsUrl, collectAnimePicturesImageCandidates, diagnoseAnimePicturesDocument, extractAnimePicturesSourceMetadata, isAnimePicturesChallengeHtml, parseAnimePicturesApiDetail, parseAnimePicturesApiPosts, parseAnimePicturesPostEntries, selectAnimePicturesImageCandidate, validateAnimePicturesImagePayload } from './anime-pictures';

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

  it('keeps the first 100 search results across variable source page sizes', () => {
    const page = (start: number, count: number) => new DOMParser().parseFromString(`
      <main>
        ${Array.from({ length: count }, (_, index) => {
          const id = String(start + index);
          return `<a href="/posts/${id}?by_tag=201352&lang=en"><img src="/preview/${id}.jpg"></a>`;
        }).join('')}
      </main>
    `, 'text/html');

    const firstPage = parseAnimePicturesPostEntries(page(100000, 80), 'https://anime-pictures.net/posts?page=0&search_tag=bang+dream', 100);
    const secondPage = parseAnimePicturesPostEntries(page(200000, 69), 'https://anime-pictures.net/posts?page=1&search_tag=bang+dream', 100 - firstPage.length);
    const posts = [...firstPage, ...secondPage];

    expect(posts).toHaveLength(100);
    expect(posts[0].id).toBe('100000');
    expect(posts[79].id).toBe('100079');
    expect(posts[99].id).toBe('200019');
    expect(new Set(posts.map(post => post.id)).size).toBe(100);
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

  it('keeps standalone stars pages while excluding only sidebar recommendations', () => {
    const doc = new DOMParser().parseFromString(`
      <div class="last-stars">
        <a href="/posts/21?lang=en"><img src="/preview/21.jpg" alt="star 21"></a>
        <a href="/posts/22?lang=en"><img src="/preview/22.jpg" alt="star 22"></a>
      </div>
    `, 'text/html');

    const posts = parseAnimePicturesPostEntries(doc, 'https://anime-pictures.net/stars?page=0&lang=en');
    expect(posts.map(post => post.id)).toEqual(['21', '22']);
  });

  it('supports legacy anime-pictures view_post links', () => {
    const doc = new DOMParser().parseFromString(`
      <a href="/pictures/view_post/917184?lang=en"><img src="/preview/917184.jpg" alt="legacy"></a>
    `, 'text/html');

    const posts = parseAnimePicturesPostEntries(doc, 'https://anime-pictures.net/pictures/view_posts/0?lang=en');
    expect(posts[0]).toMatchObject({
      id: '917184',
      postUrl: 'https://anime-pictures.net/pictures/view_post/917184?lang=en',
    });
  });

  it('imports only the current image from single post detail pages', () => {
    const doc = new DOMParser().parseFromString(`
      <title>Anime picture 908175</title>
      <div class="post_content"><img src="https://oavatars.anime-pictures.net/user.png" alt="uploader avatar"></div>
      <a itemprop="contentURL" href="https://api.anime-pictures.net/pictures/get_image/908175-image.png">
        <picture><img id="big_preview" itemprop="thumbnailUrl" src="https://opreviews.anime-pictures.net/abc/908175_bp.avif"></picture>
      </a>
      <span>3000x3000</span>
      <section>
        <h2>(A) Similar to</h2>
        <a href="/posts/999001?lang=en"><img src="https://opreviews.anime-pictures.net/999/999001_sp.avif"></a>
        <a href="/posts/999002?lang=en"><img src="https://opreviews.anime-pictures.net/999/999002_sp.avif"></a>
      </section>
    `, 'text/html');

    const posts = parseAnimePicturesPostEntries(doc, 'https://anime-pictures.net/posts/908175?lang=en');
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({
      id: '908175',
      thumbnailUrl: 'https://opreviews.anime-pictures.net/abc/908175_bp.avif',
      width: 3000,
      height: 3000,
    });
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

  it('normalizes image MIME types from the returned bytes', () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
      0x00, 0x00, 0x00, 0x00,
    ]);

    expect(validateAnimePicturesImagePayload(
      png,
      'application/octet-stream',
      'https://images.anime-pictures.net/pictures/example.png',
    )).toBe('image/png');
  });

  it('rejects challenge HTML even when the image host mislabels it as JPEG', () => {
    const response = new TextEncoder().encode(`
      <!doctype html>
      <html>
        <head><title>Just a moment...</title></head>
        <body><script src="https://challenges.cloudflare.com/challenge.js"></script></body>
      </html>
    `);

    expect(() => validateAnimePicturesImagePayload(
      response,
      'image/jpeg',
      'https://images.anime-pictures.net/pictures/example.jpg',
    )).toThrow(/Cloudflare challenge/);
  });

  it('rejects truncated images before the full-size view marks them complete', () => {
    const truncatedJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    expect(() => validateAnimePicturesImagePayload(
      truncatedJpeg,
      'image/jpeg',
      'https://images.anime-pictures.net/pictures/example.jpg',
    )).toThrow(/truncated JPEG/);
  });

  it('extracts namespaced source tags and author urls from post detail pages', () => {
    const doc = new DOMParser().parseFromString(`
      <time datetime="2025-07-08T12:34:56Z">8 July 2025</time>
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
      publishedAt: '2025-07-08T12:34:56Z',
    });
  });

  it('extracts metadata from the current anime-pictures detail layout', () => {
    const doc = new DOMParser().parseFromString(`
      <span class="info-item"><span class="light">Date upload:</span> 05/25/2026 3:06 AM</span>
      <span class="info-item"><span class="light">Date published:</span> 05/25/2026 6:00 AM</span>
      <aside>
        <div>Tags</div>
        <span>game copyright</span>
        <a href="/posts?search_tag=bakemonogatari">bakemonogatari</a><span>100</span>
        <span>other copyright</span>
        <a href="/posts?search_tag=shaft">shaft (studio)</a><span>20</span>
        <a href="/posts?search_tag=monogatari">monogatari (series)</a><span>30</span>
        <span>character</span>
        <a href="/posts?search_tag=oshino+shinobu">oshino shinobu</a><span>40</span>
        <span>author</span>
        <a href="/posts?search_tag=juu+roku+gen">juu roku gen</a><span>5</span>
        <span>reference</span>
        <a href="/posts?search_tag=single">single</a><span>500</span>
      </aside>
      <div class="post_content">
        <div class="title">About artists</div>
        <div class="body">
          <meta itemprop="author" content="juu roku gen">
          <strong>juu roku gen:</strong><br>
          <a href="https://www.pixiv.net/users/3658789">https://www.pixiv.net/users/3658789</a>
        </div>
      </div>
    `, 'text/html');

    expect(extractAnimePicturesSourceMetadata(doc, 'https://anime-pictures.net/posts/919002?lang=en')).toEqual({
      tags: [
        'copyright:bakemonogatari',
        'copyright:shaft (studio)',
        'copyright:monogatari (series)',
        'character:oshino shinobu',
        'author:juu roku gen',
        'single',
      ],
      authorUrls: ['https://www.pixiv.net/users/3658789'],
      publishedAt: '2026-05-25 6:00 AM',
    });
  });

  it('normalizes decorated anime-pictures tag categories from detail pages', () => {
    const doc = new DOMParser().parseFromString(`
      <aside>
        <h2>Tags</h2>
        <span>game_copyright:</span>
        <a href="/posts?search_tag=project+sekai">project sekai</a><span>403</span>
        <span>Character(s):</span>
        <a href="/posts?search_tag=kusanagi+nene">kusanagi nene</a><span>26</span>
        <span>Artist(s):</span>
        <a href="/posts?search_tag=soha+blan">soha blan</a><span>11</span>
        <span>Series:</span>
        <a href="/posts?search_tag=bang+dream">bang dream</a>
        <span>reference</span>
        <a href="/posts?search_tag=single">single</a>
      </aside>
    `, 'text/html');

    expect(extractAnimePicturesSourceMetadata(doc, 'https://anime-pictures.net/posts/908175').tags).toEqual([
      'copyright:project sekai',
      'character:kusanagi nene',
      'author:soha blan',
      'copyright:bang dream',
      'single',
    ]);
  });

  it('builds anime-pictures API URLs from page state', () => {
    expect(animePicturesApiPostsUrl('https://anime-pictures.net/posts?page=2&lang=en&search_tag=project+sekai&order_by=star_date')).toBe(
      'https://api.anime-pictures.net/api/v3/posts?page=2&lang=en&ldate=0&search_tag=project+sekai&order_by=star_date',
    );
    expect(animePicturesApiDetailUrl('908175')).toBe('https://api.anime-pictures.net/api/v3/posts/908175');
  });

  it('maps anime-pictures API post payloads into import metadata', () => {
    const payload = {
      posts: [{
        id: 908175,
        width: 3000,
        height: 3000,
        ext: '.png',
        md5: 'abcdef0123456789',
        file_url: 'abc/abcdef0123456789.png',
        created_at: '2025-07-08T12:34:56Z',
        tags: [
          { tag: { tag: 'project sekai', type: 'game copyright' } },
          { tag: { tag: 'kusanagi nene', type: 'character' } },
          { tag: { tag: 'soha blan', type: 'artist' } },
          { tag: { tag: 'bang dream', type: 'series' } },
          { tag: { tag: 'scenario name', type: 'Writer(s)' } },
          { tag: { tag: 'purple eyes', type: 'reference' } },
        ],
      }],
    };

    expect(parseAnimePicturesApiPosts(payload, 'https://anime-pictures.net/posts?page=0')).toEqual([{
      id: '908175',
      postUrl: 'https://anime-pictures.net/posts/908175',
      thumbnailUrl: 'https://opreviews.anime-pictures.net/abc/abcdef0123456789_cp.avif',
      title: 'anime-pictures-908175.png',
      publishedAt: '2025-07-08T12:34:56Z',
      width: 3000,
      height: 3000,
      ext: 'png',
      fileUrl: 'https://api.anime-pictures.net/pictures/get_image/abc/abcdef0123456789.png',
      tags: ['copyright:project sekai', 'character:kusanagi nene', 'author:soha blan', 'copyright:bang dream', 'author:scenario name', 'purple eyes'],
    }]);
    expect(parseAnimePicturesApiDetail(payload.posts[0], 'https://anime-pictures.net/posts/908175')?.fileUrl).toBe(
      'https://api.anime-pictures.net/pictures/get_image/abc/abcdef0123456789.png',
    );
  });
});
