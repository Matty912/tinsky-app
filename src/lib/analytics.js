// Funciones de análisis reutilizables sobre el objeto `data` de la app.
// Todas son puras (no mutan nada) y devuelven datos ya calculados,
// para que Resumen, Estadísticas, el Dashboard de Producción y el
// Asistente puedan compartir exactamente la misma lógica.

export const NOMBRE_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const NOMBRE_MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function num(v) {
  return Number(v) || 0;
}

export function ventasDe(data) {
  return data.ventas || [];
}

export function mesActualKey() {
  return new Date().toISOString().slice(0, 7);
}

export function ventasDelMes(data, mesKey = mesActualKey()) {
  return ventasDe(data).filter((v) => (v.fecha || "").slice(0, 7) === mesKey);
}

export function ventasDelAnio(data, anio = new Date().getFullYear().toString()) {
  return ventasDe(data).filter((v) => (v.fecha || "").slice(0, 4) === anio);
}

export function totales(ventas) {
  const ingreso = ventas.reduce((acc, v) => acc + num(v.monto), 0);
  const costo = ventas.reduce((acc, v) => acc + num(v.costo), 0);
  return { ingreso, costo, ganancia: ingreso - costo };
}

// ---------- Ranking de productos ----------
export function rankingProductos(data) {
  const map = {};
  ventasDe(data).forEach((v) => {
    const key = v.nombre || "Sin nombre";
    if (!map[key]) map[key] = { nombre: key, unidades: 0, ingreso: 0, costo: 0 };
    map[key].unidades += num(v.cantidad);
    map[key].ingreso += num(v.monto);
    map[key].costo += num(v.costo);
  });
  return Object.values(map).map((p) => ({ ...p, ganancia: p.ingreso - p.costo }));
}

export function productoMasVendido(data) {
  const r = rankingProductos(data);
  if (r.length === 0) return null;
  return [...r].sort((a, b) => b.unidades - a.unidades)[0];
}

export function productoMasRentable(data) {
  const r = rankingProductos(data);
  if (r.length === 0) return null;
  return [...r].sort((a, b) => b.ganancia - a.ganancia)[0];
}

export function top10(data, criterio = "ingreso") {
  return [...rankingProductos(data)].sort((a, b) => b[criterio] - a[criterio]).slice(0, 10);
}

// ---------- Categorías (usa el campo opcional `categoria` de products) ----------
export function mapaCategoriaPorProducto(data) {
  const map = {};
  (data.products || []).forEach((p) => {
    map[p.nombre] = p.categoria && p.categoria.trim() ? p.categoria.trim() : "Sin categoría";
  });
  return map;
}

export function ventasPorCategoria(data) {
  const catPorNombre = mapaCategoriaPorProducto(data);
  const map = {};
  ventasDe(data).forEach((v) => {
    const cat = catPorNombre[v.nombre] || "Sin categoría";
    if (!map[cat]) map[cat] = { categoria: cat, ingreso: 0, costo: 0, unidades: 0 };
    map[cat].ingreso += num(v.monto);
    map[cat].costo += num(v.costo);
    map[cat].unidades += num(v.cantidad);
  });
  return Object.values(map).map((c) => ({ ...c, ganancia: c.ingreso - c.costo }));
}

export function categoriaMasRentable(data) {
  const c = ventasPorCategoria(data);
  if (c.length === 0) return null;
  return [...c].sort((a, b) => b.ganancia - a.ganancia)[0];
}

// ---------- Medios de pago ----------
export function ventasPorMedioPago(data) {
  const map = {};
  ventasDe(data).forEach((v) => {
    const medio = v.medioPago || "Sin especificar";
    if (!map[medio]) map[medio] = { medio, ingreso: 0, cantidad: 0 };
    map[medio].ingreso += num(v.monto);
    map[medio].cantidad += 1;
  });
  return Object.values(map).sort((a, b) => b.ingreso - a.ingreso);
}

// ---------- Series por mes (para gráficos e insights) ----------
function mesesEntreAnalytics(fechaInicio, fechaFin) {
  const arr = [];
  const start = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth(), 1);
  const end = new Date(fechaFin.getFullYear(), fechaFin.getMonth(), 1);
  let cursor = start;
  while (cursor <= end) {
    arr.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return arr;
}

export function serieMensualCompleta(data) {
  const ventas = ventasDe(data);
  const compras = data.purchases || [];
  if (ventas.length === 0 && compras.length === 0) return [];
  const hoy = new Date();
  const fechas = [...ventas.map((v) => v.fecha), ...compras.map((p) => p.fecha)].filter(Boolean).sort();
  const primera = fechas.length ? new Date(fechas[0]) : hoy;
  const meses = mesesEntreAnalytics(primera, hoy);
  return meses.map((m) => {
    const [, mm] = m.split("-");
    const vs = ventas.filter((v) => (v.fecha || "").slice(0, 7) === m);
    const ingreso = vs.reduce((acc, v) => acc + num(v.monto), 0);
    const costo = vs.reduce((acc, v) => acc + num(v.costo), 0);
    const gastos = compras.filter((p) => (p.fecha || "").slice(0, 7) === m).reduce((acc, p) => acc + num(p.monto), 0);
    return { key: m, mes: NOMBRE_MES[Number(mm) - 1], Ingresos: ingreso, Ganancia: ingreso - costo, Gastos: gastos };
  });
}

export function mejorMes(data) {
  const serie = serieMensualCompleta(data);
  if (serie.length === 0) return null;
  return [...serie].sort((a, b) => b.Ingresos - a.Ingresos)[0];
}

export function comparacionMensual(data) {
  const hoy = new Date();
  const actualKey = hoy.toISOString().slice(0, 7);
  const anteriorDate = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const anteriorKey = anteriorDate.toISOString().slice(0, 7);
  const actual = totales(ventasDelMes(data, actualKey));
  const anterior = totales(ventasDelMes(data, anteriorKey));
  const variacion = anterior.ingreso > 0 ? ((actual.ingreso - anterior.ingreso) / anterior.ingreso) * 100 : null;
  return { actual, anterior, variacion };
}

export function comparacionAnual(data) {
  const hoy = new Date();
  const actual = totales(ventasDelAnio(data, hoy.getFullYear().toString()));
  const anterior = totales(ventasDelAnio(data, (hoy.getFullYear() - 1).toString()));
  const variacion = anterior.ingreso > 0 ? ((actual.ingreso - anterior.ingreso) / anterior.ingreso) * 100 : null;
  return { actual, anterior, variacion };
}

// ---------- Consumo de filamento (usa data.consumos, generado desde Stock) ----------
export function consumoPorColor(data) {
  const map = {};
  (data.consumos || []).forEach((c) => {
    const key = `${c.material} ${c.color}`;
    if (!map[key]) map[key] = { label: key, gramos: 0 };
    map[key].gramos += num(c.gramos);
  });
  return Object.values(map).sort((a, b) => b.gramos - a.gramos);
}

export function consumoPorMaterial(data) {
  const map = {};
  (data.consumos || []).forEach((c) => {
    if (!map[c.material]) map[c.material] = { label: c.material, gramos: 0 };
    map[c.material].gramos += num(c.gramos);
  });
  return Object.values(map).sort((a, b) => b.gramos - a.gramos);
}

export function materialMasUsado(data) {
  const c = consumoPorMaterial(data);
  return c.length ? c[0] : null;
}

export function colorMasUsado(data) {
  const c = consumoPorColor(data);
  return c.length ? c[0] : null;
}

// Consumo semanal promedio de un rollo específico, en base al historial de consumos con ese stockId
export function consumoSemanalPromedio(data, stockId) {
  const registros = (data.consumos || []).filter((c) => c.stockId === stockId);
  if (registros.length === 0) return null;
  const fechas = registros.map((r) => new Date(r.fecha)).sort((a, b) => a - b);
  const primera = fechas[0];
  const hoy = new Date();
  const semanas = Math.max(1, (hoy - primera) / (1000 * 60 * 60 * 24 * 7));
  const totalGramos = registros.reduce((acc, r) => acc + num(r.gramos), 0);
  return totalGramos / semanas;
}

// ---------- Clientes (texto libre, agrupado por nombre) ----------
export function clientesTop(data) {
  const map = {};
  (data.orders || []).forEach((o) => {
    const nombre = (o.cliente || "").trim();
    if (!nombre) return;
    const key = nombre.toLowerCase();
    if (!map[key]) map[key] = { nombre, pedidos: 0, total: 0 };
    map[key].pedidos += 1;
    map[key].total += num(o.precioTotal);
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

// ---------- Pedidos / producción ----------
export function pedidosActivos(data) {
  return (data.orders || []).filter((o) => o.estado !== "entregado");
}

export function pedidosAtrasados(data) {
  const hoy = todayISOStr();
  return pedidosActivos(data).filter((o) => o.fechaEntrega && o.fechaEntrega < hoy);
}

export function proximaEntrega(data) {
  const hoy = todayISOStr();
  const activos = pedidosActivos(data).filter((o) => o.fechaEntrega && o.fechaEntrega >= hoy);
  if (activos.length === 0) return null;
  return [...activos].sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega))[0];
}

function todayISOStr() {
  return new Date().toISOString().slice(0, 10);
}

export function pendientesProduccion(data) {
  const activos = pedidosActivos(data).filter((o) => o.estado !== "listo");
  const gramos = activos.reduce((acc, o) => acc + num(o.pesoEstimado), 0);
  const horas = activos.reduce((acc, o) => acc + num(o.tiempoEstimado), 0);
  const conDatos = activos.filter((o) => o.pesoEstimado || o.tiempoEstimado).length;
  return { gramos, horas, cantidadPedidos: activos.length, cantidadConDatos: conDatos };
}

// ---------- Ticket / márgenes ----------
export function metricasVentas(data) {
  const ventas = ventasDe(data);
  if (ventas.length === 0) {
    return { ticketPromedio: 0, gananciaPromedioPorVenta: 0, costoPromedio: 0, margenPromedio: null, cantidadVentas: 0 };
  }
  const ingresoTotal = ventas.reduce((acc, v) => acc + num(v.monto), 0);
  const costoTotal = ventas.reduce((acc, v) => acc + num(v.costo), 0);
  const gananciaTotal = ingresoTotal - costoTotal;
  const conCosto = ventas.filter((v) => num(v.costo) > 0);
  const margenPromedio = conCosto.length
    ? conCosto.reduce((acc, v) => acc + ((num(v.monto) - num(v.costo)) / num(v.costo)) * 100, 0) / conCosto.length
    : null;
  return {
    ticketPromedio: ingresoTotal / ventas.length,
    gananciaPromedioPorVenta: gananciaTotal / ventas.length,
    costoPromedio: costoTotal / ventas.length,
    margenPromedio,
    cantidadVentas: ventas.length,
  };
}

// ---------- Predicción de stock ----------
export function duracionEstimadaDias(data, stockId) {
  const item = (data.stock || []).find((s) => s.id === stockId);
  if (!item) return null;
  const semanal = consumoSemanalPromedio(data, stockId);
  if (!semanal || semanal <= 0) return null;
  return (num(item.pesoRestante) / semanal) * 7;
}

export function nivelRiesgo(dias) {
  if (dias === null || dias === undefined) return null;
  if (dias < 7) return "Alto";
  if (dias < 14) return "Medio";
  return "Bajo";
}

// ---------- Planificador de feria ----------
export function productosConMetadata(data) {
  const prodPorNombre = {};
  (data.products || []).forEach((p) => {
    prodPorNombre[p.nombre] = p;
  });
  return rankingProductos(data).map((r) => {
    const meta = prodPorNombre[r.nombre] || {};
    return {
      ...r,
      tiempoImpresionHoras: num(meta.tiempoImpresionHoras),
      pesoGramos: num(meta.pesoGramos),
      categoria: meta.categoria && meta.categoria.trim() ? meta.categoria.trim() : "Sin categoría",
    };
  });
}

export function planificarFeria(data, horasDisponibles) {
  const candidatos = productosConMetadata(data).filter((p) => p.unidades > 0);
  if (candidatos.length === 0 || !horasDisponibles || horasDisponibles <= 0) {
    return { items: [], horasUsadas: 0, gananciaEsperada: 0, gramosEstimados: 0, cantidadProductos: 0 };
  }
  const conRatio = candidatos
    .map((p) => {
      const gananciaUnidad = p.unidades > 0 ? p.ganancia / p.unidades : 0;
      const horasUnidad = p.tiempoImpresionHoras > 0 ? p.tiempoImpresionHoras : 0.5;
      return { ...p, gananciaUnidad, horasUnidad, ratio: horasUnidad > 0 ? gananciaUnidad / horasUnidad : gananciaUnidad };
    })
    .sort((a, b) => b.ratio - a.ratio);

  let horasRestantes = horasDisponibles;
  const items = [];
  conRatio.forEach((p) => {
    if (horasRestantes <= 0) return;
    const maxPorHoras = p.horasUnidad > 0 ? Math.floor(horasRestantes / p.horasUnidad) : 0;
    if (maxPorHoras <= 0) return;
    const sugerido = Math.max(1, Math.min(p.unidades, maxPorHoras));
    const horas = sugerido * p.horasUnidad;
    items.push({ nombre: p.nombre, cantidad: sugerido, horas, ganancia: sugerido * p.gananciaUnidad, gramos: sugerido * p.pesoGramos });
    horasRestantes -= horas;
  });

  return {
    items,
    horasUsadas: items.reduce((a, i) => a + i.horas, 0),
    gananciaEsperada: items.reduce((a, i) => a + i.ganancia, 0),
    gramosEstimados: items.reduce((a, i) => a + i.gramos, 0),
    cantidadProductos: items.reduce((a, i) => a + i.cantidad, 0),
  };
}

// ---------- Calendario / producción ----------
export function pedidosConFecha(data) {
  return (data.orders || []).filter((o) => o.fechaEntrega && o.estado !== "entregado");
}

export function diasSobrecargados(data, horasDiarias) {
  const porFecha = {};
  pedidosConFecha(data).forEach((o) => {
    if (!o.tiempoEstimado) return;
    const f = o.fechaEntrega;
    if (!porFecha[f]) porFecha[f] = { fecha: f, horas: 0, pedidos: [] };
    porFecha[f].horas += num(o.tiempoEstimado);
    porFecha[f].pedidos.push(o);
  });
  return Object.values(porFecha).filter((d) => d.horas > num(horasDiarias) && d.pedidos.length > 1);
}

export function stockBajoMinimo(data) {
  return (data.stock || []).filter((s) => num(s.pesoRestante) <= num(s.alertaMinimo));
}

export function recomendaciones(data) {
  const out = [];

  // Stock bajo mínimo
  stockBajoMinimo(data).forEach((s) => {
    const semanal = consumoSemanalPromedio(data, s.id);
    let texto = `Te quedan ${s.pesoRestante}g de ${s.material} ${s.color} — está bajo tu mínimo de ${s.alertaMinimo}g.`;
    if (semanal && semanal > 0) {
      const diasRestantes = Math.round((num(s.pesoRestante) / semanal) * 7);
      texto += ` Consumís unos ${Math.round(semanal)}g por semana, así que se te acaba en aproximadamente ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}.`;
    }
    out.push({ tipo: "stock", texto });
  });

  // Desbalance categoría: % de ventas vs % de tiempo de impresión
  const catVentas = ventasPorCategoria(data);
  const ingresoTotalCat = catVentas.reduce((acc, c) => acc + c.ingreso, 0);
  const tiempoPorCategoria = {};
  const catPorNombre = mapaCategoriaPorProducto(data);
  const tiempoPorNombre = {};
  (data.products || []).forEach((p) => {
    if (p.tiempoImpresionHoras) tiempoPorNombre[p.nombre] = num(p.tiempoImpresionHoras);
  });
  ventasDe(data).forEach((v) => {
    const cat = catPorNombre[v.nombre] || "Sin categoría";
    const tiempoUnit = tiempoPorNombre[v.nombre];
    if (tiempoUnit) {
      tiempoPorCategoria[cat] = (tiempoPorCategoria[cat] || 0) + tiempoUnit * num(v.cantidad);
    }
  });
  const tiempoTotal = Object.values(tiempoPorCategoria).reduce((a, b) => a + b, 0);
  if (ingresoTotalCat > 0 && tiempoTotal > 0) {
    catVentas.forEach((c) => {
      const pctIngreso = (c.ingreso / ingresoTotalCat) * 100;
      const pctTiempo = ((tiempoPorCategoria[c.categoria] || 0) / tiempoTotal) * 100;
      if (pctTiempo - pctIngreso > 12 && pctTiempo > 15) {
        out.push({
          tipo: "categoria",
          texto: `"${c.categoria}" representa el ${pctIngreso.toFixed(0)}% de tus ventas pero ocupa el ${pctTiempo.toFixed(0)}% de tu tiempo de impresión — capaz conviene priorizar otra categoría.`,
        });
      }
    });
  }

  // Pedidos atrasados
  const atrasados = pedidosAtrasados(data);
  if (atrasados.length > 0) {
    out.push({ tipo: "pedido", texto: `Tenés ${atrasados.length} pedido${atrasados.length !== 1 ? "s" : ""} con la fecha de entrega vencida y todavía sin marcar como entregado.` });
  }

  return out;
}

// ---------- Heatmap de actividad ----------
export function actividadDiaria(data, metrica) {
  const map = {};
  if (metrica === "pedidos") {
    (data.orders || []).forEach((o) => {
      const f = o.fechaCreacion;
      if (!f) return;
      map[f] = (map[f] || 0) + 1;
    });
  } else {
    ventasDe(data).forEach((v) => {
      const f = v.fecha;
      if (!f) return;
      let valor = 0;
      if (metrica === "ventas") valor = num(v.monto);
      else if (metrica === "ganancias") valor = num(v.monto) - num(v.costo);
      else if (metrica === "impresiones") valor = num(v.cantidad);
      map[f] = (map[f] || 0) + valor;
    });
  }
  return map;
}

// ---------- Dashboard ejecutivo ----------
export function ventasDelDia(data, fechaKey = todayISOStr()) {
  return ventasDe(data).filter((v) => v.fecha === fechaKey);
}

export function ventasRecientes(data, n = 6) {
  return [...ventasDe(data)].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).slice(0, n);
}

// ---------- Valor del negocio ----------
export function anioActualStr() {
  return new Date().getFullYear().toString();
}

export function valorNegocio(data, multiplicador = 2.5) {
  const anio = anioActualStr();
  const tAnual = totales(ventasDelAnio(data, anio));
  const cantidadPedidos = (data.orders || []).length;
  const cantidadVentas = ventasDe(data).length;
  const cantidadProductos = (data.products || []).length;
  const clientesDistintos = clientesTop(data).length;
  const valorEstimado = tAnual.ganancia * num(multiplicador);
  return {
    facturacionAnual: tAnual.ingreso,
    gananciaAnual: tAnual.ganancia,
    cantidadPedidos,
    cantidadVentas,
    cantidadProductos,
    clientesDistintos,
    valorEstimado,
  };
}

export function evolucionValorNegocio(data, multiplicador = 2.5) {
  const ventas = ventasDe(data);
  if (ventas.length === 0) return [];
  const anios = Array.from(new Set(ventas.map((v) => (v.fecha || "").slice(0, 4)).filter(Boolean))).sort();
  return anios.map((anio) => {
    const t = totales(ventasDelAnio(data, anio));
    return { anio, ganancia: t.ganancia, valor: t.ganancia * num(multiplicador) };
  });
}
