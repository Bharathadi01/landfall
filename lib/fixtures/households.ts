import { type HouseholdProfile, type PolicyConfig } from "@/lib/rules/engine";

export type SyntheticHousehold = HouseholdProfile & {
  lat: number;
  lng: number;
  receiverEmail: string;
  displayName: string;
};

export const SYNTHETIC_HOUSEHOLDS: SyntheticHousehold[] = [
  {
    id: "hh_tbw_001",
    displayName: "Elena Rodriguez (Oxygen Concentrator)",
    address: "2410 Bayshore Blvd, Tampa, FL 33629",
    zone: "Zone A (Surge Evacuation)",
    language: "es",
    recipientPath: "LINKED_PAYPAL",
    evidenceLevel: "DOCUMENT",
    enrolledAt: "2024-08-15T10:00:00Z",
    hasMedicalDevice: true, // Tier 1: P1_MEDICAL_DEVICE
    isElderlyLivingAlone: false,
    hasDisability: true,
    hasNoVehicleInSurgeZone: true,
    hasChildrenUnder5: false,
    numMembers: 2,
    hasMissingDocs: false,
    isExposureConfirmed: false,
    lat: 27.915,
    lng: -82.492,
    receiverEmail: "sb-tv43cm53751698@personal.example.com", // Verified sandbox personal receiver
  },
  {
    id: "hh_tbw_002",
    displayName: "Arthur Pendelton (82, Living Alone)",
    address: "412 Gulf Way, St. Pete Beach, FL 33706",
    zone: "Zone A (Barrier Island)",
    language: "en",
    recipientPath: "EMAIL_CLAIM",
    evidenceLevel: "ATTESTED",
    enrolledAt: "2024-09-01T14:30:00Z",
    hasMedicalDevice: false,
    isElderlyLivingAlone: true, // Tier 2: P2_ELDERLY_ALONE
    hasDisability: false,
    hasNoVehicleInSurgeZone: true,
    hasChildrenUnder5: false,
    numMembers: 1,
    hasMissingDocs: false,
    isExposureConfirmed: false,
    lat: 27.724,
    lng: -82.741,
    receiverEmail: "sb-h4335437482811@personal.example.com", // Verified sandbox personal receiver
  },
  {
    id: "hh_tbw_003",
    displayName: "Fatima & Marcus Al-Mansoor (Mobility Impairment)",
    address: "1802 7th Ave, Ybor City, Tampa, FL 33605",
    zone: "Zone B",
    language: "en",
    recipientPath: "LINKED_PAYPAL",
    evidenceLevel: "DOCUMENT",
    enrolledAt: "2024-09-10T09:15:00Z",
    hasMedicalDevice: false,
    isElderlyLivingAlone: false,
    hasDisability: true, // Tier 3: P3_DISABILITY
    hasNoVehicleInSurgeZone: false,
    hasChildrenUnder5: false,
    numMembers: 3,
    hasMissingDocs: false,
    isExposureConfirmed: false,
    lat: 27.96,
    lng: -82.438,
    receiverEmail: "landfall-recipient-002@example.com",
  },
  {
    id: "hh_tbw_004",
    displayName: "Carla Gomez (No Car, Surge Zone)",
    address: "804 Palmetto Rd, Palmetto, FL 34221",
    zone: "Zone A (Manatee River)",
    language: "es",
    recipientPath: "EMAIL_CLAIM",
    evidenceLevel: "ATTESTED",
    enrolledAt: "2024-09-20T11:00:00Z",
    hasMedicalDevice: false,
    isElderlyLivingAlone: false,
    hasDisability: false,
    hasNoVehicleInSurgeZone: true, // Tier 4: P4_NO_VEHICLE_SURGE
    hasChildrenUnder5: true,
    numMembers: 4,
    hasMissingDocs: false,
    isExposureConfirmed: false,
    lat: 27.685,
    lng: -82.572,
    receiverEmail: "landfall-recipient-003@example.com",
  },
  {
    id: "hh_tbw_005",
    displayName: "Desmond & Tina Washington (Infant & Toddler)",
    address: "3204 18th Ave S, St. Petersburg, FL 33712",
    zone: "Zone C",
    language: "en",
    recipientPath: "LINKED_PAYPAL",
    evidenceLevel: "SELF_DECLARED",
    enrolledAt: "2024-09-22T16:45:00Z",
    hasMedicalDevice: false,
    isElderlyLivingAlone: false,
    hasDisability: false,
    hasNoVehicleInSurgeZone: false,
    hasChildrenUnder5: true, // Tier 5: P5_CHILDREN_UNDER_5
    numMembers: 4,
    hasMissingDocs: false,
    isExposureConfirmed: false,
    lat: 27.752,
    lng: -82.678,
    receiverEmail: "landfall-recipient-004@example.com",
  },
  {
    id: "hh_orl_006",
    displayName: "Lucas Miller (Inland - Out of Surge Warning Area)",
    address: "400 W Amelia St, Orlando, FL 32801",
    zone: "Orange County Inland",
    language: "en",
    recipientPath: "EMAIL_CLAIM",
    evidenceLevel: "DOCUMENT",
    enrolledAt: "2024-09-25T13:00:00Z",
    hasMedicalDevice: false,
    isElderlyLivingAlone: false,
    hasDisability: false,
    hasNoVehicleInSurgeZone: false,
    hasChildrenUnder5: false,
    numMembers: 1,
    hasMissingDocs: false,
    isExposureConfirmed: false,
    lat: 28.545,
    lng: -81.383, // Orlando: outside Tampa Bay warning polygon
    receiverEmail: "landfall-recipient-005@example.com",
  },
];

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  version: "policy_v2024_milton",
  tranche1AmountCents: 10000, // $100.00
  tranche2BaseAmountCents: 25000, // $250.00
  tranche2PerPersonCents: 5000, // $50.00
  tranche2VulnerabilityAddOnCents: 5000,
  maxPerHouseholdPerEventCents: 50000, // $500.00 cap
  maxHouseholdsPerAddress: 2,
  feePerItemCents: 25, // $0.25 PayPal Payouts fee
  feePercentage: 0.0,
};

