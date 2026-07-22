import React, { useState, useEffect, useRef } from "react";
import {
  Home, CalendarDays, Plus, TrendingUp, MessageCircle, User, ChevronLeft,
  Loader2, Sparkles, CheckCircle2, Circle, Flame, Droplet, Dumbbell,
  Utensils, Camera, Scale, Send, ShieldCheck, Award, Target, Clock,
  ChefHat, X, Bell, Heart, Zap,
} from "lucide-react";

/* ========== estilo base (misma identidad que el panel del nutriólogo) ========== */
function useGoogleFonts() {
  useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);
}
const display = { fontFamily: "'Fraunces', serif" };
const mono = { fontFamily: "'IBM Plex Mono', monospace" };
const sans = { fontFamily: "'Inter', sans-serif" };

/* ========== IA helper (API real de Claude) ========== */
const callClaude = async (prompt, maxTokens = 800) => {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await r.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
};
const parseJSON = (t) => JSON.parse(t.replace(/```json|```/g, "").trim());

/* ========== datos de ejemplo (en memoria) ========== */
const PACIENTE_INICIAL = {
  nombre: "Camila Torres",
  objetivo: "Pérdida de grasa",
  nutriologo: "Dra. Fernanda Ríos",
  pesoActual: 68.4,
  pesoMeta: 63,
  racha: 6,
  metaCalorias: 1650,
  metaMacros: { proteina: 110, carbos: 160, grasa: 55 },
  metaAgua: 8,
};

const PLAN_INICIAL = [
  { id: 1, nombre: "Desayuno", horario: "8:00", descripcion: "Avena cocida con plátano, fresas y nueces", porcion: "1 tazón (250 g)", calorias: 380, hecha: true },
  { id: 2, nombre: "Colación", horario: "11:00", descripcion: "Yogur griego natural con arándanos", porcion: "1 vaso (200 g)", calorias: 180, hecha: true },
  { id: 3, nombre: "Comida", horario: "14:00", descripcion: "Pechuga de pollo a la plancha, arroz integral y ensalada", porcion: "1 plato", calorias: 520, hecha: false },
  { id: 4, nombre: "Colación", horario: "17:00", descripcion: "Manzana con crema de cacahuate natural", porcion: "1 pieza + 1 cda", calorias: 190, hecha: false },
  { id: 5, nombre: "Cena", horario: "20:00", descripcion: "Salmón al horno con verduras al vapor", porcion: "1 filete (150 g)", calorias: 380, hecha: false },
];

const RECETAS_INICIALES = [
  {
    id: 1, nombre: "Bowl de pollo y arroz integral", tiempo: "25 min", calorias: 520,
    ingredientes: ["150 g de pechuga de pollo", "¾ taza de arroz integral cocido", "1 taza de mezcla de lechugas", "½ aguacate", "Jugo de limón, sal y pimienta"],
    pasos: ["Sazona el pollo y ásalo 5–6 min por lado.", "Sirve el arroz como base.", "Agrega el pollo en tiras y las lechugas.", "Corona con aguacate y aliña con limón."],
  },
  {
    id: 2, nombre: "Salmón al horno con verduras", tiempo: "30 min", calorias: 380,
    ingredientes: ["1 filete de salmón (150 g)", "1 calabacita en rodajas", "½ pimiento", "1 cda de aceite de oliva", "Ajo, sal y romero"],
    pasos: ["Precalienta el horno a 200 °C.", "Coloca salmón y verduras en una charola.", "Baña con aceite y sazona.", "Hornea 18–20 min."],
  },
];

const MENSAJES_INICIALES = [
  { de: "nutriologo", texto: "¡Hola Camila! ¿Cómo te sentiste con el desayuno nuevo?", hora: "9:15" },
  { de: "paciente", texto: "Muy bien, me dejó satisfecha hasta la colación 🙌", hora: "9:40" },
  { de: "nutriologo", texto: "Perfecto. Recuerda tomar tu agua durante la mañana.", hora: "9:42" },
];

const PESO_HISTORIAL = [
  { sem: "S1", peso: 71.2 }, { sem: "S2", peso: 70.5 }, { sem: "S3", peso: 70.1 },
  { sem: "S4", peso: 69.6 }, { sem: "S5", peso: 69.0 }, { sem: "S6", peso: 68.4 },
];

const LOGROS = [
  { icon: Flame, label: "Racha de 6 días", ganado: true },
  { icon: Droplet, label: "Meta de agua 5 días", ganado: true },
  { icon: Utensils, label: "Semana completa de registros", ganado: true },
  { icon: Scale, label: "Primeros 3 kg", ganado: true },
  { icon: Target, label: "Llegar al peso meta", ganado: false },
  { icon: Award, label: "30 días activa", ganado: false },
];

/* ========== UI compartida ========== */
function Avatar({ nombre, size = 40 }) {
  const ini = (nombre || "?").split(" ").map((n) => n[0]).slice(0, 2).join("");
  return (
    <div className="rounded-full bg-emerald-900 text-white flex items-center justify-center font-medium shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {ini}
    </div>
  );
}

function Ring({ valor, meta, size = 160, stroke = 14, color = "#065f46", track = "#e7e5e4", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(valor / meta, 1);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function MacroBar({ label, valor, meta, color }) {
  const pct = Math.min((valor / meta) * 100, 100);
  return (
    <div className="flex-1">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-stone-500">{label}</span>
        <span className="text-emerald-950" style={mono}>{valor}/{meta}g</span>
      </div>
      <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width .4s" }} />
      </div>
    </div>
  );
}

/* ========== pantalla: HOY ========== */
function Hoy({ paciente, plan, setPlan, agua, setAgua, onCoach }) {
  const consumidas = plan.filter((c) => c.hecha).reduce((s, c) => s + c.calorias, 0);
  const proteina = Math.round(paciente.metaMacros.proteina * (consumidas / paciente.metaCalorias) || 0);
  const carbos = Math.round(paciente.metaMacros.carbos * (consumidas / paciente.metaCalorias) || 0);
  const grasa = Math.round(paciente.metaMacros.grasa * (consumidas / paciente.metaCalorias) || 0);
  const restantes = Math.max(paciente.metaCalorias - consumidas, 0);
  const hechas = plan.filter((c) => c.hecha).length;
  const adherencia = Math.round((hechas / plan.length) * 100);

  const toggle = (id) => setPlan((p) => p.map((c) => (c.id === id ? { ...c, hecha: !c.hecha } : c)));

  return (
    <div className="pb-4">
      {/* saludo */}
      <div className="px-5 pt-2 pb-4 flex items-center justify-between">
        <div>
          <div className="text-stone-400 text-xs">Buen día,</div>
          <div style={display} className="text-2xl text-emerald-950 font-medium leading-tight">{paciente.nombre.split(" ")[0]}</div>
        </div>
        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 rounded-full px-3 py-1.5 text-sm font-medium">
          <Flame size={16} /> {paciente.racha}
        </div>
      </div>

      {/* anillo de calorías */}
      <div className="mx-5 rounded-3xl bg-white border border-stone-200 p-5 flex flex-col items-center">
        <Ring valor={consumidas} meta={paciente.metaCalorias} size={168}>
          <div style={mono} className="text-3xl text-emerald-950">{restantes}</div>
          <div className="text-[11px] text-stone-400 -mt-1">kcal restantes</div>
          <div className="text-[10px] text-stone-400 mt-1">{consumidas} de {paciente.metaCalorias}</div>
        </Ring>
        <div className="flex gap-3 w-full mt-4">
          <MacroBar label="Proteína" valor={proteina} meta={paciente.metaMacros.proteina} color="#0d9488" />
          <MacroBar label="Carbos" valor={carbos} meta={paciente.metaMacros.carbos} color="#d97706" />
          <MacroBar label="Grasa" valor={grasa} meta={paciente.metaMacros.grasa} color="#7c3aed" />
        </div>
      </div>

      {/* agua + adherencia */}
      <div className="mx-5 mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white border border-stone-200 p-4">
          <div className="flex items-center gap-2 text-sky-600 mb-2"><Droplet size={16} /><span className="text-xs text-stone-500">Agua</span></div>
          <div style={mono} className="text-emerald-950 text-lg">{agua}/{paciente.metaAgua} <span className="text-xs text-stone-400">vasos</span></div>
          <div className="flex gap-1 mt-2">
            {Array.from({ length: paciente.metaAgua }).map((_, i) => (
              <button key={i} onClick={() => setAgua(i + 1 === agua ? i : i + 1)}
                className={`h-6 flex-1 rounded ${i < agua ? "bg-sky-400" : "bg-stone-200"}`} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-white border border-stone-200 p-4">
          <div className="flex items-center gap-2 text-emerald-700 mb-2"><CheckCircle2 size={16} /><span className="text-xs text-stone-500">Adherencia hoy</span></div>
          <div style={mono} className="text-emerald-950 text-lg">{adherencia}%</div>
          <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden mt-3">
            <div className="h-full bg-emerald-700 rounded-full" style={{ width: `${adherencia}%`, transition: "width .4s" }} />
          </div>
          <div className="text-[11px] text-stone-400 mt-1">{hechas} de {plan.length} comidas</div>
        </div>
      </div>

      {/* plan del día */}
      <div className="px-5 mt-5 mb-2 flex items-center justify-between">
        <div style={display} className="text-lg text-emerald-950">Tu plan de hoy</div>
        <span className="text-xs text-stone-400">Toca para marcar</span>
      </div>
      <div className="mx-5 space-y-2">
        {plan.map((c) => (
          <button key={c.id} onClick={() => toggle(c.id)}
            className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${c.hecha ? "bg-emerald-50 border-emerald-200" : "bg-white border-stone-200"}`}>
            {c.hecha ? <CheckCircle2 size={22} className="text-emerald-700 shrink-0" /> : <Circle size={22} className="text-stone-300 shrink-0" />}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-emerald-950">{c.nombre}</span>
                <span className="text-[11px] text-stone-400 flex items-center gap-0.5"><Clock size={10} />{c.horario}</span>
              </div>
              <div className={`text-xs truncate ${c.hecha ? "text-stone-400 line-through" : "text-stone-500"}`}>{c.descripcion}</div>
            </div>
            <div style={mono} className="text-xs text-stone-400 shrink-0">{c.calorias}</div>
          </button>
        ))}
      </div>

      {/* coach IA */}
      <button onClick={onCoach}
        className="mx-5 mt-4 w-[calc(100%-2.5rem)] flex items-center gap-3 rounded-2xl bg-emerald-900 text-white p-4 hover:bg-emerald-800 transition-colors">
        <div className="rounded-full bg-emerald-800 p-2"><Sparkles size={18} /></div>
        <div className="text-left flex-1">
          <div className="text-sm font-medium">Pregúntale a tu coach</div>
          <div className="text-xs text-emerald-300">Dudas sobre tu plan, respondidas al instante</div>
        </div>
      </button>
    </div>
  );
}

/* ========== pantalla: PLAN (semana + recetas) ========== */
function PlanTab({ plan, recetas, setRecetas }) {
  const [sub, setSub] = useState("dia");
  const dias = ["L", "M", "M", "J", "V", "S", "D"];
  const [recetaAbierta, setRecetaAbierta] = useState(null);

  if (recetaAbierta) {
    return <RecetaDetalle receta={recetaAbierta} setRecetas={setRecetas} onBack={() => setRecetaAbierta(null)} />;
  }

  return (
    <div className="pb-4">
      <div className="px-5 pt-2 pb-3">
        <div style={display} className="text-2xl text-emerald-950 font-medium">Tu plan</div>
        <div className="text-xs text-stone-400 mt-0.5">Diseñado por tu nutrióloga</div>
      </div>

      <div className="mx-5 flex gap-1 bg-stone-100 rounded-xl p-1 mb-4">
        {[["dia", "Comidas"], ["recetas", "Recetas"]].map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)}
            className={`flex-1 rounded-lg py-2 text-sm transition-colors ${sub === k ? "bg-white text-emerald-950 shadow-sm" : "text-stone-500"}`}>{l}</button>
        ))}
      </div>

      {sub === "dia" && (
        <>
          <div className="px-5 flex gap-2 mb-4">
            {dias.map((d, i) => (
              <div key={i} className={`flex-1 rounded-xl py-2 text-center text-sm ${i === 1 ? "bg-emerald-900 text-white" : "bg-white border border-stone-200 text-stone-500"}`}>{d}</div>
            ))}
          </div>
          <div className="mx-5 space-y-2">
            {plan.map((c) => (
              <div key={c.id} className="rounded-2xl bg-white border border-stone-200 p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-emerald-950">{c.nombre}</span>
                  <span className="text-[11px] text-stone-400 flex items-center gap-1"><Clock size={11} />{c.horario}</span>
                </div>
                <div className="text-sm text-stone-600">{c.descripcion}</div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-stone-400">
                  <span>{c.porcion}</span>
                  <span style={mono} className="flex items-center gap-1"><Flame size={11} />{c.calorias} kcal</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {sub === "recetas" && (
        <div className="mx-5 space-y-3">
          {recetas.map((r) => (
            <button key={r.id} onClick={() => setRecetaAbierta(r)}
              className="w-full text-left rounded-2xl bg-white border border-stone-200 p-4 hover:border-emerald-300 transition-colors">
              <div className="flex items-center gap-2 text-emerald-800 mb-1"><ChefHat size={16} /><span className="text-sm font-medium text-emerald-950">{r.nombre}</span></div>
              <div className="flex gap-3 text-[11px] text-stone-400">
                <span className="flex items-center gap-1"><Clock size={11} />{r.tiempo}</span>
                <span style={mono} className="flex items-center gap-1"><Flame size={11} />{r.calorias} kcal</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RecetaDetalle({ receta, setRecetas, onBack }) {
  const [ingrediente, setIngrediente] = useState("");
  const [sugerencia, setSugerencia] = useState(null);
  const [cargando, setCargando] = useState(false);

  const sustituir = async () => {
    if (!ingrediente.trim()) return;
    setCargando(true); setSugerencia(null);
    try {
      const prompt = `Un paciente en plan de "${"pérdida de grasa"}" quiere sustituir el ingrediente "${ingrediente}" en la receta "${receta.nombre}". Sugiere UNA alternativa saludable y equivalente en calorías, con una frase corta del porqué. Responde SOLO con JSON: {"sustituto": string, "razon": string}`;
      setSugerencia(parseJSON(await callClaude(prompt, 300)));
    } catch {
      setSugerencia({ sustituto: "No se pudo generar", razon: "Intenta de nuevo en un momento." });
    } finally { setCargando(false); }
  };

  return (
    <div className="pb-4">
      <div className="px-5 pt-2 pb-3 flex items-center gap-2">
        <button onClick={onBack} className="text-stone-500 -ml-1"><ChevronLeft size={22} /></button>
        <div style={display} className="text-xl text-emerald-950 font-medium">{receta.nombre}</div>
      </div>
      <div className="mx-5 flex gap-3 text-xs text-stone-500 mb-4">
        <span className="flex items-center gap-1"><Clock size={13} />{receta.tiempo}</span>
        <span style={mono} className="flex items-center gap-1"><Flame size={13} />{receta.calorias} kcal</span>
      </div>

      <div className="mx-5 rounded-2xl bg-white border border-stone-200 p-4 mb-3">
        <div className="text-xs uppercase tracking-wide text-stone-400 mb-2">Ingredientes</div>
        <ul className="space-y-1.5">
          {receta.ingredientes.map((ing, i) => (
            <li key={i} className="text-sm text-stone-700 flex items-start gap-2"><span className="text-emerald-600 mt-1">•</span>{ing}</li>
          ))}
        </ul>
      </div>

      <div className="mx-5 rounded-2xl bg-white border border-stone-200 p-4 mb-3">
        <div className="text-xs uppercase tracking-wide text-stone-400 mb-2">Preparación</div>
        <ol className="space-y-2.5">
          {receta.pasos.map((p, i) => (
            <li key={i} className="text-sm text-stone-700 flex gap-2.5">
              <span style={mono} className="text-emerald-700 shrink-0">{i + 1}.</span>{p}
            </li>
          ))}
        </ol>
      </div>

      {/* sustitución con IA */}
      <div className="mx-5 rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
        <div className="flex items-center gap-2 text-emerald-900 mb-2"><Sparkles size={16} /><span className="text-sm font-medium">¿No tienes un ingrediente?</span></div>
        <div className="flex gap-2">
          <input value={ingrediente} onChange={(e) => setIngrediente(e.target.value)}
            placeholder="Ej. crema de cacahuate"
            className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-emerald-400" />
          <button onClick={sustituir} disabled={cargando}
            className="bg-emerald-900 text-white rounded-lg px-3 text-sm disabled:opacity-50">
            {cargando ? <Loader2 size={16} className="animate-spin" /> : "Sustituir"}
          </button>
        </div>
        {sugerencia && (
          <div className="mt-3 rounded-lg bg-white border border-emerald-200 p-3">
            <div className="text-sm text-emerald-950 font-medium">{sugerencia.sustituto}</div>
            <div className="text-xs text-stone-500 mt-0.5">{sugerencia.razon}</div>
          </div>
        )}
        <div className="text-[10px] text-emerald-700 mt-2">Sugerencia orientativa. Ante dudas, consulta a tu nutrióloga.</div>
      </div>
    </div>
  );
}

/* ========== hoja: REGISTRAR ========== */
function RegistrarSheet({ onClose, onRegistrarComida, onRegistrarPeso }) {
  const [modo, setModo] = useState("menu");
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [estimado, setEstimado] = useState(null);
  const [peso, setPeso] = useState("");

  const estimar = async () => {
    if (!texto.trim()) return;
    setCargando(true); setEstimado(null);
    try {
      const prompt = `Estima el valor nutricional de esta comida descrita por un paciente: "${texto}". Da una estimación razonable de una porción típica. Responde SOLO con JSON: {"alimento": string, "calorias": number, "proteina_g": number, "carbos_g": number, "grasa_g": number}`;
      setEstimado(parseJSON(await callClaude(prompt, 300)));
    } catch {
      setEstimado({ alimento: texto, calorias: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, error: true });
    } finally { setCargando(false); }
  };

  return (
    <div className="absolute inset-0 z-30 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full bg-stone-50 rounded-t-3xl p-5 pb-8 max-h-[85%] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full bg-stone-300 mx-auto mb-4" />

        {modo === "menu" && (
          <>
            <div style={display} className="text-lg text-emerald-950 mb-4">¿Qué quieres registrar?</div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setModo("comida")} className="rounded-2xl bg-white border border-stone-200 p-4 flex flex-col items-start gap-2 hover:border-emerald-300">
                <div className="rounded-full bg-emerald-50 text-emerald-700 p-2"><Utensils size={18} /></div>
                <span className="text-sm font-medium text-emerald-950">Una comida</span>
                <span className="text-[11px] text-stone-400 text-left">La IA estima sus macros</span>
              </button>
              <button onClick={() => alert("En la app real: abre la cámara para tomar foto de tu comida.")} className="rounded-2xl bg-white border border-stone-200 p-4 flex flex-col items-start gap-2 hover:border-emerald-300">
                <div className="rounded-full bg-amber-50 text-amber-700 p-2"><Camera size={18} /></div>
                <span className="text-sm font-medium text-emerald-950">Foto</span>
                <span className="text-[11px] text-stone-400 text-left">Toma una foto del plato</span>
              </button>
              <button onClick={() => setModo("peso")} className="rounded-2xl bg-white border border-stone-200 p-4 flex flex-col items-start gap-2 hover:border-emerald-300">
                <div className="rounded-full bg-sky-50 text-sky-700 p-2"><Scale size={18} /></div>
                <span className="text-sm font-medium text-emerald-950">Peso</span>
                <span className="text-[11px] text-stone-400 text-left">Tu peso de hoy</span>
              </button>
              <button onClick={() => alert("En la app real: registra tipo, duración e intensidad de tu ejercicio.")} className="rounded-2xl bg-white border border-stone-200 p-4 flex flex-col items-start gap-2 hover:border-emerald-300">
                <div className="rounded-full bg-violet-50 text-violet-700 p-2"><Dumbbell size={18} /></div>
                <span className="text-sm font-medium text-emerald-950">Ejercicio</span>
                <span className="text-[11px] text-stone-400 text-left">Actividad física</span>
              </button>
            </div>
          </>
        )}

        {modo === "comida" && (
          <>
            <button onClick={() => { setModo("menu"); setEstimado(null); setTexto(""); }} className="text-stone-500 text-sm flex items-center gap-1 mb-3"><ChevronLeft size={16} />Atrás</button>
            <div style={display} className="text-lg text-emerald-950 mb-1">Describe tu comida</div>
            <div className="text-xs text-stone-400 mb-3">La IA estima sus calorías y macros al instante.</div>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
              placeholder="Ej. dos tacos de pollo con salsa verde y un vaso de agua de jamaica"
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-emerald-400 resize-none" />
            <button onClick={estimar} disabled={cargando}
              className="w-full mt-3 bg-emerald-900 text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50">
              {cargando ? <><Loader2 size={16} className="animate-spin" />Estimando…</> : <><Sparkles size={16} />Estimar con IA</>}
            </button>

            {estimado && (
              <div className="mt-4 rounded-2xl bg-white border border-stone-200 p-4">
                <div className="text-sm font-medium text-emerald-950 mb-3">{estimado.alimento}</div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-stone-400">Calorías estimadas</span>
                  <span style={mono} className="text-emerald-950">{estimado.calorias} kcal</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[["Proteína", estimado.proteina_g, "#0d9488"], ["Carbos", estimado.carbos_g, "#d97706"], ["Grasa", estimado.grasa_g, "#7c3aed"]].map(([l, v, c]) => (
                    <div key={l} className="rounded-lg bg-stone-50 py-2">
                      <div style={{ ...mono, color: c }} className="text-sm">{v}g</div>
                      <div className="text-[10px] text-stone-400">{l}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { onRegistrarComida(estimado); onClose(); }}
                  className="w-full mt-3 bg-emerald-50 text-emerald-800 rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} />Agregar a mi día
                </button>
              </div>
            )}
          </>
        )}

        {modo === "peso" && (
          <>
            <button onClick={() => setModo("menu")} className="text-stone-500 text-sm flex items-center gap-1 mb-3"><ChevronLeft size={16} />Atrás</button>
            <div style={display} className="text-lg text-emerald-950 mb-3">Registra tu peso</div>
            <div className="flex items-end gap-2">
              <input value={peso} onChange={(e) => setPeso(e.target.value)} type="number" placeholder="68.0"
                className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-3 text-2xl text-emerald-950 focus:outline-none focus:border-emerald-400" style={mono} />
              <span className="text-stone-400 pb-3">kg</span>
            </div>
            <button onClick={() => { if (peso) { onRegistrarPeso(parseFloat(peso)); onClose(); } }} disabled={!peso}
              className="w-full mt-4 bg-emerald-900 text-white rounded-xl py-3 text-sm font-medium disabled:opacity-50">Guardar peso</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ========== pantalla: PROGRESO ========== */
function Progreso({ paciente, historial }) {
  const min = Math.min(...historial.map((h) => h.peso)) - 1;
  const max = Math.max(...historial.map((h) => h.peso)) + 1;
  const norm = (p) => 1 - (p - min) / (max - min);
  const perdido = (historial[0].peso - paciente.pesoActual).toFixed(1);
  const falta = (paciente.pesoActual - paciente.pesoMeta).toFixed(1);

  const pts = historial.map((h, i) => `${(i / (historial.length - 1)) * 100},${norm(h.peso) * 100}`).join(" ");

  return (
    <div className="pb-4">
      <div className="px-5 pt-2 pb-3">
        <div style={display} className="text-2xl text-emerald-950 font-medium">Tu progreso</div>
      </div>

      <div className="mx-5 grid grid-cols-3 gap-3 mb-4">
        {[["Perdido", `${perdido} kg`, "text-emerald-700"], ["Actual", `${paciente.pesoActual} kg`, "text-emerald-950"], ["Falta", `${falta} kg`, "text-amber-600"]].map(([l, v, c]) => (
          <div key={l} className="rounded-2xl bg-white border border-stone-200 p-3 text-center">
            <div style={mono} className={`text-lg ${c}`}>{v}</div>
            <div className="text-[11px] text-stone-400">{l}</div>
          </div>
        ))}
      </div>

      {/* gráfica de peso */}
      <div className="mx-5 rounded-2xl bg-white border border-stone-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-emerald-950">Evolución de peso</span>
          <span className="text-[11px] text-stone-400">6 semanas</span>
        </div>
        <div className="relative h-32">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
            <polyline points={pts} fill="none" stroke="#065f46" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            {historial.map((h, i) => (
              <circle key={i} cx={(i / (historial.length - 1)) * 100} cy={norm(h.peso) * 100} r="1.6" fill="#065f46" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        </div>
        <div className="flex justify-between mt-2">
          {historial.map((h) => <span key={h.sem} className="text-[10px] text-stone-400">{h.sem}</span>)}
        </div>
      </div>

      {/* logros */}
      <div className="px-5 mb-2"><div style={display} className="text-lg text-emerald-950">Logros</div></div>
      <div className="mx-5 grid grid-cols-3 gap-3">
        {LOGROS.map((l, i) => (
          <div key={i} className={`rounded-2xl border p-3 flex flex-col items-center text-center gap-2 ${l.ganado ? "bg-white border-emerald-200" : "bg-stone-100 border-stone-200 opacity-60"}`}>
            <div className={`rounded-full p-2.5 ${l.ganado ? "bg-emerald-50 text-emerald-700" : "bg-stone-200 text-stone-400"}`}><l.icon size={18} /></div>
            <span className="text-[10px] text-stone-500 leading-tight">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== pantalla: MENSAJES ========== */
function Mensajes({ paciente, mensajes, setMensajes }) {
  const [texto, setTexto] = useState("");
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [mensajes]);

  const enviar = () => {
    if (!texto.trim()) return;
    const hora = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    setMensajes((m) => [...m, { de: "paciente", texto, hora }]);
    setTexto("");
    setTimeout(() => {
      setMensajes((m) => [...m, { de: "nutriologo", texto: "¡Gracias por avisarme, Camila! Lo reviso y te comento.", hora: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) }]);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-2 pb-3 border-b border-stone-200 flex items-center gap-3">
        <Avatar nombre={paciente.nutriologo} size={40} />
        <div>
          <div className="text-sm font-medium text-emerald-950">{paciente.nutriologo}</div>
          <div className="text-[11px] text-emerald-600 flex items-center gap-1"><ShieldCheck size={11} />Tu nutrióloga</div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-2.5">
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.de === "paciente" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${m.de === "paciente" ? "bg-emerald-900 text-white" : "bg-white border border-stone-200 text-emerald-950"}`}>
              {m.texto}
              <div className={`text-[10px] mt-1 ${m.de === "paciente" ? "text-emerald-300" : "text-stone-400"}`}>{m.hora}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-stone-200 flex items-center gap-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Escribe un mensaje…"
          className="flex-1 rounded-full border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
        <button onClick={enviar} className="bg-emerald-900 text-white rounded-full p-2.5"><Send size={18} /></button>
      </div>
    </div>
  );
}

/* ========== modal: COACH IA ========== */
function CoachIA({ paciente, onClose }) {
  const [hilo, setHilo] = useState([
    { de: "ia", texto: `¡Hola ${paciente.nombre.split(" ")[0]}! Soy tu coach. Puedo resolver dudas sobre tu plan, porciones o sustituciones. ¿En qué te ayudo?` },
  ]);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [hilo, cargando]);

  const preguntar = async (pregunta) => {
    const q = pregunta || texto;
    if (!q.trim()) return;
    setHilo((h) => [...h, { de: "paciente", texto: q }]);
    setTexto(""); setCargando(true);
    try {
      const prompt = `Eres el coach de nutrición dentro de una app, hablando con ${paciente.nombre}, cuyo objetivo es "${paciente.objetivo}" (meta diaria ${paciente.metaCalorias} kcal). Responde de forma breve, cálida y práctica (máx 3 frases). NO des diagnósticos médicos ni cambies su plan; para eso, remítela a su nutrióloga ${paciente.nutriologo}. Pregunta: "${q}"`;
      const r = await callClaude(prompt, 300);
      setHilo((h) => [...h, { de: "ia", texto: r.trim() }]);
    } catch {
      setHilo((h) => [...h, { de: "ia", texto: "No pude responder ahora. Intenta de nuevo en un momento." }]);
    } finally { setCargando(false); }
  };

  const sugeridas = ["¿Puedo cambiar la cena?", "¿Cuánta agua debo tomar?", "Tengo antojo de algo dulce"];

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-stone-50">
      <div className="px-4 pt-3 pb-3 border-b border-stone-200 flex items-center gap-3">
        <button onClick={onClose} className="text-stone-500"><ChevronLeft size={22} /></button>
        <div className="rounded-full bg-emerald-900 text-white p-1.5"><Sparkles size={16} /></div>
        <div>
          <div className="text-sm font-medium text-emerald-950">Tu coach</div>
          <div className="text-[11px] text-stone-400">Asistente con IA</div>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-2.5">
        {hilo.map((m, i) => (
          <div key={i} className={`flex ${m.de === "paciente" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.de === "paciente" ? "bg-emerald-900 text-white" : "bg-white border border-stone-200 text-emerald-950"}`}>{m.texto}</div>
          </div>
        ))}
        {cargando && <div className="flex justify-start"><div className="bg-white border border-stone-200 rounded-2xl px-3.5 py-2.5"><Loader2 size={16} className="animate-spin text-emerald-700" /></div></div>}
        {hilo.length <= 1 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {sugeridas.map((s) => (
              <button key={s} onClick={() => preguntar(s)} className="text-xs bg-white border border-stone-200 rounded-full px-3 py-1.5 text-stone-600 hover:border-emerald-300">{s}</button>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 pb-2 text-center text-[10px] text-stone-400">Orientación general. No sustituye a tu nutrióloga.</div>
      <div className="p-3 pt-0 flex items-center gap-2">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && preguntar()}
          placeholder="Escribe tu duda…"
          className="flex-1 rounded-full border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-400" />
        <button onClick={() => preguntar()} disabled={cargando} className="bg-emerald-900 text-white rounded-full p-2.5 disabled:opacity-50"><Send size={18} /></button>
      </div>
    </div>
  );
}

/* ========== pantalla: PERFIL ========== */
function Perfil({ paciente, onLogout }) {
  const progreso = Math.round(((PESO_HISTORIAL[0].peso - paciente.pesoActual) / (PESO_HISTORIAL[0].peso - paciente.pesoMeta)) * 100);
  return (
    <div className="pb-4">
      <div className="px-5 pt-4 pb-4 flex flex-col items-center">
        <Avatar nombre={paciente.nombre} size={76} />
        <div style={display} className="text-xl text-emerald-950 font-medium mt-3">{paciente.nombre}</div>
        <div className="text-xs text-stone-400 flex items-center gap-1 mt-0.5"><Target size={12} />{paciente.objetivo}</div>
      </div>

      <div className="mx-5 rounded-2xl bg-emerald-900 text-white p-4 mb-3">
        <div className="flex items-center justify-between text-sm mb-2">
          <span>Camino a tu meta</span>
          <span style={mono}>{progreso}%</span>
        </div>
        <div className="h-2 rounded-full bg-emerald-800 overflow-hidden">
          <div className="h-full bg-white rounded-full" style={{ width: `${progreso}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-emerald-300 mt-1.5">
          <span>{PESO_HISTORIAL[0].peso} kg</span><span>Meta {paciente.pesoMeta} kg</span>
        </div>
      </div>

      <div className="mx-5 rounded-2xl bg-white border border-stone-200 divide-y divide-stone-100">
        {[
          [User, "Mis datos", paciente.nombre],
          [Heart, "Nutrióloga", paciente.nutriologo],
          [Target, "Objetivo", paciente.objetivo],
          [Bell, "Recordatorios", "Activados"],
          [ShieldCheck, "Privacidad", "Datos protegidos"],
        ].map(([Icon, label, val], i) => (
          <button key={i} onClick={() => alert(`En la app real: pantalla de "${label}".`)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
            <Icon size={18} className="text-emerald-700 shrink-0" />
            <span className="text-sm text-emerald-950 flex-1">{label}</span>
            <span className="text-xs text-stone-400 truncate max-w-[45%]">{val}</span>
          </button>
        ))}
      </div>

      <button onClick={onLogout} className="mx-5 mt-4 w-[calc(100%-2.5rem)] rounded-2xl border border-stone-200 bg-white py-3 text-sm text-stone-500">Cerrar sesión</button>
      <div className="text-center text-[11px] text-stone-400 mt-4">nutria · prototipo de MVP</div>
    </div>
  );
}

/* ========== onboarding / login ========== */
function Onboarding({ onEnter }) {
  return (
    <div className="flex flex-col h-full bg-emerald-950 text-white p-8 justify-between">
      <div className="pt-12">
        <div style={display} className="text-4xl font-medium">nutria</div>
        <p className="text-emerald-300 text-sm mt-2">Tu plan, tu progreso y tu nutrióloga, siempre contigo.</p>
      </div>
      <div className="space-y-4">
        {[[Utensils, "Tu plan del día", "Comidas, porciones y recordatorios."], [Sparkles, "Registro con IA", "Describe lo que comes y calcula tus macros."], [TrendingUp, "Sigue tu avance", "Peso, rachas y logros que te motivan."]].map(([Icon, t, d], i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="rounded-full bg-emerald-900 p-2.5"><Icon size={18} /></div>
            <div><div className="text-sm font-medium">{t}</div><div className="text-xs text-emerald-300">{d}</div></div>
          </div>
        ))}
      </div>
      <div>
        <button onClick={onEnter} className="w-full bg-white text-emerald-950 rounded-xl py-3.5 text-sm font-medium">Entrar</button>
        <div className="text-center text-[11px] text-emerald-400 mt-3">Prototipo de MVP · datos de ejemplo</div>
      </div>
    </div>
  );
}

/* ========== navegación inferior ========== */
function BottomNav({ tab, setTab, onRegistrar }) {
  const items = [["hoy", Home, "Hoy"], ["plan", CalendarDays, "Plan"], ["registrar", Plus, ""], ["progreso", TrendingUp, "Progreso"], ["mensajes", MessageCircle, "Mensajes"]];
  return (
    <div className="border-t border-stone-200 bg-white flex items-center justify-around px-2 pt-2 pb-3">
      {items.map(([k, Icon, label]) =>
        k === "registrar" ? (
          <button key={k} onClick={onRegistrar} className="-mt-6 rounded-full bg-emerald-900 text-white p-3.5 shadow-lg shadow-emerald-900/30">
            <Plus size={24} />
          </button>
        ) : (
          <button key={k} onClick={() => setTab(k)} className="flex flex-col items-center gap-0.5 flex-1">
            <Icon size={22} className={tab === k ? "text-emerald-900" : "text-stone-400"} />
            <span className={`text-[10px] ${tab === k ? "text-emerald-900 font-medium" : "text-stone-400"}`}>{label}</span>
          </button>
        )
      )}
    </div>
  );
}

/* ========== app ========== */
export default function App() {
  useGoogleFonts();
  const [entrado, setEntrado] = useState(false);
  const [tab, setTab] = useState("hoy");
  const [paciente, setPaciente] = useState(PACIENTE_INICIAL);
  const [plan, setPlan] = useState(PLAN_INICIAL);
  const [recetas, setRecetas] = useState(RECETAS_INICIALES);
  const [mensajes, setMensajes] = useState(MENSAJES_INICIALES);
  const [historial, setHistorial] = useState(PESO_HISTORIAL);
  const [agua, setAgua] = useState(4);
  const [showRegistrar, setShowRegistrar] = useState(false);
  const [showCoach, setShowCoach] = useState(false);

  const registrarComida = (est) => {
    setPlan((p) => [...p, {
      id: Date.now(), nombre: "Registro", horario: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
      descripcion: est.alimento, porcion: "registrado por ti", calorias: est.calorias, hecha: true,
    }]);
    setTab("hoy");
  };
  const registrarPeso = (kg) => {
    setPaciente((p) => ({ ...p, pesoActual: kg }));
    setHistorial((h) => [...h.slice(0, -1), { sem: h[h.length - 1].sem, peso: kg }]);
    setTab("progreso");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ ...sans, background: "linear-gradient(160deg,#064e3b,#1c1917)" }}>
      {/* marco de teléfono */}
      <div className="relative bg-stone-50 rounded-[2.75rem] overflow-hidden border-[10px] border-stone-900 shadow-2xl"
        style={{ width: 390, height: 800 }}>
        {/* notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-stone-900 rounded-b-2xl z-50" />

        {!entrado ? (
          <Onboarding onEnter={() => setEntrado(true)} />
        ) : (
          <div className="flex flex-col h-full">
            {/* status bar */}
            <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] text-stone-500 shrink-0" style={mono}>
              <span>9:41</span>
              <span className="flex items-center gap-1">nutria</span>
            </div>

            {/* contenido */}
            <div className="flex-1 overflow-auto min-h-0">
              {tab === "hoy" && <Hoy paciente={paciente} plan={plan} setPlan={setPlan} agua={agua} setAgua={setAgua} onCoach={() => setShowCoach(true)} />}
              {tab === "plan" && <PlanTab plan={plan.filter((c) => c.nombre !== "Registro")} recetas={recetas} setRecetas={setRecetas} />}
              {tab === "progreso" && <Progreso paciente={paciente} historial={historial} />}
              {tab === "mensajes" && <Mensajes paciente={paciente} mensajes={mensajes} setMensajes={setMensajes} />}
              {tab === "perfil" && <Perfil paciente={paciente} onLogout={() => { setEntrado(false); setTab("hoy"); }} />}
            </div>

            {/* acceso a perfil desde encabezado flotante */}
            {tab !== "perfil" && tab !== "mensajes" && (
              <button onClick={() => setTab("perfil")} className="absolute top-9 right-5 z-20">
                <Avatar nombre={paciente.nombre} size={34} />
              </button>
            )}

            <BottomNav tab={tab} setTab={setTab} onRegistrar={() => setShowRegistrar(true)} />
          </div>
        )}

        {showRegistrar && <RegistrarSheet onClose={() => setShowRegistrar(false)} onRegistrarComida={registrarComida} onRegistrarPeso={registrarPeso} />}
        {showCoach && <CoachIA paciente={paciente} onClose={() => setShowCoach(false)} />}
      </div>
    </div>
  );
}
