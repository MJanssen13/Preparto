import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { Patient, Observation, MembraneStatus } from '../types';
import { ArrowLeft, Save, Trash2, AlertCircle } from 'lucide-react';

interface BulkRow {
  id: string;
  originalId?: string; // To track if it's an existing observation
  date: string;
  time: string;
  bcf: string;
  du: string;
  pas: string;
  pad: string;
  pasStanding: string;
  padStanding: string;
  fc: string;
  tax: string;
  spo2: string;
  dxt: string;
  dilationCombined: string;
  effacement: string;
  station: string;
  cervixPosition: string;
  cervixConsistency: string;
  membranes: string;
  fetalPosition: string;
  bloodOnGlove: string;
  oxy: string;
  miso: string;
  misoCount: string;
  magReflex: string;
  magDiuresis: string;
  magRespiratoryRate: string;
  notes: string;
  isDeleted?: boolean; // Track deletion
}

const DILATION_OPTIONS = ['OEI', 'OEEA', 'OII', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const EFFACEMENT_OPTIONS = ['Colo Grosso (0%)', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', '100%'];
const DE_LEE_OPTIONS = ['AM', '-3', '-2', '-1', '0', '+1', '+2', '+3', '+4'];

interface Column {
  key: string;
  label: string;
  type: string;
  width: string;
  sticky?: string;
  z?: string;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url';
  placeholder?: string;
  options?: (string | { value: string; label: string })[];
  step?: string;
}

const COLUMNS: Column[] = [
  { key: 'date', label: 'Data', type: 'date', width: 'min-w-[120px]', sticky: 'left-0', z: 'z-20' },
  { key: 'time', label: 'Hora', type: 'time', width: 'min-w-[100px]', sticky: 'left-[120px]', z: 'z-20' },
  { key: 'bcf', label: 'BCF', type: 'text', inputMode: 'numeric', width: 'min-w-[60px]' },
  { key: 'pas', label: 'PA Sist', type: 'text', inputMode: 'numeric', width: 'min-w-[60px]' },
  { key: 'pad', label: 'PA Diast', type: 'text', inputMode: 'numeric', width: 'min-w-[60px]' },
  { key: 'pasStanding', label: 'PA Pé Sist', type: 'text', inputMode: 'numeric', width: 'min-w-[80px]' },
  { key: 'padStanding', label: 'PA Pé Diast', type: 'text', inputMode: 'numeric', width: 'min-w-[80px]' },
  { key: 'du', label: 'DU', type: 'text', width: 'min-w-[80px]', placeholder: 'Ex: 2x30' },
  { key: 'effacement', label: 'Apag.', type: 'select', width: 'min-w-[100px]', options: EFFACEMENT_OPTIONS },
  { key: 'cervixPosition', label: 'Pos. Colo', type: 'select', width: 'min-w-[100px]', options: ['Posterior', 'Intermediário', 'Central'] },
  { key: 'cervixConsistency', label: 'Consist.', type: 'select', width: 'min-w-[100px]', options: ['Nasal', 'Nasolabial', 'Labial'] },
  { key: 'dilationCombined', label: 'Dilat/Colo', type: 'select', width: 'min-w-[100px]', options: DILATION_OPTIONS },
  { key: 'fetalPosition', label: 'Apres.', type: 'select', width: 'min-w-[100px]', options: ['Cefálico', 'Pélvico', 'Córmico'] },
  { key: 'station', label: 'De Lee', type: 'select', width: 'min-w-[80px]', options: DE_LEE_OPTIONS },
  { key: 'membranes', label: 'Bolsa', type: 'select', width: 'min-w-[120px]', options: [MembraneStatus.INTACT, MembraneStatus.RUPTURED_CLEAR, MembraneStatus.RUPTURED_MECONIUM] },
  { key: 'bloodOnGlove', label: 'SDL', type: 'select', width: 'min-w-[80px]', options: [{value: 'true', label: 'Sim'}, {value: 'false', label: 'Não'}] },
  { key: 'miso', label: 'Miso Dose', type: 'select', width: 'min-w-[80px]', options: ['25', '50', '100', '200'] },
  { key: 'misoCount', label: 'Miso Nº', type: 'text', inputMode: 'numeric', width: 'min-w-[60px]' },
  { key: 'oxy', label: 'Ocitocina', type: 'text', inputMode: 'numeric', width: 'min-w-[80px]' },
  { key: 'dxt', label: 'DXT', type: 'text', inputMode: 'numeric', width: 'min-w-[60px]' },
  { key: 'fc', label: 'FC', type: 'text', inputMode: 'numeric', width: 'min-w-[60px]' },
  { key: 'tax', label: 'TAX', type: 'text', inputMode: 'decimal', width: 'min-w-[60px]' },
  { key: 'spo2', label: 'Sat O2', type: 'text', inputMode: 'numeric', width: 'min-w-[60px]' },
  { key: 'magReflex', label: 'Reflexo', type: 'select', width: 'min-w-[100px]', options: ['Ausente', 'Diminuído', 'Presente', 'Exaltado'] },
  { key: 'magDiuresis', label: 'Diurese', type: 'text', width: 'min-w-[80px]' },
  { key: 'magRespiratoryRate', label: 'FR', type: 'text', inputMode: 'numeric', width: 'min-w-[60px]' },
  { key: 'notes', label: 'Notas', type: 'text', width: 'min-w-[200px]' },
];

const BulkEditObservationForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (id) {
      loadPatient(id);
    }
  }, [id]);

  const loadPatient = async (patientId: string) => {
    setLoading(true);
    const p = await patientService.getPatientById(patientId);
    if (p) {
      setPatient(p);
      if (p.observations) {
        const mappedRows = p.observations.map(obs => mapObservationToRow(obs));
        setRows(mappedRows);
      }
    }
    setLoading(false);
  };

  const mapObservationToRow = (obs: Observation): BulkRow => {
    const d = new Date(obs.timestamp);
    const dateStr = d.toISOString().split('T')[0];
    const timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    let dilationCombined = '';
    if (obs.obstetric.dilation !== undefined) dilationCombined = String(obs.obstetric.dilation);
    else if (obs.obstetric.cervixStatus && obs.obstetric.cervixStatus.length > 0) dilationCombined = obs.obstetric.cervixStatus[0];

    let effacement = '';
    if (obs.obstetric.effacement !== undefined) {
        effacement = obs.obstetric.effacement === 0 ? 'Colo Grosso (0%)' : `${obs.obstetric.effacement}%`;
    }

    let station = '';
    if (obs.obstetric.station !== undefined) {
        station = obs.obstetric.station === -4 ? 'AM' : String(obs.obstetric.station);
    }

    return {
      id: obs.id,
      originalId: obs.id,
      date: dateStr,
      time: timeStr,
      bcf: obs.obstetric.bcf !== undefined ? String(obs.obstetric.bcf) : '',
      du: obs.obstetric.dinamicaSummary || (obs.obstetric.dinamicaFrequency ? String(obs.obstetric.dinamicaFrequency) : ''),
      pas: obs.vitals.paSystolic !== undefined ? String(obs.vitals.paSystolic) : '',
      pad: obs.vitals.paDiastolic !== undefined ? String(obs.vitals.paDiastolic) : '',
      pasStanding: obs.vitals.paStandingSystolic !== undefined ? String(obs.vitals.paStandingSystolic) : '',
      padStanding: obs.vitals.paStandingDiastolic !== undefined ? String(obs.vitals.paStandingDiastolic) : '',
      fc: obs.vitals.fc !== undefined ? String(obs.vitals.fc) : '',
      tax: obs.vitals.tax !== undefined ? String(obs.vitals.tax) : '',
      spo2: obs.vitals.spo2 !== undefined ? String(obs.vitals.spo2) : '',
      dxt: obs.vitals.dxt !== undefined ? String(obs.vitals.dxt) : '',
      dilationCombined,
      effacement,
      station,
      cervixPosition: obs.obstetric.cervixPosition || '',
      cervixConsistency: obs.obstetric.cervixConsistency || '',
      membranes: obs.obstetric.membranes || '',
      fetalPosition: obs.obstetric.fetalPosition || '',
      bloodOnGlove: obs.obstetric.bloodOnGlove === true ? 'true' : obs.obstetric.bloodOnGlove === false ? 'false' : '',
      oxy: obs.medication?.oxytocinDose !== undefined ? String(obs.medication.oxytocinDose) : '',
      miso: obs.medication?.misoprostolDose !== undefined ? String(obs.medication.misoprostolDose) : '',
      misoCount: obs.medication?.misoprostolCount !== undefined ? String(obs.medication.misoprostolCount) : '',
      magReflex: obs.magnesiumData?.reflex || '',
      magDiuresis: obs.magnesiumData?.diuresis || '',
      magRespiratoryRate: obs.magnesiumData?.respiratoryRate !== undefined ? String(obs.magnesiumData.respiratoryRate) : '',
      notes: obs.notes || ''
    };
  };

  const updateRow = (rowId: string, field: keyof BulkRow, value: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
  };

  const markForDeletion = (rowId: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, isDeleted: !r.isDeleted } : r));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>, rowIndex: number, colIndex: number) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
        }
        
        let nextRow = rowIndex;
        let nextCol = colIndex;
  
        if (e.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
        if (e.key === 'ArrowDown' || e.key === 'Enter') nextRow = Math.min(rows.length - 1, rowIndex + 1);
        
        if (e.key === 'ArrowLeft') {
          const input = e.currentTarget as HTMLInputElement;
          if (e.currentTarget.tagName === 'SELECT' || input.selectionStart === 0) {
             nextCol = Math.max(0, colIndex - 1);
             e.preventDefault();
          }
        }
        
        if (e.key === 'ArrowRight') {
          const input = e.currentTarget as HTMLInputElement;
          if (e.currentTarget.tagName === 'SELECT' || input.selectionEnd === input.value.length) {
             nextCol = Math.min(COLUMNS.length - 1, colIndex + 1);
             e.preventDefault();
          }
        }
  
        const nextId = `cell-${nextRow}-${nextCol}`;
        const nextElement = document.getElementById(nextId);
        if (nextElement) {
          nextElement.focus();
        }
      }
    };

  const handleSave = async () => {
    if (!patient || !id) return;
    setSaving(true);
    try {
      const numOrUndef = (val: string) => val === '' ? undefined : Number(val);

      for (const row of rows) {
        if (row.isDeleted && row.originalId) {
            await patientService.deleteObservation(row.originalId);
            continue;
        }

        if (row.isDeleted) continue; // Skip new rows that were deleted before save (if we supported adding)

        const timestamp = new Date(`${row.date}T${row.time}`).toISOString();

        // Parse Dilation Combined
        let dilation: number | undefined = undefined;
        let cervixStatus: string[] | undefined = undefined;
        
        if (row.dilationCombined) {
            if (['OEI', 'OEEA', 'OII'].includes(row.dilationCombined)) {
                cervixStatus = [row.dilationCombined];
            } else {
                dilation = Number(row.dilationCombined);
            }
        }

        // Parse Effacement
        let effacement: number | undefined = undefined;
        if (row.effacement) {
            if (row.effacement === 'Colo Grosso (0%)') {
                effacement = 0;
            } else {
                effacement = parseInt(row.effacement.replace('%', ''));
            }
        }

        // Parse Station (De Lee)
        let station: number | undefined = undefined;
        if (row.station) {
            if (row.station === 'AM') {
                station = -4;
            } else {
                station = Number(row.station);
            }
        }

        const obsData: Partial<Observation> = {
          patientId: id,
          timestamp: timestamp,
          examinerName: 'Dr. Demo',
          vitals: {
            paSystolic: numOrUndef(row.pas),
            paDiastolic: numOrUndef(row.pad),
            paStandingSystolic: numOrUndef(row.pasStanding),
            paStandingDiastolic: numOrUndef(row.padStanding),
            fc: numOrUndef(row.fc),
            tax: numOrUndef(row.tax),
            spo2: numOrUndef(row.spo2),
            dxt: numOrUndef(row.dxt),
            paPosition: 'sitting'
          },
          obstetric: {
            bcf: numOrUndef(row.bcf),
            dinamicaSummary: row.du || undefined,
            dilation: dilation,
            cervixStatus: cervixStatus,
            effacement: effacement,
            station: station,
            cervixPosition: row.cervixPosition as any || undefined,
            cervixConsistency: row.cervixConsistency as any || undefined,
            membranes: row.membranes as MembraneStatus || undefined,
            fetalPosition: row.fetalPosition as any || undefined,
            bloodOnGlove: row.bloodOnGlove === 'true' ? true : row.bloodOnGlove === 'false' ? false : undefined
          },
          medication: {
            oxytocinDose: numOrUndef(row.oxy),
            misoprostolDose: numOrUndef(row.miso),
            misoprostolCount: numOrUndef(row.misoCount)
          },
          magnesiumData: (row.magReflex || row.magDiuresis || row.magRespiratoryRate) ? {
            reflex: row.magReflex as any || undefined,
            diuresis: row.magDiuresis || '',
            respiratoryRate: numOrUndef(row.magRespiratoryRate)
          } : undefined,
          notes: row.notes || undefined
        };

        if (row.originalId) {
            await patientService.updateObservation(row.originalId, obsData);
        } else {
            // If we support adding new rows here later
            // await patientService.addObservation(obsData as any);
        }
      }
      
      navigate(`/patient/${id}`);
    } catch (error) {
      console.error('Erro ao salvar lote:', error);
      alert('Ocorreu um erro ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;
  if (!patient) return <div className="p-8 text-center text-red-500">Paciente não encontrado</div>;

  return (
    <div className="space-y-6 pb-20 max-w-full mx-auto px-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/patient/${id}`} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Edição em Lote</h1>
            <p className="text-sm text-slate-500">Paciente: {patient.name}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-medical-600 hover:bg-medical-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
            <p className="text-sm text-slate-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Edite os valores diretamente na tabela. Para excluir uma linha, clique no ícone de lixeira.
            </p>
        </div>

        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-left text-sm" ref={tableRef}>
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200 whitespace-nowrap sticky top-0 z-30 shadow-sm">
              <tr>
                {COLUMNS.map(col => (
                  <th 
                    key={col.key} 
                    className={`p-2 bg-slate-50 ${col.width} ${col.sticky ? `sticky ${col.sticky} ${col.z || 'z-10'} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]` : ''}`}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="p-2 w-12 text-center sticky right-0 bg-slate-50 z-20 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className={`hover:bg-slate-50/50 transition-colors ${row.isDeleted ? 'bg-red-50 opacity-50' : ''}`}>
                  {COLUMNS.map((col, colIndex) => (
                    <td 
                        key={col.key} 
                        className={`p-1 bg-white ${col.sticky ? `sticky ${col.sticky} ${col.z || 'z-10'} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]` : ''} ${row.isDeleted ? 'bg-red-50' : ''}`}
                    >
                      {col.type === 'select' ? (
                        <select
                          id={`cell-${rowIndex}-${colIndex}`}
                          value={(row as any)[col.key]}
                          onChange={(e) => updateRow(row.id, col.key as keyof BulkRow, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          disabled={row.isDeleted}
                          autoComplete="off"
                          className={`w-full p-1.5 border border-slate-200 rounded text-xs bg-white focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none ${col.width}`}
                        >
                          <option value=""></option>
                          {col.options?.map(opt => {
                            const val = typeof opt === 'string' ? opt : opt.value;
                            const label = typeof opt === 'string' ? opt : opt.label;
                            return <option key={val} value={val}>{label}</option>;
                          })}
                        </select>
                      ) : (
                        <input 
                          id={`cell-${rowIndex}-${colIndex}`}
                          type={col.type === 'number' ? 'text' : col.type} 
                          inputMode={col.inputMode as any}
                          step={col.step}
                          placeholder={col.placeholder}
                          value={(row as any)[col.key]}
                          onChange={(e) => updateRow(row.id, col.key as keyof BulkRow, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          disabled={row.isDeleted}
                          autoComplete="off"
                          className={`w-full p-1.5 border border-slate-200 rounded text-xs bg-white focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none ${col.width}`}
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-1 text-center sticky right-0 bg-white z-20 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                    <button 
                      onClick={() => markForDeletion(row.id)}
                      className={`p-1.5 rounded transition-colors ${row.isDeleted ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                      title={row.isDeleted ? "Restaurar" : "Excluir"}
                    >
                      {row.isDeleted ? <ArrowLeft className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="p-8 text-center text-slate-500">
                    Nenhuma evolução registrada para este paciente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BulkEditObservationForm;
