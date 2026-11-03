/**
 * Auditoría de contraste WCAG sobre la interfaz real.
 *
 * Exporta la app a web, la sirve en local, recorre el DOM renderizado y
 * calcula el ratio de contraste de CADA texto contra su fondo efectivo.
 * Falla (exit 1) si algún texto queda por debajo del mínimo de WCAG AA.
 *
 * Por qué existe: el tema claro y oscuro no se puede revisar a ojo. Un verde
 * de marca se ve bien en la maqueta y falla en los botones (texto blanco
 * encima). Esta auditoría es la que lo detectó.
 *
 * Uso:
 *   npm run audit:contraste
 *
 * Requiere el navegador de Playwright:
 *   npx playwright install chromium
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, '.audit-contrast-build');
const VIEWPORT = { width: 430, height: 932 };

/** Pestañas de la app y su etiqueta visible (incluye el glifo del icono). */
const TABS = ['Inicio', 'Historial', 'Info'];

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

/** Sirve el build exportado de forma estática. El puerto 0 = puerto libre. */
function serve(dir) {
  return new Promise((resolveServer, reject) => {
    const server = createServer(async (req, res) => {
      const url = (req.url || '/').split('?')[0];
      const file = join(dir, url === '/' ? 'index.html' : url);
      const target = existsSync(file) && extname(file) ? file : join(dir, 'index.html');
      try {
        const data = await readFile(target);
        res.writeHead(200, { 'Content-Type': MIME[extname(target)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.on('error', reject);
    // Puerto 0: el sistema elige uno libre, para no chocar con otro proceso.
    server.listen(0, () => resolveServer({ server, port: server.address().port }));
  });
}

/**
 * Se ejecuta dentro de la página. Devuelve los textos que no cumplen el
 * mínimo de contraste de WCAG AA contra su fondo efectivo.
 */
function auditarEnPagina() {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => {
    const m = s && s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    return m
      ? { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) }
      : null;
  };
  const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

  const fallas = [];
  for (const el of document.querySelectorAll('*')) {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(' ')
      .trim();
    if (!own) continue;

    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.5) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;

    const fg = parse(cs.color);
    if (!fg) continue;

    // Un ancestro con degradado OPACO tapa el color sólido de los ancestros
    // superiores: ese degradado es el fondo real. Se usa el TONO PEOR
    // (menor contraste) para no maquillar la medición.
    let gradStops = null;
    for (let a = el; a; a = a.parentElement) {
      const bi = getComputedStyle(a).backgroundImage;
      if (bi && bi.includes('linear-gradient')) {
        gradStops = [...bi.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g)].map((m) => ({
          rgb: [Number(m[1]), Number(m[2]), Number(m[3])],
          a: m[4] === undefined ? 1 : Number(m[4]),
        }));
        break;
      }
    }

    // Fondo sólido compuesto (subiendo por los ancestros).
    let bg = [255, 255, 255];
    const stack = [];
    for (let a = el; a; a = a.parentElement) {
      const c = parse(getComputedStyle(a).backgroundColor);
      if (c && c.a > 0) {
        stack.push(c);
        if (c.a >= 0.999) break;
      }
    }
    for (let i = stack.length - 1; i >= 0; i--) bg = over(stack[i].rgb, bg, stack[i].a);

    const effFg = fg.a < 1 ? over(fg.rgb, bg, fg.a) : fg.rgb;
    const candidatos = gradStops ? gradStops.map((s) => s.rgb) : [bg];

    let peor = { ratio: Infinity, fondo: null };
    for (const cand of candidatos) {
      const l1 = lum(effFg);
      const l2 = lum(cand);
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      const ratio = (hi + 0.05) / (lo + 0.05);
      if (ratio < peor.ratio) peor = { ratio, fondo: cand };
    }

    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const min = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;

    if (peor.ratio < min) {
      fallas.push({
        texto: own.slice(0, 70),
        color: cs.color,
        fondo: `rgb(${peor.fondo.map(Math.round).join(', ')})`,
        sobreDegradado: !!gradStops,
        size,
        weight,
        ratio: Number(peor.ratio.toFixed(2)),
        min,
      });
    }
  }
  return fallas;
}

async function main() {
  console.log('1/3 Exportando la app a web…');
  execSync(`npx expo export --platform web --output-dir ${DIST}`, { stdio: 'ignore', cwd: ROOT });

  console.log('2/3 Sirviendo el build en un puerto libre…');
  const { server, port } = await serve(DIST);

  console.log('3/3 Auditando contraste en claro y oscuro…');
  const browser = await chromium.launch();
  let total = 0;

  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: VIEWPORT, colorScheme: scheme });
    const page = await ctx.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));

    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    for (const tab of TABS) {
      await page.locator('[role="tab"]', { hasText: tab }).first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1200);
      const fallas = await page.evaluate(auditarEnPagina);
      if (fallas.length) {
        console.log(`\n  [${scheme} / ${tab}] ${fallas.length} falla(s):`);
        for (const f of fallas) {
          console.log(
            `    ${f.ratio} (min ${f.min}) ${f.size}px/${f.weight} color=${f.color} bg=${f.fondo}` +
              `${f.sobreDegradado ? ' [sobre degradado]' : ''} — "${f.texto}"`,
          );
        }
      }
      total += fallas.length;
    }

    if (errores.length) {
      console.log(`\n  [${scheme}] errores de runtime: ${errores.length}`);
      errores.slice(0, 5).forEach((e) => console.log(`    ${e}`));
    }
    await ctx.close();
  }

  await browser.close();
  server.close();

  console.log(total === 0 ? '\n✅ Contraste: 0 fallas de WCAG AA.' : `\n❌ Contraste: ${total} falla(s).`);
  process.exit(total === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('FALLO:', e.message);
  process.exit(1);
});
