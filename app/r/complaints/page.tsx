"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { type ComplaintCategory } from "@/lib/recipients/complaints";
import {
  HeartHandshake,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  ArrowRight,
  ShieldCheck,
  Globe2,
  FileText,
  ChevronRight,
  ExternalLink,
  User,
  Mail,
  HelpCircle,
  Calendar,
  Lock,
} from "lucide-react";

interface I18nComplaintsContent {
  title: string;
  subtitle: string;
  slaNotice: string;
  tabSubmit: string;
  tabLookup: string;
  lookupTitle: string;
  lookupDesc: string;
  lookupPlaceholder: string;
  lookupBtn: string;
  formTitle: string;
  formDesc: string;
  householdId: string;
  householdIdPlaceholder: string;
  email: string;
  emailPlaceholder: string;
  category: string;
  catExclusion: string;
  catPayment: string;
  catVulnerability: string;
  catUnclaimed: string;
  catGeneral: string;
  description: string;
  descriptionPlaceholder: string;
  submitBtn: string;
  submittingBtn: string;
  successTitle: string;
  successMsg: string;
  caseRef: string;
  timelineTitle: string;
  stepReceived: string;
  stepAssigned: string;
  stepReview: string;
  stepResolved: string;
  securityNotice: string;
  noCasesFound: string;
}

const I18N_COMPLAINTS: Record<string, I18nComplaintsContent> = {
  en: {
    title: "Community Appeals & Assistance Review",
    subtitle: "Request an update to your assistance record, payment method, or priority tier.",
    slaNotice: "Target initial coordinator review within 24 hours. Full resolution depends on provider verification.",
    tabSubmit: "Submit an Appeal",
    tabLookup: "Check Case Status",
    lookupTitle: "Track Case Status",
    lookupDesc: "Enter your Household ID or case reference to see reviewer updates and timeline milestones.",
    lookupPlaceholder: "Enter Household ID (e.g. hh_tbw_001)",
    lookupBtn: "Search Case",
    formTitle: "Submit an Assistance Appeal",
    formDesc: "Let our community response coordinators know what needs attention with your assistance.",
    householdId: "Household ID",
    householdIdPlaceholder: "e.g. hh_tbw_001",
    email: "Contact Email",
    emailPlaceholder: "e.g. resident@example.com",
    category: "Reason for Appeal",
    catPayment: "Update Payout Method or PayPal Account",
    catVulnerability: "Update Priority Status (Medical Equipment or Safety)",
    catExclusion: "Exclusion Dispute (Address Inside Warning Zone)",
    catUnclaimed: "Unclaimed Payment / Link Expired",
    catGeneral: "General Inquiry / Case Question",
    description: "Detailed Explanation",
    descriptionPlaceholder: "Please describe what changed or why your record needs an update...",
    submitBtn: "Submit Appeal for Review",
    submittingBtn: "Submitting...",
    successTitle: "Appeal Received & Queued",
    successMsg: "Your case has been logged and assigned to a community response coordinator for review.",
    caseRef: "Case Reference Number",
    timelineTitle: "Review Lifecycle Progression",
    stepReceived: "Received & Queued",
    stepAssigned: "Assigned to Coordinator",
    stepReview: "Evidence Verification",
    stepResolved: "Resolution & Ledger Update",
    securityNotice: "To protect community funds, any material change to payment routes or vulnerability tiers requires coordinator verification before records update in the disbursement ledger.",
    noCasesFound: "No appeals or grievance records found for this household reference.",
  },
  es: {
    title: "Apelaciones y Revisión de Asistencia Comunitaria",
    subtitle: "Solicite una actualización de su registro, método de pago o nivel de prioridad.",
    slaNotice: "Meta de revisión inicial por coordinador en 24 horas. La resolución final depende de verificación.",
    tabSubmit: "Presentar una Apelación",
    tabLookup: "Consultar Estado del Caso",
    lookupTitle: "Seguimiento de su Caso",
    lookupDesc: "Ingrese el ID de su hogar para consultar notas del coordinador y avances del proceso.",
    lookupPlaceholder: "Ingrese ID del Hogar (ej. hh_tbw_001)",
    lookupBtn: "Buscar Caso",
    formTitle: "Presentar Solicitud de Revisión",
    formDesc: "Indique a los coordinadores comunitarios qué aspectos de su asistencia requieren atención.",
    householdId: "ID del Hogar",
    householdIdPlaceholder: "ej. hh_tbw_001",
    email: "Correo Electrónico de Contacto",
    emailPlaceholder: "ej. residente@ejemplo.com",
    category: "Motivo de la Apelación",
    catPayment: "Actualizar Método de Pago o Cuenta PayPal",
    catVulnerability: "Actualizar Prioridad (Equipo Médico o Seguridad)",
    catExclusion: "Disputa de Exclusión (Dirección en Zona de Alerta)",
    catUnclaimed: "Pago No Reclamado / Enlace Expirado",
    catGeneral: "Pregunta General sobre el Caso",
    description: "Explicación Detallada",
    descriptionPlaceholder: "Describa qué cambió o por qué su registro requiere actualización...",
    submitBtn: "Enviar Apelación a Revisión",
    submittingBtn: "Enviando...",
    successTitle: "Apelación Recibida y en Cola",
    successMsg: "Su caso ha sido registrado y asignado a un coordinador comunitario para su revisión.",
    caseRef: "Número de Referencia del Caso",
    timelineTitle: "Ciclo de Vida de la Revisión",
    stepReceived: "Recibido y en Cola",
    stepAssigned: "Asignado a Coordinador",
    stepReview: "Verificación de Evidencia",
    stepResolved: "Resolución y Actualización",
    securityNotice: "Para proteger los fondos comunitarios, cualquier cambio sustancial en métodos de pago o niveles de vulnerabilidad requiere verificación oficial antes de actualizar el libro contable.",
    noCasesFound: "No se encontraron casos de apelación registrados para este ID de hogar.",
  },
  ht: {
    title: "Apèl Kominotè ak Revizyon Èd",
    subtitle: "Mande yon chanjman nan dosye èd ou, fason pou peye w oswa nivo priyorite w.",
    slaNotice: "Objektif premye egzamen pa kowòdonatè nan 24 èdtan. Rezolisyon konplè depann de verifikasyon.",
    tabSubmit: "Voye Yon Apèl",
    tabLookup: "Tcheke Eta Dosye a",
    lookupTitle: "Swiv Dosye Apèl Ou",
    lookupDesc: "Mete nimewo fanmi an pou w wè kote kowòdonatè a ye nan egzamen dosye a.",
    lookupPlaceholder: "Mete ID Fanmi an (egz. hh_tbw_001)",
    lookupBtn: "Chèche Dosye",
    formTitle: "Mete Yon Demann Revizyon",
    formDesc: "Fè kowòdonatè kominotè yo konnen sa ki bezwen korije nan dosye w la.",
    householdId: "ID Fanmi an",
    householdIdPlaceholder: "egz. hh_tbw_001",
    email: "Imèl Ou",
    emailPlaceholder: "egz. fanmi@egzanp.com",
    category: "Rezon Apèl la",
    catPayment: "Chanje Fason Pou Resevwa Lajan oswa Kont PayPal",
    catVulnerability: "Chanje Priyorite (Aparèy Medikal oswa Bezwen Ijan)",
    catExclusion: "Mwen te dwe ladan l (Kay mwen nan zòn alèt)",
    catUnclaimed: "Lajan poko reklame / Lyen pase dat",
    catGeneral: "Kesyon Jeneral sou Èd la",
    description: "Eksplikasyon Klè",
    descriptionPlaceholder: "Tanpri esplike sa ki chanje oswa sa ki mande koreksyon...",
    submitBtn: "Voye Apèl la Pou Egzamen",
    submittingBtn: "N ap Voye...",
    successTitle: "Apèl la Resevwa nan Liy",
    successMsg: "Dosye w anrejistre epi bay yon kowòdonatè kominotè pou egzamine l.",
    caseRef: "Nimewo Referans Apèl la",
    timelineTitle: "Kijan Egzamen an Ap Pwogrese",
    stepReceived: "Resevwa nan Liy",
    stepAssigned: "Bay Kowòdonatè",
    stepReview: "Verifikasyon Prèv",
    stepResolved: "Rezolisyon ak Aktyalizasyon",
    securityNotice: "Pou sekirite lajan an, nenpòt chanjman nan fason pou peye oswa nivo priyorite mande pou yon kowòdonatè valide l anvan li afekte liv kont lan.",
    noCasesFound: "Pa gen okenn dosye apèl pou nimewo fanmi sa a.",
  },
  vi: {
    title: "Khiếu Nại & Rà Soát Cứu Trợ Cộng Đồng",
    subtitle: "Yêu cầu cập nhật hồ sơ cứu trợ, phương thức thanh toán hoặc mức độ ưu tiên.",
    slaNotice: "Mục tiêu điều phối viên tiếp nhận ban đầu trong 24 giờ. Thời gian giải quyết tùy thuộc xác minh.",
    tabSubmit: "Gửi Yêu Cầu Khiếu Nại",
    tabLookup: "Tra Cứu Tiến Độ Vụ Việc",
    lookupTitle: "Theo Dõi Tiến Trình Khiếu Nại",
    lookupDesc: "Nhập mã hộ gia đình để xem ghi chú của điều phối viên và các mốc thời gian xử lý.",
    lookupPlaceholder: "Nhập mã hộ gia đình (ví dụ: hh_tbw_001)",
    lookupBtn: "Tìm Kiếm",
    formTitle: "Gửi Yêu Cầu Khiếu Nại Hoặc Điều Chỉnh",
    formDesc: "Thông báo cho đội ngũ điều phối cộng đồng về những thông tin cần điều chỉnh trong hồ sơ.",
    householdId: "Mã Hộ Gia Đình",
    householdIdPlaceholder: "ví dụ: hh_tbw_001",
    email: "Email Liên Hệ",
    emailPlaceholder: "ví dụ: resident@example.com",
    category: "Lý Do Khiếu Nại",
    catPayment: "Thay Đổi Phương Thức Thanh Toán hoặc PayPal",
    catVulnerability: "Cập Nhật Mức Ưu Tiên (Thiết Bị Y Tế hoặc An Toàn)",
    catExclusion: "Tranh Chấp Loại Trừ (Địa Chỉ Nằm Trong Vùng Cảnh Báo)",
    catUnclaimed: "Chưa Nhận Tiền / Liên Kết Quá Hạn",
    catGeneral: "Câu Hỏi Chung Về Hồ Sơ",
    description: "Mô Tả Chi Tiết",
    descriptionPlaceholder: "Vui lòng mô tả thay đổi hoặc lý do hồ sơ của bạn cần được rà soát lại...",
    submitBtn: "Gửi Yêu Cầu Đến Điều Phối Viên",
    submittingBtn: "Đang Gửi...",
    successTitle: "Yêu Cầu Đã Được Tiếp Nhận",
    successMsg: "Hồ sơ của bạn đã được ghi nhận và chuyển tới điều phối viên cộng đồng để xem xét.",
    caseRef: "Mã Tham Chiếu Vụ Việc",
    timelineTitle: "Quy Trình Xử Lý Hồ Sơ",
    stepReceived: "Đã Tiếp Nhận & Vào Hàng Đợi",
    stepAssigned: "Đã Phân Công Điều Phối Viên",
    stepReview: "Xác Minh Tài Liệu & Chứng Cứ",
    stepResolved: "Giải Quyết & Điều Chỉnh Sổ Sách",
    securityNotice: "Nhằm bảo vệ ngân quỹ cộng đồng, mọi thay đổi thực chất đối với kênh thanh toán hoặc phân cấp ưu tiên cần được phê duyệt trước khi cập nhật sổ cái giải ngân.",
    noCasesFound: "Không tìm thấy hồ sơ khiếu nại nào cho mã hộ gia đình này.",
  },
  zh: {
    title: "社区救助申诉与案例复核中心",
    subtitle: "申请更新救助记录、变更收款方式或调整脆弱性优先层级。",
    slaNotice: "目标在24小时内由社区协调员完成初审。最终处理进度取决于凭证核实情况。",
    tabSubmit: "提交新申诉",
    tabLookup: "查询处理进展",
    lookupTitle: "跟踪申诉进度",
    lookupDesc: "输入您的住户ID或案例参考号，查看协调员审查进展与时间轴里程碑。",
    lookupPlaceholder: "输入住户ID（例如：hh_tbw_001）",
    lookupBtn: "查询案例",
    formTitle: "提交救助申诉或信息更正",
    formDesc: "请向社区应急协调队伍说明需要核实或更正的事项。",
    householdId: "住户ID",
    householdIdPlaceholder: "例如：hh_tbw_001",
    email: "联系邮箱",
    emailPlaceholder: "例如：resident@example.com",
    category: "申诉类别",
    catPayment: "更改收款渠道或 PayPal 账号",
    catVulnerability: "更新优先级别（持续供电设备或生命安全）",
    catExclusion: "排除争议（房屋地址位于警报多边形内）",
    catUnclaimed: "款项尚未认领 / 认领链接过期",
    catGeneral: "一般政策咨询或案例疑问",
    description: "情况详细说明",
    descriptionPlaceholder: "请详细说明发生了什么变化，或为何需要更正救助信息...",
    submitBtn: "提交申诉进入审核队列",
    submittingBtn: "提交中...",
    successTitle: "申诉已成功接收并进入审核队列",
    successMsg: "您的案件已录入系统，并已指派给社区协调员展开复核。",
    caseRef: "案例参考编号 (Case Ref)",
    timelineTitle: "复核全流程生命周期",
    stepReceived: "已接收并排队",
    stepAssigned: "已指派协调员",
    stepReview: "凭证比对与调查",
    stepResolved: "完成处置并更新账簿",
    securityNotice: "为保障社区救助资金的安全与合规，针对收款路径或优先层级的任何实质性变更，必须经双人授权审核后方可更新至放款账簿中。",
    noCasesFound: "未查找到与该住户编号相关的申诉或复核记录。",
  },
};

export default function ComplaintsAppealsPage() {
  const [lang, setLang] = useState<string>("en");
  const t = I18N_COMPLAINTS[lang] || I18N_COMPLAINTS.en;

  // Active Tab: SUBMIT or LOOKUP
  const [activeTab, setActiveTab] = useState<"SUBMIT" | "LOOKUP">("SUBMIT");

  // Search/Lookup state
  const [lookupId, setLookupId] = useState("hh_tbw_001");
  const [appealsList, setAppealsList] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loadingLookup, setLoadingLookup] = useState(false);

  // Form state
  const [householdId, setHouseholdId] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [category, setCategory] = useState<ComplaintCategory>("PAYMENT_METHOD_CHANGE");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initial load
  const fetchAppeals = async (hId?: string) => {
    setLoadingLookup(true);
    try {
      const url = hId
        ? `/api/recipients/complaints?householdId=${encodeURIComponent(hId)}`
        : "/api/recipients/complaints";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAppealsList(data.complaints || []);
      }
    } catch (err) {
      console.error("Failed to fetch appeals", err);
    } finally {
      setLoadingLookup(false);
      setHasSearched(true);
    }
  };

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupId.trim()) return;
    fetchAppeals(lookupId.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitSuccess(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/recipients/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId: householdId.trim(),
          contactEmail: contactEmail.trim(),
          category,
          description: description.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.description?._errors?.[0] || data.error || "Submission failed");
      }

      setSubmitSuccess(data.complaint);
      setDescription("");
      fetchAppeals(householdId.trim());
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* Top Header & Language Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
        <div>
          <div className="mb-3 eyebrow text-amber">Report a problem · 24-hour reply</div>
          <h1 className="text-title-1 text-ink">
            {t.title}
          </h1>
          <p className="mt-2 text-body-base text-ink-2">{t.subtitle}</p>
        </div>

        {/* Language Picker */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <Globe2 className="w-4 h-4 text-accent" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="field-input text-xs py-1.5 px-2.5 bg-surface font-medium"
            aria-label="Select language"
          >
            <option value="en">English (EN)</option>
            <option value="es">Español (ES)</option>
            <option value="ht">Kreyòl (HT)</option>
            <option value="vi">Tiếng Việt (VI)</option>
            <option value="zh">中文 (ZH)</option>
          </select>
        </div>
      </div>

      {/* SLA Banner */}
      <div className="p-3.5 rounded-xl bg-accent-soft/50 border border-accent-line text-xs text-accent flex items-center gap-2.5">
        <Clock className="w-4 h-4 flex-shrink-0 text-accent" />
        <span className="font-medium">{t.slaNotice}</span>
      </div>

      {/* Segmented View Control: SUBMIT vs LOOKUP */}
      <div className="flex p-1 bg-surface-2 rounded-xl border border-line text-xs font-semibold">
        <button
          onClick={() => setActiveTab("SUBMIT")}
          className={`flex-1 py-2 rounded-lg transition-all ${
            activeTab === "SUBMIT"
              ? "bg-surface text-ink shadow-xs font-bold"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          {t.tabSubmit}
        </button>
        <button
          onClick={() => {
            setActiveTab("LOOKUP");
            if (!hasSearched) fetchAppeals(lookupId);
          }}
          className={`flex-1 py-2 rounded-lg transition-all ${
            activeTab === "LOOKUP"
              ? "bg-surface text-ink shadow-xs font-bold"
              : "text-ink-2 hover:text-ink"
          }`}
        >
          {t.tabLookup}
        </button>
      </div>

      {/* VIEW 1: SUBMIT APPEAL FORM */}
      {activeTab === "SUBMIT" && (
        <div className="field-paper p-6 sm:p-8 space-y-6 shadow-sm border-line">
          {submitSuccess ? (
            <div className="text-center space-y-5 py-4">
              <div className="w-14 h-14 rounded-full bg-accent-soft border border-accent-line flex items-center justify-center mx-auto text-accent">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-serif font-bold text-ink">
                  {t.successTitle}
                </h3>
                <p className="text-xs text-ink-2 max-w-md mx-auto leading-relaxed">
                  {t.successMsg}
                </p>
              </div>

              <div className="bg-surface-2 p-4 rounded-xl text-left text-xs space-y-2 border border-line">
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-2">{t.caseRef}:</span>
                  <span className="font-mono font-bold text-ink">
                    {submitSuccess.complaintId}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-line">
                  <span className="text-ink-2">{t.householdId}:</span>
                  <span className="font-mono font-semibold text-ink">
                    {submitSuccess.householdId}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-2">Status:</span>
                  <span className="field-badge-warning text-[10px]">
                    {submitSuccess.status}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setSubmitSuccess(null)}
                  className="field-btn field-btn-secondary flex-1 text-xs py-2"
                >
                  Submit Another Request
                </button>
                <button
                  onClick={() => {
                    setActiveTab("LOOKUP");
                    setLookupId(submitSuccess.householdId);
                    fetchAppeals(submitSuccess.householdId);
                  }}
                  className="field-btn field-btn-primary flex-1 text-xs py-2"
                >
                  Track Case Progress
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-ink">
                  {t.formTitle}
                </h2>
                <p className="text-xs text-ink-2 mt-0.5">{t.formDesc}</p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-storm-soft border border-danger-line text-xs text-danger flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-ink-2" />
                    <span>{t.householdId} *</span>
                  </label>
                  <input
                    type="text"
                    value={householdId}
                    onChange={(e) => setHouseholdId(e.target.value)}
                    placeholder={t.householdIdPlaceholder}
                    className="field-input w-full mt-1 text-xs bg-surface"
                    required
                  />
                </div>

                <div>
                  <label className="field-label flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-ink-2" />
                    <span>{t.email} *</span>
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="field-input w-full mt-1 text-xs bg-surface"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="field-label block">{t.category} *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                  className="field-input w-full mt-1 text-xs bg-surface"
                  required
                >
                  <option value="PAYMENT_METHOD_CHANGE">{t.catPayment}</option>
                  <option value="VULNERABILITY_UPDATE">{t.catVulnerability}</option>
                  <option value="EXCLUSION_DISPUTE">{t.catExclusion}</option>
                  <option value="UNCLAIMED_ASSISTANCE">{t.catUnclaimed}</option>
                  <option value="GENERAL_INQUIRY">{t.catGeneral}</option>
                </select>
              </div>

              <div>
                <label className="field-label block">{t.description} *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.descriptionPlaceholder}
                  rows={4}
                  className="field-input w-full mt-1 text-xs bg-surface resize-none"
                  required
                />
              </div>

              <div className="p-3.5 rounded-xl bg-surface-2 border border-line text-xs text-ink-2 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">{t.securityNotice}</p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="field-btn field-btn-primary w-full text-xs py-2.5 font-bold shadow-sm"
                >
                  {submitting ? t.submittingBtn : t.submitBtn}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* VIEW 2: TRACK STATUS & TIMELINE */}
      {activeTab === "LOOKUP" && (
        <div className="field-paper p-6 sm:p-8 space-y-6 shadow-sm border-line">
          <div>
            <h2 className="text-lg font-serif font-bold text-ink">
              {t.lookupTitle}
            </h2>
            <p className="text-xs text-ink-2 mt-0.5">{t.lookupDesc}</p>
          </div>

          <form onSubmit={handleLookup} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-ink-3 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                placeholder={t.lookupPlaceholder}
                className="field-input pl-9 pr-3 py-2 text-xs w-full bg-surface"
              />
            </div>
            <button
              type="submit"
              disabled={loadingLookup}
              className="field-btn field-btn-primary text-xs py-2 px-4"
            >
              {loadingLookup ? "Searching..." : t.lookupBtn}
            </button>
          </form>

          {/* Appeals List & Lifecycles */}
          {appealsList.length > 0 ? (
            <div className="space-y-4 pt-2">
              {appealsList.map((appeal) => (
                <div
                  key={appeal.complaintId}
                  className="border border-line rounded-xl overflow-hidden bg-surface"
                >
                  <div className="p-4 bg-surface-2 border-b border-line flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-ink">
                        {appeal.complaintId}
                      </span>
                      <span className="text-xs text-ink-2 ml-2">
                        · Household {appeal.householdId}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                        appeal.status === "RESOLVED"
                          ? "bg-accent-soft text-accent"
                          : appeal.status === "REJECTED"
                          ? "bg-storm-soft text-danger"
                          : "bg-amber-soft text-amber"
                      }`}
                    >
                      {appeal.status}
                    </span>
                  </div>

                  <div className="p-4 space-y-3 text-xs">
                    <div>
                      <span className="text-ink-2 block text-[11px]">Category</span>
                      <span className="font-semibold text-ink">{appeal.category}</span>
                    </div>

                    <div>
                      <span className="text-ink-2 block text-[11px]">Submitted Details</span>
                      <p className="text-ink mt-0.5 leading-relaxed bg-surface-2/40 p-2.5 rounded-lg border border-line">
                        {appeal.description}
                      </p>
                    </div>

                    {/* Timeline Lifecycle Progression */}
                    <div className="pt-2 border-t border-line space-y-2">
                      <span className="text-ink-2 font-semibold block text-[11px]">
                        {t.timelineTitle}
                      </span>
                      <div className="grid grid-cols-4 gap-1 text-center text-[10px] pt-1">
                        <div className="p-1.5 rounded bg-accent-soft text-accent font-semibold">
                          1. {t.stepReceived}
                        </div>
                        <div
                          className={`p-1.5 rounded ${
                            appeal.status !== "RECEIVED"
                              ? "bg-accent-soft text-accent font-semibold"
                              : "bg-surface-2 text-ink-3"
                          }`}
                        >
                          2. {t.stepAssigned}
                        </div>
                        <div
                          className={`p-1.5 rounded ${
                            appeal.status === "UNDER_REVIEW" || appeal.status === "RESOLVED"
                              ? "bg-accent-soft text-accent font-semibold"
                              : "bg-surface-2 text-ink-3"
                          }`}
                        >
                          3. {t.stepReview}
                        </div>
                        <div
                          className={`p-1.5 rounded ${
                            appeal.status === "RESOLVED"
                              ? "bg-accent-soft text-accent font-semibold"
                              : "bg-surface-2 text-ink-3"
                          }`}
                        >
                          4. {t.stepResolved}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-2/40 border-t border-line flex items-center justify-between text-xs text-ink-3">
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(appeal.submittedAt || Date.now()).toLocaleDateString()}</span>
                    </span>
                    <span>Contact: {appeal.contactEmail}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : hasSearched ? (
            <div className="p-6 text-center text-xs text-ink-3 border border-dashed border-line rounded-xl">
              {t.noCasesFound}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
