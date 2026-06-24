// @ts-nocheck
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://spulkmtcpxjxqcolkiuo.supabase.co', 'sb_publishable_OGy26eyySr3gpRsKC1imtA_iOzL_0Hm');

// =========================================================================
// ⚙️ CONFIGURACIÓN DEL ADMINISTRADOR (TÚ)
// =========================================================================

// 1. Si ayer sobró plata porque nadie acertó, ponla aquí (ej: 15). Si no, déjalo en 0.
const POZO_AYER = 0; 
const PRECIO_POR_PARTIDO = 3; 

// 2. TÚ ERES LA API: Modifica aquí los marcadores cuando acaben los partidos reales 
// y cambia el status de 'PENDING' a 'FINISHED'. Luego haces git push.
const PARTIDOS_DE_HOY = [
  { id: 101, home_team: 'Suiza', away_team: 'Canadá', home_flag: 'https://flagcdn.com/w80/ch.png', away_flag: 'https://flagcdn.com/w80/ca.png', home_score: 0, away_score: 0, status: 'PENDING', time: '15:00' },
  { id: 102, home_team: 'Bosnia', away_team: 'Catar', home_flag: 'https://flagcdn.com/w80/ba.png', away_flag: 'https://flagcdn.com/w80/qa.png', home_score: 0, away_score: 0, status: 'PENDING', time: '15:00' },
  { id: 103, home_team: 'Marruecos', away_team: 'Haití', home_flag: 'https://flagcdn.com/w80/ma.png', away_flag: 'https://flagcdn.com/w80/ht.png', home_score: 0, away_score: 0, status: 'PENDING', time: '18:00' },
  { id: 104, home_team: 'Escocia', away_team: 'Brasil', home_flag: 'https://flagcdn.com/w80/gb-sct.png', away_flag: 'https://flagcdn.com/w80/br.png', home_score: 0, away_score: 0, status: 'PENDING', time: '18:00' },
  { id: 105, home_team: 'Sudáfrica', away_team: 'Corea Sur', home_flag: 'https://flagcdn.com/w80/za.png', away_flag: 'https://flagcdn.com/w80/kr.png', home_score: 0, away_score: 0, status: 'PENDING', time: '21:00' },
  { id: 106, home_team: 'R. Checa', away_team: 'México', home_flag: 'https://flagcdn.com/w80/cz.png', away_flag: 'https://flagcdn.com/w80/mx.png', home_score: 0, away_score: 0, status: 'PENDING', time: '21:00' }
];

export default function App() {
  const hoyStr = new Date().toLocaleDateString('es-BO'); // Ej: "24/6/2026"
  const datosGuardados = JSON.parse(localStorage.getItem('pollaData') || '{}');
  
  // Si la fecha guardada no es de hoy, obliga a poner el nombre de nuevo
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
    
    // Guardar en Supabase para tener la lista de jugadores activos
    await supabase.from('users').upsert({ name: formattedName });
    
    // Guardar en el celular amarrado a la fecha de hoy
    localStorage.setItem('pollaData', JSON.stringify({ nombre: formattedName, fecha: hoyStr }));
    setUser(formattedName);
  };

  const predict = async (matchId, home, away) => {
    const { error } = await supabase.from('predictions').upsert({
      user_name: user, match_id: matchId, home_score: parseInt(home), away_score: parseInt(away)
    }, { onConflict: 'user_name, match_id' });
    
    if (error) alert("Hubo un error al guardar. Revisa tu internet.");
    else fetchPredictions();
  };

  const isLocked = (matchTimeStr) => {
    const [hours, minutes] = matchTimeStr.split(':');
    const matchDate = new Date();
    matchDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    const diffMinutes = (matchDate.getTime() - currentTime.getTime()) / 60000;
    return diffMinutes <= 5; // Se bloquea 5 minutos antes
  };

  // CÁLCULO ESTRICTO DE POZOS
  // 1. Contamos cuántos familiares ÚNICOS han apostado en al menos un partido hoy
  const jugadoresUnicosHoy = new Set(predictions.map(p => p.user_name)).size;
  
  // 2. Calculamos los acumulados
  let acumuladoEnJuego = POZO_AYER; 

  const matchesConPozo = matches.map(m => {
    const matchPreds = predictions.filter(p => p.match_id === m.id);
    const ganadores = matchPreds.filter(p => p.home_score === m.home_score && p.away_score === m.away_score);
    
    // Lo que se junta en ESTE partido es la cantidad de jugadores x 3 Bs
    const pozoBaseDelPartido = jugadoresUnicosHoy * PRECIO_POR_PARTIDO;
    const pozoTotal = pozoBaseDelPartido + acumuladoEnJuego;
    
    let mensajeResultado = "";
    
    if (m.status === 'FINISHED') {
      if (ganadores.length > 0) {
        const premio = (pozoTotal / ganadores.length).toFixed(2);
        mensajeResultado = `Ganador(es): ${ganadores.map(g => g.user_name).join(', ')} (Premio: ${premio} Bs)`;
        acumuladoEnJuego = 0; 
      } else {
        mensajeResultado = "Nadie acertó. El pozo se acumula.";
        acumuladoEnJuego = pozoTotal; 
      }
    }

    return { ...m, pozoTotal, mensajeResultado, ganadores };
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <form onSubmit={login} className="bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200 w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight uppercase">Mundial Vargas</h1>
            <p className="text-slate-500 text-sm mt-2">Nuevo día, nuevas apuestas. Costo: 18 Bs (3 Bs x 6 partidos).</p>
          </div>
          <input 
            type="text" placeholder="Ingresa tu nombre..." required
            className="w-full bg-slate-100 text-slate-900 px-5 py-4 rounded-xl mb-4 outline-none border border-slate-300 focus:border-blue-500 font-bold text-center"
            value={nameInput} onChange={(e) => setNameInput(e.target.value)}
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 uppercase tracking-widest">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  // La plata física que debe tener el cobrador hoy
  const recaudacionTotalDelDia = jugadoresUnicosHoy * (PRECIO_POR_PARTIDO * matches.length);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10">
      
      <header className="bg-white sticky top-0 z-50 p-4 border-b border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-black text-slate-900 uppercase">Mundial Vargas</h1>
          <p className="text-sm text-slate-500 mt-1">Jugador: <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{user}</span> | Jugadores Activos: {jugadoresUnicosHoy}</p>
        </div>
        <div className="bg-slate-100 px-6 py-2 rounded-2xl border border-slate-200 text-center w-full md:w-auto">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Recaudación (A cobrar hoy)</p>
          <p className="text-2xl font-black text-slate-800">{recaudacionTotalDelDia} <span className="text-base">Bs</span></p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 mt-8">
        <h2 className="text-lg font-black text-slate-800 mb-6 border-l-4 border-blue-600 pl-3 uppercase tracking-widest">Partidos y Predicciones</h2>
        
        <div className="grid gap-8 md:grid-cols-2">
          {matchesConPozo.map(m => {
            const myP = predictions.find(p => p.match_id === m.id && p.user_name === user);
            const isFinished = m.status === 'FINISHED';
            const locked = isLocked(m.time) && !isFinished;
            const matchPredictions = predictions.filter(p => p.match_id === m.id);
            
            return (
              <div key={m.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm relative flex flex-col">
                <div className="absolute top-0 right-0 bg-slate-100 text-slate-500 text-[10px] font-bold px-4 py-1.5 rounded-bl-xl border-b border-l border-slate-200 uppercase tracking-widest">
                  Hora: {m.time}
                </div>
                
                {isFinished && <div className="absolute top-0 left-0 bg-slate-800 text-white text-[10px] font-bold px-4 py-1.5 rounded-br-xl uppercase tracking-widest">Finalizado</div>}
                {locked && <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-bold px-4 py-1.5 rounded-br-xl uppercase tracking-widest animate-pulse">Cerrado</div>}

                <div className="flex justify-between items-center mt-6 mb-4">
                  <div className="flex flex-col items-center w-1/3">
                    <img src={m.home_flag} alt={m.home_team} className="w-16 h-12 object-cover rounded shadow-sm mb-3 border border-slate-200" />
                    <span className="font-bold text-sm text-slate-700 text-center uppercase tracking-wide">{m.home_team}</span>
                  </div>
                  
                  <div className="bg-slate-50 px-4 py-2 rounded-xl font-black text-2xl text-slate-800 border border-slate-200 shadow-inner">
                    {isFinished ? m.home_score : '-'} <span className="text-slate-400 mx-1">:</span> {isFinished ? m.away_score : '-'}
                  </div>

                  <div className="flex flex-col items-center w-1/3">
                    <img src={m.away_flag} alt={m.away_team} className="w-16 h-12 object-cover rounded shadow-sm mb-3 border border-slate-200" />
                    <span className="font-bold text-sm text-slate-700 text-center uppercase tracking-wide">{m.away_team}</span>
                  </div>
                </div>

                <div className="text-center mb-6">
                  <div className="inline-block bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-4 py-1.5 rounded-full shadow-sm">
                    Pozo en juego: {m.pozoTotal} Bs
                  </div>
                  {isFinished && (
                    <div className={`mt-2 text-xs font-black p-2 rounded-lg ${m.ganadores.length > 0 ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                      {m.mensajeResultado}
                    </div>
                  )}
                </div>

                {!isFinished && !locked ? (
                  <form 
                    onSubmit={(e) => { e.preventDefault(); predict(m.id, e.target.home.value, e.target.away.value); }}
                    className="bg-slate-50 p-3 rounded-xl flex justify-between items-center border border-slate-200 mb-6"
                  >
                    <input type="number" name="home" min="0" required defaultValue={myP?.home_score} className="w-14 bg-white border border-slate-300 rounded-lg p-2 text-center text-lg font-black text-slate-800 outline-none focus:border-blue-500" />
                    <button type="submit" className="bg-blue-600 text-white font-black px-6 py-2.5 rounded-lg text-xs hover:bg-blue-700 shadow-md uppercase tracking-widest">
                      {myP ? 'Modificar' : 'Apostar'}
                    </button>
                    <input type="number" name="away" min="0" required defaultValue={myP?.away_score} className="w-14 bg-white border border-slate-300 rounded-lg p-2 text-center text-lg font-black text-slate-800 outline-none focus:border-blue-500" />
                  </form>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-200 mb-6">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1 tracking-widest">Tu predicción anotada</p>
                    <p className="text-xl font-black text-slate-600">{myP?.home_score ?? '-'} : {myP?.away_score ?? '-'}</p>
                  </div>
                )}

                <div className="mt-auto border-t border-slate-100 pt-4">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Apuestas registradas</h3>
                  {matchPredictions.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto pr-1">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-500 text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3 font-bold rounded-l-lg">Jugador</th>
                            <th className="py-2 px-3 font-bold text-center rounded-r-lg">Marcador</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {matchPredictions.map(p => (
                            <tr key={p.user_name} className={p.user_name === user ? 'bg-blue-50/50' : ''}>
                              <td className="py-2 px-3 text-slate-700 font-medium">{p.user_name}</td>
                              <td className="py-2 px-3 text-center font-bold text-blue-600">{p.home_score} : {p.away_score}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-2">Nadie apostó aún.</p>
                  )}
                </div>

              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
}