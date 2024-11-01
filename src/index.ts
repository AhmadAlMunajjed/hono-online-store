import { Context, Hono, Next } from 'hono'
import { cache } from 'hono/cache';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';
import { Liquid } from 'liquidjs';

const app = new Hono<{ Bindings: CloudflareBindings }>()

const responseTimeMiddleware = async (c: Context, next: Next) => {
  const start = Date.now()
  await next()
  const end = Date.now()
  c.res.headers.set('X-Response-Time', `${(end - start)} ms`)
}
app.use('*', responseTimeMiddleware)
app.use('*', logger())
app.use('*', timing())
app.get(
  '*',
  cache({
    cacheName: 'my-app',
    cacheControl: 'max-age=60', // 1 minute 
  })
)

const themesOptions = {
  // File extension for Liquid templates
  extsionName: '.liquid',
  // Path to layouts directory
  layouts: 'layouts',
  partials: 'partials',
  // Path to themes directory if files are remote
  themesUri: true ? 'https://assts.tajer.store/themes' : 'http://127.0.0.1:8787/themes',
  storesUri: true ? 'https://assts.tajer.store/stores' : 'http://127.0.0.1:8787/stores',
};

app.get('/test', (c: Context) => {
  return c.text('Hello Hono!')
})

app.get('/', async (c: Context) => {
  const theme = c.req.query('theme');
  const template = c.req.query('template')
  const lang = c.req.query('lang')
  const font = c.req.query('font')

  if (!theme || !template) {
    return c.text('Missing theme or template query parameter');
  }
  try {
    // get request url in hono
    const requestUrl = ''//c.req.url
    const url = requestUrl + c.req.routePath;
    const image = requestUrl + '/logo.png'
    const html = await renderHtml(url, image, lang ?? 'en', theme, template, font);
    return c.html(html)
  } catch (err: any) {
    c.text(err.message)
  }
})

async function getProducts(tenant: string) {
  const response = await fetch('https://touch-plus.tajer.tech/api/catalog-public/product-list');
  return await response.json();
}

async function getCollections(tenant: string) {
  const response = await fetch('https://touch-plus.tajer.tech/api/catalog-public/collection');
  return await response.json();
}

async function renderHtml(url: string, image: string, lang: string, theme: string, template: string, font?: string) {

  // get theme configs
  const tenant = await getTenantByDomain('hono-online-store.tajer.workers.dev');
  const configs = await getStoreConfigs(tenant);
  const themeConfigs = await getThemeConfigs(tenant);
  const products = await getProducts(tenant);

  const themesUri = themesOptions.themesUri;
  const themeUri = `${themesUri}/${theme}/`;
  const themeAssetsUri = `${themeUri}assets`;
  const themeLocalsUri = `${themeUri}locales`;

  console.log({
    themeUri,
    themeAssetsUri,
    themeLocalsUri
  })

  // Create a Liquid engine instance
  const customResolver = {
    resolve(dir: string, file: string, ext: string) {
      console.log('resolve', `${dir}${file}${ext}`);
      return `${dir}${file}${ext}`;
    },
    existsSync(filePath: string) {
      throw new Error('Not implemented. Call async exists instead. This is a sync method called only when engine.renderSync is called, you need to call engine.renderSync instead of engine.render');
    },
    readFileSync(filePath: string) {
      throw new Error('Not implemented. Call async readFile instead. This is a sync method called only when engine.renderSync is called, you need to call engine.renderSync instead of engine.render');
    },
    async readFile(filePath: string) {
      // Construct the full URL to the file
      console.log('readFile', filePath);
      // Fetch the file content from the remote URL
      const response = await fetch(filePath);
      return response.text();
    },
    async exists(filePath: string) {
      console.log('exists', filePath);
      const response = await fetch(filePath);
      return response.status === 200;
    },
  }

  const engine = new Liquid({
    root: themeUri,
    extname: themesOptions.extsionName,
    layouts: themeUri + themesOptions.layouts + '/',
    relativeReference: false,
    fs: customResolver,
    cache: false,
  });

  let local: any = {}

  try {
    console.log('loading local file', `${themeLocalsUri}/${lang}.json`)
    const response = await fetch(`${themeLocalsUri}/${lang}.json`);
    local = await response.json();
    console.log('local', local)
  } catch (error) {
    console.log('error loading local file', error)
  }

  // create translation filter that loads locale file
  engine.registerFilter('t', async function (str) {
    return local[str] || str;
  });

  // create asset_url filter
  engine.registerFilter('asset_url', function (str) {
    return `${themeAssetsUri}/${str}`;
  });

  const data = {
    title: 'My Online Store',
    meta_description: 'This is an online store selling various products.',
    meta_keywords: 'online store, ecommerce, products',
    url: url,
    image: image,
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    font: font || 'arial',
    products,
    configs,
    themeConfigs,
  }
  console.log('data', data)
  const html = await engine.renderFile(`partials/${template}`, data);
  return html
}

async function getStoreConfigs(tenant: string) {
  const response = await fetch(themesOptions.storesUri + `/${tenant}/configs.json`);
  return await response.json();
}

async function getThemeConfigs(tenant: string) {
  const response = await fetch(themesOptions.storesUri + `/${tenant}/theme.json`);
  return await response.json();
}

/**
 * get tenant by domain from key value store kv
 * @param domain current domain
 * @returns 
 */
async function getTenantByDomain(domain: string) {
  return "store";
}

app.get('/manifest.webmanifest', async (c) => {
  return c.json(
    {
      "name": "Hallo Markt",
      "short_name": "Hallo",
      "description": "Hallo Markt is a platform for selling and buying products and services in the Arab world",
      "icons": [
        {
          "src": "https://abs.twimg.com/responsive-web/client-web/icon-default.522d363a.png",
          "sizes": "192x192",
          "type": "image/png"
        },
        {
          "src": "https://abs.twimg.com/responsive-web/client-web/icon-default-large.9ab12c3a.png",
          "sizes": "512x512",
          "type": "image/png"
        },
        {
          "purpose": "maskable",
          "src": "https://abs.twimg.com/responsive-web/client-web/icon-default-maskable.bacea37a.png",
          "sizes": "192x192",
          "type": "image/png"
        },
        {
          "purpose": "maskable",
          "src": "https://abs.twimg.com/responsive-web/client-web/icon-default-maskable-large.35928fda.png",
          "sizes": "512x512",
          "type": "image/png"
        }
      ],
      "start_url": "https://hono-online-store.tajer.workers.dev/",
      "scope": "./",
      "display": "standalone",
      "orientation": "portrait",
      "background_color": "#f7f7f7",
      "theme_color": "#0091eb",
      "gcm_sender_id": "103953800507"
    })
})

app.get('/sitemap.xml', async (c) => {
  // write example sitemap.xml
  return c.text(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://hono-online-store.tajer.workers.dev/</loc>
    <lastmod>2024-10-01</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
    `)
})

app.get('robots.txt', async (c) => {
  // write example robots.txt
  return c.text(`User-agent: *
Sitemap: https://hono-online-store.tajer.workers.dev/sitemap.xml
    `)
})

import { serve } from '@hono/node-server'
serve({
  fetch: app.fetch,
  port: 3000,
}, () => {
  console.log('Server started at http://localhost:3000')
})

export default app