import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SafeHtml, createRenderer, escapeHtml } from '../../src/views/render.js';

describe('escapeHtml', () => {
  it('escapa los caracteres significativos de HTML', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&\`</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&#96;&lt;/a&gt;',
    );
  });
});

describe('createRenderer', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'views-'));
    mkdirSync(join(dir, 'partials'));
    writeFileSync(join(dir, 'page.html'), '<p title="{{ title }}">{{ text }}</p>{{{ inner }}}');
    writeFileSync(join(dir, 'partials', 'item.html'), '<b>{{ name }}</b>');
  });

  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('escapa por defecto los valores interpolados (XSS)', () => {
    const { render } = createRenderer({ viewsDir: dir });
    const inner = render('partials/item', { name: '<img src=x onerror=alert(1)>' });
    const html = render('page', { title: '" onmouseover="alert(1)', text: '<script>alert(1)</script>', inner }).toString();

    expect(html).toBe(
      '<p title="&quot; onmouseover=&quot;alert(1)">&lt;script&gt;alert(1)&lt;/script&gt;</p>' +
        '<b>&lt;img src=x onerror=alert(1)&gt;</b>',
    );
  });

  it('solo inserta sin escapar fragmentos SafeHtml producidos por el renderizador', () => {
    const { render } = createRenderer({ viewsDir: dir });
    expect(() => render('page', { title: 't', text: 't', inner: '<script>alert(1)</script>' })).toThrow(TypeError);
    expect(render('page', { title: 't', text: 't', inner: new SafeHtml('<i>ok</i>') }).toString()).toContain('<i>ok</i>');
  });

  it('no reinterpreta placeholders presentes en los datos', () => {
    const { render } = createRenderer({ viewsDir: dir });
    expect(render('partials/item', { name: '{{ name }}' }).toString()).toBe('<b>{{ name }}</b>');
  });

  it('falla si falta un valor o la plantilla no existe', () => {
    const { render } = createRenderer({ viewsDir: dir });
    expect(() => render('partials/item', {})).toThrow(/Falta el valor "name"/);
    expect(() => render('partials/item', { name: null })).toThrow(/Falta el valor/);
    expect(() => render('missing')).toThrow(/Plantilla no encontrada/);
  });

  it('lee las plantillas una sola vez al crearse', () => {
    const { render } = createRenderer({ viewsDir: dir });
    writeFileSync(join(dir, 'partials', 'item.html'), '<i>cambiado</i>');
    expect(render('partials/item', { name: 'x' }).toString()).toBe('<b>x</b>');
  });

  it('resuelve rutas con puntos (objetos y arrays) escapando el valor', () => {
    writeFileSync(join(dir, 'path.html'), '<p>{{ a.b.0.c }}</p>');
    const { render } = createRenderer({ viewsDir: dir });
    expect(render('path', { a: { b: [{ c: '<x>' }] } }).toString()).toBe('<p>&lt;x&gt;</p>');
    expect(() => render('path', { a: { b: [] } })).toThrow(/Falta el valor "a.b.0.c"/);
  });

  it('no resuelve propiedades heredadas del prototipo', () => {
    writeFileSync(join(dir, 'proto.html'), '{{ a.constructor }}{{ a.__proto__ }}');
    const { render } = createRenderer({ viewsDir: dir });
    expect(() => render('proto', { a: {} })).toThrow(/Falta el valor/);
  });

  it('rechaza objetos en placeholders escapados', () => {
    const { render } = createRenderer({ viewsDir: dir });
    expect(() => render('partials/item', { name: { toString: () => 'x' } })).toThrow(TypeError);
  });

  it('renderEach concatena una plantilla por elemento y join une fragmentos seguros', () => {
    const { render, renderEach, join: joinHtml } = createRenderer({ viewsDir: dir });
    expect(renderEach('partials/item', [{ name: 'a' }, { name: '<b>' }]).toString()).toBe('<b>a</b><b>&lt;b&gt;</b>');
    expect(renderEach('partials/item', [])).toBeInstanceOf(SafeHtml);
    expect(joinHtml([render('partials/item', { name: 'x' }), render('partials/item', { name: 'y' })]).toString()).toBe(
      '<b>x</b><b>y</b>',
    );
    expect(() => joinHtml(['<script>'])).toThrow(TypeError);
  });
});
