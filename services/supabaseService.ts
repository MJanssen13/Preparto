
import { Patient, Observation, PatientStatus, CTG } from '../types';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ---
const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key];
  }
  return (process as any).env?.[key];
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || 'https://itpdwlpraogwsdezsotl.supabase.co'; 
const SUPABASE_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || 'sb_publishable_w6fGM5XImiuAtOt-baidAQ_dzLurOtK';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const supabase = (SUPABASE_URL && SUPABASE_KEY) 
  ? createClient(SUPABASE_URL, SUPABASE_KEY) 
  : null;

const STORAGE_KEY_PATIENTS = 'maternocare_patients';
const STORAGE_KEY_OBSERVATIONS = 'maternocare_observations';
const STORAGE_KEY_CTGS = 'maternocare_ctgs';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isPatientResolved = (status: PatientStatus) => {
    return [
        PatientStatus.DISCHARGED, 
        PatientStatus.PARTOGRAM_OPENED,
        PatientStatus.DELIVERY,
        PatientStatus.C_SECTION
    ].includes(status);
};

const isPatientExpired = (p: Patient): boolean => {
  const isResolved = isPatientResolved(p.status);
  if (!isResolved) return false;
  if (!p.dischargeTime) return false; 
  
  const dischargeDate = new Date(p.dischargeTime).getTime();
  const now = new Date().getTime();
  const hoursSinceDischarge = (now - dischargeDate) / (1000 * 60 * 60);
  return hoursSinceDischarge >= 72;
};

const mapPatientToDB = (p: Partial<Patient>) => {
  const payload: any = {
    ...(p.name && { name: p.name }),
    ...(p.medicalRecordNumber && { medical_record_number: p.medicalRecordNumber }),
    ...(p.babyName && { baby_name: p.babyName }),
    ...(p.bed && { bed: p.bed }),
    ...(p.age && { age: p.age }),
    ...(p.gestationalAgeWeeks && { gestational_age_weeks: p.gestationalAgeWeeks }),
    ...(p.gestationalAgeDays && { gestational_age_days: p.gestationalAgeDays }),
    ...(p.parity && { parity: p.parity }),
    ...(p.admissionDate && { admission_date: p.admissionDate }),
    ...(p.status && { status: p.status }),
    ...(p.bloodType && { blood_type: p.bloodType }),
    ...(p.riskFactors && { risk_factors: p.riskFactors }),
    
    // Protocols
    ...(p.useMethyldopa !== undefined && { use_methyldopa: p.useMethyldopa }),
    ...(p.methyldopaStartTime !== undefined && { methyldopa_start_time: p.methyldopaStartTime }),
    ...(p.methyldopaEndTime !== undefined && { methyldopa_end_time: p.methyldopaEndTime }),
    
    ...(p.useMagnesiumSulfate !== undefined && { use_magnesium_sulfate: p.useMagnesiumSulfate }),
    ...(p.magnesiumSulfateStartTime !== undefined && { magnesium_sulfate_start_time: p.magnesiumSulfateStartTime }),
    ...(p.magnesiumSulfateEndTime !== undefined && { magnesium_sulfate_end_time: p.magnesiumSulfateEndTime }),

    // Schedule and Observations
    ...(Array.isArray(p.schedule) && { schedule: p.schedule }),
    ...(p.lastObservation && { last_observation: p.lastObservation }),
    
    // Partogram Data
    ...(p.partogramData && { partogram_data: p.partogramData }),

    // REMOVED: ctgs mapping here. CTGs are now handled in a separate table.
  };

  if (p.dischargeTime === null) {
      payload.discharge_time = null;
  } else if (p.dischargeTime) {
      payload.discharge_time = p.dischargeTime;
  }

  return payload;
};

const mapPatientFromDB = (db: any): Patient => {
  return {
    id: db.id,
    name: db.name,
    medicalRecordNumber: db.medical_record_number,
    babyName: db.baby_name,
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
    methyldopaStartTime: db.methyldopa_start_time,
    methyldopaEndTime: db.methyldopa_end_time,
    
    useMagnesiumSulfate: db.use_magnesium_sulfate,
    magnesiumSulfateStartTime: db.magnesium_sulfate_start_time,
    magnesiumSulfateEndTime: db.magnesium_sulfate_end_time,

    dischargeTime: db.discharge_time,
    schedule: db.schedule || [],
    lastObservation: db.last_observation,
    observations: db.observations ? db.observations.map(mapObservationFromDB) : undefined,
    ctgs: db.ctgs ? db.ctgs.map(mapCTGFromDB) : [],
    partogramData: db.partogram_data
  };
};

const mapObservationToDB = (o: Partial<Observation>) => {
    return {
        ...(o.patientId && { patient_id: o.patientId }),
        ...(o.timestamp && { timestamp: o.timestamp }),
        ...(o.vitals && { 
            vitals: {
                ...o.vitals,
                dxt: o.vitals?.dxt
            }
        }),
        ...(o.obstetric && { obstetric: o.obstetric }),
        ...(o.medication && { 
            medication: {
                ...o.medication,
                misoprostolCount: o.medication.misoprostolCount
            } 
        }),
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

// --- CTG MAPPERS ---
const mapCTGToDB = (c: Partial<CTG>) => {
  return {
      ...(c.patientId && { patient_id: c.patientId }),
      ...(c.timestamp && { timestamp: c.timestamp }),
      ...(c.baseline && { baseline: c.baseline }),
      ...(c.variability && { variability: c.variability }),
      ...(c.accelerations && { accelerations: c.accelerations }),
      ...(c.atMfRatio && { at_mf_ratio: c.atMfRatio }),
      ...(c.movements && { movements: c.movements }),
      ...(c.decelerations && { decelerations: c.decelerations }),
      ...(c.decelerationDetails && { deceleration_details: c.decelerationDetails }),
      ...(c.contractions && { contractions: c.contractions }),
      ...(c.soundStimulus && { sound_stimulus: c.soundStimulus }),
      ...(c.stimulusCount && { stimulus_count: c.stimulusCount }),
      ...(c.score !== undefined && { score: c.score }),
      ...(c.conclusion && { conclusion: c.conclusion }),
      ...(c.notes && { notes: c.notes }),
      ...(c.image && { image: c.image })
  };
};

const mapCTGFromDB = (db: any): CTG => {
  return {
      id: db.id,
      patientId: db.patient_id,
      timestamp: db.timestamp,
      baseline: db.baseline,
      variability: db.variability,
      accelerations: db.accelerations,
      atMfRatio: db.at_mf_ratio,
      movements: db.movements,
      decelerations: db.decelerations,
      decelerationDetails: db.deceleration_details,
      contractions: db.contractions,
      soundStimulus: db.sound_stimulus,
      stimulusCount: db.stimulus_count,
      score: db.score,
      conclusion: db.conclusion,
      notes: db.notes,
      image: db.image
  };
};

// --- HELPER PARA MÍNIMO E MÁXIMO ---
export const get24hStats = (observations: Observation[] | undefined) => {
    if (!observations || observations.length === 0) return null;

    const now = new Date().getTime();
    const cutoff = now - (24 * 60 * 60 * 1000);
    
    const recent = observations.filter(o => new Date(o.timestamp).getTime() > cutoff);
    if (recent.length === 0) return null;

    const formatRange = (values: number[]) => {
        if (values.length === 0) return '-';
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (min === max) return `${min}`;
        return `${min}-${max}`;
    };

    const bcfValues = recent.map(o => o.obstetric?.bcf).filter((v): v is number => v !== undefined);
    const pasValues = recent.map(o => o.vitals?.paSystolic).filter((v): v is number => v !== undefined);
    const padValues = recent.map(o => o.vitals?.paDiastolic).filter((v): v is number => v !== undefined);

    return {
        bcf: formatRange(bcfValues),
        pas: formatRange(pasValues),
        pad: formatRange(padValues),
        count: recent.length,
        hasBcf: bcfValues.length > 0,
        hasPa: pasValues.length > 0
    };
};

export const patientService = {
  async getPatients(): Promise<Patient[]> {
    if (!supabase) {
        // LOCAL STORAGE
        const data = localStorage.getItem(STORAGE_KEY_PATIENTS);
        const obsData = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
        const ctgData = localStorage.getItem(STORAGE_KEY_CTGS);
        
        let patients: Patient[] = data ? JSON.parse(data) : [];
        const allObs: Observation[] = obsData ? JSON.parse(obsData) : [];
        const allCtgs: CTG[] = ctgData ? JSON.parse(ctgData) : [];

        patients = patients.map(p => ({
            ...p,
            observations: allObs
                .filter(o => o.patientId === p.id)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
            ctgs: allCtgs
                .filter(c => c.patientId === p.id)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        }));

        patients = patients.filter(p => !isPatientExpired(p));
        return patients.sort((a, b) => {
            const aResolved = isPatientResolved(a.status);
            const bResolved = isPatientResolved(b.status);
            
            if (aResolved && !bResolved) return 1;
            if (bResolved && !aResolved) return -1;
            
            return a.bed.localeCompare(b.bed, undefined, { numeric: true });
        });
    }

    // SUPABASE: Optimized fetch - Get patients with essential observation data only
    // We exclude CTGs (too heavy) and full observation details
    const { data, error } = await supabase
        .from('patients')
        .select(`
            *,
            observations (
                id,
                timestamp,
                obstetric,
                vitals
            )
        `)
        .order('bed', { ascending: true });
        
    if (error) return [];
    
    const patients = data.map(dbPatient => {
        const p = mapPatientFromDB(dbPatient);
        // Sort observations desc
        if (p.observations) {
            p.observations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        return p;
    });

    return patients.filter(p => !isPatientExpired(p));
  },

  async getPatientById(id: string): Promise<Patient | undefined> {
    if (!supabase) {
        const patients = await this.getPatients();
        return patients.find(p => p.id === id);
    }
    const { data, error } = await supabase
        .from('patients')
        .select('*, observations(*), ctgs(*)')
        .eq('id', id)
        .single();

    if (error || !data) return undefined;
    const p = mapPatientFromDB(data);
    if (p.observations) {
        p.observations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    if (p.ctgs) {
        p.ctgs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return p;
  },

  async createPatient(patientData: Omit<Patient, 'id' | 'lastObservation'>): Promise<Patient> {
    if (!supabase) {
        const patients = await this.getPatients();
        const newPatient: Patient = { ...patientData, id: generateUUID(), ctgs: [] };
        patients.push(newPatient);
        const storagePatients = patients.map(({ observations, ctgs, ...rest }) => rest);
        localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(storagePatients));
        return newPatient;
    }
    // ctgs are not saved in patient creation in DB, they are added separately
    const dbPayload = mapPatientToDB(patientData);
    console.log('Creating patient with payload:', dbPayload);
    const { data, error } = await supabase.from('patients').insert(dbPayload).select().single();
    if (error) {
        console.error('Supabase Create Patient Error:', error);
        throw error;
    }
    return mapPatientFromDB(data);
  },

  async updatePatient(id: string, updates: Partial<Patient>): Promise<Patient | null> {
    if (!supabase) {
        const patients = await this.getPatients();
        const index = patients.findIndex(p => p.id === id);
        if (index === -1) return null;
        patients[index] = { ...patients[index], ...updates };
        
        const storagePatients = patients.map(({ observations, ctgs, ...rest }) => rest);
        localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(storagePatients));
        return patients[index];
    }
    const dbPayload = mapPatientToDB(updates);
    const { data, error } = await supabase.from('patients').update(dbPayload).eq('id', id).select().single();
    if (error) {
        console.error("Supabase update error:", JSON.stringify(error, null, 2));
        throw error;
    }
    return mapPatientFromDB(data);
  },
  
  // ... rest of the service functions are the same as before
  async resolvePatient(id: string, newStatus: PatientStatus, customDischargeTime?: string): Promise<void> {
      const currentPatient = await this.getPatientById(id);
      if (!currentPatient) throw new Error('Patient not found');

      const updatedSchedule = (currentPatient.schedule || []).filter(task => 
          task.status !== 'pending'
      );

      const updates: Partial<Patient> = {
          status: newStatus,
          dischargeTime: customDischargeTime || new Date().toISOString(),
          schedule: updatedSchedule
      };

      try {
          const result = await this.updatePatient(id, updates);
          if (!result) throw new Error('Failed to resolve patient');
      } catch (error: any) {
          if (error?.code === 'PGRST204') {
              const { dischargeTime, ...fallbackUpdates } = updates;
              await this.updatePatient(id, fallbackUpdates);
              return; 
          }
          throw error;
      }
  },

  async reopenPatient(id: string): Promise<void> {
      const updates: Partial<Patient> = {
          status: PatientStatus.ACTIVE_LABOR,
          dischargeTime: null
      };

      try {
          await this.updatePatient(id, updates);
      } catch (error: any) {
           if (error?.code === 'PGRST204') {
               await this.updatePatient(id, { status: PatientStatus.ACTIVE_LABOR });
               return;
           }
           throw error;
      }
  },

  async deletePatient(id: string): Promise<void> {
    if (!supabase) {
        const patientsStr = localStorage.getItem(STORAGE_KEY_PATIENTS);
        if (patientsStr) {
            const patients = JSON.parse(patientsStr);
            const newPatients = patients.filter((p: Patient) => p.id !== id);
            localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(newPatients));
        }
        
        // Remove obs
        const obsStr = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
        if (obsStr) {
            const obs = JSON.parse(obsStr);
            const newObs = obs.filter((o: Observation) => o.patientId !== id);
            localStorage.setItem(STORAGE_KEY_OBSERVATIONS, JSON.stringify(newObs));
        }

        // Remove ctgs
        const ctgStr = localStorage.getItem(STORAGE_KEY_CTGS);
        if (ctgStr) {
            const ctgs = JSON.parse(ctgStr);
            const newCtgs = ctgs.filter((c: CTG) => c.patientId !== id);
            localStorage.setItem(STORAGE_KEY_CTGS, JSON.stringify(newCtgs));
        }

        return;
    }

    // Supabase: Delete observations and ctgs first (if not cascading)
    await supabase.from('observations').delete().eq('patient_id', id);
    await supabase.from('ctgs').delete().eq('patient_id', id);

    const { error: patError } = await supabase.from('patients').delete().eq('id', id);
    if (patError) throw patError;
  },

  async getObservations(patientId: string): Promise<Observation[]> {
    if (!supabase) {
        const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
        const allObs: Observation[] = data ? JSON.parse(data) : [];
        return allObs
          .filter(o => o.patientId === patientId)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    const { data, error } = await supabase.from('observations').select('*').eq('patient_id', patientId).order('timestamp', { ascending: false });
    if (error) return [];
    return data.map(mapObservationFromDB);
  },

  async getObservationById(id: string): Promise<Observation | undefined> {
      if (!supabase) {
          const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
          const allObs: Observation[] = data ? JSON.parse(data) : [];
          return allObs.find(o => o.id === id);
      }
      const { data, error } = await supabase.from('observations').select('*').eq('id', id).single();
      if (error || !data) return undefined;
      return mapObservationFromDB(data);
  },

  async deleteObservation(id: string): Promise<void> {
    // 1. Get the observation first to know the patient_id
    const obsToDelete = await this.getObservationById(id);
    if (!obsToDelete) return;

    const patientId = obsToDelete.patientId;

    if (!supabase) {
        // Local Storage
        const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
        const allObs: Observation[] = data ? JSON.parse(data) : [];
        const newObs = allObs.filter(o => o.id !== id);
        localStorage.setItem(STORAGE_KEY_OBSERVATIONS, JSON.stringify(newObs));
        
        // Update Patient's lastObservation in LS
        const patientObs = newObs
            .filter(o => o.patientId === patientId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        const newLastObs = patientObs.length > 0 ? patientObs[0] : undefined;
        
        const pData = localStorage.getItem(STORAGE_KEY_PATIENTS);
        const patients: Patient[] = pData ? JSON.parse(pData) : [];
        const pIndex = patients.findIndex(p => p.id === patientId);
        
        if (pIndex >= 0) {
            patients[pIndex].lastObservation = newLastObs;
            localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
        }
        return;
    }

    // Supabase
    await supabase.from('observations').delete().eq('id', id);

    // Update patient's last_observation. 
    const { data: newLatestData } = await supabase
        .from('observations')
        .select('*')
        .eq('patient_id', patientId)
        .order('timestamp', { ascending: false })
        .limit(1);

    let newLastObs = null;
    if (newLatestData && newLatestData.length > 0) {
        newLastObs = mapObservationFromDB(newLatestData[0]);
    }

    const lastObsPayload = newLastObs ? mapObservationToDB(newLastObs) : null;
    await supabase.from('patients').update({ last_observation: lastObsPayload }).eq('id', patientId);
  },

  async updateObservation(id: string, updates: Partial<Observation>): Promise<Observation | null> {
      if (!supabase) {
          const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
          const allObs: Observation[] = data ? JSON.parse(data) : [];
          const index = allObs.findIndex(o => o.id === id);
          if (index === -1) return null;
          const updatedObs = { ...allObs[index], ...updates };
          allObs[index] = updatedObs;
          localStorage.setItem(STORAGE_KEY_OBSERVATIONS, JSON.stringify(allObs));
          return updatedObs;
      }
      const dbPayload = mapObservationToDB(updates);
      const { data, error } = await supabase.from('observations').update(dbPayload).eq('id', id).select().single();
      if (error) return null;
      return mapObservationFromDB(data);
  },

  async addObservation(obsData: Omit<Observation, 'id' | 'timestamp'> & { timestamp?: string }, scheduledTaskId?: string): Promise<Observation> {
    if (!supabase) {
        const data = localStorage.getItem(STORAGE_KEY_OBSERVATIONS);
        const allObs: Observation[] = data ? JSON.parse(data) : [];
        const timestamp = obsData.timestamp || new Date().toISOString();
        const newObs: Observation = { ...obsData, id: generateUUID(), timestamp };
        allObs.push(newObs);
        localStorage.setItem(STORAGE_KEY_OBSERVATIONS, JSON.stringify(allObs));
        
        const patients = await this.getPatients();
        const patientIndex = patients.findIndex(p => p.id === obsData.patientId);
        if (patientIndex >= 0) {
            patients[patientIndex].lastObservation = newObs;
            if (scheduledTaskId) {
                patients[patientIndex].schedule = patients[patientIndex].schedule.map(t => 
                    t.id === scheduledTaskId ? { ...t, status: 'completed' } : t
                );
            }
            const { observations, ctgs, ...rest } = patients[patientIndex];
            patients[patientIndex] = rest as Patient; 
            localStorage.setItem(STORAGE_KEY_PATIENTS, JSON.stringify(patients));
        }
        return newObs;
    }
    const timestamp = obsData.timestamp || new Date().toISOString();
    const dbPayload = mapObservationToDB({ ...obsData, timestamp });
    
    const { data, error } = await supabase.from('observations').insert(dbPayload).select().single();
    if (error) throw error;
    const newObs = mapObservationFromDB(data);
    
    try {
        await this.updatePatient(newObs.patientId, { lastObservation: newObs });

        if (scheduledTaskId) {
            const patient = await this.getPatientById(newObs.patientId);
            if (patient) {
                const updatedSchedule = patient.schedule.map(task => 
                    task.id === scheduledTaskId ? { ...task, status: 'completed' as const } : task
                );
                await this.updatePatient(patient.id, { schedule: updatedSchedule });
            }
        }
    } catch (err) {
        console.warn("Observation saved, but patient update failed", err);
    }

    return newObs;
  },

  async addCTG(ctg: CTG): Promise<void> {
      if (!supabase) {
          const data = localStorage.getItem(STORAGE_KEY_CTGS);
          const allCtgs: CTG[] = data ? JSON.parse(data) : [];
          allCtgs.push(ctg);
          localStorage.setItem(STORAGE_KEY_CTGS, JSON.stringify(allCtgs));
          return;
      }

      const dbPayload = mapCTGToDB(ctg);
      const { error } = await supabase.from('ctgs').insert(dbPayload);
      if (error) throw error;
  },

  async getCTGById(id: string): Promise<CTG | undefined> {
    if (!supabase) {
        const data = localStorage.getItem(STORAGE_KEY_CTGS);
        const allCtgs: CTG[] = data ? JSON.parse(data) : [];
        return allCtgs.find(c => c.id === id);
    }
    const { data, error } = await supabase.from('ctgs').select('*').eq('id', id).single();
    if (error || !data) return undefined;
    return mapCTGFromDB(data);
  },

  async updateCTG(id: string, updates: Partial<CTG>): Promise<void> {
      if (!supabase) {
          const data = localStorage.getItem(STORAGE_KEY_CTGS);
          const allCtgs: CTG[] = data ? JSON.parse(data) : [];
          const index = allCtgs.findIndex(c => c.id === id);
          if (index !== -1) {
              allCtgs[index] = { ...allCtgs[index], ...updates };
              localStorage.setItem(STORAGE_KEY_CTGS, JSON.stringify(allCtgs));
          }
          return;
      }
      
      const dbPayload = mapCTGToDB(updates);
      const { error } = await supabase.from('ctgs').update(dbPayload).eq('id', id);
      if (error) throw error;
  },

  async deleteCTG(id: string): Promise<void> {
    if (!supabase) {
        const data = localStorage.getItem(STORAGE_KEY_CTGS);
        const allCtgs: CTG[] = data ? JSON.parse(data) : [];
        const newCtgs = allCtgs.filter(c => c.id !== id);
        localStorage.setItem(STORAGE_KEY_CTGS, JSON.stringify(newCtgs));
        return;
    }

    const { error } = await supabase.from('ctgs').delete().eq('id', id);
    if (error) throw error;
  }
};
