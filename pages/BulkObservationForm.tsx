import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { Patient, Observation, MembraneStatus } from '../types';
import { ArrowLeft, Save, Plus, Trash2, Calendar, Clock } from 'lucide-react';

interface BulkRow {
  id: string;
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
  dilation: string;
  cervixStatus: string;
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
}

const COLUMNS = [
  { key: 'date', label: 'Data', type: 'date', width: 'w-32' },
  { key: 'time', label: 'Hora', type: 'time', width: 'w-24' },
  { key: 'bcf', label: 'BCF', type: 'number', width: 'w-20' },
  { key: 'pas', label: 'PA Sist', type: 'number', width: 'w-20' },
  { key: 'pad', label: 'PA Diast', type: 'number', width: 'w-20' },
  { key: 'pasStanding', label: 'PA Pé Sist', type: 'number', width: 'w-24' },
  { key: 'padStanding', label: 'PA Pé Diast', type: 'number', width: 'w-24' },
  { key: 'fc', label: 'FC', type: 'number', width: 'w-20' },
  { key: 'tax', label: 'TAX', type: 'number', width: 'w-20', step: '0.1' },
  { key: 'spo2', label: 'Sat O2', type: 'number', width: 'w-20' },
  { key: 'dxt', label: 'DXT', type: 'number', width: 'w-20' },
  { key: 'du', label: 'DU', type: 'text', width: 'w-24', placeholder: 'Ex: 2x30' },
  { key: 'dilation', label: 'Dilat.', type: 'number', width: 'w-20' },
  { key: 'cervixStatus', label: 'Colo', type: 'select', width: 'w-24', options: ['OEI', 'OEEA', 'OII'] },
  { key: 'effacement', label: 'Apag.', type: 'number', width: 'w-20' },
  { key: 'station', label: 'De Lee', type: 'select', width: 'w-24', options: ['-4', '-3', '-2', '-1', '0', '1', '2', '3', '4'] },
  { key: 'cervixPosition', label: 'Pos. Colo', type: 'select', width: 'w-28', options: ['Posterior', 'Intermediário', 'Central'] },
  { key: 'cervixConsistency', label: 'Consist.', type: 'select', width: 'w-28', options: ['Nasal', 'Nasolabial', 'Labial'] },
  { key: 'membranes', label: 'Bolsa', type: 'select', width: 'w-32', options: [MembraneStatus.INTACT, MembraneStatus.RUPTURED_CLEAR, MembraneStatus.RUPTURED_MECONIUM] },
  { key: 'fetalPosition', label: 'Apres.', type: 'select', width: 'w-28', options: ['Cefálico', 'Pélvico', 'Córmico'] },
  { key: 'bloodOnGlove', label: 'SDL', type: 'select', width: 'w-24', options: [{value: 'true', label: 'Sim'}, {value: 'false', label: 'Não'}] },
  { key: 'oxy', label: 'Ocitocina', type: 'number', width: 'w-24' },
  { key: 'miso', label: 'Miso Dose', type: 'select', width: 'w-24', options: ['25', '50', '100', '200'] },
  { key: 'misoCount', label: 'Miso Nº', type: 'number', width: 'w-20' },
  { key: 'magReflex', label: 'Reflexo', type: 'select', width: 'w-28', options: ['Ausente', 'Diminuído', 'Presente', 'Exaltado'] },
  { key: 'magDiuresis', label: 'Diurese', type: 'text', width: 'w-24' },
  { key: 'magRespiratoryRate', label: 'FR', type: 'number', width: 'w-20' },
  { key: 'notes', label: 'Notas', type: 'text', width: 'w-48' },
];

const BulkObservationForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<BulkRow[]>([]);
  const [hoursToAdd, setHoursToAdd] = useState<number>(1);
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
      // Start empty as requested
    }
    setLoading(false);
  };

  const createEmptyRow = (dateStr: string, timeStr: string): BulkRow => ({
    id: crypto.randomUUID(),
    date: dateStr, time: timeStr,
    bcf: '', du: '', pas: '', pad: '', pasStanding: '', padStanding: '', fc: '', tax: '', spo2: '', dxt: '',
    dilation: '', cervixStatus: '', effacement: '', station: '', cervixPosition: '', cervixConsistency: '',
    membranes: '', fetalPosition: '', bloodOnGlove: '',
    oxy: '', miso: '', misoCount: '',
    magReflex: '', magDiuresis: '', magRespiratoryRate: '',
    notes: ''
  });

  const addSingleRow = () => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const hourStr = String(now.getHours()).padStart(2, '0');
    const minStr = String(now.getMinutes()).padStart(2, '0');
    setRows(prev => [...prev, createEmptyRow(dateStr, `${hourStr}:${minStr}`)]);
  };

  const addRowsByHours = (hours: number) => {
    const newRows: BulkRow[] = [];
    const now = new Date();
    
    // Start from 'hours' ago, rounded down to the nearest hour
    const startTime = new Date(now);
    startTime.setHours(startTime.getHours() - hours);
    startTime.setMinutes(0, 0, 0);

    for (let i = 0; i < hours; i++) {
      const currentTime = new Date(startTime.getTime() + (i * 60 * 60 * 1000));
      
      const dateStr = currentTime.toISOString().split('T')[0];
      const hourStr = String(currentTime.getHours()).padStart(2, '0');
      
      // Add row for XX:00
      newRows.push(createEmptyRow(dateStr, `${hourStr}:00`));
      // Add row for XX:30
      newRows.push(createEmptyRow(dateStr, `${hourStr}:30`));
    }

    setRows(prev => [...prev, ...newRows]);
  };

  const removeRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  };

  const updateRow = (rowId: string, field: keyof BulkRow, value: string) => {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r));
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
        if (e.currentTarget.tagName === 'SELECT' || (e.currentTarget as HTMLInputElement).selectionStart === 0 || e.currentTarget.type === 'number') {
          nextCol = Math.max(0, colIndex - 1);
        } else {
          return;
        }
      }
      if (e.key === 'ArrowRight') {
        const input = e.currentTarget as HTMLInputElement;
        if (e.currentTarget.tagName === 'SELECT' || input.selectionEnd === input.value.length || e.currentTarget.type === 'number') {
          nextCol = Math.min(COLUMNS.length - 1, colIndex + 1);
        } else {
          return;
        }
      }

      const nextId = `cell-${nextRow}-${nextCol}`;
      const nextElement = document.getElementById(nextId);
      if (nextElement) {
        nextElement.focus();
        if (nextElement.tagName === 'INPUT') {
          (nextElement as HTMLInputElement).select();
        }
      }
    }
  };

  const hasAnyData = (row: BulkRow) => {
    const dataFields = ['bcf', 'du', 'pas', 'pad', 'pasStanding', 'padStanding', 'fc', 'tax', 'spo2', 'dxt',
      'dilation', 'cervixStatus', 'effacement', 'station', 'cervixPosition', 'cervixConsistency',
      'membranes', 'fetalPosition', 'bloodOnGlove', 'oxy', 'miso', 'misoCount',
      'magReflex', 'magDiuresis', 'magRespiratoryRate', 'notes'];
    
    return dataFields.some(field => (row as any)[field] !== '');
  };

  const handleSave = async () => {
    if (!patient || !id) return;
    
    // Filter out rows that have no data entered
    const rowsWithData = rows.filter(hasAnyData);
    
    const validRows = rowsWithData.filter(r => r.date && r.time);
    
    if (validRows.length === 0) {
      alert('Nenhuma aferição preenchida para salvar.');
      return;
    }

    setSaving(true);
    try {
      const numOrUndef = (val: string) => val === '' ? undefined : Number(val);

      for (const row of validRows) {
        // Combine date and time into ISO string
        const timestamp = new Date(`${row.date}T${row.time}`).toISOString();

        const obsData: Omit<Observation, 'id'> = {
          patientId: id,
          timestamp: timestamp,
          examinerName: 'Dr. Demo', // Default name
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
            dilation: numOrUndef(row.dilation),
            cervixStatus: row.cervixStatus ? [row.cervixStatus] : undefined,
            effacement: numOrUndef(row.effacement),
            station: numOrUndef(row.station),
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

        await patientService.addObservation(obsData);
      }
      
      navigate(`/patient/${id}`);
    } catch (error) {
      console.error('Erro ao salvar lote:', error);
      alert('Ocorreu um erro ao salvar as aferições.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Carregando paciente...</div>;
  if (!patient) return <div className="p-8 text-center text-red-500">Paciente não encontrado</div>;

  return (
    <div className="space-y-6 pb-20 max-w-full mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/patient/${id}`} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Adicionar Lote</h1>
            <p className="text-sm text-slate-500">Paciente: {patient.name}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || rows.length === 0}
          className="bg-medical-600 hover:bg-medical-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Lote'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="text-sm text-slate-600">
            Use as setas do teclado para navegar entre as células. Linhas deixadas em branco serão ignoradas.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={addSingleRow}
              className="text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded flex items-center gap-1 font-bold shadow-sm whitespace-nowrap"
            >
              <Plus className="w-3 h-3" /> Linha Avulsa
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <div className="flex items-center bg-white border border-slate-200 rounded overflow-hidden shadow-sm">
              <input 
                type="number" 
                min="1" 
                max="24"
                value={hoursToAdd}
                onChange={(e) => setHoursToAdd(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 p-1.5 text-sm text-center outline-none"
              />
              <span className="text-xs text-slate-500 px-2 bg-slate-50 border-l border-slate-200 h-full flex items-center">horas</span>
            </div>
            <button 
              onClick={() => addRowsByHours(hoursToAdd)}
              className="text-xs bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded flex items-center gap-1 font-bold shadow-sm whitespace-nowrap"
            >
              <Plus className="w-3 h-3" /> Adicionar Linhas
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" ref={tableRef}>
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200 whitespace-nowrap">
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key} className={`p-2 ${col.width}`}>{col.label}</th>
                ))}
                <th className="p-2 w-12 text-center sticky right-0 bg-slate-50 shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, rowIndex) => (
                <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                  {COLUMNS.map((col, colIndex) => (
                    <td key={col.key} className="p-1">
                      {col.type === 'select' ? (
                        <select
                          id={`cell-${rowIndex}-${colIndex}`}
                          value={(row as any)[col.key]}
                          onChange={(e) => updateRow(row.id, col.key as keyof BulkRow, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
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
                          type={col.type} 
                          step={col.step}
                          placeholder={col.placeholder}
                          value={(row as any)[col.key]}
                          onChange={(e) => updateRow(row.id, col.key as keyof BulkRow, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          autoComplete="off"
                          className={`w-full p-1.5 border border-slate-200 rounded text-xs bg-white focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none ${col.width}`}
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-1 text-center sticky right-0 bg-white shadow-[-4px_0_6px_-1px_rgba(0,0,0,0.05)]">
                    <button 
                      onClick={() => removeRow(row.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remover linha"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="p-8 text-center text-slate-500">
                    Nenhuma linha adicionada. Escolha a quantidade de horas ou adicione uma linha avulsa.
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

export default BulkObservationForm;
