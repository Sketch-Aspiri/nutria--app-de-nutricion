import React, { useState, useEffect, useRef } from "react";
import {
  Users, ClipboardList, Sparkles, Calendar, LogOut, ChevronLeft, ChevronRight,
  Loader2, Utensils, Plus, CheckCircle2, CreditCard, X, Camera, AlertTriangle,
  Flame, Dumbbell, ChefHat, Share2, FileText, MessageSquarePlus, MessageCircle,
  Calculator, Video, Bell, Receipt, LayoutTemplate, Palette, Mic, Square,
  Download, Search, Send, Check, ShieldCheck,
} from "lucide-react";

/* ========== estilo base ========== */
function useGoogleFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}
const display = { fontFamily: "'Fraunces', serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };

/* ========== IA helper ========== */
const callClaude = async (prompt, maxTokens = 1000) => {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await r.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
};
const parseJSON = (t) => JSON.parse(t.replace(/```json|```/g, "").trim());
const tieneConflicto = (texto, alergias) =>
  alergias && alergias.some((a) => a !== "Ninguna" && (texto || "").toLowerCase().includes(a.toLowerCase()));

/* ========== cálculo nutricional determinístico (Mifflin-St Jeor) ========== */
const FACTOR_ACTIVIDAD = { Sedentario: 1.2, Ligero: 1.375, Moderado: 1.55, Activo: 1.725, "Muy activo": 1.9 };
const AJUSTE_OBJETIVO = {
  "Pérdida de grasa": -0.2, "Ganancia muscular": 0.1, Mantenimiento: 0,
  "Control de diabetes": -0.1, "Mejora deportiva": 0.05, Otro: 0,
};
function calcularTDEE({ peso, altura, edad, genero, nivelActividad, objetivo }) {
  const base = 10 * peso + 6.25 * altura - 5 * edad;
  const bmr = Math.round(genero === "Masculino" ? base + 5 : base - 161);
  const tdee = Math.round(bmr * (FACTOR_ACTIVIDAD[nivelActividad] || 1.55));
  const objetivoCalorias = Math.round(tdee * (1 + (AJUSTE_OBJETIVO[objetivo] || 0)));
  // distribución de macros según objetivo
  let pPct, cPct, gPct;
  if (objetivo === "Ganancia muscular" || objetivo === "Mejora deportiva") { pPct = 0.3; cPct = 0.45; gPct = 0.25; }
  else if (objetivo === "Control de diabetes") { pPct = 0.3; cPct = 0.35; gPct = 0.35; }
  else { pPct = 0.3; cPct = 0.4; gPct = 0.3; }
  return {
    bmr, tdee, objetivoCalorias,
    proteina_g: Math.round((objetivoCalorias * pPct) / 4),
    carbos_g: Math.round((objetivoCalorias * cPct) / 4),
    grasa_g: Math.round((objetivoCalorias * gPct) / 9),
    pPct: Math.round(pPct * 100), cPct: Math.round(cPct * 100), gPct: Math.round(gPct * 100),
  };
}

/* ========== base de alimentos (SMAE simplificada) ========== */
const ALIMENTOS = [
  { cat: "Cereales", nombre: "Tortilla de maíz", porcion: "1 pza (30g)", kcal: 70, prot: 2, carb: 14, gras: 1 },
  { cat: "Cereales", nombre: "Arroz cocido", porcion: "1/2 taza", kcal: 80, prot: 2, carb: 17, gras: 0 },
  { cat: "Cereales", nombre: "Avena", porcion: "1/3 taza", kcal: 75, prot: 3, carb: 13, gras: 1 },
  { cat: "Cereales", nombre: "Pan integral", porcion: "1 reb", kcal: 70, prot: 3, carb: 13, gras: 1 },
  { cat: "Leguminosas", nombre: "Frijol cocido", porcion: "1/2 taza", kcal: 120, prot: 8, carb: 20, gras: 1 },
  { cat: "Leguminosas", nombre: "Lentejas", porcion: "1/2 taza", kcal: 115, prot: 9, carb: 20, gras: 0 },
  { cat: "Proteína", nombre: "Pechuga de pollo", porcion: "40g", kcal: 55, prot: 12, carb: 0, gras: 1 },
  { cat: "Proteína", nombre: "Huevo", porcion: "1 pza", kcal: 75, prot: 6, carb: 0, gras: 5 },
  { cat: "Proteína", nombre: "Atún en agua", porcion: "40g", kcal: 50, prot: 11, carb: 0, gras: 1 },
  { cat: "Proteína", nombre: "Salmón", porcion: "40g", kcal: 80, prot: 10, carb: 0, gras: 4 },
  { cat: "Verduras", nombre: "Nopales", porcion: "1 taza", kcal: 25, prot: 2, carb: 5, gras: 0 },
  { cat: "Verduras", nombre: "Espinaca", porcion: "1 taza", kcal: 20, prot: 2, carb: 3, gras: 0 },
  { cat: "Verduras", nombre: "Jitomate", porcion: "1 pza", kcal: 22, prot: 1, carb: 5, gras: 0 },
  { cat: "Frutas", nombre: "Manzana", porcion: "1 pza", kcal: 60, prot: 0, carb: 15, gras: 0 },
  { cat: "Frutas", nombre: "Plátano", porcion: "1/2 pza", kcal: 60, prot: 1, carb: 15, gras: 0 },
  { cat: "Frutas", nombre: "Fresas", porcion: "1 taza", kcal: 50, prot: 1, carb: 12, gras: 0 },
  { cat: "Grasas", nombre: "Aguacate", porcion: "1/3 pza", kcal: 80, prot: 1, carb: 4, gras: 7 },
  { cat: "Grasas", nombre: "Almendras", porcion: "10 pza", kcal: 70, prot: 3, carb: 3, gras: 6 },
  { cat: "Lácteos", nombre: "Yogurt griego natural", porcion: "1 taza", kcal: 100, prot: 10, carb: 8, gras: 3 },
  { cat: "Lácteos", nombre: "Leche descremada", porcion: "1 taza", kcal: 90, prot: 9, carb: 12, gras: 0 },
];
const CATEGORIAS_ALIMENTO = [...new Set(ALIMENTOS.map((a) => a.cat))];

/* ========== catálogos ========== */
const CONDICIONES = ["Diabetes tipo 1", "Diabetes tipo 2", "Hipertensión", "Hipotiroidismo", "Dislipidemia", "Enfermedad renal", "Ninguna"];
const ALERGIAS_COMUNES = ["Lactosa", "Gluten", "Mariscos", "Frutos secos", "Huevo", "Soya", "Ninguna"];
const TIPOS_DIETA = ["Omnívoro", "Vegetariano", "Vegano", "Keto", "Mediterránea", "Sin gluten"];
const NIVELES_ACTIVIDAD = ["Sedentario", "Ligero", "Moderado", "Activo", "Muy activo"];
const OBJETIVOS = ["Pérdida de grasa", "Ganancia muscular", "Mantenimiento", "Control de diabetes", "Mejora deportiva", "Otro"];

/* ========== datos de ejemplo ========== */
const P1 = {
  id: 1, nombre: "Camila Torres", foto: null, edad: 29, genero: "Femenino", telefono: "55 1234 5678", email: "camila@mail.com",
  medico: { condiciones: ["Ninguna"], antecedentes: "Sin antecedentes relevantes.", medicamentos: "Ninguno", nivelActividad: "Moderado", objetivo: "Pérdida de grasa" },
  antropometria: { peso: 68, altura: 165, cintura: 78, cadera: 98, grasaCorporal: 26, historial: [{ fecha: "May", peso: 72 }, { fecha: "Jun", peso: 70 }, { fecha: "Jul", peso: 68 }] },
  preferencias: { tipoDieta: "Omnívoro", alergias: ["Lactosa"], disgustos: "Brócoli, hígado", comidasPorDia: 4, presupuestoTiempo: "Medio" },
  macros: { proteina: 30, carbos: 40, grasa: 30 }, calculo: null, planActivo: null, planEjercicio: null, notasConsulta: [],
  seguimiento: {
    adherencia: 78, racha: 5,
    comidas: [
      { id: 1, fecha: "Hoy 08:15", nombre: "Avena con fruta y nueces", emoji: "🥣", comentario: "" },
      { id: 2, fecha: "Ayer 14:00", nombre: "Ensalada con pollo a la plancha", emoji: "🥗", comentario: "" },
      { id: 3, fecha: "Ayer 20:30", nombre: "Yogurt con miel", emoji: "🍯", comentario: "" },
    ],
    ejercicio: [{ id: 1, fecha: "Hoy", tipo: "Caminata", duracion: "35 min" }, { id: 2, fecha: "Ayer", tipo: "Fuerza — tren inferior", duracion: "45 min" }],
    recetasEnCurso: [{ id: 1, nombre: "Bowl de quinoa con verduras asadas", frecuencia: "3 veces esta semana" }],
    recetasSugeridas: [],
  },
};
const P2 = {
  id: 2, nombre: "Diego Ramírez", foto: null, edad: 41, genero: "Masculino", telefono: "55 9876 5432", email: "diego@mail.com",
  medico: { condiciones: ["Dislipidemia"], antecedentes: "Colesterol alto diagnosticado en 2024.", medicamentos: "Estatina (noche)", nivelActividad: "Activo", objetivo: "Ganancia muscular" },
  antropometria: { peso: 79, altura: 178, cintura: 88, cadera: 101, grasaCorporal: 18, historial: [{ fecha: "May", peso: 75 }, { fecha: "Jun", peso: 77 }, { fecha: "Jul", peso: 79 }] },
  preferencias: { tipoDieta: "Omnívoro", alergias: ["Mariscos"], disgustos: "Cilantro", comidasPorDia: 5, presupuestoTiempo: "Alto" },
  macros: { proteina: 35, carbos: 45, grasa: 20 }, calculo: null, planActivo: null, planEjercicio: null, notasConsulta: [],
  seguimiento: { adherencia: 41, racha: 0, comidas: [], ejercicio: [], recetasEnCurso: [], recetasSugeridas: [] },
};

const CITAS_INICIALES = [
  { id: 1, pacienteId: 1, paciente: "Camila Torres", fecha: "2026-07-24", hora: "10:00", tipo: "Seguimiento", recordatorio: true },
  { id: 2, pacienteId: 2, paciente: "Diego Ramírez", fecha: "2026-07-25", hora: "17:30", tipo: "Primera consulta", recordatorio: true },
];
const MENSAJES_INICIALES = {
  1: [
    { de: "paciente", texto: "Hola, ¿el yogurt griego puede ser de sabor?", hora: "09:12" },
    { de: "nutriologo", texto: "Mejor natural, el de sabor trae azúcar añadida. Puedes endulzarlo con fruta.", hora: "09:30" },
  ],
  2: [],
};
const FACTURAS_INICIALES = [
  { id: 1, pacienteId: 1, paciente: "Camila Torres", concepto: "Consulta de seguimiento", monto: 600, fecha: "2026-07-10", pagada: true, cfdi: true },
  { id: 2, pacienteId: 2, paciente: "Diego Ramírez", concepto: "Primera consulta + plan", monto: 900, fecha: "2026-07-18", pagada: false, cfdi: false },
];
const PLANTILLAS_INICIALES = [
  { id: 1, nombre: "Déficit moderado — omnívoro", objetivo: "Pérdida de grasa", calorias: 1600, descripcion: "4 comidas, alto en proteína, base de verduras y cereales integrales." },
  { id: 2, nombre: "Volumen limpio — deportista", objetivo: "Ganancia muscular", calorias: 2600, descripcion: "5 comidas, superávit ligero, carbohidratos alrededor del entrenamiento." },
];

/* ========== piezas visuales ========== */
function Avatar({ foto, nombre, size = 56 }) {
  if (foto) return <img src={foto} alt={nombre} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0 border border-stone-200" />;
  const ini = nombre.split(" ").map((n) => n[0]).slice(0, 2).join("");
  return <div style={{ width: size, height: size, fontSize: size * 0.32 }} className="rounded-full bg-emerald-900 text-lime-300 flex items-center justify-center shrink-0 font-medium">{ini}</div>;
}
function AntropometriaChart({ data }) {
  const w = 220, h = 70, pad = 8;
  const pesos = data.map((d) => d.peso);
  const min = Math.min(...pesos) - 1, max = Math.max(...pesos) + 1;
  const pts = data.map((d, i) => [pad + (i / (data.length - 1)) * (w - pad * 2), h - pad - ((d.peso - min) / (max - min || 1)) * (h - pad * 2)]);
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0] + "," + p[1]).join(" ");
  return <svg width={w} height={h}><path d={path} fill="none" stroke="#166534" strokeWidth="2" />{pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="#84cc16" />)}</svg>;
}
function SectionCard({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-stone-400">{Icon && <Icon size={14} />} {title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}
function Chip({ label, active, onClick }) {
  return <button type="button" onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${active ? "bg-emerald-900 text-white border-emerald-900" : "bg-white text-stone-500 border-stone-200 hover:border-emerald-300"}`}>{label}</button>;
}
function Modal({ children, onClose, wide }) {
  return (
    <div className="fixed inset-0 bg-emerald-950/40 flex items-center justify-center z-50 p-4">
      <div className={`bg-stone-50 rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} max-h-[90vh] overflow-auto`}>{children}</div>
    </div>
  );
}
function Btn({ children, onClick, variant = "primary", disabled, size = "md", className = "" }) {
  const base = "inline-flex items-center gap-2 rounded-lg transition-colors disabled:opacity-50 font-medium";
  const sizes = { md: "text-sm px-4 py-2.5", sm: "text-xs px-3 py-2" };
  const variants = {
    primary: "bg-emerald-900 text-white hover:bg-emerald-800",
    ghost: "text-stone-500 hover:bg-stone-100",
    outline: "border border-emerald-800 text-emerald-800 hover:bg-emerald-50",
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>{children}</button>;
}

/* ========== sidebar ========== */
function Sidebar({ view, setView, marca }) {
  const items = [
    { id: "pacientes", label: "Pacientes", icon: Users },
    { id: "agenda", label: "Agenda", icon: Calendar },
    { id: "mensajes", label: "Mensajes", icon: MessageCircle },
    { id: "facturacion", label: "Facturación", icon: Receipt },
    { id: "plantillas", label: "Plantillas", icon: LayoutTemplate },
    { id: "marca", label: "Marca y datos", icon: Palette },
  ];
  const activo = (id) => view === id || (id === "pacientes" && view === "paciente");
  return (
    <div className="w-56 bg-emerald-950 text-stone-100 flex flex-col shrink-0">
      <div className="px-6 py-7">
        <div style={display} className="text-2xl font-medium tracking-tight" >{marca.nombre || "nutria"}</div>
        <div className="text-emerald-400 text-xs mt-1 tracking-wide uppercase">Panel de nutriólogo</div>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {items.map((it) => (
          <button key={it.id} onClick={() => setView(it.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activo(it.id) ? "bg-emerald-900 text-lime-300" : "text-emerald-200 hover:bg-emerald-900/60"}`}>
            <it.icon size={17} /> {it.label}
          </button>
        ))}
      </nav>
      <div className="px-3 pb-5 border-t border-emerald-900 pt-4">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-emerald-300 hover:bg-emerald-900/60"><LogOut size={17} /> Cerrar sesión</button>
      </div>
    </div>
  );
}

/* ========== dashboard pacientes ========== */
function AdherenciaBadge({ s }) {
  if (!s) return null;
  const bajo = s.adherencia < 50;
  return <div className={`flex items-center gap-1 text-[11px] ${bajo ? "text-orange-600" : "text-emerald-700"}`}>{bajo ? <AlertTriangle size={12} /> : <Flame size={12} />}{s.adherencia}% adherencia {s.racha > 0 ? `· racha ${s.racha}d` : ""}</div>;
}
function Dashboard({ pacientes, onSelect, onNuevo }) {
  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div><div style={display} className="text-2xl text-emerald-950 font-medium">Tus pacientes</div><div className="text-stone-500 text-sm mt-1">{pacientes.length} pacientes activos</div></div>
        <Btn onClick={onNuevo}><Plus size={16} /> Nuevo paciente</Btn>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pacientes.map((p) => (
          <button key={p.id} onClick={() => onSelect(p.id)} className="text-left bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4 hover:border-emerald-300 hover:shadow-sm transition-all">
            <Avatar foto={p.foto} nombre={p.nombre} />
            <div className="min-w-0 flex-1"><div className="text-emerald-950 font-medium truncate">{p.nombre}</div><div className="text-stone-500 text-xs mt-0.5">{p.medico.objetivo}</div><AdherenciaBadge s={p.seguimiento} /></div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ========== wizard nuevo paciente ========== */
const FORM_INICIAL = { nombre: "", edad: "", genero: "Femenino", telefono: "", email: "", foto: null, condiciones: [], antecedentes: "", medicamentos: "", nivelActividad: "Moderado", objetivo: "Pérdida de grasa", peso: "", altura: "", cintura: "", cadera: "", grasaCorporal: "", tipoDieta: "Omnívoro", alergias: [], disgustos: "", comidasPorDia: 4, presupuestoTiempo: "Medio" };
function NuevoPacienteWizard({ onClose, onCrear }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(FORM_INICIAL);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleList = (k, val) => setForm((f) => ({ ...f, [k]: f[k].includes(val) ? f[k].filter((x) => x !== val) : [...f[k], val] }));
  const steps = ["Datos generales", "Expediente médico", "Antropometría", "Preferencias alimentarias"];
  const handleFoto = (e) => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => set("foto", r.result); r.readAsDataURL(file); };
  const crear = () => onCrear({
    id: Date.now(), nombre: form.nombre || "Nuevo paciente", foto: form.foto, edad: Number(form.edad) || 0, genero: form.genero, telefono: form.telefono, email: form.email,
    medico: { condiciones: form.condiciones.length ? form.condiciones : ["Ninguna"], antecedentes: form.antecedentes, medicamentos: form.medicamentos, nivelActividad: form.nivelActividad, objetivo: form.objetivo },
    antropometria: { peso: Number(form.peso) || 0, altura: Number(form.altura) || 0, cintura: Number(form.cintura) || 0, cadera: Number(form.cadera) || 0, grasaCorporal: Number(form.grasaCorporal) || 0, historial: [{ fecha: "Hoy", peso: Number(form.peso) || 0 }] },
    preferencias: { tipoDieta: form.tipoDieta, alergias: form.alergias.length ? form.alergias : ["Ninguna"], disgustos: form.disgustos, comidasPorDia: Number(form.comidasPorDia) || 4, presupuestoTiempo: form.presupuestoTiempo },
    macros: { proteina: 30, carbos: 40, grasa: 30 }, calculo: null, planActivo: null, planEjercicio: null, notasConsulta: [],
    seguimiento: { adherencia: 0, racha: 0, comidas: [], ejercicio: [], recetasEnCurso: [], recetasSugeridas: [] },
  });
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400";
  const lbl = "text-xs text-stone-500 mb-1 block";
  return (
    <Modal onClose={onClose}>
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-4"><div style={display} className="text-xl text-emerald-950 font-medium">Nuevo paciente</div><button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button></div>
        <div className="flex gap-1.5 mb-5">{steps.map((s, i) => <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-emerald-800" : "bg-stone-200"}`} />)}</div>
        <div className="text-xs uppercase tracking-wide text-stone-400 mb-4">{steps[step]}</div>
      </div>
      <div className="px-6 space-y-3">
        {step === 0 && <>
          <div className="flex items-center gap-4 mb-2"><Avatar foto={form.foto} nombre={form.nombre || "?"} size={64} />
            <label className="flex items-center gap-2 text-xs text-emerald-800 border border-emerald-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-emerald-50"><Camera size={14} /> Subir foto<input type="file" accept="image/*" className="hidden" onChange={handleFoto} /></label></div>
          <div><label className={lbl}>Nombre completo</label><input className={inp} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej. Ana López" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Edad</label><input type="number" className={inp} value={form.edad} onChange={(e) => set("edad", e.target.value)} /></div>
            <div><label className={lbl}>Género</label><select className={inp} value={form.genero} onChange={(e) => set("genero", e.target.value)}><option>Femenino</option><option>Masculino</option><option>Otro</option></select></div></div>
          <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Teléfono</label><input className={inp} value={form.telefono} onChange={(e) => set("telefono", e.target.value)} /></div>
            <div><label className={lbl}>Email</label><input className={inp} value={form.email} onChange={(e) => set("email", e.target.value)} /></div></div>
        </>}
        {step === 1 && <>
          <div><label className={lbl}>Condiciones médicas</label><div className="flex flex-wrap gap-2">{CONDICIONES.map((c) => <Chip key={c} label={c} active={form.condiciones.includes(c)} onClick={() => toggleList("condiciones", c)} />)}</div></div>
          <div><label className={lbl}>Antecedentes relevantes</label><textarea rows={2} className={inp} value={form.antecedentes} onChange={(e) => set("antecedentes", e.target.value)} /></div>
          <div><label className={lbl}>Medicamentos actuales</label><input className={inp} value={form.medicamentos} onChange={(e) => set("medicamentos", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Nivel de actividad</label><select className={inp} value={form.nivelActividad} onChange={(e) => set("nivelActividad", e.target.value)}>{NIVELES_ACTIVIDAD.map((n) => <option key={n}>{n}</option>)}</select></div>
            <div><label className={lbl}>Objetivo</label><select className={inp} value={form.objetivo} onChange={(e) => set("objetivo", e.target.value)}>{OBJETIVOS.map((o) => <option key={o}>{o}</option>)}</select></div></div>
        </>}
        {step === 2 && <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Peso (kg)</label><input type="number" className={inp} value={form.peso} onChange={(e) => set("peso", e.target.value)} /></div>
          <div><label className={lbl}>Altura (cm)</label><input type="number" className={inp} value={form.altura} onChange={(e) => set("altura", e.target.value)} /></div>
          <div><label className={lbl}>Cintura (cm)</label><input type="number" className={inp} value={form.cintura} onChange={(e) => set("cintura", e.target.value)} /></div>
          <div><label className={lbl}>Cadera (cm)</label><input type="number" className={inp} value={form.cadera} onChange={(e) => set("cadera", e.target.value)} /></div>
          <div><label className={lbl}>% grasa (opcional)</label><input type="number" className={inp} value={form.grasaCorporal} onChange={(e) => set("grasaCorporal", e.target.value)} /></div>
        </div>}
        {step === 3 && <>
          <div><label className={lbl}>Tipo de dieta</label><div className="flex flex-wrap gap-2">{TIPOS_DIETA.map((t) => <Chip key={t} label={t} active={form.tipoDieta === t} onClick={() => set("tipoDieta", t)} />)}</div></div>
          <div><label className={lbl}>Alergias / intolerancias</label><div className="flex flex-wrap gap-2">{ALERGIAS_COMUNES.map((a) => <Chip key={a} label={a} active={form.alergias.includes(a)} onClick={() => toggleList("alergias", a)} />)}</div></div>
          <div><label className={lbl}>Alimentos que no le gustan</label><input className={inp} value={form.disgustos} onChange={(e) => set("disgustos", e.target.value)} placeholder="Ej. cilantro, hígado" /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className={lbl}>Comidas al día</label><input type="number" className={inp} value={form.comidasPorDia} onChange={(e) => set("comidasPorDia", e.target.value)} /></div>
            <div><label className={lbl}>Tiempo para cocinar</label><select className={inp} value={form.presupuestoTiempo} onChange={(e) => set("presupuestoTiempo", e.target.value)}><option>Bajo</option><option>Medio</option><option>Alto</option></select></div></div>
        </>}
      </div>
      <div className="flex justify-between p-6 pt-5">
        <Btn variant="ghost" onClick={() => (step === 0 ? onClose() : setStep(step - 1))}>{step === 0 ? "Cancelar" : "Atrás"}</Btn>
        {step < steps.length - 1 ? <Btn onClick={() => setStep(step + 1)}>Siguiente <ChevronRight size={15} /></Btn> : <Btn onClick={crear}>Crear paciente</Btn>}
      </div>
    </Modal>
  );
}

/* ========== tab: expediente + grabación IA ========== */
const TRANSCRIPT_DEMO = "Paciente refiere que ha bajado dos kilos desde la última cita. Comenta que le cuesta desayunar por las mañanas por falta de tiempo. Duerme alrededor de seis horas. Tiene antojos de dulce por la tarde. Menciona que empezó a caminar tres veces por semana. Sin cambios en medicamentos.";
function TabExpediente({ paciente, updatePatient }) {
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(false);
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [transcript, setTranscript] = useState("");
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);
  const iniciarGrabacion = () => { setGrabando(true); setSegundos(0); setTranscript(""); timer.current = setInterval(() => setSegundos((s) => s + 1), 1000); };
  const detenerGrabacion = () => { setGrabando(false); clearInterval(timer.current); setTranscript(TRANSCRIPT_DEMO); };
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const procesar = async (texto) => {
    if (!texto.trim()) return;
    setLoading(true);
    try {
      const prompt = `Eres un asistente clínico para nutriólogos. Convierte estas notas/transcripción de consulta en un resumen clínico estructurado. Responde solo con JSON: {"motivo": string, "hallazgos": string, "plan": string, "seguimiento": string}.
Paciente: ${paciente.nombre}, objetivo: ${paciente.medico.objetivo}. Texto: ${texto}`;
      const parsed = parseJSON(await callClaude(prompt, 500));
      updatePatient(paciente.id, (p) => ({ notasConsulta: [{ fecha: new Date().toLocaleDateString("es-MX"), ...parsed }, ...p.notasConsulta] }));
      setNota(""); setTranscript("");
    } catch { updatePatient(paciente.id, (p) => ({ notasConsulta: [{ fecha: new Date().toLocaleDateString("es-MX"), motivo: "Nota libre", hallazgos: texto, plan: "—", seguimiento: "—" }, ...p.notasConsulta] })); setNota(""); setTranscript(""); }
    finally { setLoading(false); }
  };

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <SectionCard title="Datos generales" icon={ClipboardList}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-stone-400">Género</span><span className="text-emerald-950 font-medium">{paciente.genero}</span></div>
          <div className="flex justify-between"><span className="text-stone-400">Teléfono</span><span className="text-emerald-950 font-medium">{paciente.telefono || "—"}</span></div>
          <div className="flex justify-between"><span className="text-stone-400">Email</span><span className="text-emerald-950 font-medium">{paciente.email || "—"}</span></div>
        </div>
      </SectionCard>
      <SectionCard title="Expediente médico" icon={FileText}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-stone-400">Condiciones</span><span className="text-emerald-950 font-medium text-right">{paciente.medico.condiciones.join(", ")}</span></div>
          <div className="flex justify-between"><span className="text-stone-400">Medicamentos</span><span className="text-emerald-950 font-medium">{paciente.medico.medicamentos || "—"}</span></div>
          <div className="flex justify-between"><span className="text-stone-400">Nivel de actividad</span><span className="text-emerald-950 font-medium">{paciente.medico.nivelActividad}</span></div>
          {paciente.medico.antecedentes && <div className="text-stone-500 text-xs pt-1 border-t border-stone-100">{paciente.medico.antecedentes}</div>}
        </div>
      </SectionCard>
      <SectionCard title="Antropometría" icon={Sparkles}>
        <div className="flex items-center justify-between">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="text-stone-400">Peso</div><div className="text-emerald-950 font-medium">{paciente.antropometria.peso} kg</div>
            <div className="text-stone-400">Altura</div><div className="text-emerald-950 font-medium">{paciente.antropometria.altura} cm</div>
            <div className="text-stone-400">Cintura</div><div className="text-emerald-950 font-medium">{paciente.antropometria.cintura || "—"} cm</div>
            <div className="text-stone-400">% grasa</div><div className="text-emerald-950 font-medium">{paciente.antropometria.grasaCorporal || "—"}%</div>
          </div>
          <AntropometriaChart data={paciente.antropometria.historial} />
        </div>
      </SectionCard>
      <SectionCard title="Preferencias alimentarias" icon={Utensils}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-stone-400">Tipo de dieta</span><span className="text-emerald-950 font-medium">{paciente.preferencias.tipoDieta}</span></div>
          <div className="flex justify-between"><span className="text-stone-400">Alergias</span><span className="text-emerald-950 font-medium">{paciente.preferencias.alergias.join(", ")}</span></div>
          <div className="flex justify-between"><span className="text-stone-400">No le gusta</span><span className="text-emerald-950 font-medium">{paciente.preferencias.disgustos || "—"}</span></div>
          <div className="flex justify-between"><span className="text-stone-400">Comidas al día</span><span className="text-emerald-950 font-medium">{paciente.preferencias.comidasPorDia}</span></div>
        </div>
      </SectionCard>

      <div className="sm:col-span-2">
        <SectionCard title="Grabar consulta y transcribir con IA" icon={Mic}>
          <div className="flex items-center gap-3">
            {!grabando ? <Btn onClick={iniciarGrabacion} size="sm"><Mic size={14} /> Grabar consulta</Btn>
              : <Btn onClick={detenerGrabacion} size="sm" className="!bg-orange-600 hover:!bg-orange-500"><Square size={13} /> Detener</Btn>}
            {grabando && <div className="flex items-center gap-2 text-sm text-orange-600"><span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> Grabando {fmt(segundos)}</div>}
          </div>
          {transcript && <>
            <div className="text-xs text-stone-400 mt-3 mb-1">Transcripción (editable)</div>
            <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} className="w-full border border-stone-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-emerald-400" rows={3} />
            <Btn onClick={() => procesar(transcript)} disabled={loading} size="sm" className="mt-2">{loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Convertir en nota clínica</Btn>
          </>}
        </SectionCard>
      </div>

      <div className="sm:col-span-2">
        <SectionCard title="Notas de consulta" icon={MessageSquarePlus}>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Escribe notas rápidas y la IA las convierte en resumen clínico estructurado..." className="w-full border border-stone-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-emerald-400" rows={2} />
          <Btn onClick={() => procesar(nota)} disabled={loading || !nota.trim()} size="sm" className="mt-2">{loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Generar resumen con IA</Btn>
          {paciente.notasConsulta.length > 0 && <div className="mt-4 space-y-3">{paciente.notasConsulta.map((n, i) => (
            <div key={i} className="border-t border-stone-100 pt-3 text-sm"><div className="text-xs text-stone-400 mb-1">{n.fecha}</div>
              <div><span className="text-stone-500">Motivo: </span>{n.motivo}</div><div><span className="text-stone-500">Hallazgos: </span>{n.hallazgos}</div>
              <div><span className="text-stone-500">Plan: </span>{n.plan}</div><div><span className="text-stone-500">Seguimiento: </span>{n.seguimiento}</div></div>
          ))}</div>}
        </SectionCard>
      </div>
    </div>
  );
}

/* ========== tab: cálculo nutricional (TDEE) ========== */
function TabCalculo({ paciente, updatePatient }) {
  const a = paciente.antropometria, m = paciente.medico;
  const [res, setRes] = useState(paciente.calculo);
  const calcular = () => {
    const c = calcularTDEE({ peso: a.peso, altura: a.altura, edad: paciente.edad, genero: paciente.genero, nivelActividad: m.nivelActividad, objetivo: m.objetivo });
    setRes(c);
    updatePatient(paciente.id, { calculo: c });
  };
  return (
    <div className="space-y-4 max-w-2xl">
      <SectionCard title="Gasto energético — Mifflin-St Jeor" icon={Calculator}>
        <p className="text-sm text-stone-500 mb-3">Cálculo determinístico a partir del expediente. No es una estimación de la IA — es una fórmula clínica que puedes defender ante el paciente.</p>
        <div className="grid grid-cols-3 gap-3 text-sm mb-4">
          <div className="bg-stone-50 rounded-lg p-3"><div className="text-stone-400 text-xs">Peso</div><div className="text-emerald-950 font-medium">{a.peso} kg</div></div>
          <div className="bg-stone-50 rounded-lg p-3"><div className="text-stone-400 text-xs">Altura</div><div className="text-emerald-950 font-medium">{a.altura} cm</div></div>
          <div className="bg-stone-50 rounded-lg p-3"><div className="text-stone-400 text-xs">Edad</div><div className="text-emerald-950 font-medium">{paciente.edad} años</div></div>
          <div className="bg-stone-50 rounded-lg p-3"><div className="text-stone-400 text-xs">Actividad</div><div className="text-emerald-950 font-medium">{m.nivelActividad}</div></div>
          <div className="bg-stone-50 rounded-lg p-3 col-span-2"><div className="text-stone-400 text-xs">Objetivo</div><div className="text-emerald-950 font-medium">{m.objetivo}</div></div>
        </div>
        <Btn onClick={calcular}><Calculator size={16} /> Calcular requerimiento</Btn>
      </SectionCard>

      {res && <SectionCard title="Resultado" icon={Flame}>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div><div style={mono} className="text-xl text-stone-500">{res.bmr}</div><div className="text-xs text-stone-400">BMR (kcal)</div></div>
          <div><div style={mono} className="text-xl text-stone-500">{res.tdee}</div><div className="text-xs text-stone-400">TDEE / mantenimiento</div></div>
          <div><div style={mono} className="text-2xl text-emerald-900">{res.objetivoCalorias}</div><div className="text-xs text-stone-400">Objetivo diario</div></div>
        </div>
        <div className="text-xs uppercase tracking-wide text-stone-400 mb-2">Distribución de macros</div>
        <div className="flex gap-4">
          <div className="flex-1 bg-lime-50 border border-lime-200 rounded-lg p-3"><div style={mono} className="text-emerald-900 text-lg">{res.proteina_g}g</div><div className="text-xs text-stone-500">Proteína · {res.pPct}%</div></div>
          <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-lg p-3"><div style={mono} className="text-emerald-900 text-lg">{res.carbos_g}g</div><div className="text-xs text-stone-500">Carbos · {res.cPct}%</div></div>
          <div className="flex-1 bg-orange-50 border border-orange-200 rounded-lg p-3"><div style={mono} className="text-orange-700 text-lg">{res.grasa_g}g</div><div className="text-xs text-stone-500">Grasa · {res.gPct}%</div></div>
        </div>
        <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mt-4 flex items-center gap-2"><CheckCircle2 size={13} /> Estos valores se usan como meta al generar el plan alimenticio.</div>
      </SectionCard>}
    </div>
  );
}

/* ========== base de alimentos (buscador dentro del plan) ========== */
function FoodPicker({ onAdd, onClose }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todas");
  const filtrados = ALIMENTOS.filter((a) => (cat === "Todas" || a.cat === cat) && a.nombre.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4"><div style={display} className="text-lg text-emerald-950 font-medium">Base de alimentos y equivalencias</div><button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button></div>
        <div className="flex items-center gap-2 border border-stone-200 rounded-lg px-3 py-2 mb-3"><Search size={15} className="text-stone-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alimento..." className="text-sm flex-1 focus:outline-none" /></div>
        <div className="flex flex-wrap gap-2 mb-4"><Chip label="Todas" active={cat === "Todas"} onClick={() => setCat("Todas")} />{CATEGORIAS_ALIMENTO.map((c) => <Chip key={c} label={c} active={cat === c} onClick={() => setCat(c)} />)}</div>
        <div className="max-h-72 overflow-auto divide-y divide-stone-100">
          {filtrados.map((a, i) => (
            <div key={i} className="flex items-center justify-between py-2.5">
              <div><div className="text-sm text-emerald-950">{a.nombre}</div><div className="text-xs text-stone-400">{a.porcion} · {a.cat}</div></div>
              <div className="flex items-center gap-3">
                <div style={mono} className="text-xs text-stone-400">{a.kcal} kcal · P{a.prot} C{a.carb} G{a.gras}</div>
                <button onClick={() => onAdd(a)} className="text-emerald-800 hover:bg-emerald-50 rounded-lg p-1.5"><Plus size={16} /></button>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && <div className="text-sm text-stone-400 py-6 text-center">Sin resultados.</div>}
        </div>
      </div>
    </Modal>
  );
}

/* ========== vista previa PDF con marca ========== */
function PdfPreview({ paciente, plan, marca, onClose }) {
  return (
    <Modal onClose={onClose} wide>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div style={display} className="text-lg text-emerald-950 font-medium">Vista previa · plan con tu marca</div>
          <div className="flex items-center gap-2">
            <Btn size="sm" onClick={() => window.print()}><Download size={14} /> Descargar / Imprimir</Btn>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded-xl p-8" id="pdf-area">
          <div className="flex items-center justify-between border-b-2 pb-4 mb-5" style={{ borderColor: marca.color }}>
            <div className="flex items-center gap-3">
              {marca.logo ? <img src={marca.logo} alt="logo" className="w-12 h-12 object-contain rounded" /> : <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-medium" style={{ background: marca.color }}>{(marca.nombre || "N")[0]}</div>}
              <div><div style={display} className="text-xl" >{marca.nombre || "nutria"}</div><div className="text-xs text-stone-400">{marca.profesional || "Nutrióloga certificada"}</div></div>
            </div>
            <div className="text-right text-xs text-stone-400"><div>Plan alimenticio</div><div>{new Date().toLocaleDateString("es-MX")}</div></div>
          </div>
          <div className="mb-4"><div className="text-sm text-stone-400">Paciente</div><div className="text-lg text-emerald-950 font-medium">{paciente.nombre}</div><div className="text-xs text-stone-400">{paciente.medico.objetivo} · {plan.calorias_diarias} kcal/día</div></div>
          <div className="space-y-3">
            {(plan.comidas || []).map((c, i) => (
              <div key={i} className="border-l-2 pl-3" style={{ borderColor: marca.color }}>
                <div className="text-sm font-medium text-emerald-950">{c.nombre} <span className="text-stone-400 font-normal">· {c.horario}</span></div>
                <div className="text-xs text-stone-500">{c.descripcion}</div>
                <div style={mono} className="text-xs text-stone-400 mt-0.5">{c.porcion ? c.porcion + " · " : ""}{c.calorias} kcal</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-stone-400 mt-6 pt-3 border-t border-stone-100">Documento generado por {marca.nombre || "nutria"}. Uso exclusivo del paciente. No sustituye consulta médica.</div>
        </div>
      </div>
    </Modal>
  );
}

/* ========== tab: plan alimenticio ========== */
function TabPlan({ paciente, updatePatient, marca, plantillas }) {
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [borrador, setBorrador] = useState(paciente.planActivo);
  const [foodPicker, setFoodPicker] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [showPlantillas, setShowPlantillas] = useState(false);

  useEffect(() => setBorrador(paciente.planActivo), [paciente.id]);

  const metaTexto = paciente.calculo ? `Meta calculada (Mifflin-St Jeor): ${paciente.calculo.objetivoCalorias} kcal, ${paciente.calculo.proteina_g}g proteína, ${paciente.calculo.carbos_g}g carbos, ${paciente.calculo.grasa_g}g grasa. Ajústate a estos números.` : "";

  const generar = async () => {
    setLoading(true); setError(null);
    try {
      const prompt = `Eres un asistente para nutriólogos certificados. Genera un BORRADOR de plan alimenticio de un día para que el profesional lo revise y apruebe. Nunca es final ni se usa sin supervisión.
Paciente: ${paciente.nombre}, ${paciente.edad} años, ${paciente.antropometria.peso} kg, ${paciente.antropometria.altura} cm. Objetivo: ${paciente.medico.objetivo}. Condiciones: ${paciente.medico.condiciones.join(", ")}. Dieta: ${paciente.preferencias.tipoDieta}. Alergias: ${paciente.preferencias.alergias.join(", ")}. No le gusta: ${paciente.preferencias.disgustos || "nada"}. Comidas al día: ${paciente.preferencias.comidasPorDia}.
${metaTexto}
Notas del nutriólogo: ${notas || "ninguna"}
Responde SOLO con JSON: {"calorias_diarias": number, "macros": {"proteina_g": number, "carbos_g": number, "grasa_g": number}, "comidas": [{"nombre": string, "horario": string, "descripcion": string, "porcion": string, "calorias": number}], "nota_ia": string}`;
      setBorrador(parseJSON(await callClaude(prompt)));
    } catch { setError("No se pudo generar el borrador. Intenta de nuevo."); }
    finally { setLoading(false); }
  };
  const editarComida = (i, campo, valor) => setBorrador((b) => ({ ...b, comidas: b.comidas.map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c)) }));
  const agregarAlimento = (al) => {
    setBorrador((b) => {
      const base = b || { calorias_diarias: 0, macros: { proteina_g: 0, carbos_g: 0, grasa_g: 0 }, comidas: [] };
      return { ...base, comidas: [...base.comidas, { nombre: al.nombre, horario: "—", descripcion: `${al.porcion} de ${al.nombre.toLowerCase()}`, porcion: al.porcion, calorias: al.kcal }] };
    });
    setFoodPicker(false);
  };
  const aplicarPlantilla = (pl) => {
    setBorrador({ calorias_diarias: pl.calorias, macros: { proteina_g: 0, carbos_g: 0, grasa_g: 0 }, comidas: [{ nombre: "Comida base", horario: "—", descripcion: pl.descripcion, porcion: "", calorias: pl.calorias }], nota_ia: `Basado en plantilla: ${pl.nombre}` });
    setShowPlantillas(false);
  };
  const compartir = () => updatePatient(paciente.id, { planActivo: { ...borrador, compartido: new Date().toLocaleString("es-MX") } });

  return (
    <div className="space-y-5">
      <SectionCard title="Generar plan" icon={Sparkles} action={
        <div className="flex gap-2">
          <Btn size="sm" variant="outline" onClick={() => setShowPlantillas(true)}><LayoutTemplate size={13} /> Plantilla</Btn>
          <Btn size="sm" variant="outline" onClick={() => setFoodPicker(true)}><Utensils size={13} /> Base de alimentos</Btn>
        </div>
      }>
        {!paciente.calculo && <div className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-3 flex items-center gap-2"><AlertTriangle size={13} /> Tip: calcula el requerimiento en la pestaña "Cálculo" para que la IA se ajuste a metas exactas.</div>}
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ej. priorizar desayunos rápidos, más fibra, 4 comidas..." className="w-full border border-stone-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-emerald-400" rows={2} />
        <Btn onClick={generar} disabled={loading} className="mt-3">{loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {loading ? "Generando..." : "Generar borrador con IA"}</Btn>
        {error && <div className="text-orange-600 text-xs mt-2">{error}</div>}
      </SectionCard>

      {borrador && <div className="bg-white border border-stone-200 rounded-xl p-5">
        <div className="bg-lime-50 border border-lime-200 text-emerald-900 text-xs rounded-lg px-3 py-2 mb-4">{borrador.compartido ? `Compartido con el paciente el ${borrador.compartido}. Puedes seguir editando.` : "Borrador editable — ajústalo antes de compartir."}</div>
        <div className="flex items-center gap-6 mb-4">
          <div><input style={mono} type="number" value={borrador.calorias_diarias} onChange={(e) => setBorrador((b) => ({ ...b, calorias_diarias: Number(e.target.value) }))} className="text-2xl text-emerald-950 w-24 border-b border-stone-200 focus:outline-none focus:border-emerald-400" /><div className="text-xs text-stone-400">kcal / día</div></div>
          <div className="flex gap-4 text-xs text-stone-500">
            <div><input style={mono} type="number" value={borrador.macros?.proteina_g} onChange={(e) => setBorrador((b) => ({ ...b, macros: { ...b.macros, proteina_g: Number(e.target.value) } }))} className="w-12 text-emerald-900 border-b border-stone-200 focus:outline-none" />g proteína</div>
            <div><input style={mono} type="number" value={borrador.macros?.carbos_g} onChange={(e) => setBorrador((b) => ({ ...b, macros: { ...b.macros, carbos_g: Number(e.target.value) } }))} className="w-12 text-emerald-900 border-b border-stone-200 focus:outline-none" />g carbos</div>
            <div><input style={mono} type="number" value={borrador.macros?.grasa_g} onChange={(e) => setBorrador((b) => ({ ...b, macros: { ...b.macros, grasa_g: Number(e.target.value) } }))} className="w-12 text-emerald-900 border-b border-stone-200 focus:outline-none" />g grasa</div>
          </div>
        </div>
        <div className="space-y-3">
          {(borrador.comidas || []).map((c, i) => {
            const conflicto = tieneConflicto(c.descripcion, paciente.preferencias.alergias);
            return (
              <div key={i} className="border-t border-stone-100 pt-3 first:border-0 first:pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <input value={c.nombre} onChange={(e) => editarComida(i, "nombre", e.target.value)} className="text-sm text-emerald-950 font-medium border-b border-transparent hover:border-stone-200 focus:border-emerald-400 focus:outline-none" />
                  <span className="text-stone-400">·</span>
                  <input value={c.horario} onChange={(e) => editarComida(i, "horario", e.target.value)} className="text-xs text-stone-400 w-20 border-b border-transparent hover:border-stone-200 focus:border-emerald-400 focus:outline-none" />
                  {conflicto && <span className="flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5 ml-auto"><AlertTriangle size={10} /> revisar alergia</span>}
                </div>
                <textarea value={c.descripcion} onChange={(e) => editarComida(i, "descripcion", e.target.value)} className="w-full text-xs text-stone-600 resize-none border-b border-transparent hover:border-stone-200 focus:border-emerald-400 focus:outline-none" rows={2} />
                <div className="flex gap-4 mt-1 text-xs text-stone-400">
                  <span>Porción: <input value={c.porcion || ""} onChange={(e) => editarComida(i, "porcion", e.target.value)} className="w-24 border-b border-transparent hover:border-stone-200 focus:border-emerald-400 focus:outline-none" /></span>
                  <span style={mono}><input type="number" value={c.calorias} onChange={(e) => editarComida(i, "calorias", Number(e.target.value))} className="w-14 border-b border-transparent hover:border-stone-200 focus:border-emerald-400 focus:outline-none" /> kcal</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-5">
          <Btn size="sm" onClick={compartir}><Share2 size={14} /> {borrador.compartido ? "Volver a compartir" : "Compartir con paciente"}</Btn>
          <Btn size="sm" variant="outline" onClick={() => setShowPdf(true)}><Download size={14} /> Exportar PDF con marca</Btn>
          <Btn size="sm" variant="ghost" onClick={() => setBorrador(null)}>Descartar</Btn>
        </div>
      </div>}

      {foodPicker && <FoodPicker onAdd={agregarAlimento} onClose={() => setFoodPicker(false)} />}
      {showPdf && borrador && <PdfPreview paciente={paciente} plan={borrador} marca={marca} onClose={() => setShowPdf(false)} />}
      {showPlantillas && <Modal onClose={() => setShowPlantillas(false)}>
        <div className="p-6"><div className="flex items-center justify-between mb-4"><div style={display} className="text-lg text-emerald-950 font-medium">Aplicar plantilla</div><button onClick={() => setShowPlantillas(false)} className="text-stone-400 hover:text-stone-600"><X size={18} /></button></div>
          <div className="space-y-2">{plantillas.map((pl) => (
            <button key={pl.id} onClick={() => aplicarPlantilla(pl)} className="w-full text-left border border-stone-200 rounded-lg p-3 hover:border-emerald-300">
              <div className="flex justify-between"><span className="text-sm text-emerald-950 font-medium">{pl.nombre}</span><span style={mono} className="text-xs text-stone-400">{pl.calorias} kcal</span></div>
              <div className="text-xs text-stone-500 mt-0.5">{pl.descripcion}</div>
            </button>
          ))}</div>
        </div>
      </Modal>}
    </div>
  );
}

/* ========== tab: seguimiento ========== */
function TabSeguimiento({ paciente, updatePatient }) {
  const [genEjercicio, setGenEjercicio] = useState(false);
  const s = paciente.seguimiento;
  const comentar = (id, texto) => updatePatient(paciente.id, (p) => ({ seguimiento: { ...p.seguimiento, comidas: p.seguimiento.comidas.map((c) => (c.id === id ? { ...c, comentario: texto } : c)) } }));
  const sugerirEjercicio = async () => {
    setGenEjercicio(true);
    try {
      const prompt = `Eres un asistente para nutriólogos. Sugiere en 4-5 líneas una rutina semanal de actividad física complementaria para: ${paciente.nombre}, objetivo ${paciente.medico.objetivo}, actividad ${paciente.medico.nivelActividad}, condiciones ${paciente.medico.condiciones.join(", ")}. Solo el texto, sin encabezados.`;
      const texto = await callClaude(prompt, 400);
      updatePatient(paciente.id, { planEjercicio: { texto: texto.trim(), compartido: null } });
    } finally { setGenEjercicio(false); }
  };
  const compartirEjercicio = () => updatePatient(paciente.id, (p) => ({ planEjercicio: { ...p.planEjercicio, compartido: new Date().toLocaleDateString("es-MX") } }));
  return (
    <div className="space-y-4">
      <SectionCard title="Adherencia">
        <div className="flex items-center gap-6">
          <div className="flex-1"><div className="h-2 bg-stone-100 rounded-full overflow-hidden"><div className={`h-full ${s.adherencia < 50 ? "bg-orange-400" : "bg-lime-500"}`} style={{ width: `${s.adherencia}%` }} /></div><div className="text-xs text-stone-500 mt-1">{s.adherencia}% de registros completados esta semana</div></div>
          <div className="flex items-center gap-1 text-sm text-emerald-800"><Flame size={16} /> {s.racha} días seguidos</div>
        </div>
        {s.adherencia < 50 && <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mt-3"><AlertTriangle size={13} /> Adherencia baja — considera contactar al paciente o simplificar el plan.</div>}
      </SectionCard>
      <SectionCard title="Comidas registradas por el paciente" icon={Utensils}>
        {s.comidas.length === 0 && <div className="text-sm text-stone-400">Aún no hay comidas registradas.</div>}
        <div className="space-y-3">{s.comidas.map((c) => (
          <div key={c.id} className="flex items-start gap-3 border-t border-stone-100 pt-3 first:border-0 first:pt-0">
            <div className="text-2xl">{c.emoji}</div>
            <div className="flex-1"><div className="text-sm text-emerald-950 font-medium">{c.nombre}</div><div className="text-xs text-stone-400">{c.fecha}</div>
              <input placeholder="Añadir comentario para el paciente..." value={c.comentario} onChange={(e) => comentar(c.id, e.target.value)} className="text-xs mt-1 w-full border-b border-stone-200 focus:outline-none focus:border-emerald-400 pb-0.5" /></div>
          </div>
        ))}</div>
      </SectionCard>
      <SectionCard title="Ejercicio registrado" icon={Dumbbell}>
        {s.ejercicio.length === 0 && <div className="text-sm text-stone-400 mb-3">Aún no hay actividad registrada.</div>}
        <div className="space-y-2 mb-3">{s.ejercicio.map((e) => (
          <div key={e.id} className="flex justify-between text-sm border-t border-stone-100 pt-2 first:border-0 first:pt-0"><span className="text-emerald-950">{e.tipo}</span><span className="text-stone-400">{e.duracion} · {e.fecha}</span></div>
        ))}</div>
        <Btn size="sm" onClick={sugerirEjercicio} disabled={genEjercicio}>{genEjercicio ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Sugerir plan de actividad con IA</Btn>
        {paciente.planEjercicio && <div className="mt-3 bg-lime-50 border border-lime-200 rounded-lg p-3 text-sm text-emerald-900">{paciente.planEjercicio.texto}
          <div className="flex items-center justify-between mt-2"><span className="text-xs text-emerald-700">{paciente.planEjercicio.compartido ? `Compartido el ${paciente.planEjercicio.compartido}` : "Sin compartir"}</span>
            <button onClick={compartirEjercicio} className="flex items-center gap-1 text-xs text-emerald-900 underline"><Share2 size={12} /> Compartir con paciente</button></div></div>}
      </SectionCard>
    </div>
  );
}

/* ========== tab: recetas ========== */
function TabRecetas({ paciente, updatePatient }) {
  const [ajusteAbierto, setAjusteAbierto] = useState(null);
  const [ajusteTexto, setAjusteTexto] = useState("");
  const [ajusteResultado, setAjusteResultado] = useState({});
  const [loadingAjuste, setLoadingAjuste] = useState(false);
  const [ideaNueva, setIdeaNueva] = useState("");
  const [loadingNueva, setLoadingNueva] = useState(false);
  const s = paciente.seguimiento;
  const sugerirCambio = async (receta) => {
    setLoadingAjuste(true);
    try {
      const prompt = `Eres un asistente para nutriólogos. El paciente prepara: "${receta.nombre}". Ajústala así: "${ajusteTexto}". Considera alergias (${paciente.preferencias.alergias.join(", ")}) y objetivo (${paciente.medico.objetivo}). Da una versión ajustada en 3-4 líneas, lista para enviar.`;
      const respuesta = (await callClaude(prompt, 400)).trim();
      setAjusteResultado((r) => ({ ...r, [receta.id]: respuesta }));
    } finally { setLoadingAjuste(false); }
  };
  const generarNueva = async () => {
    setLoadingNueva(true);
    try {
      const prompt = `Eres un asistente para nutriólogos. Sugiere una receta nueva${ideaNueva ? `, idea: "${ideaNueva}"` : ""}. Paciente: dieta ${paciente.preferencias.tipoDieta}, alergias ${paciente.preferencias.alergias.join(", ")}, no le gusta ${paciente.preferencias.disgustos || "nada"}, objetivo ${paciente.medico.objetivo}. Responde SOLO JSON: {"nombre": string, "ingredientes": [string], "pasos_breve": string, "calorias": number, "porciones": number}`;
      const receta = parseJSON(await callClaude(prompt, 500));
      updatePatient(paciente.id, (p) => ({ seguimiento: { ...p.seguimiento, recetasSugeridas: [{ id: Date.now(), enviada: false, ...receta }, ...p.seguimiento.recetasSugeridas] } }));
      setIdeaNueva("");
    } finally { setLoadingNueva(false); }
  };
  const enviarReceta = (id) => updatePatient(paciente.id, (p) => ({ seguimiento: { ...p.seguimiento, recetasSugeridas: p.seguimiento.recetasSugeridas.map((r) => (r.id === id ? { ...r, enviada: true } : r)) } }));
  return (
    <div className="space-y-4">
      <SectionCard title="Recetas que está preparando el paciente" icon={ChefHat}>
        {s.recetasEnCurso.length === 0 && <div className="text-sm text-stone-400">Aún no hay recetas registradas por el paciente.</div>}
        <div className="space-y-3">{s.recetasEnCurso.map((r) => (
          <div key={r.id} className="border-t border-stone-100 pt-3 first:border-0 first:pt-0">
            <div className="flex items-center justify-between"><div><div className="text-sm text-emerald-950 font-medium">{r.nombre}</div><div className="text-xs text-stone-400">{r.frecuencia}</div></div>
              <button onClick={() => { setAjusteAbierto(ajusteAbierto === r.id ? null : r.id); setAjusteTexto(""); }} className="text-xs text-emerald-900 underline">Sugerir cambio</button></div>
            {ajusteAbierto === r.id && <div className="mt-2 bg-stone-50 rounded-lg p-3">
              <textarea value={ajusteTexto} onChange={(e) => setAjusteTexto(e.target.value)} placeholder="Ej. reducir carbohidratos, sustituir el queso..." className="w-full text-xs border border-stone-200 rounded-lg p-2 resize-none focus:outline-none focus:border-emerald-400" rows={2} />
              <Btn size="sm" onClick={() => sugerirCambio(r)} disabled={loadingAjuste} className="mt-2">{loadingAjuste ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Sugerir con IA</Btn>
              {ajusteResultado[r.id] && <div className="mt-2 text-xs text-emerald-900 bg-lime-50 border border-lime-200 rounded-lg p-2">{ajusteResultado[r.id]}</div>}
            </div>}
          </div>
        ))}</div>
      </SectionCard>
      <SectionCard title="Sugerir una receta nueva" icon={Sparkles}>
        <input value={ideaNueva} onChange={(e) => setIdeaNueva(e.target.value)} placeholder="Idea opcional, ej. 'algo con pollo y quinoa'" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
        <Btn size="sm" onClick={generarNueva} disabled={loadingNueva} className="mt-2">{loadingNueva ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Generar receta con IA</Btn>
        <div className="space-y-3 mt-4">{s.recetasSugeridas.map((r) => (
          <div key={r.id} className="border-t border-stone-100 pt-3"><div className="text-sm text-emerald-950 font-medium">{r.nombre}</div>
            <div className="text-xs text-stone-500 mt-1">{(r.ingredientes || []).join(", ")}</div><div className="text-xs text-stone-500 mt-1">{r.pasos_breve}</div>
            <div style={mono} className="text-xs text-stone-400 mt-1">{r.calorias} kcal · {r.porciones} porciones</div>
            <button onClick={() => enviarReceta(r.id)} disabled={r.enviada} className="flex items-center gap-1 text-xs text-emerald-900 underline mt-1 disabled:text-stone-400 disabled:no-underline"><Share2 size={11} /> {r.enviada ? "Enviada al paciente" : "Enviar al paciente"}</button>
          </div>
        ))}</div>
      </SectionCard>
    </div>
  );
}

/* ========== detalle paciente ========== */
function PatientDetail({ paciente, onBack, updatePatient, marca, plantillas }) {
  const [tab, setTab] = useState("expediente");
  const tabs = [
    { id: "expediente", label: "Expediente", icon: ClipboardList },
    { id: "calculo", label: "Cálculo", icon: Calculator },
    { id: "plan", label: "Plan alimenticio", icon: Sparkles },
    { id: "seguimiento", label: "Seguimiento", icon: Dumbbell },
    { id: "recetas", label: "Recetas", icon: ChefHat },
  ];
  return (
    <div className="p-8 max-w-4xl">
      <button onClick={onBack} className="flex items-center gap-1 text-stone-500 text-sm mb-5 hover:text-emerald-900"><ChevronLeft size={16} /> Pacientes</button>
      <div className="flex items-center gap-4 mb-6"><Avatar foto={paciente.foto} nombre={paciente.nombre} size={64} />
        <div><div style={display} className="text-2xl text-emerald-950 font-medium">{paciente.nombre}</div><div className="text-stone-500 text-sm">{paciente.edad} años · {paciente.medico.objetivo}</div></div></div>
      <div className="flex gap-1 mb-5 border-b border-stone-200 overflow-x-auto">
        {tabs.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${tab === t.id ? "border-emerald-800 text-emerald-900" : "border-transparent text-stone-400 hover:text-stone-600"}`}><t.icon size={15} /> {t.label}</button>)}
      </div>
      {tab === "expediente" && <TabExpediente paciente={paciente} updatePatient={updatePatient} />}
      {tab === "calculo" && <TabCalculo paciente={paciente} updatePatient={updatePatient} />}
      {tab === "plan" && <TabPlan paciente={paciente} updatePatient={updatePatient} marca={marca} plantillas={plantillas} />}
      {tab === "seguimiento" && <TabSeguimiento paciente={paciente} updatePatient={updatePatient} />}
      {tab === "recetas" && <TabRecetas paciente={paciente} updatePatient={updatePatient} />}
    </div>
  );
}

/* ========== agenda ========== */
function Agenda({ citas, setCitas, pacientes }) {
  const [nueva, setNueva] = useState(false);
  const [videoCita, setVideoCita] = useState(null);
  const [form, setForm] = useState({ pacienteId: pacientes[0]?.id, fecha: "2026-07-28", hora: "10:00", tipo: "Seguimiento", recordatorio: true });
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400";
  const crear = () => {
    const p = pacientes.find((x) => x.id === Number(form.pacienteId));
    setCitas((c) => [...c, { id: Date.now(), pacienteId: p.id, paciente: p.nombre, fecha: form.fecha, hora: form.hora, tipo: form.tipo, recordatorio: form.recordatorio }]);
    setNueva(false);
  };
  const toggleRecordatorio = (id) => setCitas((c) => c.map((x) => (x.id === id ? { ...x, recordatorio: !x.recordatorio } : x)));
  const ordenadas = [...citas].sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6"><div><div style={display} className="text-2xl text-emerald-950 font-medium">Agenda</div><div className="text-stone-500 text-sm mt-1">{citas.length} citas programadas</div></div><Btn onClick={() => setNueva(true)}><Plus size={16} /> Nueva cita</Btn></div>
      <div className="space-y-3">{ordenadas.map((c) => (
        <div key={c.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-center gap-4">
          <div className="text-center shrink-0 w-14"><div style={mono} className="text-emerald-900 text-lg">{c.hora}</div><div className="text-[10px] text-stone-400">{c.fecha.slice(5)}</div></div>
          <div className="flex-1"><div className="text-sm text-emerald-950 font-medium">{c.paciente}</div><div className="text-xs text-stone-400">{c.tipo}</div></div>
          <button onClick={() => toggleRecordatorio(c.id)} className={`flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border ${c.recordatorio ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-stone-400 border-stone-200"}`}><Bell size={12} /> {c.recordatorio ? "Recordatorio activo" : "Sin recordatorio"}</button>
          <Btn size="sm" variant="outline" onClick={() => setVideoCita(c)}><Video size={14} /> Videollamada</Btn>
        </div>
      ))}</div>

      {nueva && <Modal onClose={() => setNueva(false)}>
        <div className="p-6"><div className="flex items-center justify-between mb-4"><div style={display} className="text-lg text-emerald-950 font-medium">Nueva cita</div><button onClick={() => setNueva(false)} className="text-stone-400 hover:text-stone-600"><X size={18} /></button></div>
          <div className="space-y-3">
            <div><label className="text-xs text-stone-500 mb-1 block">Paciente</label><select className={inp} value={form.pacienteId} onChange={(e) => setForm({ ...form, pacienteId: e.target.value })}>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="text-xs text-stone-500 mb-1 block">Fecha</label><input type="date" className={inp} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} /></div>
              <div><label className="text-xs text-stone-500 mb-1 block">Hora</label><input type="time" className={inp} value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></div></div>
            <div><label className="text-xs text-stone-500 mb-1 block">Tipo</label><select className={inp} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}><option>Primera consulta</option><option>Seguimiento</option><option>Videoconsulta</option></select></div>
            <label className="flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={form.recordatorio} onChange={(e) => setForm({ ...form, recordatorio: e.target.checked })} /> Enviar recordatorio automático al paciente</label>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Btn variant="ghost" onClick={() => setNueva(false)}>Cancelar</Btn><Btn onClick={crear}>Agendar</Btn></div>
        </div>
      </Modal>}

      {videoCita && <Modal onClose={() => setVideoCita(null)}>
        <div className="p-6 text-center">
          <div className="flex items-center justify-between mb-4"><div style={display} className="text-lg text-emerald-950 font-medium">Sala de videoconsulta</div><button onClick={() => setVideoCita(null)} className="text-stone-400 hover:text-stone-600"><X size={18} /></button></div>
          <div className="bg-emerald-950 rounded-xl aspect-video flex flex-col items-center justify-center text-emerald-200 mb-4"><Video size={40} /><div className="text-sm mt-2">Videollamada con {videoCita.paciente}</div><div className="text-xs text-emerald-400 mt-1">{videoCita.fecha} · {videoCita.hora}</div></div>
          <p className="text-xs text-stone-400">En producción esto abriría una sala segura de video (WebRTC / integración con Zoom o Whereby) con enlace enviado al paciente.</p>
        </div>
      </Modal>}
    </div>
  );
}

/* ========== mensajes ========== */
function Mensajes({ pacientes, mensajes, setMensajes }) {
  const [activo, setActivo] = useState(pacientes[0]?.id);
  const [texto, setTexto] = useState("");
  const [sugiriendo, setSugiriendo] = useState(false);
  const hilo = mensajes[activo] || [];
  const paciente = pacientes.find((p) => p.id === activo);
  const enviar = (t) => {
    if (!t.trim()) return;
    setMensajes((m) => ({ ...m, [activo]: [...(m[activo] || []), { de: "nutriologo", texto: t, hora: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) }] }));
    setTexto("");
  };
  const sugerir = async () => {
    setSugiriendo(true);
    try {
      const ultimo = [...hilo].reverse().find((m) => m.de === "paciente");
      const prompt = `Eres asistente de un nutriólogo. Redacta una respuesta breve, cálida y profesional para este mensaje de un paciente (${paciente.nombre}, objetivo ${paciente.medico.objetivo}): "${ultimo ? ultimo.texto : "quiere saber cómo va su progreso"}". Solo el texto de la respuesta.`;
      setTexto((await callClaude(prompt, 200)).trim());
    } finally { setSugiriendo(false); }
  };
  return (
    <div className="flex h-full">
      <div className="w-60 border-r border-stone-200 bg-white overflow-auto">
        <div className="p-4 text-xs uppercase tracking-wide text-stone-400">Conversaciones</div>
        {pacientes.map((p) => (
          <button key={p.id} onClick={() => setActivo(p.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-left ${activo === p.id ? "bg-emerald-50" : "hover:bg-stone-50"}`}>
            <Avatar foto={p.foto} nombre={p.nombre} size={36} /><div className="min-w-0"><div className="text-sm text-emerald-950 truncate">{p.nombre}</div><div className="text-xs text-stone-400 truncate">{(mensajes[p.id] || []).slice(-1)[0]?.texto || "Sin mensajes"}</div></div>
          </button>
        ))}
      </div>
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 bg-white flex items-center gap-3"><Avatar foto={paciente?.foto} nombre={paciente?.nombre || "?"} size={36} /><div className="text-sm text-emerald-950 font-medium">{paciente?.nombre}</div><span className="flex items-center gap-1 text-[10px] text-emerald-600 ml-auto"><ShieldCheck size={12} /> Cifrado extremo a extremo</span></div>
        <div className="flex-1 overflow-auto p-6 space-y-3 bg-stone-50">
          {hilo.length === 0 && <div className="text-sm text-stone-400 text-center mt-8">Inicia la conversación con {paciente?.nombre}.</div>}
          {hilo.map((m, i) => (
            <div key={i} className={`flex ${m.de === "nutriologo" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${m.de === "nutriologo" ? "bg-emerald-900 text-white" : "bg-white border border-stone-200 text-emerald-950"}`}>{m.texto}<div className={`text-[10px] mt-1 ${m.de === "nutriologo" ? "text-emerald-300" : "text-stone-400"}`}>{m.hora}</div></div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-stone-200 bg-white">
          <div className="flex items-center gap-2">
            <button onClick={sugerir} disabled={sugiriendo} title="Sugerir respuesta con IA" className="text-emerald-800 hover:bg-emerald-50 rounded-lg p-2 disabled:opacity-50">{sugiriendo ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}</button>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar(texto)} placeholder="Escribe un mensaje..." className="flex-1 border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
            <button onClick={() => enviar(texto)} className="bg-emerald-900 text-white rounded-lg p-2 hover:bg-emerald-800"><Send size={18} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========== facturación ========== */
function Facturacion({ facturas, setFacturas, pacientes }) {
  const [nueva, setNueva] = useState(false);
  const [form, setForm] = useState({ pacienteId: pacientes[0]?.id, concepto: "Consulta", monto: 600, cfdi: false });
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400";
  const total = facturas.reduce((s, f) => s + (f.pagada ? f.monto : 0), 0);
  const pendiente = facturas.reduce((s, f) => s + (!f.pagada ? f.monto : 0), 0);
  const crear = () => {
    const p = pacientes.find((x) => x.id === Number(form.pacienteId));
    setFacturas((f) => [{ id: Date.now(), pacienteId: p.id, paciente: p.nombre, concepto: form.concepto, monto: Number(form.monto), fecha: new Date().toISOString().slice(0, 10), pagada: false, cfdi: form.cfdi }, ...f]);
    setNueva(false);
  };
  const togglePago = (id) => setFacturas((f) => f.map((x) => (x.id === id ? { ...x, pagada: !x.pagada } : x)));
  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6"><div><div style={display} className="text-2xl text-emerald-950 font-medium">Facturación</div><div className="text-stone-500 text-sm mt-1">Cobros y comprobantes</div></div><Btn onClick={() => setNueva(true)}><Plus size={16} /> Nuevo cobro</Btn></div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white border border-stone-200 rounded-xl p-4"><div className="text-xs text-stone-400">Cobrado</div><div style={mono} className="text-2xl text-emerald-900">${total.toLocaleString()}</div></div>
        <div className="bg-white border border-stone-200 rounded-xl p-4"><div className="text-xs text-stone-400">Pendiente</div><div style={mono} className="text-2xl text-orange-600">${pendiente.toLocaleString()}</div></div>
      </div>
      <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
        {facturas.map((f) => (
          <div key={f.id} className="flex items-center gap-4 p-4">
            <div className="flex-1"><div className="text-sm text-emerald-950 font-medium">{f.paciente}</div><div className="text-xs text-stone-400">{f.concepto} · {f.fecha} {f.cfdi && <span className="text-emerald-600">· CFDI</span>}</div></div>
            <div style={mono} className="text-sm text-emerald-950">${f.monto.toLocaleString()}</div>
            <button onClick={() => togglePago(f.id)} className={`flex items-center gap-1 text-xs rounded-full px-3 py-1 border ${f.pagada ? "text-emerald-700 border-emerald-200 bg-emerald-50" : "text-orange-600 border-orange-200 bg-orange-50"}`}>{f.pagada ? <><Check size={12} /> Pagada</> : "Marcar pagada"}</button>
          </div>
        ))}
      </div>
      {nueva && <Modal onClose={() => setNueva(false)}>
        <div className="p-6"><div className="flex items-center justify-between mb-4"><div style={display} className="text-lg text-emerald-950 font-medium">Nuevo cobro</div><button onClick={() => setNueva(false)} className="text-stone-400 hover:text-stone-600"><X size={18} /></button></div>
          <div className="space-y-3">
            <div><label className="text-xs text-stone-500 mb-1 block">Paciente</label><select className={inp} value={form.pacienteId} onChange={(e) => setForm({ ...form, pacienteId: e.target.value })}>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
            <div><label className="text-xs text-stone-500 mb-1 block">Concepto</label><input className={inp} value={form.concepto} onChange={(e) => setForm({ ...form, concepto: e.target.value })} /></div>
            <div><label className="text-xs text-stone-500 mb-1 block">Monto (MXN)</label><input type="number" className={inp} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={form.cfdi} onChange={(e) => setForm({ ...form, cfdi: e.target.checked })} /> Generar factura CFDI 4.0</label>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Btn variant="ghost" onClick={() => setNueva(false)}>Cancelar</Btn><Btn onClick={crear}>Crear cobro</Btn></div>
        </div>
      </Modal>}
    </div>
  );
}

/* ========== plantillas ========== */
function Plantillas({ plantillas, setPlantillas }) {
  const [nueva, setNueva] = useState(false);
  const [form, setForm] = useState({ nombre: "", objetivo: "Pérdida de grasa", calorias: 1600, descripcion: "" });
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400";
  const crear = () => { setPlantillas((p) => [...p, { id: Date.now(), ...form, calorias: Number(form.calorias) }]); setNueva(false); setForm({ nombre: "", objetivo: "Pérdida de grasa", calorias: 1600, descripcion: "" }); };
  const borrar = (id) => setPlantillas((p) => p.filter((x) => x.id !== id));
  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6"><div><div style={display} className="text-2xl text-emerald-950 font-medium">Plantillas de planes</div><div className="text-stone-500 text-sm mt-1">Reutiliza estructuras para ahorrar tiempo</div></div><Btn onClick={() => setNueva(true)}><Plus size={16} /> Nueva plantilla</Btn></div>
      <div className="grid sm:grid-cols-2 gap-3">{plantillas.map((pl) => (
        <div key={pl.id} className="bg-white border border-stone-200 rounded-xl p-4">
          <div className="flex items-start justify-between"><div style={display} className="text-emerald-950 font-medium">{pl.nombre}</div><button onClick={() => borrar(pl.id)} className="text-stone-300 hover:text-orange-500"><X size={16} /></button></div>
          <div className="text-xs text-stone-400 mt-1">{pl.objetivo} · <span style={mono}>{pl.calorias} kcal</span></div>
          <div className="text-sm text-stone-500 mt-2">{pl.descripcion}</div>
        </div>
      ))}</div>
      {nueva && <Modal onClose={() => setNueva(false)}>
        <div className="p-6"><div className="flex items-center justify-between mb-4"><div style={display} className="text-lg text-emerald-950 font-medium">Nueva plantilla</div><button onClick={() => setNueva(false)} className="text-stone-400 hover:text-stone-600"><X size={18} /></button></div>
          <div className="space-y-3">
            <div><label className="text-xs text-stone-500 mb-1 block">Nombre</label><input className={inp} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Déficit moderado — vegetariano" /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="text-xs text-stone-500 mb-1 block">Objetivo</label><select className={inp} value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })}>{OBJETIVOS.map((o) => <option key={o}>{o}</option>)}</select></div>
              <div><label className="text-xs text-stone-500 mb-1 block">Calorías</label><input type="number" className={inp} value={form.calorias} onChange={(e) => setForm({ ...form, calorias: e.target.value })} /></div></div>
            <div><label className="text-xs text-stone-500 mb-1 block">Descripción</label><textarea rows={2} className={inp} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-5"><Btn variant="ghost" onClick={() => setNueva(false)}>Cancelar</Btn><Btn onClick={crear}>Guardar</Btn></div>
        </div>
      </Modal>}
    </div>
  );
}

/* ========== marca / configuración ========== */
function MarcaConfig({ marca, setMarca }) {
  const inp = "w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-400";
  const handleLogo = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => setMarca({ ...marca, logo: r.result }); r.readAsDataURL(f); };
  const colores = ["#166534", "#0f766e", "#7c3aed", "#be123c", "#c2410c", "#1d4ed8"];
  return (
    <div className="p-8 max-w-2xl space-y-4">
      <div><div style={display} className="text-2xl text-emerald-950 font-medium">Marca y datos</div><div className="text-stone-500 text-sm mt-1">Tu identidad en los PDF y el portal del paciente (marca blanca)</div></div>
      <SectionCard title="Identidad" icon={Palette}>
        <div className="flex items-center gap-4 mb-4">
          {marca.logo ? <img src={marca.logo} alt="logo" className="w-16 h-16 object-contain rounded-lg border border-stone-200" /> : <div className="w-16 h-16 rounded-lg flex items-center justify-center text-white text-xl font-medium" style={{ background: marca.color }}>{(marca.nombre || "N")[0]}</div>}
          <label className="flex items-center gap-2 text-xs text-emerald-800 border border-emerald-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-emerald-50"><Camera size={14} /> Subir logo<input type="file" accept="image/*" className="hidden" onChange={handleLogo} /></label>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs text-stone-500 mb-1 block">Nombre del consultorio / marca</label><input className={inp} value={marca.nombre} onChange={(e) => setMarca({ ...marca, nombre: e.target.value })} /></div>
          <div><label className="text-xs text-stone-500 mb-1 block">Nombre profesional</label><input className={inp} value={marca.profesional} onChange={(e) => setMarca({ ...marca, profesional: e.target.value })} /></div>
          <div><label className="text-xs text-stone-500 mb-1 block">Color de marca</label><div className="flex gap-2">{colores.map((c) => <button key={c} onClick={() => setMarca({ ...marca, color: c })} className={`w-8 h-8 rounded-full ${marca.color === c ? "ring-2 ring-offset-2 ring-stone-400" : ""}`} style={{ background: c }} />)}</div></div>
        </div>
      </SectionCard>
      <SectionCard title="Seguridad y cumplimiento" icon={ShieldCheck}>
        <div className="space-y-2 text-sm text-stone-600">
          <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600" /> Datos cifrados en tránsito y en reposo</div>
          <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600" /> Aviso de privacidad conforme a LFPDPPP (México)</div>
          <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600" /> Exportación de expedientes al cancelar la suscripción</div>
          <div className="flex items-center gap-2"><CheckCircle2 size={15} className="text-emerald-600" /> Estructura alineable a NOM-004-SSA3</div>
        </div>
        <p className="text-xs text-stone-400 mt-3">Marco de cumplimiento a implementar en el backend antes del lanzamiento comercial.</p>
      </SectionCard>
    </div>
  );
}

/* ========== login ========== */
function LoginScreen({ onLogin }) {
  return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
      <div className="bg-stone-50 rounded-2xl max-w-sm w-full p-8 text-center">
        <div style={display} className="text-3xl text-emerald-950 font-medium">nutria</div>
        <p className="text-stone-500 text-sm mt-2 mb-6">El panel de tus pacientes, planes y seguimiento — con IA integrada.</p>
        <Btn onClick={onLogin} className="w-full justify-center">Iniciar sesión como nutriólogo</Btn>
        <div className="text-stone-400 text-xs mt-4">Prototipo de MVP — datos de ejemplo</div>
      </div>
    </div>
  );
}

/* ========== suscripción badge ========== */
function SubscriptionBadge({ onOpen }) {
  return <button onClick={onOpen} className="flex items-center gap-2 bg-white border border-stone-200 rounded-full pl-3 pr-4 py-1.5 text-xs hover:border-emerald-300 transition-colors"><span className="w-2 h-2 rounded-full bg-lime-500" /><span className="text-stone-600">Plan <span className="font-semibold text-emerald-900">Pro</span></span></button>;
}
function SubscriptionModal({ onClose }) {
  return <Modal onClose={onClose}><div className="p-6 relative"><button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600"><X size={18} /></button>
    <CreditCard className="text-emerald-800 mb-3" size={22} /><div style={display} className="text-lg font-medium text-emerald-950">Suscripción Pro</div>
    <p className="text-sm text-stone-500 mt-2 leading-relaxed">Pacientes ilimitados, IA para planes y recetas, y reportes automáticos.</p>
    <div className="mt-4 bg-white rounded-xl p-4 text-sm space-y-2 border border-stone-200">
      <div className="flex justify-between text-stone-500"><span>Próximo cobro</span><span className="text-stone-800 font-medium">1 ago 2026</span></div>
      <div className="flex justify-between text-stone-500"><span>Monto</span><span className="text-stone-800 font-medium">$499 MXN/mes</span></div>
      <div className="flex justify-between text-stone-500"><span>Generaciones IA incluidas</span><span className="text-stone-800 font-medium">150 / mes</span></div>
    </div>
    <Btn onClick={onClose} className="w-full justify-center mt-5">Gestionar suscripción</Btn>
  </div></Modal>;
}

/* ========== app ========== */
export default function App() {
  useGoogleFonts();
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState("pacientes");
  const [pacientes, setPacientes] = useState([P1, P2]);
  const [selectedId, setSelectedId] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [citas, setCitas] = useState(CITAS_INICIALES);
  const [mensajes, setMensajes] = useState(MENSAJES_INICIALES);
  const [facturas, setFacturas] = useState(FACTURAS_INICIALES);
  const [plantillas, setPlantillas] = useState(PLANTILLAS_INICIALES);
  const [marca, setMarca] = useState({ nombre: "nutria", profesional: "Nutrióloga certificada", color: "#166534", logo: null });

  const paciente = pacientes.find((p) => p.id === selectedId);
  const updatePatient = (id, changes) => setPacientes((ps) => ps.map((p) => (p.id === id ? { ...p, ...(typeof changes === "function" ? changes(p) : changes) } : p)));
  const crearPaciente = (nuevo) => { setPacientes((ps) => [nuevo, ...ps]); setShowWizard(false); setSelectedId(nuevo.id); setView("paciente"); };

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  const enPaciente = view === "paciente" || (view === "pacientes" && selectedId);

  return (
    <div className="flex h-screen bg-stone-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <Sidebar view={view} setView={(v) => { setView(v); setSelectedId(null); }} marca={marca} />
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex justify-end px-8 py-4 border-b border-stone-200 bg-white shrink-0"><SubscriptionBadge onOpen={() => setShowSub(true)} /></div>
        <div className="flex-1 overflow-auto min-h-0">
          {view === "pacientes" && !selectedId && <Dashboard pacientes={pacientes} onSelect={(id) => { setSelectedId(id); setView("paciente"); }} onNuevo={() => setShowWizard(true)} />}
          {enPaciente && paciente && <PatientDetail paciente={paciente} onBack={() => { setSelectedId(null); setView("pacientes"); }} updatePatient={updatePatient} marca={marca} plantillas={plantillas} />}
          {view === "agenda" && <Agenda citas={citas} setCitas={setCitas} pacientes={pacientes} />}
          {view === "mensajes" && <Mensajes pacientes={pacientes} mensajes={mensajes} setMensajes={setMensajes} />}
          {view === "facturacion" && <Facturacion facturas={facturas} setFacturas={setFacturas} pacientes={pacientes} />}
          {view === "plantillas" && <Plantillas plantillas={plantillas} setPlantillas={setPlantillas} />}
          {view === "marca" && <MarcaConfig marca={marca} setMarca={setMarca} />}
        </div>
      </div>
      {showWizard && <NuevoPacienteWizard onClose={() => setShowWizard(false)} onCrear={crearPaciente} />}
      {showSub && <SubscriptionModal onClose={() => setShowSub(false)} />}
    </div>
  );
}
