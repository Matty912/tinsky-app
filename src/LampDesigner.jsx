import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Layers, Palette, RotateCcw, Rotate3D, Ruler, Save, Sparkles } from "lucide-react";
import "./LampDesigner.css";

const BASE = {
  nombre: "Pantalla campana",
  tipoLuz: "colgante",
  forma: "campana",
  textura: "acanalada",
  altura: 160,
  diametroInferior: 180,
  diametroSuperior: 72,
  espesor: 2,
  canales: 24,
  relieve: 1.2,
  diametroCuerpo: 160,
  cuello: 20,
  vueltas: 2,
  lados: 96,
  portal: "E27",
  color: "#d8b99a",
  precioKg: 15000,
  precioVenta: 0,
};

const PORTALES = { E14: 28, E27: 42, GU10: 35, "A medida": 0 };

function relieveDeTexturafunction relieveDeTextura(t, angulo, cfg) {
  const n = Math.max(4, Number(cfg.canales) || 24);
  const amplitud = Number(cfg.relieve) || 0;
  const torsion = t * Math.PI * 2 * (Number(cfg.vueltas) || 0);
  if (cfg.textura === "acanalada") return amplitud * Math.cos(angulo * n + torsion);
  if (cfg.textura === "ondas") return amplitud * Math.cos(angulo * 8 + t * Math.PI * 2);
  if (cfg.textura === "rombos") return amplitud * Math.sin(angulo * n + torsion) * Math.sin(t * Math.PI * 18);
  if (cfg.textura === "espiral") return amplitud * Math.cos(angulo * n + torsion);
  return 0;
}

function crearMalla(cfg, segmentos = 96, filas = 40) {
  const exteriores = [];
  const interiores = [];
  for (let fila = 0; fila <= filas; fila += 1) {
    const t = fila / filas;
    const z = t * Number(cfg.altura);
    for (let i = 0; i < segmentos; i += 1) {
      const a = (i / segmentos) * Math.PI * 2;
      const radio = radioDePerfil(t, cfg) + relieveDeTextura(t, a, cfg);
      const interior = Math.max(2, radio - Number(cfg.espesor));
      exteriores.push([radio * Math.cos(a), radio * Math.sin(a), z]);
      interiores.push([interior * Math.cos(a), interior * Math.sin(a), z]);
    }
  }
  const caras = [];
  const idx = (f, i) => f * segmentos + (i % segmentos);
  for (let f = 0; f < filas; f += 1) {
    for (let i = 0; i < segmentos; i += 1) {
      const a = idx(f, i), b = idx(f, i + 1), c = idx(f + 1, i + 1), d = idx(f + 1, i);
      caras.push([exteriores[a], exteriores[b], exteriores[d]], [exteriores[b], exteriores[c], exteriores[d]]);
      caras.push([interiores[a], interiores[d], interiores[b]], [interiores[b], interiores[d], interiores[c]]);
    }
  }
  for (let i = 0; i < segmentos; i += 1) {
    const j = (i + 1) % segmentos;
    const o0 = exteriores[idx(0, i)], o1 = exteriores[idx(0, j)], i0 = interiores[idx(0, i)], i1 = interiores[idx(0, j)];
    const ot0 = exteriores[idx(filas, i)], ot1 = exteriores[idx(filas, j)], it0 = interiores[idx(filas, i)], it1 = interiores[idx(filas, j)];
    caras.push([o0, i0, o1], [i0, i1, o1]);
    caras.push([ot0, ot1, it0], [it0, ot1, it1]);
  }
  return caras;
}

function exportarSTL(cfg) {
  const caras = crearMalla(cfg, Math.max(12, Number(cfg.lados) || 96), 48);
  const buffer = new ArrayBuffer(84 + caras.length * 50);
  const vista = new DataView(buffer);
  const titulo = new TextEncoder().encode("Tinsky - diseno parametrico de pantalla");
  new Uint8Array(buffer, 0, titulo.length).set(titulo);
  vista.setUint32(80, caras.length, true);
  let offset = 84;
  for (const cara of caras) {
    const [a, b, c] = cara;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const largo = Math.hypot(...n) || 1;
    for (const x of n.map((value) => value / largo)) { vista.setFloat32(offset, x, true); offset += 4; }
    for (const punto of cara) for (const x of punto) { vista.setFloat32(offset, x, true); offset += 4; }
    vista.setUint16(offset, 0, true); offset += 2;
  }
  const blob = new Blob([buffer], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  const nombre = (cfg.nombre || "pantalla-tinsky").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  enlace.href = url;
  enlace.download = `${nombre || "pantalla-tinsky"}.stl`;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function colorSombreado(color, brillo) {
  const n = Number.parseInt(color.replace("#", ""), 16);
  const factor = Math.min(1.18, Math.max(0.24, brillo));
  return `rgb(${Math.round(((n >> 16) & 255) * factor)},${Math.round(((n >> 8) & 255) * factor)},${Math.round((n & 255) * factor)})`;
}

function VistaMalla({ config, giro, zoom, onGiro }) {
  const canvasRef = useRef(null);
  const arrastre = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const ancho = canvas.width, alto = canvas.height;
    const fondo = ctx.createLinearGradient(0, 0, 0, alto);
    fondo.addColorStop(0, "#202a35");
    fondo.addColorStop(1, "#111820");
    ctx.fillStyle = fondo;
    ctx.fillRect(0, 0, ancho, alto);
    const sueloY = alto * 0.8;
    ctx.strokeStyle = "rgba(255,255,255,.07)";
    ctx.lineWidth = 1;
    for (let i = -5; i <= 5; i += 1) {
      ctx.beginPath(); ctx.moveTo(ancho / 2 + i * 34, sueloY - 14); ctx.lineTo(ancho / 2 + i * 60, alto); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, sueloY + i * 18); ctx.lineTo(ancho, sueloY + i * 18); ctx.stroke();
    }
    const caras = crearMalla(config, Math.max(12, Number(config.lados) || 96), 28);
    const yaw = giro * Math.PI / 180;
    const pitch = 15 * Math.PI / 180;
    const escala = Math.min(ancho / (Math.max(Number(config.diametroInferior), Number(config.diametroCuerpo) || 0) * 2.5), alto / (Number(config.altura) * 1.8)) * zoom;
    const luz = [-0.45, -0.55, 0.7];
    const renderizadas = caras.map((cara) => {
      const puntos = cara.map(([x, y, z]) => {
        const xr = x * Math.cos(yaw) - y * Math.sin(yaw);
        const yr = x * Math.sin(yaw) + y * Math.cos(yaw);
        const yp = yr * Math.cos(pitch) - z * Math.sin(pitch);
        const zp = yr * Math.sin(pitch) + z * Math.cos(pitch);
        return { x: ancho / 2 + xr * escala, y: alto * 0.72 - zp * escala, depth: yp };
      });
      const ab = cara[1].map((v, i) => v - cara[0][i]);
      const ac = cara[2].map((v, i) => v - cara[0][i]);
      const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
      const len = Math.hypot(...normal) || 1;
      const lambert = Math.max(0, normal.reduce((sum, value, i) => sum + (value / len) * luz[i], 0));
      return { puntos, depth: puntos.reduce((sum, p) => sum + p.depth, 0) / 3, brillo: 0.38 + lambert * 0.75 };
    }).sort((a, b) => b.depth - a.depth);
    for (const cara of renderizadas) {
      ctx.beginPath();
      ctx.moveTo(cara.puntos[0].x, cara.puntos[0].y);
      ctx.lineTo(cara.puntos[1].x, cara.puntos[1].y);
      ctx.lineTo(cara.puntos[2].x, cara.puntos[2].y);
      ctx.closePath();
      ctx.fillStyle = colorSombreado(config.color, cara.brillo);
      ctx.fill();
      ctx.strokeStyle = "rgba(12,18,24,.12)";
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "12px sans-serif";
    ctx.fillText("VISTA 3D · ARRASTRÁ PARA GIRAR", 20, 28);
  }, [config, giro, zoom]);
  return <canvas ref={canvasRef} className="lamp-canvas" width="760" height="540" aria-label="Vista previa tridimensional de la pantalla" onPointerDown={(e) => { arrastre.current = { x: e.clientX, giro }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={(e) => { if (arrastre.current) onGiro(arrastre.current.giro + (e.clientX - arrastre.current.x) * 0.7); }} onPointerUp={() => { arrastre.current = null; }} onPointerCancel={() => { arrastre.current = null; }} />;
}

export default function LampDesigner({ settings, onSettingsChange, addProduct }) {
  const [config, setConfig] = useState(() => ({ ...BASE, ...(settings || {}) }));
  const [giro, setGiro] = useState(-22);
  const [zoom, setZoom] = useState(1);
  const [mensaje, setMensaje] = useState("");
  const onSettingsChangeRef = useRef(onSettingsChange);
  useEffect(() => {
    onSettingsChangeRef.current = onSettingsChange;
  }, [onSettingsChange]);
  useEffect(() => {
    const timer = setTimeout(() => onSettingsChangeRef.current?.(config), 600);
    return () => clearTimeout(timer);
  }, [config]);
  const editar = (campo, valor) => setConfig((actual) => ({ ...actual, [campo]: valor }));
  const pesoEstimado = useMemo(() => {
    let area = 0;
    let r0 = radioDePerfil(0, config), z0 = 0;
    for (let i = 1; i <= 48; i += 1) {
      const t = i / 48;
      const r1 = radioDePerfil(t, config), z1 = t * Number(config.altura);
      area += 2 * Math.PI * (r0 + r1) / 2 * Math.hypot(r1 - r0, z1 - z0);
      r0 = r1; z0 = z1;
    }
    return Math.max(1, area * Number(config.espesor) * 0.00124 * (config.textura === "lisa" ? 1 : 1.06));
  }, [config]);
  const costoMaterial = Math.round(pesoEstimado / 1000 * Number(config.precioKg));
  const diametroMinimo = PORTALES[config.portal] || 0;
  const encastreInvalido = diametroMinimo > 0 && Number(config.diametroSuperior) < diametroMinimo;
  const guardarProducto = () => {
    if (!config.nombre.trim()) { setMensaje("Poné un nombre para guardar el producto."); return; }
    if (!(Number(config.precioVenta) > 0)) { setMensaje("Ingresá un precio de venta para guardar el producto."); return; }
    addProduct?.({ nombre: config.nombre, costo: costoMaterial, precioUnitario: Math.max(0, Number(config.precioVenta) || 0), notas: `Pantalla 3D · ${config.tipoLuz} · ${config.forma} · ${Math.round(config.altura)} mm de alto`, pesoGramos: Math.round(pesoEstimado), fechaCreacion: new Date().toISOString().slice(0, 10) });
    setMensaje("Diseño agregado a Productos.");
    setTimeout(() => setMensaje(""), 3000);
  };
  const reiniciar = () => setConfig({ ...BASE });

  return (
    <div className="section lamp-designer">
      <div className="section-head lamp-heading">
        <div><span className="lamp-eyebrow"><Sparkles size={13} /> TINSKY LAB · DISEÑO PARAMÉTRICO</span><h2>Diseñador de luces 3D</h2><p className="lamp-subtitle">Creá pantallas originales con formas, medidas y relieves a tu gusto. Vista previa y descarga STL.</p></div>
        <button className="btn-secondary" type="button" onClick={reiniciar}><RotateCcw size={14} /> Restablecer diseño</button>
      </div>

      <div className="lamp-workspace">
        <section className="panel lamp-controls">
          <div className="lamp-step-title"><span>01</span><div><strong>Tipo de luz y silueta</strong><small>Elegí el uso y la forma base</small></div></div>
          <label>Aplicación<select value={config.tipoLuz} onChange={(e) => editar("tipoLuz", e.target.value)}><option value="colgante">Colgante</option><option value="velador">Velador</option><option value="aplique">Aplique de pared</option><option value="linterna">Farol o difusor</option></select></label>
          <label>Nombre del diseño<input value={config.nombre} onChange={(e) => editar("nombre", e.target.value)} placeholder="Ej.: Campana Nórdica" /></label>
          <label>Perfil<select value={config.forma} onChange={(e) => editar("forma", e.target.value)}><option value="campana">Campana suave</option><option value="cono">Cono moderno</option><option value="cilindro">Cilindro</option><option value="barril">Barril</option><option value="cúpula">Cúpula</option><option value="tulipa">Tulipa</option><option value="globo">Globo</option><option value="hongo">Hongo</option><option value="libre">Perfil libre</option></select></label>
          <div className="lamp-input-grid">
            <label>Alto (mm)<input type="number" min="40" max="320" value={config.altura} onChange={(e) => editar("altura", e.target.value)} /></label>
            <label>Diámetro inferior (mm)<input type="number" min="50" max="320" value={config.diametroInferior} onChange={(e) => editar("diametroInferior", e.target.value)} /></label>
            <label>Abertura superior (mm)<input type="number" min="20" max="180" value={config.diametroSuperior} onChange={(e) => editar("diametroSuperior", e.target.value)} /></label>
            <label>Pared (mm)<input type="number" min="1.2" max="5" step="0.2" value={config.espesor} onChange={(e) => editar("espesor", e.target.value)} /></label><label>Ancho máximo del cuerpo (mm)<input type="number" min="40" max="350" value={config.diametroCuerpo} onChange={(e) => editar("diametroCuerpo", e.target.value)} /></label><label>Largo del cuello (mm)<input type="number" min="0" max="100" value={config.cuello} onChange={(e) => editar("cuello", e.target.value)} /></label>
          </div>
          <div className="lamp-divider" />
          <div className="lamp-step-title"><span>02</span><div><strong>Textura y material</strong><small>Relieve y acabado exterior</small></div></div>
          <label>Superficie<select value={config.textura} onChange={(e) => editar("textura", e.target.value)}><option value="lisa">Lisa</option><option value="acanalada">Acanalada</option><option value="ondas">Ondas envolventes</option><option value="rombos">Rombos en relieve</option><option value="espiral">Espiral helicoidal</option></select></label>
          {config.textura !== "lisa" && <div className="lamp-input-grid"><label>Canales<input type="number" min="6" max="60" step="2" value={config.canales} onChange={(e) => editar("canales", e.target.value)} /></label><label>Profundidad (mm)<input type="number" min="0.2" max="3" step="0.1" value={config.relieve} onChange={(e) => editar("relieve", e.target.value)} /></label><label>Vueltas de espiral<input type="number" min="0" max="8" step="0.5" value={config.vueltas} onChange={(e) => editar("vueltas", e.target.value)} /></label></div>}<div className="lamp-input-grid"><label>Facetas del modelo (menos = más geométrico)<input type="number" min="12" max="160" step="4" value={config.lados} onChange={(e) => editar("lados", e.target.value)} /></label></div>
          <div className="lamp-input-grid">
            <label>Portalámparas<select value={config.portal} onChange={(e) => editar("portal", e.target.value)}>{Object.keys(PORTALES).map((key) => <option key={key} value={key}>{key === "A medida" ? key : `Estándar ${key}`}</option>)}</select></label>
            <label>Color de vista<div className="lamp-color-row"><input type="color" value={config.color} onChange={(e) => editar("color", e.target.value)} /><span>{config.color.toUpperCase()}</span></div></label>
          </div>
          <div className="lamp-divider" />
          <div className="lamp-step-title"><span>03</span><div><strong>Costos y catálogo</strong><small>Estimación para tu taller</small></div></div>
          <div className="lamp-input-grid"><label>Filamento (ARS/kg)<input type="number" min="0" value={config.precioKg} onChange={(e) => editar("precioKg", e.target.value)} /></label><label>Precio de venta (ARS)<input type="number" min="0" value={config.precioVenta} onChange={(e) => editar("precioVenta", e.target.value)} /></label></div>
          <div className="lamp-actions">
            <button className="btn-secondary" type="button" onClick={guardarProducto}><Save size={14} /> Guardar en Productos</button>
            <button className="btn-accent" type="button" disabled={encastreInvalido} onClick={() => exportarSTL(config)}><Download size={14} /> Descargar STL</button>
          </div>
          {mensaje && <p className="lamp-success" role="status"><CheckCircle2 size={14} /> {mensaje}</p>}
        </section>

        <section className="lamp-preview-column">
          <div className="panel lamp-preview-panel">
            <div className="lamp-preview-top"><div><span className="lamp-eyebrow"><Rotate3D size={13} /> VISTA INTERACTIVA</span><h3>{config.nombre || "Tu diseño"}</h3></div><div className="lamp-zoom"><button type="button" aria-label="Alejar" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}>−</button><button type="button" aria-label="Acercar" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}>+</button></div></div>
            <VistaMalla config={config} giro={giro} zoom={zoom} onGiro={setGiro} />
            <div className="lamp-metrics"><div><span><Ruler size={13} /> DIMENSIONES</span><strong>{config.diametroInferior} × {config.altura} mm</strong></div><div><span><Layers size={13} /> FILAMENTO EST.</span><strong>{pesoEstimado.toFixed(0)} g</strong></div><div><span><Palette size={13} /> COSTO MATERIAL</span><strong>{formatPrice(costoMaterial)}</strong></div></div>
          </div>
          <div className="lamp-info-grid"><div className="lamp-info-card"><CheckCircle2 size={16} /><div><strong>Pantalla lista para laminar</strong><span>STL en milímetros · cascarón hueco · malla cerrada · geometría ajustable</span></div></div><div className="lamp-info-card"><AlertTriangle size={16} /><div><strong>Compatibilidad</strong><span>Confirmá el encastre y el volumen útil de tu impresora antes de imprimir.</span></div></div></div>
          {encastreInvalido && <div className="lamp-warning"><AlertTriangle size={15} /> La abertura superior es menor que el encastre de {config.portal} seleccionado ({diametroMinimo} mm). Ajustá el diámetro antes de exportar.</div>}
          <p className="lamp-safety">El STL contiene solo la pantalla decorativa. Verificá la compatibilidad térmica y eléctrica con los componentes de iluminación que uses.</p>
        </section>
      </div>
    </div>
  );
}

function formatPrice(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value || 0);
}

