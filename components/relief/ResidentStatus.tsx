"use client";

import React, { useState } from "react";
import Link from "next/link";
import { I } from "@/components/icons";

/**
 * Resident "Check my payment" — plain language, five languages.
 * Reads the real case API; "I received it" / "I can't get to it" are saved as RESIDENT-REPORTED
 * evidence. They never change PayPal's status and are never presented as PayPal confirmation.
 */

type Copy = {
  title: string;
  placeholder: string;
  search: string;
  demo: string;
  notFound: string;
  steps: Record<"APPROVED" | "SENT" | "CREDITED" | "CONFIRMED" | "CLOSED", string>;
  received: string;
  cant: string;
  problem: string;
  reasons: Record<"NO_PAYPAL_ACCOUNT" | "CANT_SIGN_IN" | "NO_PHONE" | "LANGUAGE" | "OTHER", string>;
  send: string;
  thanks: string;
  selfReport: string;
  daysLeft: (n: number) => string;
  claim: string;
  moreHelp: string;
};

const COPY: Record<string, Copy> = {
  en: {
    title: "Check my payment",
    placeholder: "Your reference (e.g. hh_tbw_002)",
    search: "Check",
    demo: "Try a demo reference",
    notFound: "We couldn’t find that reference. Check it and try again.",
    steps: { APPROVED: "Approved", SENT: "Sent to PayPal", CREDITED: "PayPal credited it", CONFIRMED: "You confirmed", CLOSED: "Closed" },
    received: "I received it",
    cant: "I can’t get to it",
    problem: "What’s the problem?",
    reasons: { NO_PAYPAL_ACCOUNT: "I don’t have a PayPal account", CANT_SIGN_IN: "I can’t sign in", NO_PHONE: "I don’t have a phone", LANGUAGE: "I need help in my language", OTHER: "Something else" },
    send: "Send to the coordinator",
    thanks: "Thank you. A coordinator will follow up. You don’t need to do anything else.",
    selfReport: "What you tell us is saved as “reported by you”. We never treat it as PayPal’s confirmation.",
    daysLeft: (n) => `${n} days left to claim`,
    claim: "Claim on PayPal",
    moreHelp: "Need more help? Report a problem",
  },
  es: {
    title: "Consultar mi pago",
    placeholder: "Su referencia (ej. hh_tbw_002)",
    search: "Consultar",
    demo: "Pruebe una referencia de demostración",
    notFound: "No encontramos esa referencia. Revísela e inténtelo de nuevo.",
    steps: { APPROVED: "Aprobado", SENT: "Enviado a PayPal", CREDITED: "PayPal lo acreditó", CONFIRMED: "Usted confirmó", CLOSED: "Cerrado" },
    received: "Lo recibí",
    cant: "No puedo acceder",
    problem: "¿Cuál es el problema?",
    reasons: { NO_PAYPAL_ACCOUNT: "No tengo cuenta de PayPal", CANT_SIGN_IN: "No puedo iniciar sesión", NO_PHONE: "No tengo teléfono", LANGUAGE: "Necesito ayuda en mi idioma", OTHER: "Otro problema" },
    send: "Enviar al coordinador",
    thanks: "Gracias. Un coordinador le contactará. No necesita hacer nada más.",
    selfReport: "Lo que nos diga se guarda como “informado por usted”. Nunca se trata como confirmación de PayPal.",
    daysLeft: (n) => `Quedan ${n} días para reclamarlo`,
    claim: "Reclamar en PayPal",
    moreHelp: "¿Necesita más ayuda? Informe un problema",
  },
  ht: {
    title: "Tcheke peman mwen",
    placeholder: "Referans ou (egz. hh_tbw_002)",
    search: "Tcheke",
    demo: "Eseye yon referans demo",
    notFound: "Nou pa jwenn referans sa a. Verifye l epi eseye ankò.",
    steps: { APPROVED: "Apwouve", SENT: "Voye bay PayPal", CREDITED: "PayPal kredite l", CONFIRMED: "Ou konfime", CLOSED: "Fèmen" },
    received: "Mwen resevwa l",
    cant: "Mwen pa ka jwenn li",
    problem: "Ki pwoblèm lan?",
    reasons: { NO_PAYPAL_ACCOUNT: "Mwen pa gen kont PayPal", CANT_SIGN_IN: "Mwen pa ka konekte", NO_PHONE: "Mwen pa gen telefòn", LANGUAGE: "Mwen bezwen èd nan lang mwen", OTHER: "Yon lòt bagay" },
    send: "Voye bay kowòdonatè a",
    thanks: "Mèsi. Yon kowòdonatè pral kontakte w. Ou pa bezwen fè anyen ankò.",
    selfReport: "Sa w di nou anrejistre kòm “rapòte pa ou”. Nou pa janm konsidere l kòm konfimasyon PayPal.",
    daysLeft: (n) => `Rete ${n} jou pou reklame l`,
    claim: "Reklame sou PayPal",
    moreHelp: "Ou bezwen plis èd? Rapòte yon pwoblèm",
  },
  vi: {
    title: "Kiểm tra khoản thanh toán của tôi",
    placeholder: "Mã tham chiếu (ví dụ: hh_tbw_002)",
    search: "Kiểm tra",
    demo: "Thử mã tham chiếu demo",
    notFound: "Chúng tôi không tìm thấy mã này. Hãy kiểm tra và thử lại.",
    steps: { APPROVED: "Đã duyệt", SENT: "Đã gửi tới PayPal", CREDITED: "PayPal đã ghi có", CONFIRMED: "Bạn đã xác nhận", CLOSED: "Đã đóng" },
    received: "Tôi đã nhận được",
    cant: "Tôi không truy cập được",
    problem: "Vấn đề là gì?",
    reasons: { NO_PAYPAL_ACCOUNT: "Tôi không có tài khoản PayPal", CANT_SIGN_IN: "Tôi không đăng nhập được", NO_PHONE: "Tôi không có điện thoại", LANGUAGE: "Tôi cần hỗ trợ bằng ngôn ngữ của mình", OTHER: "Vấn đề khác" },
    send: "Gửi cho điều phối viên",
    thanks: "Cảm ơn bạn. Điều phối viên sẽ liên hệ. Bạn không cần làm gì thêm.",
    selfReport: "Những gì bạn báo được lưu là “do bạn báo cáo”. Chúng tôi không coi đó là xác nhận của PayPal.",
    daysLeft: (n) => `Còn ${n} ngày để nhận`,
    claim: "Nhận trên PayPal",
    moreHelp: "Cần thêm trợ giúp? Báo cáo sự cố",
  },
  zh: {
    title: "查询我的款项",
    placeholder: "您的编号（例如 hh_tbw_002）",
    search: "查询",
    demo: "试试演示编号",
    notFound: "找不到该编号，请检查后重试。",
    steps: { APPROVED: "已批准", SENT: "已发送至 PayPal", CREDITED: "PayPal 已入账", CONFIRMED: "您已确认", CLOSED: "已结案" },
    received: "我已收到",
    cant: "我无法使用",
    problem: "遇到什么问题？",
    reasons: { NO_PAYPAL_ACCOUNT: "我没有 PayPal 账户", CANT_SIGN_IN: "我无法登录", NO_PHONE: "我没有手机", LANGUAGE: "我需要用我的语言获得协助", OTHER: "其他问题" },
    send: "发送给协调员",
    thanks: "谢谢。协调员会与您联系，您无需再做任何事。",
    selfReport: "您告诉我们的内容会保存为“由您报告”，我们不会将其视为 PayPal 的确认。",
    daysLeft: (n) => `还剩 ${n} 天可领取`,
    claim: "在 PayPal 领取",
    moreHelp: "需要更多帮助？报告问题",
  },
};

type View = {
  caseRef: string;
  householdRef: string;
  name: string;
  amountUsd: number;
  paypalStatus: string;
  steps: { key: keyof Copy["steps"]; reached: boolean }[];
  claimDaysLeft: number | null;
  plainStatus: string;
  tone: "good" | "info" | "warn" | "bad";
  barrier: string | null;
  canReport: boolean;
};

const TONE_CLASS: Record<View["tone"], string> = {
  good: "border-accent/30 bg-accent/[0.08] text-accent-strong",
  info: "border-paypal/30 bg-paypal/[0.08] text-ink",
  warn: "border-amber/30 bg-amber/[0.08] text-ink",
  bad: "border-danger/30 bg-danger/[0.08] text-ink",
};

export function ResidentStatus({ lang }: { lang: string }) {
  const c = COPY[lang] ?? COPY.en;
  const [ref, setRef] = useState("");
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [askProblem, setAskProblem] = useState(false);
  const [reason, setReason] = useState<keyof Copy["reasons"]>("NO_PAYPAL_ACCOUNT");
  const [sent, setSent] = useState(false);

  const lookup = async (value: string) => {
    setRef(value);
    setLoading(true);
    setError(null);
    setSent(false);
    setAskProblem(false);
    try {
      const res = await fetch(`/api/recipients/case?ref=${encodeURIComponent(value.trim())}`);
      if (!res.ok) throw new Error("nf");
      setView(await res.json());
    } catch {
      setView(null);
      setError(c.notFound);
    } finally {
      setLoading(false);
    }
  };

  const report = async (kind: "RECEIVED" | "CANT_ACCESS") => {
    if (!view) return;
    setLoading(true);
    try {
      const res = await fetch("/api/recipients/access-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseRef: view.caseRef, kind, reason: kind === "CANT_ACCESS" ? reason : undefined }),
      });
      if (res.ok) {
        const j = await res.json();
        setView(j.case);
        setSent(true);
        setAskProblem(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass space-y-6 p-6 sm:p-8">
      <div>
        <h2 className="text-title-2 text-ink">{c.title}</h2>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ref.trim()) lookup(ref);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <I.search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={c.placeholder} className="field-input pl-10" aria-label={c.title} />
        </div>
        <button type="submit" className="field-btn field-btn-primary" disabled={loading || !ref.trim()}>
          {c.search}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink-3">
        <span>{c.demo}:</span>
        {["hh_tbw_002", "hh_tbw_004", "hh_clw_005"].map((d) => (
          <button key={d} type="button" onClick={() => lookup(d)} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11.5px] text-ink-2 transition-colors hover:border-accent/40 hover:text-ink">
            {d}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3.5 text-[13px] text-danger" role="alert">
          <I.alert className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {view && (
        <div className="space-y-5 animate-field-fade" data-testid="resident-case">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-[17px] font-semibold text-ink">{view.name}</div>
              <div className="font-mono text-[11px] text-ink-3">{view.caseRef}</div>
            </div>
            <div className="text-[28px] font-semibold tracking-[-0.03em] text-ink tabular">${view.amountUsd}</div>
          </div>

          <ol className="grid grid-cols-5 gap-1.5" aria-label="Payment progress">
            {view.steps.map((s) => (
              <li key={s.key} className="space-y-2">
                <span className={`block h-1.5 rounded-full ${s.reached ? (s.key === "CREDITED" ? "bg-paypal" : "bg-accent") : "bg-white/10"}`} />
                <span className={`flex items-start gap-1 text-[11px] leading-tight ${s.reached ? "text-ink" : "text-ink-3"}`}>
                  {s.reached && <I.check className="mt-px h-3 w-3 shrink-0 text-accent-strong" strokeWidth={2.5} />}
                  {c.steps[s.key]}
                </span>
              </li>
            ))}
          </ol>

          <p className={`rounded-2xl border p-4 text-[14.5px] leading-relaxed ${TONE_CLASS[view.tone]}`} data-testid="resident-plain-status">
            {view.plainStatus}
          </p>

          {view.claimDaysLeft !== null && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber/25 bg-amber/[0.06] p-3.5 text-[13px] text-amber">
              <span>{c.daysLeft(view.claimDaysLeft)}</span>
              <a href="https://www.paypal.com/signin" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold underline">
                {c.claim} <I.external className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {sent ? (
            <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/[0.08] p-4 text-[14px] text-ink" role="status">
              <I.relief className="mt-0.5 h-5 w-5 shrink-0 text-accent-strong" /> {c.thanks}
            </div>
          ) : (
            view.canReport && (
              <div className="space-y-3">
                {!askProblem ? (
                  <div className="flex flex-wrap gap-2">
                    {view.paypalStatus === "SUCCESS" && !view.barrier && (
                      <button onClick={() => report("RECEIVED")} disabled={loading} className="field-btn field-btn-primary" data-testid="btn-received">
                        <I.check className="h-4 w-4" /> {c.received}
                      </button>
                    )}
                    <button onClick={() => setAskProblem(true)} className="field-btn field-btn-secondary" data-testid="btn-cant-access">
                      <I.needHelp className="h-4 w-4" /> {c.cant}
                    </button>
                  </div>
                ) : (
                  <fieldset className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <legend className="px-1 text-[13px] font-semibold text-ink">{c.problem}</legend>
                    {(Object.keys(c.reasons) as (keyof Copy["reasons"])[]).map((k) => (
                      <label key={k} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-[14px] text-ink hover:bg-white/[0.04]">
                        <input type="radio" name="reason" checked={reason === k} onChange={() => setReason(k)} />
                        {c.reasons[k]}
                      </label>
                    ))}
                    <button onClick={() => report("CANT_ACCESS")} disabled={loading} className="field-btn field-btn-primary mt-1" data-testid="btn-send-problem">
                      {c.send}
                    </button>
                  </fieldset>
                )}
                <p className="text-[12px] text-ink-3">{c.selfReport}</p>
              </div>
            )
          )}

          <Link href={`/r/complaints?case=${encodeURIComponent(view.caseRef)}`} className="inline-flex text-[13px] text-accent-strong underline-offset-4 hover:underline">
            {c.moreHelp}
          </Link>
        </div>
      )}
    </div>
  );
}
