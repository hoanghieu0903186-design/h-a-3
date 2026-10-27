import { useCallback, useEffect, useState } from 'react';
import { Toaster } from './components/Toaster';
import { isConfigured } from './lib/supabase';
import type { Navigate } from './lib/types';
import Home from './pages/Home';
import StudentRoom from './pages/StudentRoom';
import TeacherRoom from './pages/TeacherRoom';

export default function App() {
  const [loc, setLoc] = useState(() => window.location.pathname + window.location.search);

  useEffect(() => {
    const onPop = () => setLoc(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate: Navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to);
    setLoc(to);
    window.scrollTo(0, 0);
  }, []);

  const url = new URL(loc, window.location.origin);
  const parts = url.pathname.split('/').filter(Boolean);

  let page;
  if (!isConfigured) {
    page = (
      <section className="card narrow">
        <h2>Chưa cấu hình Supabase</h2>
        <p>
          Thiếu biến môi trường <code>VITE_SUPABASE_URL</code> và <code>VITE_SUPABASE_ANON_KEY</code>. Xem README để
          cấu hình.
        </p>
      </section>
    );
  } else if (parts[0] === 'teacher' && parts[1]) {
    page = <TeacherRoom key={parts[1]} code={parts[1].toUpperCase()} navigate={navigate} />;
  } else if (parts[0] === 'play' && parts[1]) {
    page = <StudentRoom key={parts[1]} code={parts[1].toUpperCase()} navigate={navigate} />;
  } else {
    page = <Home navigate={navigate} initialRoom={(url.searchParams.get('room') ?? '').toUpperCase()} />;
  }

  return (
    <>
      <header className="topbar">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
        >
          Cục Điều tra Nguyên tố
        </a>
      </header>
      <main>{page}</main>
      <Toaster />
    </>
  );
}
