import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Download, Eye, FileText, Filter, Search, X } from 'lucide-react';

import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

import { supabase, Falla, Linea, parseGeometry } from '../lib/supabase';
import { generateFaultPDF, copyFaultText } from '../lib/reportUtils';
import { useToast } from '../contexts/ToastContext';
import FaultReportModal from '../components/modals/FaultReportModal';

const estadoLabel: Record<string, string> = {
  ABIERTA: 'Abierta',
  EN_ATENCION: 'En atención',
  CERRADA: 'Cerrada',
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isValidLatLon(lat: unknown, lon: unknown): lat is number {
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export default function ReportsPage() {
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLinea, setSelectedLinea] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedFalla, setSelectedFalla] = useState<Falla | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 20;

  const { data: lineas = [] } = useQuery({
    queryKey: ['lineas_reports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lineas').select('*').order('numero');
      if (error) throw error;
      return (data ?? []) as Linea[];
    },
  });

  const { data: allFallas = [], isLoading } = useQuery({
    queryKey: ['fallas_reports'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_fallas_geojson');
      if (error) throw error;
      return (data ?? []) as Falla[];
    },
  });

  const filteredFallas = useMemo(() => {
    let filtered = allFallas;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          (f.tipo ?? '').toLowerCase().includes(query) ||
          (f.descripcion ?? '').toLowerCase().includes(query)
      );
    }

    if (selectedLinea) {
      filtered = filtered.filter((f) => f.linea_id === selectedLinea);
    }

    if (selectedEstado) {
      filtered = filtered.filter((f) => f.estado === selectedEstado);
    }

    if (dateFrom) {
      filtered = filtered.filter((f) => new Date(f.ocurrencia_ts) >= new Date(dateFrom));
    }

    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((f) => new Date(f.ocurrencia_ts) <= toDate);
    }

    return filtered.sort(
      (a, b) => new Date(b.ocurrencia_ts).getTime() - new Date(a.ocurrencia_ts).getTime()
    );
  }, [allFallas, searchQuery, selectedLinea, selectedEstado, dateFrom, dateTo]);

  const totalPages = Math.ceil(filteredFallas.length / itemsPerPage);

  const paginatedFallas = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredFallas.slice(start, end);
  }, [filteredFallas, page]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLinea('');
    setSelectedEstado('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleExportPDF = (falla: Falla) => {
    try {
      const linea = lineas.find((l) => l.id === falla.linea_id) ?? null;
      generateFaultPDF(falla, linea);
      showToast('PDF generado correctamente', 'success');
    } catch {
      showToast('Error al generar PDF', 'error');
    }
  };

  const handleCopyText = (falla: Falla) => {
    try {
      const linea = lineas.find((l) => l.id === falla.linea_id) ?? null;
      copyFaultText(falla, linea);
      showToast('Texto copiado al portapapeles', 'success');
    } catch {
      showToast('Error al copiar texto', 'error');
    }
  };

  const activeFiltersCount =
    (searchQuery ? 1 : 0) +
    (selectedLinea ? 1 : 0) +
    (selectedEstado ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#111827]">Reportes de Fallas</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Inventario de fallas registradas (el reporte se genera a partir de la falla).
          </p>
        </div>

        <Button
          variant="secondary"
          icon={<Filter className="w-4 h-4" />}
          onClick={() => setShowFilters((v) => !v)}
        >
          Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
        </Button>
      </div>

      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Buscar"
              icon={<Search className="w-4 h-4" />}
              placeholder="Tipo o descripción..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
            />

            <Select
              label="Línea"
              value={selectedLinea}
              onChange={(e) => {
                setSelectedLinea(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'Todas las líneas' },
                ...lineas.map((l) => ({
                  value: l.id,
                  label: `${l.numero}${l.nombre ? ` - ${l.nombre}` : ''}`,
                })),
              ]}
            />

            <Select
              label="Estado"
              value={selectedEstado}
              onChange={(e) => {
                setSelectedEstado(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'ABIERTA', label: 'Abierta' },
                { value: 'EN_ATENCION', label: 'En atención' },
                { value: 'CERRADA', label: 'Cerrada' },
              ]}
            />

            <Input
              label="Fecha desde"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />

            <Input
              label="Fecha hasta"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />

            {activeFiltersCount > 0 && (
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  icon={<X className="w-4 h-4" />}
                  onClick={clearFilters}
                  className="w-full"
                >
                  Limpiar filtros
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#157A5A] mx-auto mb-4" />
          <p className="text-[#6B7280]">Cargando fallas...</p>
        </Card>
      ) : filteredFallas.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-12 h-12 text-[#6B7280] mx-auto mb-4" />
          <p className="text-[#6B7280]">
            {activeFiltersCount > 0
              ? 'No se encontraron fallas con los filtros aplicados'
              : 'No hay fallas registradas'}
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile-first: cards en móvil, tabla en md+ */}
          <div className="md:hidden space-y-3">
            {paginatedFallas.map((falla) => {
              const linea = lineas.find((l) => l.id === falla.linea_id) ?? null;
              return (
                <Card key={falla.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#111827] truncate">
                        Línea {linea?.numero || 'N/A'} {linea?.nombre ? `- ${linea.nombre}` : ''}
                      </div>
                      <div className="text-xs text-[#6B7280] mt-1">
                        {new Date(falla.ocurrencia_ts).toLocaleDateString('es-ES')}{' '}
                        {new Date(falla.ocurrencia_ts).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>

                    <Badge variant="status" status={falla.estado}>
                      {estadoLabel[falla.estado] || falla.estado}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-[#6B7280]">KM</div>
                      <div className="text-[#111827]">{falla.km.toFixed(1)}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] uppercase tracking-wide text-[#6B7280]">Tipo</div>
                      <div className="text-[#111827] truncate">{falla.tipo}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSelectedFalla(falla)}
                      className="p-2 hover:bg-[#DDF3EA] rounded-lg transition-colors"
                      title="Ver detalle"
                    >
                      <Eye className="w-4 h-4 text-[#6B7280]" />
                    </button>
                    <button
                      onClick={() => handleExportPDF(falla)}
                      className="p-2 hover:bg-[#DDF3EA] rounded-lg transition-colors"
                      title="Exportar PDF"
                    >
                      <Download className="w-4 h-4 text-[#6B7280]" />
                    </button>
                    <button
                      onClick={() => handleCopyText(falla)}
                      className="p-2 hover:bg-[#DDF3EA] rounded-lg transition-colors"
                      title="Copiar texto"
                    >
                      <Copy className="w-4 h-4 text-[#6B7280]" />
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F7FAF8] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                      Línea
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                      KM
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                      Fecha/Hora
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wide">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {paginatedFallas.map((falla) => {
                    const linea = lineas.find((l) => l.id === falla.linea_id) ?? null;
                    return (
                      <tr key={falla.id} className="hover:bg-[#F7FAF8] transition-colors">
                        <td className="px-4 py-3 text-sm text-[#111827] font-medium">{linea?.numero || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-[#6B7280]">{falla.km.toFixed(1)}</td>
                        <td className="px-4 py-3 text-sm text-[#111827]">
                          <div className="max-w-xs truncate">{falla.tipo}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="status" status={falla.estado}>
                            {estadoLabel[falla.estado] || falla.estado}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#6B7280]">
                          {new Date(falla.ocurrencia_ts).toLocaleDateString('es-ES')}{' '}
                          {new Date(falla.ocurrencia_ts).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedFalla(falla)}
                              className="p-1.5 hover:bg-[#DDF3EA] rounded-lg transition-colors"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4 text-[#6B7280]" />
                            </button>
                            <button
                              onClick={() => handleExportPDF(falla)}
                              className="p-1.5 hover:bg-[#DDF3EA] rounded-lg transition-colors"
                              title="Exportar PDF"
                            >
                              <Download className="w-4 h-4 text-[#6B7280]" />
                            </button>
                            <button
                              onClick={() => handleCopyText(falla)}
                              className="p-1.5 hover:bg-[#DDF3EA] rounded-lg transition-colors"
                              title="Copiar texto"
                            >
                              <Copy className="w-4 h-4 text-[#6B7280]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[#6B7280]">
                Mostrando {(page - 1) * itemsPerPage + 1} - {Math.min(page * itemsPerPage, filteredFallas.length)} de{' '}
                {filteredFallas.length} fallas
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {selectedFalla &&
        (() => {
          const linea = lineas.find((l) => l.id === selectedFalla.linea_id) ?? null;

          const geom = parseGeometry(selectedFalla.geom);
          const coords = geom && geom.type === 'Point' ? geom.coordinates : null; // [lon, lat]

          const lonRaw = coords ? coords[0] : null;
          const latRaw = coords ? coords[1] : null;

          const hasValidCoords = isValidLatLon(latRaw, lonRaw);
          const lat: number | null = hasValidCoords ? latRaw : null;
          const lon: number | null = hasValidCoords ? lonRaw : null;

          const fecha = new Date(selectedFalla.ocurrencia_ts);
          const fechaStr = fecha.toISOString().split('T')[0];
          const horaStr = fecha.toTimeString().slice(0, 5);

          return (
            <FaultReportModal
              isOpen={true}
              onClose={() => setSelectedFalla(null)}
              faultData={{
                lat,
                lon,
                hasValidCoords,

                fallaId: selectedFalla.id,
                lineaNumero: linea?.numero || 'N/A',
                lineaNombre: linea?.nombre || '',
                km: selectedFalla.km,
                tipo: selectedFalla.tipo,
                fecha: fechaStr,
                hora: horaStr,
                descripcion: selectedFalla.descripcion || '',
                estado: estadoLabel[selectedFalla.estado] || selectedFalla.estado,
              }}
            />
          );
        })()}
    </div>
  );
}
