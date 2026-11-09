"use client";

import React, { useState } from "react";
import type { PaymentChannelType, EnrollmentMethod, EvidenceLevel } from "@/lib/recipients/types";

// Multilingual labels for EN, ES, HT, VI, ZH
const I18N: Record<string, Record<string, string>> = {
  en: {
    title: "Landfall Pre-Storm Cash Assistance",
    subtitle: "Automated, anticipatory mutual aid sent before hurricane landfall.",
    fullName: "Full Name",
    landfallAddress: "Primary Landfall Residence Address",
    displacedQuestion: "Were you displaced or evacuated from your home?",
    currentAddress: "Current Evacuation / Temporary Address",
    paymentChannelTitle: "How would you like to receive relief funds?",
    paypalIdOption: "PayPal Account (Instant Transfer)",
    emailOption: "PayPal Email Address (Claim Link)",
    manualOption: "Offline Assistance / Cash Card (No PayPal Required)",
    evidenceTitle: "Residence Verification Evidence",
    selfDeclared: "Self-Declared Address",
    volunteerAttestation: "Verified by Community Volunteer",
    documentUpload: "Upload Utility Bill or Lease Snippet",
    documentDisclaimer: "Extracted for location verification, not authenticated as government ID.",
    needTitle: "Household Vulnerability & Priority Factors",
    medicalDevice: "Requires powered medical equipment (oxygen, dialysis, refrigeration)",
    elderlyAlone: "Elderly resident (65+) living alone",
    disability: "Household member with mobility impairment or disability",
    noVehicle: "No personal vehicle in evacuation zone",
    childrenUnder5: "Children under 5 years old in household",
    consentTitle: "Data Protection & Consent (§6)",
    consentTos: "I agree to the Terms of Mutual Aid Assistance (Required)",
    consentRouting: "I consent to routing cash payouts to my specified payment method (Required)",
    consentLocation: "I consent to evaluating my home coordinates against NWS hurricane warnings (Optional)",
    submit: "Submit Enrollment for Relief",
    submitting: "Securing & Submitting...",
    successTitle: "Enrollment Complete & Secured",
    successMsg: "Your household is registered for anticipatory storm relief.",
    versionNotice: "Recipient Version 1 recorded. PII is encrypted with AES-256-GCM.",
  },
  es: {
    title: "Asistencia de Efectivo Antes del Huracán — Landfall",
    subtitle: "Ayuda mutua automatizada y anticipada enviada antes de que toque tierra.",
    fullName: "Nombre Completo",
    landfallAddress: "Dirección de Residencia Principal",
    displacedQuestion: "¿Fue desplazado o evacuado de su hogar?",
    currentAddress: "Dirección Temporal o de Evacuación",
    paymentChannelTitle: "¿Cómo desea recibir los fondos de ayuda?",
    paypalIdOption: "Cuenta PayPal (Transferencia Directa)",
    emailOption: "Correo Electrónico PayPal",
    manualOption: "Asistencia Fuera de Línea / Tarjeta de Efectivo",
    evidenceTitle: "Evidencia de Residencia",
    selfDeclared: "Declaración Propia",
    volunteerAttestation: "Certificado por Voluntario Comunitario",
    documentUpload: "Factura de Servicios o Contrato",
    documentDisclaimer: "Extraído para verificación de ubicación, no es autenticado como ID estatal.",
    needTitle: "Factores de Prioridad y Vulnerabilidad",
    medicalDevice: "Requiere equipo médico eléctrico (oxígeno, diálisis)",
    elderlyAlone: "Adulto mayor (65+) viviendo solo",
    disability: "Miembro con discapacidad o movilidad reducida",
    noVehicle: "Sin vehículo en zona de evacuación",
    childrenUnder5: "Niños menores de 5 años en el hogar",
    consentTitle: "Protección de Datos y Consentimiento",
    consentTos: "Acepto los Términos de Asistencia (Obligatorio)",
    consentRouting: "Autorizo el envío de fondos a mi cuenta (Obligatorio)",
    consentLocation: "Autorizo verificar advertencias de tormenta NWS (Opcional)",
    submit: "Completar Registro de Ayuda",
    submitting: "Asegurando y Enviando...",
    successTitle: "Registro Completado con Éxito",
    successMsg: "Su hogar ha sido registrado para ayuda anticipada.",
    versionNotice: "Versión 1 registrada. Datos personales cifrados con AES-256-GCM.",
  },
  ht: {
    title: "Èd Lajan Avan Siklòn — Landfall",
    subtitle: "Èd mityèl rapid ki voye ba ou anvan siklòn lan frape.",
    fullName: "Non Konplè",
    landfallAddress: "Adrès Kay Ou",
    displacedQuestion: "Èske w te deplase oswa evakye kite kay ou?",
    currentAddress: "Adrès Kote W Ye Kounye a",
    paymentChannelTitle: "Kòman ou ta renmen resevwa lajan an?",
    paypalIdOption: "Kont PayPal",
    emailOption: "Imèl PayPal",
    manualOption: "Kat Lajan Kach / Èd Dirèk",
    evidenceTitle: "Prèv Kote W Rete",
    selfDeclared: "Deklarasyon Pa W",
    volunteerAttestation: "Volontè Kominotè Konfime",
    documentUpload: "Fakti Kouran / Dlo",
    documentDisclaimer: "Nou verifye adrès la sèlman, se pa yon kat idantite.",
    needTitle: "Kondisyon Espesyal Fanmi an",
    medicalDevice: "Aparèy medikal ki bezwen kouran",
    elderlyAlone: "Granmoun (65+) k ap viv poukont li",
    disability: "Moun ki gen andikap",
    noVehicle: "Pa gen machin pou evakye",
    childrenUnder5: "Timoun ki poko gen 5 an",
    consentTitle: "Pwoteksyon Done Ak Konsantman",
    consentTos: "Mwen aksepte règleman yo (Obligatwa)",
    consentRouting: "Mwen dakò pou resevwa lajan an (Obligatwa)",
    consentLocation: "Mwen dakò pou tcheke alèt siklòn (Opsyonèl)",
    submit: "Voye Enskripsyon an",
    submitting: "N ap Anrejistre...",
    successTitle: "Enskripsyon an Reyisi",
    successMsg: "Fanmi w anrejistre pou resevwa èd anvan siklòn.",
    versionNotice: "Vèsyon 1 anrejistre. Enfòmasyon prive kode ak AES-256-GCM.",
  },
  vi: {
    title: "Cứu Trợ Tiền Mặt Trước Bão — Landfall",
    subtitle: "Hỗ trợ tài chính cộng đồng gửi trước khi bão đổ bộ.",
    fullName: "Họ và Tên",
    landfallAddress: "Địa Chỉ Nhà Ở Chính",
    displacedQuestion: "Bạn đã sơ tán khỏi nhà chưa?",
    currentAddress: "Địa Chỉ Tạm Trú",
    paymentChannelTitle: "Phương thức nhận hỗ trợ",
    paypalIdOption: "Tài Khoản PayPal",
    emailOption: "Email PayPal",
    manualOption: "Thẻ Tiền Mặt Trực Tiếp",
    evidenceTitle: "Xác Nhận Nơi Cư Trú",
    selfDeclared: "Tự Khai Báo",
    volunteerAttestation: "Tình Nguyện Viên Xác Nhận",
    documentUpload: "Hóa Đơn Tiện Ích",
    documentDisclaimer: "Chỉ trích xuất xác nhận địa điểm, không dùng làm căn cước công dân.",
    needTitle: "Yếu Tố Cần Ưu Tiên",
    medicalDevice: "Thiết bị y tế cần điện liên tục",
    elderlyAlone: "Người cao tuổi sống một mình",
    disability: "Người khuyết tật trong gia đình",
    noVehicle: "Không có xe để sơ tán",
    childrenUnder5: "Trẻ em dưới 5 tuổi",
    consentTitle: "Bảo Vệ Dữ Liệu & Đồng Ý",
    consentTos: "Tôi đồng ý các điều khoản (Bắt buộc)",
    consentRouting: "Tôi đồng ý nhận tiền cứu trợ (Bắt buộc)",
    consentLocation: "Cho phép đối chiếu tọa độ cảnh báo bão NWS (Tùy chọn)",
    submit: "Gửi Đăng Ký",
    submitting: "Đang Xử Lý...",
    successTitle: "Đăng Ký Thành Công",
    successMsg: "Hộ gia đình của bạn đã được ghi nhận hỗ trợ bão.",
    versionNotice: "Phiên bản 1. Dữ liệu cá nhân được mã hóa AES-256-GCM.",
  },
  zh: {
    title: "飓风来临前现金互助 — Landfall",
    subtitle: "在飓风登陆前自动发放的社区互助现金。",
    fullName: "姓名",
    landfallAddress: "主要居住地址",
    displacedQuestion: "您是否已疏散或撤离家园？",
    currentAddress: "当前临时安置地址",
    paymentChannelTitle: "接收资助的方式",
    paypalIdOption: "PayPal 账户直接转账",
    emailOption: "PayPal 邮箱认领链接",
    manualOption: "线下现金卡 / 支票（无需 PayPal）",
    evidenceTitle: "居住证明",
    selfDeclared: "个人声明",
    volunteerAttestation: "社区志愿者见证",
    documentUpload: "水电费账单或租约摘要",
    documentDisclaimer: "仅用于核对风暴区域，绝不作为官方身份验证。",
    needTitle: "优先需求评估",
    medicalDevice: "需要持续供电的医疗设备",
    elderlyAlone: "独居长者（65岁以上）",
    disability: "行动不便或残障人士",
    noVehicle: "疏散区内无交通工具",
    childrenUnder5: "家庭中有5岁以下幼儿",
    consentTitle: "数据保护与授权",
    consentTos: "我同意救灾服务条款（必填）",
    consentRouting: "我授权向指定方式发放资金（必填）",
    consentLocation: "我同意使用房屋坐标对比气象局风暴预警（可选）",
    submit: "提交救助登记",
    submitting: "加密提交中...",
    successTitle: "登记成功并已安全加密",
    successMsg: "您的家庭已成功登记风暴救助。",
    versionNotice: "已记录第1版本。敏感信息采用 AES-256-GCM 硬件级加密。",
  },
};

export default function ResidentEnrollPage() {
  const [lang, setLang] = useState<string>("en");
  const t = I18N[lang] || I18N.en;

  // Form State
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isDisplaced, setIsDisplaced] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("");

  const [paymentChannel, setPaymentChannel] = useState<PaymentChannelType>("PAYPAL_ID");
  const [paypalEmailOrId, setPaypalEmailOrId] = useState("");

  const [evidenceLevel, setEvidenceLevel] = useState<EvidenceLevel>("SELF_DECLARED");
  const [documentSnippet, setDocumentSnippet] = useState("");
  const [volunteerId, setVolunteerId] = useState("");

  // Need factors
  const [hasMedicalDevice, setHasMedicalDevice] = useState(false);
  const [isElderlyLivingAlone, setIsElderlyLivingAlone] = useState(false);
  const [hasDisability, setHasDisability] = useState(false);
  const [hasNoVehicleInSurgeZone, setHasNoVehicleInSurgeZone] = useState(false);
  const [hasChildrenUnder5, setHasChildrenUnder5] = useState(false);

  // Consents
  const [consentTos, setConsentTos] = useState(false);
  const [consentRouting, setConsentRouting] = useState(false);
  const [consentLocation, setConsentLocation] = useState(true);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!consentTos || !consentRouting) {
      setError("Terms of Service and Payment Routing consent are strictly required (§6).");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name,
        address,
        isDisplaced,
        currentAddress: isDisplaced ? currentAddress : address,
        lat: 27.9506, // Default Tampa coordinates for demo
        lng: -82.4572,
        language: lang,
        paymentChannel,
        paypalEmailOrId: paymentChannel !== "MANUAL" ? paypalEmailOrId : undefined,
        assistedByVolunteerId: volunteerId || undefined,
        evidenceLevel,
        documentSnippet: evidenceLevel === "DOCUMENT_PROVIDED" ? documentSnippet : undefined,
        hasMedicalDevice,
        isElderlyLivingAlone,
        hasDisability,
        hasNoVehicleInSurgeZone,
        hasChildrenUnder5,
        consentAccepted: consentTos && consentRouting,
        consents: {
          TERMS_OF_SERVICE: consentTos,
          PAYMENT_ROUTING: consentRouting,
          LOCATION_TRACKING: consentLocation,
          EMERGENCY_DISCLOSURE: false,
        },
      };

      const res = await fetch("/api/recipients/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrollment failed");
      setSuccessResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (successResult) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-800/80 rounded-2xl p-8 space-y-6 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-950 border border-emerald-600 rounded-full flex items-center justify-center mx-auto text-emerald-400 text-3xl font-bold">
            ✓
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">{t.successTitle}</h2>
            <p className="text-sm text-slate-300 mt-2">{t.successMsg}</p>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-left text-xs space-y-2">
            <div>
              <span className="text-slate-500">Household ID:</span>
              <p className="font-mono text-slate-200">{successResult.householdId}</p>
            </div>
            <div>
              <span className="text-slate-500">Security & Version:</span>
              <p className="text-emerald-400 font-semibold">{t.versionNotice}</p>
            </div>
            {successResult.emailVerificationPending && (
              <div className="pt-2 border-t border-slate-800 text-amber-300">
                A verification link was dispatched to your email address.
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setSuccessResult(null);
              setName("");
              setAddress("");
            }}
            className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold text-sm transition-colors"
          >
            Enroll Another Household
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Language selector and Title */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{t.title}</h1>
            <p className="text-xs text-slate-400 mt-1">{t.subtitle}</p>
          </div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 font-medium text-slate-200 focus:outline-none"
          >
            <option value="en">English (EN)</option>
            <option value="es">Español (ES)</option>
            <option value="ht">Kreyòl (HT)</option>
            <option value="vi">Tiếng Việt (VI)</option>
            <option value="zh">中文 (ZH)</option>
          </select>
        </div>

        {error && (
          <div className="p-4 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Personal and Residence Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-blue-400">
              1. Residence & Identity
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{t.fullName}</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maria Rodriguez"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {t.landfallAddress}
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 1402 E 7th Ave, Tampa FL"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                Used to evaluate hurricane warning boundaries. Zero government ID or SSN requested.
              </span>
            </div>

            {/* Displaced / Evacuation toggle */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDisplaced}
                  onChange={(e) => setIsDisplaced(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span className="text-xs text-amber-300 font-medium">{t.displacedQuestion}</span>
              </label>

              {isDisplaced && (
                <div className="mt-3 pl-6">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t.currentAddress}
                  </label>
                  <input
                    type="text"
                    value={currentAddress}
                    onChange={(e) => setCurrentAddress(e.target.value)}
                    placeholder="Temporary shelter or relative address"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-400 block mt-1 italic">
                    Your original home coordinates are preserved for warning evaluation; evacuating never lowers priority!
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Need Factors */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-blue-400">
              2. Need & Priority (§7)
            </h2>
            <div className="space-y-2.5 text-xs text-slate-300">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasMedicalDevice}
                  onChange={(e) => setHasMedicalDevice(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>{t.medicalDevice}</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isElderlyLivingAlone}
                  onChange={(e) => setIsElderlyLivingAlone(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>{t.elderlyAlone}</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasDisability}
                  onChange={(e) => setHasDisability(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>{t.disability}</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasNoVehicleInSurgeZone}
                  onChange={(e) => setHasNoVehicleInSurgeZone(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>{t.noVehicle}</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasChildrenUnder5}
                  onChange={(e) => setHasChildrenUnder5(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>{t.childrenUnder5}</span>
              </label>
            </div>
          </div>

          {/* Section 3: Payment Channel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-blue-400">
              3. Payment Channel
            </h2>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="channel"
                  value="PAYPAL_ID"
                  checked={paymentChannel === "PAYPAL_ID"}
                  onChange={() => setPaymentChannel("PAYPAL_ID")}
                  className="bg-slate-950 text-blue-600"
                />
                <span>{t.paypalIdOption}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="channel"
                  value="EMAIL"
                  checked={paymentChannel === "EMAIL"}
                  onChange={() => setPaymentChannel("EMAIL")}
                  className="bg-slate-950 text-blue-600"
                />
                <span>{t.emailOption}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="channel"
                  value="MANUAL"
                  checked={paymentChannel === "MANUAL"}
                  onChange={() => setPaymentChannel("MANUAL")}
                  className="bg-slate-950 text-blue-600"
                />
                <span>{t.manualOption}</span>
              </label>
            </div>

            {paymentChannel !== "MANUAL" && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {paymentChannel === "PAYPAL_ID" ? "PayPal Account / Payer ID" : "PayPal Email Address"}
                </label>
                <input
                  type="text"
                  required
                  value={paypalEmailOrId}
                  onChange={(e) => setPaypalEmailOrId(e.target.value)}
                  placeholder={paymentChannel === "PAYPAL_ID" ? "e.g. RMYYMT3FXD8LJ or maria@paypal.me" : "e.g. maria@example.com"}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Section 4: Residence Evidence */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-blue-400">
              4. Evidence Ladder
            </h2>

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="evidence"
                  value="SELF_DECLARED"
                  checked={evidenceLevel === "SELF_DECLARED"}
                  onChange={() => setEvidenceLevel("SELF_DECLARED")}
                  className="bg-slate-950 text-blue-600"
                />
                <span>{t.selfDeclared}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="evidence"
                  value="VOLUNTEER_ATTESTATION"
                  checked={evidenceLevel === "VOLUNTEER_ATTESTATION"}
                  onChange={() => setEvidenceLevel("VOLUNTEER_ATTESTATION")}
                  className="bg-slate-950 text-blue-600"
                />
                <span>{t.volunteerAttestation}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="evidence"
                  value="DOCUMENT_PROVIDED"
                  checked={evidenceLevel === "DOCUMENT_PROVIDED"}
                  onChange={() => setEvidenceLevel("DOCUMENT_PROVIDED")}
                  className="bg-slate-950 text-blue-600"
                />
                <span>{t.documentUpload}</span>
              </label>
            </div>

            {evidenceLevel === "DOCUMENT_PROVIDED" && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Utility Bill Account # or Address Snippet
                </label>
                <input
                  type="text"
                  value={documentSnippet}
                  onChange={(e) => setDocumentSnippet(e.target.value)}
                  placeholder="e.g. TECO Energy #8839210"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[11px] text-amber-400 block mt-1 italic">
                  ⚠ {t.documentDisclaimer}
                </span>
              </div>
            )}
          </div>

          {/* Section 5: Unbundled Consents */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-blue-400">
              5. {t.consentTitle}
            </h2>
            <div className="space-y-2 text-xs text-slate-300">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentTos}
                  onChange={(e) => setConsentTos(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span className="font-medium text-slate-200">{t.consentTos}</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentRouting}
                  onChange={(e) => setConsentRouting(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span className="font-medium text-slate-200">{t.consentRouting}</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentLocation}
                  onChange={(e) => setConsentLocation(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>{t.consentLocation}</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold rounded-xl shadow-lg transition-colors text-sm"
          >
            {submitting ? t.submitting : t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
