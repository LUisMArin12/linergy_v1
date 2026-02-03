import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7FAF8] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-24 h-24 bg-[#DDF3EA] rounded-full flex items-center justify-center mx-auto mb-6">
          <MapPin className="w-12 h-12 text-[#157A5A]" />
        </div>
        <h1 className="text-6xl font-bold text-[#111827] mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-[#111827] mb-2">Página no encontrada</h2>
        <p className="text-[#6B7280] mb-8 max-w-md mx-auto">
          La página que buscas no existe o ha sido movida
        </p>
        <Button
          variant="primary"
          onClick={() => navigate('/map')}
          icon={<MapPin className="w-4 h-4" />}
        >
          Volver al mapa
        </Button>
      </div>
    </div>
  );
}
