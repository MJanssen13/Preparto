
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientService } from '../services/supabaseService';
import { Patient, PartogramData, PartogramPoint, PartogramTableColumn, PartogramContractionBlock } from '../types';
import { ArrowLeft, Save, X, Square, Eraser, Trash2, Printer } from 'lucide-react';

// --- EXACT COORDINATES FROM NEW UFTM SVG (2481 x 3508) ---
const VIEWBOX_W = 2481;
const VIEWBOX_H = 3508;

// Transform Constants from SVG Main Group
const SCALE = 1.04175;
const TRANS_X = -50.052284;
const TRANS_Y = -610.189202;

// Coordinate Helpers
const toVisualX = (x: number) => x * SCALE + TRANS_X;
const toVisualY = (y: number) => y * SCALE + TRANS_Y;
const toInternalX = (visualX: number) => (visualX - TRANS_X) / SCALE;
const toInternalY = (visualY: number) => (visualY - TRANS_Y) / SCALE;

// Grid Geometry (High Precision from XML)
const GRID_X_START = 524.925;
const GRID_X_END = 1805.482;
const COL_WIDTH = 80.0348; // (1805.482 - 524.925) / 16
const NUM_COLS = 16; 

// Dilation Y (0-10cm)
const Y_DILATION_10 = 1211.165;
const Y_DILATION_0 = 1804.416;
const GRAPH_H = Y_DILATION_0 - Y_DILATION_10; 

// BCF Y (80-180bpm)
const Y_BCF_180 = 2036.406;
const Y_BCF_80 = 2625.733;
const BCF_H = Y_BCF_80 - Y_BCF_180; 

// Contractions Y (5 rows)
const Y_CONTRACTION_TOP = 2711.777; // Top line from SVG
const Y_CONTRACTION_BOTTOM = 2994.665; // Bottom line from SVG
const CONTRACTION_TOTAL_H = Y_CONTRACTION_BOTTOM - Y_CONTRACTION_TOP;
const CONTRACTION_ROW_H = CONTRACTION_TOTAL_H / 5;

// Time Rows
const Y_TIME_REAL_TOP = 1888.829;
const TIME_ROW_H = 59.055;
const Y_TIME_REG_TOP = 1947.884;

// Table Rows - Specific Y coordinates
const TABLE_ROWS_CONFIG = [
    { key: 'date', y: 1830, h: 58 },                // Data (Above Time) - Approx Y based on graph bottom
    { key: 'amnioticFluid', y: 2994.665, h: 61.5 }, // Bolsa
    { key: 'la', y: 3056.164, h: 61.5 },            // LA
    { key: 'oxytocin', y: 3117.664, h: 61.5 },      // Ocitocina
    { key: 'meds', y: 3179.163, h: 553.066, rotate: true, fontSize: 'text-[8px] sm:text-[9px]' },       // Medicamentos (Big block)
    { key: 'examiner', y: 3732.229, h: 160.037, rotate: true }    // Examinador
];

const PartogramPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // --- STATE ---
  const [points, setPoints] = useState<PartogramPoint[]>([]);
  const [contractionBlocks, setContractionBlocks] = useState<PartogramContractionBlock[]>([]);
  const [activePhaseIndex, setActivePhaseIndex] = useState<number | undefined>(undefined);
  const [tableData, setTableData] = useState<PartogramTableColumn[]>([]);
  const [observations, setObservations] = useState(''); // New state for observations
  
  // Header Data State
  const [headerData, setHeaderData] = useState({
      date: '',
      id: '',
      name: '',
      age: '',
      dum: '',
      dpp: '',
      ig: '',
      us: '',
      parity: '',
      bloodType: '',
      babyName: '',
      startDate: '' // New field for Data de Início
  });
  
  // --- UI CONTROLS ---
  const [inputMode, setInputMode] = useState<'dilation' | 'station' | 'fcf' | 'contraction' | 'eraser'>('dilation');
  const [contractionType, setContractionType] = useState<'weak' | 'moderate' | 'strong'>('moderate');
  
  // Contraction Menu State
  const [contractionMenu, setContractionMenu] = useState<{
      isOpen: boolean;
      hourIndex: number;
      x: number;
      y: number;
      weak: number;
      moderate: number;
      strong: number;
  } | null>(null);

  // Dilation Menu State
  const [dilationMenu, setDilationMenu] = useState<{
      isOpen: boolean;
      hourIndex: number;
      x: number;
      y: number;
      value: number;
  } | null>(null);

  // Station Menu State
  const [stationMenu, setStationMenu] = useState<{
      isOpen: boolean;
      hourIndex: number;
      x: number;
      y: number;
      value: number;
  } | null>(null);

  useEffect(() => {
    if (id) {
        patientService.getPatientById(id).then(p => {
            if (p) {
                setPatient(p);
                // Initialize Header Data
                setHeaderData({
                    date: new Date().toLocaleDateString(),
                    id: p.medicalRecordNumber || p.id?.slice(0, 8) || '', // Use medicalRecordNumber if available
                    name: p.name || '',
                    age: p.age?.toString() || '',
                    dum: '', 
                    dpp: '',
                    ig: `${p.gestationalAgeWeeks}s ${p.gestationalAgeDays}d`,
                    us: '',
                    parity: p.parity || '',
                    bloodType: p.bloodType || '',
                    babyName: p.babyName || '',
                    startDate: new Date().getDate().toString() // Just the day
                });

                if (p.partogramData) {
                    setPoints(p.partogramData.points);
                    
                    // Load Contractions
                    if (p.partogramData.contractionBlocks) {
                        setContractionBlocks(p.partogramData.contractionBlocks);
                    } else if (p.partogramData.contractions) {
                        // Legacy conversion
                        const legacyBlocks: PartogramContractionBlock[] = [];
                        p.partogramData.contractions.forEach(c => {
                            for(let i=0; i<c.frequency; i++) {
                                legacyBlocks.push({ x: c.x, slot: i, type: c.duration });
                            }
                        });
                        setContractionBlocks(legacyBlocks);
                    }

                    setTableData(p.partogramData.tableData);
                    if (p.partogramData.activePhaseStartIndex !== undefined) setActivePhaseIndex(p.partogramData.activePhaseStartIndex);
                    if (p.partogramData.observations) setObservations(p.partogramData.observations);
                } else {
                    // Initialize Data
                    const initialTable: PartogramTableColumn[] = Array.from({ length: NUM_COLS }).map((_, i) => ({
                        hourIndex: i,
                        realTime: '',
                        amnioticFluid: '',
                        la: '', // Added field
                        oxytocin: '',
                        meds: '',
                        examiner: '',
                        notes: ''
                    }));
                    
                    const now = new Date();
                    now.setMinutes(0,0,0);
                    const updatedTable = [...initialTable];
                    for(let i=0; i<NUM_COLS; i++) {
                        const t = new Date(now.getTime() + i * 60 * 60 * 1000);
                        updatedTable[i].realTime = t.getHours().toString();
                    }
                    setTableData(updatedTable);
                }
            }
            setLoading(false);
        });
    }
  }, [id]);

  const handleHeaderChange = (field: keyof typeof headerData, value: string) => {
      setHeaderData(prev => ({ ...prev, [field]: value.toUpperCase() }));
  };

  const handleSave = async () => {
      if (!id || !patient) return;
      setIsSubmitting(true);
      
      const partogramData: any = {
          startTime: new Date().toISOString(),
          points,
          contractionBlocks, 
          tableData,
          activePhaseStartIndex: activePhaseIndex,
          headerData, // Save header data if schema allows, or just use it for print
          observations
      };
      
      try {
          // Note: We are only saving partogramData structure. 
          // If we want to update patient demographics permanently, we should call updatePatient with those fields too.
          // For now, we assume these edits are for the partogram session/print.
          await patientService.updatePatient(id, { partogramData });
          navigate(`/patient/${id}`);
      } catch (error) {
          console.error(error);
          alert('Erro ao salvar.');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = VIEWBOX_W / rect.width;
      const scaleY = VIEWBOX_H / rect.height;
      
      const visualClickX = (e.clientX - rect.left) * scaleX;
      const visualClickY = (e.clientY - rect.top) * scaleY;

      const clickX = toInternalX(visualClickX);
      const clickY = toInternalY(visualClickY);

      if (clickX < GRID_X_START || clickX > GRID_X_END) return;
      
      const colRaw = (clickX - GRID_X_START) / COL_WIDTH;
      const hourIndex = Math.floor(colRaw);
      
      // Sub-index for BCF (0, 0.25, 0.5, 0.75) based on 15min intervals
      const subHourIndex = Math.floor((colRaw % 1) * 4); 
      const fractionalX = hourIndex + (subHourIndex * 0.25);

      if (hourIndex < 0 || hourIndex >= NUM_COLS) return;

      // 1. DILATION / STATION ZONE
      if (clickY >= Y_DILATION_10 && clickY <= Y_DILATION_0) {
          if (inputMode === 'eraser') {
             setPoints(prev => prev.filter(p => !(p.x === hourIndex && (p.type === 'dilation' || p.type === 'station'))));
             return;
          }

          const relY = clickY - Y_DILATION_10;
          const valPerPx = 10 / GRAPH_H;
          const rawVal = 10 - (relY * valPerPx);
          const value = Math.round(rawVal); // 0-10
          
          if (inputMode === 'dilation') {
              setDilationMenu({
                  isOpen: true,
                  hourIndex,
                  x: visualClickX,
                  y: visualClickY,
                  value: Math.min(10, Math.max(0, value))
              });
          } else if (inputMode === 'station') {
              // Station is -4 to +4 (mapped to 0-10 scale visually roughly, but logic needs check)
              // Actually station is usually plotted on the same graph. 
              // Let's assume the click Y maps to the station value directly if we want.
              // But standard partograms map station -3 to +3 or similar on the same 0-10 grid.
              // Let's stick to the calculated value and let user adjust in menu.
              // Map 0-10 range to typical station range if needed, or just use the value.
              // Standard: 0 dilation ~ -3 station? It varies. 
              // Let's just default to the calculated value (0-10) and let the menu handle the specific station values (-5 to +5).
              // Actually, let's map the click to a reasonable default station.
              // If Y is high (bottom), station is low (e.g. -3). If Y is low (top), station is high (+3).
              // Let's just open the menu with a default or 0.
              setStationMenu({
                  isOpen: true,
                  hourIndex,
                  x: visualClickX,
                  y: visualClickY,
                  value: 0 // Default to 0, user selects
              });
          }
      }

      // 2. BCF ZONE
      else if (clickY >= Y_BCF_180 && clickY <= Y_BCF_80) {
          if (inputMode === 'eraser') {
             setPoints(prev => prev.filter(p => !(Math.abs(p.x - fractionalX) < 0.1 && p.type === 'fcf')));
             return;
          }
          if (inputMode !== 'fcf') setInputMode('fcf');
          
          const relY = clickY - Y_BCF_180;
          const range = 100; // 180-80
          const valPerPx = range / BCF_H;
          const rawVal = 180 - (relY * valPerPx);
          const bpm = Math.round(rawVal / 5) * 5; 
          
          if (bpm >= 80 && bpm <= 180) {
              const existingIndex = points.findIndex(p => Math.abs(p.x - fractionalX) < 0.1 && p.type === 'fcf');
              if (existingIndex >= 0) {
                  const newPoints = [...points];
                  newPoints[existingIndex].y = bpm;
                  setPoints(newPoints);
              } else {
                  setPoints(prev => [...prev, { x: fractionalX, y: bpm, type: 'fcf' }]);
              }
          }
      }

      // 3. CONTRACTION ZONE
      else if (clickY >= Y_CONTRACTION_TOP && clickY <= Y_CONTRACTION_BOTTOM) {
          const relY = Y_CONTRACTION_BOTTOM - clickY; // Distance from bottom
          const slot = Math.floor(relY / CONTRACTION_ROW_H); // 0 to 4
          
          if (slot >= 0 && slot < 5) {
              if (inputMode === 'eraser') {
                  setContractionBlocks(prev => prev.filter(c => !(c.x === hourIndex && c.slot === slot)));
                  return;
              }
              if (inputMode !== 'contraction') setInputMode('contraction');

              // Open Menu instead of direct toggle
              const existing = contractionBlocks.filter(c => c.x === hourIndex);
              const weak = existing.filter(c => c.type === 'weak').length;
              const moderate = existing.filter(c => c.type === 'moderate').length;
              const strong = existing.filter(c => c.type === 'strong').length;

              setContractionMenu({
                  isOpen: true,
                  hourIndex,
                  x: visualClickX,
                  y: visualClickY,
                  weak,
                  moderate,
                  strong
              });
          }
      }
  };

  const confirmDilation = (val: number) => {
      if (!dilationMenu) return;
      const { hourIndex } = dilationMenu;
      
      const existingIndex = points.findIndex(p => p.x === hourIndex && p.type === 'dilation');
      if (existingIndex >= 0) {
          const newPoints = [...points];
          newPoints[existingIndex].y = val;
          setPoints(newPoints);
      } else {
          setPoints(prev => [...prev, { x: hourIndex, y: val, type: 'dilation' }]);
      }
      setDilationMenu(null);
  };

  const confirmStation = (val: number) => {
      if (!stationMenu) return;
      const { hourIndex } = stationMenu;
      
      // Map station value (-5 to +5) to graph Y (0-10)
      // Usually De Lee planes are plotted against the same 0-10 grid.
      // 0 dilation line often aligns with -3 station? Or 0 station?
      // Let's assume the user wants to plot the value 'val' on the 0-10 grid.
      // But wait, De Lee is -5 to +5. The grid is 0 to 10.
      // We need a mapping. 
      // Looking at the SVG text:
      // 10 cm -> -3 De Lee (High) ??? No, usually:
      // 10 cm -> +4/+5 (Low)
      // Let's look at the SVG labels again.
      // Left Axis (Dilatação): 10, 9, 8 ... 0
      // Right Axis (De Lee): -3, -2, -1, 0, +1, +2, +3, +4, +5
      // So:
      // 10cm = -3
      // 9cm = -2
      // 8cm = -1 (Wait, 10 is high up, 0 is low down)
      // Let's check the SVG text coordinates.
      // Text "10" is at y=1266. Text "-3" is at y=1325 (lower).
      // Actually, let's look at the SVG text content provided in previous turn.
      // 10 (Dil) aligns with -AM (De Lee?)
      // 9 (Dil) aligns with -3
      // 8 (Dil) aligns with -2
      // 7 (Dil) aligns with -1
      // 6 (Dil) aligns with 0
      // 5 (Dil) aligns with +1
      // 4 (Dil) aligns with +2
      // 3 (Dil) aligns with +3
      // 2 (Dil) aligns with +4
      // 1 (Dil) aligns with V (Vulva?)
      
      // So the mapping is:
      // De Lee = 6 - Dilation (roughly) => Dilation = 6 - De Lee
      // If user selects De Lee 0, we plot at Dilation 6.
      // If user selects De Lee -3, we plot at Dilation 9.
      // If user selects De Lee +3, we plot at Dilation 3.
      
      const yValue = 6 - val; 
      
      const existingIndex = points.findIndex(p => p.x === hourIndex && p.type === 'station');
      if (existingIndex >= 0) {
          const newPoints = [...points];
          newPoints[existingIndex].y = yValue;
          setPoints(newPoints);
      } else {
          setPoints(prev => [...prev, { x: hourIndex, y: yValue, type: 'station' }]);
      }
      setStationMenu(null);
  };

  const confirmContractions = () => {
      if (!contractionMenu) return;
      const { hourIndex, weak, moderate, strong } = contractionMenu;
      
      // Clear existing for this hour
      setContractionBlocks(prev => {
          const otherBlocks = prev.filter(c => c.x !== hourIndex);
          const newBlocks: PartogramContractionBlock[] = [];
          let currentSlot = 0;
          
          // Fill from bottom (slot 0) to top
          // Priority: Strong -> Moderate -> Weak
          for (let i = 0; i < strong; i++) {
              if (currentSlot < 5) newBlocks.push({ x: hourIndex, slot: currentSlot++, type: 'strong' });
          }
          for (let i = 0; i < moderate; i++) {
              if (currentSlot < 5) newBlocks.push({ x: hourIndex, slot: currentSlot++, type: 'moderate' });
          }
          for (let i = 0; i < weak; i++) {
              if (currentSlot < 5) newBlocks.push({ x: hourIndex, slot: currentSlot++, type: 'weak' });
          }
          
          return [...otherBlocks, ...newBlocks];
      });
      setContractionMenu(null);
  };

  const updateTableData = (index: number, field: keyof PartogramTableColumn, value: string) => {
      setTableData(prev => {
          const newData = [...prev];
          newData[index] = { ...newData[index], [field]: value };
          return newData;
      });
  };

  const setStartActivePhase = () => {
      const dilPoints = points.filter(p => p.type === 'dilation').sort((a,b) => a.x - b.x);
      if (dilPoints.length === 0) return;
      if (confirm("Definir o início da Linha de Alerta no primeiro ponto de dilatação?")) {
          setActivePhaseIndex(dilPoints[0].x);
      }
  };

  const clearAll = () => {
      if (confirm("Limpar todo o gráfico?")) {
          setPoints([]);
          setContractionBlocks([]);
          setActivePhaseIndex(undefined);
      }
  };

  // --- PATH GENERATORS ---
  const getPath = (type: string) => {
      const pts = points.filter(p => p.type === type).sort((a,b) => a.x - b.x);
      if (pts.length === 0) return '';
      return pts.map((p, i) => {
          let cx = 0;
          if (type === 'fcf') {
              cx = GRID_X_START + (p.x * COL_WIDTH);
          } else {
              // Dilation/Station: Center of column
              cx = GRID_X_START + (p.x * COL_WIDTH) + (COL_WIDTH / 2);
          }

          let cy = 0;
          if (type === 'fcf') {
              const ratio = (180 - p.y) / 100; 
              cy = Y_BCF_180 + (ratio * BCF_H);
          } else {
              const ratio = (10 - p.y) / 10;
              cy = Y_DILATION_10 + (ratio * GRAPH_H);
          }
          return `${i === 0 ? 'M' : 'L'} ${cx} ${cy}`;
      }).join(' ');
  };

  if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin h-8 w-8 border-b-2 border-slate-800 rounded-full"></div></div>;

  return (
    <div className="pb-20 bg-slate-100 min-h-screen flex flex-col items-center print:bg-white print:pb-0">
      <style>
        {`
          @media print {
            @page {
              size: A4;
              margin: 0;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        `}
      </style>
      {/* TOOLBAR */}
      <div className="w-full bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm px-4 py-2 flex flex-wrap items-center gap-3 justify-between print:hidden">
         <div className="flex items-center gap-2">
             <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
                <ArrowLeft className="w-5 h-5" />
             </button>
         </div>

         <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
             <div className="flex bg-slate-100 p-1 rounded-lg">
                 <button onClick={() => setInputMode('dilation')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${inputMode==='dilation'?'bg-white text-slate-900 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                     <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[8px] border-b-black"></span> Dilat
                 </button>
                 <button onClick={() => setInputMode('station')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${inputMode==='station'?'bg-white text-slate-900 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                     <span className="w-2 h-2 border border-black rounded-full"></span> De Lee
                 </button>
                 <button onClick={() => setInputMode('fcf')} className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1 transition-all ${inputMode==='fcf'?'bg-white text-slate-900 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                     <span className="w-1 h-1 bg-black rounded-full"></span> BCF
                 </button>
             </div>

             <div className="flex bg-slate-100 p-1 rounded-lg">
                 <button onClick={() => { setInputMode('contraction'); setContractionType('weak'); }} className={`px-3 py-1.5 rounded-md transition-all ${inputMode==='contraction'&&contractionType==='weak'?'bg-white shadow-sm':''}`} title="Fraca (<20s)">
                     <X className="w-3 h-3 text-slate-700" />
                 </button>
                 <button onClick={() => { setInputMode('contraction'); setContractionType('moderate'); }} className={`px-3 py-1.5 rounded-md transition-all ${inputMode==='contraction'&&contractionType==='moderate'?'bg-white shadow-sm':''}`} title="Média (20-40s)">
                     <div className="w-3 h-3 border border-slate-700 relative overflow-hidden"><div className="absolute inset-0 bg-slate-400" style={{clipPath:'polygon(0 0, 100% 0, 0 100%)'}}></div></div>
                 </button>
                 <button onClick={() => { setInputMode('contraction'); setContractionType('strong'); }} className={`px-3 py-1.5 rounded-md transition-all ${inputMode==='contraction'&&contractionType==='strong'?'bg-white shadow-sm':''}`} title="Forte (>40s)">
                     <Square className="w-3 h-3 fill-slate-700 text-slate-700" />
                 </button>
             </div>

             <div className="w-px h-6 bg-slate-200"></div>

             <button onClick={() => setInputMode('eraser')} className={`p-2 rounded-lg border ${inputMode==='eraser'?'bg-red-50 border-red-200 text-red-600':'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
                 <Eraser className="w-4 h-4" />
             </button>
             <button onClick={clearAll} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50" title="Limpar">
                 <Trash2 className="w-4 h-4" />
             </button>
         </div>

         <div className="flex items-center gap-2">
             <button onClick={() => window.print()} className="hidden sm:flex px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 gap-2 items-center">
                 <Printer className="w-4 h-4" /> Imprimir
             </button>
             <button onClick={setStartActivePhase} className="hidden sm:flex px-3 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100">
                 Linha de Alerta
             </button>
             <button onClick={handleSave} disabled={isSubmitting} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-md hover:bg-slate-800 flex items-center gap-2">
                <Save className="w-4 h-4" /> Salvar
             </button>
         </div>
      </div>

      {/* --- CANVAS --- */}
      <div className="bg-white shadow-2xl my-8 relative overflow-hidden print:shadow-none print:my-0" style={{ width: '210mm', height: '297mm' }}> 
         <div className="absolute inset-0 overflow-auto print:overflow-visible">
             <svg 
                ref={svgRef}
                viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} 
                width="100%" 
                height="100%" 
                preserveAspectRatio="none"
                className="bg-white cursor-crosshair select-none"
                onClick={handleSvgClick}
                shapeRendering="geometricPrecision"
             >
                 {/* BACKGROUND IMAGE 
                     To change the background, upload a high-res PNG (2481x3508) to the public folder 
                     and name it 'partograma.png', or update the href below. 
                 */}
                 <image href="/partograma.png" width="2481" height="3508" preserveAspectRatio="none" />

                 {/* MAIN TRANSFORM GROUP */}
                 <g transform="matrix(1.04175,0,0,1.04175,-50.052284,-610.189202)">
                    
                    {/* DYNAMIC PATIENT DATA - Positioned relative to main group */}
                    <foreignObject x="350" y="830" width="250" height="60">
                        <input value={headerData.date} onChange={e => handleHeaderChange('date', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    <foreignObject x="1650" y="830" width="400" height="60">
                        <input value={headerData.id} onChange={e => handleHeaderChange('id', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    
                    <foreignObject x="380" y="910" width="1400" height="60">
                        <input value={headerData.name} onChange={e => handleHeaderChange('name', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    <foreignObject x="2000" y="910" width="200" height="60">
                        <input value={headerData.age} onChange={e => handleHeaderChange('age', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    
                    <foreignObject x="350" y="1000" width="350" height="60">
                        <input value={headerData.dum} onChange={e => handleHeaderChange('dum', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    <foreignObject x="850" y="1000" width="330" height="60">
                        <input value={headerData.dpp} onChange={e => handleHeaderChange('dpp', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    <foreignObject x="1420" y="1000" width="320" height="60">
                        <input value={headerData.ig} onChange={e => handleHeaderChange('ig', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    <foreignObject x="1950" y="1000" width="300" height="60">
                        <input value={headerData.us} onChange={e => handleHeaderChange('us', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    
                    <foreignObject x="480" y="1080" width="700" height="60">
                        <input value={headerData.parity} onChange={e => handleHeaderChange('parity', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    <foreignObject x="1550" y="1080" width="100" height="60">
                        <input value={headerData.bloodType} onChange={e => handleHeaderChange('bloodType', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    <foreignObject x="1750" y="1080" width="500" height="60">
                        <input value={headerData.babyName} onChange={e => handleHeaderChange('babyName', e.target.value)} className="w-full h-full bg-transparent text-[40px] font-bold border-none outline-none uppercase" />
                    </foreignObject>
                    
                    {/* START DATE - Positioned near "Data de início" */}
                    <foreignObject x="450" y="1830" width="300" height="60">
                        <input value={headerData.startDate} onChange={e => handleHeaderChange('startDate', e.target.value)} className="w-full h-full bg-transparent text-[30px] font-bold border-none outline-none uppercase text-center" />
                    </foreignObject>

                    {/* DYNAMIC GRAPH CONTENT */}
                    
                    {/* Alert & Action Lines */}
                    {activePhaseIndex !== undefined && (() => {
                        const p = points.find(pt => pt.x === activePhaseIndex && pt.type === 'dilation');
                        if (!p) return null;
                        
                        const startX = GRID_X_START + (activePhaseIndex * COL_WIDTH) + (COL_WIDTH/2);
                        const ratio = (10 - p.y) / 10;
                        const startY = Y_DILATION_10 + (ratio * GRAPH_H);
                        
                        const hoursToEnd = 10 - p.y;
                        const endX = startX + (hoursToEnd * COL_WIDTH);
                        const endY = Y_DILATION_10; 

                        return (
                            <g>
                                <line x1={startX} y1={startY} x2={endX} y2={endY} stroke="black" strokeWidth="6" />
                                <line x1={startX + (4*COL_WIDTH)} y1={startY} x2={endX + (4*COL_WIDTH)} y2={endY} stroke="black" strokeWidth="8" />
                            </g>
                        )
                    })()}

                    {/* Dilation Points - NO PATH, BIGGER SYMBOLS, CENTERED IN INTERVAL */}
                    {points.filter(p => p.type === 'dilation').map((p, i) => {
                        const cx = GRID_X_START + (p.x * COL_WIDTH) + (COL_WIDTH / 2);
                        const ratio = (10 - p.y) / 10;
                        // Shift Y by half interval height to center in the square
                        const intervalHeight = GRAPH_H / 10;
                        const cy = Y_DILATION_10 + (ratio * GRAPH_H) + (intervalHeight / 2);
                        
                        // Triangle size increased
                        const s = 30; 
                        return <polygon key={`d-${i}`} points={`${cx},${cy-s} ${cx-s},${cy+s} ${cx+s},${cy+s}`} fill="black" />;
                    })}

                    {/* Station Points - NO PATH, BIGGER SYMBOLS, CENTERED IN INTERVAL */}
                    {points.filter(p => p.type === 'station').map((p, i) => {
                        const cx = GRID_X_START + (p.x * COL_WIDTH) + (COL_WIDTH / 2);
                        const ratio = (10 - p.y) / 10; 
                        // Shift Y by half interval height to center in the square
                        const intervalHeight = GRAPH_H / 10;
                        const cy = Y_DILATION_10 + (ratio * GRAPH_H) + (intervalHeight / 2);
                        
                        return <circle key={`s-${i}`} cx={cx} cy={cy} r="25" fill="white" stroke="black" strokeWidth="6" />;
                    })}

                    {/* FCF Points */}
                    <path d={getPath('fcf')} fill="none" stroke="black" strokeWidth="4" />
                    {points.filter(p => p.type === 'fcf').map((p, i) => {
                        const cx = GRID_X_START + (p.x * COL_WIDTH); 
                        const ratio = (180 - p.y) / 100;
                        const cy = Y_BCF_180 + (ratio * BCF_H);
                        return <circle key={`f-${i}`} cx={cx} cy={cy} r="10" fill="black" />;
                    })}

                     {/* Contractions */}
                     {contractionBlocks.map((c, i) => {
                         const x = GRID_X_START + (c.x * COL_WIDTH);
                         // Fix Y calculation: slot 0 is bottom
                         // Add slight overlap (0.5) to ensure no gaps
                         const y = Y_CONTRACTION_BOTTOM - ((c.slot + 1) * CONTRACTION_ROW_H);
                         const h = CONTRACTION_ROW_H + 1; // +1 overlap
                         
                         // Remove padding to fill square completely
                         const drawX = x;
                         const drawY = y;
                         const drawW = COL_WIDTH;
                         const drawH = h;

                         if (c.type === 'weak') {
                             return (
                                 <g key={`cw-${i}`}>
                                     <rect x={drawX} y={drawY} width={drawW} height={drawH} fill="white" stroke="black" strokeWidth="1" />
                                     {/* Weak: X connecting corners */}
                                     <line x1={drawX} y1={drawY} x2={drawX+drawW} y2={drawY+drawH} stroke="black" strokeWidth="2" />
                                     <line x1={drawX+drawW} y1={drawY} x2={drawX} y2={drawY+drawH} stroke="black" strokeWidth="2" />
                                 </g>
                             );
                         } else if (c.type === 'moderate') {
                             return (
                                 <g key={`cm-${i}`}>
                                      <rect x={drawX} y={drawY} width={drawW} height={drawH} fill="white" stroke="black" strokeWidth="1" />
                                      {/* Moderate: Triangle filling bottom-left half */}
                                      <polygon points={`${drawX},${drawY} ${drawX},${drawY+drawH} ${drawX+drawW},${drawY+drawH}`} fill="black" />
                                 </g>
                             );
                         } else {
                             // Strong: Full Black
                             return <rect key={`cs-${i}`} x={drawX} y={drawY} width={drawW} height={drawH} fill="black" stroke="black" strokeWidth="1" />;
                         }
                     })}
                 </g> {/* END MAIN GROUP */}

             </svg>

             {/* === HTML OVERLAYS FOR INPUTS === */}
             
             {/* Time Inputs */}
             <div className="absolute flex" style={{ top: (toVisualY(Y_TIME_REAL_TOP) / VIEWBOX_H * 100) + '%', left: (toVisualX(GRID_X_START) / VIEWBOX_W * 100) + '%', width: ((toVisualX(GRID_X_END) - toVisualX(GRID_X_START)) / VIEWBOX_W * 100) + '%', height: (toVisualY(Y_TIME_REAL_TOP + TIME_ROW_H) - toVisualY(Y_TIME_REAL_TOP)) / VIEWBOX_H * 100 + '%' }}>
                 {tableData.map((col, i) => (
                     <input key={`hr-${i}`} type="text" value={col.realTime} onChange={e => updateTableData(i, 'realTime', e.target.value.toUpperCase())} 
                        className="w-full h-full bg-transparent text-center text-[10px] sm:text-xs font-bold border-none outline-none p-0 text-black uppercase" 
                        style={{ width: `${100/NUM_COLS}%` }}
                     />
                 ))}
             </div>
             
             {/* Hour Reg Display - NOW EDITABLE */}
             <div className="absolute flex" style={{ top: (toVisualY(Y_TIME_REG_TOP) / VIEWBOX_H * 100) + '%', left: (toVisualX(GRID_X_START) / VIEWBOX_W * 100) + '%', width: ((toVisualX(GRID_X_END) - toVisualX(GRID_X_START)) / VIEWBOX_W * 100) + '%', height: (toVisualY(Y_TIME_REG_TOP + TIME_ROW_H) - toVisualY(Y_TIME_REG_TOP)) / VIEWBOX_H * 100 + '%' }}>
                 {tableData.map((col, i) => (
                     <input 
                        key={`reg-${i}`} 
                        type="text"
                        value={col.registerHour !== undefined ? col.registerHour : (i + 1).toString()}
                        onChange={e => updateTableData(i, 'registerHour', e.target.value.toUpperCase())}
                        className="w-full h-full bg-transparent text-center text-[10px] sm:text-xs font-bold border-none outline-none p-0 text-slate-700 uppercase" 
                        style={{ width: `${100/NUM_COLS}%` }}
                     />
                 ))}
             </div>

             {/* Table Inputs - Using Specific Rows */}
             {TABLE_ROWS_CONFIG.map((row, rIdx) => (
                 <div key={`row-${row.key}`} className="absolute flex" 
                      style={{ 
                          top: (toVisualY(row.y) / VIEWBOX_H * 100) + '%', 
                          left: (toVisualX(GRID_X_START) / VIEWBOX_W * 100) + '%', 
                          width: ((toVisualX(GRID_X_END) - toVisualX(GRID_X_START)) / VIEWBOX_W * 100) + '%', 
                          height: (toVisualY(row.y + row.h) - toVisualY(row.y)) / VIEWBOX_H * 100 + '%' 
                      }}>
                     {tableData.map((col, cIdx) => (
                         <div key={`cell-${row.key}-${cIdx}`} className="relative h-full border-none flex items-center justify-center overflow-hidden" style={{ width: `${100/NUM_COLS}%` }}>
                             {row.rotate ? (
                                 <textarea 
                                     value={(col[row.key as keyof PartogramTableColumn] as string || '').trim()}
                                     onChange={e => updateTableData(cIdx, row.key as keyof PartogramTableColumn, e.target.value.toUpperCase())}
                                     className={`w-full h-full bg-transparent text-left ${(row as any).fontSize || 'text-[10px] sm:text-xs'} font-bold border-none outline-none p-0 m-0 text-black uppercase resize-none overflow-hidden leading-tight appearance-none`}
                                     style={{ 
                                         writingMode: 'vertical-rl',
                                         transform: 'rotate(180deg)',
                                     }}
                                 />
                             ) : (
                                 <textarea 
                                     value={col[row.key as keyof PartogramTableColumn] as string || ''}
                                     onChange={e => updateTableData(cIdx, row.key as keyof PartogramTableColumn, e.target.value.toUpperCase())}
                                     className="w-full h-full bg-transparent text-center text-[10px] sm:text-xs font-bold border-none outline-none p-1 text-black uppercase resize-none appearance-none"
                                 />
                             )}
                         </div>
                     ))}
                 </div>
             ))}

             {/* OBSERVATIONS TEXTAREA - Right side of the graph */}
             <div className="absolute" style={{ 
                 top: (toVisualY(2994) / VIEWBOX_H * 100) + '%', 
                 left: (toVisualX(GRID_X_END + 20) / VIEWBOX_W * 100) + '%', 
                 width: ((VIEWBOX_W - toVisualX(GRID_X_END + 20) - 50) / VIEWBOX_W * 100) + '%', 
                 height: (toVisualY(3732 + 160) - toVisualY(2994)) / VIEWBOX_H * 100 + '%' 
             }}>
                 <textarea 
                     value={observations}
                     onChange={e => setObservations(e.target.value.toUpperCase())}
                     className="w-full h-full bg-transparent border border-slate-300 p-2 text-xs font-bold text-black uppercase resize-none appearance-none"
                     placeholder="OBSERVAÇÕES"
                 />
             </div>

             {/* Contraction Menu */}
             {contractionMenu && contractionMenu.isOpen && (
                 <div className="absolute bg-white p-4 rounded-lg shadow-xl border border-slate-200 z-50 flex flex-col gap-3"
                      style={{ 
                          left: (contractionMenu.x / VIEWBOX_W * 100) + '%', 
                          top: (contractionMenu.y / VIEWBOX_H * 100) + '%',
                          transform: 'translate(-50%, -100%)',
                          marginTop: '-10px'
                      }}>
                      <h3 className="font-bold text-sm text-slate-700 whitespace-nowrap">Contrações (Hora {contractionMenu.hourIndex + 1})</h3>
                      
                      <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border border-black flex items-center justify-center"><X className="w-3 h-3" /></div>
                          <label className="text-xs w-16">Fraca</label>
                          <input type="number" min="0" max="5" value={contractionMenu.weak} onChange={e => setContractionMenu({...contractionMenu, weak: Math.min(5, Math.max(0, parseInt(e.target.value)||0))})} className="w-12 border rounded p-1 text-xs" />
                      </div>
                      <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border border-slate-700 relative overflow-hidden"><div className="absolute inset-0 bg-slate-400" style={{clipPath:'polygon(0 0, 100% 0, 0 100%)'}}></div></div>
                          <label className="text-xs w-16">Média</label>
                          <input type="number" min="0" max="5" value={contractionMenu.moderate} onChange={e => setContractionMenu({...contractionMenu, moderate: Math.min(5, Math.max(0, parseInt(e.target.value)||0))})} className="w-12 border rounded p-1 text-xs" />
                      </div>
                      <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-black border border-black"></div>
                          <label className="text-xs w-16">Forte</label>
                          <input type="number" min="0" max="5" value={contractionMenu.strong} onChange={e => setContractionMenu({...contractionMenu, strong: Math.min(5, Math.max(0, parseInt(e.target.value)||0))})} className="w-12 border rounded p-1 text-xs" />
                      </div>
                      
                      <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => setContractionMenu(null)} className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                          <button onClick={confirmContractions} className="px-2 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800">Confirmar</button>
                      </div>
                 </div>
             )}

             {/* Dilation Menu */}
             {dilationMenu && dilationMenu.isOpen && (
                 <div className="absolute bg-white p-4 rounded-lg shadow-xl border border-slate-200 z-50 flex flex-col gap-3"
                      style={{ 
                          left: (dilationMenu.x / VIEWBOX_W * 100) + '%', 
                          top: (dilationMenu.y / VIEWBOX_H * 100) + '%',
                          transform: 'translate(-50%, -100%)',
                          marginTop: '-10px'
                      }}>
                      <h3 className="font-bold text-sm text-slate-700 whitespace-nowrap">Dilatação (cm)</h3>
                      <div className="grid grid-cols-6 gap-1">
                          {Array.from({length: 11}).map((_, i) => (
                              <button 
                                  key={i} 
                                  onClick={() => setDilationMenu({...dilationMenu, value: i})}
                                  className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded border ${dilationMenu.value === i ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                              >
                                  {i}
                              </button>
                          ))}
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => setDilationMenu(null)} className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                          <button onClick={() => confirmDilation(dilationMenu.value)} className="px-2 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800">Confirmar</button>
                      </div>
                 </div>
             )}

             {/* Station Menu */}
             {stationMenu && stationMenu.isOpen && (
                 <div className="absolute bg-white p-4 rounded-lg shadow-xl border border-slate-200 z-50 flex flex-col gap-3"
                      style={{ 
                          left: (stationMenu.x / VIEWBOX_W * 100) + '%', 
                          top: (stationMenu.y / VIEWBOX_H * 100) + '%',
                          transform: 'translate(-50%, -100%)',
                          marginTop: '-10px'
                      }}>
                      <h3 className="font-bold text-sm text-slate-700 whitespace-nowrap">De Lee (Plano)</h3>
                      <div className="grid grid-cols-5 gap-1">
                          {[-3, -2, -1, 0, 1, 2, 3, 4, 5].map((val) => (
                              <button 
                                  key={val} 
                                  onClick={() => setStationMenu({...stationMenu, value: val})}
                                  className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded border ${stationMenu.value === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                              >
                                  {val > 0 ? `+${val}` : val}
                              </button>
                          ))}
                      </div>
                      <div className="flex justify-end gap-2 mt-2">
                          <button onClick={() => setStationMenu(null)} className="px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                          <button onClick={() => confirmStation(stationMenu.value)} className="px-2 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800">Confirmar</button>
                      </div>
                 </div>
             )}

         </div>
      </div>
    </div>
  );
};

export default PartogramPage;
