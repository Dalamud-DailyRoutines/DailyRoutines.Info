import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');

function walkFiles(directory, predicate) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return walkFiles(fullPath, predicate);
    }

    return entry.isFile() && predicate(fullPath) ? [fullPath] : [];
  });
}

function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

function getRelativeRootPrefix(filePath) {
  const relativePath = path.relative(path.dirname(filePath), distDir);
  if (!relativePath) {
    return './';
  }

  return `${toPosixPath(relativePath)}/`;
}

function rewriteAssetUrls(content, prefix) {
  return content
    .replace(/(["'])\/(_astro|assets|pagefind)\//g, `$1${prefix}$2/`)
    .replace(/(["'])\.\/+(_astro|assets|pagefind)\//g, `$1${prefix}$2/`);
}

function rewriteBodyLinks(content, prefix) {
  return content.replace(/href=(['"])\/(?!\/)([^'"]*)\1/g, (_match, quote, href) => {
    const nextHref = href ? `${prefix}${href}` : prefix;
    return `href=${quote}${nextHref}${quote}`;
  });
}

function rewriteHtmlFile(filePath) {
  const prefix = getRelativeRootPrefix(filePath);
  const html = fs.readFileSync(filePath, 'utf8');
  const headEndIndex = html.indexOf('</head>');

  if (headEndIndex < 0) {
    return false;
  }

  const head = rewriteAssetUrls(html.slice(0, headEndIndex), prefix);
  const body = rewriteBodyLinks(rewriteAssetUrls(html.slice(headEndIndex), prefix), prefix);
  const updatedHtml = `${head}${body}`;

  if (updatedHtml === html) {
    return false;
  }

  fs.writeFileSync(filePath, updatedHtml, 'utf8');
  return true;
}

function rewriteSearchBundle(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const replacement = [
    'baseUrl:(()=>{const r=window.location.pathname.replace(/\\\\/index\\\\.html$/,"/").split("/").filter(Boolean).length;',
    'const c=r===0?"./":"../".repeat(r);return c})(),',
    'bundlePath:(()=>{const r=window.location.pathname.replace(/\\\\/index\\\\.html$/,"/").split("/").filter(Boolean).length;',
    'const c=r===0?"./":"../".repeat(r);return c+"pagefind/"})()'
  ].join('');
  const updated = source.replace(
    'baseUrl:"/",bundlePath:"/".replace(/\\/$/,"")+"/pagefind/"',
    replacement
  );

  if (updated === source) {
    return false;
  }

  fs.writeFileSync(filePath, updated, 'utf8');
  return true;
}

const htmlFiles = walkFiles(distDir, (filePath) => filePath.endsWith('.html'));
const htmlRewriteCount = htmlFiles.reduce((count, filePath) => {
  return count + (rewriteHtmlFile(filePath) ? 1 : 0);
}, 0);

const searchBundles = walkFiles(path.join(distDir, '_astro'), (filePath) => {
  return /Search\.astro_astro_type_script_index_0_lang\..+\.js$/i.test(path.basename(filePath));
});
const searchRewriteCount = searchBundles.reduce((count, filePath) => {
  return count + (rewriteSearchBundle(filePath) ? 1 : 0);
}, 0);

console.log(`已重写 ${htmlRewriteCount} 个 HTML 文件与 ${searchRewriteCount} 个搜索脚本的站点路径。`);
