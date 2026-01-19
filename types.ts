

export enum PatientStatus {
  ADMISSION = 'Admissão',
  ACTIVE_LABOR = 'Trabalho de Parto Ativo',
  INDUCTION = 'Indução',
  POSTPARTUM = 'Puerpério Imediato',
  PARTOGRAM_OPENED = 'Partograma Aberto',
  DISCHARGED = 'Alta/Transferência'
}

export enum MembraneStatus {
  INTACT = 'Íntegras',
  RUPTURED_CLEAR = 'Rotas Claras',
  RUPTURED_MECONIUM = 'Rotas Meconiais'
}

export interface VitalSigns {
  fc?: number; // Frequência Cardíaca (bpm)
  tax?: number; // Temperatura Axilar (C)
  spo2?: number; // Saturação de Oxigênio (%)
  paSystolic?: number; // Pressão Arterial Sistólica (Sentada/Padrão)
  paDiastolic?: number; // Pressão Arterial Diastólica (Sentada/Padrão)
  paPosition?: 'sitting' | 'standing'; // Deprecated logic, but kept for compatibility. Now defaults to sitting.
  
  // Novos campos para protocolo Metildopa
  paStandingSystolic?: number;
  paStandingDiastolic?: number;
}

export interface ObstetricData {
  bcf?: number; // Batimentos Cardíacos Fetais
  dinamicaFrequency?: number; // Quantidade de contrações em 10 min
  dinamicaDuration?: number; // Duração média em segundos (Deprecated in favor of summary, but kept for calc)
  dinamicaSummary?: string; // Ex: "2x30'; 1x45' em 10'"
  
  // Toque Vaginal Completo
  dilation?: number; // Dilatação cervical (0-10 cm)
  cervixStatus?: string[]; // Para casos sem dilatação numérica: ['OEI', 'OEEA', 'OII']
  effacement?: number; // Apagamento (%) - 0 será tratado como "Grosso" (G)
  cervixPosition?: 'Posterior' | 'Intermediário' | 'Central';
  cervixConsistency?: 'Nasal' | 'Nasolabial' | 'Labial';
  presentationHeight?: 'AM' | 'INS'; // Novo: Alto e Móvel (AM) ou Insinuado (INS)
  station?: number; // Plano de De Lee (-4 a +4)
  
  membranes?: MembraneStatus;
  bloodOnGlove?: boolean; // Sangue em dedo de luva (SDL) ou Sem sangue (SSDL)
}

export interface MagnesiumData {
  reflex: 'Presente' | 'Ausente' | 'Exaltado' | 'Diminuído';
  diuresis: string; // mL ou texto livre (ex: "Clara, 100ml")
  respiratoryRate?: number; // irpm
}

export interface Medication {
  misoprostolDose?: number; // mcg
  oxytocinDose?: number; // mU/min ou ml/h
  antibiotic?: string;
  notes?: string;
}

export interface Observation {
  id: string;
  patientId: string;
  timestamp: string;
  vitals: VitalSigns;
  obstetric: ObstetricData;
  medication?: Medication;
  magnesiumData?: MagnesiumData; // Dados específicos do protocolo
  examinerName: string;
  notes?: string;
}

export interface ScheduledTask {
  id: string;
  timestamp: string; // ISO String
  focus: string[]; // ['BCF', 'PA', 'Toque']
  status: 'pending' | 'completed' | 'cancelled';
}

export interface Patient {
  id: string;
  name: string;
  bed: string;
  age: number;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  parity: string; // GnPnAn
  admissionDate: string;
  status: PatientStatus;
  bloodType?: string;
  riskFactors?: string[];
  useMethyldopa?: boolean; // Indica uso de Metildopa
  useMagnesiumSulfate?: boolean; // Indica uso de Sulfato de Magnésio
  dischargeTime?: string; // Data/Hora da alta para cálculo de expiração (72h)
  lastObservation?: Observation;
  schedule: ScheduledTask[]; // Novo sistema de agendamento
}