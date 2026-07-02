import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { buildSidebarConfig } from './scripts/site-data.mjs';

export default defineConfig({
  site: 'https://info.atmoomen.top',
  integrations: [
    starlight({
      title: {
        'zh-CN': 'Daily Routines 信息中心',
        en: 'Daily Routines Info Center',
        'ja-JP': 'Daily Routines インフォメーションセンター',
        'ko-KR': 'Daily Routines 정보 센터'
      },
      description: 'Daily Routines 官方文档、FAQ、更新日志与模块信息中心',
      favicon: '/assets/apple-touch-icon.png',
      logo: {
        src: '/assets/apple-touch-icon.png',
        alt: 'Daily Routines'
      },
      defaultLocale: 'root',
      locales: {
        root: {
          label: '简体中文',
          lang: 'zh-CN'
        },
        en: {
          label: 'English',
          lang: 'en'
        },
        ja: {
          label: '日本語',
          lang: 'ja-JP'
        },
        ko: {
          label: '한국어',
          lang: 'ko-KR'
        }
      },
      lastUpdated: true,
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/Dalamud-DailyRoutines'
        },
        {
          icon: 'discord',
          label: 'Discord',
          href: 'https://discord.gg/MDvv8Ejntw'
        }
      ],
      sidebar: buildSidebarConfig(),
      components: {
        SiteTitle: './src/components/starlight/SiteTitle.astro',
        Search: './src/components/starlight/Search.astro',
        LanguageSelect: './src/components/starlight/LanguageSelect.astro',
        PageTitle: './src/components/starlight/PageTitle.astro',
        MarkdownContent: './src/components/starlight/MarkdownContent.astro',
        TableOfContents: './src/components/starlight/TableOfContents.astro',
        MobileTableOfContents: './src/components/starlight/MobileTableOfContents.astro'
      },
      customCss: ['./src/styles/starlight.css', './src/styles/article-docs.css'],
      head: [
        {
          tag: 'link',
          attrs: {
            rel: 'apple-touch-icon',
            sizes: '180x180',
            href: '/assets/apple-touch-icon.png'
          }
        }
      ]
    })
  ]
});
