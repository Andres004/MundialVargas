// @ts-nocheck
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://spulkmtcpxjxqcolkiuo.supabase.co', 'sb_publishable_OGy26eyySr3gpRsKC1imtA_iOzL_0Hm');

// =========================================================================
// ⚙️ CONFIGURACIÓN DEL ADMINISTRADOR (TÚ)
// =========================================================================

// 1. El sobrante exacto de los partidos de hoy (según el cálculo de tu tabla).
const POZO_AYER = 115.5; 
const PRECIO_POR_PARTIDO = 3; 

// 2. PARTIDOS REALES DEL JUEVES 25 DE JUNIO (Con horarios de Bolivia)
// OJO: Los IDs ahora son 201+ para que no se mezclen con las apuestas de ayer en la base de datos.
const PARTIDOS_DE_HOY = [
  { id: 201, home_team: 'Ecuador', away_team: 'Alemania', home_flag: 'https://flagcdn.com/w80/ec.png', away_flag: 'https://flagcdn.com/w80/de.png', home_score: 0, away_score: 0, status: 'PENDING', time: '16:00' },
  { id: 202, home_team: 'Curazao', away_team: 'C. Marfil', home_flag: 'https://flagcdn.com/w80/cw.png', away_flag: 'https://flagcdn.com/w80/ci.png', home_score: 0, away_score: 0, status: 'PENDING', time: '16:00' },
  { id: 203, home_team: 'Japón', away_team: 'Suecia', home_flag: 'https://flagcdn.com/w80/jp.png', away_flag: 'https://flagcdn.com/w80/se.png', home_score: 0, away_score: 0, status: 'PENDING', time: '19:00' },
  { id: 204, home_team: 'Países Bajos', away_team: 'Túnez', home_flag: 'https://flagcdn.com/w80/nl.png', away_flag: 'https://flagcdn.com/w80/tn.png', home_score: 0, away_score: 0, status: 'PENDING', time: '19:00' },
  { id: 205, home_team: 'EE.UU.', away_team: 'Turquía', home_flag: 'https://flagcdn.com/w80/us.png', away_flag: 'https://flagcdn.com/w80/tr.png', home_score: 0, away_score: 0, status: 'PENDING', time: '22:00' },
  { id: 206, home_team: 'Paraguay', away_team: 'Australia', home_flag: 'https://flagcdn.com/w80/py.png', away_flag: 'https://flagcdn.com/w80/au.png', home_score: 0, away_score: 0, status: 'PENDING', time: '22:00' }
];

export default function App() {
  const hoyStr = new Date().toLocaleDateString('es-BO');
  const datosGuardados = JSON.parse(localStorage.getItem('pollaData') || '{}');
  
  const [user, setUser] = useState(datosGuardados.fecha === hoyStr ? datosGuardados.nombre : '');
  const [nameInput, setNameInput] = useState('');
  
  const [matches, setMatches] = useState(PARTIDOS_DE_HOY);
  const [predictions, setPredictions] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    
    if (user) {
      fetchPredictions();
      const channel = supabase
        .channel('public-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => {
          fetchPredictions();
        })
        .subscribe();
      return () => { clearInterval(timer); supabase.removeChannel(channel); };
    }
    return () => clearInterval(timer);
  }, [user]);

  const fetchPredictions = async () => {
    const { data, error } = await supabase.from('predictions').select('*');
    if (error) console.error("Error al leer:", error);
    if (data) setPredictions(data);
  };

  const login = async (e) => {
    e.preventDefault();
    if (!nameInput) return;
    const formattedName = nameInput.trim();
    
    await supabase.from('users').upsert({ name: formattedName });
    localStorage.setItem('pollaData', JSON.stringify({ nombre: formattedName, fecha: hoyStr }));
    setUser(formattedName);
  };

  const predict = async (matchId, home, away) => {
    const { error } = await supabase.from('predictions').upsert({
      user_name: user, 
      match_id: matchId, 
      home_score: parseInt(home) || 0, 
      away_score: parseInt(away) || 0
    }, { onConflict: 'user_name,match_id' });
    
    if (error) {
      alert("Error de Supabase: " + error.message); 
    } else {
      fetchPredictions();
      alert("¡Apuesta guardada!");
    }
  };

  const isLocked = (matchTimeStr) => {
    const [hours, minutes] = matchTimeStr.split(':');
    const matchDate = new Date();
    matchDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    const diffMinutes = (matchDate.getTime() - currentTime.getTime()) / 60000;
    // BLOQUEO EXACTO A LOS 30 MINUTOS ANTES
    return diffMinutes <= 30; 
  };

  // CÁLCULO ESTRICTO DE POZOS DIVISIBLES (Exactamente como tu Excel)
  const jugadoresUnicosSet = new Set(predictions.map(p => p.user_name));
  const jugadoresUnicosHoy = jugadoresUnicosSet.size;
  
  let acumuladoEnJuego = POZO_AYER; 

  const partidosPorHora = {};
  matches.forEach(m => {
    if (!partidosPorHora[m.time]) partidosPorHora[m.time] = [];
    partidosPorHora[m.time].push(m);
  });

  const horasOrdenadas = Object.keys(partidosPorHora).sort();
  const matchesConPozoUnsorted = [];

  horasOrdenadas.forEach(hora => {
    const grupo = partidosPorHora[hora];
    // Se divide el pozo acumulado entre los partidos de la misma hora
    const acumuladoRepartido = acumuladoEnJuego / grupo.length;
    let acumuladoParaSiguienteHora = 0;

    grupo.forEach(m => {
      const matchPreds = predictions.filter(p => p.match_id === m.id);
      const ganadores = matchPreds.filter(p => p.home_score === m.home_score && p.away_score === m.away_score);
      
      const pozoBaseDelPartido = jugadoresUnicosHoy * PRECIO_POR_PARTIDO;
      const pozoTotal = pozoBaseDelPartido + acumuladoRepartido;
      
      let mensajeResultado = "";
      
      if (m.status === 'FINISHED') {
        if (ganadores.length > 0) {
          const premio = (pozoTotal / ganadores.length).toFixed(2);
          mensajeResultado = `🏆 GANADOR(ES): ${ganadores.map(g => g.user_name).join(', ')} (PREMIO: ${premio} Bs)`;
        } else {
          mensajeResultado = "Nadie acertó. El pozo pasa al siguiente turno.";
          // Sumamos la sobra para la siguiente hora
          acumuladoParaSiguienteHora += pozoTotal; 
        }
      }

      matchesConPozoUnsorted.push({ ...m, pozoTotal, mensajeResultado, ganadores });
    });

    // Actualizamos el pozo global para la siguiente franja horaria
    acumuladoEnJuego = acumuladoParaSiguienteHora;
  });

  const matchesConPozo = matchesConPozoUnsorted.sort((a,b) => a.id - b.id);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');`}</style>
        <form onSubmit={login} className="bg-white p-8 md:p-10 rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-black text-indigo-900 tracking-tight uppercase">Mundial Vargas</h1>
            <p className="text-slate-500 text-sm mt-3 font-bold">Costo del día: 18 Bs (3 Bs x 6 partidos).</p>
          </div>
          <input 
            type="text" placeholder="Ingresa tu nombre..." required
            className="w-full bg-slate-50 text-slate-900 px-5 py-4 rounded-2xl mb-6 outline-none border-2 border-slate-200 focus:border-indigo-500 font-bold text-center text-lg transition-all"
            value={nameInput} onChange={(e) => setNameInput(e.target.value)}
          />
          <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl hover:bg-indigo-700 hover:shadow-xl transition-all uppercase tracking-widest text-lg">
            Entrar a Jugar
          </button>
        </form>
      </div>
    );
  }

  const recaudacionTotalDelDia = jugadoresUnicosHoy * (PRECIO_POR_PARTIDO * matches.length);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 pb-12" style={{ fontFamily: "'Outfit', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');`}</style>
      
      <header className="bg-white sticky top-0 z-50 p-5 border-b border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-black text-indigo-950 uppercase tracking-tight">Mundial Vargas</h1>
          <p className="text-sm text-slate-500 mt-1 font-bold">Jugador: <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{user}</span> | Activos: {jugadoresUnicosHoy}</p>
        </div>
        <div className="bg-indigo-50 px-6 py-2.5 rounded-2xl border border-indigo-100 text-center w-full md:w-auto shadow-inner">
          <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest">Recaudación de Hoy</p>
          <p className="text-3xl font-black text-indigo-700">{recaudacionTotalDelDia} <span className="text-base">Bs</span></p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-10">
        <div className="grid gap-8 md:grid-cols-2">
          {matchesConPozo.map(m => {
            const myP = predictions.find(p => p.match_id === m.id && p.user_name === user);
            const isFinished = m.status === 'FINISHED';
            const locked = isLocked(m.time) || isFinished;
            const matchPredictions = predictions.filter(p => p.match_id === m.id);
            
            return (
              <div key={m.id} className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-100 shadow-lg relative flex flex-col hover:shadow-xl transition-shadow">
                
                <div className="absolute top-0 right-0 bg-slate-100 text-slate-600 text-[11px] font-black px-5 py-2 rounded-bl-2xl border-b border-l border-slate-200 uppercase tracking-widest">
                  Hora: {m.time}
                </div>
                
                {isFinished && <div className="absolute top-0 left-0 bg-indigo-950 text-white text-[11px] font-black px-5 py-2 rounded-br-2xl uppercase tracking-widest">Finalizado</div>}
                {locked && !isFinished && <div className="absolute top-0 left-0 bg-red-500 text-white text-[11px] font-black px-5 py-2 rounded-br-2xl uppercase tracking-widest shadow-md">Cerrado</div>}

                <div className="flex justify-between items-center mt-8 mb-6">
                  <div className="flex flex-col items-center w-1/3">
                    <img src={m.home_flag} alt={m.home_team} className="w-20 h-14 object-cover rounded-lg shadow-sm mb-3 border border-slate-200" />
                    <span className="font-black text-sm text-slate-800 text-center uppercase tracking-wider">{m.home_team}</span>
                  </div>
                  
                  <div className="bg-slate-50 px-6 py-3 rounded-2xl font-black text-4xl text-indigo-950 border-2 border-slate-100 shadow-inner">
                    {isFinished ? m.home_score : '-'} <span className="text-slate-300 mx-1">:</span> {isFinished ? m.away_score : '-'}
                  </div>

                  <div className="flex flex-col items-center w-1/3">
                    <img src={m.away_flag} alt={m.away_team} className="w-20 h-14 object-cover rounded-lg shadow-sm mb-3 border border-slate-200" />
                    <span className="font-black text-sm text-slate-800 text-center uppercase tracking-wider">{m.away_team}</span>
                  </div>
                </div>

                <div className="text-center mb-8">
                  <div className="inline-block bg-amber-100 border border-amber-200 text-amber-800 text-sm font-black px-6 py-2 rounded-full shadow-sm tracking-wide">
                    Pozo en juego: {m.pozoTotal} Bs
                  </div>
                  {isFinished && (
                    <div className={`mt-4 text-sm font-black px-4 py-3 rounded-xl uppercase tracking-wider transition-all ${m.ganadores.length > 0 ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                      {m.mensajeResultado}
                    </div>
                  )}
                </div>

                {!locked ? (
                  <form 
                    onSubmit={(e) => { e.preventDefault(); predict(m.id, e.target.home.value, e.target.away.value); }}
                    className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-200 mb-6 shadow-inner"
                  >
                    <input type="number" name="home" min="0" required defaultValue={myP?.home_score} className="w-16 h-12 bg-white border-2 border-slate-200 rounded-xl text-center text-xl font-black text-indigo-950 outline-none focus:border-indigo-500" />
                    <button type="submit" className="bg-indigo-600 text-white font-black px-8 py-3 rounded-xl text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-600/30 uppercase tracking-widest transition-transform active:scale-95">
                      {myP ? 'Modificar' : 'Apostar'}
                    </button>
                    <input type="number" name="away" min="0" required defaultValue={myP?.away_score} className="w-16 h-12 bg-white border-2 border-slate-200 rounded-xl text-center text-xl font-black text-indigo-950 outline-none focus:border-indigo-500" />
                  </form>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-200 mb-6">
                    <p className="text-[10px] text-slate-400 uppercase font-black mb-1 tracking-widest">Tu predicción</p>
                    <p className="text-2xl font-black text-indigo-600">{myP?.home_score ?? '-'} : {myP?.away_score ?? '-'}</p>
                  </div>
                )}

                <div className="mt-auto border-t border-slate-100 pt-5">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Apuestas de la Familia</h3>
                  {locked ? (
                    matchPredictions.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto pr-2 scrollbar-thin">
                        <table className="w-full text-left text-sm">
                          <tbody className="divide-y divide-slate-100">
                            {matchPredictions.map(p => {
                              const acerto = isFinished && p.home_score === m.home_score && p.away_score === m.away_score;
                              return (
                                <tr key={p.user_name} className={p.user_name === user ? 'bg-indigo-50/50' : ''}>
                                  <td className="py-2.5 px-3 text-slate-700 font-bold">{p.user_name}</td>
                                  <td className={`py-2.5 px-3 text-right font-black ${acerto ? 'text-green-500' : 'text-indigo-600'}`}>{p.home_score} : {p.away_score}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic text-center font-bold">Nadie apostó.</p>
                    )
                  ) : (
                    <div className="bg-amber-50 border border-amber-100 text-amber-600 text-[11px] font-black text-center py-3 rounded-xl uppercase tracking-widest">
                      🔒 Secretas hasta el cierre
                    </div>
                  )}
                </div>

              </div>
            )
          })}
        </div>

        {/* TABLA DE RESUMEN GLOBAL ESTILO EXCEL */}
        <div className="mt-16 bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden mb-10">
          <div className="bg-indigo-950 p-5 border-b border-indigo-900">
            <h2 className="text-lg font-black text-white uppercase tracking-widest text-center">Resumen General de Predicciones</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-sm">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b-2 border-slate-200">
                <tr>
                  <th className="p-4 border-r border-slate-200 text-left min-w-[120px]">Jugador</th>
                  {matchesConPozo.map(m => (
                    <th key={m.id} className="p-3 border-r border-slate-200 min-w-[80px]">
                      <div className="text-indigo-600 mb-1">{m.time}</div>
                      <div>{m.home_team.substring(0,3)}<br/>vs<br/>{m.away_team.substring(0,3)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from(jugadoresUnicosSet).map(jugador => (
                  <tr key={jugador} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-black text-left text-slate-700 border-r border-slate-200">{jugador}</td>
                    {matchesConPozo.map(m => {
                      const p = predictions.find(pred => pred.match_id === m.id && pred.user_name === jugador);
                      let content = "-";
                      let bgClass = "";
                      
                      if (p) {
                        const isMatchLocked = isLocked(m.time) || m.status === 'FINISHED';
                        if (isMatchLocked || jugador === user) {
                          content = `${p.home_score} - ${p.away_score}`;
                          if (m.status === 'FINISHED') {
                            if (p.home_score === m.home_score && p.away_score === m.away_score) {
                              bgClass = "bg-green-500 text-white shadow-inner";
                            } else {
                              bgClass = "bg-red-400 text-white shadow-inner";
                            }
                          }
                        } else {
                          content = "🔒";
                        }
                      }

                      return (
                        <td key={m.id} className={`p-3 font-black border-r border-slate-200 ${bgClass}`}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}