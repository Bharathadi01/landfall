"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { PaymentChannelType, EvidenceLevel } from "@/lib/recipients/types";
import {
  HeartHandshake,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Lock,
  Globe2,
  HelpCircle,
  AlertCircle,
  FileText,
  User,
  Home,
  CreditCard,
  Search,
  ExternalLink,
  ChevronRight,
  Clock,
} from "lucide-react";

interface I18nContent {
  title: string;
  subtitle: string;
  stepIndicator: string;
  step1Title: string;
  step1Desc: string;
  fullName: string;
  fullNamePlaceholder: string;
  address: string;
  addressPlaceholder: string;
  isDisplaced: string;
  displacedYes: string;
  displacedNo: string;
  tempAddress: string;
  tempAddressPlaceholder: string;
  step2Title: string;
  step2Desc: string;
  medicalDevice: string;
  elderlyAlone: string;
  disability: string;
  noVehicle: string;
  childrenUnder5: string;
  step3Title: string;
  step3Desc: string;
  paypalAccount: string;
  paypalEmail: string;
  offlineAid: string;
  paypalFieldLabel: string;
  step4Title: string;
  step4Desc: string;
  consentTos: string;
  consentRouting: string;
  consentLocation: string;
  privacyNote: string;
  step5Title: string;
  step5Desc: string;
  back: string;
  continue: string;
  submit: string;
  submitting: string;
  successTitle: string;
  successMsg: string;
  householdRef: string;
  tabEnroll: string;
  tabStatus: string;
  lookupTitle: string;
  lookupPlaceholder: string;
  lookupBtn: string;
  appealNotice: string;
}

const I18N_ENROLL: Record<string, I18nContent> = {
  en: {
    title: "Community Storm Assistance",
    subtitle: "Direct financial relief delivered before hurricane landfall.",
    stepIndicator: "Step {step} of 5",
    step1Title: "Your Household & Address",
    step1Desc: "Tell us who you are and where your home is located so we can check storm warnings.",
    fullName: "Full Name",
    fullNamePlaceholder: "e.g. Maria Santos",
    address: "Primary Home Address",
    addressPlaceholder: "e.g. 1420 Bayshore Dr, Tampa, FL",
    isDisplaced: "Have you had to evacuate or leave your home?",
    displacedYes: "Yes, currently displaced",
    displacedNo: "No, currently at primary home",
    tempAddress: "Temporary Evacuation Address",
    tempAddressPlaceholder: "Where are you currently staying?",
    step2Title: "Priority Needs & Safety Factors",
    step2Desc: "These factors help response teams prioritize households with urgent medical or safety needs.",
    medicalDevice: "Someone in our home uses electricity-dependent medical equipment (oxygen, dialysis, etc.)",
    elderlyAlone: "An older adult (65+) lives alone at this home",
    disability: "A household member has a mobility impairment or disability",
    noVehicle: "We do not have access to a personal vehicle to evacuate",
    childrenUnder5: "Young children under 5 years old live in our home",
    step3Title: "How Would You Like to Receive Assistance?",
    step3Desc: "Select your preferred payment route. Assistance is sent directly upon official hurricane warnings.",
    paypalAccount: "Instant Transfer to PayPal Account",
    paypalEmail: "Email Claim Link (PayPal not required immediately)",
    offlineAid: "Direct Community Card / Offline Assistance",
    paypalFieldLabel: "PayPal Email or Account Identifier",
    step4Title: "Privacy & Consents",
    step4Desc: "We respect your privacy. Your data is protected with bank-grade encryption and never sold.",
    consentTos: "I agree to the Community Mutual Aid Assistance terms (Required)",
    consentRouting: "I authorize delivering emergency funds to my selected payout method (Required)",
    consentLocation: "I consent to checking whether my home address falls within NWS storm warning zones (Recommended)",
    privacyNote: "Your data is stored with AES-256 encryption. We only check your address coordinates against National Weather Service storm polygons to release funds automatically when a hurricane warning is issued.",
    step5Title: "Review & Confirm Enrollment",
    step5Desc: "Please review your information before submitting.",
    back: "Back",
    continue: "Continue",
    submit: "Submit Relief Enrollment",
    submitting: "Submitting...",
    successTitle: "Enrollment Registered & Secured",
    successMsg: "Your household has been registered for pre-storm assistance. You will be notified when funds are released.",
    householdRef: "Household Reference ID",
    tabEnroll: "Enroll Household",
    tabStatus: "Check Status & Payments",
    lookupTitle: "Look up your relief application",
    lookupPlaceholder: "Enter Household ID (e.g. hh_tbw_001)",
    lookupBtn: "Search Application",
    appealNotice: "Need to update your address, medical status, or payout method? Submit a community grievance.",
  },
  es: {
    title: "Asistencia Comunitaria ante Tormentas",
    subtitle: "Ayuda financiera directa entregada antes del impacto del huracán.",
    stepIndicator: "Paso {step} de 5",
    step1Title: "Su Hogar y Dirección",
    step1Desc: "Indíquenos su nombre y dónde vive para verificar las alertas meteorológicas.",
    fullName: "Nombre Completo",
    fullNamePlaceholder: "ej. María Santos",
    address: "Dirección Principal del Hogar",
    addressPlaceholder: "ej. 1420 Bayshore Dr, Tampa, FL",
    isDisplaced: "¿Ha tenido que evacuar o salir de su hogar?",
    displacedYes: "Sí, actualmente evacuado",
    displacedNo: "No, en mi hogar principal",
    tempAddress: "Dirección Temporal de Evacuación",
    tempAddressPlaceholder: "¿Dónde se hospeda actualmente?",
    step2Title: "Necesidades Prioritarias y Factores de Seguridad",
    step2Desc: "Estos factores ayudan a priorizar hogares con necesidades médicas o de seguridad urgentes.",
    medicalDevice: "Alguien en casa requiere equipo médico dependiente de electricidad",
    elderlyAlone: "Un adulto mayor (65+) vive solo en este hogar",
    disability: "Un miembro del hogar tiene discapacidad o movilidad reducida",
    noVehicle: "No disponemos de vehículo propio para evacuar",
    childrenUnder5: "Viven niños menores de 5 años en el hogar",
    step3Title: "¿Cómo Desea Recibir la Asistencia?",
    step3Desc: "Seleccione su método de pago preferido. La ayuda se envía tras advertencias oficiales.",
    paypalAccount: "Transferencia Directa a Cuenta PayPal",
    paypalEmail: "Enlace por Correo Electrónico (No requiere PayPal de inmediato)",
    offlineAid: "Tarjeta Comunitaria / Asistencia Fuera de Línea",
    paypalFieldLabel: "Correo o Identificador de PayPal",
    step4Title: "Privacidad y Consentimientos",
    step4Desc: "Protegemos su información con cifrado de nivel bancario. Nunca se vende.",
    consentTos: "Acepto los términos de Asistencia Comunitaria (Requerido)",
    consentRouting: "Autorizo el envío de fondos al método seleccionado (Requerido)",
    consentLocation: "Autorizo cotejar mi dirección con zonas de alerta NWS (Recomendado)",
    privacyNote: "Sus datos están protegidos con cifrado AES-256. Solo usamos su ubicación para verificar si está dentro de la zona de advertencia del huracán.",
    step5Title: "Revisar y Confirmar Registro",
    step5Desc: "Por favor revise su información antes de enviar.",
    back: "Atrás",
    continue: "Continuar",
    submit: "Completar Registro de Ayuda",
    submitting: "Enviando...",
    successTitle: "Registro Completado con Éxito",
    successMsg: "Su hogar ha sido registrado para ayuda anticipada ante la tormenta.",
    householdRef: "Código de Referencia del Hogar",
    tabEnroll: "Registrar Hogar",
    tabStatus: "Consultar Estado y Pagos",
    lookupTitle: "Consultar estado de su solicitud",
    lookupPlaceholder: "Ingrese ID del Hogar (ej. hh_tbw_001)",
    lookupBtn: "Buscar Solicitud",
    appealNotice: "¿Necesita actualizar su dirección, situación médica o método de pago? Presente una solicitud de revisión.",
  },
  ht: {
    title: "Èd Finansye Avan Siklòn",
    subtitle: "Èd lajan kach voye ba ou dirèkteman anvan siklòn lan rive.",
    stepIndicator: "Etap {step} sou 5",
    step1Title: "Fanmi W ak Adrès Ou",
    step1Desc: "Mete non w ak kote w rete pou nou ka tcheke alèt siklòn yo.",
    fullName: "Non Konplè",
    fullNamePlaceholder: "egz. Maria Santos",
    address: "Adrès Kay Ou",
    addressPlaceholder: "egz. 1420 Bayshore Dr, Tampa, FL",
    isDisplaced: "Èske w te oblije evakye oswa kite kay ou?",
    displacedYes: "Wi, mwen deplase",
    displacedNo: "Non, mwen nan kay mwen",
    tempAddress: "Adrès Kote W Ye Kounye a",
    tempAddressPlaceholder: "Ki kote w ap dòmi kounye a?",
    step2Title: "Bezwen Espesyal ak Priyorite",
    step2Desc: "Sa ede ekip yo jwenn moun ki gen gwo bezwen medikal pi vit.",
    medicalDevice: "Gen yon moun ki bezwen aparèy medikal ak kouran",
    elderlyAlone: "Yon granmoun (65+) k ap viv poukont li",
    disability: "Yon moun ki gen andikap nan kay la",
    noVehicle: "Nou pa gen machin pou nou evakye",
    childrenUnder5: "Gen timoun piti ki poko gen 5 an",
    step3Title: "Kijan Ou Ta Renmen Resevwa Lajan an?",
    step3Desc: "Chwazi fason ki pi bon pou ou. Lajan an ap voye lekou alèt la deklare.",
    paypalAccount: "Voye dirèkteman sou Kont PayPal",
    paypalEmail: "Voye lyen sou Imèl (Ou pa bezwen PayPal touswit)",
    offlineAid: "Èd Dirèk / Kat Lajan Kach Kominotè",
    paypalFieldLabel: "Imèl oswa Kont PayPal Ou",
    step4Title: "Pwoteksyon Enfòmasyon Ou",
    step4Desc: "Enfòmasyon ou an sekirite ak sistèm kripte bankè. Nou pa janm vann done ou.",
    consentTos: "Mwen aksepte règleman èd kominotè a (Obligatwa)",
    consentRouting: "Mwen dakò pou yo voye lajan an nan fason mwen chwazi a (Obligatwa)",
    consentLocation: "Mwen dakò pou tcheke si adrès mwen nan zòn siklòn lan (Rekòmande)",
    privacyNote: "Done w yo kripte ak AES-256. Nou sèlman tcheke kote kay ou ye ak alèt meteyo ofisyèl yo.",
    step5Title: "Tcheke epi Konfime",
    step5Desc: "Tanpri revize tout enfòmasyon yo anvan w voye.",
    back: "Retounen",
    continue: "Kontinye",
    submit: "Voye Enskripsyon an",
    submitting: "N ap Voye...",
    successTitle: "Enskripsyon Ou Reyisi",
    successMsg: "Fanmi ou byen anrejistre pou resevwa èd anvan siklòn lan frape.",
    householdRef: "Nimewo Referans Fanmi an",
    tabEnroll: "Enskri Fanmi",
    tabStatus: "Tcheke Eta ak Peman",
    lookupTitle: "Tcheke dosye èd ou",
    lookupPlaceholder: "Antre Nimewo Fanmi an (egz. hh_tbw_001)",
    lookupBtn: "Chèche Dosye",
    appealNotice: "Ou bezwen chanje adrès, aparèy medikal oswa fason pou peye? Voye yon demann revizyon.",
  },
  vi: {
    title: "Cứu Trợ Tiền Mặt Trước Thiên Tai",
    subtitle: "Hỗ trợ tài chính trực tiếp chuyển trước khi bão đổ bộ.",
    stepIndicator: "Bước {step} trên 5",
    step1Title: "Hộ Gia Đình & Địa Chỉ",
    step1Desc: "Cung cấp tên và địa chỉ cư trú để đối chiếu với cảnh báo bão.",
    fullName: "Họ và Tên",
    fullNamePlaceholder: "ví dụ: Maria Santos",
    address: "Địa Chỉ Nhà Chính",
    addressPlaceholder: "ví dụ: 1420 Bayshore Dr, Tampa, FL",
    isDisplaced: "Bạn đã phải sơ tán khỏi nhà chưa?",
    displacedYes: "Đã sơ tán đến nơi khác",
    displacedNo: "Đang ở nhà chính",
    tempAddress: "Địa Chỉ Tạm Trú",
    tempAddressPlaceholder: "Bạn đang ở đâu hiện tại?",
    step2Title: "Yếu Tố Ưu Tiên & An Toàn",
    step2Desc: "Giúp đội ngũ hỗ trợ ưu tiên những gia đình có nhu cầu y tế khẩn cấp.",
    medicalDevice: "Có người cần thiết bị y tế dùng điện liên tục",
    elderlyAlone: "Người cao tuổi (65+) sống một mình",
    disability: "Thành viên trong gia đình có khuyết tật",
    noVehicle: "Gia đình không có xe riêng để sơ tán",
    childrenUnder5: "Có trẻ em dưới 5 tuổi trong gia đình",
    step3Title: "Phương Thức Nhận Hỗ Trợ",
    step3Desc: "Chọn cách nhận tiền cứu trợ. Tiền sẽ gửi ngay khi có cảnh báo bão chính thức.",
    paypalAccount: "Chuyển Trực Tiếp Vào Tài Khoản PayPal",
    paypalEmail: "Nhận Liên Kết Qua Email (Chưa cần PayPal ngay)",
    offlineAid: "Thẻ Tiền Mặt Trực Tiếp / Hỗ Trợ Tại Chỗ",
    paypalFieldLabel: "Email hoặc Tên Tài Khoản PayPal",
    step4Title: "Bảo Mật & Đồng Ý",
    step4Desc: "Thông tin của bạn được mã hóa cấp ngân hàng và không bao giờ bị chia sẻ.",
    consentTos: "Tôi đồng ý với các điều khoản cứu trợ (Bắt buộc)",
    consentRouting: "Tôi đồng ý nhận tiền theo phương thức đã chọn (Bắt buộc)",
    consentLocation: "Cho phép kiểm tra tọa độ địa chỉ với vùng cảnh báo bão (Khuyến nghị)",
    privacyNote: "Dữ liệu được mã hóa bằng AES-256. Chúng tôi chỉ dùng địa chỉ để xác định khi bão đe dọa khu vực của bạn.",
    step5Title: "Xem Lại & Xác Nhận",
    step5Desc: "Vui lòng kiểm tra lại thông tin trước khi gửi đăng ký.",
    back: "Quay lại",
    continue: "Tiếp tục",
    submit: "Gửi Đăng Ký Cứu Trợ",
    submitting: "Đang gửi...",
    successTitle: "Đăng Ký Thành Công & Được Bảo Vệ",
    successMsg: "Hộ gia đình của bạn đã được ghi nhận hỗ trợ trước bão.",
    householdRef: "Mã Tham Chiếu Hộ Gia Đình",
    tabEnroll: "Đăng Ký Mới",
    tabStatus: "Tra Cứu Tình Trạng",
    lookupTitle: "Tra cứu hồ sơ hỗ trợ của bạn",
    lookupPlaceholder: "Nhập mã hộ gia đình (ví dụ: hh_tbw_001)",
    lookupBtn: "Tìm Kiếm",
    appealNotice: "Cần cập nhật địa chỉ, thiết bị y tế hoặc tài khoản thanh toán? Hãy gửi khiếu nại cộng đồng.",
  },
  zh: {
    title: "风暴前紧急现金援助登记",
    subtitle: "在飓风正式登陆前直接发放的社区应急资金援助。",
    stepIndicator: "第 {step} 步，共 5 步",
    step1Title: "家庭与居住地址",
    step1Desc: "请提供您的姓名与主要居住地址，以便我们与官方气象预警系统进行核对。",
    fullName: "姓名",
    fullNamePlaceholder: "例如：张敏",
    address: "主要居住地址",
    addressPlaceholder: "例如：1420 Bayshore Dr, Tampa, FL",
    isDisplaced: "您是否已疏散或暂时撤离住所？",
    displacedYes: "是，目前在异地临时安置",
    displacedNo: "否，仍在主要住所",
    tempAddress: "临时安置地址",
    tempAddressPlaceholder: "您当前暂住在哪里？",
    step2Title: "紧急优先评估因素",
    step2Desc: "这些信息帮助应急队伍优先为急需生命支持或行动不便的家庭释放资金。",
    medicalDevice: "家中有成员需要持续供电的医疗仪器（如呼吸机、透析机）",
    elderlyAlone: "独居老人（65岁及以上）",
    disability: "家庭成员有行动障碍或残疾",
    noVehicle: "家庭没有私家车可供自主疏散",
    childrenUnder5: "家中有5岁以下幼儿",
    step3Title: "您希望如何接收应急资助？",
    step3Desc: "请选择首选收款方式。一旦气象局发布飓风警报，资金将立即自动转出。",
    paypalAccount: "直接转账至 PayPal 账户（即时到账）",
    paypalEmail: "邮箱认领链接（无需立即注册 PayPal）",
    offlineAid: "社区面对面援助 / 离线现金卡",
    paypalFieldLabel: "PayPal 账号或邮箱",
    step4Title: "隐私与授权条款",
    step4Desc: "我们采用银行级 AES-256 加密保护您的数据，绝不向第三方透露或售卖。",
    consentTos: "我同意社区互助援助条款（必填）",
    consentRouting: "我授权将款项转至指定的支付方式（必填）",
    consentLocation: "我同意根据气象局警报区域核对我的房屋坐标（建议勾选）",
    privacyNote: "您的数据采用强加密存储。我们仅使用房屋经纬度与国家气象局风暴预警多边形进行空间匹配，触发自动放款。",
    step5Title: "核对并确认登记",
    step5Desc: "请核对您的信息，确认无误后点击提交。",
    back: "上一步",
    continue: "下一步",
    submit: "提交救助登记",
    submitting: "提交中...",
    successTitle: "登记成功并已安全归档",
    successMsg: "您的家庭已成功录入风暴前救助名册。气象触发警报时资金将自动发放并通知您。",
    householdRef: "家庭参考编号 (Household ID)",
    tabEnroll: "填写救助登记",
    tabStatus: "查询申请与款项",
    lookupTitle: "查询您的救助办理进度",
    lookupPlaceholder: "输入住户ID（例如：hh_tbw_001）",
    lookupBtn: "查询记录",
    appealNotice: "如需更新收款账号、地址或重大医疗状态，请访问社区申诉通道。",
  },
};

export default function ResidentEnrollPage() {
  const [lang, setLang] = useState<string>("en");
  const t = I18N_ENROLL[lang] || I18N_ENROLL.en;

  // Active view: ENROLL or STATUS
  const [activeTab, setActiveTab] = useState<"ENROLL" | "STATUS">("ENROLL");

  // Multi-step intake state (1 to 5)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form Fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isDisplaced, setIsDisplaced] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("");

  const [hasMedicalDevice, setHasMedicalDevice] = useState(false);
  const [isElderlyLivingAlone, setIsElderlyLivingAlone] = useState(false);
  const [hasDisability, setHasDisability] = useState(false);
  const [hasNoVehicleInSurgeZone, setHasNoVehicleInSurgeZone] = useState(false);
  const [hasChildrenUnder5, setHasChildrenUnder5] = useState(false);

  const [paymentChannel, setPaymentChannel] = useState<PaymentChannelType>("PAYPAL_ID");
  const [paypalEmailOrId, setPaypalEmailOrId] = useState("");
  const [evidenceLevel] = useState<EvidenceLevel>("SELF_DECLARED");

  const [consentTos, setConsentTos] = useState(false);
  const [consentRouting, setConsentRouting] = useState(false);
  const [consentLocation, setConsentLocation] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  // Status Lookup State
  const [lookupId, setLookupId] = useState("hh_tbw_001");
  const [lookupData, setLookupData] = useState<any | null>({
    householdId: "hh_tbw_001",
    name: "Elena Rodriguez",
    address: "2410 Bayshore Blvd, Tampa, FL 33629",
    zone: "Zone A (Surge Evacuation)",
    tier: "Tier 1: High Priority (Medical Equipment)",
    disasterExposure: "CONFIRMED (Hurricane Milton Warning TBW:HU.W:0009)",
    paymentRoute: "PayPal Instant Transfer",
    payoutStatus: "DISBURSED",
    amountDisbursed: "$500.00 USD",
    paypalTransactionId: "81V948123A849204P",
    disbursedAt: "Oct 9, 2024 · 01:45 UTC",
  });
  const [hasSearched, setHasSearched] = useState(false);

  const handleLookup = (id: string) => {
    setLookupId(id);
    setHasSearched(true);
    if (id.toLowerCase().includes("002")) {
      setLookupData({
        householdId: "hh_tbw_002",
        name: "Arthur Pendelton",
        address: "412 Gulf Way, St. Pete Beach, FL 33706",
        zone: "Zone A (Barrier Island)",
        tier: "Tier 2: Elderly Resident Living Alone",
        disasterExposure: "CONFIRMED (Hurricane Milton Warning)",
        paymentRoute: "PayPal Email Claim Link",
        payoutStatus: "CLAIM_PENDING",
        amountDisbursed: "$500.00 USD",
        paypalTransactionId: "UNCLAIMED (Link Active)",
        claimUrl: "https://www.paypal.com/signin",
        disbursedAt: "Oct 9, 2024 · 01:45 UTC",
      });
    } else {
      setLookupData({
        householdId: id || "hh_tbw_001",
        name: "Elena Rodriguez",
        address: "2410 Bayshore Blvd, Tampa, FL 33629",
        zone: "Zone A (Surge Evacuation)",
        tier: "Tier 1: High Priority (Medical Equipment)",
        disasterExposure: "CONFIRMED (Hurricane Milton Warning TBW:HU.W:0009)",
        paymentRoute: "PayPal Instant Transfer",
        payoutStatus: "DISBURSED",
        amountDisbursed: "$500.00 USD",
        paypalTransactionId: "81V948123A849204P",
        disbursedAt: "Oct 9, 2024 · 01:45 UTC",
      });
    }
  };

  const handleNextStep = () => {
    setFormError(null);
    if (currentStep === 1) {
      if (!name.trim()) {
        setFormError("Please enter your full name.");
        return;
      }
      if (!address.trim()) {
        setFormError("Please enter your primary home address.");
        return;
      }
    }
    if (currentStep === 3) {
      if (paymentChannel !== "MANUAL" && !paypalEmailOrId.trim()) {
        setFormError("Please enter your PayPal account identifier or email address.");
        return;
      }
    }
    if (currentStep === 4) {
      if (!consentTos || !consentRouting) {
        setFormError("Please check the required consent boxes to proceed.");
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  };

  const handlePrevStep = () => {
    setFormError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!consentTos || !consentRouting) {
      setFormError("Consent to Mutual Aid terms and payment routing are strictly required.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name,
        address,
        isDisplaced,
        currentAddress: isDisplaced ? currentAddress : address,
        lat: 27.9506,
        lng: -82.4572,
        language: lang,
        paymentChannel,
        paypalEmailOrId: paymentChannel !== "MANUAL" ? paypalEmailOrId : undefined,
        evidenceLevel,
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
      if (!res.ok) throw new Error(data.error || "Enrollment submission failed");
      setSuccessResult(data);
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // SUCCESS SCREEN
  if (successResult) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="field-paper p-8 text-center space-y-6 shadow-md border-[#DEDCD3]">
          <div className="w-16 h-16 rounded-full bg-[#E0EEE7] border border-[#97D5B2] flex items-center justify-center mx-auto text-[#175B47]">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-bold text-[#192A24]">
              {t.successTitle}
            </h2>
            <p className="text-sm text-[#58665F] max-w-md mx-auto leading-relaxed">
              {t.successMsg}
            </p>
          </div>

          <div className="bg-[#ECEAE2] p-4 rounded-xl text-left text-xs space-y-2 border border-[#DEDCD3]">
            <div className="flex justify-between items-center py-1 border-b border-[#DEDCD3]">
              <span className="text-[#58665F]">{t.householdRef}:</span>
              <span className="font-mono font-bold text-[#192A24]">
                {successResult.householdId || "hh_tbw_new"}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#DEDCD3]">
              <span className="text-[#58665F]">Data Protection:</span>
              <span className="text-[#175B47] font-semibold flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>AES-256 Encrypted</span>
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-[#58665F]">Status:</span>
              <span className="field-badge-evergreen text-[10px]">VERIFIED ROSTER</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => {
                setSuccessResult(null);
                setCurrentStep(1);
                setName("");
                setAddress("");
                setPaypalEmailOrId("");
              }}
              className="field-btn field-btn-secondary flex-1 text-xs py-2.5"
            >
              Enroll Another Household
            </button>
            <Link
              href="/r/complaints"
              className="field-btn field-btn-primary flex-1 text-xs py-2.5 text-center"
            >
              Community Grievance / Appeals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      {/* Top Header & Language Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#DEDCD3]">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="field-badge-evergreen">Field Atlas Resident Portal</span>
            <span className="field-badge-neutral text-[10px]">Bank-Grade Security</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif text-[#192A24] font-bold tracking-tight">
            {t.title}
          </h1>
          <p className="text-xs sm:text-sm text-[#58665F] mt-1">{t.subtitle}</p>
        </div>

        {/* Language Picker */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <Globe2 className="w-4 h-4 text-[#175B47]" />
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="field-input text-xs py-1.5 px-2.5 bg-[#FFFEFA] font-medium"
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

      {/* Segmented View Control: ENROLL vs STATUS */}
      <div className="flex p-1 bg-[#ECEAE2] rounded-xl border border-[#DEDCD3] text-xs font-semibold">
        <button
          onClick={() => setActiveTab("ENROLL")}
          className={`flex-1 py-2 rounded-lg transition-all ${
            activeTab === "ENROLL"
              ? "bg-[#FFFEFA] text-[#192A24] shadow-xs font-bold"
              : "text-[#58665F] hover:text-[#192A24]"
          }`}
        >
          {t.tabEnroll}
        </button>
        <button
          onClick={() => setActiveTab("STATUS")}
          className={`flex-1 py-2 rounded-lg transition-all ${
            activeTab === "STATUS"
              ? "bg-[#FFFEFA] text-[#192A24] shadow-xs font-bold"
              : "text-[#58665F] hover:text-[#192A24]"
          }`}
        >
          {t.tabStatus}
        </button>
      </div>

      {/* TAB 1: STEP-BASED ENROLLMENT WIZARD */}
      {activeTab === "ENROLL" && (
        <div className="field-paper p-6 sm:p-8 space-y-6 shadow-sm border-[#DEDCD3]">
          {/* Progress Indicator */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-[#58665F]">
              <span className="font-mono font-semibold text-[#175B47]">
                {t.stepIndicator.replace("{step}", String(currentStep))}
              </span>
              <span>
                {currentStep === 1 && t.step1Title}
                {currentStep === 2 && t.step2Title}
                {currentStep === 3 && t.step3Title}
                {currentStep === 4 && t.step4Title}
                {currentStep === 5 && t.step5Title}
              </span>
            </div>
            <div className="w-full bg-[#ECEAE2] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#175B47] h-full transition-all duration-300"
                style={{ width: `${(currentStep / 5) * 100}%` }}
              />
            </div>
          </div>

          {formError && (
            <div className="p-3.5 rounded-xl bg-[#FDF4F0] border border-[#F5A3A3] text-xs text-[#B92525] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* STEP 1: HOUSEHOLD & ADDRESS */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-[#192A24]">
                  {t.step1Title}
                </h2>
                <p className="text-xs text-[#58665F] mt-0.5">{t.step1Desc}</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="field-label flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#58665F]" />
                    <span>{t.fullName} *</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.fullNamePlaceholder}
                    className="field-input w-full mt-1 text-sm bg-[#FFFEFA]"
                    required
                  />
                </div>

                <div>
                  <label className="field-label flex items-center gap-1.5">
                    <Home className="w-3.5 h-3.5 text-[#58665F]" />
                    <span>{t.address} *</span>
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder={t.addressPlaceholder}
                    className="field-input w-full mt-1 text-sm bg-[#FFFEFA]"
                    required
                  />
                </div>

                <div className="pt-2 border-t border-[#DEDCD3] space-y-2">
                  <span className="field-label block">{t.isDisplaced}</span>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-xs text-[#192A24] cursor-pointer">
                      <input
                        type="radio"
                        name="displaced"
                        checked={!isDisplaced}
                        onChange={() => setIsDisplaced(false)}
                        className="text-[#175B47] focus:ring-[#175B47]"
                      />
                      <span>{t.displacedNo}</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-[#192A24] cursor-pointer">
                      <input
                        type="radio"
                        name="displaced"
                        checked={isDisplaced}
                        onChange={() => setIsDisplaced(true)}
                        className="text-[#175B47] focus:ring-[#175B47]"
                      />
                      <span>{t.displacedYes}</span>
                    </label>
                  </div>

                  {isDisplaced && (
                    <div className="pt-2">
                      <label className="field-label">{t.tempAddress}</label>
                      <input
                        type="text"
                        value={currentAddress}
                        onChange={(e) => setCurrentAddress(e.target.value)}
                        placeholder={t.tempAddressPlaceholder}
                        className="field-input w-full mt-1 text-xs bg-[#FFFEFA]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PRIORITY & SAFETY FACTORS */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-[#192A24]">
                  {t.step2Title}
                </h2>
                <p className="text-xs text-[#58665F] mt-0.5">{t.step2Desc}</p>
              </div>

              <div className="space-y-3 pt-1">
                {[
                  {
                    id: "med",
                    label: t.medicalDevice,
                    checked: hasMedicalDevice,
                    setter: setHasMedicalDevice,
                    tier: "Tier 1 Priority",
                  },
                  {
                    id: "elderly",
                    label: t.elderlyAlone,
                    checked: isElderlyLivingAlone,
                    setter: setIsElderlyLivingAlone,
                    tier: "Tier 2 Priority",
                  },
                  {
                    id: "disability",
                    label: t.disability,
                    checked: hasDisability,
                    setter: setHasDisability,
                    tier: "Tier 3 Priority",
                  },
                  {
                    id: "vehicle",
                    label: t.noVehicle,
                    checked: hasNoVehicleInSurgeZone,
                    setter: setHasNoVehicleInSurgeZone,
                    tier: "Tier 4 Priority",
                  },
                  {
                    id: "children",
                    label: t.childrenUnder5,
                    checked: hasChildrenUnder5,
                    setter: setHasChildrenUnder5,
                    tier: "Tier 4 Priority",
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      item.checked
                        ? "bg-[#E0EEE7]/40 border-[#97D5B2]"
                        : "bg-[#FFFEFA] border-[#DEDCD3] hover:bg-[#ECEAE2]/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.setter(e.target.checked)}
                      className="mt-0.5 rounded text-[#175B47] focus:ring-[#175B47]"
                    />
                    <div className="flex-1">
                      <p className="text-xs text-[#192A24] font-medium leading-relaxed">
                        {item.label}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: ASSISTANCE ROUTE */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-[#192A24]">
                  {t.step3Title}
                </h2>
                <p className="text-xs text-[#58665F] mt-0.5">{t.step3Desc}</p>
              </div>

              <div className="space-y-3 pt-1">
                {[
                  {
                    type: "PAYPAL_ID" as PaymentChannelType,
                    title: t.paypalAccount,
                    desc: "Funds transfer directly into your verified PayPal balance in seconds.",
                  },
                  {
                    type: "EMAIL" as PaymentChannelType,
                    title: t.paypalEmail,
                    desc: "An official claim notification is sent to your email to collect funds securely.",
                  },
                  {
                    type: "MANUAL" as PaymentChannelType,
                    title: t.offlineAid,
                    desc: "Physical prepaid card issued via registered community coordinator.",
                  },
                ].map((channel) => (
                  <label
                    key={channel.type}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                      paymentChannel === channel.type
                        ? "bg-[#E0EEE7]/40 border-[#175B47] shadow-xs"
                        : "bg-[#FFFEFA] border-[#DEDCD3] hover:bg-[#ECEAE2]/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentChannel"
                      checked={paymentChannel === channel.type}
                      onChange={() => setPaymentChannel(channel.type)}
                      className="mt-0.5 text-[#175B47] focus:ring-[#175B47]"
                    />
                    <div>
                      <span className="text-xs font-bold text-[#192A24] block">
                        {channel.title}
                      </span>
                      <span className="text-[11px] text-[#58665F] mt-0.5 block">
                        {channel.desc}
                      </span>
                    </div>
                  </label>
                ))}

                {paymentChannel !== "MANUAL" && (
                  <div className="pt-2">
                    <label className="field-label flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-[#58665F]" />
                      <span>{t.paypalFieldLabel} *</span>
                    </label>
                    <input
                      type="text"
                      value={paypalEmailOrId}
                      onChange={(e) => setPaypalEmailOrId(e.target.value)}
                      placeholder="e.g. resident@example.com or PayPal ID"
                      className="field-input w-full mt-1 text-sm bg-[#FFFEFA]"
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: PRIVACY & CONSENTS */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-[#192A24]">
                  {t.step4Title}
                </h2>
                <p className="text-xs text-[#58665F] mt-0.5">{t.step4Desc}</p>
              </div>

              <div className="space-y-3 pt-1">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-[#DEDCD3] bg-[#FFFEFA] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentTos}
                    onChange={(e) => setConsentTos(e.target.checked)}
                    className="mt-0.5 rounded text-[#175B47] focus:ring-[#175B47]"
                  />
                  <span className="text-xs text-[#192A24] font-medium leading-relaxed">
                    {t.consentTos}
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-[#DEDCD3] bg-[#FFFEFA] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentRouting}
                    onChange={(e) => setConsentRouting(e.target.checked)}
                    className="mt-0.5 rounded text-[#175B47] focus:ring-[#175B47]"
                  />
                  <span className="text-xs text-[#192A24] font-medium leading-relaxed">
                    {t.consentRouting}
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-[#DEDCD3] bg-[#FFFEFA] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentLocation}
                    onChange={(e) => setConsentLocation(e.target.checked)}
                    className="mt-0.5 rounded text-[#175B47] focus:ring-[#175B47]"
                  />
                  <span className="text-xs text-[#192A24] font-medium leading-relaxed">
                    {t.consentLocation}
                  </span>
                </label>

                <div className="p-3.5 rounded-xl bg-[#ECEAE2] border border-[#DEDCD3] text-xs text-[#58665F] flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-[#175B47] flex-shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{t.privacyNote}</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & CONFIRM */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-serif font-bold text-[#192A24]">
                  {t.step5Title}
                </h2>
                <p className="text-xs text-[#58665F] mt-0.5">{t.step5Desc}</p>
              </div>

              <div className="bg-[#ECEAE2]/60 p-4 rounded-xl border border-[#DEDCD3] space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-[#DEDCD3]">
                  <span className="text-[#58665F]">{t.fullName}:</span>
                  <span className="font-semibold text-[#192A24]">{name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#DEDCD3]">
                  <span className="text-[#58665F]">{t.address}:</span>
                  <span className="font-semibold text-[#192A24] text-right max-w-xs truncate">
                    {address}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#DEDCD3]">
                  <span className="text-[#58665F]">Payout Route:</span>
                  <span className="font-semibold text-[#175B47]">{paymentChannel}</span>
                </div>
                {paymentChannel !== "MANUAL" && (
                  <div className="flex justify-between py-1 border-b border-[#DEDCD3]">
                    <span className="text-[#58665F]">Recipient Account:</span>
                    <span className="font-mono text-[#192A24]">{paypalEmailOrId}</span>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-[#58665F]">Safety Factors:</span>
                  <span className="text-[#192A24] font-medium">
                    {[
                      hasMedicalDevice && "Medical",
                      isElderlyLivingAlone && "Elderly",
                      hasDisability && "Disability",
                      hasNoVehicleInSurgeZone && "No vehicle",
                      hasChildrenUnder5 && "Children",
                    ]
                      .filter(Boolean)
                      .join(", ") || "Standard Baseline"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#DEDCD3]">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handlePrevStep}
                className="field-btn field-btn-secondary text-xs flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t.back}</span>
              </button>
            ) : (
              <div />
            )}

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="field-btn field-btn-primary text-xs flex items-center gap-1.5"
              >
                <span>{t.continue}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="field-btn field-btn-primary text-xs flex items-center gap-1.5 px-5 py-2.5 font-bold shadow-md"
              >
                {submitting ? (
                  <span>{t.submitting}</span>
                ) : (
                  <>
                    <span>{t.submit}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: STATUS & APPEAL TRACKER */}
      {activeTab === "STATUS" && (
        <div className="field-paper p-6 sm:p-8 space-y-6 shadow-sm border-[#DEDCD3]">
          <div>
            <h2 className="text-lg font-serif font-bold text-[#192A24]">
              {t.lookupTitle}
            </h2>
            <p className="text-xs text-[#58665F] mt-0.5">
              Enter your household reference code to view payout progress or verify linked records.
            </p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#7B847D] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
                placeholder={t.lookupPlaceholder}
                className="field-input pl-9 pr-3 py-2 text-xs w-full bg-[#FFFEFA]"
              />
            </div>
            <button
              onClick={() => handleLookup(lookupId)}
              className="field-btn field-btn-primary text-xs py-2 px-4"
            >
              {t.lookupBtn}
            </button>
          </div>

          {lookupData && (
            <div className="border border-[#DEDCD3] rounded-xl overflow-hidden bg-[#FFFEFA]">
              <div className="p-4 bg-[#ECEAE2] border-b border-[#DEDCD3] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-bold text-[#192A24]">
                    {lookupData.householdId}
                  </span>
                  <p className="text-xs text-[#58665F]">{lookupData.name} · {lookupData.address}</p>
                </div>
                <span className="field-badge-evergreen text-xs">
                  {lookupData.payoutStatus}
                </span>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-[#58665F] block text-[11px]">Evacuation Zone</span>
                    <span className="font-semibold text-[#192A24]">{lookupData.zone}</span>
                  </div>
                  <div>
                    <span className="text-[#58665F] block text-[11px]">Priority Classification</span>
                    <span className="font-semibold text-[#175B47]">{lookupData.tier}</span>
                  </div>
                  <div>
                    <span className="text-[#58665F] block text-[11px]">Disaster Trigger</span>
                    <span className="text-[#192A24]">{lookupData.disasterExposure}</span>
                  </div>
                  <div>
                    <span className="text-[#58665F] block text-[11px]">Assistance Amount</span>
                    <span className="font-bold text-[#175B47] text-sm tabular-nums">
                      {lookupData.amountDisbursed}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#58665F] block text-[11px]">Payment Route</span>
                    <span className="text-[#192A24]">{lookupData.paymentRoute}</span>
                  </div>
                  <div>
                    <span className="text-[#58665F] block text-[11px]">PayPal Transaction / Reference</span>
                    <span className="font-mono text-[#192A24] text-[11px]">
                      {lookupData.paypalTransactionId}
                    </span>
                  </div>
                </div>

                {lookupData.claimUrl && (
                  <div className="p-3 bg-[#FEF5E7] border border-[#F3CA8A] rounded-lg text-xs text-[#B46914] flex items-center justify-between">
                    <span>Payment is waiting for claim link confirmation on PayPal.</span>
                    <a
                      href={lookupData.claimUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold underline flex items-center gap-1"
                    >
                      <span>Claim on PayPal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              <div className="p-3 bg-[#ECEAE2]/40 border-t border-[#DEDCD3] flex items-center justify-between text-xs">
                <span className="text-[#58665F] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#7B847D]" />
                  <span>Disbursed: {lookupData.disbursedAt}</span>
                </span>
                <Link
                  href="/r/complaints"
                  className="text-[#175B47] font-semibold hover:underline flex items-center gap-1"
                >
                  <span>Submit Correction or Appeal</span>
                  <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-[#E0EEE7]/40 border border-[#97D5B2] text-xs text-[#175B47] flex items-start gap-2.5">
            <HeartHandshake className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">{t.appealNotice}</p>
          </div>
        </div>
      )}
    </div>
  );
}
