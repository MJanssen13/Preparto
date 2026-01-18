import { Patient, Observation, PatientStatus } from '../types';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
// Handle both Vite (import.meta.env) and standard process.env for compatibility
const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  // Fallback for other environments if needed
  return (process as any).env?.[key];
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://itpdwlpraogwsdezsotl.supabase.co'; 
const SUPABASE_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || 'sb_publishable_w6fGM5XImiuAtOt-baidAQ_dzLurOtK';

// Initialize Supabase Client if keys are present
const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;

const STORAGE_KEY_PATIENTS = 'maternocare_patients';
const STORAGE_KEY_OBSERVATIONS = 'maternocare_observations';

// Helper to simulate network delay for mock
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * DATA MAPPING HELPER
 * Maps CamelCase (App) <-> SnakeCase (Database)
 */

const mapPatientToDB = (p: Partial<Patient>) => {
  return {
    ...(p.name && { name: p.name }),
    ...(p.bed && { bed: p.bed }),
    ...(p.age && { age: p.age }),
    ...(p.gestationalAgeWeeks && { gestational_age_weeks: p.gestationalAgeWeeks }),
    ...(p.gestationalAgeDays && { gestational_age_days: p.gestationalAgeDays }),
    ...(p.parity && { parity: p.parity }),
    ...(p.admissionDate && { admission_date: p.admissionDate }),
    ...(p.status && { status: p.status }),
    ...(p.bloodType && { blood_type: p.bloodType }),
    ...(p.riskFactors && { risk_factors: p.riskFactors }),
    ...(p.useMethyldopa !== undefined && { use_methyldopa: p.useMethyldopa }),
    ...(p.useMagnesiumSulfate !== undefined && { use_magnesium_sulfate: p.useMagnesiumSulfate }),
    ...(p.schedule && { schedule: p.schedule }),
    ...(p.lastObservation && { last_observation: p.lastObservation })
  };
};

const mapPatientFromDB = (db: any): Patient => {
  return {
    id: db.id,
    name: db.name,
    bed: db.bed,
    age: db.age,
    gestationalAgeWeeks: db.gestational_age_weeks,
    gestationalAgeDays: db.gestational_age_days,
    parity: db.parity,
    admissionDate: db.admission_date,
    status: db.status,
    bloodType: db.blood_type,
    riskFactors: db.risk_factors,
    useMethyldopa: db.use_methyldopa,
    useMagnesiumSulfate: db.use_magnesium_sulfate,
    schedule: db.schedule || [],
    lastObservation: db.last_observation
  };
};

const mapObservationToDB = (o: Partial<Observation>) => {
    return {
        ...(o.patientId && { patient_id: o.patientId }),
        ...(o.timestamp && { timestamp: o.timestamp }),
        ...(o.vitals && { vitals: o.vitals }),
        ...(o.obstetric && { obstetric: o.obstetric }),
        ...(o.medication && { medication: o.medication }),
        ...(o.magnesiumData && { magnesium_data: o.magnesiumData }),
        ...(o.examinerName && { examiner_name: o.examinerName }),
        ...(o.notes && { notes: o.notes }),
    }
}

const mapObservationFromDB = (db: any): Observation => {
    return {
        id: db.id,
        patientId: db.patient_id,
        timestamp: db.timestamp,
        vitals: db.vitals,
        obstetric: db.obstetric,
        medication: db.medication,
        magnesiumData: db.magnesium_data,
        examinerName: db.examiner_name,
        notes: db.notes
    }
}

// --- LOCAL STORAGE MOCK IMPLEMENTATION (FALLBACK) ---
const mockService = {
  async getPatients(): Promise<Patient[]> {
    await delay(300);
    const data = localStorage.getItem(STORAGE_KEY_PATIENTS);
    const patients: Patient[] = data ? JSON.parse(data) : [];
    return this.sortPatients(patients);
  },

  sortPatients(patients: Patient[]) {
    return patients.sort((a, b) => {
      if (a.status === PatientStatus.DISCHARGED && b.status !== PatientStatus.DISCHARGED) return 1;
      if (b.status === PatientStatus.DISCHARGED && a.status !== PatientStatus.DISCHARGED) return -1;
      return a.bed.localeCompare(b.bed, undefined, { numeric: true });
    });
  },

  async getPatientById(id: string): Promise<Patient | undefined> {
    await delay(200);
    const patients = await this.getPatients();
    return patients.find(p => p.id === id);
  },

  async createPatient(patientData: Omit<Patient, 'id' | 'lastObservation'>): Promise<Patient> {
    await delay(400);
    const patients = await this.getPatients();
    const newPatient: Patient = { ...patientData, id: crypto.randomUUID() };
    patients.push(newPatient);
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
    return newPatient;
  },

  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient | null> {
    await delay(300);
    const patients = await this.getPatients();
    const index = patients.findIndex(p => p.id === id);
    if (index === -1) return null;
    patients[index] = { ...patients[index], ...updates };
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
    return patients[index];
  },

  async getObservations(patientId: string): Promise<Observation[]> {
    await delay(300);
    const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
    const allObs: Observation[] = data ? JSON.parse(data) : [];
    return allObs
      .filter(o => o.patientId === patientId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  async getObservationById(id: string): Promise<Observation | undefined> {
     await delay(200);
     const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
     const allObs: Observation[] = data ? JSON.parse(data) : [];
     return allObs.find(o => o.id === id);
  },

  async updateObservation(id: string, updates: Partial<Observation>): Promise<Observation | null> {
    await delay(300);
    const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
    const allObs: Observation[] = data ? JSON.parse(data) : [];
    const index = allObs.findIndex(o => o.id === id);
    if (index === -1) return null;
    
    // Merge
    const updatedObs = { ...allObs[index], ...updates };
    allObs[index] = updatedObs;
    localStorage.setItem(STORAGE_KEY_OBSERVATIONS, JSON.stringify(allObs));

    // Update patient cache if needed
    const patients = await this.getPatients();
    const pIndex = patients.findIndex(p => p.id === updatedObs.patientId);
    if (pIndex >= 0) {
        const patientObs = allObs
            .filter(o => o.patientId === updatedObs.patientId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (patientObs.length > 0) {
            patients[pIndex].lastObservation = patientObs[0];
            localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
        }
    }
    return updatedObs;
  },

  async addObservation(obsData: Omit<Observation, 'id' | 'timestamp'>, scheduledTaskId?: string): Promise<Observation> {
    await delay(400);
    const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
    const allObs: Observation[] = data ? JSON.parse(data) : [];
    const newObs: Observation = { ...obsData, id: crypto.randomUUID(), timestamp: new Date().toISOString() };
    allObs.push(newObs);
    localStorage.setItem(STORAGE_KEY_OBSERVATIONS, JSON.stringify(allObs));

    // Update patient side effects (Schedule + Last Obs)
    const patients = await this.getPatients();
    const patientIndex = patients.findIndex(p => p.id === obsData.patientId);
    
    if (patientIndex >= 0) {
      const patient = patients[patientIndex];
      patient.lastObservation = newObs;

      const updatedSchedule = patient.schedule.map(task => {
        if (scheduledTaskId && task.id === scheduledTaskId) return { ...task, status: 'completed' as const };
        if (!scheduledTaskId && task.status === 'pending') {
          const obsTime = new Date(newObs.timestamp).getTime();
          const taskTime = new Date(task.timestamp).getTime();
          if (Math.abs(taskTime - obsTime) / 60000 <= 60) return { ...task, status: 'completed' as const };
        }
        return task;
      });
      patient.schedule = updatedSchedule;
      localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
    }
    return newObs;
  }
};

// --- MAIN EXPORTED SERVICE (HYBRID) ---
export const patientService = {
  async getPatients(): Promise<Patient[]> {
    if (!supabase) return mockService.getPatients();
    
    const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('bed', { ascending: true }); // Simplistic sort, client can resort
    
    if (error) {
        console.error('Supabase error:', error);
        return mockService.getPatients(); // Fallback on error
    }
    
    const patients = data.map(mapPatientFromDB);
    return mockService.sortPatients(patients); // Re-use local sort logic
  },

  async getPatientById(id: string): Promise<Patient | undefined> {
    if (!supabase) return mockService.getPatientById(id);

    const { data, error } = await supabase.from('patients').select('*').eq('id', id).single();
    if (error || !data) return undefined;
    
    return mapPatientFromDB(data);
  },

  async createPatient(patientData: Omit<Patient, 'id' | 'lastObservation'>): Promise<Patient> {
    if (!supabase) return mockService.createPatient(patientData);

    const dbPayload = mapPatientToDB(patientData);
    const { data, error } = await supabase.from('patients').insert(dbPayload).select().single();
    
    if (error) throw error;
    return mapPatientFromDB(data);
  },

  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient | null> {
    if (!supabase) return mockService.updatePatient(id, updates);

    const dbPayload = mapPatientToDB(updates);
    const { data, error } = await supabase.from('patients').update(dbPayload).eq('id', id).select().single();
    
    if (error) return null;
    return mapPatientFromDB(data);
  },

  async getObservations(patientId: string): Promise<Observation[]> {
    if (!supabase) return mockService.getObservations(patientId);

    const { data, error } = await supabase
        .from('observations')
        .select('*')
        .eq('patient_id', patientId)
        .order('timestamp', { ascending: false });

    if (error) return [];
    return data.map(mapObservationFromDB);
  },

  async getObservationById(id: string): Promise<Observation | undefined> {
      if (!supabase) return mockService.getObservationById(id);
      
      const { data, error } = await supabase.from('observations').select('*').eq('id', id).single();
      if (error || !data) return undefined;
      return mapObservationFromDB(data);
  },

  async updateObservation(id: string, updates: Partial<Observation>): Promise<Observation | null> {
      if (!supabase) return mockService.updateObservation(id, updates);
      
      const dbPayload = mapObservationToDB(updates);
      const { data, error } = await supabase.from('observations').update(dbPayload).eq('id', id).select().single();
      if (error) return null;
      
      const updatedObs = mapObservationFromDB(data);

      // Trigger Side Effect on Patient (Last Obs update)
      // Note: In a real backend, a Database Trigger (PL/pgSQL) is better for this.
      // We do it client-side here to mimic the mock service behavior.
      const patient = await this.getPatientById(updatedObs.patientId);
      if (patient) {
          await this.updatePatient(patient.id, { lastObservation: updatedObs });
      }

      return updatedObs;
  },

  async addObservation(obsData: Omit<Observation, 'id' | 'timestamp'>, scheduledTaskId?: string): Promise<Observation> {
    if (!supabase) return mockService.addObservation(obsData, scheduledTaskId);

    const timestamp = new Date().toISOString();
    const dbPayload = mapObservationToDB({ ...obsData, timestamp });
    
    const { data, error } = await supabase.from('observations').insert(dbPayload).select().single();
    if (error) throw error;

    const newObs = mapObservationFromDB(data);

    // Update Patient Side Effects (Schedule + Last Obs)
    const patient = await this.getPatientById(newObs.patientId);
    if (patient) {
        const updatedSchedule = patient.schedule.map(task => {
            if (scheduledTaskId && task.id === scheduledTaskId) return { ...task, status: 'completed' as const };
            if (!scheduledTaskId && task.status === 'pending') {
              const obsTime = new Date(newObs.timestamp).getTime();
              const taskTime = new Date(task.timestamp).getTime();
              if (Math.abs(taskTime - obsTime) / 60000 <= 60) return { ...task, status: 'completed' as const };
            }
            return task;
        });

        await this.updatePatient(patient.id, { 
            schedule: updatedSchedule,
            lastObservation: newObs 
        });
    }

    return newObs;
  }
};

// --- DATA SEEDING FOR MOCK ---
const seedData = () => {
  if (!supabase && !localStorage.getItem(STORAGE_KEY_PATIENTS)) {
    const now = new Date();
    const time1 = new Date(now.getTime() + 15 * 60000); // +15 min
    const time2 = new Date(now.getTime() + 45 * 60000); // +45 min

    const mockPatients: Patient[] = [
      {
        id: '1',
        name: 'Maria Silva',
        bed: '01',
        age: 28,
        gestationalAgeWeeks: 39,
        gestationalAgeDays: 2,
        parity: 'G2P1A0',
        admissionDate: new Date().toISOString(),
        status: PatientStatus.ACTIVE_LABOR,
        riskFactors: ['Hipertensão Gestacional'],
        bloodType: 'A+',
        schedule: [
            { id: 't1', timestamp: time1.toISOString(), focus: ['BCF', 'Dinâmica'], status: 'pending' },
            { id: 't2', timestamp: time2.toISOString(), focus: ['BCF', 'PA'], status: 'pending' }
        ]
      },
      {
        id: '2',
        name: 'Ana Costa',
        bed: '03',
        age: 22,
        gestationalAgeWeeks: 40,
        gestationalAgeDays: 5,
        parity: 'G1P0A0',
        admissionDate: new Date(Date.now() - 86400000).toISOString(),
        status: PatientStatus.INDUCTION,
        riskFactors: [],
        bloodType: 'O+',
        schedule: []
      }
    ];
    localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(mockPatients));
  }
};

seedData();