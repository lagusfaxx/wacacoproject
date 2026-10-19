#!/usr/bin/env node
/**
 * Agente de impresion.
 *
 * Corre en el PC que tiene la impresora. Cada pocos segundos pregunta a cada
 * tienda configurada si hay algo por imprimir (etiquetas de Mercado Libre de
 * Wacaco, packing slips de TAUPOC), lo descarga en PDF, lo manda a la
 * impresora y avisa a la tienda como le fue. Las tiendas nunca se conectan al
 * PC: es el agente el que sale a buscar, asi que no hay que abrir puertos.
 *
 *   node agente.mjs               queda corriendo
 *   node agente.mjs --una-vez     revisa una vez y termina
 *   node agente.mjs --probar      prueba la conexion con cada tienda, sin imprimir
 *   node agente.mjs --impresoras  muestra los nombres de las impresoras instaladas
 *
 * Sin dependencias: solo Node 18 o superior. En Windows imprime con
 * SumatraPDF (gratis); en macOS y Linux con `lp`.
 */
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { appendFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = process.env.AGENTE_CONFIG || join(HERE, 'config.json');
const LOG_PATH = join(HERE, 'agente.log');
const TMP = join(tmpdir(), 'agente-impresion');
const WINDOWS = process.platform === 'win32';

// ---------------------------------------------------------------------------
// Configuracion y registro
// ---------------------------------------------------------------------------

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    console.error(`No encuentro ${CONFIG_PATH}. Copia config.example.json a config.json y completalo.`);
    process.exit(1);
  }
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const tiendas = (config.tiendas ?? []).filter((t) => t.url && t.token && !String(t.token).startsWith('PEGA_'));
  if (!tiendas.length) {
    console.error('config.json no tiene ninguna tienda con url y token.');
    process.exit(1);
  }
  return {
    nombre: config.nombre || hostname(),
    intervalo: Math.max(5, Number(config.intervaloSegundos) || 15) * 1000,
    impresora: config.impresora || '',
    impresoras: config.impresoras || {},
    sumatraPdf: config.sumatraPdf || '',
    tiendas: tiendas.map((t) => ({ nombre: t.nombre || t.url, url: String(t.url).replace(/\/+$/, ''), token: t.token })),
  };
}

async function log(message) {
  const line = `[${new Date().toLocaleString('es-CL')}] ${message}`;
  console.log(line);
  await appendFile(LOG_PATH, line + '\n').catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Impresora
// ---------------------------------------------------------------------------

function findSumatra(configured) {
  const candidates = [
    configured,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'SumatraPDF', 'SumatraPDF.exe'),
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'SumatraPDF', 'SumatraPDF.exe'),
    process.env['ProgramFiles(x86)'] && join(process.env['ProgramFiles(x86)'], 'SumatraPDF', 'SumatraPDF.exe'),
    join(HERE, 'SumatraPDF.exe'),
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      'No encuentro SumatraPDF. Instalalo desde https://www.sumatrapdfreader.org o indica su ruta en "sumatraPdf" de config.json.',
    );
  }
  return found;
}

async function printPdf(config, file, { printer, copies }) {
  if (WINDOWS) {
    const exe = findSumatra(config.sumatraPdf);
    const target = printer ? ['-print-to', printer] : ['-print-to-default'];
    // "fit" ajusta la pagina al papel: la etiqueta de Mercado Libre y el
    // packing slip A4 salen enteros en carta, A4 o rollo.
    await run(exe, [...target, '-print-settings', `fit,${copies}x`, '-silent', file], { timeout: 120_000 });
  } else {
    const args = ['-n', String(copies), '-o', 'fit-to-page', ...(printer ? ['-d', printer] : []), file];
    await run('lp', args, { timeout: 120_000 });
  }
}

async function listPrinters() {
  if (WINDOWS) {
    const { stdout } = await run('powershell.exe', [
      '-NoProfile',
      '-Command',
      'Get-Printer | Select-Object -ExpandProperty Name',
    ]);
    return stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  const { stdout } = await run('lpstat', ['-e']);
  return stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Tiendas
// ---------------------------------------------------------------------------

async function api(config, tienda, path, init = {}) {
  const response = await fetch(`${tienda.url}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${tienda.token}`,
      'x-agent-name': config.nombre,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 401) throw new Error('La tienda rechazo el token: revisa que sea igual a PRINT_AGENT_TOKEN.');
  return response;
}

async function report(config, tienda, job, result) {
  await api(config, tienda, `/api/print-agent/jobs/${job.id}`, {
    method: 'POST',
    body: JSON.stringify(result),
  }).catch((error) => log(`${tienda.nombre}: no pude avisar el resultado de ${job.id} (${error.message})`));
}

async function processJob(config, tienda, job) {
  const response = await api(config, tienda, `/api/print-agent/jobs/${job.id}`);
  if (response.status === 409) return; // otro agente lo tomo o lo cancelaron
  if (!response.ok) throw new Error(`descarga respondio ${response.status}`);

  const pdf = Buffer.from(await response.arrayBuffer());
  if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') {
    await report(config, tienda, job, { ok: false, error: 'El archivo descargado no es un PDF.' });
    await log(`${tienda.nombre}: ERROR "${job.title}" no es un PDF`);
    return;
  }

  const printer = config.impresoras[job.kind] || config.impresora;
  const copies = Math.max(1, Number(response.headers.get('x-copies')) || job.copies || 1);
  await mkdir(TMP, { recursive: true });
  const file = join(TMP, `${job.id}.pdf`);
  await writeFile(file, pdf);
  try {
    await printPdf(config, file, { printer, copies });
    await report(config, tienda, job, { ok: true });
    await log(`${tienda.nombre}: impreso "${job.title}" (${copies} copia${copies === 1 ? '' : 's'}) en ${printer || 'la impresora predeterminada'}`);
  } catch (error) {
    const message = String(error.stderr || error.message || error).trim().slice(0, 1000);
    await report(config, tienda, job, { ok: false, error: message });
    await log(`${tienda.nombre}: ERROR al imprimir "${job.title}": ${message}`);
  } finally {
    await rm(file, { force: true }).catch(() => undefined);
  }
}

async function poll(config) {
  for (const tienda of config.tiendas) {
    try {
      const response = await api(config, tienda, '/api/print-agent/jobs');
      if (!response.ok) throw new Error(`respondio ${response.status}`);
      const { jobs } = await response.json();
      for (const job of jobs) await processJob(config, tienda, job);
    } catch (error) {
      await log(`${tienda.nombre}: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------------

async function main() {
  const args = new Set(process.argv.slice(2));

  if (args.has('--impresoras')) {
    const printers = await listPrinters();
    console.log(printers.length ? printers.join('\n') : 'No hay impresoras instaladas.');
    console.log('\nCopia el nombre exacto en "impresora" de config.json.');
    return;
  }

  const config = loadConfig();

  if (args.has('--probar')) {
    for (const tienda of config.tiendas) {
      try {
        const response = await api(config, tienda, '/api/print-agent/jobs');
        const body = await response.json().catch(() => ({}));
        console.log(
          response.ok
            ? `OK    ${tienda.nombre}: ${body.jobs.length} trabajo(s) esperando`
            : `ERROR ${tienda.nombre}: respondio ${response.status} ${body.error ?? ''}`,
        );
      } catch (error) {
        console.log(`ERROR ${tienda.nombre}: ${error.message}`);
      }
    }
    if (WINDOWS) {
      try {
        console.log(`OK    SumatraPDF: ${findSumatra(config.sumatraPdf)}`);
      } catch (error) {
        console.log(`ERROR ${error.message}`);
      }
    }
    console.log(`      Impresora: ${config.impresora || '(predeterminada de Windows/sistema)'}`);
    return;
  }

  if (args.has('--una-vez')) {
    await poll(config);
    return;
  }

  await log(
    `Agente "${config.nombre}" iniciado: ${config.tiendas.map((t) => t.nombre).join(', ')} · cada ${config.intervalo / 1000} s · impresora ${config.impresora || 'predeterminada'}`,
  );
  // Una vuelta termina antes de programar la siguiente: nunca se imprime dos veces en paralelo.
  for (;;) {
    await poll(config);
    await new Promise((resolve) => setTimeout(resolve, config.intervalo));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
