import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useServerFn, createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast, Toaster } from "sonner";
import {
  Shield,
  Lock,
  Send,
  UserCheck,
  UserX,
  CheckCircle2,
  MessageSquare,
  Mail,
  ChevronDown,
  Copy,
  Lightbulb,
  ThumbsUp,
  AlertTriangle,
  Megaphone,
  ArrowRight,
  Clock,
  Eye,
  FileText,
  HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: OuvidoriaPage,
  head: () => ({
    meta: [
      { title: "Ouvidoria AGS Telecom — Sua voz é importante" },
      {
        name: "description",
        content:
          "Canal oficial da Ouvidoria AGS Telecom. Envie sua manifestação de forma segura, identificada ou anônima. Resposta rápida e sigilosa.",
      },
      { property: "og:title", content: "Ouvidoria AGS Telecom" },
      { property: "og:description", content: "Canal oficial e seguro para manifestações." },
    ],
  }),
});

type Step = "choose" | "identify" | "message" | "done";

type Category = "sugestao" | "elogio" | "reclamacao" | "denuncia" | null;

const CATEGORIES = [
  { id: "sugestao" as const, label: "Sugestão", icon: Lightbulb, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200", activeBg: "bg-amber-100" },
  { id: "elogio" as const, label: "Elogio", icon: ThumbsUp, color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200", activeBg: "bg-emerald-100" },
  { id: "reclamacao" as const, label: "Reclamação", icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-50", border: "border-rose-200", activeBg: "bg-rose-100" },
  { id: "denuncia" as const, label: "Denúncia", icon: Megaphone, color: "text-purple-500", bg: "bg-purple-50", border: "border-purple-200", activeBg: "bg-purple-100" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  sugestao: "Sugestão",
  elogio: "Elogio",
  reclamacao: "Reclamação",
  denuncia: "Denúncia",
};

const submitSchema = z
  .object({
    isAnonymous: z.boolean(),
    name: z.string().trim().max(200).optional().nullable(),
    role: z.string().trim().max(200).optional().nullable(),
    message: z
      .string()
      .trim()
      .min(10, "A mensagem deve ter pelo menos 10 caracteres")
      .max(5000),
    website: z.string().max(0).optional().or(z.literal("")).optional(),
  })
  .refine(
    (d) => d.isAnonymous || (d.name && d.name.trim().length >= 2),
    { message: "Nome obrigatório para mensagens identificadas", path: ["name"] }
  );

export const submitOuvidoria = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    console.log("--- Iniciando processamento no Servidor ---");
    if (data.website && data.website.length > 0) {
      return { success: true, id: "spam", protocol: "BLOCKED", emailSent: false };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Backend não configurado");
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const id = crypto.randomUUID();
    const name = data.isAnonymous ? null : (data.name?.trim() || null);
    const role = data.isAnonymous ? null : (data.role?.trim() || null);
    const messageText = data.message.trim();

    const { error } = await supabase.from("ouvidoria_messages").insert({
      id,
      is_anonymous: data.isAnonymous,
      name,
      role,
      message: messageText,
    });

    if (error) throw new Error(`Erro no banco: ${error.message}`);
    
    const protocol = id.slice(0, 8).toUpperCase();
    console.log(`✅ [SUCESSO] Registro salvo no Supabase. Protocolo: ${protocol}`);
    const receivedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    return { success: true, id, protocol };
  });

const FAQ_ITEMS = [
  {
    q: "Como a ouvidoria garante o meu anonimato?",
    a: "Quando você escolhe enviar sua manifestação de forma anônima, nenhum dado de identificação é coletado ou armazenado. O sistema não registra IP, cookies ou qualquer informação que possa identificá-lo.",
  },
  {
    q: "Qual o prazo para receber uma resposta?",
    a: "Manifestações identificadas recebem retorno em até 7 dias úteis. Manifestações anônimas são analisadas internamente, mas não possuem canal de retorno direto.",
  },
  {
    q: "O que acontece após eu enviar minha manifestação?",
    a: "Sua mensagem é registrada com um protocolo único e encaminhada diretamente à equipe da ouvidoria, que fará a análise e tomará as providências cabíveis com total sigilo.",
  },
  {
    q: "Posso acompanhar minha manifestação pelo protocolo?",
    a: "Atualmente o protocolo serve como comprovante de registro. Para acompanhar o andamento, entre em contato pelo e-mail ouvidoria@agstelecom.com.br informando o número do protocolo.",
  },
];

function OuvidoriaPage() {
  const submit = useServerFn(submitOuvidoria);
  const [step, setStep] = useState<Step>("choose");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>(null);
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleChoice = (anon: boolean) => {
    setIsAnonymous(anon);
    setStep(anon ? "message" : "identify");
  };

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Por favor, informe seu nome.");
      return;
    }
    setStep("message");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) {
      toast.error("Selecione uma categoria para sua manifestação.");
      return;
    }
    if (message.trim().length < 10) {
      toast.error("A mensagem deve ter pelo menos 10 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const catLabel = CATEGORY_LABELS[category] || "";
      const fullMessage = `[${catLabel}]\n\n${message}`;
      const res = await submit({
        data: {
          isAnonymous,
          name: isAnonymous ? null : name,
          role: isAnonymous ? null : role,
          message: fullMessage,
          website,
        },
      });

      const finalProtocol = res.protocol ?? res.id.slice(0, 8).toUpperCase();
      setProtocol(finalProtocol);
      setStep("done");

      // Chamada do Web3Forms com Design Executivo Clean
      const WEB3FORMS_KEY = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY;
      if (WEB3FORMS_KEY) {
        const now = new Date();
        const dateStr = now.toLocaleDateString("pt-BR");
        const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        
        const emailBody = [
          "◈ RELATÓRIO DE OUVIDORIA AGS TELECOM ◈",
          " ",
          "Prezado Gestor,",
          "Uma nova manifestação foi registrada no portal oficial. Seguem os dados para análise:",
          " ",
          "🟦 DADOS DO PROTOCOLO",
          "──────────────────────────",
          `• N° Protocolo:   ${finalProtocol}`,
          `• Data/Hora:      ${dateStr} às ${timeStr}`,
          `• Categoria:      ${category ? CATEGORY_LABELS[category] : "Não informada"}`,
          `• Tipo:           ${isAnonymous ? "Anônima" : "Identificada"}`,
          " ",
          ...(!isAnonymous ? [
            "🟩 DADOS DO MANIFESTANTE",
            "──────────────────────────",
            `• Nome:           ${name || "—"}`,
            `• Cargo/Função:   ${role || "—"}`,
            " ",
          ] : []),
          "🟧 CONTEÚDO DA MANIFESTAÇÃO",
          "──────────────────────────",
          message,
          " ",
          "──────────────────────────",
          "Fim da Notificação Automática",
        ].join("\n");

        const formData = new FormData();
        formData.append("access_key", WEB3FORMS_KEY);
        formData.append("from_name", "AGS Telecom - Ouvidoria");
        formData.append("subject", `[NOVA OUVIDORIA] Protocolo: ${finalProtocol}`);
        formData.append("message", emailBody);

        fetch("https://api.web3forms.com/submit", {
          method: "POST",
          body: formData,
        }).catch(err => console.error("Erro ao enviar e-mail:", err));
      }
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível enviar sua mensagem. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const copyProtocol = async () => {
    if (!protocol) return;
    try {
      await navigator.clipboard.writeText(protocol);
      toast.success("Protocolo copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const reset = () => {
    setStep("choose");
    setIsAnonymous(false);
    setName("");
    setRole("");
    setMessage("");
    setCategory(null);
    setProtocol(null);
  };

  const stepNumber = step === "choose" ? 1 : step === "identify" ? 2 : step === "message" ? (isAnonymous ? 2 : 3) : 0;
  const totalSteps = isAnonymous ? 2 : 3;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--gradient-soft)" }}>
      <Toaster position="top-center" richColors />

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-20 border-b border-border/30" style={{ background: "rgba(255,255,255,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: "var(--gradient-hero)" }}>
              AGS
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground leading-tight">AGS Telecom</h1>
              <p className="text-[11px] text-muted-foreground tracking-wide uppercase">Ouvidoria</p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a href="#manifestar" className="hover:text-brand transition-colors">Manifestar</a>
            <a href="#como-funciona" className="hover:text-brand transition-colors">Como Funciona</a>
            <a href="#faq" className="hover:text-brand transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="w-3.5 h-3.5 text-brand" />
            <span className="hidden sm:inline">Canal seguro</span>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative overflow-hidden py-16 md:py-24">
        {/* Decorative blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: "var(--gradient-hero)" }} />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full opacity-10 blur-3xl pointer-events-none" style={{ background: "oklch(0.55 0.16 220)" }} />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-soft text-brand text-xs font-semibold mb-6 border border-brand/10">
            <Shield className="w-3.5 h-3.5" />
            Conformidade LGPD · Sigilo absoluto
          </div>
          <h2 className="text-4xl md:text-6xl font-extrabold text-foreground tracking-tight leading-[1.1] mb-5">
            Sua voz constrói<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-hero)" }}>uma AGS melhor.</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Envie sugestões, elogios, reclamações ou denúncias. Toda mensagem é lida pela ouvidoria e tratada com responsabilidade e sigilo.
          </p>
          <Button size="lg" className="bg-brand text-brand-foreground hover:bg-brand/90 gap-2 text-base px-8 rounded-full shadow-lg" onClick={scrollToForm}>
            Fazer manifestação
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="como-funciona" className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: FileText, title: "1. Registre", desc: "Escolha se quer se identificar ou manter o anonimato, selecione a categoria e escreva sua mensagem." },
            { icon: Eye, title: "2. Análise", desc: "Sua manifestação é encaminhada à equipe da ouvidoria com total sigilo para análise e providências." },
            { icon: Clock, title: "3. Retorno", desc: "Manifestações identificadas recebem resposta em até 7 dias úteis pelo canal indicado." },
          ].map((item) => (
            <div key={item.title} className="group relative rounded-2xl border border-border/50 p-6 transition-all duration-300 hover:border-brand/30 hover:-translate-y-1" style={{ background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }}>
              <div className="w-11 h-11 rounded-xl bg-brand-soft flex items-center justify-center text-brand mb-4 group-hover:scale-110 transition-transform duration-300">
                <item.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-foreground mb-1.5">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FORM CARD ─── */}
      <section id="manifestar" className="max-w-3xl mx-auto px-6 pb-20 w-full">
        <div ref={formRef} className="rounded-3xl border border-border/50 overflow-hidden" style={{ background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)", boxShadow: "var(--shadow-elegant)" }}>

          {/* Progress bar */}
          {step !== "done" && (
            <div className="px-8 pt-8 pb-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">Etapa {stepNumber} de {totalSteps}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${(stepNumber / totalSteps) * 100}%`, background: "var(--gradient-hero)" }} />
              </div>
            </div>
          )}

          {/* ── Step: Choose ── */}
          {step === "choose" && (
            <div className="p-8 md:p-12">
              <div className="mb-8 text-center">
                <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">Como deseja se manifestar?</h3>
                <p className="text-sm text-muted-foreground">Você pode se identificar ou enviar de forma totalmente anônima.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <button onClick={() => handleChoice(false)} className="group text-left p-6 rounded-2xl border-2 border-border/60 hover:border-brand transition-all duration-300 hover:shadow-lg bg-white/60">
                  <div className="w-12 h-12 rounded-xl bg-brand-soft flex items-center justify-center text-brand mb-4 group-hover:scale-110 transition-transform duration-300">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">Quero me identificar</h4>
                  <p className="text-sm text-muted-foreground">Receba retorno personalizado em até 7 dias úteis.</p>
                </button>
                <button onClick={() => handleChoice(true)} className="group text-left p-6 rounded-2xl border-2 border-border/60 hover:border-brand transition-all duration-300 hover:shadow-lg bg-white/60">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-foreground mb-4 group-hover:scale-110 transition-transform duration-300">
                    <UserX className="w-6 h-6" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1">Prefiro o anonimato</h4>
                  <p className="text-sm text-muted-foreground">Sua mensagem chega sem qualquer dado de identificação.</p>
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Identify ── */}
          {step === "identify" && (
            <form onSubmit={handleIdentify} className="p-8 md:p-12">
              <button type="button" onClick={() => setStep("choose")} className="text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
                ← Voltar
              </button>
              <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">Identificação</h3>
              <p className="text-sm text-muted-foreground mb-8">Seus dados ficam protegidos e são acessados apenas pela equipe da ouvidoria.</p>
              <div className="space-y-5">
                <div>
                  <Label htmlFor="name" className="mb-2 block">Nome completo <span className="text-brand">*</span></Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Maria Silva" maxLength={200} autoFocus className="bg-white/80" />
                </div>
                <div>
                  <Label htmlFor="role" className="mb-2 block">Cargo / Função</Label>
                  <Input id="role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex: Cliente, Colaborador, Fornecedor" maxLength={200} className="bg-white/80" />
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full mt-8 bg-brand text-brand-foreground hover:bg-brand/90 rounded-xl">
                Continuar <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </form>
          )}

          {/* ── Step: Message ── */}
          {step === "message" && (
            <form onSubmit={handleSubmit} className="p-8 md:p-12">
              <button type="button" onClick={() => setStep(isAnonymous ? "choose" : "identify")} className="text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
                ← Voltar
              </button>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-xl md:text-2xl font-bold text-foreground">Sua mensagem</h3>
                {isAnonymous && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Anônima</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-6">Selecione a categoria e descreva sua manifestação com detalhes.</p>

              {/* Categories */}
              <div className="mb-6">
                <Label className="mb-3 block">Categoria <span className="text-brand">*</span></Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {CATEGORIES.map((cat) => {
                    const active = category === cat.id;
                    return (
                      <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 text-sm font-medium ${active ? `${cat.activeBg} ${cat.border} ${cat.color} scale-[1.03] shadow-sm` : `bg-white/60 border-border/50 text-muted-foreground hover:border-border hover:bg-white/80`}`}
                      >
                        <cat.icon className={`w-5 h-5 ${active ? cat.color : "text-muted-foreground"}`} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label htmlFor="message" className="mb-2 block">Mensagem <span className="text-brand">*</span></Label>
                <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Conte-nos o que aconteceu, sua sugestão ou elogio…" rows={7} maxLength={5000} autoFocus className="resize-none bg-white/80" />
                <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                  <span>Mínimo 10 caracteres</span>
                  <span className={message.length >= 10 ? "text-success" : ""}>{message.length} / 5.000</span>
                </div>
              </div>

              {/* Honeypot anti-spam — não remover */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}>
                <label htmlFor="website">Não preencha este campo</label>
                <input id="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              <Button type="submit" size="lg" disabled={loading} className="w-full mt-8 bg-brand text-brand-foreground hover:bg-brand/90 rounded-xl gap-2">
                {loading ? "Enviando…" : (<><Send className="w-4 h-4" /> Enviar mensagem</>)}
              </Button>
            </form>
          )}

          {/* ── Step: Done ── */}
          {step === "done" && (
            <div className="p-8 md:p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-6 animate-bounce" style={{ animationDuration: "1.5s", animationIterationCount: "2" }}>
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Mensagem recebida!</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Sua manifestação foi registrada com sucesso e encaminhada à ouvidoria. Agradecemos a sua confiança.
              </p>
              {protocol && (
                <div className="inline-flex items-center gap-3 bg-brand-soft text-brand px-5 py-3 rounded-xl text-sm font-mono mb-8 border border-brand/10">
                  <span>Protocolo: <strong>{protocol}</strong></span>
                  <button onClick={copyProtocol} className="p-1.5 rounded-lg hover:bg-brand/10 transition-colors" title="Copiar protocolo">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex justify-center">
                <Button variant="outline" onClick={reset} size="lg" className="rounded-xl">
                  Enviar outra mensagem
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="max-w-3xl mx-auto px-6 pb-20 w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-soft text-brand text-xs font-semibold mb-4 border border-brand/10">
            <HelpCircle className="w-3.5 h-3.5" />
            Dúvidas frequentes
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">Perguntas Frequentes</h2>
        </div>
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="rounded-2xl border border-border/50 overflow-hidden transition-all duration-300" style={{ background: "rgba(255,255,255,0.65)", backdropFilter: "blur(8px)" }}>
              <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 text-left">
                <span className="font-medium text-foreground text-sm md:text-base pr-4">{item.q}</span>
                <ChevronDown className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}>
                <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── TRUST STRIP ─── */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: Lock, title: "Sigilo garantido", desc: "Suas informações são tratadas com total confidencialidade." },
            { icon: MessageSquare, title: "Resposta rápida", desc: "Manifestações identificadas recebem retorno em até 7 dias úteis." },
            { icon: Shield, title: "Canal independente", desc: "A ouvidoria atua com imparcialidade, ética e transparência." },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 p-5 rounded-2xl border border-border/40 transition-all duration-300 hover:border-brand/20" style={{ background: "rgba(255,255,255,0.5)" }}>
              <item.icon className="w-5 h-5 text-brand mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground text-sm">{item.title}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="mt-auto border-t border-border/30" style={{ background: "rgba(255,255,255,0.5)" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} AGS Telecom. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6">
            <a href="mailto:ouvidoria@agstelecom.com.br" className="flex items-center gap-1.5 hover:text-brand transition-colors">
              <Mail className="w-3.5 h-3.5" />
              <span>ouvidoria@agstelecom.com.br</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
