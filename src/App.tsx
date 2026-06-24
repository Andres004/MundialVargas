// @ts-nocheck
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://spulkmtcpxjxqcolkiuo.supabase.co', 'sb_publishable_OGy26eyySr3gpRsKC1imtA_iOzL_0Hm');

export default function App() {
  const [user, setUser] = useState(localStorage.getItem('pollaUser') || '');
  const [nameInput, setNameInput] = useState('');
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    if (user) {
      fetchMatches();
      fetchPredictions();
    }
    
    // Escuchar si otros familiares apuestan en tiempo real para actualizar el Pozo y la Tabla
    const channel = supabase
      .channel('public-predictions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => {
        fetchPredictions();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user]);

  const fetchMatches = async () => {
    // 🚀 MAGIA AUTOMÁTICA: Partidos de hoy 24/06. No usas base de datos para esto.
    // Cuando un partido termine en la vida real, abres tu código, pones los goles,
    // cambias el 'status' a 'FINISHED', haces 'git push' y la tabla se calcula sola.
    const todayMatches = [
      { id: 101, home_team: 'Suiza', away_team: 'Canadá', home_flag: '🇨🇭', away_flag: '🇨🇦', home_score: 0, away_score: 0, status: 'PENDING', time: '15:00' },
      { id: 102, home_team: 'Bosnia', away_team: 'Catar', home_flag: '🇧🇦', away_flag: '🇶🇦', home_score: 0, away_score: 0, status: 'PENDING', time: '15:00' },
      { id: 103, home_team: 'Marruecos', away_team: 'Haití', home_flag: '🇲🇦', away_flag: '🇭🇹', home_score: 0, away_score: 0, status: 'PENDING', time: '18:00' },
      { id: 104, home_team: 'Escocia', away_team: 'Brasil', home_flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', away_flag: '🇧🇷', home_score: 0, away_score: 0, status: 'PENDING', time: '18:00' },
      { id: 105, home_team: 'Sudáfrica', away_team: 'Corea Sur', home_flag: '🇿🇦', away_flag: '🇰🇷', home_score: 0, away_score: 0, status: 'PENDING', time: '21:00' },
      { id: 106, home_team: 'R. Checa', away_team: 'México', home_flag: '🇨🇿', away_flag: '🇲🇽', home_score: 0, away_score: 0, status: 'PENDING', time: '21:00' }
    ];
    setMatches(todayMatches);
  };

  const fetchPredictions = async () => {
    const { data } = await supabase.from('predictions').select('*');
    if (data) setPredictions(data);
  };

  const login = async (e) => {
    e.preventDefault();
    if (!nameInput) return;
    const formattedName = nameInput.trim();
    await supabase.from('users').upsert({ name: formattedName });
    localStorage.setItem('pollaUser', formattedName);
    setUser(formattedName);
  };

  const predict = async (matchId, home, away) => {
    await supabase.from('predictions').upsert({
      user_name: user,
      match_id: matchId,
      home_score: parseInt(home),
      away_score: parseInt(away)
    }, { onConflict: 'user_name, match_id' });
    fetchPredictions();
    alert('¡Apuesta guardada correctamente! 🍀');
  };

  // CÁLCULO DE LA TABLA DE POSICIONES
  const getLeaderboard = () => {
    const usersSet = new Set(predictions.map(p => p.user_name));
    const leaderboard = Array.from(usersSet).map(username => {
      const userPreds = predictions.filter(p => p.user_name === username);
      let exactGuesses = 0;

      userPreds.forEach(pred => {
        const match = matches.find(m => m.id === pred.match_id);
        if (match && match.status === 'FINISHED') {
          if (match.home_score === pred.home_score && match.away_score === pred.away_score) {
            exactGuesses += 1;
          }
        }
      });

      return {
        username,
        points: exactGuesses * 3 // 3 pts (o 3 Bs que se lleva) por cada marcador exacto
      };
    });

    // Ordenar de mayor a menor puntaje
    return leaderboard.sort((a, b) => b.points - a.points);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <form onSubmit={login} className="bg-white p-8 md:p-10 rounded-3xl shadow-xl border border-slate-200 w-full max-w-sm">
          <div className="text-center mb-6">
            <span className="text-5xl mb-2 block">🏆</span>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Mundial Vargas</h1>
            <p className="text-slate-500 text-sm mt-2">Ingresa tu nombre para jugar.</p>
          </div>
          <input 
            type="text" placeholder="Tu nombre..." required
            className="w-full bg-slate-100 text-slate-900 px-5 py-4 rounded-xl mb-4 outline-none border border-slate-300 focus:border-blue-500 font-bold text-center"
            value={nameInput} onChange={(e) => setNameInput(e.target.value)}
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30">
            ENTRAR
          </button>
        </form>
      </div>
    );
  }

  const pot = predictions.length * 3;
  const leaderboardData = getLeaderboard();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-10">
      
      {/* HEADER CLARO RESPONSIVE */}
      <header className="bg-white sticky top-0 z-50 p-4 border-b border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-black text-slate-900">🏆 Mundial Vargas</h1>
          <p className="text-sm text-slate-500 mt-1">Hoy 24/06 | Jugador: <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{user}</span></p>
        </div>
        <div className="bg-amber-50 px-6 py-2 rounded-2xl border border-amber-200 text-center w-full md:w-auto">
          <p className="text-amber-600 text-[10px] font-black uppercase tracking-widest">Pozo Acumulado</p>
          <p className="text-3xl font-black text-amber-500">{pot} <span className="text-xl">Bs</span></p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA DE PARTIDOS */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-black text-slate-800 mb-4 border-l-4 border-blue-600 pl-3">⚽ PARTIDOS DE HOY</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {matches.map(m => {
              const myP = predictions.find(p => p.match_id === m.id && p.user_name === user);
              const isFinished = m.status === 'FINISHED';
              
              return (
                <div key={m.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm relative">
                  <div className="absolute top-0 right-0 bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl border-b border-l border-slate-200">
                    🕒 {m.time}
                  </div>
                  {isFinished && <div className="absolute top-0 left-0 bg-slate-800 text-white text-[10px] font-bold px-3 py-1 rounded-br-xl">FINALIZADO</div>}

                  <div className="flex justify-between items-center mt-6 mb-5">
                    <div className="flex flex-col items-center w-1/3">
                      <span className="text-4xl mb-1">{m.home_flag}</span>
                      <span className="font-bold text-sm text-slate-700 text-center">{m.home_team}</span>
                    </div>
                    
                    <div className="bg-slate-100 px-4 py-2 rounded-xl font-black text-2xl text-slate-800 border border-slate-200">
                      {isFinished ? m.home_score : '-'} <span className="text-slate-400">:</span> {isFinished ? m.away_score : '-'}
                    </div>

                    <div className="flex flex-col items-center w-1/3">
                      <span className="text-4xl mb-1">{m.away_flag}</span>
                      <span className="font-bold text-sm text-slate-700 text-center">{m.away_team}</span>
                    </div>
                  </div>

                  {!isFinished ? (
                    <form 
                      onSubmit={(e) => { e.preventDefault(); predict(m.id, e.target.home.value, e.target.away.value); }}
                      className="bg-slate-50 p-2 rounded-xl flex justify-between items-center border border-slate-200"
                    >
                      <input type="number" name="home" min="0" required defaultValue={myP?.home_score} className="w-12 bg-white border border-slate-300 rounded-lg p-2 text-center text-lg font-black text-slate-800 outline-none focus:border-blue-500" />
                      <button type="submit" className="bg-blue-600 text-white font-black px-4 py-2 rounded-lg text-xs hover:bg-blue-700 shadow-md">
                        {myP ? 'MODIFICAR' : 'APOSTAR'}
                      </button>
                      <input type="number" name="away" min="0" required defaultValue={myP?.away_score} className="w-12 bg-white border border-slate-300 rounded-lg p-2 text-center text-lg font-black text-slate-800 outline-none focus:border-blue-500" />
                    </form>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-xl text-center border border-slate-200">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Tu predicción fue</p>
                      <p className="text-xl font-black text-blue-600">{myP?.home_score ?? '-'} : {myP?.away_score ?? '-'}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* COLUMNA DE LA TABLA DE LÍDERES */}
        <div>
          <h2 className="text-lg font-black text-slate-800 mb-4 border-l-4 border-amber-500 pl-3">🏆 TABLA DE LÍDERES</h2>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-500 text-xs font-black uppercase">
                  <th className="py-3 px-4">Pos</th>
                  <th className="py-3 px-4">Familiar</th>
                  <th className="py-3 px-4 text-center">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaderboardData.length === 0 && (
                  <tr><td colSpan="3" className="py-6 text-center text-sm text-slate-400">Nadie ha apostado aún</td></tr>
                )}
                {leaderboardData.map((row, index) => (
                  <tr key={row.username} className={row.username === user ? 'bg-blue-50' : ''}>
                    <td className="py-3 px-4 text-sm font-black text-slate-400">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </td>
                    <td className="py-3 px-4 text-sm font-bold text-slate-800">{row.username}</td>
                    <td className="py-3 px-4 text-center text-sm font-black text-blue-600">{row.points}</td>
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