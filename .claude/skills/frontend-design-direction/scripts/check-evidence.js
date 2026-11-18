#!/usr/bin/env node
'use strict';

// Traducción al español (comentarios y mensajes) de `skills/frontend-design-direction/scripts/check-evidence.js`
// de affaan-m/ECC (licencia MIT). La lógica no cambia.

const fs = require('node:fs');
const path = require('node:path');

const text = value => typeof value === 'string' && value.trim().length > 0;
const viewportKey = value => value.trim().toLowerCase().replace(/\s+/g, '');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const states = ['loading', 'empty', 'error', 'partial', 'success', 'permission'];

// Comprueba el registro de evidencia, no la calidad visual ni la veracidad de las observaciones.
function checkEvidence(report) {
  if (!object(report)) return ['el informe debe ser un objeto'];
  const check = (name, item, allowNotApplicable = false) => {
    if (object(item) && item.status === 'pass' && text(item.evidence)) return [];
    if (allowNotApplicable && object(item) && item.status === 'not-applicable' && text(item.reason)) return [];
    return [`${name} necesita una observación aprobatoria${allowNotApplicable ? ' o un motivo de no aplicable' : ''}`];
  };
  const renders = Array.isArray(report.renderedEvidence) ? report.renderedEvidence : [];
  const targets = Array.isArray(report.targetViewports) ? report.targetViewports : [];
  const targetKeys = [...new Set(targets.filter(text).map(viewportKey))];
  return [
    ...(text(report.contract) ? [] : ['contract es obligatorio']),
    ...(targets.length && targets.every(text) ? [] : ['targetViewports debe contener cadenas de viewport no vacías']),
    ...targetKeys.flatMap(viewport => renders.some(item => object(item) && text(item.viewport) && viewportKey(item.viewport) === viewport)
      ? [] : [`a renderedEvidence le falta el viewport objetivo ${viewport}`]),
    ...check('accessibility', report.accessibility),
    ...check('responsive', report.responsive),
    ...states.flatMap(state => check(`contentStates.${state}`, report.contentStates?.[state], true)),
    ...(renders.length ? [] : ['renderedEvidence es obligatorio']),
    ...renders.flatMap((item, i) => object(item) && text(item.viewport) && text(item.artifact) && text(item.observation)
      ? [] : [`renderedEvidence[${i}] necesita viewport, artifact y observation`])
  ];
}

function main(args) {
  try {
    if (args.length !== 1) throw new Error('Uso: node check-evidence.js <local-report.json>');
    const reportPath = path.resolve(args[0]);
    const source = fs.readFileSync(reportPath, 'utf8');
    let report;
    try { report = JSON.parse(source); } catch { throw new Error('El informe debe contener JSON válido'); }
    const errors = checkEvidence(report);
    if (errors.length) throw new Error(errors.join('\n'));
    const root = fs.realpathSync(path.dirname(reportPath));
    for (const item of report.renderedEvidence) {
      if (path.isAbsolute(item.artifact) || path.win32.isAbsolute(item.artifact)
        || item.artifact.includes(':') || item.artifact.split(/[\\/]/).includes('..')) {
        throw new Error('Los artefactos de evidencia deben quedar dentro del directorio del informe');
      }
      const artifact = path.resolve(root, item.artifact);
      const relative = path.relative(root, fs.realpathSync(artifact));
      if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
        throw new Error('Los artefactos de evidencia deben quedar dentro del directorio del informe');
      }
      const info = fs.lstatSync(artifact);
      if (!info.isFile() || info.size === 0) throw new Error('El artefacto de evidencia debe ser un archivo local no vacío');
    }
    console.log('Registro de evidencia completo; la corrección visual sigue requiriendo inspeccionar lo renderizado.');
    return 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { checkEvidence };
