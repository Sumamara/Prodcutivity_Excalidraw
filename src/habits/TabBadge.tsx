import { useMemo } from "react";

import { lateCount } from "./habitCore";
import { logsOf, useHabitsSnapshot } from "./habitsStore";
import { useMinute } from "./minute";
import "./Habits.css";

/**
 * Insignia de la pestaña Hábitos: cuántos hábitos de hoy están "Pendientes"
 * (su hora recomendada ya pasó y no se marcaron). Componente aislado: solo él se
 * suscribe a la tienda y al reloj de 1 minuto, no `App`.
 */
export function HabitTabBadge() {
  const snap = useHabitsSnapshot();
  const { today, hhmm } = useMinute();
  const n = useMemo(
    () => lateCount(snap.habits, (id) => logsOf(id), today, hhmm),
    [snap.v, today, hhmm],
  );
  if (!snap.loaded || n === 0) return null;
  return (
    <span className="hb-badge" aria-label={`${n} hábitos pendientes hoy`} title={`${n} pendientes hoy`}>
      {n}
    </span>
  );
}
