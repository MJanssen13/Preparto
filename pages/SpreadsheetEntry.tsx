
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { Patient, MembraneStatus } from '../types';
import { ArrowLeft, Loader2, SaveAll, Download, Upload, FileSpreadsheet, CheckCircle2, X } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- CONFIGURAÇÃO DAS COLUNAS (Mapeamento Excel <-> Objeto) ---
// Ordem estrita solicitada: Hora, BCF, PAS, PAD, PAS pé, PAD pé, FC, TAX, SAT, DXT
// Mantemos 'Data' como primeira coluna para referência temporal correta.
const COLUMN_MAP = [
  { key: 'date', label: 'Data (DD/MM/AAAA)', example: new Date().toLocaleDateString('pt-BR') },
  { key: 'time', label: 'Hora', example: '14:30' },
  { key: 'bcf', label: 'BCF', example: '140' },
  { key: 'paSys', label: 'PAS sentado', example: '120' },
  { key: 'paDia', label: 'PAD sentado', example: '80' },
  { key: 'paSysStanding', label: 'PAS em pé', example: '110' },
  { key: 'paDiaStanding', label: 'PAD em pé', example: '70' },
  { key: 'fc', label: 'FC', example: '85' },
  { key: 'tax', label: 'TAX', example: '36.5' },
  { key: 'spo2', label: 'SAT', example: '98' },
  { key: 'dxt', label: 'DXT', example: '90' }
] as const;

interface RowData {
  tempId: string;
  isDirty: boolean; // Always true for imported rows
  [key: string]: any;
}

const SpreadsheetEntry: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<RowData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (patientId: string) => {
    setLoading(true);
    const p = await patientService.getPatientById(patientId);
    if (p) setPatient(p);
    setLoading(false);
  };

  // --- 1. GERAR MODELO (TEMPLATE XLSX) ---
  const downloadTemplate = () => {
      // Cria um objeto com os exemplos usando os Labels como chave
      const exampleRow: any = {};
      COLUMN_MAP.forEach(col => {
          // Deixa PAS/PAD em pé vazios no exemplo para indicar que são opcionais, 
          // ou preenche para mostrar formato. Vamos deixar preenchido para clareza.
          exampleRow[col.label] = col.example;
      });

      // Cria a planilha
      const ws = XLSX.utils.json_to_sheet([exampleRow]);
      
      // Ajusta largura das colunas
      const wscols = COLUMN_MAP.map(c => ({ wch: c.label.length + 5 }));
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Modelo Evolução");
      
      // Salva arquivo
      XLSX.writeFile(wb, "modelo_sinais_vitais.xlsx");
  };

  // --- 2. IMPORTAR ARQUIVO (XLSX) ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'array' });
          
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Converte para JSON usando a primeira linha como cabeçalho
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
              raw: false, // Força conversão para string formatada
              dateNF: 'dd/mm/yyyy' // Formato preferido para datas
          });
          
          parseExcelData(jsonData);
      } catch (error) {
          console.error(error);
          alert("Erro ao ler o arquivo Excel. Verifique se é um .xlsx válido.");
      }
      
      // Reset input
      e.target.value = '';
  };

  const parseExcelData = (data: any[]) => {
      const newRows: RowData[] = data.map((row: any, idx) => {
          const newRow: RowData = {
              tempId: `import-${idx}`,
              isDirty: true
          };

          COLUMN_MAP.forEach((col) => {
              // Busca valor usando o Label da coluna (que é o header no Excel)
              let val = row[col.label];
              
              // Sanitização básica
              val = val !== undefined && val !== null ? String(val).trim() : '';
              
              // Remove aspas extras se houver
              val = val.replace(/^"|"$/g, '');
              
              newRow[col.key] = val;
          });

          // Fallback: Se data/hora vazio, preenche com agora
          if (!newRow.date) newRow.date = new Date().toLocaleDateString('pt-BR');
          if (!newRow.time) newRow.time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

          return newRow;
      });

      setRows(newRows);
      alert(`${newRows.length} linhas importadas com sucesso! Verifique os dados abaixo antes de salvar.`);
  };

  // --- 3. SALVAR ---
  const saveAll = async () => {
      if (!id || !patient) return;
      
      if (rows.length === 0) {
          alert("Nenhum dado para salvar. Importe uma planilha primeiro.");
          return;
      }

      setSaving(true);

      try {
          for (const row of rows) {
              // Construct Timestamp
              let timestampStr = '';
              
              if (row.date && row.time) {
                  // Lidar com formato DD/MM/AAAA ou AAAA-MM-DD
                  let datePart = row.date;
                  
                  // Se vier com barras (comum no Brasil: 25/10/2023)
                  if (datePart.includes('/')) {
                      const parts = datePart.split('/');
                      // Se for DD/MM/AAAA
                      if (parts.length === 3) {
                         // Converte para AAAA-MM-DD para o construtor Date
                         datePart = `${parts[2]}-${parts[1]}-${parts[0]}`;
                      }
                  }
                  
                  timestampStr = `${datePart}T${row.time}:00`;
              } else {
                  timestampStr = new Date().toISOString();
              }
              
              // Helper: Converte string para número. Se vazio, retorna undefined.
              // Isso garante que se 'PAS em pé' estiver vazio no Excel, ele não salva no banco.
              const n = (val: string) => (!val || val === '' || isNaN(Number(val))) ? undefined : Number(val);
              
              // Verifica se a data é válida antes de enviar
              const dateObj = new Date(timestampStr);
              if (isNaN(dateObj.getTime())) {
                  console.warn("Data inválida ignorada:", timestampStr);
                  continue; // Pula linha inválida
              }

              const payload = {
                  patientId: id,
                  timestamp: dateObj.toISOString(),
                  examinerName: 'Importação Excel',
                  vitals: {
                      paSystolic: n(row.paSys),
                      paDiastolic: n(row.paDia),
                      // Se estiver vazio no Excel, 'n' retorna undefined e o campo não é persistido
                      paStandingSystolic: n(row.paSysStanding),
                      paStandingDiastolic: n(row.paDiaStanding),
                      fc: n(row.fc),
                      tax: n(row.tax),
                      spo2: n(row.spo2),
                      dxt: n(row.dxt),
                      paPosition: 'sitting' as const
                  },
                  obstetric: {
                      bcf: n(row.bcf)
                  }, 
                  medication: {},
                  notes: 'Importado via Planilha'
              };

              await patientService.addObservation(payload);
          }
          
          alert("Todos os dados foram salvos com sucesso!");
          navigate(`/patient/${id}`);
      } catch (error) {
          console.error(error);
          alert("Erro ao salvar dados. Verifique o formato da Data (DD/MM/AAAA) no arquivo.");
      } finally {
          setSaving(false);
      }
  };

  const removeRow = (index: number) => {
      setRows(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] bg-slate-50">
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="font-bold text-slate-900 text-lg leading-tight flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        Importação Excel
                    </h1>
                    <p className="text-sm text-slate-500">{patient?.name}</p>
                </div>
            </div>
            
            <div className="flex gap-3">
                <button 
                    onClick={saveAll}
                    disabled={saving || rows.length === 0}
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-2 font-bold shadow-md disabled:opacity-50 disabled:shadow-none transition-all"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <SaveAll className="w-4 h-4" />}
                    <span>Confirmar e Salvar</span>
                </button>
            </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
            
            {/* Actions Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Step 1: Download */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600 mb-1">
                        <Download className="w-6 h-6" />
                    </div>
                    <h2 className="font-bold text-slate-800">1. Baixar Modelo</h2>
                    <p className="text-sm text-slate-500">Baixe a planilha modelo (.xlsx) para preencher os dados corretamente.</p>
                    <button 
                        onClick={downloadTemplate}
                        className="mt-auto px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-sm w-full transition-colors"
                    >
                        Baixar Planilha Modelo (.xlsx)
                    </button>
                </div>

                {/* Step 2: Upload */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-start gap-3">
                    <div className="bg-green-50 p-2 rounded-lg text-green-600 mb-1">
                        <Upload className="w-6 h-6" />
                    </div>
                    <h2 className="font-bold text-slate-800">2. Importar Arquivo</h2>
                    <p className="text-sm text-slate-500">Selecione o arquivo .xlsx preenchido para carregar os dados.</p>
                    <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        ref={fileInputRef}
                        className="hidden" 
                        onChange={handleFileUpload} 
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-sm w-full transition-colors flex justify-center items-center gap-2"
                    >
                        <Upload className="w-4 h-4" /> Selecionar Arquivo Excel
                    </button>
                </div>
            </div>

            {/* Preview Area */}
            {rows.length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            Pré-visualização ({rows.length} registros)
                        </h3>
                        <button onClick={() => setRows([])} className="text-xs text-red-500 hover:underline">Limpar tudo</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-500 font-bold uppercase">
                                <tr>
                                    <th className="p-3 w-10">#</th>
                                    {COLUMN_MAP.map(col => (
                                        <th key={col.key} className="p-3 min-w-[100px] whitespace-nowrap">{col.label}</th>
                                    ))}
                                    <th className="p-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {rows.map((row, idx) => (
                                    <tr key={row.tempId} className="hover:bg-slate-50">
                                        <td className="p-3 text-slate-400">{idx + 1}</td>
                                        {COLUMN_MAP.map(col => (
                                            <td key={col.key} className="p-3 whitespace-nowrap">
                                                {row[col.key]}
                                            </td>
                                        ))}
                                        <td className="p-3 text-right">
                                            <button onClick={() => removeRow(idx)} className="text-slate-400 hover:text-red-500">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-400 flex flex-col items-center">
                    <FileSpreadsheet className="w-12 h-12 mb-3 opacity-20" />
                    <p className="font-medium">Nenhum dado carregado.</p>
                    <p className="text-xs mt-1">Siga os passos acima para importar evoluções em lote via Excel.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default SpreadsheetEntry;
