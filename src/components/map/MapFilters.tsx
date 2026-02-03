// src/components/map/MapFilters.tsx
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Chip from "../ui/Chip";
import Badge from "../ui/Badge";
import { Filter, ChevronDown, X } from "lucide-react";
import { Classification, FaultStatus } from "../../types";

export interface FilterState {
  classifications: Classification[];
  statuses: FaultStatus[];
  showStructures: boolean;
  showFaults: boolean;
}

interface MapFiltersProps {
  onFiltersChange: (filters: FilterState) => void;
}

export default function MapFilters({ onFiltersChange }: MapFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // ✅ Default: NO visibles hasta que el usuario lo active
  const [filters, setFilters] = useState<FilterState>({
    classifications: [],
    statuses: [],
    showStructures: false,
    showFaults: false,
  });

  // ✅ Importante: al montar, empujar el estado inicial al padre.
  // Si no haces esto, MapPage puede seguir con defaults distintos.
  useEffect(() => {
    onFiltersChange(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFilters = (update: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...update };
      onFiltersChange(next);
      return next;
    });
  };

  const toggleClassification = (c: Classification) => {
    updateFilters({
      classifications: filters.classifications.includes(c)
        ? filters.classifications.filter((x) => x !== c)
        : [...filters.classifications, c],
    });
  };

  const toggleStatus = (s: FaultStatus) => {
    updateFilters({
      statuses: filters.statuses.includes(s)
        ? filters.statuses.filter((x) => x !== s)
        : [...filters.statuses, s],
    });
  };

  const activeFiltersCount =
    filters.classifications.length +
    filters.statuses.length +
    0;

  const clearAllFilters = () => {
    updateFilters({
      classifications: [],
      statuses: [],
      showStructures: false,
      showFaults: false,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-[#F7FAF8] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#DDF3EA] rounded-lg flex items-center justify-center">
            <Filter className="w-4 h-4 text-[#157A5A]" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#111827]">Filtros</span>
              {activeFiltersCount > 0 && (
                <Badge className="bg-[#157A5A] text-white border-[#157A5A]">
                  {activeFiltersCount}
                </Badge>
              )}
            </div>
            <p className="text-xs text-[#6B7280]">
              {isExpanded ? "Contraer filtros" : "Expandir filtros"}
            </p>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-[#6B7280] transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-[#E5E7EB] overflow-hidden"
          >
            <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Limpiar todos los filtros
                </button>
              )}

              <div>
                <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2 block">
                  Clasificación
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["Alta", "Moderada", "Baja"] as Classification[]).map((c) => (
                    <Chip
                      key={c}
                      selected={filters.classifications.includes(c)}
                      onClick={() => toggleClassification(c)}
                      className="text-xs"
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-2 block">
                  Estado
                </label>
                <div className="flex flex-wrap gap-2">
                  {(["Abierta", "En atención", "Cerrada"] as FaultStatus[]).map(
                    (s) => (
                      <Chip
                        key={s}
                        selected={filters.statuses.includes(s)}
                        onClick={() => toggleStatus(s)}
                        className="text-xs"
                      >
                        {s}
                      </Chip>
                    )
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E7EB]">
                <label className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide mb-3 block">
                  Visibilidad
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filters.showStructures}
                      onChange={(e) =>
                        updateFilters({ showStructures: e.target.checked })
                      }
                      className="w-4 h-4 text-[#157A5A] rounded focus:ring-[#157A5A]"
                    />
                    <span className="text-sm text-[#111827] group-hover:text-[#157A5A] transition-colors">
                      Estructuras
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={filters.showFaults}
                      onChange={(e) => updateFilters({ showFaults: e.target.checked })}
                      className="w-4 h-4 text-[#157A5A] rounded focus:ring-[#157A5A]"
                    />
                    <span className="text-sm text-[#111827] group-hover:text-[#157A5A] transition-colors">
                      Fallas
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}