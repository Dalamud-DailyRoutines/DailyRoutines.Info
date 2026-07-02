import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import matter from 'gray-matter';

const rootDir = process.cwd();
const articlesDir = path.join(rootDir, 'articles');
const assetsDir = path.join(rootDir, 'assets');
const generatedDir = path.join(rootDir, '.astro', 'generated');
const siteDataSnapshotPath = path.join(generatedDir, 'site-data.json');
const require = createRequire(import.meta.url);
const gitDatesCache = new Map();
let gitDatesLoaded = false;
let siteDataCache;

export const LOCALES = [
  { key: 'root', code: 'zh', lang: 'zh-CN', dir: '', routePrefix: '' },
  { key: 'en', code: 'en', lang: 'en', dir: 'en', routePrefix: '/en' },
  { key: 'ja', code: 'ja', lang: 'ja-JP', dir: 'ja', routePrefix: '/ja' },
  { key: 'ko', code: 'ko', lang: 'ko-KR', dir: 'ko', routePrefix: '/ko' }
];

export const LOCALE_KEYS = LOCALES.map((locale) => locale.key);
export const DEFAULT_LOCALE = 'root';

export const CATEGORY_CONFIGS = [
  {
    sourceDir: 'Changelog',
    slug: 'changelog',
    order: 100,
    titles: {
      root: '更新日志',
      en: 'Changelog',
      ja: '更新履歴',
      ko: '업데이트 내역'
    },
    descriptions: {
      root: '版本更新记录、新增模块与重要行为变更。',
      en: 'Release notes, new modules, and important behavior changes.',
      ja: 'リリースノート、新規モジュール、重要な変更点です。',
      ko: '버전 업데이트 기록, 신규 모듈, 중요한 동작 변경 사항을 정리했습니다.'
    }
  },
  {
    sourceDir: 'FAQ',
    slug: 'faq',
    order: 90,
    titles: {
      root: '常见问题',
      en: 'FAQ',
      ja: 'よくある質問',
      ko: '자주 묻는 질문'
    },
    descriptions: {
      root: '常见问题、排查方案与日常使用说明。',
      en: 'Frequently asked questions, troubleshooting, and usage guides.',
      ja: 'よくある質問、トラブルシューティング、日常的な利用ガイドです。',
      ko: '자주 묻는 질문, 문제 해결 방법, 일상적인 사용 가이드를 모았습니다.'
    }
  },
  {
    sourceDir: 'Development',
    slug: 'development',
    order: 80,
    titles: {
      root: '开发文档',
      en: 'Developer',
      ja: '開発ドキュメント',
      ko: '개발 문서'
    },
    descriptions: {
      root: 'IPC 与开发集成相关说明。',
      en: 'IPC and development integration references.',
      ja: 'IPC と開発連携に関する資料です。',
      ko: 'IPC 및 개발 연동과 관련된 참고 자료입니다.'
    }
  },
  {
    sourceDir: 'Others',
    slug: 'others',
    order: 10,
    titles: {
      root: '其他内容',
      en: 'Others',
      ja: 'その他',
      ko: '기타'
    },
    descriptions: {
      root: '补充资料与其他整理内容。',
      en: 'Supplementary notes and other curated content.',
      ja: '補足資料やその他の整理済みコンテンツです。',
      ko: '보충 자료와 기타 정리된 콘텐츠입니다.'
    }
  }
];

const ALERT_LABELS = {
  root: {
    note: '注意',
    tip: '提示',
    important: '重要',
    warning: '警告',
    caution: '谨慎'
  },
  en: {
    note: 'Note',
    tip: 'Tip',
    important: 'Important',
    warning: 'Warning',
    caution: 'Caution'
  },
  ja: {
    note: '注意',
    tip: 'ヒント',
    important: '重要',
    warning: '警告',
    caution: '注意'
  },
  ko: {
    note: '참고',
    tip: '팁',
    important: '중요',
    warning: '경고',
    caution: '주의'
  }
};

function walkMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return walkMarkdownFiles(fullPath);
      }
      return entry.isFile() && entry.name.endsWith('.md') ? [fullPath] : [];
    });
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const imageDimensionCache = new Map();

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getPngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function getGifDimensions(buffer) {
  if (buffer.length < 10 || buffer.toString('ascii', 0, 3) !== 'GIF') {
    return null;
  }

  return {
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8)
  };
}

function resolveImageDimensions(assetPath) {
  const normalizedAssetPath = normalizeToPosixPath(assetPath);
  const cachedDimensions = imageDimensionCache.get(normalizedAssetPath);
  if (cachedDimensions) {
    return cachedDimensions;
  }

  const fullPath = path.join(rootDir, normalizedAssetPath.replace(/^\/+/u, ''));
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const buffer = fs.readFileSync(fullPath);
  const extension = path.extname(fullPath).toLowerCase();
  const dimensions =
    extension === '.png' ? getPngDimensions(buffer) :
    extension === '.gif' ? getGifDimensions(buffer) :
    null;

  if (dimensions) {
    imageDimensionCache.set(normalizedAssetPath, dimensions);
  }

  return dimensions;
}

function detectLocale(filename) {
  const match = filename.match(/\.([a-z]{2})\.md$/i);
  if (!match) {
    return DEFAULT_LOCALE;
  }

  const [, code] = match;
  return code === 'en' || code === 'ja' || code === 'ko' ? code : DEFAULT_LOCALE;
}

function stripLanguageSuffix(filename) {
  return filename.replace(/\.(en|ja|ko)\.md$/i, '.md').replace(/\.md$/i, '');
}

function encodeRouteSegment(value) {
  return encodeURIComponent(value).replace(/%2F/gi, '/');
}

function compareVersionLabels(left, right) {
  const normalize = (value) => value.replace(/^[vV]/, '').split(/[^\d]+/).filter(Boolean).map(Number);
  const leftParts = normalize(left);
  const rightParts = normalize(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const diff = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }

  return left.localeCompare(right, 'en');
}

function compareArticles(category, left, right) {
  if (category.slug === 'changelog') {
    return compareVersionLabels(left.baseName, right.baseName);
  }

  return left.baseName.localeCompare(right.baseName, 'zh-Hans-CN', { numeric: true });
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/^\s{0,3}>\s*\[![^\]]+\]\s*$/gim, ' ')
    .replace(/^:::[^\n]*$/gm, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildExcerpt(markdown) {
  const paragraphs = markdown
    .replace(/^\s{0,3}>\s*\[![^\]]+\]\s*$/gim, '')
    .split(/\n{2,}/)
    .map((section) => stripMarkdown(section))
    .filter(Boolean);

  return (paragraphs[0] ?? '').slice(0, 140);
}

function quoteYaml(value) {
  return JSON.stringify(value ?? '');
}

function formatDateValue(value) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeToPosixPath(value) {
  return value.replace(/\\/g, '/');
}

function buildFallbackDates(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const iso = new Date(stat.mtimeMs).toISOString();
    return {
      date: iso.slice(0, 10),
      lastUpdated: iso
    };
  } catch {
    const fallback = new Date().toISOString();
    return {
      date: fallback.slice(0, 10),
      lastUpdated: fallback
    };
  }
}

function loadGitDatesCache() {
  if (gitDatesLoaded) {
    return;
  }

  gitDatesLoaded = true;

  try {
    const { execFileSync } = require('node:child_process');
    const output = execFileSync(
      'git',
      ['log', '--name-only', '--pretty=format:__DR_COMMIT__%aI', '--', 'articles'],
      {
        cwd: rootDir,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 64
      }
    );

    let currentCommitDate = '';
    for (const rawLine of output.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (line.startsWith('__DR_COMMIT__')) {
        currentCommitDate = line.slice('__DR_COMMIT__'.length).trim();
        continue;
      }

      if (!currentCommitDate || !line.endsWith('.md')) {
        continue;
      }

      const normalizedPath = normalizeToPosixPath(line);
      const currentEntry = gitDatesCache.get(normalizedPath);
      if (!currentEntry) {
        gitDatesCache.set(normalizedPath, {
          date: currentCommitDate.slice(0, 10),
          lastUpdated: currentCommitDate
        });
        continue;
      }

      currentEntry.date = currentCommitDate.slice(0, 10);
    }
  } catch {
    // git 不可用或历史不存在时，后续会退回到文件时间
  }
}

function getGitDates(relativePath, filePath) {
  loadGitDatesCache();
  const normalizedPath = normalizeToPosixPath(relativePath);
  const fromGit = gitDatesCache.get(normalizedPath);

  if (fromGit) {
    return fromGit;
  }

  const fallbackDates = buildFallbackDates(filePath);
  gitDatesCache.set(normalizedPath, fallbackDates);
  return fallbackDates;
}

function normalizeMediaStyle(styleValue) {
  const filtered = styleValue
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^(width|max-width|display|margin|margin-inline|margin-left|margin-right)\s*:/i.test(part));

  return filtered.join('; ');
}

function transformMarkdownImages(markdown) {
  return markdown.replace(/!\[([^\]]*)\]\((\/assets\/[^)\s]+)(?:\s+"([^"]*)")?\)/g, (_match, alt, src, title) => {
    const dimensions = resolveImageDimensions(src);
    const attrs = [
      `src="${escapeHtml(src)}"`,
      `alt="${escapeHtml(alt || '')}"`,
      'loading="lazy"',
      'decoding="async"',
      'data-dr-zoomable="true"'
    ];

    if (dimensions) {
      attrs.push(`width="${dimensions.width}"`, `height="${dimensions.height}"`);
    }

    if (title) {
      attrs.push(`title="${escapeHtml(title)}"`);
    }

    return `<img ${attrs.join(' ')}>`;
  });
}

function transformVideos(markdown) {
  return markdown.replace(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi, (_match, rawAttrs, inner) => {
    let attrs = rawAttrs ?? '';

    if (/style\s*=\s*"([^"]*)"/i.test(attrs)) {
      attrs = attrs.replace(/style\s*=\s*"([^"]*)"/i, (_styleMatch, styleValue) => {
        const normalizedStyle = normalizeMediaStyle(styleValue);
        return normalizedStyle ? `style="${normalizedStyle}"` : '';
      });
    }

    if (!/\bpreload\s*=/i.test(attrs)) {
      attrs += ' preload="metadata"';
    }

    if (!/\bplaysinline\b/i.test(attrs)) {
      attrs += ' playsinline';
    }

    if (!/\bdata-dr-video\s*=/i.test(attrs)) {
      attrs += ' data-dr-video="true"';
    }

    return `<video${attrs}>${inner}</video>`;
  });
}

function buildImageComparison(beforeImgHtml, afterImgHtml) {
  return [
    '<div class="dr-img-comp">',
    '  <div class="dr-img-comp__after">',
    `    ${afterImgHtml}`,
    '  </div>',
    '  <div class="dr-img-comp__before">',
    `    ${beforeImgHtml}`,
    '  </div>',
    '  <div class="dr-img-comp__slider">',
    '    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/><path d="m15 18-6-6 6-6"/></svg>',
    '  </div>',
    '</div>',
    ''
  ].join('\n');
}

function buildImageGallery(imgHtmls) {
  const slides = imgHtmls.map((img) =>
    `    <div class="dr-img-gallery__slide">${img}</div>`
  ).join('\n');

  const dots = imgHtmls.map((_, i) =>
    `    <button class="dr-img-gallery__dot" aria-label="第${i + 1}张" data-dr-index="${i}"></button>`
  ).join('\n');

  return [
    '<div class="dr-img-gallery" role="region" aria-label="图片轮播" tabindex="0">',
    '  <div class="dr-img-gallery__viewport">',
    '    <div class="dr-img-gallery__track">',
    slides,
    '    </div>',
    '  </div>',
    '  <button class="dr-img-gallery__prev" aria-label="上一张">',
    '    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
    '  </button>',
    '  <button class="dr-img-gallery__next" aria-label="下一张">',
    '    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
    '  </button>',
    '  <div class="dr-img-gallery__counter"></div>',
    '  <div class="dr-img-gallery__dots">',
    dots,
    '  </div>',
    '</div>',
    ''
  ].join('\n');
}

function transformImageGalleryContainers(markdown) {
  const lines = markdown.split(/\r?\n/);
  const result = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim() === ':::img-gallery') {
      i++;
      const inner = [];
      while (i < lines.length && lines[i].trim() !== ':::') {
        inner.push(lines[i]);
        i++;
      }
      i++;

      const innerMd = inner.join('\n');
      const processed = transformMarkdownImages(innerMd);
      const imgs = [...processed.matchAll(/<img\b[^>]*>/gi)];

      if (imgs.length === 1) {
        result.push(processed);
        continue;
      }

      if (imgs.length > 1) {
        const stripAttrs = (html) => html
          .replace(/\bwidth="[^"]*"\s*/gi, '')
          .replace(/\bheight="[^"]*"\s*/gi, '')
          .trim();
        const imgHtmls = imgs.map((m) => stripAttrs(m[0]));
        result.push(buildImageGallery(imgHtmls));
        continue;
      }

      result.push(':::img-gallery', ...inner, ':::');
      continue;
    }

    result.push(lines[i]);
    i++;
  }

  return result.join('\n');
}

function transformImageComparisonContainers(markdown) {
  const lines = markdown.split(/\r?\n/);
  const result = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim() === ':::img-comp') {
      i++;
      const inner = [];
      while (i < lines.length && lines[i].trim() !== ':::') {
        inner.push(lines[i]);
        i++;
      }
      i++;

      const innerMd = inner.join('\n');
      const processed = transformMarkdownImages(innerMd);
      const imgs = [...processed.matchAll(/<img\b[^>]*>/gi)];

      if (imgs.length === 2) {
        const stripAttrs = (html) => html
          .replace(/\bdata-dr-zoomable="true"\s*/gi, '')
          .replace(/\bwidth="[^"]*"\s*/gi, '')
          .replace(/\bheight="[^"]*"\s*/gi, '')
          .trim();
        const beforeImg = stripAttrs(imgs[0][0]);
        const afterImg = stripAttrs(imgs[1][0]);
        result.push(buildImageComparison(beforeImg, afterImg));
        continue;
      }

      result.push(':::img-comp', ...inner, ':::');
      continue;
    }

    result.push(lines[i]);
    i++;
  }

  return result.join('\n');
}

function transformRichMedia(markdown) {
  return transformVideos(transformMarkdownImages(transformImageComparisonContainers(transformImageGalleryContainers(markdown))));
}

function transformGithubAlerts(markdown, localeKey) {
  const labels = ALERT_LABELS[localeKey] ?? ALERT_LABELS.root;
  const lines = markdown.split(/\r?\n/);
  const transformed = [];
  let fence = null;

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);

    if (fenceMatch) {
      const currentFence = fenceMatch[1];
      if (!fence) {
        fence = currentFence;
      } else if (currentFence[0] === fence[0] && currentFence.length >= fence.length) {
        fence = null;
      }
      transformed.push(line);
      index += 1;
      continue;
    }

    if (!fence) {
      const alertMatch = line.match(/^\s{0,3}>\s*\[!([a-z]+)\]\s*$/i);
      if (alertMatch) {
        const alertType = alertMatch[1].toLowerCase();
        const mappedType =
          alertType === 'tip' ? 'tip' :
          alertType === 'important' ? 'note' :
          alertType === 'warning' || alertType === 'caution' ? 'caution' :
          'note';

        const title = labels[alertType] ?? labels.note;
        const contentLines = [];
        index += 1;

        while (index < lines.length) {
          const contentLine = lines[index];
          if (!/^\s{0,3}>/.test(contentLine)) {
            break;
          }
          contentLines.push(contentLine.replace(/^\s{0,3}>\s?/, ''));
          index += 1;
        }

        transformed.push(`:::${mappedType}[${title}]`);
        if (contentLines.length > 0) {
          transformed.push(...contentLines);
        }
        transformed.push(':::');
        transformed.push('');
        continue;
      }
    }

    transformed.push(line);
    index += 1;
  }

  return transformed.join('\n').trim();
}

function createDocFrontmatter(metadata) {
  return [
    '---',
    `title: ${quoteYaml(metadata.title)}`,
    metadata.description ? `description: ${quoteYaml(metadata.description)}` : null,
    metadata.lastUpdated ? `lastUpdated: ${formatDateValue(metadata.lastUpdated)}` : null,
    '---',
    ''
  ].filter(Boolean).join('\n');
}

function createOverviewContent(localeKey, category, articles) {
  const titles = {
    root: {
      introTitle: '分类说明',
      articleTitle: '文章列表',
      empty: '当前分类暂时还没有文章。'
    },
    en: {
      introTitle: 'Overview',
      articleTitle: 'Articles',
      empty: 'There are no articles in this section yet.'
    },
    ja: {
      introTitle: '概要',
      articleTitle: '記事一覧',
      empty: 'このカテゴリにはまだ記事がありません。'
    },
    ko: {
      introTitle: '개요',
      articleTitle: '문서 목록',
      empty: '이 분류에는 아직 문서가 없습니다.'
    }
  }[localeKey];

  const description = getLocalizedValue(category.descriptions, localeKey);
  const visibleArticles = getVisibleArticles(articles, localeKey);
  const articleItems = visibleArticles.map((article) => {
    const articleMeta = article.translations[localeKey] ?? article.translations.root;
    const suffix = article.date ? ` · ${article.date}` : '';
    return `- [${articleMeta.title}](./${article.slug}/)${suffix}`;
  });

  return [
    `## ${titles.introTitle}`,
    '',
    description,
    '',
    `## ${titles.articleTitle}`,
    '',
    articleItems.length > 0 ? articleItems.join('\n') : titles.empty,
    ''
  ].join('\n');
}

function createDocsHomeContent(localeKey, siteData) {
  const labels = {
    root: {
      intro: '这里集中整理了 Daily Routines 的常见问题、更新日志、开发资料与其他补充内容。',
      categoryTitle: '内容分区',
      latestTitle: '最近更新'
    },
    en: {
      intro: 'This site collects Daily Routines FAQs, changelogs, developer references, and supplemental notes.',
      categoryTitle: 'Sections',
      latestTitle: 'Latest Updates'
    },
    ja: {
      intro: 'このサイトでは、Daily Routines の FAQ、更新履歴、開発資料、補足情報をまとめています。',
      categoryTitle: 'カテゴリ',
      latestTitle: '最近の更新'
    },
    ko: {
      intro: '이 사이트에서는 Daily Routines 의 FAQ, 업데이트 내역, 개발 자료, 보충 정보를 한곳에서 확인할 수 있습니다.',
      categoryTitle: '분류',
      latestTitle: '최근 업데이트'
    }
  }[localeKey];

  const changelogCategory = siteData.categories.find((category) => category.slug === 'changelog');
  const latestItems = getVisibleArticles(changelogCategory?.articles ?? [], localeKey).slice(0, 8).map((article) => {
    const articleMeta = article.translations[localeKey] ?? article.translations.root;
    return `- [${articleMeta.title}](${buildDocsArticleLink(localeKey, 'changelog', article.slug)})`;
  });

  return [
    labels.intro,
    '',
    `## ${labels.categoryTitle}`,
    '',
    ...siteData.categories.map((category) => {
      const title = getLocalizedValue(category.titles, localeKey);
      const description = getLocalizedValue(category.descriptions, localeKey);
      return `- [${title}](${buildDocsCategoryLink(localeKey, category.slug)})\n  ${description}`;
    }),
    '',
    `## ${labels.latestTitle}`,
    '',
    latestItems.join('\n'),
    ''
  ].join('\n');
}

export function buildDocsCategoryLink(localeKey, categorySlug) {
  const locale = LOCALES.find((entry) => entry.key === localeKey) ?? LOCALES[0];
  return `${locale.routePrefix}/docs/${categorySlug}/`;
}

export function buildDocsHomeLink(localeKey) {
  const locale = LOCALES.find((entry) => entry.key === localeKey) ?? LOCALES[0];
  return `${locale.routePrefix}/docs/`;
}

export function buildDocsArticleLink(localeKey, categorySlug, articleSlug) {
  const locale = LOCALES.find((entry) => entry.key === localeKey) ?? LOCALES[0];
  return `${locale.routePrefix}/docs/${categorySlug}/${encodeRouteSegment(articleSlug)}/`;
}

export function buildSiteHomeLink(localeKey) {
  const locale = LOCALES.find((entry) => entry.key === localeKey) ?? LOCALES[0];
  return locale.routePrefix || '/';
}

export function getLocalizedValue(values, localeKey) {
  return values?.[localeKey] ?? values?.[DEFAULT_LOCALE] ?? '';
}

export function getVisibleArticles(articles, localeKey) {
  if (localeKey === DEFAULT_LOCALE) {
    return articles;
  }

  return articles.filter((article) => article.translations[localeKey]);
}

function readSiteDataSnapshot() {
  if (!fs.existsSync(siteDataSnapshotPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(siteDataSnapshotPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.categories)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeSiteDataSnapshot(siteData) {
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(siteDataSnapshotPath, JSON.stringify(siteData), 'utf8');
}

export function getSiteData() {
  if (siteDataCache) {
    return siteDataCache;
  }

  const snapshot = readSiteDataSnapshot();
  if (snapshot) {
    siteDataCache = snapshot;
    return siteDataCache;
  }

  return buildSiteData();
}

export function buildSiteData() {
  if (siteDataCache) {
    return siteDataCache;
  }

  const categories = CATEGORY_CONFIGS.map((categoryConfig) => {
    const directory = path.join(articlesDir, categoryConfig.sourceDir);
    const groupedArticles = new Map();

    for (const filePath of walkMarkdownFiles(directory)) {
      const filename = path.basename(filePath);
      const localeKey = detectLocale(filename);
      const baseName = stripLanguageSuffix(filename);
      const raw = readUtf8(filePath);
      const { data, content } = matter(raw);
      const relativePath = path.relative(rootDir, filePath);
      const { date, lastUpdated } = getGitDates(relativePath, filePath);
      const slug = baseName;

      if (!groupedArticles.has(baseName)) {
        groupedArticles.set(baseName, {
          baseName,
          slug,
          date,
          lastUpdated,
          translations: {}
        });
      }

      const article = groupedArticles.get(baseName);
      article.date = article.date || date;
      article.lastUpdated =
        new Date(lastUpdated).getTime() > new Date(article.lastUpdated).getTime()
          ? lastUpdated
          : article.lastUpdated;

      article.translations[localeKey] = {
        localeKey,
        title: data.title?.toString().trim() || baseName,
        description: data.description?.toString().trim() || buildExcerpt(content),
        content: transformRichMedia(transformGithubAlerts(content.trim(), localeKey)),
        filePath,
        relativePath,
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        lastUpdated,
        date
      };
    }

    const articles = Array.from(groupedArticles.values())
      .sort((left, right) => compareArticles(categoryConfig, left, right));

    const latestUpdate = articles.reduce((latest, article) => {
      return new Date(article.lastUpdated).getTime() > new Date(latest).getTime()
        ? article.lastUpdated
        : latest;
    }, new Date().toISOString());

    return {
      ...categoryConfig,
      articles,
      articleCount: articles.length,
      latestUpdate
    };
  }).sort((left, right) => right.order - left.order);

  const latestUpdate = categories.reduce((latest, category) => {
    return new Date(category.latestUpdate).getTime() > new Date(latest).getTime()
      ? category.latestUpdate
      : latest;
  }, new Date().toISOString());

  siteDataCache = {
    generatedAt: new Date().toISOString(),
    latestUpdate,
    categories
  };

  return siteDataCache;
}

export function buildSidebarConfig() {
  const siteData = getSiteData();
  return [
    {
      label: '站点入口',
      translations: {
        en: 'Site',
        'ja-JP': 'サイト',
        'ko-KR': '사이트'
      },
      items: [
        {
          label: '官网首页',
          translations: {
            en: 'Home',
            'ja-JP': 'ホーム',
            'ko-KR': '홈'
          },
          link: '/'
        }
      ]
    },
    {
      label: '内容分区',
      translations: {
        en: 'Sections',
        'ja-JP': 'カテゴリ',
        'ko-KR': '분류'
      },
      items: siteData.categories.map((category) => ({
        label: getLocalizedValue(category.titles, 'root'),
        translations: {
          en: getLocalizedValue(category.titles, 'en'),
          'ja-JP': getLocalizedValue(category.titles, 'ja'),
          'ko-KR': getLocalizedValue(category.titles, 'ko')
        },
        link: `/docs/${category.slug}/`
      }))
    }
  ];
}

export function syncGeneratedDocs() {
  const siteData = buildSiteData();
  const docsRoot = path.join(rootDir, 'src', 'content', 'docs');
  const publicAssetsDir = path.join(rootDir, 'public', 'assets');

  fs.rmSync(docsRoot, { recursive: true, force: true });
  fs.mkdirSync(docsRoot, { recursive: true });

  fs.rmSync(publicAssetsDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(publicAssetsDir), { recursive: true });
  fs.cpSync(assetsDir, publicAssetsDir, { recursive: true, force: true });

  for (const locale of LOCALES) {
    const localeRoot = locale.dir ? path.join(docsRoot, locale.dir) : docsRoot;
    const docsPrefix = path.join(localeRoot, 'docs');
    fs.mkdirSync(docsPrefix, { recursive: true });

    const docsIndexFrontmatter = createDocFrontmatter({
      title: (
        {
          root: '文档中心',
          en: 'Docs',
          ja: 'ドキュメント',
          ko: '문서'
        }
      )[locale.key],
      description: (
        {
          root: 'Daily Routines 文档总览',
          en: 'Daily Routines documentation overview',
          ja: 'Daily Routines ドキュメント一覧',
          ko: 'Daily Routines 문서 개요'
        }
      )[locale.key],
      lastUpdated: siteData.generatedAt
    });

    fs.writeFileSync(
      path.join(docsPrefix, 'index.md'),
      `${docsIndexFrontmatter}${createDocsHomeContent(locale.key, siteData)}\n`,
      'utf8'
    );

    for (const category of siteData.categories) {
      const categoryDir = path.join(docsPrefix, category.slug);
      fs.mkdirSync(categoryDir, { recursive: true });

      const overviewFrontmatter = createDocFrontmatter({
        title: getLocalizedValue(category.titles, locale.key),
        description: getLocalizedValue(category.descriptions, locale.key),
        lastUpdated: category.latestUpdate
      });

      fs.writeFileSync(
        path.join(categoryDir, 'index.md'),
        `${overviewFrontmatter}${createOverviewContent(locale.key, category, category.articles)}\n`,
        'utf8'
      );
    }
  }

  for (const category of siteData.categories) {
    for (const article of category.articles) {
      for (const localeKey of Object.keys(article.translations)) {
        const locale = LOCALES.find((entry) => entry.key === localeKey) ?? LOCALES[0];
        const translation = article.translations[localeKey];
        const localeRoot = locale.dir ? path.join(docsRoot, locale.dir) : docsRoot;
        const articleDir = path.join(localeRoot, 'docs', category.slug);
        fs.mkdirSync(articleDir, { recursive: true });

        const frontmatter = createDocFrontmatter({
          title: translation.title,
          description: translation.description,
          lastUpdated: translation.lastUpdated
        });

        fs.writeFileSync(
          path.join(articleDir, `${article.slug}.md`),
          `${frontmatter}${translation.content}\n`,
          'utf8'
        );
      }
    }
  }

  writeSiteDataSnapshot(siteData);
  return siteData;
}
