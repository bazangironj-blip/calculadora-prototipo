/* Pruebas automáticas de la calculadora acuícola.
   Uso:  node pruebas_calculadora.js [ruta/a/calculadora_acuicola.html]
   Carga el código de cálculo (bloques PURE) directamente del HTML, sin navegador. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const htmlPath = process.argv[2] || path.join(__dirname, 'calculadora_acuicola.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const bloques = ['PURE', 'PURE2', 'PURE3'].map((b) => {
  const m = html.match(new RegExp(`/\\*<${b}>\\*/([\\s\\S]*?)/\\*</${b}>\\*/`));
  if (!m) throw new Error(`No se encontró el bloque ${b}`);
  return m[1];
});
const codigo = bloques.join('\n');
const nombres = [...codigo.matchAll(/^(?:function|const|let)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
const ctx = vm.createContext({ console });
vm.runInContext(`${codigo}\n;globalThis.__exp = { ${[...new Set(nombres)].join(', ')} };`, ctx);
const A = ctx.__exp;
const { num, r2, fca, biomasaKg, alimentoDiario, densidad, proyectar, construirHistorial, analizarEstanque, economiaEstanque, evaluarAlertas,
  validarEstanque, validarMedicion, validarMovimiento, validarEspecie, estadoInicial, estanqueNuevo, agregarEjemplo, quitarEjemplo, crearStore,
  aCSV, tablasExport, aExcelXML, parseRaciones, parseLista, resumenGranja, proyeccionPlan, CONFIG_DEF, areaM2, volumenM3, vivosEstimados,
  validarRespaldo, normalizarEstado, sumarMeses, fechaDia, interpPlan, supervivenciaDesde } = A;

let ok = 0, fallos = 0;
function test(nombre, fn) {
  try { fn(); ok++; console.log(`  ✔ ${nombre}`); } catch (e) { fallos++; console.log(`  ✘ ${nombre}\n      ${e.message}`); }
}
const casi = (a, b, d = 1e-6, msg = '') => assert(Math.abs(a - b) <= d, `${msg} ${a} ≠ ${b}`);
const lista = (arr, esperado, d = 0.005) => { assert.strictEqual(arr.length, esperado.length, `largo ${arr.length} ≠ ${esperado.length}: ${JSON.stringify(arr)}`); arr.forEach((v, i) => { if (esperado[i] === null) assert.strictEqual(v, null, `[${i}] ${v}`); else casi(v, esperado[i], d, `[${i}]`); }); };
const clase = Object.assign({}, CONFIG_DEF, { modoClase: true });
const precisa = Object.assign({}, CONFIG_DEF, { modoClase: false });
const igual = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m); // compara por contenido (el código se evalúa en otro contexto de vm)
const grupo = (t) => console.log(`\n${t}`);

/* ---------------------------------------------------------------- */
grupo('1. Fórmulas básicas');
test('densidad de siembra = organismos ÷ área', () => { casi(densidad(57600, 9600), 6); assert.strictEqual(densidad(100, 0), null); });
test('hectáreas → m² y volumen = área × profundidad', () => { casi(areaM2({ area: 0.5, areaUnidad: 'ha' }), 5000); casi(volumenM3(9600, 1.5), 14400); assert.strictEqual(volumenM3(9600, ''), null); });
test('conversión g → kg en la biomasa', () => { casi(biomasaKg(28800, 2.8, precisa), 80.64); casi(biomasaKg(1000, 1, precisa), 1); assert.strictEqual(biomasaKg(null, 5, precisa), null); });
test('alimento diario, semanal y mensual', () => { const d = alimentoDiario(80.64, 10); casi(d, 8.064); casi(d * 7, 56.448); casi(d * 30, 241.92); });
test('organismos vivos y mortalidad estimada', () => { casi(vivosEstimados(1000, 88.46), 884.6); casi(1000 - vivosEstimados(1000, 88.46), 115.4); });
test('supervivencia desde mortalidades por período (5, 4 y 3 %)', () => casi(supervivenciaDesde([5, 4, 3]), 88.464, 0.001));
test('listas y raciones', () => { igual(parseLista('16, 58;152'), [16, 58, 152]); assert.strictEqual(parseLista('1, x'), null); assert.strictEqual(parseRaciones('3').fracs.length, 3); casi(parseRaciones('30, 40, 30').fracs[1], 0.4); assert.strictEqual(parseRaciones('30, 40').ok, false); });

grupo('2. F.C.A. y división por cero');
test('F.C.A. = alimento ÷ incremento de biomasa', () => casi(fca(34.56, 19.2).valor, 1.8));
test('incremento cero o negativo: no se divide', () => { assert.strictEqual(fca(10, 0).valor, null); assert.strictEqual(fca(10, -3).valor, null); assert(fca(10, 0).motivo.includes('cero o negativo')); });
test('datos faltantes o alimento negativo: sin resultado', () => { assert.strictEqual(fca(null, 5).valor, null); assert.strictEqual(fca(-1, 5).valor, null); });
test('ninguna función devuelve NaN o infinito con ceros', () => {
  for (const v of [biomasaKg(0, 0, precisa), alimentoDiario(0, 0), densidad(0, 5), A.div(1, 0), A.div(0, 0)]) assert(v === null || Number.isFinite(v));
});

grupo('3. Población con mortalidad y proyección (hojas de clase)');
const planClase = (extra) => Object.assign({ cfg: clase, inicioDias: 0, fechaSiembra: '2025-01-02', pobInicial: 28800, pesoInicial: 2.8, pasoDias: 30, horizonteDias: 180, planDias: 30,
  modelo: { tipo: 'pesos', pesos: [16, 58, 152, 234, 342, 450], pesoSiembra: 2.8 }, mortalidades: [5, 4, 3], tasas: [10, 8, 5, 3, 3, 3], pesoObjetivo: 450 }, extra || {});
test('hoja San Rafael: población, biomasa, alimento y F.C.A. por período', () => {
  const r = proyectar(planClase());
  igual(r.errores, []);
  lista(r.rows.map((x) => x.pob), [28800, 27360, 26266, 25478, 25478, 25478, 25478], 0);
  lista(r.rows.map((x) => x.biomasa), [80.64, 437.76, 1523.43, 3872.66, 5961.85, 8713.48, 11465.1]);
  lista(r.rows.map((x) => x.alimento), [null, 241.92, 1050.62, 2285.15, 3485.39, 5365.67, 7842.13]);
  lista(r.rows.map((x) => x.fca), [null, 0.68, 0.97, 0.97, 1.67, 1.95, 2.85]);
  casi(r.resumen.alimentoTotal, 20270.88, 0.005);
  casi(r.resumen.fcaProyectado, 1.78, 0.005);
});
test('fechas del plan: mismo día de cada mes con períodos de 30 días', () => {
  const r = proyectar(planClase());
  igual(r.rows.map((x) => x.fecha), ['2025-01-02', '2025-02-02', '2025-03-02', '2025-04-02', '2025-05-02', '2025-06-02', '2025-07-02']);
  assert.strictEqual(sumarMeses('2025-01-31', 1), '2025-02-28');
});
test('examen: 4 estanques de 30×20 m + 8 de 45×20 m, 6 peces/m²', () => {
  const area = 4 * 30 * 20 + 8 * 45 * 20; assert.strictEqual(area, 9600);
  const r = proyectar(planClase({ pobInicial: area * 6, pesoInicial: 161.28 * 1000 / 57600 }));
  lista(r.rows.map((x) => x.pob), [57600, 54720, 52531, 50955, 50955, 50955, 50955], 0);
  casi(r.resumen.alimentoTotal, 40541.0, 0.005); casi(r.resumen.biomasaFinal, 22929.75, 0.005);
  casi(Math.ceil(57600 / (1 - 0.08)), 62609); // peces a comprar; muertos en el transporte = 5 009
  assert.strictEqual(Math.ceil(57600 / 0.92) - 57600, 5009);
});
test('cuadro de 15 días (gamitana 65 × 40 m, 7 peces/m²)', () => {
  const r = proyectar(planClase({ pobInicial: 18200, pesoInicial: 3.0, pasoDias: 15, horizonteDias: 30, planDias: 15, modelo: { tipo: 'pesos', pesos: [4.8, 8.6], pesoSiembra: 3.0 }, mortalidades: [], tasas: [10, 10, 10] }));
  lista(r.rows.map((x) => x.biomasa), [54.6, 87.36, 156.52]); lista(r.rows.map((x) => x.alimento), [null, 81.9, 131.04]); lista(r.rows.map((x) => x.fca), [null, 2.5, 1.89]);
});
test('cuadro de 15 días (carpa 420 m²)', () => {
  const r = proyectar(planClase({ pobInicial: 2100, pesoInicial: 5.2, pasoDias: 15, horizonteDias: 45, planDias: 15, modelo: { tipo: 'pesos', pesos: [9.32, 15.4, 24.3], pesoSiembra: 5.2 }, mortalidades: [], tasas: [10, 10, 10, 9] }));
  lista(r.rows.map((x) => x.alimento), [null, 16.38, 29.36, 48.51]); lista(r.rows.map((x) => x.fca), [null, 1.89, 2.3, 2.6]);
});
test('cuadro de 15 días (gamitana 550 m², 4 peces/m²)', () => {
  const r = proyectar(planClase({ pobInicial: 2200, pesoInicial: 11.26, pasoDias: 15, horizonteDias: 90, planDias: 15, modelo: { tipo: 'pesos', pesos: [22.52, 38.68, 58.87, 88.31, 121.42, 158.86], pesoSiembra: 11.26 }, mortalidades: [], tasas: [10, 10, 8, 8, 5, 5] }));
  lista(r.rows.map((x) => x.alimento), [null, 37.16, 74.31, 102.12, 155.41, 145.71, 200.34]); lista(r.rows.slice(0, 6).map((x) => x.fca), [null, 1.5, 2.09, 2.3, 2.4, 2.0]);
});
test('modo precisión completa: no redondea la población ni la biomasa', () => {
  const r = proyectar(planClase({ cfg: precisa })); assert(!Number.isInteger(r.rows[2].pob)); casi(r.rows[1].pob, 27360, 1e-6);
});
test('plazo corto: interpolación lineal del peso entre períodos', () => {
  const r = proyectar(planClase({ pasoDias: 7, horizonteDias: 14 }));
  casi(r.rows[1].peso, 2.8 + (16 - 2.8) * 7 / 30, 1e-9); casi(r.rows[2].peso, 2.8 + (16 - 2.8) * 14 / 30, 1e-9);
});
test('modelos explícitos: ganancia diaria y crecimiento específico, con aviso del supuesto', () => {
  const g = proyectar(planClase({ modelo: { tipo: 'gdp', gdp: 2 }, horizonteDias: 30 })); casi(g.rows[1].peso, 62.8, 1e-9); assert(g.avisos.some((t) => t.includes('Supuesto explícito')));
  const t = proyectar(planClase({ modelo: { tipo: 'tce', tce: 3 }, horizonteDias: 10 })); casi(t.rows[1].peso, 2.8 * Math.exp(0.3), 1e-9);
});
test('supervivencia constante solo si se pide expresamente', () => {
  assert(proyectar(planClase({ supervivenciaConstante: true })).rows[6].pob === 28800);
  assert(proyectar(planClase()).rows[6].pob < 28800);
});
test('fecha estimada del peso objetivo', () => {
  const r = proyectar(planClase({ pesoObjetivo: 100 })); assert(r.resumen.alcanzaObjetivo); casi(r.resumen.diaObjetivo, 60 + (100 - 58) / (152 - 58) * 30, 1e-9);
  assert(!proyectar(planClase({ pesoObjetivo: 9999 })).resumen.alcanzaObjetivo);
});
test('sin datos suficientes: pide completar en vez de inventar', () => {
  assert(proyectar(planClase({ modelo: { tipo: 'pesos', pesos: [], pesoSiembra: 2.8 } })).errores.length > 0);
  assert(proyectar(planClase({ modelo: { tipo: 'gdp', gdp: null } })).errores.length > 0);
  assert(proyectar(planClase({ pobInicial: 0 })).errores.length > 0);
});
test('el plan que termina antes del horizonte se detiene y lo avisa', () => {
  const r = proyectar(planClase({ horizonteDias: 240 })); assert.strictEqual(r.resumen.truncadoEnDia, 180); assert(r.avisos.some((t) => t.includes('termina antes')));
});

/* ---------------------------------------------------------------- */
grupo('4. Historial, F.C.A. acumulado y estimaciones (datos de ejemplo)');
const conEjemplo = () => { const s = estadoInicial(); agregarEjemplo(s); return s; };
test('el ejemplo se marca como tal y se puede quitar', () => {
  const s = conEjemplo(); assert(s.estanques.every((e) => e.ejemplo)); quitarEjemplo(s); assert.strictEqual(s.estanques.length + s.muestreos.length + s.costos.length + s.ingresos.length, 0);
});
test('F.C.A. acumulado: ÷ ganancia de biomasa (1.78) y ÷ biomasa final (1.77)', () => {
  const s = conEjemplo(); const e = s.estanques[0];
  const an = analizarEstanque(s, e, '2025-08-01');
  casi(an.ult.alimentoAcum, 20270.88, 0.005); casi(an.fcaAcum, 20270.88 / (11465.1 - 80.64), 1e-9);
  s.config.fcaTotalMetodo = 'cosecha'; casi(analizarEstanque(s, e, '2025-08-01').fcaAcum, 20270.88 / 11465.1, 1e-9);
});
test('F.C.A. por período del historial', () => {
  const s = conEjemplo(); const an = analizarEstanque(s, s.estanques[0], '2025-08-01');
  lista(an.regs.map((r) => r.fcaPeriodo.valor), [0.68, 0.97, 0.97, 1.67, 1.95, 2.85]);
});
test('mortalidad del cultivo, peces comprados y supervivencia real', () => {
  const s = conEjemplo(); const an = analizarEstanque(s, s.estanques[0], '2025-08-01');
  assert.strictEqual(an.comprados, 31305); assert.strictEqual(an.pobIni - an.actual.pob, 3322); casi(an.superv, 25478 / 28800 * 100, 1e-9);
  casi(an.insumos.calKg, 940.8, 1e-9); casi(an.insumos.fertIniKg, 1296, 1e-9);
  casi(an.biomasaHa, 11465.1 * 10000 / 9600, 1e-6); casi(an.biomasaM3, 11465.1 / 14400, 1e-9);
});
test('el estado actual distingue real / estimado / inicial', () => {
  const s = estadoInicial(); const e = Object.assign(estanqueNuevo('esp-gamitana'), { id: 'x', codigo: 'A', area: 1000, densidad: 5, fechaSiembra: '2026-01-01', pesoInicial: 2.8 }); s.estanques.push(e);
  assert.strictEqual(analizarEstanque(s, e, '2025-12-01').actual.fuente, 'inicial');
  assert.strictEqual(analizarEstanque(s, e, '2026-02-15').actual.fuente, 'estimado');
  s.muestreos.push({ id: 'm1', estanqueId: 'x', fecha: '2026-02-01', peso: 15, poblacion: 4900, activo: true });
  assert.strictEqual(analizarEstanque(s, e, '2026-02-15').actual.fuente, 'real');
});
test('corregir una medición conserva la anterior (no se sobrescribe)', () => {
  const s = conEjemplo(); const e = s.estanques[0]; const total = s.muestreos.length;
  const vieja = s.muestreos[0]; vieja.activo = false; vieja.reemplazadoPor = 'nuevo';
  s.muestreos.push({ id: 'nuevo', estanqueId: e.id, fecha: vieja.fecha, peso: 17, poblacion: vieja.poblacion, alimentoSuministrado: vieja.alimentoSuministrado, activo: true, creado: 99 });
  assert.strictEqual(s.muestreos.length, total + 1); const an = analizarEstanque(s, e, '2025-08-01');
  assert.strictEqual(an.regs.length, 6); casi(an.regs[0].peso, 17); assert.strictEqual(s.muestreos.find((m) => m.id === vieja.id).peso, 16);
});
test('actualización al editar datos: cambia el peso y cambian biomasa y F.C.A.', () => {
  const s = conEjemplo(); const e = s.estanques[0]; const antes = analizarEstanque(s, e, '2025-08-01');
  s.muestreos.filter((m) => m.estanqueId === e.id).pop().peso = 500;
  const despues = analizarEstanque(s, e, '2025-08-01');
  assert(despues.actual.biomasa > antes.actual.biomasa); assert(despues.fcaAcum < antes.fcaAcum);
});
test('biomasa retirada se suma al incremento; biomasa muerta no', () => {
  const s = estadoInicial(); s.config.modoClase = false;
  const e = Object.assign(estanqueNuevo('esp-gamitana'), { id: 'x', codigo: 'A', area: 1000, poblacionInicial: 1000, pesoInicial: 10, fechaSiembra: '2026-01-01' }); s.estanques.push(e);
  s.muestreos.push({ id: 'm', estanqueId: 'x', fecha: '2026-02-01', peso: 20, poblacion: 900, alimentoSuministrado: 20, biomasaRetirada: 2, activo: true });
  const r = analizarEstanque(s, e, '2026-02-02').regs[0]; casi(r.biomasa, 18); casi(r.incremento, 18 + 2 - 10); casi(r.fcaPeriodo.valor, 20 / 10);
});

/* ---------------------------------------------------------------- */
grupo('5. Economía');
function estadoEco() {
  const s = estadoInicial(); s.config.modoClase = false;
  const e = Object.assign(estanqueNuevo('esp-gamitana'), { id: 'e1', codigo: 'E1', area: 1000, poblacionInicial: 5000, pesoInicial: 2, fechaSiembra: '2026-01-01', precioVenta: 10, autoSemilla: false, autoAlimento: false });
  s.estanques.push(e);
  s.muestreos.push({ id: 'm1', estanqueId: 'e1', fecha: '2026-03-01', peso: 100, poblacion: 4500, alimentoSuministrado: 300, activo: true });
  s.costos.push({ id: 'c1', estanqueId: 'e1', fecha: '2026-01-02', categoria: 'Mano de obra', concepto: 'x', monto: 1000, tipo: 'real' }, { id: 'c2', estanqueId: 'e1', fecha: '2026-02-02', categoria: 'Electricidad', concepto: 'y', monto: 500, tipo: 'real' }, { id: 'c3', estanqueId: 'e1', fecha: '2026-06-02', categoria: 'Transporte', concepto: 'z', monto: 300, tipo: 'proyectado' });
  return s;
}
test('costos, ingresos estimados, ganancia, margen, equilibrio y precio mínimo', () => {
  const s = estadoEco(); const an = analizarEstanque(s, s.estanques[0], '2026-03-02'); const eco = economiaEstanque(s, an, '2026-03-02', null);
  casi(eco.costoReal, 1500); casi(eco.costoProy, 300); casi(eco.costoTotal, 1800); casi(eco.costoPorSembrado, 0.36); casi(eco.costoPorSobreviviente, 0.4); casi(eco.kgProd, 450); casi(eco.costoPorKg, 4);
  casi(eco.ingEst, 4500); casi(eco.ganEst, 2700); casi(eco.margenEst, 0.6); casi(eco.puntoEquilibrioKg, 180); casi(eco.precioMinimo, 4);
});
test('ingresos reales cero: margen no disponible (sin error matemático)', () => {
  const s = estadoEco(); const an = analizarEstanque(s, s.estanques[0], '2026-03-02'); const eco = economiaEstanque(s, an, '2026-03-02', null);
  assert.strictEqual(eco.margenReal, null); casi(eco.ganReal, -1500);
});
test('ingresos reales: ganancia y margen reales', () => {
  const s = estadoEco(); s.ingresos.push({ id: 'i1', estanqueId: 'e1', fecha: '2026-03-10', concepto: 'venta', monto: 2000, kg: 200, tipo: 'real' });
  const an = analizarEstanque(s, s.estanques[0], '2026-03-12'); const eco = economiaEstanque(s, an, '2026-03-12', null);
  casi(eco.ingReal, 2000); casi(eco.ganReal, 500); casi(eco.margenReal, 0.25); casi(eco.kgVendidos, 200);
});
test('sin precio de venta: no inventa ingresos ni punto de equilibrio', () => {
  const s = estadoEco(); s.estanques[0].precioVenta = ''; const an = analizarEstanque(s, s.estanques[0], '2026-03-02'); const eco = economiaEstanque(s, an, '2026-03-02', null);
  assert.strictEqual(eco.puntoEquilibrioKg, null); assert.strictEqual(eco.ingVentaEst, null); casi(eco.ingEst, 0); assert.strictEqual(eco.margenEst, null);
});
test('costos automáticos de semilla y alimento (y desactivables)', () => {
  const s = estadoEco(); const e = s.estanques[0]; Object.assign(e, { autoSemilla: true, autoAlimento: true, mortTransporte: 8, precioCompra: 0.2, precioAlimento: 2.5 });
  let an = analizarEstanque(s, e, '2026-03-02'); let eco = economiaEstanque(s, an, '2026-03-02', null);
  casi(eco.costoReal, 1500 + 5435 * 0.2 + 300 * 2.5);
  e.autoSemilla = false; e.autoAlimento = false; an = analizarEstanque(s, e, '2026-03-02'); casi(economiaEstanque(s, an, '2026-03-02', null).costoReal, 1500);
});
test('resumen de la granja: F.C.A. ponderado y totales', () => {
  const s = conEjemplo(); const G = resumenGranja(s, '2025-08-01', {}); assert.strictEqual(G.filas.length, 2); casi(G.kpi.fcaGranja, 20270.88 / (11465.1 - 80.64), 1e-6);
  assert.strictEqual(resumenGranja(s, '2025-08-01', { especie: 'esp-tilapia' }).filas.length, 1);
  assert.strictEqual(resumenGranja(s, '2025-08-01', { estado: 'preparado' }).filas.length, 0);
});

/* ---------------------------------------------------------------- */
grupo('6. Validaciones y alertas');
const hayAlerta = (s, nivel, dato, hoy) => evaluarAlertas(s, hoy || '2026-03-02').some((a) => a.nivel === nivel && a.dato.includes(dato));
test('formulario de estanque: obligatorios, duplicados y negativos', () => {
  const ex = Object.assign(estanqueNuevo('esp-gamitana'), { id: 'a', codigo: 'E1', area: 100 });
  assert(validarEstanque(Object.assign(estanqueNuevo('x'), { id: 'n', codigo: '', area: 5 }), []).length >= 1);
  assert(validarEstanque(Object.assign(estanqueNuevo('x'), { id: 'n', codigo: 'e1', area: 5 }), [ex]).some((t) => t.includes('Ya existe')));
  assert(validarEstanque(Object.assign(estanqueNuevo('x'), { id: 'n', codigo: 'N', area: 0 }), []).some((t) => t.includes('mayor que cero')));
  assert(validarEstanque(Object.assign(estanqueNuevo('x'), { id: 'n', codigo: 'N', area: -4 }), []).length > 0);
  assert(validarEstanque(Object.assign(estanqueNuevo('x'), { id: 'n', codigo: 'N', area: 5, poblacionInicial: -3 }), []).length > 0);
  assert(validarEstanque(Object.assign(estanqueNuevo('x'), { id: 'n', codigo: 'N', area: 5, fechaSiembra: '2026-05-01', fechaCosecha: '2026-04-01' }), []).some((t) => t.includes('anterior')));
  igual(validarEstanque(Object.assign(estanqueNuevo('x'), { id: 'a', codigo: 'E1', area: 100 }), [ex]), []);
});
test('formularios de medición, movimiento y especie', () => {
  const e = { fechaSiembra: '2026-01-01' };
  assert(validarMedicion({ fecha: '2026-02-01', peso: '' }, e).length > 0); assert(validarMedicion({ fecha: '2026-02-01', peso: -5 }, e).length > 0); assert(validarMedicion({ fecha: '2025-12-01', peso: 5 }, e).length > 0);
  igual(validarMedicion({ fecha: '2026-02-01', peso: 5 }, e), []);
  assert(validarMovimiento({ fecha: '2026-02-01', monto: -1 }).length > 0); assert(validarMovimiento({ fecha: '2026-02-01', monto: '' }).length > 0);
  assert(validarEspecie({ nombre: 'X', supervivencia: 120 }).length > 0); assert(validarEspecie({ nombre: '' }).length > 0); assert(validarEspecie({ nombre: 'X', densidadMin: 9, densidadMax: 3 }).length > 0);
});
test('alertas de error: área ≤ 0, población viva > sembrada, fecha de cosecha, precios y costos negativos', () => {
  const s = estadoEco(); const e = s.estanques[0];
  e.area = 0; assert(hayAlerta(s, 'error', 'Área del estanque')); e.area = 1000;
  s.muestreos[0].poblacion = 6000; assert(hayAlerta(s, 'error', 'Población viva')); s.muestreos[0].poblacion = 4500;
  e.fechaCosecha = '2025-12-01'; assert(hayAlerta(s, 'error', 'Fecha de cosecha')); e.fechaCosecha = '';
  e.precioVenta = -3; assert(hayAlerta(s, 'error', 'Precio de venta')); e.precioVenta = 10;
  s.costos[0].monto = -10; assert(hayAlerta(s, 'error', 'Costo')); s.costos[0].monto = 1000;
  s.muestreos[0].peso = 0; assert(hayAlerta(s, 'error', 'Peso promedio'));
});
test('cada alerta indica dato, motivo, valor y cómo corregirlo', () => {
  const s = estadoEco(); s.estanques[0].area = 0;
  const a = evaluarAlertas(s, '2026-03-02').find((x) => x.nivel === 'error');
  for (const k of ['dato', 'porque', 'valor', 'corregir']) assert(a[k] && String(a[k]).length > 3, k);
});
test('advertencias: peso que baja, biomasa pesada distinta, F.C.A. no calculable, especie sin parámetros', () => {
  const s = estadoEco(); const e = s.estanques[0];
  s.muestreos.push({ id: 'm2', estanqueId: 'e1', fecha: '2026-04-01', peso: 50, poblacion: 4400, alimentoSuministrado: 100, biomasaMedida: 900, activo: true });
  const al = evaluarAlertas(s, '2026-04-02');
  assert(al.some((a) => a.dato.includes('Peso promedio') && a.porque.includes('bajó'))); assert(al.some((a) => a.dato.includes('Biomasa'))); assert(al.some((a) => a.dato.includes('F.C.A.')));
  e.especieId = 'esp-tilapia'; assert(evaluarAlertas(s, '2026-04-02').some((a) => a.nivel === 'advertencia' && a.dato.includes('Parámetros de Tilapia')));
});
test('límites de densidad configurables por especie (no se juzga con rangos genéricos)', () => {
  const s = estadoEco(); const e = s.estanques[0], esp = s.especies.find((x) => x.id === 'esp-gamitana');
  assert(hayAlerta(s, 'recomendacion', 'Límites de densidad'));          // sin límites: solo recomienda definirlos
  assert(!evaluarAlertas(s, '2026-03-02').some((a) => a.dato === 'Densidad de siembra'));
  esp.densidadMin = 1; esp.densidadMax = 3; assert(hayAlerta(s, 'advertencia', 'Densidad de siembra')); // 5 org/m² > 3
  esp.densidadMax = 8; assert(!hayAlerta(s, 'advertencia', 'Densidad de siembra')); void e;
});
test('proyección incompatible con lo registrado y recomendación de muestreo', () => {
  const s = conEjemplo(); const e = s.estanques[0]; e.estado = 'en crianza'; s.muestreos.filter((m) => m.estanqueId === e.id).forEach((m) => { m.peso *= 3; });
  assert(evaluarAlertas(s, '2025-07-03').some((a) => a.dato === 'Proyección de crecimiento'));
  assert(evaluarAlertas(s, '2025-12-01').some((a) => a.nivel === 'recomendacion' && a.dato === 'Muestreo'));
});
test('un estanque completo y consistente no genera errores', () => {
  const s = conEjemplo(); assert.strictEqual(evaluarAlertas(s, '2025-08-01').filter((a) => a.nivel === 'error').length, 0);
});

/* ---------------------------------------------------------------- */
grupo('7. Persistencia');
const memoria = () => { const d = {}; return { getItem: (k) => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = v; }, _d: d }; };
test('guardar y volver a cargar conserva estanques, mediciones y costos', () => {
  const b = memoria(), st = crearStore(b, 'k'); const s = conEjemplo(); assert(st.guardar(s).ok);
  const r = crearStore(b, 'k').cargar(); assert(!r.nuevo); assert.strictEqual(r.state.estanques.length, 2); assert.strictEqual(r.state.muestreos.length, 6); assert.strictEqual(r.state.costos.length, 3);
  casi(analizarEstanque(r.state, r.state.estanques[0], '2025-08-01').fcaAcum, 20270.88 / (11465.1 - 80.64), 1e-9);
});
test('sin datos previos arranca con las 3 especies y sin estanques', () => {
  const r = crearStore(memoria(), 'k').cargar(); assert(r.nuevo); igual(r.state.especies.map((x) => x.nombre), ['Gamitana', 'Tilapia', 'Langostino blanco (Penaeus vanname)']); assert.strictEqual(r.state.estanques.length, 0);
});
test('datos dañados no rompen la aplicación', () => {
  const b = memoria(); b.setItem('k', '{no es json'); const r = crearStore(b, 'k').cargar(); assert(r.error); assert.strictEqual(r.state.estanques.length, 0);
});
test('error al guardar (cuota llena) se informa', () => {
  const st = crearStore({ getItem: () => null, setItem: () => { throw new Error('QuotaExceeded'); } }, 'k'); assert.strictEqual(st.guardar(estadoInicial()).ok, false);
});
test('un guardado antiguo con campos faltantes se normaliza', () => {
  const o = normalizarEstado({ version: 1, estanques: [{ id: 'a' }], config: { moneda: 'USD' } }); assert.strictEqual(o.config.moneda, 'USD'); assert.strictEqual(o.config.tolProyPct, 25); assert(Array.isArray(o.costos));
});
test('respaldo: validación del formato', () => {
  assert(validarRespaldo({}) !== null); assert(validarRespaldo(null) !== null); assert.strictEqual(validarRespaldo(JSON.parse(JSON.stringify(conEjemplo()))), null);
});
test('las especies no comparten parámetros: tilapia y camarón no heredan los de gamitana', () => {
  const s = estadoInicial(); const t = s.especies.find((x) => x.id === 'esp-tilapia'), c = s.especies.find((x) => x.id === 'esp-camaron');
  for (const e of [t, c]) { assert.strictEqual(e.pesoCosecha, null); igual(e.tasasPeriodo, []); igual(e.pesosEsperados, []); assert.strictEqual(e.precioKg, null); }
  assert.strictEqual(s.especies[0].precioKg, null); assert.strictEqual(s.especies[0].fcaEsperado, null);
});

/* ---------------------------------------------------------------- */
grupo('8. Exportación');
test('CSV: comillas, comas y saltos de línea escapados, con BOM para Excel', () => {
  const t = aCSV([['a', 'b,c', 'd"e', 'f\ng'], [1, null, undefined, 0]]); assert(t.startsWith('\ufeff')); assert(t.includes('"b,c"')); assert(t.includes('"d""e"')); assert(t.includes('"f\ng"')); assert(t.includes('1,,,0'));
});
test('tablas exportadas: resumen, estanques, historial, costos e ingresos con sus datos', () => {
  const s = conEjemplo(); const h = tablasExport(s, '2025-08-01'); igual(h.map((x) => x.nombre), ['Resumen', 'Estanques', 'Historial', 'Costos', 'Ingresos']);
  const por = Object.fromEntries(h.map((x) => [x.nombre, x.filas])); assert.strictEqual(por.Resumen.length, 3); assert.strictEqual(por.Estanques.length, 3); assert.strictEqual(por.Historial.length, 7); assert.strictEqual(por.Costos.length, 4); assert.strictEqual(por.Ingresos.length, 2);
  assert(por.Historial[1].includes('EJ-01')); assert(por.Estanques[1].includes('sí'));
  assert(h.every((x) => x.filas.every((f) => f.length === x.filas[0].length)));
});
test('exportación a Excel (SpreadsheetML): hojas, números tipados y XML bien formado', () => {
  const xml = aExcelXML(tablasExport(conEjemplo(), '2025-08-01') .concat([{ nombre: 'Prueba <&>', filas: [['a<b', 3, 'x"y']] }]));
  assert((xml.match(/<Worksheet /g) || []).length === 6); assert(xml.includes('ss:Type="Number"')); assert(xml.includes('a&lt;b')); assert(xml.includes('Prueba &lt;&amp;&gt;'));
  const abre = (xml.match(/<(Row|Cell|Data|Table|Worksheet)\b/g) || []).length, cierra = (xml.match(/<\/(Row|Cell|Data|Table|Worksheet)>/g) || []).length; assert.strictEqual(abre, cierra);
});

/* ---------------------------------------------------------------- */
grupo('9. Vistas (HTML) sin errores, sin NaN/undefined/Infinity');
const mkUI = (s) => ({ tab: 'resumen', sel: s.estanques[0] ? s.estanques[0].id : null, filtro: { especie: '', estado: '', desde: '', hasta: '' }, graf: null, formEst: null, formEstNuevo: false, vinculo: 'poblacionInicial',
  med: { fecha: '2026-01-01', peso: '', poblacion: '', muertos: '', alimentoSuministrado: '', alimentoConsumido: '', biomasaRetirada: '', biomasaMedida: '', obs: '' }, medCorrige: null, ali: { tasa: '', raciones: '3' },
  fcaMan: { sum: '', cons: '', bioIni: '', bioAct: '', ret: '', dias: '' }, proy: null, proyFor: null, eco: { cFecha: '', cCat: 'Mano de obra', cConcepto: '', cMonto: '', cTipo: 'real', iFecha: '', iConcepto: '', iMonto: '', iKg: '', iTipo: 'real' },
  alertas: { nivel: '', estanque: '' }, espSel: null });
const vistas = ['v_resumen', 'v_estanques', 'v_produccion', 'v_alimentacion', 'v_proyecciones', 'v_economia', 'v_alertas', 'v_historial', 'v_config'];
const limpio = (h) => !/NaN|undefined|Infinity|\[object/.test(h.replace(/<style[\s\S]*?<\/style>/g, ''));
for (const [titulo, mk] of [['con datos de ejemplo', conEjemplo], ['sin datos (estados vacíos)', estadoInicial], ['con estanque sin datos', () => { const s = estadoInicial(); s.estanques.push(Object.assign(estanqueNuevo('esp-camaron'), { id: 'v', codigo: 'V' })); return s; }]]) {
  test(`todas las secciones se generan ${titulo}`, () => {
    const s = mk(); for (const v of vistas) { const ui = mkUI(s); const h = A[v](s, ui, '2025-08-01'); assert(typeof h === 'string' && h.length > 50, v); assert(limpio(h), `${v}: contiene NaN/undefined`); }
    for (const v of ['v_produccion_live', 'v_alim_live', 'v_proy_live', 'v_eco_live']) { const ui = mkUI(s); assert(limpio(A[v](s, ui, '2025-08-01')), v); }
    if (s.estanques[0]) { assert(limpio(A.v_reporte(s, s.estanques[0].id, '2025-08-01'))); }
    assert(limpio(A.v_reporte(s, '__todos', '2025-08-01')));
  });
}
test('la proyección en pantalla lista sus supuestos y diferencia real de proyectado', () => {
  const s = conEjemplo(); const ui = mkUI(s); ui.tab = 'proyecciones'; ui.sel = s.estanques[1].id; const h = A.v_proyecciones(s, ui, '2026-03-01');
  assert(h.includes('Supuestos de esta proyección')); assert(h.includes('PROYECTADO')); assert(h.includes('Peso: real vs proyectado'));
});
test('la economía no genera errores aunque los ingresos sean 0', () => {
  const s = estadoEco(); const ui = mkUI(s); const h = A.v_eco_live(s, ui, '2026-03-02'); assert(h.includes('N/D')); assert(limpio(h));
});
test('producción: al escribir peso y población el resultado se actualiza y se marca sin guardar', () => {
  const s = conEjemplo(); const ui = mkUI(s); const base = A.v_produccion_live(s, ui, '2025-08-01');
  ui.med.peso = '500'; ui.med.poblacion = '25000'; const nuevo = A.v_produccion_live(s, ui, '2025-08-01');
  assert(nuevo.includes('SIN GUARDAR')); assert(!base.includes('SIN GUARDAR')); assert(nuevo.includes('12,500.00') || nuevo.includes('12.500,00') || nuevo.includes('12500'));
});
test('estático: pantalla pequeña (meta viewport, media query, tabla con desplazamiento) y accesibilidad básica', () => {
  assert(/<meta name="viewport" content="width=device-width, initial-scale=1">/.test(html)); assert(/@media \(max-width:640px\)/.test(html)); assert(html.includes('overflow-x:auto'));
  assert(html.includes('role="tablist"')); assert(html.includes('aria-live')); assert(html.includes('focus-visible')); assert(html.includes('@media print'));
});

console.log(`\n${fallos ? '✘' : '✔'} ${ok} pruebas correctas, ${fallos} con fallos`);
process.exit(fallos ? 1 : 0);
