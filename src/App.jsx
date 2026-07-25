import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { storage } from "./lib/storage";
import logo from "./logo.png";
const LOGO_SRC = logo;
import * as A from "./lib/analytics";
import { quitarFondo, componerFondo } from "./lib/backgroundRemoval";
import {
  LayoutDashboard, Users, Package, Layers, Calculator,
  Plus, Trash2, AlertTriangle, Clock, CheckCircle2, Printer,
  ChevronRight, X, ChevronDown, Tags, Bolt, Zap, Gauge, Wallet,
  Moon, Sun, ImagePlus, ShoppingCart, Cpu, Pencil, Download, Receipt,
  DollarSign, ArrowUpDown, FileText, Lightbulb, TrendingUp, ExternalLink,
  Trophy, Share2, Square, RectangleVertical, BarChart3, MessageCircle,
  Send, Sparkles, AlertCircle, PartyPopper, CalendarDays, Wand2,
  Palette, Frame, Tag, Activity, Rocket
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

function compressImage(file, maxSize = 640, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Botón reutilizable de "quitar fondo" — se usa tanto en Productos como en el Generador de posts.
function QuitarFondoBoton({ foto, onResult }) {
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [sinFondo, setSinFondo] = useState(null);
  const [opcionFondo, setOpcionFondo] = useState("transparente");
  const [color1, setColor1] = useState("#7A1930");
  const [color2, setColor2] = useState("#1F4FC4");

  if (!foto) return null;

  const procesar = async () => {
    setProcesando(true);
    setProgreso(0);
    try {
      const resultado = await quitarFondo(foto, (p) => setProgreso(p));
      setSinFondo(resultado);
    } catch (e) {
      console.error("No se pudo quitar el fondo", e);
      alert("No se pudo quitar el fondo. La primera vez necesita descargar un modelo (unos MB) — revisá tu conexión e intentá de nuevo.");
    } finally {
      setProcesando(false);
    }
  };

  const aplicar = async () => {
    const compuesta = await componerFondo(sinFondo, opcionFondo, color1, color2);
    onResult(compuesta);
    setSinFondo(null);
  };

  if (sinFondo) {
    return (
      <div className="quitar-fondo-panel">
        <img src={sinFondo} alt="sin fondo" className="quitar-fondo-preview" />
        <div className="fondo-opciones">
          <button type="button" className={opcionFondo === "transparente" ? "active" : ""} onClick={() => setOpcionFondo("transparente")}>Transparente</button>
          <button type="button" className={opcionFondo === "blanco" ? "active" : ""} onClick={() => setOpcionFondo("blanco")}>Blanco</button>
          <button type="button" className={opcionFondo === "color" ? "active" : ""} onClick={() => setOpcionFondo("color")}>Color sólido</button>
          <button type="button" className={opcionFondo === "degradado" ? "active" : ""} onClick={() => setOpcionFondo("degradado")}>Degradado</button>
        </div>
        {opcionFondo === "color" && (
          <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} />
        )}
        {opcionFondo === "degradado" && (
          <div className="form-row">
            <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} />
            <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} />
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => setSinFondo(null)}>Cancelar</button>
          <button type="button" className="btn-accent" onClick={aplicar}>Usar esta foto</button>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="btn-mini" onClick={procesar} disabled={procesando}>
      <Wand2 size={12} /> {procesando ? `Procesando... ${Math.round(progreso * 100)}%` : "Quitar fondo"}
    </button>
  );
}


const FONTS_LINK = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap";

const STORAGE_KEY = "tinsky-app-data";
const THEME_KEY = "tinsky-theme";

const MATERIALES = ["PLA", "PETG", "TPU", "ABS", "Nylon", "Otro"];
const ESTADOS_PEDIDO = [
  { v: "pendiente", label: "Pendiente", color: "warning" },
  { v: "en_impresion", label: "En impresión", color: "teal" },
  { v: "listo", label: "Listo", color: "accent" },
  { v: "entregado", label: "Entregado", color: "success" },
];
const ESTADOS_COLA = [
  { v: "en_cola", label: "En cola", color: "warning" },
  { v: "imprimiendo", label: "Imprimiendo", color: "teal" },
  { v: "completado", label: "Completado", color: "success" },
];

function uid() {
  return (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));
}

function formatARS(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function estadoMeta(list, v) {
  return list.find((e) => e.v === v) || list[0];
}

function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf.jsPDF);
    const existing = document.getElementById("jspdf-cdn");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.jspdf.jsPDF));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "jspdf-cdn";
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve(window.jspdf.jsPDF);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function loadImageAsBase64(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = src;
  });
}

async function generarPresupuestoPDF(presupuesto, logoSrc) {
  const jsPDFCtor = await loadJsPDF();
  const doc = new jsPDFCtor({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 18;
  let y = 22;

  try {
    const logoBase64 = await loadImageAsBase64(logoSrc);
    doc.addImage(logoBase64, "PNG", marginX, y - 10, 20, 20);
  } catch (e) {
    // si falla el logo, seguimos sin romper el PDF
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text("PRESUPUESTO", pageWidth - marginX, y - 4, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Fecha: ${presupuesto.fecha}`, pageWidth - marginX, y + 3, { align: "right" });
  if (presupuesto.cliente) {
    doc.text(`Para: ${presupuesto.cliente}`, pageWidth - marginX, y + 9, { align: "right" });
  }

  y += 22;
  doc.setDrawColor(215, 215, 215);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("Detalle", marginX, y);
  doc.text("Total", pageWidth - marginX, y, { align: "right" });
  y += 3;
  doc.setDrawColor(215, 215, 215);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  presupuesto.items.forEach((it) => {
    if (y > 260) {
      doc.addPage();
      y = 22;
    }
    const desc = doc.splitTextToSize(it.descripcion || "-", pageWidth - marginX * 2 - 40);
    doc.text(desc, marginX, y);
    doc.text(formatARS(it.monto), pageWidth - marginX, y, { align: "right" });
    y += 8 * desc.length;
  });

  y += 4;
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 11;

  const total = presupuesto.items.reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TOTAL", marginX, y);
  doc.text(formatARS(total), pageWidth - marginX, y, { align: "right" });

  if (presupuesto.notas) {
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    const notas = doc.splitTextToSize(presupuesto.notas, pageWidth - marginX * 2);
    doc.text(notas, marginX, y);
  }

  // Pie de página: contacto con "iconos" simples (no son los logos oficiales, son
  // insignias genéricas de color para representar cada red)
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = pageHeight - 18;
  doc.setDrawColor(225, 225, 225);
  doc.line(marginX, footerY - 8, pageWidth - marginX, footerY - 8);

  // Instagram (insignia rosa/violeta)
  doc.setFillColor(214, 45, 122);
  doc.roundedRect(marginX, footerY - 4.5, 9, 9, 2.5, 2.5, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(marginX + 4.5, footerY, 2, "S");
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.6);
  doc.circle(marginX + 4.5, footerY, 2, "S");
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`@${CONTACTO.instagram}`, marginX + 13, footerY + 1.5);

  // WhatsApp (insignia verde)
  const waX = marginX + 70;
  doc.setFillColor(37, 211, 102);
  doc.circle(waX + 4.5, footerY, 4.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("WA", waX + 4.5, footerY + 1.3, { align: "center" });
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(CONTACTO.whatsapp, waX + 13, footerY + 1.5);

  const nombreArchivo = `presupuesto-${presupuesto.fecha}${presupuesto.cliente ? "-" + presupuesto.cliente.replace(/\s+/g, "-").toLowerCase() : ""}.pdf`;
  doc.save(nombreArchivo);
}

const defaultData = {
  orders: [],
  stock: [],
  products: [],
  purchases: [],
  ventas: [],
  presupuestos: [],
  consumos: [],
  config: { horasImpresionDiarias: 4, multiplicadorValorNegocio: 2.5 },
  calculadoraState: {
    open: { material: true, electricidad: true, amortizacion: false, margen: true },
    destino: "producto",
    nombreProducto: "",
    cliente: "",
    cantidad: 1,
    fechaEntrega: "",
    selStock: "",
    peso: 50,
    precioKg: 15000,
    desperdicio: 10,
    horas: 3,
    minutos: 0,
    potenciaW: 150,
    precioKwh: 120,
    valorHora: 1000,
    horasTrabajoPersonal: 0.5,
    precioImpresora: 450000,
    vidaUtilHoras: 5000,
    mantenimientoMes: 5000,
    horasUsoMensual: 60,
    margen: 40,
    envio: 0,
    comision: 0,
  },
};

const CONTACTO = { instagram: "tinsky.ok", whatsapp: "116835739" };

const TIPOS_COMPRA = ["Filamento", "Repuesto / parte", "Insumo", "Otro"];
const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Mercado Pago", "Tarjeta", "Otro"];
const CANTIDADES_MAYORISTA = [5, 10, 20, 50, 100];
const DESCUENTO_SUGERIDO = { 5: 0.05, 10: 0.10, 20: 0.15, 50: 0.22, 100: 0.30 };

function defaultTiers() {
  return CANTIDADES_MAYORISTA.map((cantidad) => ({ cantidad, habilitado: false, precio: "" }));
}

export default function App() {
  const [data, setData] = useState(defaultData);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("resumen");
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    (async () => {
      try {
        const value = await storage.getItem(THEME_KEY);
        if (value) setTheme(value);
      } catch (e) {
        // sin preferencia guardada, se queda en "dark"
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      await storage.setItem(THEME_KEY, next);
    } catch (e) {
      console.error("No se pudo guardar el tema", e);
    }
  };

  useEffect(() => {
    const color = theme === "dark" ? "#0D1117" : "#F3F5F9";
    document.documentElement.style.background = color;
    document.body.style.background = color;
    document.body.style.margin = "0";
  }, [theme]);

  useEffect(() => {
    (async () => {
      try {
        const value = await storage.getItem(STORAGE_KEY);
        if (value) {
          const parsed = JSON.parse(value);
          setData({ ...defaultData, ...parsed });
        }
      } catch (e) {
        // no existing data yet
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setData(next);
    try {
      await storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("No se pudo guardar", e);
    }
  }, []);

  // ---------- CRUD helpers ----------
  const addOrder = (order) => persist({ ...data, orders: [...data.orders, { id: uid(), fechaCreacion: todayISO(), ...order }] });
  const updateOrder = (id, patch) => persist({ ...data, orders: data.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  const deleteOrder = (id) => persist({ ...data, orders: data.orders.filter((o) => o.id !== id) });

  const addStock = (item) => persist({ ...data, stock: [...data.stock, { id: uid(), ...item }] });
  const updateStock = (id, patch) => persist({ ...data, stock: data.stock.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const deleteStock = (id) => persist({ ...data, stock: data.stock.filter((s) => s.id !== id) });

  const registrarConsumoLog = (stockId, gramos) => {
    const item = data.stock.find((s) => s.id === stockId);
    if (!item) return;
    const nuevo = Math.max(0, Number(item.pesoRestante) - gramos);
    const consumo = { id: uid(), stockId, material: item.material, color: item.color, gramos, fecha: todayISO() };
    persist({
      ...data,
      stock: data.stock.map((s) => (s.id === stockId ? { ...s, pesoRestante: nuevo } : s)),
      consumos: [...(data.consumos || []), consumo],
    });
  };

  const updateConfig = (patch) => persist({ ...data, config: { ...(data.config || {}), ...patch } });
  const updateCalculadoraState = (patch) => persist({ ...data, calculadoraState: { ...(data.calculadoraState || {}), ...patch } });

  const addProduct = (item) => persist({ ...data, products: [...data.products, { id: uid(), ...item }] });
  const updateProduct = (id, patch) => persist({ ...data, products: data.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const deleteProduct = (id) => persist({ ...data, products: data.products.filter((p) => p.id !== id) });

  const addPurchase = (item) => persist({ ...data, purchases: [...data.purchases, { id: uid(), fecha: item.fecha || todayISO(), ...item }] });
  const updatePurchase = (id, patch) => persist({ ...data, purchases: data.purchases.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const deletePurchase = (id) => persist({ ...data, purchases: data.purchases.filter((p) => p.id !== id) });

  const addVenta = (item) => persist({ ...data, ventas: [...data.ventas, { id: uid(), fecha: item.fecha || todayISO(), ...item }] });
  const deleteVenta = (id) => persist({ ...data, ventas: data.ventas.filter((v) => v.id !== id) });

  const addPresupuesto = (item) => persist({ ...data, presupuestos: [...data.presupuestos, { id: uid(), fecha: item.fecha || todayISO(), estado: "pendiente", ...item }] });
  const deletePresupuesto = (id) => persist({ ...data, presupuestos: data.presupuestos.filter((p) => p.id !== id) });

  const aceptarPresupuesto = (presupuesto, medioPago) => {
    const nuevasVentas = presupuesto.items.map((it) => ({
      id: uid(),
      fecha: todayISO(),
      tipo: "presupuesto",
      refId: presupuesto.id,
      nombre: it.descripcion,
      cantidad: 1,
      medioPago,
      monto: Number(it.monto) || 0,
      costo: 0,
    }));
    persist({
      ...data,
      ventas: [...data.ventas, ...nuevasVentas],
      presupuestos: data.presupuestos.map((p) => (p.id === presupuesto.id ? { ...p, estado: "aceptado" } : p)),
    });
  };

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tinsky-backup-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const TABS = [
    { k: "resumen", label: "Resumen", icon: LayoutDashboard },
    { k: "asistente", label: "Asistente", icon: MessageCircle },
    { k: "pedidos", label: "Pedidos", icon: Package },
    { k: "stock", label: "Stock", icon: Layers },
    { k: "productos", label: "Productos", icon: Tags },
    { k: "ventas", label: "Ventas", icon: Receipt },
    { k: "estadisticas", label: "Estadísticas", icon: BarChart3 },
    { k: "feria", label: "Planificador de Feria", icon: PartyPopper },
    { k: "calendario", label: "Calendario", icon: CalendarDays },
    { k: "presupuestos", label: "Presupuestos", icon: FileText },
    { k: "compras", label: "Compras", icon: ShoppingCart },
    { k: "calculadora", label: "Calculadora", icon: Calculator },
    { k: "ideas", label: "Ideas", icon: Lightbulb },
    { k: "posts", label: "Generador de posts", icon: Share2 },
    { k: "heatmap", label: "Actividad", icon: Activity },
    { k: "ejecutivo", label: "Dashboard Ejecutivo", icon: Rocket },
  ];

  return (
    <div className="tinsky-root" data-theme={theme}>
      <link rel="stylesheet" href={FONTS_LINK} />
      <style>{CSS}</style>

      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <img src={LOGO_SRC} alt="Tinsky" className="brand-logo-img" />
            <div>
              <p>Taller de impresión 3D</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            {TABS.map((t) => (
              <button
                key={t.k}
                className={"sidebar-item" + (tab === t.k ? " active" : "")}
                onClick={() => setTab(t.k)}
              >
                <t.icon size={17} strokeWidth={2} />
                <span>{t.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="theme-toggle" onClick={exportBackup} title="Descargar backup (.json)">
              <Download size={16} />
            </button>
            <button className="theme-toggle" onClick={toggleTheme} title="Cambiar modo claro/oscuro">
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </aside>

        <div className="main-area">
          <header className="topbar">
            <h2>{TABS.find((t) => t.k === tab)?.label}</h2>
            <div className="topbar-meta">
              {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
            </div>
          </header>

          <main className="content">
            {!loaded ? (
              <div className="loading">Cargando taller…</div>
            ) : tab === "resumen" ? (
              <Resumen data={data} />
            ) : tab === "asistente" ? (
              <Asistente data={data} />
            ) : tab === "pedidos" ? (
              <Pedidos data={data} addOrder={addOrder} updateOrder={updateOrder} deleteOrder={deleteOrder} addVenta={addVenta} />
            ) : tab === "stock" ? (
              <Stock data={data} addStock={addStock} updateStock={updateStock} deleteStock={deleteStock} registrarConsumoLog={registrarConsumoLog} />
            ) : tab === "productos" ? (
              <Productos data={data} addProduct={addProduct} updateProduct={updateProduct} deleteProduct={deleteProduct} addVenta={addVenta} />
            ) : tab === "ventas" ? (
              <Ventas data={data} deleteVenta={deleteVenta} />
            ) : tab === "estadisticas" ? (
              <Estadisticas data={data} />
            ) : tab === "feria" ? (
              <PlanificadorFeria data={data} />
            ) : tab === "calendario" ? (
              <CalendarioInteligente data={data} updateOrder={updateOrder} updateConfig={updateConfig} />
            ) : tab === "presupuestos" ? (
              <Presupuestos data={data} addPresupuesto={addPresupuesto} deletePresupuesto={deletePresupuesto} aceptarPresupuesto={aceptarPresupuesto} />
            ) : tab === "compras" ? (
              <Compras data={data} addPurchase={addPurchase} deletePurchase={deletePurchase} />
            ) : tab === "ideas" ? (
              <Ideas />
            ) : tab === "posts" ? (
              <PostGenerator products={data.products} />
            ) : tab === "heatmap" ? (
              <HeatmapActividad data={data} />
            ) : tab === "ejecutivo" ? (
              <DashboardEjecutivo data={data} updateConfig={updateConfig} />
            ) : (
              <Calculadora stock={data.stock} addProduct={addProduct} addOrder={addOrder} calc={data.calculadoraState} updateCalc={updateCalculadoraState} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ============================= RESUMEN =============================
function mesesEntre(fechaInicio, fechaFin) {
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

const NOMBRE_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const NOMBRE_MES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function ProduccionCard({ data }) {
  const pend = A.pendientesProduccion(data);
  const atrasados = A.pedidosAtrasados(data);
  const proxima = A.proximaEntrega(data);

  return (
    <div className="panel produccion-panel">
      <h3><Gauge size={15} /> Dashboard de producción</h3>
      <div className="produccion-grid">
        <div className="prod-cell">
          <span>Pedidos activos</span>
          <strong>{pend.cantidadPedidos}</strong>
        </div>
        <div className={"prod-cell" + (atrasados.length ? " danger" : "")}>
          <span>Pedidos atrasados</span>
          <strong>{atrasados.length}</strong>
        </div>
        <div className="prod-cell">
          <span>Próxima entrega</span>
          <strong>{proxima ? proxima.fechaEntrega : "—"}</strong>
        </div>
        <div className="prod-cell">
          <span>Gramos pendientes</span>
          <strong>{pend.gramos > 0 ? `${pend.gramos}g` : "—"}</strong>
        </div>
        <div className="prod-cell">
          <span>Horas pendientes</span>
          <strong>{pend.horas > 0 ? `${pend.horas}h` : "—"}</strong>
        </div>
      </div>
      {pend.cantidadPedidos > 0 && pend.cantidadConDatos === 0 && (
        <p className="hint" style={{ marginTop: 10 }}>
          💡 Cargá "peso estimado" y "tiempo estimado" al crear un pedido para que acá aparezcan los gramos y horas pendientes de producción.
        </p>
      )}
    </div>
  );
}

function Resumen({ data }) {
  const pedidosActivos = data.orders.filter((o) => o.estado !== "entregado").length;
  const alertasStock = data.stock.filter((s) => Number(s.pesoRestante) <= Number(s.alertaMinimo || 0));
  const hoy = new Date();
  const mesActual = hoy.toISOString().slice(0, 7);
  const anioActual = hoy.getFullYear().toString();
  const ventas = data.ventas || [];

  const ventasMes = ventas.filter((v) => (v.fecha || "").slice(0, 7) === mesActual);
  const ventasAnio = ventas.filter((v) => (v.fecha || "").slice(0, 4) === anioActual);
  const ingresosMes = ventasMes.reduce((acc, v) => acc + (Number(v.monto) || 0), 0);
  const costoMes = ventasMes.reduce((acc, v) => acc + (Number(v.costo) || 0), 0);
  const gananciaMes = ingresosMes - costoMes;
  const ingresosAnio = ventasAnio.reduce((acc, v) => acc + (Number(v.monto) || 0), 0);
  const costoAnio = ventasAnio.reduce((acc, v) => acc + (Number(v.costo) || 0), 0);
  const gananciaAnio = ingresosAnio - costoAnio;

  const chartData = useMemo(() => {
    if (ventas.length === 0 && (data.purchases || []).length === 0) return [];
    const fechas = [
      ...ventas.map((v) => v.fecha),
      ...(data.purchases || []).map((p) => p.fecha),
    ].filter(Boolean).sort();
    const primera = fechas.length ? new Date(fechas[0]) : hoy;
    const meses = mesesEntre(primera, hoy);
    return meses.map((m) => {
      const [, mm] = m.split("-");
      const vs = ventas.filter((v) => (v.fecha || "").slice(0, 7) === m);
      const ingresos = vs.reduce((acc, v) => acc + (Number(v.monto) || 0), 0);
      const costo = vs.reduce((acc, v) => acc + (Number(v.costo) || 0), 0);
      const gastos = (data.purchases || [])
        .filter((p) => (p.fecha || "").slice(0, 7) === m)
        .reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
      return { mes: `${NOMBRE_MES[Number(mm) - 1]}`, Ingresos: ingresos, Ganancia: ingresos - costo, Gastos: gastos };
    });
  }, [ventas, data.purchases]);

  const topProductos = useMemo(() => {
    const map = {};
    ventas.forEach((v) => {
      const key = v.nombre || "Sin nombre";
      if (!map[key]) map[key] = { nombre: key, unidades: 0, total: 0 };
      map[key].unidades += Number(v.cantidad) || 0;
      map[key].total += Number(v.monto) || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [ventas]);

  return (
    <div className="resumen">
      <ProduccionCard data={data} />

      <div className="cards-grid">
        <StatCard label="Pedidos activos" value={pedidosActivos} icon={Package} tone="accent" />
        <StatCard label="Ingresos del mes" value={formatARS(ingresosMes)} icon={CheckCircle2} tone="success" mono />
        <StatCard label="Ganancia del mes" value={formatARS(gananciaMes)} icon={TrendingUp} tone="teal" mono />
        <StatCard label="Alertas de stock" value={alertasStock.length} icon={AlertTriangle} tone={alertasStock.length ? "danger" : "success"} />
      </div>

      <div className="panel">
        <h3>Balance de ventas</h3>
        <div className="balance-grid">
          <div className="balance-cell">
            <span>Costo del mes</span>
            <strong className="mono">{formatARS(costoMes)}</strong>
          </div>
          <div className="balance-cell up">
            <span>Ganancia del mes</span>
            <strong className="mono">{formatARS(gananciaMes)}</strong>
          </div>
          <div className="balance-cell">
            <span>Costo del año</span>
            <strong className="mono">{formatARS(costoAnio)}</strong>
          </div>
          <div className="balance-cell up">
            <span>Ganancia del año</span>
            <strong className="mono">{formatARS(gananciaAnio)}</strong>
          </div>
        </div>
      </div>

      <div className="resumen-split">
        <div className="panel">
          <h3>Historial completo — ingresos y ganancia</h3>
          {chartData.length === 0 ? (
            <p className="empty-note">Todavía no hay ventas registradas para graficar.</p>
          ) : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="mes" stroke="var(--ink-soft)" fontSize={11} interval={chartData.length > 12 ? 1 : 0} />
                  <YAxis stroke="var(--ink-soft)" fontSize={11} width={64} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v) => formatARS(v)}
                    contentStyle={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Ingresos" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Ganancia" fill="var(--success)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Gastos" fill="var(--teal)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="panel ranking-panel">
          <h3><Trophy size={15} /> Más vendidos</h3>
          {topProductos.length === 0 ? (
            <p className="empty-note">Todavía no hay ventas para armar el ranking.</p>
          ) : (
            <ol className="ranking-list">
              {topProductos.map((p, idx) => (
                <li key={p.nombre} className="ranking-row">
                  <span className="ranking-pos">{idx + 1}</span>
                  <div className="ranking-info">
                    <p className="ranking-name">{p.nombre}</p>
                    <p className="ranking-units">{p.unidades} unidad{p.unidades !== 1 ? "es" : ""} vendida{p.unidades !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="ranking-total mono">{formatARS(p.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {alertasStock.length > 0 && (
        <div className="panel">
          <h3>Stock bajo mínimo</h3>
          <ul className="alert-list">
            {alertasStock.map((s) => (
              <li key={s.id}>
                <AlertTriangle size={14} />
                {s.material} {s.color} ({s.marca}) — quedan {s.pesoRestante}g de {s.alertaMinimo}g mínimo
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone, mono }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <Icon size={18} strokeWidth={2} />
      <div>
        <p className="stat-label">{label}</p>
        <p className={"stat-value" + (mono ? " mono" : "")}>{value}</p>
      </div>
    </div>
  );
}

// ============================= ESTADÍSTICAS AVANZADAS =============================
function MiniStat({ label, value }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong className="mono">{value}</strong>
    </div>
  );
}

function Estadisticas({ data }) {
  const masVendido = A.productoMasVendido(data);
  const masRentable = A.productoMasRentable(data);
  const catTop = A.categoriaMasRentable(data);
  const metricas = A.metricasVentas(data);
  const porMedioPago = A.ventasPorMedioPago(data);
  const porCategoria = A.ventasPorCategoria(data);
  const serie = A.serieMensualCompleta(data);
  const compMes = A.comparacionMensual(data);
  const compAnio = A.comparacionAnual(data);
  const materialTop = A.materialMasUsado(data);
  const colorTop = A.colorMasUsado(data);
  const clientes = A.clientesTop(data).slice(0, 10);
  const top10Ingreso = A.top10(data, "ingreso");
  const top10Unidades = A.top10(data, "unidades");
  const totalUnidadesVendidas = A.rankingProductos(data).reduce((acc, p) => acc + p.unidades, 0);

  const fmtVar = (v) => (v === null ? "sin datos del período anterior" : `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`);

  return (
    <div className="section">
      <div className="section-head">
        <h2>Estadísticas avanzadas</h2>
      </div>

      <div className="mini-stats-grid">
        <MiniStat label="Producto más vendido" value={masVendido ? `${masVendido.nombre} (${masVendido.unidades}u)` : "—"} />
        <MiniStat label="Producto más rentable" value={masRentable ? `${masRentable.nombre} (${formatARS(masRentable.ganancia)})` : "—"} />
        <MiniStat label="Categoría más rentable" value={catTop ? `${catTop.categoria} (${formatARS(catTop.ganancia)})` : "—"} />
        <MiniStat label="Unidades totales vendidas" value={totalUnidadesVendidas} />
        <MiniStat label="Ticket promedio" value={formatARS(metricas.ticketPromedio)} />
        <MiniStat label="Ganancia promedio / venta" value={formatARS(metricas.gananciaPromedioPorVenta)} />
        <MiniStat label="Costo promedio / venta" value={formatARS(metricas.costoPromedio)} />
        <MiniStat label="Margen promedio" value={metricas.margenPromedio !== null ? `${metricas.margenPromedio.toFixed(0)}%` : "sin datos de costo"} />
        <MiniStat label="Material más usado" value={materialTop ? `${materialTop.label} (${materialTop.gramos}g)` : "Sin registros de consumo"} />
        <MiniStat label="Color más usado" value={colorTop ? `${colorTop.label} (${colorTop.gramos}g)` : "Sin registros de consumo"} />
        <MiniStat label="Mes vs mes anterior" value={fmtVar(compMes.variacion)} />
        <MiniStat label="Año vs año anterior" value={fmtVar(compAnio.variacion)} />
      </div>

      {serie.length > 0 && (
        <div className="panel">
          <h3>Ventas por mes — historial completo</h3>
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="mes" stroke="var(--ink-soft)" fontSize={11} interval={serie.length > 12 ? 1 : 0} />
                <YAxis stroke="var(--ink-soft)" fontSize={11} width={64} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatARS(v)} contentStyle={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ingresos" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Ganancia" fill="var(--success)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="resumen-split">
        <div className="panel">
          <h3>Ventas por medio de pago</h3>
          {porMedioPago.length === 0 ? (
            <p className="empty-note">Todavía no hay ventas.</p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={porMedioPago} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis type="number" stroke="var(--ink-soft)" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="medio" stroke="var(--ink-soft)" fontSize={12} width={110} />
                  <Tooltip formatter={(v) => formatARS(v)} contentStyle={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }} />
                  <Bar dataKey="ingreso" fill="var(--teal)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Ventas por categoría</h3>
          {porCategoria.length === 0 ? (
            <p className="empty-note">Cargá "categoría" en tus productos para ver este desglose.</p>
          ) : (
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={porCategoria} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis type="number" stroke="var(--ink-soft)" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="categoria" stroke="var(--ink-soft)" fontSize={12} width={110} />
                  <Tooltip formatter={(v) => formatARS(v)} contentStyle={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }} />
                  <Bar dataKey="ganancia" fill="var(--violet)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="resumen-split">
        <div className="panel ranking-panel">
          <h3><Trophy size={15} /> Top 10 por ingreso</h3>
          {top10Ingreso.length === 0 ? (
            <p className="empty-note">Todavía no hay ventas.</p>
          ) : (
            <ol className="ranking-list">
              {top10Ingreso.map((p, idx) => (
                <li key={p.nombre} className="ranking-row">
                  <span className="ranking-pos">{idx + 1}</span>
                  <div className="ranking-info">
                    <p className="ranking-name">{p.nombre}</p>
                    <p className="ranking-units">{p.unidades} unidades</p>
                  </div>
                  <span className="ranking-total mono">{formatARS(p.ingreso)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="panel ranking-panel">
          <h3><Users size={15} /> Clientes que más compran</h3>
          {clientes.length === 0 ? (
            <p className="empty-note">Cargá el nombre del cliente en tus pedidos para ver este ranking.</p>
          ) : (
            <ol className="ranking-list">
              {clientes.map((c, idx) => (
                <li key={c.nombre} className="ranking-row">
                  <span className="ranking-pos">{idx + 1}</span>
                  <div className="ranking-info">
                    <p className="ranking-name">{c.nombre}</p>
                    <p className="ranking-units">{c.pedidos} pedido{c.pedidos !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="ranking-total mono">{formatARS(c.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================= ASISTENTE INTELIGENTE =============================
function quitarAcentos(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function responderPregunta(pregunta, data) {
  const q = quitarAcentos(pregunta.toLowerCase());
  const contains = (...palabras) => palabras.some((p) => q.includes(quitarAcentos(p)));

  if (contains("vendo mas", "vendido", "top ventas", "mas vendo")) {
    const p = A.productoMasVendido(data);
    return p ? `Tu producto más vendido es "${p.nombre}", con ${p.unidades} unidades vendidas y ${formatARS(p.ingreso)} de ingreso total.` : "Todavía no tenés ventas registradas para poder decirte esto.";
  }

  if (contains("filamento", "reponer", "que comprar")) {
    const bajos = A.stockBajoMinimo(data);
    if (bajos.length === 0) return "Ningún rollo está bajo tu mínimo configurado ahora mismo — no hace falta reponer filamento por el momento.";
    return bajos.map((s) => {
      const semanal = A.consumoSemanalPromedio(data, s.id);
      let txt = `${s.material} ${s.color}: quedan ${s.pesoRestante}g (mínimo ${s.alertaMinimo}g).`;
      if (semanal) txt += ` Consumís ~${Math.round(semanal)}g/semana.`;
      return txt;
    }).join(" ");
  }

  if (contains("cuanto gane", "gane este mes", "ganancia del mes", "cuanto ganamos")) {
    const t = A.totales(A.ventasDelMes(data));
    return `Este mes vendiste ${formatARS(t.ingreso)}, con un costo de ${formatARS(t.costo)} — tu ganancia del mes es ${formatARS(t.ganancia)}.`;
  }

  if (contains("pedidos pendientes", "pedidos activos")) {
    const activos = A.pedidosActivos(data);
    if (activos.length === 0) return "No tenés pedidos activos ahora mismo.";
    const nombres = activos.slice(0, 8).map((o) => `${o.producto}${o.cliente ? ` (${o.cliente})` : ""}`).join(", ");
    return `Tenés ${activos.length} pedido${activos.length !== 1 ? "s" : ""} activo${activos.length !== 1 ? "s" : ""}: ${nombres}${activos.length > 8 ? "..." : ""}.`;
  }

  if (contains("feria", "conviene fabricar", "que fabricar")) {
    const top = A.top10(data, "ingreso").slice(0, 5);
    if (top.length === 0) return "Todavía no tengo ventas históricas suficientes para recomendarte qué fabricar.";
    return `Según lo que más vendiste hasta ahora, para una feria priorizaría: ${top.map((p) => p.nombre).join(", ")}.`;
  }

  if (contains("mejor mes")) {
    const m = A.mejorMes(data);
    return m ? `Tu mejor mes fue ${m.mes} con ${formatARS(m.Ingresos)} de ingresos.` : "Todavía no tengo suficientes ventas para calcular esto.";
  }

  if (contains("categoria")) {
    const c = A.categoriaMasRentable(data);
    return c ? `La categoría más rentable es "${c.categoria}", con ${formatARS(c.ganancia)} de ganancia acumulada.` : "Cargá la categoría en tus productos para que pueda calcular esto.";
  }

  if (contains("color de pla", "color mas us", "que color")) {
    const c = A.colorMasUsado(data);
    return c ? `El color que más usaste es ${c.label}, con ${c.gramos}g consumidos en total (según lo que registraste en Stock).` : "Todavía no tengo registros de consumo — usá el botón 'Registrar' en Stock cada vez que gastes filamento.";
  }

  if (contains("margen")) {
    const r = [...A.rankingProductos(data)].filter((p) => p.costo > 0).sort((a, b) => (b.ganancia / b.costo) - (a.ganancia / a.costo));
    if (r.length === 0) return "Necesito que cargues el costo en tus ventas (al marcar pagado, o al registrar venta) para poder calcular márgenes.";
    const top = r.slice(0, 3);
    return `Los productos con mejor margen son: ${top.map((p) => `${p.nombre} (+${Math.round((p.ganancia / p.costo) * 100)}%)`).join(", ")}.`;
  }

  if (contains("mercado pago", "efectivo", "transferencia", "medio de pago", "medios de pago")) {
    const porMedio = A.ventasPorMedioPago(data);
    if (porMedio.length === 0) return "Todavía no hay ventas registradas.";
    return porMedio.map((m) => `${m.medio}: ${formatARS(m.ingreso)} (${m.cantidad} venta${m.cantidad !== 1 ? "s" : ""})`).join(" · ");
  }

  return null;
}

const PREGUNTAS_SUGERIDAS = [
  "¿Qué producto vendo más?",
  "¿Qué filamento debería comprar?",
  "¿Cuánto gané este mes?",
  "¿Cuáles son mis pedidos pendientes?",
  "¿Qué me conviene fabricar para la próxima feria?",
  "¿Cuál fue mi mejor mes?",
  "¿Qué categoría genera más ganancias?",
  "¿Qué productos tienen mejor margen?",
];

function Asistente({ data }) {
  const [mensajes, setMensajes] = useState([
    { rol: "asistente", texto: "Hola, soy el asistente de Tinsky. Puedo responder preguntas sobre tus pedidos, ventas, stock y productos usando los datos que ya cargaste en la app. Probá con alguna de las preguntas sugeridas, o escribí la tuya." },
  ]);
  const [input, setInput] = useState("");
  const recomendaciones = useMemo(() => A.recomendaciones(data), [data]);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [mensajes]);

  const enviar = (texto) => {
    const pregunta = (texto ?? input).trim();
    if (!pregunta) return;
    const respuesta = responderPregunta(pregunta, data);
    setMensajes((m) => [
      ...m,
      { rol: "usuario", texto: pregunta },
      {
        rol: "asistente",
        texto: respuesta || "Todavía no tengo una respuesta armada para esa pregunta puntual. Probá reformularla parecido a alguna de las sugeridas — este asistente reconoce patrones de preguntas frecuentes sobre tu negocio, no es una IA de lenguaje libre (esa versión tiene costo, avisame si en algún momento la querés).",
      },
    ]);
    setInput("");
  };

  return (
    <div className="section">
      <div className="section-head">
        <h2>Asistente Tinsky</h2>
      </div>

      {recomendaciones.length > 0 && (
        <div className="panel recomendaciones-panel">
          <h3><Sparkles size={15} /> Recomendaciones automáticas</h3>
          <ul className="recomendaciones-list">
            {recomendaciones.map((r, i) => (
              <li key={i}><AlertCircle size={14} /> {r.texto}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="asistente-panel">
        <div className="asistente-chat" ref={listRef}>
          {mensajes.map((m, i) => (
            <div key={i} className={"chat-bubble " + m.rol}>
              {m.texto}
            </div>
          ))}
        </div>

        <div className="asistente-sugerencias">
          {PREGUNTAS_SUGERIDAS.map((p) => (
            <button key={p} className="sugerencia-chip" onClick={() => enviar(p)}>{p}</button>
          ))}
        </div>

        <form
          className="asistente-input-row"
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribí tu pregunta..."
          />
          <button type="submit" className="btn-accent"><Send size={15} /></button>
        </form>
      </div>
    </div>
  );
}

// ============================= PLANIFICADOR DE FERIA =============================
function PlanificadorFeria({ data }) {
  const [fechaFeria, setFechaFeria] = useState("");
  const [horasPorDia, setHorasPorDia] = useState(4);
  const [impresoras, setImpresoras] = useState(1);

  const hoy = new Date();
  const diasFaltantes = fechaFeria ? Math.max(0, Math.ceil((new Date(fechaFeria) - hoy) / (1000 * 60 * 60 * 24))) : 0;
  const horasDisponibles = diasFaltantes * Number(horasPorDia || 0) * Number(impresoras || 1);

  const plan = useMemo(() => A.planificarFeria(data, horasDisponibles), [data, horasDisponibles]);

  return (
    <div className="section">
      <div className="section-head">
        <h2>Planificador de Feria</h2>
      </div>

      <div className="form-card no-grid">
        <div className="form-row">
          <label>
            Fecha de la feria
            <input type="date" value={fechaFeria} onChange={(e) => setFechaFeria(e.target.value)} />
          </label>
          <label>
            Horas que podés imprimir por día
            <input type="number" min="0" step="0.5" value={horasPorDia} onChange={(e) => setHorasPorDia(e.target.value)} />
          </label>
          <label>
            Impresoras disponibles
            <input type="number" min="1" value={impresoras} onChange={(e) => setImpresoras(e.target.value)} />
          </label>
        </div>
        {fechaFeria && (
          <p className="hint">
            💡 Faltan {diasFaltantes} día{diasFaltantes !== 1 ? "s" : ""} → tenés aproximadamente <strong>{horasDisponibles.toFixed(0)} horas</strong> disponibles de impresión.
          </p>
        )}
      </div>

      {!fechaFeria ? (
        <p className="empty-note">Elegí una fecha de feria para ver la sugerencia de producción.</p>
      ) : plan.items.length === 0 ? (
        <p className="empty-note">Todavía no tengo ventas históricas suficientes (o no cargaste tiempo de impresión en tus productos) como para armar una sugerencia. Cargá "tiempo de impresión" en tus productos para mejores resultados.</p>
      ) : (
        <>
          <div className="cards-grid" style={{ marginBottom: 16 }}>
            <StatCard label="Horas a usar" value={`${plan.horasUsadas.toFixed(1)}h`} icon={Clock} tone="teal" />
            <StatCard label="Ganancia esperada" value={formatARS(plan.gananciaEsperada)} icon={TrendingUp} tone="success" mono />
            <StatCard label="Cantidad de productos" value={plan.cantidadProductos} icon={Package} tone="accent" />
            <StatCard label="Filamento estimado" value={plan.gramosEstimados > 0 ? `${(plan.gramosEstimados / 1000).toFixed(2)}kg` : "sin datos de peso"} icon={Layers} tone="violet" />
          </div>

          <div className="panel">
            <h3>Sugerencia de producción</h3>
            <div className="list">
              {plan.items.map((it) => (
                <div key={it.nombre} className="row-card">
                  <div className="row-main">
                    <p className="row-title">{it.nombre} <span className="dim">×{it.cantidad}</span></p>
                    <p className="row-sub">{it.horas.toFixed(1)}h de impresión{it.gramos > 0 ? ` · ${it.gramos}g` : ""}</p>
                  </div>
                  <div className="row-side">
                    <p className="mono price">{formatARS(it.ganancia)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================= CALENDARIO INTELIGENTE =============================
function diasDelMes(anio, mes) {
  const primerDia = new Date(anio, mes, 1);
  const ultimoDia = new Date(anio, mes + 1, 0);
  const arr = [];
  const offset = (primerDia.getDay() + 6) % 7; // lunes = 0
  for (let i = 0; i < offset; i++) arr.push(null);
  for (let d = 1; d <= ultimoDia.getDate(); d++) arr.push(new Date(anio, mes, d));
  return arr;
}

function fechaISO(d) {
  return d.toISOString().slice(0, 10);
}

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function CalendarioInteligente({ data, updateOrder, updateConfig }) {
  const hoy = new Date();
  const [cursor, setCursor] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [draggedId, setDraggedId] = useState(null);
  const horasDiarias = (data.config && data.config.horasImpresionDiarias) || 4;

  const pedidos = A.pedidosConFecha(data);
  const sobrecargados = useMemo(() => A.diasSobrecargados(data, horasDiarias), [data, horasDiarias]);
  const fechasSobrecargadas = new Set(sobrecargados.map((d) => d.fecha));

  const celdas = diasDelMes(cursor.getFullYear(), cursor.getMonth());

  const pedidosPorFecha = useMemo(() => {
    const map = {};
    pedidos.forEach((o) => {
      if (!map[o.fechaEntrega]) map[o.fechaEntrega] = [];
      map[o.fechaEntrega].push(o);
    });
    return map;
  }, [pedidos]);

  const cambiarMes = (delta) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const onDrop = (fechaDestino) => {
    if (!draggedId) return;
    updateOrder(draggedId, { fechaEntrega: fechaDestino });
    setDraggedId(null);
  };

  return (
    <div className="section">
      <div className="section-head">
        <h2>Calendario Inteligente</h2>
        <div className="calendario-config">
          <label>
            Horas de impresión x día
            <input
              type="number"
              min="0"
              step="0.5"
              value={horasDiarias}
              onChange={(e) => updateConfig({ horasImpresionDiarias: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>

      {sobrecargados.length > 0 && (
        <div className="panel recomendaciones-panel">
          <h3><AlertTriangle size={15} /> Fechas con sobrecarga</h3>
          <ul className="recomendaciones-list">
            {sobrecargados.map((d) => (
              <li key={d.fecha}>
                <AlertCircle size={14} />
                ⚠ El {d.fecha} tenés {d.pedidos.length} pedidos que suman {d.horas.toFixed(1)}h de impresión, pero solo tenés {horasDiarias}h/día disponibles — no llegás a terminar todos ({d.pedidos.map((p) => p.producto).join(", ")}).
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="calendario-nav">
        <button className="btn-secondary" onClick={() => cambiarMes(-1)}>← Anterior</button>
        <h3>{cursor.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</h3>
        <button className="btn-secondary" onClick={() => cambiarMes(1)}>Siguiente →</button>
      </div>

      <div className="calendario-grid">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="calendario-dow">{d}</div>
        ))}
        {celdas.map((fecha, i) => {
          if (!fecha) return <div key={i} className="calendario-celda vacia" />;
          const key = fechaISO(fecha);
          const items = pedidosPorFecha[key] || [];
          const esHoy = key === fechaISO(hoy);
          const sobrecargada = fechasSobrecargadas.has(key);
          return (
            <div
              key={i}
              className={"calendario-celda" + (esHoy ? " hoy" : "") + (sobrecargada ? " sobrecargada" : "")}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(key)}
            >
              <span className="celda-num">{fecha.getDate()}</span>
              <div className="celda-pedidos">
                {items.map((o) => (
                  <div
                    key={o.id}
                    className="pedido-chip"
                    draggable
                    onDragStart={() => setDraggedId(o.id)}
                    title={`${o.producto}${o.cliente ? " · " + o.cliente : ""}`}
                  >
                    {o.producto}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="ideas-footnote">Arrastrá un pedido a otro día para cambiar su fecha de entrega.</p>
    </div>
  );
}

// ============================= HEATMAP DE ACTIVIDAD =============================
const METRICAS_HEATMAP = [
  { id: "ventas", label: "Ventas ($)" },
  { id: "ganancias", label: "Ganancias ($)" },
  { id: "pedidos", label: "Pedidos" },
  { id: "impresiones", label: "Unidades vendidas" },
];

function HeatmapActividad({ data }) {
  const [metrica, setMetrica] = useState("ventas");
  const mapa = useMemo(() => A.actividadDiaria(data, metrica), [data, metrica]);

  const hoy = new Date();
  const dias = [];
  for (let i = 370; i >= 0; i--) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - i);
    dias.push(d);
  }
  // alinear para que empiece en lunes
  const offsetInicio = (dias[0].getDay() + 6) % 7;
  const celdas = [...Array(offsetInicio).fill(null), ...dias];

  const valores = Object.values(mapa);
  const max = valores.length ? Math.max(...valores) : 0;

  const nivel = (v) => {
    if (!v || v <= 0) return 0;
    if (max <= 0) return 0;
    const ratio = v / max;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  };

  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) {
    semanas.push(celdas.slice(i, i + 7));
  }

  return (
    <div className="section">
      <div className="section-head">
        <h2>Actividad</h2>
        <div className="destino-toggle">
          {METRICAS_HEATMAP.map((m) => (
            <button key={m.id} type="button" className={metrica === m.id ? "active" : ""} onClick={() => setMetrica(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="heatmap-scroll">
          <div className="heatmap-grid">
            {semanas.map((semana, wi) => (
              <div key={wi} className="heatmap-col">
                {semana.map((dia, di) => {
                  if (!dia) return <div key={di} className="heatmap-celda vacia" />;
                  const key = dia.toISOString().slice(0, 10);
                  const valor = mapa[key] || 0;
                  return (
                    <div
                      key={di}
                      className={`heatmap-celda nivel-${nivel(valor)}`}
                      title={`${key}: ${metrica === "ventas" || metrica === "ganancias" ? formatARS(valor) : valor}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="heatmap-leyenda">
          <span>Menos</span>
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className={`heatmap-celda nivel-${n}`} />
          ))}
          <span>Más</span>
        </div>
      </div>
    </div>
  );
}

// ============================= DASHBOARD EJECUTIVO =============================
function DashboardEjecutivo({ data, updateConfig }) {
  const hoy = new Date();
  const tDia = A.totales(A.ventasDelDia(data));
  const tMes = A.totales(A.ventasDelMes(data));
  const tAnio = A.totales(A.ventasDelAnio(data));
  const alertasStock = A.stockBajoMinimo(data);
  const proxima = A.proximaEntrega(data);
  const atrasados = A.pedidosAtrasados(data);
  const pend = A.pendientesProduccion(data);
  const recientes = A.ventasRecientes(data, 6);
  const topProductos = A.top10(data, "ingreso").slice(0, 5);

  const multiplicador = (data.config && data.config.multiplicadorValorNegocio) || 2.5;
  const valor = A.valorNegocio(data, multiplicador);
  const evolucion = A.evolucionValorNegocio(data, multiplicador);

  return (
    <div className="section">
      <div className="section-head">
        <h2>Dashboard Ejecutivo</h2>
        <p className="current-month-label">{hoy.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <div className="ejecutivo-hero">
        <div className="hero-cell">
          <span>Ganancia hoy</span>
          <strong className="mono">{formatARS(tDia.ganancia)}</strong>
        </div>
        <div className="hero-cell main">
          <span>Ganancia del mes</span>
          <strong className="mono">{formatARS(tMes.ganancia)}</strong>
        </div>
        <div className="hero-cell">
          <span>Ganancia del año</span>
          <strong className="mono">{formatARS(tAnio.ganancia)}</strong>
        </div>
      </div>

      <div className="ejecutivo-grid">
        <div className="panel">
          <h3>Estado operativo</h3>
          <div className="produccion-grid">
            <div className="prod-cell">
              <span>Pedidos activos</span>
              <strong>{pend.cantidadPedidos}</strong>
            </div>
            <div className={"prod-cell" + (atrasados.length ? " danger" : "")}>
              <span>Pedidos atrasados</span>
              <strong>{atrasados.length}</strong>
            </div>
            <div className="prod-cell">
              <span>Próxima entrega</span>
              <strong>{proxima ? proxima.fechaEntrega : "—"}</strong>
            </div>
            <div className={"prod-cell" + (alertasStock.length ? " danger" : "")}>
              <span>Stock crítico</span>
              <strong>{alertasStock.length}</strong>
            </div>
            <div className="prod-cell">
              <span>Horas pendientes</span>
              <strong>{pend.horas > 0 ? `${pend.horas}h` : "—"}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <h3>Top productos</h3>
          {topProductos.length === 0 ? (
            <p className="empty-note">Todavía no hay ventas.</p>
          ) : (
            <ol className="ranking-list">
              {topProductos.map((p, idx) => (
                <li key={p.nombre} className="ranking-row">
                  <span className="ranking-pos">{idx + 1}</span>
                  <div className="ranking-info">
                    <p className="ranking-name">{p.nombre}</p>
                    <p className="ranking-units">{p.unidades} unidades</p>
                  </div>
                  <span className="ranking-total mono">{formatARS(p.ingreso)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>Ventas recientes</h3>
        {recientes.length === 0 ? (
          <p className="empty-note">Todavía no hay ventas registradas.</p>
        ) : (
          <div className="list">
            {recientes.map((v) => (
              <div key={v.id} className="row-card">
                <div className="row-main">
                  <p className="row-title">{v.nombre} <span className="dim">×{v.cantidad}</span></p>
                  <p className="row-sub">{v.fecha} · {v.medioPago}</p>
                </div>
                <div className="row-side">
                  <p className="mono price">{formatARS(v.monto)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel valor-negocio-panel">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <h3><Rocket size={16} /> Valor estimado del negocio</h3>
          <label className="multiplicador-label">
            Multiplicador
            <input
              type="number"
              min="0"
              step="0.1"
              value={multiplicador}
              onChange={(e) => updateConfig({ multiplicadorValorNegocio: Number(e.target.value) })}
            />
          </label>
        </div>
        <p className="valor-negocio-total mono">{formatARS(valor.valorEstimado)}</p>
        <p className="hint">
          💡 Estimación simple: ganancia del año actual × el multiplicador que definas. No es una valuación financiera real,
          es sólo una referencia orientativa que vos podés ajustar.
        </p>
        <div className="mini-stats-grid" style={{ marginTop: 14 }}>
          <MiniStat label="Facturación anual" value={formatARS(valor.facturacionAnual)} />
          <MiniStat label="Ganancia anual" value={formatARS(valor.gananciaAnual)} />
          <MiniStat label="Cantidad de pedidos" value={valor.cantidadPedidos} />
          <MiniStat label="Cantidad de ventas" value={valor.cantidadVentas} />
          <MiniStat label="Productos activos" value={valor.cantidadProductos} />
          <MiniStat label="Clientes distintos" value={valor.clientesDistintos} />
        </div>

        {evolucion.length > 1 && (
          <div style={{ marginTop: 18, width: "100%", height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={evolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis dataKey="anio" stroke="var(--ink-soft)" fontSize={12} />
                <YAxis stroke="var(--ink-soft)" fontSize={11} width={70} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatARS(v)} contentStyle={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }} />
                <Bar dataKey="valor" fill="var(--violet)" radius={[6, 6, 0, 0]} name="Valor estimado" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================= PEDIDOS =============================
function Pedidos({ data, addOrder, updateOrder, deleteOrder, addVenta }) {
  const emptyForm = { cliente: "", producto: "", cantidad: 1, precioTotal: "", fechaEntrega: "", notas: "", pesoEstimado: "", tiempoEstimado: "" };
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [pagandoId, setPagandoId] = useState(null);
  const [pago, setPago] = useState({ medioPago: MEDIOS_PAGO[0], costo: "" });

  const submit = (e) => {
    e.preventDefault();
    if (!form.producto) return;
    addOrder({ ...form, estado: "pendiente" });
    setForm(emptyForm);
    setShowForm(false);
  };

  const confirmarPago = (o) => {
    updateOrder(o.id, { pagado: true, medioPago: pago.medioPago });
    addVenta({
      tipo: "pedido",
      refId: o.id,
      nombre: o.producto,
      cantidad: o.cantidad,
      medioPago: pago.medioPago,
      monto: Number(o.precioTotal) || 0,
      costo: Number(pago.costo) || 0,
    });
    setPagandoId(null);
    setPago({ medioPago: MEDIOS_PAGO[0], costo: "" });
  };

  const sorted = [...data.orders].sort((a, b) => (b.fechaCreacion || "").localeCompare(a.fechaCreacion || ""));

  return (
    <div className="section">
      <div className="section-head">
        <h2>Pedidos</h2>
        <button className="btn-accent" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> Nuevo pedido
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={submit}>
          <div className="form-row">
            <label>
              Cliente
              <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Nombre, o dejalo vacío si es de mostrador/feria" />
            </label>
            <label>
              Producto
              <input value={form.producto} onChange={(e) => setForm({ ...form, producto: e.target.value })} placeholder="Ej: Maceta hexagonal" required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Cantidad
              <input type="number" min="1" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </label>
            <label>
              Precio total
              <input type="number" min="0" value={form.precioTotal} onChange={(e) => setForm({ ...form, precioTotal: e.target.value })} placeholder="ARS" />
            </label>
            <label>
              Fecha entrega
              <input type="date" value={form.fechaEntrega} onChange={(e) => setForm({ ...form, fechaEntrega: e.target.value })} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Peso estimado en g (opcional)
              <input type="number" min="0" value={form.pesoEstimado} onChange={(e) => setForm({ ...form, pesoEstimado: e.target.value })} placeholder="Para el Dashboard de Producción" />
            </label>
            <label>
              Tiempo estimado en horas (opcional)
              <input type="number" min="0" step="0.1" value={form.tiempoEstimado} onChange={(e) => setForm({ ...form, tiempoEstimado: e.target.value })} placeholder="Para el Dashboard de Producción" />
            </label>
          </div>
          <label className="full">
            Notas
            <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Color, detalles..." />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-accent">Guardar pedido</button>
          </div>
        </form>
      )}

      <div className="list">
        {sorted.length === 0 && <p className="empty-note">Todavía no cargaste pedidos.</p>}
        {sorted.map((o) => {
          const meta = estadoMeta(ESTADOS_PEDIDO, o.estado);
          return (
            <div key={o.id} className="row-card wrap">
              <div className="row-top">
                <div className="row-main">
                  <p className="row-title">{o.producto} <span className="dim">×{o.cantidad}</span></p>
                  <p className="row-sub">{o.cliente || "Mostrador / feria"} {o.fechaEntrega ? `· entrega ${o.fechaEntrega}` : ""}</p>
                  {o.notas && <p className="row-notes">{o.notas}</p>}
                </div>
                <div className="row-side">
                  <p className="mono price">{formatARS(o.precioTotal)}</p>
                  <select className={`badge-select tone-${meta.color}`} value={o.estado} onChange={(e) => updateOrder(o.id, { estado: e.target.value })}>
                    {ESTADOS_PEDIDO.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </select>
                  {o.pagado ? (
                    <span className="badge tone-success"><CheckCircle2 size={11} /> Pagado · {o.medioPago}</span>
                  ) : (
                    <button className="btn-mini" onClick={() => setPagandoId(pagandoId === o.id ? null : o.id)}>
                      <DollarSign size={12} /> Marcar pagado
                    </button>
                  )}
                  <button className="icon-btn" onClick={() => deleteOrder(o.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              {pagandoId === o.id && (
                <div className="pago-inline">
                  <label>
                    Medio de pago
                    <select value={pago.medioPago} onChange={(e) => setPago({ ...pago, medioPago: e.target.value })}>
                      {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <label>
                    Costo (opcional, para calcular ganancia)
                    <input type="number" min="0" value={pago.costo} onChange={(e) => setPago({ ...pago, costo: e.target.value })} placeholder="ARS" />
                  </label>
                  <button className="btn-accent" onClick={() => confirmarPago(o)} type="button">Confirmar pago → pasa a Ventas</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ============================= STOCK =============================
function Stock({ data, addStock, updateStock, deleteStock, registrarConsumoLog }) {
  const [form, setForm] = useState({ material: "PLA", color: "", marca: "", pesoInicial: 1000, pesoRestante: 1000, precioKg: "", alertaMinimo: 150 });
  const [showForm, setShowForm] = useState(false);
  const [consumo, setConsumo] = useState({});

  const submit = (e) => {
    e.preventDefault();
    if (!form.color) return;
    addStock({ ...form, pesoRestante: form.pesoRestante || form.pesoInicial });
    setForm({ material: "PLA", color: "", marca: "", pesoInicial: 1000, pesoRestante: 1000, precioKg: "", alertaMinimo: 150 });
    setShowForm(false);
  };

  const registrarConsumo = (id) => {
    const g = Number(consumo[id] || 0);
    if (!g) return;
    registrarConsumoLog(id, g);
    setConsumo({ ...consumo, [id]: "" });
  };

  return (
    <div className="section">
      <div className="section-head">
        <h2>Stock de filamento</h2>
        <button className="btn-accent" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> Nuevo rollo
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={submit}>
          <div className="form-row">
            <label>
              Material
              <select value={form.material} onChange={(e) => setForm({ ...form, material: e.target.value })}>
                {MATERIALES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label>
              Color
              <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Ej: Naranja" required />
            </label>
            <label>
              Marca
              <input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} placeholder="Ej: Grilon" />
            </label>
          </div>
          <div className="form-row">
            <label>
              Peso inicial (g)
              <input type="number" min="0" value={form.pesoInicial} onChange={(e) => setForm({ ...form, pesoInicial: e.target.value })} />
            </label>
            <label>
              Precio por kg (ARS)
              <input type="number" min="0" value={form.precioKg} onChange={(e) => setForm({ ...form, precioKg: e.target.value })} />
            </label>
            <label>
              Alerta mínima (g)
              <input type="number" min="0" value={form.alertaMinimo} onChange={(e) => setForm({ ...form, alertaMinimo: e.target.value })} />
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-accent">Guardar rollo</button>
          </div>
        </form>
      )}

      <div className="spool-grid">
        {data.stock.length === 0 && <p className="empty-note">Todavía no cargaste rollos de filamento.</p>}
        {data.stock.map((s) => {
          const pct = Math.max(0, Math.min(100, (Number(s.pesoRestante) / Number(s.pesoInicial || 1)) * 100));
          const bajo = Number(s.pesoRestante) <= Number(s.alertaMinimo || 0);
          return (
            <div key={s.id} className={"spool-card" + (bajo ? " low" : "")}>
              <div className="spool-gauge">
                <svg viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="17" className="gauge-track" />
                  <circle cx="20" cy="20" r="17" className="gauge-fill" strokeDasharray={`${pct * 1.068} 200`} />
                </svg>
                <span className="gauge-pct mono">{Math.round(pct)}%</span>
              </div>
              <div className="spool-info">
                <p className="row-title">{s.material} · {s.color}</p>
                <p className="row-sub">{s.marca || "sin marca"} · {formatARS(s.precioKg)}/kg</p>
                <p className="mono">{s.pesoRestante}g / {s.pesoInicial}g</p>
                {bajo && <p className="low-flag"><AlertTriangle size={12} /> Bajo mínimo</p>}
                <div className="consumo-row">
                  <input
                    type="number"
                    placeholder="g usados"
                    value={consumo[s.id] || ""}
                    onChange={(e) => setConsumo({ ...consumo, [s.id]: e.target.value })}
                  />
                  <button className="btn-mini" onClick={() => registrarConsumo(s.id)}>Registrar</button>
                </div>
              </div>
              <button className="icon-btn corner" onClick={() => deleteStock(s.id)}><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>

      <PrediccionStock data={data} />
    </div>
  );
}

function PrediccionStock({ data }) {
  const consumoColor = A.consumoPorColor(data);
  const consumoMaterial = A.consumoPorMaterial(data);

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3><TrendingUp size={15} /> Predicción de consumo</h3>
      {data.stock.length === 0 ? (
        <p className="empty-note">Cargá rollos de stock para ver la predicción.</p>
      ) : (
        <div className="prediccion-grid">
          {data.stock.map((s) => {
            const dias = A.duracionEstimadaDias(data, s.id);
            const riesgo = A.nivelRiesgo(dias);
            return (
              <div key={s.id} className="prediccion-card">
                <p className="row-title">{s.material} {s.color}</p>
                <p className="row-sub">Quedan {s.pesoRestante}g</p>
                {dias === null ? (
                  <p className="empty-note" style={{ margin: "6px 0 0" }}>Todavía sin datos suficientes — registrá consumos para estimar la duración.</p>
                ) : (
                  <>
                    <p className="mono" style={{ margin: "6px 0 0" }}>Duración estimada: ~{Math.round(dias)} días</p>
                    <span className={`badge tone-${riesgo === "Alto" ? "danger" : riesgo === "Medio" ? "warning" : "success"}`} style={{ marginTop: 6, display: "inline-block" }}>
                      Riesgo {riesgo}
                    </span>
                    {dias < 10 && <p className="hint" style={{ marginTop: 8 }}>💡 Conviene comprar otro rollo pronto.</p>}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {consumoColor.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p className="mini-heading">Consumo por color (histórico)</p>
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={consumoColor.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                <XAxis type="number" stroke="var(--ink-soft)" fontSize={11} />
                <YAxis type="category" dataKey="label" stroke="var(--ink-soft)" fontSize={11} width={110} />
                <Tooltip formatter={(v) => `${v}g`} contentStyle={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8, color: "var(--ink)" }} />
                <Bar dataKey="gramos" fill="var(--teal)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================= COMPRAS =============================
function Compras({ data, addPurchase, deletePurchase }) {
  const [form, setForm] = useState({ fecha: todayISO(), tipo: "Filamento", descripcion: "", proveedor: "", monto: "", notas: "" });
  const [showForm, setShowForm] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!form.descripcion) return;
    addPurchase(form);
    setForm({ fecha: todayISO(), tipo: "Filamento", descripcion: "", proveedor: "", monto: "", notas: "" });
    setShowForm(false);
  };

  const sorted = [...data.purchases].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  const mesActual = new Date().toISOString().slice(0, 7);
  const gastadoMes = data.purchases
    .filter((p) => (p.fecha || "").slice(0, 7) === mesActual)
    .reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  return (
    <div className="section">
      <div className="section-head">
        <h2>Compras e insumos</h2>
        <button className="btn-accent" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> Nueva compra
        </button>
      </div>

      <div className="cards-grid" style={{ marginBottom: 16 }}>
        <StatCard label="Gastado este mes" value={formatARS(gastadoMes)} icon={ShoppingCart} tone="danger" mono />
      </div>

      {showForm && (
        <form className="form-card" onSubmit={submit}>
          <div className="form-row">
            <label>
              Fecha
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </label>
            <label>
              Tipo
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS_COMPRA.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              Descripción
              <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Filamento PETG naranja 1kg" required />
            </label>
            <label>
              Proveedor
              <input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} placeholder="Opcional" />
            </label>
            <label>
              Monto (ARS)
              <input type="number" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
            </label>
          </div>
          <label className="full">
            Notas
            <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn-accent">Guardar compra</button>
          </div>
        </form>
      )}

      <div className="list">
        {sorted.length === 0 && <p className="empty-note">Todavía no cargaste compras.</p>}
        {sorted.map((p) => (
          <div key={p.id} className="row-card">
            <div className="row-main">
              <p className="row-title">{p.descripcion} <span className={`badge tone-teal inline-badge`}>{p.tipo}</span></p>
              <p className="row-sub">{p.fecha} {p.proveedor ? `· ${p.proveedor}` : ""}</p>
              {p.notas && <p className="row-notes">{p.notas}</p>}
            </div>
            <div className="row-side">
              <p className="mono price">{formatARS(p.monto)}</p>
              <button className="icon-btn" onClick={() => deletePurchase(p.id)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================= VENTAS =============================
function Ventas({ data, deleteVenta }) {
  const [filtroMedio, setFiltroMedio] = useState("");
  const ventas = data.ventas || [];
  const hoy = new Date();
  const mesActualLabel = `${NOMBRE_MES_LARGO[hoy.getMonth()]} de ${hoy.getFullYear()}`;

  const filtradas = filtroMedio ? ventas.filter((v) => v.medioPago === filtroMedio) : ventas;

  const grupos = useMemo(() => {
    const map = {};
    filtradas.forEach((v) => {
      const key = (v.fecha || "").slice(0, 7) || "sin-fecha";
      if (!map[key]) map[key] = [];
      map[key].push(v);
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, items]) => {
        const [y, mm] = key.split("-");
        const label = mm ? `${NOMBRE_MES_LARGO[Number(mm) - 1]} de ${y}` : "Sin fecha";
        const sortedItems = [...items].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
        const subtotalIngreso = items.reduce((acc, v) => acc + (Number(v.monto) || 0), 0);
        return { key, label, items: sortedItems, subtotalIngreso };
      });
  }, [filtradas]);

  return (
    <div className="section">
      <div className="section-head">
        <div>
          <h2>Ventas</h2>
          <p className="current-month-label">Estamos en {mesActualLabel}</p>
        </div>
        <select className="order-select" value={filtroMedio} onChange={(e) => setFiltroMedio(e.target.value)}>
          <option value="">Todos los medios de pago</option>
          {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {grupos.length === 0 && <p className="empty-note">Todavía no registraste ninguna venta. Se cargan solas desde Pedidos ("Marcar pagado"), Productos ("Registrar venta") o Presupuestos aceptados.</p>}

      {grupos.map((g) => (
        <div key={g.key} className="venta-mes-group">
          <div className="venta-mes-header">
            <h3>{g.label}</h3>
            <span className="mono venta-mes-subtotal">{formatARS(g.subtotalIngreso)}</span>
          </div>
          <div className="list">
            {g.items.map((v) => (
              <div key={v.id} className="row-card">
                <div className="row-main">
                  <p className="row-title">
                    {v.nombre} <span className="dim">×{v.cantidad}</span>
                    <span className={`badge inline-badge ${v.tipo === "producto" ? "tone-teal" : v.tipo === "presupuesto" ? "tone-warning" : "tone-violet"}`}>
                      {v.tipo === "producto" ? "Producto" : v.tipo === "presupuesto" ? "Presupuesto" : "Pedido"}
                    </span>
                  </p>
                  <p className="row-sub">{v.fecha} · {v.medioPago}</p>
                </div>
                <div className="row-side">
                  <div className="venta-montos">
                    <span className="mono price">{formatARS(v.monto)}</span>
                    <span className="mono ganancia">+{formatARS((Number(v.monto) || 0) - (Number(v.costo) || 0))}</span>
                  </div>
                  <button className="icon-btn" onClick={() => deleteVenta(v.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================= PRESUPUESTOS =============================
function nuevoItem() {
  return { id: uid(), descripcion: "", monto: "" };
}

function Presupuestos({ data, addPresupuesto, deletePresupuesto, aceptarPresupuesto }) {
  const emptyForm = { cliente: "", fecha: todayISO(), notas: "", items: [nuevoItem()] };
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [descargando, setDescargando] = useState(null);
  const [aceptandoId, setAceptandoId] = useState(null);
  const [medioAceptado, setMedioAceptado] = useState(MEDIOS_PAGO[0]);

  const updateItem = (id, patch) => {
    setForm((f) => ({ ...f, items: f.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  };
  const agregarItem = () => setForm((f) => ({ ...f, items: [...f.items, nuevoItem()] }));
  const quitarItem = (id) => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((it) => it.id !== id) : f.items }));

  const total = form.items.reduce((acc, it) => acc + (Number(it.monto) || 0), 0);

  const submit = (e) => {
    e.preventDefault();
    const items = form.items.filter((it) => it.descripcion.trim() !== "");
    if (items.length === 0) return;
    addPresupuesto({ ...form, items });
    setForm(emptyForm);
    setShowForm(false);
  };

  const descargar = async (p) => {
    setDescargando(p.id);
    try {
      await generarPresupuestoPDF(p, LOGO_SRC);
    } catch (e) {
      console.error("No se pudo generar el PDF", e);
      alert("No se pudo generar el PDF. Revisá tu conexión a internet e intentá de nuevo.");
    } finally {
      setDescargando(null);
    }
  };

  const confirmarAceptado = (p) => {
    aceptarPresupuesto(p, medioAceptado);
    setAceptandoId(null);
    setMedioAceptado(MEDIOS_PAGO[0]);
  };

  const sorted = [...data.presupuestos].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  return (
    <div className="section">
      <div className="section-head">
        <h2>Presupuestos</h2>
        <button className="btn-accent" onClick={() => setShowForm((s) => !s)}>
          <Plus size={16} /> Nuevo presupuesto
        </button>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={submit}>
          <div className="form-row">
            <label>
              Cliente / para quién es
              <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Ej: Estudio ABC, o nombre" />
            </label>
            <label>
              Fecha
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </label>
          </div>

          <div className="presupuesto-items">
            <p className="mini-heading">Ítems (producto, o tanda de impresión de un pedido) con el total a cobrar por cada uno</p>
            {form.items.map((it) => (
              <div key={it.id} className="presupuesto-item-row">
                <input
                  className="item-desc"
                  placeholder="Ej: 3 llaveros personalizados"
                  value={it.descripcion}
                  onChange={(e) => updateItem(it.id, { descripcion: e.target.value })}
                />
                <input
                  className="item-monto"
                  type="number"
                  min="0"
                  placeholder="Total $"
                  value={it.monto}
                  onChange={(e) => updateItem(it.id, { monto: e.target.value })}
                />
                <button type="button" className="icon-btn" onClick={() => quitarItem(it.id)}><X size={14} /></button>
              </div>
            ))}
            <button type="button" className="btn-secondary" onClick={agregarItem} style={{ alignSelf: "flex-start" }}>
              <Plus size={14} /> Agregar ítem
            </button>
          </div>

          <label className="full">
            Notas (opcional, aparecen en el PDF)
            <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Ej: validez del presupuesto, forma de entrega..." />
          </label>

          <div className="presupuesto-total-preview">
            <span>Total</span>
            <strong className="mono">{formatARS(total)}</strong>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-accent">Guardar presupuesto</button>
          </div>
        </form>
      )}

      <div className="list">
        {sorted.length === 0 && <p className="empty-note">Todavía no armaste ningún presupuesto.</p>}
        {sorted.map((p) => {
          const total = p.items.reduce((acc, it) => acc + (Number(it.monto) || 0), 0);
          const aceptado = p.estado === "aceptado";
          return (
            <div key={p.id} className="row-card wrap">
              <div className="row-top">
                <div className="row-main">
                  <p className="row-title">{p.cliente || "Sin nombre"}</p>
                  <p className="row-sub">{p.fecha} · {p.items.length} ítem{p.items.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="row-side">
                  <p className="mono price">{formatARS(total)}</p>
                  <button className="btn-mini" onClick={() => descargar(p)} disabled={descargando === p.id}>
                    <FileText size={12} /> {descargando === p.id ? "Generando…" : "Descargar PDF"}
                  </button>
                  {aceptado ? (
                    <span className="badge tone-success"><CheckCircle2 size={11} /> Aceptado · pasó a Ventas</span>
                  ) : (
                    <button className="btn-mini" onClick={() => setAceptandoId(aceptandoId === p.id ? null : p.id)}>
                      <CheckCircle2 size={12} /> Marcar aceptado
                    </button>
                  )}
                  <button className="icon-btn" onClick={() => deletePresupuesto(p.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <ul className="presupuesto-items-preview">
                {p.items.map((it) => (
                  <li key={it.id}>
                    <span>{it.descripcion}</span>
                    <span className="mono">{formatARS(it.monto)}</span>
                  </li>
                ))}
              </ul>
              {aceptandoId === p.id && (
                <div className="pago-inline">
                  <label>
                    Medio de pago
                    <select value={medioAceptado} onChange={(e) => setMedioAceptado(e.target.value)}>
                      {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <button className="btn-accent" onClick={() => confirmarAceptado(p)} type="button">Confirmar → cada ítem pasa a Ventas</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================= PRODUCTOS =============================
function Productos({ data, addProduct, updateProduct, deleteProduct, addVenta }) {
  const emptyForm = { nombre: "", costo: "", precioUnitario: "", notas: "", foto: "", categoria: "", tiempoImpresionHoras: "", pesoGramos: "", mayoristaTiers: defaultTiers() };
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [orden, setOrden] = useState("publicacion");
  const [vendiendoId, setVendiendoId] = useState(null);
  const [venta, setVenta] = useState({ cantidad: 1, medioPago: MEDIOS_PAGO[0], precioVenta: "" });

  const onFoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const comprimida = await compressImage(file);
      setForm((f) => ({ ...f, foto: comprimida }));
    } catch (err) {
      console.error("No se pudo comprimir la imagen", err);
    }
  };

  const updateTier = (cantidad, patch) => {
    setForm((f) => ({
      ...f,
      mayoristaTiers: f.mayoristaTiers.map((t) => (t.cantidad === cantidad ? { ...t, ...patch } : t)),
    }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.nombre) return;
    if (editingId) {
      updateProduct(editingId, form);
    } else {
      addProduct({ ...form, fechaCreacion: todayISO() });
    }
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const empezarEdicion = (p) => {
    setForm({
      nombre: p.nombre || "",
      costo: p.costo || "",
      precioUnitario: p.precioUnitario || "",
      notas: p.notas || "",
      foto: p.foto || "",
      categoria: p.categoria || "",
      tiempoImpresionHoras: p.tiempoImpresionHoras || "",
      pesoGramos: p.pesoGramos || "",
      mayoristaTiers: p.mayoristaTiers && p.mayoristaTiers.length ? p.mayoristaTiers : defaultTiers(),
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const cancelarForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  };

  const ventasPorProducto = useMemo(() => {
    const map = {};
    (data.ventas || []).forEach((v) => {
      if (v.tipo === "producto") map[v.refId] = (map[v.refId] || 0) + (Number(v.cantidad) || 0);
    });
    return map;
  }, [data.ventas]);

  const confirmarVenta = (p) => {
    const cant = Number(venta.cantidad) || 1;
    const precio = venta.precioVenta !== "" ? Number(venta.precioVenta) : Number(p.precioUnitario) || 0;
    addVenta({
      tipo: "producto",
      refId: p.id,
      nombre: p.nombre,
      cantidad: cant,
      medioPago: venta.medioPago,
      monto: precio * cant,
      costo: (Number(p.costo) || 0) * cant,
    });
    setVendiendoId(null);
    setVenta({ cantidad: 1, medioPago: MEDIOS_PAGO[0], precioVenta: "" });
  };

  const sortedProducts = useMemo(() => {
    const arr = [...data.products];
    if (orden === "alfabetico") arr.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    else if (orden === "vendidos") arr.sort((a, b) => (ventasPorProducto[b.id] || 0) - (ventasPorProducto[a.id] || 0));
    else arr.sort((a, b) => (a.fechaCreacion || "").localeCompare(b.fechaCreacion || ""));
    return arr;
  }, [data.products, orden, ventasPorProducto]);

  return (
    <div className="section">
      <div className="section-head">
        <h2>Catálogo de productos</h2>
        <div className="section-head-actions">
          <select className="order-select" value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="publicacion">Orden de publicación</option>
            <option value="alfabetico">Alfabético</option>
            <option value="vendidos">Más vendidos</option>
          </select>
          <button className="btn-accent" onClick={() => {
            if (editingId) { setForm(emptyForm); setEditingId(null); setShowForm(true); }
            else setShowForm((s) => !s);
          }}>
            <Plus size={16} /> Nuevo producto
          </button>
        </div>
      </div>

      {showForm && (
        <form className="form-card" onSubmit={submit}>
          {editingId && <p className="mini-heading">Editando producto</p>}
          <div className="form-row">
            <label>
              Nombre del producto
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required placeholder="Ej: Maceta hexagonal chica" />
            </label>
          </div>
          <div className="foto-uploader">
            {form.foto ? (
              <img src={form.foto} alt="preview" className="foto-preview" />
            ) : (
              <div className="foto-placeholder"><ImagePlus size={20} /></div>
            )}
            <label className="foto-label">
              Foto del producto (se comprime sola)
              <input type="file" accept="image/*" onChange={onFoto} />
            </label>
            <QuitarFondoBoton foto={form.foto} onResult={(nueva) => setForm((f) => ({ ...f, foto: nueva }))} />
          </div>
          <div className="form-row">
            <label>
              Costo (material + tiempo)
              <input type="number" min="0" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} placeholder="ARS" />
            </label>
            <label>
              Precio unitario
              <input type="number" min="0" value={form.precioUnitario} onChange={(e) => setForm({ ...form, precioUnitario: e.target.value })} placeholder="ARS" />
            </label>
          </div>
          <div className="form-row">
            <label>
              Categoría (opcional)
              <input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ej: Llaveros, Decohogar..." />
            </label>
            <label>
              Tiempo de impresión x unidad, en horas (opcional)
              <input type="number" min="0" step="0.1" value={form.tiempoImpresionHoras} onChange={(e) => setForm({ ...form, tiempoImpresionHoras: e.target.value })} placeholder="Ej: 1.5" />
            </label>
            <label>
              Peso x unidad, en gramos (opcional)
              <input type="number" min="0" value={form.pesoGramos} onChange={(e) => setForm({ ...form, pesoGramos: e.target.value })} placeholder="Ej: 25" />
            </label>
          </div>

          <div className="tiers-editor">
            <p className="mini-heading">Precios por mayor — habilitá solo las cantidades que ofrecés</p>
            {form.mayoristaTiers.map((t) => {
              const descuento = DESCUENTO_SUGERIDO[t.cantidad];
              const sugerido = form.precioUnitario ? Math.round(Number(form.precioUnitario) * (1 - descuento)) : null;
              return (
                <div key={t.cantidad} className={"tier-row" + (t.habilitado ? " on" : "")}>
                  <label className="tier-check">
                    <input type="checkbox" checked={t.habilitado} onChange={(e) => updateTier(t.cantidad, { habilitado: e.target.checked })} />
                    x{t.cantidad}
                  </label>
                  {t.habilitado && (
                    <>
                      <input
                        type="number"
                        min="0"
                        className="tier-price-input"
                        placeholder="precio c/u"
                        value={t.precio}
                        onChange={(e) => updateTier(t.cantidad, { precio: e.target.value })}
                      />
                      {sugerido !== null && (
                        <button type="button" className="tier-hint" onClick={() => updateTier(t.cantidad, { precio: sugerido })}>
                          sugerido: {formatARS(sugerido)} (−{Math.round(descuento * 100)}%)
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <label className="full">
            Notas
            <input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Color, variantes, tiempo de impresión..." />
          </label>
          <div className="form-actions">
            {editingId && <button type="button" className="btn-secondary" onClick={cancelarForm}>Cancelar</button>}
            <button type="submit" className="btn-accent">{editingId ? "Guardar cambios" : "Guardar producto"}</button>
          </div>
        </form>
      )}

      <div className="product-grid">
        {sortedProducts.length === 0 && <p className="empty-note">Todavía no cargaste productos en el catálogo.</p>}
        {sortedProducts.map((p, idx) => {
          const costo = Number(p.costo) || 0;
          const unit = Number(p.precioUnitario) || 0;
          const margenUnit = costo > 0 ? ((unit - costo) / costo) * 100 : null;
          const vendidos = ventasPorProducto[p.id] || 0;
          const tiers = (p.mayoristaTiers || []).filter((t) => t.habilitado && t.precio !== "");
          const esTop = orden === "vendidos" && idx === 0 && vendidos > 0;
          return (
            <div key={p.id} className="product-card">
              {esTop && <span className="top-badge">🔥 Top ventas</span>}
              <div className="product-card-actions">
                <button className="icon-btn" onClick={() => empezarEdicion(p)}><Pencil size={14} /></button>
                <button className="icon-btn" onClick={() => deleteProduct(p.id)}><Trash2 size={14} /></button>
              </div>
              {p.foto ? (
                <img src={p.foto} alt={p.nombre} className="product-photo" />
              ) : (
                <div className="product-photo placeholder"><ImagePlus size={22} /></div>
              )}
              <p className="row-title">{p.nombre} {p.categoria && <span className="badge inline-badge tone-teal">{p.categoria}</span>}</p>
              {vendidos > 0 && <p className="row-sub">{vendidos} vendido{vendidos !== 1 ? "s" : ""}</p>}
              {p.notas && <p className="row-notes">{p.notas}</p>}
              <p className="cost-line">Costo: <span className="mono">{formatARS(costo)}</span></p>

              <div className="price-pills">
                <div className="price-pill main">
                  <span>Unitario</span>
                  <strong className="mono">{formatARS(unit)}</strong>
                  {margenUnit !== null && <em className={margenUnit >= 0 ? "up" : "down"}>{margenUnit >= 0 ? "+" : ""}{margenUnit.toFixed(0)}%</em>}
                </div>
                {tiers.map((t) => {
                  const precio = Number(t.precio) || 0;
                  const margenT = costo > 0 ? ((precio - costo) / costo) * 100 : null;
                  return (
                    <div key={t.cantidad} className="price-pill">
                      <span>x{t.cantidad}</span>
                      <strong className="mono">{formatARS(precio)}</strong>
                      {margenT !== null && <em className={margenT >= 0 ? "up" : "down"}>{margenT >= 0 ? "+" : ""}{margenT.toFixed(0)}%</em>}
                    </div>
                  );
                })}
              </div>

              {vendiendoId === p.id ? (
                <div className="venta-inline">
                  <div className="form-row">
                    <label>Cantidad<input type="number" min="1" value={venta.cantidad} onChange={(e) => setVenta({ ...venta, cantidad: e.target.value })} /></label>
                    <label>Precio c/u<input type="number" min="0" value={venta.precioVenta} onChange={(e) => setVenta({ ...venta, precioVenta: e.target.value })} placeholder={String(unit)} /></label>
                  </div>
                  <label>
                    Medio de pago
                    <select value={venta.medioPago} onChange={(e) => setVenta({ ...venta, medioPago: e.target.value })}>
                      {MEDIOS_PAGO.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => setVendiendoId(null)}>Cancelar</button>
                    <button type="button" className="btn-accent" onClick={() => confirmarVenta(p)}>Registrar venta</button>
                  </div>
                </div>
              ) : (
                <button className="btn-mini full-width" onClick={() => { setVendiendoId(p.id); setVenta({ cantidad: 1, medioPago: MEDIOS_PAGO[0], precioVenta: "" }); }}>
                  <DollarSign size={12} /> Registrar venta
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================= CALCULADORA =============================
function AccordionSection({ icon: Icon, color, title, subtitle, open, onToggle, children }) {
  return (
    <div className={`accordion tone-chip-${color}`}>
      <button type="button" className="accordion-head" onClick={onToggle}>
        <span className="chip"><Icon size={16} /></span>
        <span className="accordion-titles">
          <span className="accordion-title">{title}</span>
          {subtitle && <span className="accordion-subtitle">{subtitle}</span>}
        </span>
        <ChevronDown size={18} className={"chev" + (open ? " open" : "")} />
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  );
}

function Slider({ label, value, onChange, min = 0, max = 100, step = 1, suffix = "%" }) {
  return (
    <label className="slider-field">
      <div className="slider-top">
        <span>{label}</span>
        <span className="slider-value mono">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Calculadora({ stock, addProduct, addOrder, calc, updateCalc }) {
  const c = calc || {};
  const [open, setOpen] = useState(c.open || { material: true, electricidad: true, amortizacion: false, margen: true });
  const toggle = (k) => setOpen({ ...open, [k]: !open[k] });

  const [destino, setDestino] = useState(c.destino ?? "producto");
  const [nombreProducto, setNombreProducto] = useState(c.nombreProducto ?? "");
  const [cliente, setCliente] = useState(c.cliente ?? "");
  const [cantidad, setCantidad] = useState(c.cantidad ?? 1);
  const [fechaEntrega, setFechaEntrega] = useState(c.fechaEntrega ?? "");
  const [enviado, setEnviado] = useState(false);

  const [selStock, setSelStock] = useState(c.selStock ?? "");
  const [peso, setPeso] = useState(c.peso ?? 50);
  const [precioKg, setPrecioKg] = useState(c.precioKg ?? 15000);
  const [desperdicio, setDesperdicio] = useState(c.desperdicio ?? 10);

  const [horas, setHoras] = useState(c.horas ?? 3);
  const [minutos, setMinutos] = useState(c.minutos ?? 0);
  const [potenciaW, setPotenciaW] = useState(c.potenciaW ?? 150);
  const [precioKwh, setPrecioKwh] = useState(c.precioKwh ?? 120);
  const [valorHora, setValorHora] = useState(c.valorHora ?? 1000);
  const [horasTrabajoPersonal, setHorasTrabajoPersonal] = useState(c.horasTrabajoPersonal ?? 0.5);

  const [precioImpresora, setPrecioImpresora] = useState(c.precioImpresora ?? 450000);
  const [vidaUtilHoras, setVidaUtilHoras] = useState(c.vidaUtilHoras ?? 5000);
  const [mantenimientoMes, setMantenimientoMes] = useState(c.mantenimientoMes ?? 5000);
  const [horasUsoMensual, setHorasUsoMensual] = useState(c.horasUsoMensual ?? 60);

  const [margen, setMargen] = useState(c.margen ?? 40);
  const [envio, setEnvio] = useState(c.envio ?? 0);
  const [comision, setComision] = useState(c.comision ?? 0);

  // Guarda automáticamente el estado de la calculadora para que quede tal
  // cual la dejaste la próxima vez que la abras (con un pequeño debounce
  // para no escribir en cada tecla que se presiona).
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (updateCalc) {
        updateCalc({
          open, destino, nombreProducto, cliente, cantidad, fechaEntrega,
          selStock, peso, precioKg, desperdicio, horas, minutos, potenciaW,
          precioKwh, valorHora, horasTrabajoPersonal, precioImpresora,
          vidaUtilHoras, mantenimientoMes, horasUsoMensual, margen, envio, comision,
        });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [
    open, destino, nombreProducto, cliente, cantidad, fechaEntrega,
    selStock, peso, precioKg, desperdicio, horas, minutos, potenciaW,
    precioKwh, valorHora, horasTrabajoPersonal, precioImpresora,
    vidaUtilHoras, mantenimientoMes, horasUsoMensual, margen, envio, comision,
  ]);

  useEffect(() => {
    if (!selStock) return;
    const s = stock.find((x) => x.id === selStock);
    if (s) setPrecioKg(s.precioKg || 0);
  }, [selStock]);

  const horasTotales = Number(horas || 0) + Number(minutos || 0) / 60;
  const costoMaterial = (Number(peso) / 1000) * Number(precioKg || 0) * (1 + Number(desperdicio || 0) / 100);
  const costoElectricidad = horasTotales * (Number(potenciaW || 0) / 1000) * Number(precioKwh || 0);
  const costoManoObra = Number(horasTrabajoPersonal || 0) * Number(valorHora || 0);
  const amortPorHora = Number(vidaUtilHoras) > 0 ? Number(precioImpresora || 0) / Number(vidaUtilHoras) : 0;
  const mantPorHora = Number(horasUsoMensual) > 0 ? Number(mantenimientoMes || 0) / Number(horasUsoMensual) : 0;
  const costoAmortizacion = (amortPorHora + mantPorHora) * horasTotales;

  const subtotal = costoMaterial + costoElectricidad + costoManoObra + costoAmortizacion;
  const minimo = subtotal + Number(envio || 0);
  const conMargen = minimo * (1 + Number(margen || 0) / 100);
  const recomendado = Number(comision) < 100 ? conMargen / (1 - Number(comision || 0) / 100) : conMargen;
  const premium = recomendado * 1.2;

  const pct = (v) => (subtotal > 0 ? Math.round((v / subtotal) * 100) : 0);

  const enviarAProducto = () => {
    if (!addProduct) return;
    addProduct({
      nombre: nombreProducto || "Producto sin nombre",
      costo: Math.round(subtotal),
      precioUnitario: Math.round(recomendado),
      notas: "Generado desde la calculadora",
      fechaCreacion: todayISO(),
      mayoristaTiers: defaultTiers(),
    });
    setEnviado(true);
    setTimeout(() => setEnviado(false), 2500);
  };

  const enviarAPedido = () => {
    if (!addOrder) return;
    addOrder({
      cliente,
      producto: nombreProducto || "Pieza personalizada",
      cantidad: Number(cantidad) || 1,
      precioTotal: Math.round(recomendado * (Number(cantidad) || 1)),
      fechaEntrega,
      estado: "pendiente",
      notas: "Generado desde la calculadora",
    });
    setEnviado(true);
    setTimeout(() => setEnviado(false), 2500);
  };

  return (
    <div className="section">
      <div className="section-head">
        <h2>Calculadora de precios</h2>
      </div>

      <div className="calc-grid">
        <div className="accordion-stack">
          <AccordionSection icon={Tags} color="accent" title="Material" subtitle="Filamento y desperdicio" open={open.material} onToggle={() => toggle("material")}>
            <label>
              Filamento del stock (opcional)
              <select value={selStock} onChange={(e) => setSelStock(e.target.value)}>
                <option value="">— completar precio manualmente —</option>
                {stock.map((s) => (
                  <option key={s.id} value={s.id}>{s.material} {s.color} ({formatARS(s.precioKg)}/kg)</option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>Peso pieza (g)<input type="number" min="0" value={peso} onChange={(e) => setPeso(e.target.value)} /></label>
              <label>Precio filamento (ARS/kg)<input type="number" min="0" value={precioKg} onChange={(e) => setPrecioKg(e.target.value)} /></label>
            </div>
            <Slider label="Desperdicio / fallos" value={desperdicio} onChange={setDesperdicio} max={40} />
          </AccordionSection>

          <AccordionSection icon={Zap} color="teal" title="Electricidad y tiempo" subtitle="Consumo de la Hi Combo" open={open.electricidad} onToggle={() => toggle("electricidad")}>
            <div className="form-row">
              <label>Horas<input type="number" min="0" value={horas} onChange={(e) => setHoras(e.target.value)} /></label>
              <label>Minutos<input type="number" min="0" max="59" value={minutos} onChange={(e) => setMinutos(e.target.value)} /></label>
            </div>
            <div className="form-row">
              <label>Potencia impresora (W)<input type="number" min="0" value={potenciaW} onChange={(e) => setPotenciaW(e.target.value)} /></label>
              <label>Precio kWh (ARS)<input type="number" min="0" value={precioKwh} onChange={(e) => setPrecioKwh(e.target.value)} /></label>
            </div>
            <div className="form-row">
              <label>Tu valor/hora (ARS)<input type="number" min="0" value={valorHora} onChange={(e) => setValorHora(e.target.value)} /></label>
              <label>Horas de trabajo personal<input type="number" min="0" step="0.1" value={horasTrabajoPersonal} onChange={(e) => setHorasTrabajoPersonal(e.target.value)} /></label>
            </div>
          </AccordionSection>

          <AccordionSection icon={Gauge} color="violet" title="Amortización de impresora" subtitle="Creality Hi Combo" open={open.amortizacion} onToggle={() => toggle("amortizacion")}>
            <div className="form-row">
              <label>Precio de la impresora (ARS)<input type="number" min="0" value={precioImpresora} onChange={(e) => setPrecioImpresora(e.target.value)} /></label>
              <label>Vida útil estimada (h)<input type="number" min="1" value={vidaUtilHoras} onChange={(e) => setVidaUtilHoras(e.target.value)} /></label>
            </div>
            <div className="form-row">
              <label>Mantenimiento / mes (ARS)<input type="number" min="0" value={mantenimientoMes} onChange={(e) => setMantenimientoMes(e.target.value)} /></label>
              <label>Horas de uso mensuales<input type="number" min="1" value={horasUsoMensual} onChange={(e) => setHorasUsoMensual(e.target.value)} /></label>
            </div>
            <p className="hint">💡 Se divide el precio de la impresora entre su vida útil, más el mantenimiento proporcional por hora de uso.</p>
          </AccordionSection>

          <AccordionSection icon={Wallet} color="success" title="Margen de ganancia" subtitle="Envío y comisiones" open={open.margen} onToggle={() => toggle("margen")}>
            <label>
              Margen deseado (%)
              <input type="number" min="0" value={margen} onChange={(e) => setMargen(e.target.value)} placeholder="Ej: 40" />
            </label>
            <div className="form-row">
              <label>Gastos de envío (ARS)<input type="number" min="0" value={envio} onChange={(e) => setEnvio(e.target.value)} /></label>
              <label>Comisión plataforma (%)<input type="number" min="0" max="90" value={comision} onChange={(e) => setComision(e.target.value)} /></label>
            </div>
          </AccordionSection>
        </div>

        <div className="panel breakdown sticky">
          <h3>Resultado del cálculo</h3>
          <p className="total-label">Costo total de producción</p>
          <p className="total-value mono">{formatARS(subtotal)}</p>

          <div className="pct-bars">
            <div className="pct-row"><span>Material</span><div className="pct-track"><div className="pct-fill accent" style={{ width: `${pct(costoMaterial)}%` }} /></div><span className="mono">{pct(costoMaterial)}%</span></div>
            <div className="pct-row"><span>Electricidad</span><div className="pct-track"><div className="pct-fill teal" style={{ width: `${pct(costoElectricidad)}%` }} /></div><span className="mono">{pct(costoElectricidad)}%</span></div>
            <div className="pct-row"><span>Amortización</span><div className="pct-track"><div className="pct-fill violet" style={{ width: `${pct(costoAmortizacion)}%` }} /></div><span className="mono">{pct(costoAmortizacion)}%</span></div>
            <div className="pct-row"><span>Mano de obra</span><div className="pct-track"><div className="pct-fill success" style={{ width: `${pct(costoManoObra)}%` }} /></div><span className="mono">{pct(costoManoObra)}%</span></div>
          </div>

          <div className="breakdown-row"><span>Material</span><span className="mono">{formatARS(costoMaterial)}</span></div>
          <div className="breakdown-row"><span>Electricidad</span><span className="mono">{formatARS(costoElectricidad)}</span></div>
          <div className="breakdown-row"><span>Amortización</span><span className="mono">{formatARS(costoAmortizacion)}</span></div>
          <div className="breakdown-row"><span>Mano de obra</span><span className="mono">{formatARS(costoManoObra)}</span></div>
          <div className="breakdown-row"><span>Envío</span><span className="mono">{formatARS(envio)}</span></div>

          <div className="price-levels">
            <div className="level"><span>Mínimo</span><strong className="mono">{formatARS(minimo)}</strong></div>
            <div className="level rec"><span>Recomendado</span><strong className="mono">{formatARS(recomendado)}</strong></div>
            <div className="level"><span>Premium</span><strong className="mono">{formatARS(premium)}</strong></div>
          </div>

          <div className="send-to-product">
            <div className="destino-toggle">
              <button type="button" className={destino === "producto" ? "active" : ""} onClick={() => setDestino("producto")}>
                <Tags size={13} /> Agregar producto
              </button>
              <button type="button" className={destino === "pedido" ? "active" : ""} onClick={() => setDestino("pedido")}>
                <Package size={13} /> Agregar pedido
              </button>
            </div>

            <input
              placeholder={destino === "producto" ? "Nombre del producto" : "Nombre de la pieza / pedido"}
              value={nombreProducto}
              onChange={(e) => setNombreProducto(e.target.value)}
            />

            {destino === "pedido" && (
              <div className="form-row" style={{ marginTop: 4 }}>
                <label>
                  Cliente
                  <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre, o vacío si es feria" />
                </label>
                <label>
                  Cantidad
                  <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                </label>
                <label>
                  Entrega
                  <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} />
                </label>
              </div>
            )}

            {destino === "producto" ? (
              <button className="btn-accent" onClick={enviarAProducto} type="button">
                <Tags size={14} /> Enviar a Productos
              </button>
            ) : (
              <button className="btn-accent" onClick={enviarAPedido} type="button">
                <Package size={14} /> Crear pedido ({formatARS(recomendado * (Number(cantidad) || 1))})
              </button>
            )}
            {enviado && <p className="sent-note">✓ {destino === "producto" ? "Agregado al catálogo" : "Pedido creado"} con precio recomendado.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================= IDEAS =============================
const IDEAS_CATEGORIAS = [
  {
    id: "llaveros",
    titulo: "Llaveros personalizados",
    icon: "🔑",
    color: "accent",
    descripcion: "Con nombre, iniciales o logo. Rápidos de imprimir, casi no gastan filamento y tienen un margen enorme — son el producto de entrada típico en ferias.",
    tags: ["Personalización", "Rotación alta", "Bajo costo"],
    buscar: "llavero personalizado",
  },
  {
    id: "macetas",
    titulo: "Macetas y organizadores geométricos",
    icon: "🪴",
    color: "success",
    descripcion: "Diseños geométricos con textura visible (vasos/spiralize) que quedan prolijos sin pintar. Buen ticket promedio para venta por Instagram.",
    tags: ["Decohogar", "Buen ticket", "Sin pintar"],
    buscar: "planter geometric vase mode",
  },
  {
    id: "gaming",
    titulo: "Accesorios gamer y soportes",
    icon: "🎮",
    color: "teal",
    descripcion: "Soportes de celular/joystick, organizadores de cables, bases para auriculares. Público que valora funcionalidad y paga bien por diseño prolijo.",
    tags: ["Funcional", "Público joven", "Recurrente"],
    buscar: "gaming accessory stand holder",
  },
  {
    id: "flexis",
    titulo: "Animales articulados (flexis)",
    icon: "🐉",
    color: "violet",
    descripcion: "Dragones, pulpos y animales que se imprimen en una sola pieza sin soportes y ya salen articulados. Muy vistosos para mostrador y redes.",
    tags: ["Efecto wow", "Sin soportes", "Foto fácil"],
    buscar: "flexi articulated print in place",
  },
  {
    id: "mates",
    titulo: "Accesorios de mate y cocina",
    icon: "🧉",
    color: "warning",
    descripcion: "Bases, yerberas, dosificadores. Fuerte tirón local en Argentina — buscá específicamente en español para más variedad regional.",
    tags: ["Mercado local", "Regalería", "Recurrente"],
    buscar: "mate yerbera base",
  },
  {
    id: "escarapelas",
    titulo: "Escarapelas y souvenirs patrios",
    icon: "🎖️",
    color: "teal",
    descripcion: "Fechas patrias argentinas (25 de Mayo, 9 de Julio) mueven mucho volumen en escuelas. Conviene tener el diseño listo con anticipación.",
    tags: ["Estacional", "Volumen alto", "Escuelas"],
    buscar: "escarapela argentina",
  },
  {
    id: "regalos",
    titulo: "Regalos personalizados con nombre",
    icon: "🎁",
    color: "accent",
    descripcion: "Cajitas, portarretratos, lámparas con nombre o fecha grabada. Ideal para cumpleaños, día de la madre/padre — alta disposición a pagar.",
    tags: ["Alta disposición a pagar", "Fechas especiales"],
    buscar: "personalized gift box name",
  },
];

function enlacesBusqueda(query) {
  const q = encodeURIComponent(query);
  return [
    { nombre: "Printables", url: `https://www.printables.com/search/models?q=${q}` },
    { nombre: "Cults3D", url: `https://cults3d.com/en/search?q=${q}` },
    { nombre: "Thingiverse", url: `https://www.thingiverse.com/search?q=${q}` },
    { nombre: "MakerWorld", url: `https://makerworld.com/en/search/models?keyword=${q}` },
  ];
}

function Ideas() {
  return (
    <div className="section">
      <div className="section-head">
        <h2>Ideas de diseños</h2>
      </div>
      <p className="ideas-intro">
        Categorías que suelen andar bien para un taller como el tuyo (llaveros, ferias, regalería). Cada tarjeta te lleva
        con un clic a la búsqueda en vivo de esa categoría en las librerías más grandes de STL — así siempre ves lo más
        reciente, en vez de un link fijo que puede quedar viejo.
      </p>

      <div className="ideas-grid">
        {IDEAS_CATEGORIAS.map((cat) => (
          <div key={cat.id} className={`idea-card tone-chip-${cat.color}`}>
            <div className="idea-card-top">
              <span className="idea-emoji">{cat.icon}</span>
              <h3>{cat.titulo}</h3>
            </div>
            <p className="idea-desc">{cat.descripcion}</p>
            <div className="idea-tags">
              {cat.tags.map((t) => (
                <span key={t} className="idea-tag">{t}</span>
              ))}
            </div>
            <div className="idea-links">
              {enlacesBusqueda(cat.buscar).map((l) => (
                <a key={l.nombre} href={l.url} target="_blank" rel="noopener noreferrer" className="idea-link">
                  {l.nombre} <ExternalLink size={11} />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="ideas-footnote">
        No podemos incrustar acá las fotos de diseños de otros creadores (son de su autoría), por eso te llevamos directo
        a la búsqueda para que elijas vos el archivo y revises la licencia de cada uno antes de imprimir para vender.
      </p>
    </div>
  );
}

// ============================= GENERADOR DE POSTS =============================
function loadImg(src) {
  return new Promise((resolve, reject) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const FORMATOS_POST = {
  post: { w: 1080, h: 1080, label: "Post cuadrado" },
  story: { w: 1080, h: 1920, label: "Historia / Reel" },
  mercadolibre: { w: 1200, h: 1200, label: "Mercado Libre" },
  facebook: { w: 1200, h: 630, label: "Facebook" },
  banner: { w: 1200, h: 400, label: "Banner" },
  flyer: { w: 1080, h: 1527, label: "Flyer A4" },
};

const ETIQUETAS_POST = [
  { id: "", label: "Sin etiqueta" },
  { id: "nuevo", label: "Nuevo" },
  { id: "oferta", label: "Oferta" },
  { id: "top", label: "Más vendido" },
  { id: "limitada", label: "Edición limitada" },
  { id: "navidad", label: "Navidad 🎄" },
  { id: "diapadre", label: "Día del Padre" },
  { id: "diamadre", label: "Día de la Madre" },
  { id: "sanvalentin", label: "San Valentín 💕" },
];

const MARCOS_POST = [
  { id: "ninguno", label: "Sin marco" },
  { id: "fino", label: "Fino" },
  { id: "grueso", label: "Grueso" },
  { id: "punteado", label: "Punteado" },
];

const MARCA = { bordo: "#7A1930", bordoSuave: "#A83A54", texto: "#1A1A1A", fondo: "#F7F5F3" };

function dibujarIconoInstagram(ctx, cx, cy, size) {
  const s = size;
  ctx.save();
  ctx.translate(cx - s / 2, cy - s / 2);
  ctx.strokeStyle = MARCA.bordo;
  ctx.lineWidth = s * 0.08;
  roundRectPath(ctx, 0, 0, s, s, s * 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s * 0.24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.78, s * 0.22, s * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = MARCA.bordo;
  ctx.fill();
  ctx.restore();
}

function dibujarIconoWhatsapp(ctx, cx, cy, size) {
  const s = size;
  ctx.save();
  ctx.translate(cx - s / 2, cy - s / 2);
  ctx.fillStyle = MARCA.bordo;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = MARCA.fondo;
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.arc(s / 2, s / 2 - s * 0.03, s * 0.28, Math.PI * 0.22, Math.PI * 1.55);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(s * 0.36, s * 0.62);
  ctx.lineTo(s * 0.3, s * 0.78);
  ctx.lineTo(s * 0.46, s * 0.72);
  ctx.closePath();
  ctx.fillStyle = MARCA.fondo;
  ctx.fill();
  ctx.restore();
}

function dibujarEtiqueta(ctx, texto, x, y, colorFondo) {
  ctx.save();
  ctx.font = "700 26px 'IBM Plex Sans', sans-serif";
  const padding = 18;
  const anchoTexto = ctx.measureText(texto).width;
  const anchoBox = anchoTexto + padding * 2;
  const altoBox = 46;
  roundRectPath(ctx, x, y, anchoBox, altoBox, altoBox / 2);
  ctx.fillStyle = colorFondo;
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.fillText(texto, x + padding, y + altoBox / 2 + 9);
  ctx.restore();
  return anchoBox;
}

function dibujarMarco(ctx, x, y, size, marcoId, color) {
  if (marcoId === "ninguno") return;
  ctx.save();
  ctx.strokeStyle = color;
  if (marcoId === "fino") ctx.lineWidth = 4;
  else if (marcoId === "grueso") ctx.lineWidth = 14;
  else if (marcoId === "punteado") {
    ctx.lineWidth = 6;
    ctx.setLineDash([16, 12]);
  }
  roundRectPath(ctx, x, y, size, size, 18);
  ctx.stroke();
  ctx.restore();
}

async function dibujarPost(canvas, { fotoSrc, nombre, precioLabel, precio, extra, colorAccent, marco, etiqueta }, formatoKey) {
  const { w, h } = FORMATOS_POST[formatoKey];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const bordo = colorAccent || MARCA.bordo;
  const bordoSuave = colorAccent ? colorAccent : MARCA.bordoSuave;
  const etiquetaInfo = ETIQUETAS_POST.find((e) => e.id === etiqueta);

  ctx.fillStyle = MARCA.fondo;
  ctx.fillRect(0, 0, w, h);

  const esLandscape = w / h > 1.4;
  const fotoImg = await loadImg(fotoSrc);

  if (esLandscape) {
    const photoSize = h * 0.82;
    const photoX = h * 0.09;
    const photoY = h * 0.09;

    ctx.save();
    roundRectPath(ctx, photoX, photoY, photoSize, photoSize, 16);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.clip();
    if (fotoImg) {
      const ratio = Math.max(photoSize / fotoImg.width, photoSize / fotoImg.height);
      const iw = fotoImg.width * ratio;
      const ih = fotoImg.height * ratio;
      ctx.drawImage(fotoImg, photoX + (photoSize - iw) / 2, photoY + (photoSize - ih) / 2, iw, ih);
    }
    ctx.restore();
    dibujarMarco(ctx, photoX, photoY, photoSize, marco, bordo);

    const textX = photoX + photoSize + h * 0.08;
    let ty = h * 0.32;
    ctx.textAlign = "left";
    ctx.fillStyle = bordo;
    let fontSize = 56;
    ctx.font = `800 ${fontSize}px 'Space Grotesk', sans-serif`;
    const maxAncho = w - textX - h * 0.06;
    const nombreUpper = nombre.toUpperCase();
    while (ctx.measureText(nombreUpper).width > maxAncho && fontSize > 28) {
      fontSize -= 3;
      ctx.font = `800 ${fontSize}px 'Space Grotesk', sans-serif`;
    }
    ctx.fillText(nombreUpper, textX, ty);
    ty += fontSize * 0.9;
    ctx.font = "600 24px 'IBM Plex Sans', sans-serif";
    ctx.fillStyle = MARCA.texto;
    ctx.fillText(extra || "IMPRESIÓN 3D PERSONALIZADA", textX, ty);
    ty += 60;
    ctx.font = `800 54px 'Space Grotesk', sans-serif`;
    ctx.fillStyle = bordo;
    ctx.fillText(precio, textX, ty);

    if (etiquetaInfo && etiquetaInfo.id) {
      dibujarEtiqueta(ctx, etiquetaInfo.label, textX, h * 0.12, bordo);
    }

    ctx.font = "600 20px 'IBM Plex Sans', sans-serif";
    ctx.fillStyle = MARCA.texto;
    ctx.fillText(`@${CONTACTO.instagram} · ${CONTACTO.whatsapp}`, textX, h - h * 0.1);
    return;
  }

  const padX = w * 0.09;
  const esAlto = h / w > 1.3;
  let y = h * (esAlto ? 0.13 : 0.1);

  ctx.textAlign = "center";
  ctx.fillStyle = bordo;
  let fontSize = esAlto ? 96 : 84;
  ctx.font = `800 ${fontSize}px 'Space Grotesk', sans-serif`;
  const nombreUpper = nombre.toUpperCase();
  while (ctx.measureText(nombreUpper).width > w - padX * 2 && fontSize > 40) {
    fontSize -= 4;
    ctx.font = `800 ${fontSize}px 'Space Grotesk', sans-serif`;
  }
  const palabras = nombreUpper.split(" ");
  let lineas = [nombreUpper];
  if (ctx.measureText(nombreUpper).width > w - padX * 2) {
    let l1 = "", l2 = "";
    palabras.forEach((p) => {
      if (ctx.measureText((l1 + " " + p).trim()).width < w - padX * 2 && !l2) l1 = (l1 + " " + p).trim();
      else l2 = (l2 + " " + p).trim();
    });
    lineas = l2 ? [l1, l2] : [l1];
  }
  lineas.forEach((linea, i) => {
    ctx.fillText(linea, w / 2, y + i * (fontSize * 1.08));
  });
  y += lineas.length * (fontSize * 1.08) + (esAlto ? 50 : 36);

  ctx.font = `600 ${esAlto ? 40 : 34}px 'IBM Plex Sans', sans-serif`;
  ctx.fillStyle = MARCA.texto;
  ctx.fillText(extra || "IMPRESIÓN 3D PERSONALIZADA", w / 2, y);
  y += esAlto ? 70 : 60;

  const photoSize = Math.min(w * 0.82, (h - y) * 0.55);
  const photoX = (w - photoSize) / 2;
  const photoY = y;

  if (etiquetaInfo && etiquetaInfo.id) {
    dibujarEtiqueta(ctx, etiquetaInfo.label, photoX, photoY - 14, bordo);
  }

  ctx.save();
  roundRectPath(ctx, photoX, photoY, photoSize, photoSize, 18);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.clip();
  if (fotoImg) {
    const ratio = Math.max(photoSize / fotoImg.width, photoSize / fotoImg.height);
    const iw = fotoImg.width * ratio;
    const ih = fotoImg.height * ratio;
    ctx.drawImage(fotoImg, photoX + (photoSize - iw) / 2, photoY + (photoSize - ih) / 2, iw, ih);
  } else {
    ctx.fillStyle = "#B7B0AC";
    ctx.font = "600 36px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Sin foto", photoX + photoSize / 2, photoY + photoSize / 2);
  }
  ctx.restore();
  dibujarMarco(ctx, photoX, photoY, photoSize, marco, bordo);

  let y2 = photoY + photoSize + 70;
  ctx.textAlign = "center";
  ctx.font = `600 ${esAlto ? 32 : 28}px 'IBM Plex Sans', sans-serif`;
  ctx.fillStyle = bordoSuave;
  ctx.fillText(precioLabel, w / 2, y2);
  y2 += esAlto ? 76 : 66;
  ctx.font = `800 ${esAlto ? 84 : 72}px 'Space Grotesk', sans-serif`;
  ctx.fillStyle = bordo;
  ctx.fillText(precio, w / 2, y2);

  const footerY = h - h * 0.055;
  const iconSize = esAlto ? 46 : 40;
  const gap = 16;
  ctx.font = `700 ${esAlto ? 34 : 30}px 'IBM Plex Sans', sans-serif`;
  const textoIG = `@${CONTACTO.instagram}`;
  const textoWA = CONTACTO.whatsapp;
  const anchoIG = ctx.measureText(textoIG).width;
  const anchoWA = ctx.measureText(textoWA).width;

  const bloqueIG = iconSize + gap + anchoIG;
  const bloqueWA = iconSize + gap + anchoWA;
  const separacion = 60;
  const totalAncho = bloqueIG + separacion + bloqueWA;
  let cursorX = (w - totalAncho) / 2;

  dibujarIconoInstagram(ctx, cursorX + iconSize / 2, footerY, iconSize);
  cursorX += iconSize + gap;
  ctx.textAlign = "left";
  ctx.fillStyle = MARCA.texto;
  ctx.fillText(textoIG, cursorX, footerY + 10);
  cursorX += anchoIG + separacion;

  dibujarIconoWhatsapp(ctx, cursorX + iconSize / 2, footerY, iconSize);
  cursorX += iconSize + gap;
  ctx.fillText(textoWA, cursorX, footerY + 10);
}

function PostGenerator({ products }) {
  const [productoId, setProductoId] = useState("");
  const [formato, setFormato] = useState("post");
  const [precioTipo, setPrecioTipo] = useState("unitario");
  const [nombreManual, setNombreManual] = useState("");
  const [precioManual, setPrecioManual] = useState("");
  const [fotoManual, setFotoManual] = useState("");
  const [extraTexto, setExtraTexto] = useState("");
  const [colorAccent, setColorAccent] = useState("#7A1930");
  const [marco, setMarco] = useState("ninguno");
  const [etiqueta, setEtiqueta] = useState("");
  const [formatoArchivo, setFormatoArchivo] = useState("png");
  const canvasRef = useRef(null);
  const [descargando, setDescargando] = useState(false);

  const producto = products.find((p) => p.id === productoId);
  const tiersHabilitados = producto ? (producto.mayoristaTiers || []).filter((t) => t.habilitado && t.precio !== "") : [];

  const nombre = producto ? producto.nombre : nombreManual || "Tu producto";
  const fotoSrc = producto ? producto.foto : fotoManual;

  let precioNum = 0;
  let precioLabel = "Precio unitario";
  if (producto) {
    if (precioTipo === "unitario") {
      precioNum = Number(producto.precioUnitario) || 0;
      precioLabel = "Precio unitario";
    } else {
      const tier = tiersHabilitados.find((t) => String(t.cantidad) === precioTipo);
      precioNum = tier ? Number(tier.precio) || 0 : 0;
      precioLabel = tier ? `Por mayor · x${tier.cantidad}` : "Precio unitario";
    }
  } else {
    precioNum = Number(precioManual) || 0;
  }

  const onFotoManual = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const comprimida = await compressImage(file, 900, 0.8);
      setFotoManual(comprimida);
    } catch (err) {
      console.error("No se pudo procesar la imagen", err);
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    dibujarPost(
      canvasRef.current,
      { fotoSrc, nombre, precioLabel, precio: formatARS(precioNum), extra: extraTexto, colorAccent, marco, etiqueta },
      formato
    );
  }, [fotoSrc, nombre, precioLabel, precioNum, extraTexto, formato, colorAccent, marco, etiqueta]);

  const descargar = async () => {
    setDescargando(true);
    try {
      const mime = formatoArchivo === "jpg" ? "image/jpeg" : "image/png";
      const ext = formatoArchivo === "jpg" ? "jpg" : "png";
      canvasRef.current.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `tinsky-post-${nombre.replace(/\s+/g, "-").toLowerCase()}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setDescargando(false);
      }, mime, 0.92);
    } catch (e) {
      console.error(e);
      setDescargando(false);
    }
  };

  const aspectRatio = FORMATOS_POST[formato].w / FORMATOS_POST[formato].h;

  return (
    <div className="section">
      <div className="section-head">
        <h2>Generador de posts</h2>
      </div>
      <p className="ideas-intro">
        Elegí un producto del catálogo (o cargá uno manual) y armá una imagen lista para redes, con tu foto,
        precio y marca. Elegí formato, color, marco y etiqueta.
      </p>

      <div className="post-generator-grid">
        <div className="form-card no-grid">
          <label>
            Producto del catálogo
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
              <option value="">— cargar manualmente —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>

          {!producto && (
            <>
              <div className="form-row">
                <label>
                  Nombre
                  <input value={nombreManual} onChange={(e) => setNombreManual(e.target.value)} placeholder="Ej: Llavero personalizado" />
                </label>
                <label>
                  Precio
                  <input type="number" min="0" value={precioManual} onChange={(e) => setPrecioManual(e.target.value)} placeholder="ARS" />
                </label>
              </div>
              <div className="foto-uploader">
                {fotoManual ? (
                  <img src={fotoManual} alt="preview" className="foto-preview" />
                ) : (
                  <div className="foto-placeholder"><ImagePlus size={20} /></div>
                )}
                <label className="foto-label">
                  Foto
                  <input type="file" accept="image/*" onChange={onFotoManual} />
                </label>
                <QuitarFondoBoton foto={fotoManual} onResult={setFotoManual} />
              </div>
            </>
          )}

          {producto && tiersHabilitados.length > 0 && (
            <label>
              Precio a mostrar
              <select value={precioTipo} onChange={(e) => setPrecioTipo(e.target.value)}>
                <option value="unitario">Unitario — {formatARS(producto.precioUnitario)}</option>
                {tiersHabilitados.map((t) => (
                  <option key={t.cantidad} value={String(t.cantidad)}>x{t.cantidad} — {formatARS(t.precio)} c/u</option>
                ))}
              </select>
            </label>
          )}

          <label>
            Texto extra (opcional)
            <input value={extraTexto} onChange={(e) => setExtraTexto(e.target.value)} placeholder="Ej: Envíos a todo el país" />
          </label>

          <label>
            <Square size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />Formato
            <select value={formato} onChange={(e) => setFormato(e.target.value)}>
              {Object.entries(FORMATOS_POST).map(([key, f]) => (
                <option key={key} value={key}>{f.label} ({f.w}×{f.h})</option>
              ))}
            </select>
          </label>

          <div className="form-row">
            <label>
              <Tag size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />Etiqueta
              <select value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)}>
                {ETIQUETAS_POST.map((et) => (
                  <option key={et.id} value={et.id}>{et.label}</option>
                ))}
              </select>
            </label>
            <label>
              <Frame size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />Marco
              <select value={marco} onChange={(e) => setMarco(e.target.value)}>
                {MARCOS_POST.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            <label style={{ maxWidth: 90 }}>
              <Palette size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />Color
              <input type="color" value={colorAccent} onChange={(e) => setColorAccent(e.target.value)} />
            </label>
          </div>

          <div className="destino-toggle">
            <button type="button" className={formatoArchivo === "png" ? "active" : ""} onClick={() => setFormatoArchivo("png")}>PNG</button>
            <button type="button" className={formatoArchivo === "jpg" ? "active" : ""} onClick={() => setFormatoArchivo("jpg")}>JPG</button>
          </div>

          <button className="btn-accent" onClick={descargar} disabled={descargando}>
            <Download size={16} /> {descargando ? "Generando…" : `Descargar ${formatoArchivo.toUpperCase()}`}
          </button>
        </div>

        <div className="post-preview-wrap">
          <canvas ref={canvasRef} className="post-canvas" style={{ aspectRatio: `${aspectRatio}` }} />
        </div>
      </div>
    </div>
  );
}


const CSS = `
:root {
  --bg: #F3F5F9;
  --paper: #FFFFFF;
  --ink: #12151C;
  --ink-soft: #5B6472;
  --line: #E1E4EA;
  --accent: #E63946;
  --accent-soft: #FBDADD;
  --teal: #2F6FED;
  --teal-soft: #DCE7FF;
  --violet: #1F4FC4;
  --violet-soft: #DEE7FA;
  --success: #1F9D55;
  --success-soft: #DFF5E7;
  --warning: #E8A93B;
  --warning-soft: #FCEFC7;
  --danger: #E63946;
  --danger-soft: #FBDADD;
  --radius: 14px;
  --shadow: 0 1px 2px rgba(18,21,28,0.04), 0 6px 20px rgba(18,21,28,0.06);
}

.tinsky-root {
  font-family: 'IBM Plex Sans', sans-serif;
  color: var(--ink);
  background: var(--bg);
  min-height: 100vh;
  box-sizing: border-box;
}
.tinsky-root * { box-sizing: border-box; }

.shell { display: flex; min-height: 100vh; }

.sidebar {
  width: 232px;
  flex-shrink: 0;
  background: var(--paper);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  padding: 18px 14px;
  gap: 20px;
}
.sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 0 6px; }
.brand-logo-img {
  width: 46px;
  height: 46px;
  object-fit: contain;
  flex-shrink: 0;
}
.sidebar-brand p { margin: 0; font-size: 11px; font-weight: 600; color: var(--ink-soft); }

.sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  background: none;
  color: var(--ink-soft);
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 10px;
  text-align: left;
  transition: all 0.15s ease;
}
.sidebar-item:hover { background: var(--bg); color: var(--ink); }
.sidebar-item.active {
  background: var(--accent);
  color: white;
  font-weight: 600;
  box-shadow: var(--shadow);
}

.sidebar-footer { display: flex; gap: 8px; padding: 0 6px; }
.theme-toggle {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  cursor: pointer;
}
.theme-toggle:hover { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }

.main-area { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 18px 26px;
  border-bottom: 1px solid var(--line);
}
.topbar h2 { margin: 0; font-family: 'Space Grotesk', sans-serif; font-size: 20px; }
.topbar-meta {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--ink-soft);
  font-family: 'JetBrains Mono', monospace;
}
.topbar-meta .dot { opacity: 0.5; }

.content { flex: 1; padding: 22px 26px; max-width: 1100px; }
.loading { color: var(--ink-soft); font-style: italic; padding: 40px 0; }

@media (max-width: 860px) {
  .shell { flex-direction: column; }
  .sidebar {
    width: 100%;
    flex-direction: row;
    align-items: center;
    padding: 10px 12px;
    gap: 12px;
  }
  .sidebar-brand p { display: none; }
  .sidebar-nav {
    flex-direction: row;
    overflow-x: auto;
    flex: 1;
  }
  .sidebar-item { flex-direction: column; gap: 2px; padding: 6px 10px; font-size: 10px; white-space: nowrap; }
  .sidebar-footer { flex-shrink: 0; }
  .content { padding: 16px; }
  .topbar { padding: 14px 16px; }
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.section-head h2 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 20px;
  margin: 0;
}

.btn-accent {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--accent);
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: filter 0.15s, transform 0.1s;
}
.btn-accent:hover { filter: brightness(0.94); }
.btn-accent:active { transform: scale(0.98); }

.btn-mini {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--ink);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.icon-btn {
  background: none;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 6px;
  color: var(--ink-soft);
  cursor: pointer;
  display: flex;
}
.icon-btn:hover { color: var(--danger); border-color: var(--danger); }
.icon-btn.corner { position: absolute; top: 10px; right: 10px; border: none; }

.form-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  border-left: 4px solid var(--accent);
  padding: 18px;
  margin-bottom: 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form-row { display: flex; gap: 12px; flex-wrap: wrap; }
.form-row label, label.full { flex: 1; min-width: 140px; display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-soft); font-weight: 500; }
.form-card input, .form-card select {
  font-family: 'IBM Plex Sans', sans-serif;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
}
.form-actions { display: flex; justify-content: flex-end; }

.list { display: flex; flex-direction: column; gap: 8px; }
.row-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  position: relative;
  box-shadow: var(--shadow);
}
.row-card.done { opacity: 0.6; }
.row-title { font-weight: 600; margin: 0; font-size: 14px; }
.row-title .dim { color: var(--ink-soft); font-weight: 400; }
.row-sub { margin: 2px 0 0; font-size: 12px; color: var(--ink-soft); }
.row-notes { margin: 4px 0 0; font-size: 12px; font-style: italic; color: var(--ink-soft); }
.row-side { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.mono { font-family: 'JetBrains Mono', monospace; }
.price { font-weight: 600; }

.badge, .badge-select {
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: 999px;
  border: none;
  cursor: pointer;
}
.tone-warning { background: var(--warning-soft); color: var(--warning); }
.tone-teal { background: var(--teal-soft); color: var(--teal); }
.tone-accent { background: var(--accent-soft); color: var(--accent); }
.tone-success { background: var(--success-soft); color: var(--success); }
.tone-danger { background: var(--danger-soft); color: var(--danger); }

.empty-note { color: var(--ink-soft); font-style: italic; font-size: 13px; }

.cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.stat-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  border-top: 3px solid var(--ink);
  padding: 16px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  box-shadow: var(--shadow);
}
.stat-card.tone-accent { border-top-color: var(--accent); color: var(--accent); }
.stat-card.tone-teal { border-top-color: var(--teal); color: var(--teal); }
.stat-card.tone-success { border-top-color: var(--success); color: var(--success); }
.stat-card.tone-danger { border-top-color: var(--danger); color: var(--danger); }
.stat-label { margin: 0; font-size: 11px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { margin: 2px 0 0; font-size: 22px; font-weight: 700; color: var(--ink); font-family: 'Space Grotesk', sans-serif; }
.stat-value.mono { font-family: 'JetBrains Mono', monospace; font-size: 18px; }

.panel { background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px; margin-bottom: 16px; }
.panel h3 { margin: 0 0 12px; font-family: 'Space Grotesk', sans-serif; font-size: 15px; }

.signature-panel { border-left: 4px solid var(--accent); }
.print-viz { display: flex; gap: 24px; align-items: center; }
.bed {
  position: relative;
  width: 90px;
  height: 120px;
  border: 2px solid var(--ink);
  border-radius: 10px;
  background: repeating-linear-gradient(0deg, var(--bg), var(--bg) 7px, var(--line) 7px, var(--line) 8px);
  overflow: hidden;
  flex-shrink: 0;
}
.bed-fill {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  background: var(--accent-soft);
  border-top: 2px solid var(--accent);
  transition: height 0.4s ease;
  display: flex;
  flex-direction: column-reverse;
}
.layer-line { height: 6px; border-top: 1px solid rgba(255,106,19,0.35); }
.bed-label {
  position: absolute; top: 4px; left: 0; right: 0;
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 700;
}
.job-name { font-weight: 700; margin: 0; }
.job-client, .job-time { margin: 2px 0 0; font-size: 12px; color: var(--ink-soft); }

.alert-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.alert-list li { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--danger); }

.spool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.spool-card {
  position: relative;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  display: flex;
  gap: 12px;
}
.spool-card.low { border-color: var(--danger); }
.spool-gauge { position: relative; width: 44px; height: 44px; flex-shrink: 0; }
.spool-gauge svg { width: 44px; height: 44px; transform: rotate(-90deg); }
.gauge-track { fill: none; stroke: var(--line); stroke-width: 5; }
.gauge-fill { fill: none; stroke: var(--accent); stroke-width: 5; stroke-linecap: round; transition: stroke-dasharray 0.3s; }
.gauge-pct {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
}
.spool-info { flex: 1; }
.low-flag { color: var(--danger); font-size: 11px; display: flex; align-items: center; gap: 4px; margin: 4px 0; font-weight: 600; }
.consumo-row { display: flex; gap: 6px; margin-top: 8px; }
.consumo-row input { width: 80px; padding: 5px 8px; border: 1px solid var(--line); font-size: 12px; }

.mini-bar { height: 5px; background: var(--line); margin-top: 6px; width: 200px; max-width: 100%; }
.mini-bar-fill { height: 100%; background: var(--teal); transition: width 0.4s; }

.completed-details { margin-top: 16px; color: var(--ink-soft); }
.completed-details summary { cursor: pointer; font-size: 13px; font-weight: 600; }
.completed-details .list { margin-top: 10px; }

.calc-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 16px; align-items: start; }

.accordion-stack { display: flex; flex-direction: column; gap: 10px; }
.accordion {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.accordion-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}
.accordion-titles { flex: 1; display: flex; flex-direction: column; }
.accordion-title { font-weight: 600; font-size: 14px; color: var(--ink); font-family: 'Space Grotesk', sans-serif; }
.accordion-subtitle { font-size: 11px; color: var(--ink-soft); }
.chev { color: var(--ink-soft); transition: transform 0.2s; flex-shrink: 0; }
.chev.open { transform: rotate(180deg); }
.accordion-body { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 12px; }
.accordion-body label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-soft); font-weight: 500; flex: 1; min-width: 120px; }
.accordion-body input, .accordion-body select {
  font-family: 'IBM Plex Sans', sans-serif;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
}
.accordion-body .hint { font-size: 11px; color: var(--ink-soft); margin: 0; background: var(--bg); padding: 8px 10px; border-radius: 8px; }

.chip {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px;
  border-radius: 10px;
  flex-shrink: 0;
}
.tone-chip-accent .chip { background: var(--accent-soft); color: var(--accent); }
.tone-chip-teal .chip { background: var(--teal-soft); color: var(--teal); }
.tone-chip-violet .chip { background: var(--violet-soft); color: var(--violet); }
.tone-chip-success .chip { background: var(--success-soft); color: var(--success); }

.slider-field { display: flex; flex-direction: column; gap: 6px; }
.slider-top { display: flex; justify-content: space-between; font-size: 12px; color: var(--ink-soft); font-weight: 500; }
.slider-value { color: var(--ink); font-weight: 700; }
.slider-field input[type="range"] {
  -webkit-appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--line);
  outline: none;
}
.slider-field input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--accent);
  border: 3px solid white;
  box-shadow: var(--shadow);
  cursor: pointer;
}
.slider-field input[type="range"]::-moz-range-thumb {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: var(--accent);
  border: 3px solid white;
  box-shadow: var(--shadow);
  cursor: pointer;
}

.breakdown.sticky { position: sticky; top: 16px; }
.total-label { margin: 0; font-size: 12px; color: var(--ink-soft); }
.total-value { margin: 2px 0 16px; font-size: 26px; font-weight: 700; color: var(--accent); }

.pct-bars { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.pct-row { display: grid; grid-template-columns: 90px 1fr 34px; align-items: center; gap: 8px; font-size: 11px; color: var(--ink-soft); }
.pct-track { height: 6px; background: var(--bg); border-radius: 999px; overflow: hidden; }
.pct-fill { height: 100%; border-radius: 999px; }
.pct-fill.accent { background: var(--accent); }
.pct-fill.teal { background: var(--teal); }
.pct-fill.violet { background: var(--violet); }
.pct-fill.success { background: var(--success); }

.breakdown-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.breakdown-row.subtotal { font-weight: 600; border-bottom: 1px solid var(--ink); }

.price-levels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
.level {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 10px;
  border-radius: 10px;
  background: var(--bg);
  text-align: center;
}
.level span { font-size: 10px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.5px; }
.level strong { font-size: 14px; }
.level.rec { background: var(--accent-soft); }
.level.rec strong { color: var(--accent); font-size: 16px; }

.send-to-product { margin-top: 18px; padding-top: 16px; border-top: 1px dashed var(--line); display: flex; flex-direction: column; gap: 8px; }
.send-to-product input {
  font-family: 'IBM Plex Sans', sans-serif;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
}
.sent-note { margin: 0; font-size: 12px; color: var(--success); font-weight: 600; }

.product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.product-card {
  position: relative;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}
.product-photo {
  width: 100%;
  height: 130px;
  object-fit: cover;
  border-radius: 10px;
  margin-bottom: 10px;
  background: var(--bg);
}
.product-photo.placeholder {
  display: flex; align-items: center; justify-content: center;
  color: var(--ink-soft);
  border: 1px dashed var(--line);
}
.foto-uploader {
  display: flex;
  align-items: center;
  gap: 12px;
}
.foto-preview {
  width: 64px; height: 64px;
  object-fit: cover;
  border-radius: 10px;
  flex-shrink: 0;
}
.foto-placeholder {
  width: 64px; height: 64px;
  border-radius: 10px;
  border: 1px dashed var(--line);
  display: flex; align-items: center; justify-content: center;
  color: var(--ink-soft);
  flex-shrink: 0;
}
.foto-label {
  display: flex; flex-direction: column; gap: 4px;
  font-size: 12px; color: var(--ink-soft); font-weight: 500;
}
.foto-label input { font-size: 12px; }
.price-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 12px; }
.price-cell {
  display: flex; flex-direction: column; gap: 2px;
  padding: 8px 6px;
  border-radius: 8px;
  background: var(--bg);
  text-align: center;
}
.price-cell span { font-size: 9px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.5px; }
.price-cell strong { font-size: 13px; }
.price-cell em { font-style: normal; font-size: 10px; font-weight: 700; }
.price-cell.highlight { background: var(--accent-soft); }
.price-cell.highlight strong { color: var(--accent); }
.price-cell.highlight.teal { background: var(--teal-soft); }
.price-cell.highlight.teal strong { color: var(--teal); }
.price-cell em.up { color: var(--success); }
.price-cell em.down { color: var(--danger); }

.section-head-actions { display: flex; gap: 8px; }
.btn-secondary {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--paper);
  color: var(--ink);
  border: 1px solid var(--line);
  padding: 10px 16px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  box-shadow: var(--shadow);
}
.btn-secondary:hover { border-color: var(--accent); color: var(--accent); }

.printers-manager { border-left-color: var(--violet); }
.mini-heading { margin: 0 0 8px; font-size: 12px; font-weight: 600; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.5px; }
.printer-chip-list { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.printer-chip {
  display: flex; align-items: center; gap: 6px;
  background: var(--violet-soft); color: var(--violet);
  padding: 6px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 600;
}
.printer-chip button { background: none; border: none; color: inherit; cursor: pointer; display: flex; opacity: 0.7; }
.printer-chip button:hover { opacity: 1; }

.printers-status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.printer-status-card { border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: var(--bg); }
.printer-name { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; font-weight: 600; font-size: 13px; }

.inline-badge { margin-left: 8px; }

.destino-toggle { display: flex; gap: 6px; margin-bottom: 4px; }
.destino-toggle button {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 10px;
  border-radius: 9px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.destino-toggle button.active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}

.row-card.wrap { flex-direction: column; align-items: stretch; gap: 10px; }
.row-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
.pago-inline {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--bg);
  border-radius: 10px;
  padding: 12px;
}
.pago-inline label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-soft); font-weight: 500; }
.pago-inline input, .pago-inline select {
  font-family: 'IBM Plex Sans', sans-serif;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  color: var(--ink);
  font-size: 13px;
}

.badge.tone-violet { background: var(--violet-soft); color: var(--violet); }

.order-select {
  padding: 9px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink);
  font-size: 12px;
  font-weight: 600;
}

.balance-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.balance-cell {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px;
  border-radius: 10px;
  background: var(--bg);
}
.balance-cell span { font-size: 11px; color: var(--ink-soft); }
.balance-cell strong { font-size: 16px; }
.balance-cell.up strong { color: var(--success); }
.balance-cell.up { background: var(--success-soft); }

.venta-montos { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.venta-montos .ganancia { font-size: 11px; color: var(--success); font-weight: 600; }

.product-card-actions { position: absolute; top: 10px; right: 10px; display: flex; gap: 4px; }
.venta-inline {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--line);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.venta-inline label { display: flex; flex-direction: column; gap: 4px; font-size: 11px; color: var(--ink-soft); font-weight: 500; flex: 1; }
.venta-inline input, .venta-inline select {
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  color: var(--ink);
  font-size: 12px;
}
.btn-mini.full-width { width: 100%; justify-content: center; margin-top: 10px; }

.cost-line { margin: 8px 0 0; font-size: 12px; color: var(--ink-soft); }
.cost-line .mono { color: var(--ink); font-weight: 600; }

.price-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.price-pill {
  display: flex; align-items: baseline; gap: 5px;
  background: var(--teal-soft);
  color: var(--teal);
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 11px;
}
.price-pill.main { background: var(--accent-soft); color: var(--accent); }
.price-pill strong { color: var(--ink); font-size: 12px; }
.price-pill em { font-style: normal; font-size: 10px; font-weight: 700; }
.price-pill em.up { color: var(--success); }
.price-pill em.down { color: var(--danger); }

.top-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  background: var(--warning);
  color: #14181D;
  font-size: 10px;
  font-weight: 700;
  padding: 4px 9px;
  border-radius: 999px;
  z-index: 1;
}
.tier-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--bg);
  flex-wrap: wrap;
}
.tier-row.on { border-color: var(--accent); background: var(--accent-soft); }
.tier-check { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink); min-width: 46px; }
.tier-check input { width: 16px; height: 16px; accent-color: var(--accent); }
.tier-price-input {
  width: 110px;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  color: var(--ink);
  font-size: 12px;
}
.tier-hint {
  font-size: 11px;
  color: var(--teal);
  background: var(--teal-soft);
  border: none;
  padding: 5px 9px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
}
.tier-hint:hover { filter: brightness(0.95); }

.tiers-display { margin-top: 12px; }
.tiers-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.tier-chip {
  display: flex; align-items: baseline; gap: 5px;
  background: var(--teal-soft);
  color: var(--teal);
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
}
.tier-chip strong { color: var(--ink); font-size: 12px; }
.tier-chip em { font-style: normal; font-size: 10px; font-weight: 700; }
.tier-chip em.up { color: var(--success); }
.tier-chip em.down { color: var(--danger); }

.presupuesto-items { display: flex; flex-direction: column; gap: 8px; }
.presupuesto-item-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.presupuesto-item-row .item-desc {
  flex: 1;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
}
.presupuesto-item-row .item-monto {
  width: 130px;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
}
.presupuesto-total-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: var(--accent-soft);
  border-radius: 10px;
  font-weight: 700;
}
.presupuesto-total-preview strong { color: var(--accent); font-size: 16px; }

.presupuesto-items-preview {
  list-style: none;
  margin: 4px 0 0;
  padding: 10px 0 0;
  border-top: 1px dashed var(--line);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.presupuesto-items-preview li { display: flex; justify-content: space-between; font-size: 12px; color: var(--ink-soft); }
.presupuesto-items-preview li .mono { color: var(--ink); }

.resumen-split {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 16px;
  align-items: start;
  margin-bottom: 16px;
}
.resumen-split .panel { margin-bottom: 0; }

.ranking-panel h3 { display: flex; align-items: center; gap: 6px; }
.ranking-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.ranking-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 10px;
}
.ranking-row:nth-child(odd) { background: var(--bg); }
.ranking-pos {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ranking-info { flex: 1; min-width: 0; }
.ranking-name { margin: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ranking-units { margin: 2px 0 0; font-size: 11px; color: var(--ink-soft); }
.ranking-total { font-size: 13px; font-weight: 700; color: var(--success); white-space: nowrap; }

.current-month-label { margin: 2px 0 0; font-size: 12px; color: var(--ink-soft); }

.venta-mes-group { margin-bottom: 22px; }
.venta-mes-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 6px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--line);
}
.venta-mes-header h3 {
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  text-transform: capitalize;
  color: var(--ink-soft);
}
.venta-mes-subtotal { font-size: 13px; font-weight: 700; color: var(--ink); }

.ideas-intro { color: var(--ink-soft); font-size: 13px; margin: 0 0 16px; max-width: 780px; }
.ideas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.idea-card {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.idea-card-top { display: flex; align-items: center; gap: 8px; }
.idea-emoji { font-size: 22px; }
.idea-card-top h3 { margin: 0; font-size: 14px; font-family: 'Space Grotesk', sans-serif; }
.idea-desc { margin: 0; font-size: 12px; color: var(--ink-soft); line-height: 1.5; }
.idea-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.idea-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--bg);
  color: var(--ink-soft);
}
.idea-links { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.idea-link {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  text-decoration: none;
}
.idea-link:hover { filter: brightness(0.95); }
.ideas-footnote { margin-top: 18px; font-size: 11px; color: var(--ink-soft); max-width: 780px; }

.post-generator-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
.post-preview-wrap {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 16px;
}
.post-canvas {
  width: 100%;
  max-width: 420px;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  display: block;
}
.post-canvas.story { max-width: 260px; aspect-ratio: 9 / 16; }

.produccion-panel { border-left: 4px solid var(--violet); }
.produccion-panel h3 { display: flex; align-items: center; gap: 6px; }
.produccion-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
.prod-cell {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px;
  border-radius: 10px;
  background: var(--bg);
}
.prod-cell span { font-size: 11px; color: var(--ink-soft); }
.prod-cell strong { font-size: 18px; font-family: 'Space Grotesk', sans-serif; }
.prod-cell.danger { background: var(--danger-soft); }
.prod-cell.danger strong { color: var(--danger); }

.mini-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 16px; }
.mini-stat {
  display: flex; flex-direction: column; gap: 4px;
  padding: 14px;
  border-radius: 12px;
  background: var(--paper);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
}
.mini-stat span { font-size: 11px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.4px; }
.mini-stat strong { font-size: 15px; color: var(--ink); }

.recomendaciones-panel { border-left: 4px solid var(--warning); margin-bottom: 16px; }
.recomendaciones-panel h3 { display: flex; align-items: center; gap: 6px; }
.recomendaciones-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.recomendaciones-list li { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: var(--ink); line-height: 1.5; }
.recomendaciones-list li svg { flex-shrink: 0; margin-top: 2px; color: var(--warning); }

.asistente-panel {
  display: flex;
  flex-direction: column;
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  height: 520px;
}
.asistente-chat {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.chat-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.5;
}
.chat-bubble.asistente { align-self: flex-start; background: var(--bg); color: var(--ink); border-bottom-left-radius: 4px; }
.chat-bubble.usuario { align-self: flex-end; background: var(--accent); color: white; border-bottom-right-radius: 4px; }
.asistente-sugerencias {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px 16px;
  border-top: 1px solid var(--line);
}
.sugerencia-chip {
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink-soft);
  cursor: pointer;
  font-weight: 500;
}
.sugerencia-chip:hover { border-color: var(--accent); color: var(--accent); }
.asistente-input-row {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
}
.asistente-input-row input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
}
.asistente-input-row .btn-accent { padding: 10px 14px; }

.calendario-config { display: flex; align-items: center; }
.calendario-config label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-soft); font-weight: 500; }
.calendario-config input {
  width: 70px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
}

.calendario-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.calendario-nav h3 { margin: 0; text-transform: capitalize; font-family: 'Space Grotesk', sans-serif; }

.calendario-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.calendario-dow { font-size: 11px; color: var(--ink-soft); text-align: center; padding-bottom: 4px; font-weight: 600; }
.calendario-celda {
  min-height: 84px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--paper);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.calendario-celda.vacia { background: transparent; border: none; }
.calendario-celda.hoy { border-color: var(--accent); }
.calendario-celda.sobrecargada { background: var(--danger-soft); }
.celda-num { font-size: 11px; color: var(--ink-soft); font-weight: 600; }
.celda-pedidos { display: flex; flex-direction: column; gap: 3px; overflow-y: auto; max-height: 60px; }
.pedido-chip {
  font-size: 10px;
  padding: 3px 6px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  cursor: grab;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pedido-chip:active { cursor: grabbing; }

.prediccion-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.prediccion-card {
  padding: 12px;
  border-radius: 10px;
  background: var(--bg);
  border: 1px solid var(--line);
}

.quitar-fondo-panel {
  margin-top: 8px;
  padding: 12px;
  border-radius: 10px;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.quitar-fondo-preview {
  width: 100%;
  max-height: 160px;
  object-fit: contain;
  border-radius: 8px;
  background: repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 16px 16px;
}
.fondo-opciones { display: flex; flex-wrap: wrap; gap: 6px; }
.fondo-opciones button {
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--paper);
  color: var(--ink-soft);
  cursor: pointer;
  font-weight: 600;
}
.fondo-opciones button.active { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }

.heatmap-scroll { overflow-x: auto; padding-bottom: 6px; }
.heatmap-grid { display: flex; gap: 3px; width: max-content; }
.heatmap-col { display: flex; flex-direction: column; gap: 3px; }
.heatmap-celda {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: var(--bg);
}
.heatmap-celda.vacia { background: transparent; }
.heatmap-celda.nivel-0 { background: var(--bg); }
.heatmap-celda.nivel-1 { background: var(--accent-soft); }
.heatmap-celda.nivel-2 { background: color-mix(in srgb, var(--accent) 45%, var(--bg)); }
.heatmap-celda.nivel-3 { background: color-mix(in srgb, var(--accent) 70%, var(--bg)); }
.heatmap-celda.nivel-4 { background: var(--accent); }
.heatmap-leyenda { display: flex; align-items: center; gap: 4px; margin-top: 12px; font-size: 11px; color: var(--ink-soft); }
.heatmap-leyenda .heatmap-celda { width: 11px; height: 11px; }

.ejecutivo-hero { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.hero-cell {
  padding: 20px;
  border-radius: 14px;
  background: var(--paper);
  border: 1px solid var(--line);
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hero-cell span { font-size: 12px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.5px; }
.hero-cell strong { font-size: 24px; font-family: 'Space Grotesk', sans-serif; }
.hero-cell.main { background: var(--accent-soft); border-color: var(--accent); }
.hero-cell.main strong { color: var(--accent); font-size: 30px; }

.ejecutivo-grid { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; margin-bottom: 16px; align-items: start; }

.valor-negocio-panel { border-left: 4px solid var(--violet); }
.multiplicador-label { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-soft); }
.multiplicador-label input {
  width: 70px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  font-size: 13px;
}
.valor-negocio-total { font-size: 34px; font-weight: 700; color: var(--violet); margin: 4px 0 10px; }

@media (max-width: 900px) {
  .ejecutivo-hero { grid-template-columns: 1fr; }
  .ejecutivo-grid { grid-template-columns: 1fr; }
}

@media (max-width: 860px) {
  .post-generator-grid { grid-template-columns: 1fr; }
}

@media (max-width: 720px) {
  .calc-grid { grid-template-columns: 1fr; }
  .breakdown.sticky { position: static; }
  .resumen-split { grid-template-columns: 1fr; }
  .asistente-panel { height: 460px; }
  .calendario-grid { grid-template-columns: repeat(7, minmax(34px, 1fr)); }
  .calendario-celda { min-height: 56px; padding: 3px; }
  .celda-pedidos { max-height: 36px; }
}

.tinsky-root[data-theme="dark"] {
  --bg: #0D1117;
  --paper: #161B26;
  --ink: #ECEFF4;
  --ink-soft: #8B93A7;
  --line: #262E3D;
  --accent: #FF4757;
  --accent-soft: #3A1620;
  --teal: #4C8DFF;
  --teal-soft: #14233F;
  --violet: #2F6FED;
  --violet-soft: #101B33;
  --success: #3DDC84;
  --success-soft: #0F2A1C;
  --warning: #FFC94D;
  --warning-soft: #332A0F;
  --danger: #FF4757;
  --danger-soft: #3A1620;
  --shadow: 0 1px 2px rgba(0,0,0,0.35), 0 8px 24px rgba(0,0,0,0.4);
}
.tinsky-root[data-theme="dark"] .sidebar-item.active { color: #0D1117; }
.tinsky-root[data-theme="dark"] .btn-accent,
.tinsky-root[data-theme="dark"] .btn-mini { color: #0D1117; }
`;
